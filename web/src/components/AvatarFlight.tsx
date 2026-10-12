import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Avatar } from './Bits';

const OUT_MS = 130;
const FLY_MS = 520;
const STAGGER_MS = 26;
const FADE_IN_DELAY_MS = 160;
const FADE_IN_MS = 320;
const SLOW_FETCH_MS = 200;
const FLY_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Spot = Rect & { name: string; url?: string | null };

interface Entry {
  ref: RefObject<HTMLDivElement | null>;
  name: string;
  size: number;
  url?: string | null;
}

interface FlightItem {
  id: string;
  name: string;
  url?: string | null;
  to: Rect;
  dx: number;
  dy: number;
  scale: number;
  delayMs: number;
}

interface FlightApi {
  flying: boolean;
  register: (id: string, entry: Entry) => () => void;
}

export const FlightContext = createContext<FlightApi | null>(null);

/**
 * An avatar that takes part in the re-ranking shuffle animation.
 * When a flight is underway, the real avatar is hidden so the flying copy can glide in its place.
 */
export function FlightAvatar({
  userId,
  name,
  size,
  url,
}: {
  userId: string;
  name: string;
  size: number;
  url?: string | null;
}) {
  const api = useContext(FlightContext);
  const ref = useRef<HTMLDivElement>(null);
  const register = api?.register;

  useEffect(() => {
    return register?.(userId, { ref, name, size, url });
  }, [register, userId, name, size, url]);

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        opacity: api?.flying ? 0 : 1,
        display: 'inline-grid',
        placeItems: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <Avatar name={name} userId={userId} size={size} url={url} />
    </div>
  );
}

function FlightAvatarItem({ item }: { item: FlightItem }) {
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;

    const anim = el.animate(
      [
        {
          transform: `translate3d(${item.dx}px, ${item.dy}px, 0) scale(${item.scale})`,
        },
        {
          transform: 'translate3d(0, 0, 0) scale(1)',
        },
      ],
      {
        duration: FLY_MS,
        delay: item.delayMs,
        easing: FLY_EASING,
        fill: 'both',
      },
    );

    return () => {
      anim.cancel();
    };
  }, [item]);

  return (
    <div
      ref={nodeRef}
      style={{
        position: 'absolute',
        left: item.to.x,
        top: item.to.y,
        width: item.to.w,
        height: item.to.h,
        display: 'grid',
        placeItems: 'center',
        willChange: 'transform',
        zIndex: 50,
      }}
    >
      <Avatar name={item.name} userId={item.id} size={item.to.w} url={item.url} />
    </div>
  );
}

/**
 * Hook managing the signature Avatar Flight shuffle animation when changing
 * leaderboard modes or categories.
 */
