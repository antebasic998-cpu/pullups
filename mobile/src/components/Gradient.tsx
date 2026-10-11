import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Absolute-fill linear gradient. Put it first inside a View that has `overflow: 'hidden'` and a radius. */
export function GradientFill({
  from,
  to,
  fromOpacity = 1,
  toOpacity = 1,
  /** 'v' = top → bottom, 'd' = 160° diagonal (top-left → bottom-right) */
  direction = 'v',
}: {
  /** Solid colours ("#rrggbb"). Transparency goes through the opacity props – SVG stops ignore rgba() alpha. */
  from: string;
  to: string;
  fromOpacity?: number;
  toOpacity?: number;
  direction?: 'v' | 'd';
}) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const d = direction === 'v' ? { x1: '0', y1: '0', x2: '0', y2: '1' } : { x1: '0', y1: '0', x2: '0.35', y2: '1' };
  // Explicit pixel size from onLayout: a "100%" Svg keeps a stale viewport when its parent grows after mount.
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} {...d}>
              <Stop offset="0" stopColor={from} stopOpacity={fromOpacity} />
              <Stop offset="1" stopColor={to} stopOpacity={toOpacity} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}

/** Soft elliptical glow anchored top-left – the lime wash behind the profile hero. */
export function CornerGlow({ color, opacity = 0.12 }: { color: string; opacity?: number }) {
  const id = `r${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <RadialGradient id={id} cx="0" cy="0" rx="1.2" ry="0.9" fx="0" fy="0">
              <Stop offset="0" stopColor={color} stopOpacity={opacity} />
              <Stop offset="0.55" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}
