import { useId, useMemo, useRef, useState } from 'react';
import { useElementWidth } from '../lib/hooks';
import { formatDate, formatDateShort, formatKg } from '../lib/format';

export interface ChartPoint {
  id: string;
  date: string;
  value: number;
  reps: number;
  weightKg: number;
}

interface ScoreChartProps {
  points: ChartPoint[];
  unit: string;
  decimals?: number;
  height?: number;
  color?: string;
  emptyMessage?: string;
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
 * Dependency-free SVG line chart: smooth curve, gradient area, PB marker and a
 * hover read-out. Renders at real pixel size (measured) so text never distorts.
 */
export function ScoreChart({
  points,
  unit,
  decimals = 2,
  height = 290,
  color = 'var(--accent)',
  emptyMessage = 'No attempts logged yet.',
}: ScoreChartProps) {
  const gradientId = useId();
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const sorted = useMemo(() => [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)), [points]);

  const pad = { top: 18, right: 18, bottom: 30, left: 46 };
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
    const labelCount = Math.min(5, coords.length);
    const labelIdx = new Set<number>(
      Array.from({ length: labelCount }, (_, i) =>
        labelCount === 1 ? 0 : Math.round((i * (coords.length - 1)) / (labelCount - 1)),
      ),
    );

    return { coords, line, area, ticks, min, max, y, bestIndex, labelIdx };
  }, [sorted, innerW, innerH]);

  if (sorted.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border text-sm"
        style={{ height, borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        {emptyMessage}
      </div>
    );
  }

  if (sorted.length === 1) {
    const only = sorted[0];
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-xl border text-sm"
        style={{ height, borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        <span className="num text-3xl font-bold" style={{ color }}>
          {only.value.toFixed(decimals)}
        </span>
        <span>
          {only.reps} pull-ups on {formatDate(only.date)} — log one more attempt to see the trend line.
        </span>
      </div>
    );
  }

  const hovered = hover !== null && geometry ? geometry.coords[hover] : null;
  const tooltipLeft = hovered ? Math.min(Math.max(hovered.cx + pad.left, 78), Math.max(90, width - 78)) : 0;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && geometry ? (
        <svg
          ref={svgRef}
          width={width}
          height={height}
          role="img"
          aria-label={`Progress chart, ${unit}, ${sorted.length} attempts, best ${geometry.coords[geometry.bestIndex].p.value.toFixed(decimals)}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            const px = event.clientX - rect.left - pad.left;
            let nearest = 0;
            let bestDist = Infinity;
            geometry.coords.forEach((c, i) => {
              const d = Math.abs(c.cx - px);
              if (d < bestDist) {
                bestDist = d;
                nearest = i;
              }
            });
            setHover(nearest);
          }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <g transform={`translate(${pad.left},${pad.top})`}>
            {/* horizontal grid + y labels */}
            {geometry.ticks.map((tick) => {
              const gy = geometry.y(tick);
              return (
                <g key={tick}>
                  <line x1={0} x2={innerW} y1={gy} y2={gy} stroke="var(--grid-line)" strokeWidth="1" />
                  <text
                    x={-10}
                    y={gy}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fontSize="11"
                    fill="var(--faint)"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                  </text>
                </g>
              );
            })}

            <path d={geometry.area} fill={`url(#${gradientId})`} />
            <path
              d={geometry.line}
              fill="none"
              stroke={color}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* x labels */}
            {geometry.coords.map((c, i) =>
              geometry.labelIdx.has(i) ? (
                <text
                  key={`x-${c.p.id}`}
                  x={c.cx}
                  y={innerH + 20}
                  textAnchor={i === 0 ? 'start' : i === geometry.coords.length - 1 ? 'end' : 'middle'}
                  fontSize="11"
                  fill="var(--faint)"
                >
                  {formatDateShort(c.p.date)}
                </text>
              ) : null,
            )}

            {/* hover guide */}
            {hovered ? (
              <line
                x1={hovered.cx}
                x2={hovered.cx}
                y1={0}
                y2={innerH}
                stroke="var(--border-strong)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ) : null}

            {/* data points */}
            {geometry.coords.map((c, i) => {
              const isBest = i === geometry.bestIndex;
              const active = i === hover;
              const show = geometry.coords.length <= 70 || isBest || active || i % 2 === 0;
              if (!show) return null;
              return (
                <circle
                  key={c.p.id}
                  cx={c.cx}
                  cy={c.cy}
                  r={isBest ? 5.2 : active ? 4.6 : 3.1}
                  fill={isBest || active ? color : 'var(--surface)'}
                  stroke={color}
                  strokeWidth={isBest ? 2 : 1.6}
                />
              );
            })}
          </g>
        </svg>
      ) : null}

      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{
            left: tooltipLeft,
            top: Math.max(4, hovered.cy + pad.top - 84),
            background: 'var(--surface)',
            borderColor: 'var(--border-strong)',
          }}
        >
          <div className="font-semibold">{formatDate(hovered.p.date)}</div>
          <div className="num mt-0.5 text-sm font-bold" style={{ color }}>
            {hovered.p.value.toFixed(decimals)} <span className="font-medium opacity-70">{unit}</span>
          </div>
          <div className="num mt-0.5" style={{ color: 'var(--muted)' }}>
            {hovered.p.reps} reps @ {formatKg(hovered.p.weightKg)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