export function useBoardFlight<T extends { key: string; sig: string }>(
  incoming: T | null | undefined,
  currentKey: string,
) {
  const [shown, setShown] = useState<T | null>(null);
  const shownRef = useRef<T | null>(null);
  shownRef.current = shown;

  const [flying, setFlying] = useState(false);
  const [items, setItems] = useState<FlightItem[] | null>(null);
  const [isDimmed, setIsDimmed] = useState(false);

  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const registry = useRef(new Map<string, Entry>());

  const register = useCallback((id: string, entry: Entry) => {
    registry.current.set(id, entry);
    return () => {
      if (registry.current.get(id) === entry) registry.current.delete(id);
    };
  }, []);

  const measureAll = useCallback((): Map<string, Spot> => {
    const outer = outerRef.current;
    const out = new Map<string, Spot>();
    if (!outer) return out;
    const outerRect = outer.getBoundingClientRect();

    for (const [id, entry] of registry.current.entries()) {
      const node = entry.ref.current;
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        out.set(id, {
          x: rect.left - outerRect.left,
          y: rect.top - outerRect.top,
          w: rect.width,
          h: rect.height,
          name: entry.name,
          url: entry.url,
        });
      }
    }
    return out;
  }, []);

  useEffect(() => {
    // Interrupted state reset
    setItems(null);
    setFlying(false);
    setIsDimmed(false);

    const current = shownRef.current;
    if (contentRef.current) {
      contentRef.current.style.opacity = '1';
    }

    // The selection changed and its data is not yet available:
    // keep the current board visible and gently dim after SLOW_FETCH_MS
    if (!incoming || incoming.key !== currentKey) {
      if (!current) return;
      const timer = setTimeout(() => {
        setIsDimmed(true);
      }, SLOW_FETCH_MS);
      return () => {
        clearTimeout(timer);
      };
    }

    // Very first board load: simply display it
    if (!current) {
      setShown(incoming);
      return;
    }

    // Same board and same ranking fingerprint: update in place without animation
    if (current.key === incoming.key && current.sig === incoming.sig) {
      setShown(incoming);
      return;
    }

    // Mode or ranking changed: perform the FLIP Avatar Flight shuffle animation
    let cancelled = false;

    void (async () => {
      // 1. Measure initial positions of avatars currently rendered
      const from = measureAll();
      if (cancelled || from.size === 0) {
        setShown(incoming);
        return;
      }

      // 2. Set flying flag so copies take over and real avatars disappear
      setFlying(true);

      // Render static items at their starting positions while text fades out
      const initialCopies: FlightItem[] = [...from.entries()].map(([id, r]) => ({
        id,
        name: r.name,
        url: r.url,
        to: r,
        dx: 0,
        dy: 0,
        scale: 1,
        delayMs: 0,
      }));
      setItems(initialCopies);

      // 3. Fade out old board content
      if (contentRef.current) {
        contentRef.current.style.transition = `opacity ${OUT_MS}ms ease-in`;
        contentRef.current.style.opacity = '0';
      }
      await new Promise((res) => setTimeout(res, OUT_MS));
      if (cancelled) return;

      // 4. Swap to the incoming board in the background
      setShown(incoming);

      // Wait two animation frames for DOM repaint to calculate new positions
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (cancelled) return;

      // 5. Measure new positions
      const to = measureAll();
      if (cancelled) return;

      // Calculate flights from old to new positions
      const flights: FlightItem[] = [];
      const commonEntries = [...to.entries()]
        .filter(([id]) => from.has(id))
        .sort((a, b) => a[1].y - b[1].y || a[1].x - b[1].x);

      commonEntries.forEach(([id, t], index) => {
        const f = from.get(id)!;
        flights.push({
          id,
          name: t.name,
          url: t.url,
          to: t,
          dx: f.x - t.x,
          dy: f.y - t.y,
          scale: f.w / t.w,
          delayMs: index * STAGGER_MS,
        });
      });

      setItems(flights);

      // 6. Fade new board content back in with a slight delay
      setTimeout(() => {
        if (!cancelled && contentRef.current) {
          contentRef.current.style.transition = `opacity ${FADE_IN_MS}ms ease-out`;
          contentRef.current.style.opacity = '1';
        }
      }, FADE_IN_DELAY_MS);

      // 7. Wait for all flight animations to complete
      const maxDelay = flights.length > 0 ? (flights.length - 1) * STAGGER_MS : 0;
      const totalFlightTime = FLY_MS + maxDelay + 40;

      await new Promise((res) => setTimeout(res, totalFlightTime));
      if (cancelled) return;

      // 8. Clean up flight overlay and restore real avatars in new places
      setFlying(false);
      setItems(null);
      if (contentRef.current) {
        contentRef.current.style.transition = '';
        contentRef.current.style.opacity = '1';
      }
    })();

    return () => {
      cancelled = true;
      setFlying(false);
      setItems(null);
      if (contentRef.current) {
        contentRef.current.style.transition = '';
        contentRef.current.style.opacity = '1';
      }
    };
  }, [incoming, currentKey, measureAll]);

  const api = useMemo<FlightApi>(() => ({ flying, register }), [flying, register]);

  const overlay: ReactNode = items ? (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 45,
        overflow: 'hidden',
      }}
    >
      {items.map((item) => (
        <FlightAvatarItem key={item.id} item={item} />
      ))}
    </div>
  ) : null;

  return {
    shown,
    outerRef,
    contentRef,
    isDimmed,
    overlay,
    flightApi: api,
  };
}
