import type { DataPoint, TafelPick } from '@/lib/tafel';

type Props = {
  points: DataPoint[];
  picks: TafelPick[];
};

function nice(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function paddedDomain(values: number[], paddingFraction = 0.08): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-9);
  return [min - span * paddingFraction, max + span * paddingFraction];
}

const regionFillByLabel: Record<string, string> = {
  core: '#5f8fbe',
  expanded: '#8fb0cf',
  more_expanded: '#c8d9ea'
};

const lineColorByLabel: Record<string, string> = {
  core: '#ec7d23',
  expanded: '#f08f3d',
  more_expanded: '#f3a358'
};

function displayRegionLabel(label: string): string {
  if (label === 'core') return 'tafel region';
  if (label === 'expanded') return 'extended region';
  if (label === 'more_expanded') return 'farthur extended region';
  return label;
}

export function TafelChart({ points, picks }: Props) {
  const width = 900;
  const height = 520;
  const margin = { left: 72, right: 24, top: 28, bottom: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const [xMin, xMax] = paddedDomain(points.map((p) => p.potential));
  const [yMin, yMax] = paddedDomain(points.map((p) => p.logi));

  const xScale = (x: number) => margin.left + ((x - xMin) / (xMax - xMin)) * innerWidth;
  const yScale = (y: number) => margin.top + innerHeight - ((y - yMin) / (yMax - yMin)) * innerHeight;

  const xTicks = Array.from({ length: 6 }, (_, i) => xMin + (i / 5) * (xMax - xMin));
  const yTicks = Array.from({ length: 6 }, (_, i) => yMin + (i / 5) * (yMax - yMin));

  const legendWidth = 320;
  const legendHeight = Math.max(34, picks.length * 24 + 14);
  const legendX = margin.left + innerWidth - legendWidth - 12;
  const legendY = margin.top + innerHeight - legendHeight - 12;

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Tafel candidate chart">
      <rect x={0} y={0} width={width} height={height} fill="white" />
      {xTicks.map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={xScale(tick)} y1={margin.top} x2={xScale(tick)} y2={margin.top + innerHeight} stroke="#e5e7eb" />
          <text x={xScale(tick)} y={height - 28} textAnchor="middle" fontSize={12} fill="#64748b">{nice(tick)}</text>
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
          key={`span-${pick.rank}`}
          x={xScale(pick.potentialMin)}
          y={margin.top}
          width={Math.max(2, xScale(pick.potentialMax) - xScale(pick.potentialMin))}
          height={innerHeight}
          fill={regionFillByLabel[pick.label] ?? '#94a3b8'}
          opacity={pick.label === 'core' ? 0.78 : pick.label === 'expanded' ? 0.52 : 0.34}
        />
      ))}

      {points.map((point) => (
        <circle key={point.index} cx={xScale(point.potential)} cy={yScale(point.logi)} r={3.2} fill="#2563eb" opacity={0.88} />
      ))}

      {picks.map((pick) => {
        const x1 = pick.potentialMin;
        const x2 = pick.potentialMax;
        const y1 = pick.slopeDecPerV * x1 + pick.intercept;
        const y2 = pick.slopeDecPerV * x2 + pick.intercept;
        return (
          <line
            key={`fit-${pick.rank}`}
            x1={xScale(x1)}
            y1={yScale(y1)}
            x2={xScale(x2)}
            y2={yScale(y2)}
            stroke={lineColorByLabel[pick.label] ?? '#ec7d23'}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
      })}

      <line x1={margin.left} y1={margin.top + innerHeight} x2={margin.left + innerWidth} y2={margin.top + innerHeight} stroke="#334155" />
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerHeight} stroke="#334155" />
      <text x={margin.left + innerWidth / 2} y={height - 8} textAnchor="middle" fontSize={14} fill="#142033">potential or overpotential / V</text>
      <text x={18} y={margin.top + innerHeight / 2} textAnchor="middle" fontSize={14} fill="#142033" transform={`rotate(-90 18 ${margin.top + innerHeight / 2})`}>log10(|i|) or log10(|j|)</text>

      <g transform={`translate(${legendX}, ${legendY})`}>
        <rect width={legendWidth} height={legendHeight} rx={12} fill="white" opacity={0.92} stroke="#dbe3ef" />
        {picks.map((pick, index) => (
          <g key={`legend-${pick.rank}`} transform={`translate(12, ${22 + index * 24})`}>
            <line x1={0} y1={-4} x2={24} y2={-4} stroke={lineColorByLabel[pick.label] ?? '#ec7d23'} strokeWidth={4} strokeLinecap="round" />
            <text x={34} y={0} fontSize={13} fill="#142033">
              {displayRegionLabel(pick.label)}: {pick.tafelSlopeMvDec.toFixed(1)}
              {pick.ciLow !== undefined && pick.ciHigh !== undefined ? ` [${pick.ciLow.toFixed(1)}, ${pick.ciHigh.toFixed(1)}]` : ''} mV/dec, {pick.confidence}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
