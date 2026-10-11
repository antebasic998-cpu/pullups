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
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Avatar } from './Bits';

/**
 * Animated re-ranking for the board.
 *
 * When the board changes (another mode, another exercise, a new result moving someone up), the previous
 * content fades out, the faces glide from where they were to where they now belong, and the new text fades in.
 *
 *   1. measure every face, lay copies of them on top of the real ones, hide the real ones
 *   2. fade the old content out (the faces stay)
 *   3. swap in the new content (hidden), measure the faces' new spots
 *   4. fly each face from old to new spot (staggered by rank) while the new content fades in
 *   5. reveal the real faces underneath, drop the copies
 *
 * The content on screen is always one consistent board, so rows and numbers never disagree.
 */

const OUT_MS = 140;
const FLY_MS = 540;
const STAGGER_MS = 26;
const FADE_IN_DELAY_MS = 170;
const FADE_IN_MS = 320;
/** Only dim the board for a slow fetch; a fast one goes straight to the animation. */
const SLOW_FETCH_MS = 250;
const DIM = 0.5;
const FLY_EASING = Easing.bezier(0.16, 1, 0.3, 1);

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Spot = Rect & { name: string };
interface Entry {
  ref: RefObject<View | null>;
  name: string;
}
interface FlightItem {
  id: string;
  name: string;
  to: Rect;
  /** 0 = at the old spot, 1 = at the new one. */
  p: Animated.Value;
  tx: Animated.AnimatedInterpolation<number>;
  ty: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
}

/** Copy of a face that travels from `from` to `to`, driven by one native-driven progress value. */
function makeItem(id: string, name: string, from: Rect, to: Rect, progress: number): FlightItem {
  const p = new Animated.Value(progress);
  const range = { inputRange: [0, 1] };
  return {
    id,
    name,
    to,
    p,
    tx: p.interpolate({ ...range, outputRange: [from.x + from.w / 2 - (to.x + to.w / 2), 0] }),
    ty: p.interpolate({ ...range, outputRange: [from.y + from.h / 2 - (to.y + to.h / 2), 0] }),
    scale: p.interpolate({ ...range, outputRange: [from.w / to.w, 1] }),
  };
}
interface FlightApi {
  /** True while copies of the faces are carrying them; the real ones stay invisible. */
  flying: boolean;
  register: (id: string, entry: Entry) => () => void;
}

export const FlightContext = createContext<FlightApi | null>(null);

