import type { LocalSlopePoint, TafelPick } from '@/lib/tafel';

type Props = {
  slopes: LocalSlopePoint[];
  picks: TafelPick[];
};

function paddedDomain(values: number[], paddingFraction = 0.08): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-9);
  return [min - span * paddingFraction, max + span * paddingFraction];
}

function nice(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export function LocalSlopeChart({ slopes, picks }: Props) {
  const width = 900;
  const height = 360;
  const margin = { left: 72, right: 24, top: 22, bottom: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const finite = slopes.filter((point) => point.slopeMvDec !== null && Number.isFinite(point.slopeMvDec));

  if (finite.length === 0) {
    return <div className="notice">Local slope could not be computed for this dataset.</div>;
  }

  const [xMin, xMax] = paddedDomain(slopes.map((p) => p.potential));
  const rawY = finite.map((p) => p.slopeMvDec as number).filter((v) => Math.abs(v) < 5000);
  const sorted = [...rawY].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.03)] ?? Math.min(...rawY);
  const hi = sorted[Math.floor(sorted.length * 0.97)] ?? Math.max(...rawY);
  const [yMin, yMax] = paddedDomain([lo, hi], 0.12);

  const xScale = (x: number) => margin.left + ((x - xMin) / (xMax - xMin)) * innerWidth;
  const yScale = (y: number) => margin.top + innerHeight - ((y - yMin) / (yMax - yMin)) * innerHeight;
  const xTicks = Array.from({ length: 6 }, (_, i) => xMin + (i / 5) * (xMax - xMin));
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (i / 4) * (yMax - yMin));
  const path = finite
    .filter((point) => {
      const value = point.slopeMvDec as number;
      return value >= yMin && value <= yMax;
    })
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xScale(point.potential)} ${yScale(point.slopeMvDec as number)}`)
    .join(' ');

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Local Tafel slope chart">
      <rect x={0} y={0} width={width} height={height} fill="white" />
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={xScale(tick)} y1={margin.top} x2={xScale(tick)} y2={margin.top + innerHeight} stroke="#e5e7eb" />
          <text x={xScale(tick)} y={height - 24} textAnchor="middle" fontSize={12} fill="#64748b">{nice(tick)}</text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={margin.left} y1={yScale(tick)} x2={margin.left + innerWidth} y2={yScale(tick)} stroke="#e5e7eb" />
          <text x={margin.left - 12} y={yScale(tick) + 4} textAnchor="end" fontSize={12} fill="#64748b">{nice(tick)}</text>
        </g>
      ))}

      {picks.slice().reverse().map((pick, index) => (
        <rect
          key={pick.rank}
          x={xScale(pick.potentialMin)}
          y={margin.top}
          width={Math.max(2, xScale(pick.potentialMax) - xScale(pick.potentialMin))}
          height={innerHeight}
          fill="#2563eb"
          opacity={0.05 + index * 0.04}
        />
      ))}

      <path d={path} fill="none" stroke="#2563eb" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {finite.map((point) => {
        const slope = point.slopeMvDec as number;
        if (slope < yMin || slope > yMax) return null;
        return <circle key={point.potential} cx={xScale(point.potential)} cy={yScale(slope)} r={2.4} fill="#2563eb" />;
      })}

      <line x1={margin.left} y1={margin.top + innerHeight} x2={margin.left + innerWidth} y2={margin.top + innerHeight} stroke="#334155" />
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerHeight} stroke="#334155" />
      <text x={margin.left + innerWidth / 2} y={height - 6} textAnchor="middle" fontSize={14} fill="#142033">potential or overpotential / V</text>
      <text x={18} y={margin.top + innerHeight / 2} textAnchor="middle" fontSize={14} fill="#142033" transform={`rotate(-90 18 ${margin.top + innerHeight / 2})`}>local Tafel slope / mV dec^-1</text>
    </svg>
  );
}
