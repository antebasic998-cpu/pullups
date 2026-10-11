import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { formatDateShort, formatKg } from '../lib/format';
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

/**
 * Dependency-light SVG line chart: smooth curve, gradient area, faint grid, the
 * personal best marked and any point tappable for a read-out underneath.
 */
export function ScoreChart({
  points,
  unit,
  decimals = 2,
  height = 210,
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
  const [picked, setPicked] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [points],
  );

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pad = { top: 14, right: 12, bottom: 28, left: 34 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const geometry = useMemo(() => {
    if (sorted.length === 0 || innerW <= 0) return null;
    const values = sorted.map((p) => p.value);
    const { ticks, min, max } = niceTicks(Math.min(...values), Math.max(...values), 4);
    const t0 = ts(sorted[0].date);
    const t1 = ts(sorted[sorted.length - 1].date);
    const span = t1 - t0 || 1;
    const x = (p: ChartPoint) => (t1 === t0 ? innerW / 2 : ((ts(p.date) - t0) / span) * innerW);
    const y = (v: number) => innerH - ((v - min) / (max - min || 1)) * innerH;
    const coords = sorted.map((p) => ({ p, cx: x(p), cy: y(p.value) }));

    let line = `M${coords[0].cx.toFixed(2)},${coords[0].cy.toFixed(2)}`;
    for (let i = 1; i < coords.length; i += 1) {
      const prev = coords[i - 1];
      const cur = coords[i];
      const dx = (cur.cx - prev.cx) / 2.6;
      line += ` C${(prev.cx + dx).toFixed(2)},${prev.cy.toFixed(2)} ${(cur.cx - dx).toFixed(2)},${cur.cy.toFixed(2)} ${cur.cx.toFixed(2)},${cur.cy.toFixed(2)}`;
    }
    const area = `${line} L${coords[coords.length - 1].cx.toFixed(2)},${innerH} L${coords[0].cx.toFixed(2)},${innerH} Z`;
    const bestIndex = values.reduce((bi, v, i) => (v > values[bi] ? i : bi), 0);
    const labelCount = Math.min(3, coords.length);
    const labelIdx = new Set<number>(
      Array.from({ length: labelCount }, (_, i) =>
        labelCount === 1 ? 0 : Math.round((i * (coords.length - 1)) / (labelCount - 1)),
      ),
    );
    return { coords, line, area, ticks, y, bestIndex, labelIdx };
  }, [sorted, innerW, innerH]);

  if (sorted.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={{ color: colors.muted }}>{emptyMessage}</Text>
      </View>
    );
  }

  if (sorted.length === 1) {
    const only = sorted[0];
    return (
      <View style={[styles.empty, { height, gap: 4 }]}>
        <Text style={{ color: lineColor, fontSize: 30, fontWeight: '800' }}>{only.value.toFixed(decimals)}</Text>
        <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>
          {only.reps} reps on {formatDateShort(only.date)} — log one more result to see the trend line.
        </Text>
      </View>
    );
  }

  const activeIdx = geometry ? (picked ? Math.max(0, geometry.coords.findIndex((c) => c.p.id === picked)) : geometry.bestIndex) : 0;
  const active = geometry?.coords[activeIdx];

  return (
    <View onLayout={onLayout}>
      {width > 0 && geometry ? (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="arenaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={lineColor} stopOpacity={0.32} />
                <Stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            <G x={pad.left} y={pad.top}>
              {geometry.ticks.map((tick) => {
                const gy = geometry.y(tick);
                return (
                  <G key={tick}>
                    <Line x1={0} x2={innerW} y1={gy} y2={gy} stroke={colors.gridLine} strokeWidth={1} />
                    <SvgText x={-8} y={gy + 4} fill={colors.faint} fontSize={10.5} textAnchor="end">
                      {Number.isInteger(tick) ? String(tick) : tick.toFixed(1)}
                    </SvgText>
                  </G>
                );
              })}
              <Path d={geometry.area} fill="url(#arenaGrad)" />
              <Path d={geometry.line} fill="none" stroke={lineColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              {geometry.coords.map((c, i) =>
                geometry.labelIdx.has(i) ? (
                  <SvgText
                    key={`x-${c.p.id}`}
                    x={c.cx}
                    y={innerH + 20}
                    fill={colors.faint}
                    fontSize={10.5}
                    textAnchor={i === 0 ? 'start' : i === geometry.coords.length - 1 ? 'end' : 'middle'}
                  >
                    {formatDateShort(c.p.date)}
                  </SvgText>
                ) : null,
              )}
              {geometry.coords.map((c, i) => {
                const isActive = i === activeIdx;
                return (
                  <G key={c.p.id}>
                    <Circle
                      cx={c.cx}
                      cy={c.cy}
                      r={isActive ? 5.4 : 3.2}
                      fill={isActive ? lineColor : colors.surface}
                      stroke={lineColor}
                      strokeWidth={isActive ? 2 : 1.6}
                    />
                    {/* generous invisible touch target */}
                    <Circle cx={c.cx} cy={c.cy} r={16} fill="transparent" onPress={() => setPicked(c.p.id)} />
                  </G>
                );
              })}
            </G>
          </Svg>
          {active ? (
            <View style={styles.caption}>
              <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: '700' }}>
                {formatDateShort(active.p.date)} ·{' '}
                <Text style={{ color: lineColor }}>
                  {active.p.value.toFixed(decimals)} {unit}
                </Text>
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {active.p.reps} reps @ {formatKg(active.p.weightKg)}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ height }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  caption: { alignItems: 'center', marginTop: 2, gap: 1 },
});