/** An avatar that takes part in the re-ranking animation (it behaves like a plain Avatar anywhere else). */
export function FlightAvatar({ userId, name, size }: { userId: string; name: string; size: number }) {
  const api = useContext(FlightContext);
  const ref = useRef<View>(null);
  const register = api?.register;
  useEffect(() => register?.(userId, { ref, name }), [register, userId, name]);

  return (
    <View ref={ref} collapsable={false} style={{ width: size, height: size, opacity: api?.flying ? 0 : 1 }}>
      <Avatar name={name} userId={userId} size={size} />
    </View>
  );
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function frames(n: number) {
  for (let i = 0; i < n; i++) await frame();
}

/**
 * @param incoming latest fetched board; `key` says which selection it belongs to, `sig` fingerprints its order
 * @param currentKey the selection the user is asking for right now
 */
export function useBoardFlight<T extends { key: string; sig: string }>(incoming: T | null, currentKey: string) {
  const [shown, setShown] = useState<T | null>(null);
  const shownRef = useRef<T | null>(null);
  shownRef.current = shown;
  const [flying, setFlying] = useState(false);
  const [items, setItems] = useState<FlightItem[] | null>(null);
  const outerRef = useRef<View>(null);
  const registry = useRef(new Map<string, Entry>());
  const content = useRef(new Animated.Value(0)).current;
  const activeAnim = useRef<Animated.CompositeAnimation | null>(null);

  const register = useCallback((id: string, entry: Entry) => {
    registry.current.set(id, entry);
    return () => {
      if (registry.current.get(id) === entry) registry.current.delete(id);
    };
  }, []);

  const measureAll = useCallback(async (): Promise<Map<string, Spot>> => {
    const outer = outerRef.current;
    const out = new Map<string, Spot>();
    if (!outer) return out;
    await Promise.all(
      [...registry.current.entries()].map(
        ([id, entry]) =>
          new Promise<void>((resolve) => {
            const node = entry.ref.current;
            if (!node) return resolve();
            node.measureLayout(
              outer,
              (x, y, w, h) => {
                if (w > 0 && h > 0) out.set(id, { x, y, w, h, name: entry.name });
                resolve();
              },
              () => resolve(),
            );
          }),
      ),
    );
    return out;
  }, []);

  useEffect(() => {
    // Anything left over from an interrupted run: put the board back in a clean, visible state.
    setItems(null);
    setFlying(false);
    const current = shownRef.current;
    if (current) content.setValue(1);

    // The selection changed and its data is not here yet.
    if (!incoming || incoming.key !== currentKey) {
      if (!current) return;
      const timer = setTimeout(() => {
        Animated.timing(content, { toValue: DIM, duration: 160, useNativeDriver: true }).start();
      }, SLOW_FETCH_MS);
      return () => {
        clearTimeout(timer);
        content.stopAnimation();
      };
    }

    // Very first board: just fade it in.
    if (!current) {
      setShown(incoming);
      content.setValue(0);
      Animated.timing(content, { toValue: 1, duration: FADE_IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }

    // Same board, same order, fresher numbers: update in place.
    if (current.key === incoming.key && current.sig === incoming.sig) {
      setShown(incoming);
      return;
    }

    const token = { cancelled: false };
    const play = (anim: Animated.CompositeAnimation) =>
      new Promise<boolean>((resolve) => {
        activeAnim.current = anim;
        anim.start(({ finished }) => resolve(finished));
      });

    void (async () => {
      const from = await measureAll();
      if (token.cancelled) return;

      // Copies of the faces go on top of the real ones, exactly in place, then the real ones step aside.
      setItems([...from.entries()].map(([id, r]) => makeItem(id, r.name, r, r, 1)));
      await frames(2);
      if (token.cancelled) return;
      setFlying(true);

      const faded = await play(
        Animated.timing(content, { toValue: 0, duration: OUT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      );
      if (!faded || token.cancelled) return;

      setShown(incoming);
      await frames(3);
      if (token.cancelled) return;
      const to = await measureAll();
      if (token.cancelled) return;

      const flights: FlightItem[] = [...to.entries()]
        .filter(([id]) => from.has(id))
        .map(([id, t]) => makeItem(id, t.name, from.get(id)!, t, 0))
        .sort((a, b) => a.to.y - b.to.y || a.to.x - b.to.x);
      setItems(flights);
      await frame();
      if (token.cancelled) return;

      const landed = await play(
        Animated.parallel([
          Animated.stagger(
            STAGGER_MS,
            flights.map((f) => Animated.timing(f.p, { toValue: 1, duration: FLY_MS, easing: FLY_EASING, useNativeDriver: true })),
          ),
          Animated.timing(content, {
            toValue: 1,
            delay: FADE_IN_DELAY_MS,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      if (!landed || token.cancelled) return;

      // The real faces are already in their final spots: show them, then drop the copies a beat later.
      setFlying(false);
      await frames(2);
      if (token.cancelled) return;
      setItems(null);
    })();

    return () => {
      token.cancelled = true;
      activeAnim.current?.stop();
      activeAnim.current = null;
      content.stopAnimation();
    };
  }, [incoming, currentKey, content, measureAll]);

  const api = useMemo<FlightApi>(() => ({ flying, register }), [flying, register]);

  const overlay: ReactNode = items ? (
    <View pointerEvents="none" style={styles.overlay}>
      {items.map((f) => (
        <Animated.View
          key={f.id}
          style={{
            position: 'absolute',
            left: f.to.x,
            top: f.to.y,
            width: f.to.w,
            height: f.to.h,
            transform: [{ translateX: f.tx }, { translateY: f.ty }, { scale: f.scale }],
          }}
        >
          <Avatar name={f.name} userId={f.id} size={f.to.w} />
        </Animated.View>
      ))}
    </View>
  ) : null;

  return {
    shown,
    outerRef,
    contentStyle: { opacity: content },
    overlay,
    flightApi: api,
  };
}

const styles = StyleSheet.create({
  // `elevation` keeps the copies above elevated siblings (the gold podium glow) on Android.
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50 },
});
