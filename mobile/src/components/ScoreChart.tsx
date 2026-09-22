import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { formatDateShort } from '../lib/format';
import { useTheme } from '../lib/ThemeContext';

export interface ChartPoint {
  id: string;
  date: string;
  value: number;
  reps: number;
  weightKg: number;
}

function niceTicks(min: number, max: number, count = 4) {
  let lo = min;
  let hi = max;
  if (lo === hi) {
    lo = Math.max(0, lo - 1);
    hi += 1;
  }
  const step0 = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(step0 || 1));
  const norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { ticks, min: start, max: end };
}

const ts = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

export function ScoreChart({
  points,
  unit,
  decimals = 2,
  height = 220,
  color,
  emptyMessage = 'No attempts logged yet.',
}: {
  points: ChartPoint[];
  unit: string;
  decimals?: number;
  height?: number;
  color?: string;
  emptyMessage?: string;
}) {
  const { colors } = useTheme();
  const lineColor = color ?? colors.accent;
  const [width, setWidth] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const sorted = useMemo(
    () => [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [points],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (sorted.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: colors.muted }}>{emptyMessage}</Text>
      </View>
    );
  }

  const pad = { top: 16, right: 12, bottom: 28, left: 40 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const values = sorted.map((p) => p.value);
  const { ticks, min, max } = niceTicks(Math.min(...values), Math.max(...values), 4);
  const t0 = ts(sorted[0].date);
  const t1 = ts(sorted[sorted.length - 1].date);
  const span = t1 - t0 || 1;

  const x = (p: ChartPoint) => (t1 === t0 ? innerW / 2 : ((ts(p.date) - t0) / span) * innerW);
  const y = (v: number) => innerH - ((v - min) / (max - min || 1)) * innerH;

  const coords = sorted.map((p) => ({ p, cx: x(p), cy: y(p.value) }));
  let line = `M${coords[0].cx.toFixed(1)},${coords[0].cy.toFixed(1)}`;
  for (let i = 1; i < coords.length; i += 1) {
    line += ` L${coords[i].cx.toFixed(1)},${coords[i].cy.toFixed(1)}`;
  }
  const area = `${line} L${coords[coords.length - 1].cx.toFixed(1)},${innerH} L${coords[0].cx.toFixed(1)},${innerH} Z`;
  const pbIdx = coords.reduce((best, c, i) => (c.p.value > coords[best].p.value ? i : best), 0);
  const active = hoverIdx ?? pbIdx;

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
                <Stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {ticks.map((tick) => {
              const ty = pad.top + y(tick);
              return (
                <SvgText key={tick} x={4} y={ty + 4} fill={colors.faint} fontSize={10}>
                  {tick.toFixed(decimals > 0 && tick < 10 ? decimals : 0)}
                </SvgText>
              );
            })}
            <Path d={area} fill="url(#grad)" transform={`translate(${pad.left}, ${pad.top})`} />
            <Path d={line} stroke={lineColor} strokeWidth={2} fill="none" transform={`translate(${pad.left}, ${pad.top})`} />
            {coords.map((c, i) => (
              <Circle
                key={c.p.id}
                cx={pad.left + c.cx}
                cy={pad.top + c.cy}
                r={i === active ? 5 : 3}
                fill={i === active ? lineColor : colors.surface}
                stroke={lineColor}
                strokeWidth={2}
                onPress={() => setHoverIdx(i)}
              />
            ))}
          </Svg>
          <View style={styles.caption}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {formatDateShort(sorted[active].date)} · {sorted[active].value.toFixed(decimals)} {unit}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  caption: { alignItems: 'center', marginTop: 4 },
});
