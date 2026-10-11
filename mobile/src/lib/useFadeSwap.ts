import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

const OUT_MS = 130;
const IN_MS = 240;
/** How far the new content drifts up while fading in. */
const LIFT = 10;
/** Opacity of the old content while the next one is still loading. */
const DIM = 0.35;

/**
 * Keeps the previous result on screen while the next one loads, then fades the old one out and the new one
 * in. `incoming` is the latest fetched result, tagged with `key`; it only counts as ready once its key matches
 * `currentKey` (the selection the user is asking for). A refresh of the board that is already showing swaps in
 * place without any animation.
 *
 * Because the content shown is always one consistent result (rows and the mode they were computed for), the
 * board never shows one selection's rows with another selection's numbers.
 */
export function useFadeSwap<T extends { key: string }>(incoming: T | null, currentKey: string) {
  const [shown, setShown] = useState<T | null>(null);
  const shownRef = useRef<T | null>(null);
  shownRef.current = shown;
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const current = shownRef.current;
    const reveal = () => {
      lift.setValue(LIFT);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: IN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: IN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    };

    // Next result not here yet: dim what is on screen so it reads as "working", not as the answer.
    if (!incoming || incoming.key !== currentKey) {
      if (current) {
        Animated.timing(opacity, { toValue: DIM, duration: OUT_MS, useNativeDriver: true }).start();
      }
      return () => opacity.stopAnimation();
    }

    // Very first result: nothing to fade out.
    if (!current) {
      setShown(incoming);
      opacity.setValue(0);
      reveal();
      return;
    }

    // Same board, fresher data (e.g. after logging a result): update in place.
    if (current.key === incoming.key) {
      setShown(incoming);
      Animated.timing(opacity, { toValue: 1, duration: OUT_MS, useNativeDriver: true }).start();
      return () => opacity.stopAnimation();
    }

    // A different board: fade the old one out first, swap while it is invisible, then fade the new one in.
    let cancelled = false;
    Animated.timing(opacity, { toValue: 0, duration: OUT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(
      ({ finished }) => {
        if (!finished || cancelled) return;
        setShown(incoming);
        reveal();
      },
    );
    return () => {
      cancelled = true;
      opacity.stopAnimation();
    };
  }, [incoming, currentKey, opacity, lift]);

  return { shown, style: { opacity, transform: [{ translateY: lift }] } };
}
