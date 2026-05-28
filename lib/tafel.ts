export type DataPoint = {
  index: number;
  potential: number;
  logi: number;
};

export type InputMode = 'eta-logi' | 'potential-current';

export type NormalizedInput = {
  mode: InputMode;
  potentialColumn: string;
  logiColumn?: string;
  currentColumn?: string;
  points: DataPoint[];
};

export type DetectionPreset = 'exploratory' | 'balanced' | 'strict';

export type DetectionConfig = {
  minPoints: number;
  maxPoints: number;
  minPotentialSpan: number;
  minLogiSpan: number;
  bootstrapSamples: number;
  seed: number;
  preset: DetectionPreset;
};

export type TafelPick = {
  rank: number;
  label: 'core' | 'expanded' | 'more_expanded';
  startIndex: number;
  endIndex: number;
  nPoints: number;
  potentialMin: number;
  potentialMax: number;
  logiMin: number;
  logiMax: number;
  slopeDecPerV: number;
  intercept: number;
  tafelSlopeMvDec: number;
  r2: number;
  rmse: number;
  plateauScore: number;
  curvatureAbs: number;
  artifactPenalty: number;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  ciLow?: number;
  ciHigh?: number;
  bootstrapStd?: number;
};

export type LocalSlopePoint = {
  potential: number;
  slopeMvDec: number | null;
};

export type DetectionResult = {
  points: DataPoint[];
  picks: TafelPick[];
  localSlopes: LocalSlopePoint[];
  warnings: string[];
};

const POTENTIAL_ALIASES = ['eta', 'eta_v', 'overpotential', 'overpotential_v', 'potential', 'potential_v', 'e', 'e_v', 'voltage', 'voltage_v'];
const LOGI_ALIASES = ['logi', 'log_i', 'log10i', 'log10_i', 'logj', 'log_j', 'log10j', 'log10_j'];
const CURRENT_ALIASES = ['current', 'current_a', 'i', 'i_a', 'j', 'j_a_cm2', 'current_density', 'current_density_a_cm2'];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s()|/\\-]+/g, '_');
}

function findColumn(headers: string[], aliases: string[]): string | undefined {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  for (const alias of aliases) {
    const found = normalized.get(alias);
    if (found) return found;
  }
  return undefined;
}

function asNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeRows(headers: string[], rows: Record<string, string>[]): NormalizedInput {
  const potentialColumn = findColumn(headers, POTENTIAL_ALIASES);
  if (!potentialColumn) {
    throw new Error('Could not find a potential/eta column. Try columns like eta, potential_V, or E_V.');
  }

  const logiColumn = findColumn(headers, LOGI_ALIASES);
  const currentColumn = findColumn(headers, CURRENT_ALIASES);

  if (!logiColumn && !currentColumn) {
    throw new Error('Could not find logi/logj or current/current-density column.');
  }

  const points: DataPoint[] = [];
  rows.forEach((row, index) => {
    const potential = asNumber(row[potentialColumn]);
    if (potential === null) return;

    if (logiColumn) {
      const logi = asNumber(row[logiColumn]);
      if (logi !== null && Number.isFinite(logi)) {
        points.push({ index, potential, logi });
      }
      return;
    }

    const current = currentColumn ? asNumber(row[currentColumn]) : null;
    if (current !== null && current !== 0) {
      points.push({ index, potential, logi: Math.log10(Math.abs(current)) });
    }
  });

  points.sort((a, b) => a.potential - b.potential);

  if (points.length < 8) {
    throw new Error(`Too few valid data points after cleaning: ${points.length}.`);
  }

  return {
    mode: logiColumn ? 'eta-logi' : 'potential-current',
    potentialColumn,
    logiColumn,
    currentColumn,
    points
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function clamp(value: number, minValue = 0, maxValue = 1): number {
  return Math.max(minValue, Math.min(maxValue, value));
}

function linearFit(points: DataPoint[]): { slope: number; intercept: number; r2: number; rmse: number } {
  const xs = points.map((p) => p.potential);
  const ys = points.map((p) => p.logi);
  const xMean = mean(xs);
  const yMean = mean(ys);
  let sxx = 0;
  let sxy = 0;

  for (let i = 0; i < points.length; i += 1) {
    sxx += (xs[i] - xMean) ** 2;
    sxy += (xs[i] - xMean) * (ys[i] - yMean);
  }

  if (sxx <= 1e-18) {
    return { slope: NaN, intercept: NaN, r2: NaN, rmse: NaN };
  }

  const slope = sxy / sxx;
  const intercept = yMean - slope * xMean;
  const predictions = xs.map((x) => slope * x + intercept);
  const ssRes = predictions.reduce((sum, yhat, i) => sum + (ys[i] - yhat) ** 2, 0);
  const ssTot = ys.reduce((sum, y) => sum + (y - yMean) ** 2, 0);
  const r2 = ssTot <= 1e-18 ? NaN : 1 - ssRes / ssTot;
  const rmse = Math.sqrt(ssRes / points.length);
  return { slope, intercept, r2, rmse };
}

function quadraticCurvature(points: DataPoint[]): number {
  if (points.length < 5) return 1;
  const xs = points.map((p) => p.potential);
  const ys = points.map((p) => p.logi);
  const x0 = mean(xs);
  const x = xs.map((v) => v - x0);

  let s0 = points.length;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let t0 = 0;
  let t1 = 0;
  let t2 = 0;

  for (let i = 0; i < x.length; i += 1) {
    const x1 = x[i];
    const x2 = x1 * x1;
    s1 += x1;
    s2 += x2;
    s3 += x2 * x1;
    s4 += x2 * x2;
    t0 += ys[i];
    t1 += ys[i] * x1;
    t2 += ys[i] * x2;
  }

  const det = s0 * (s2 * s4 - s3 * s3) - s1 * (s1 * s4 - s2 * s3) + s2 * (s1 * s3 - s2 * s2);
  if (Math.abs(det) < 1e-18) return 1;

  const detA = s0 * (s2 * t2 - s3 * t1) - s1 * (s1 * t2 - s3 * t0) + s2 * (s1 * t1 - s2 * t0);
  return Math.abs(detA / det);
}

function localSlopeForWindow(points: DataPoint[], centerIndex: number, radius: number): number | null {
  const start = Math.max(0, centerIndex - radius);
  const end = Math.min(points.length, centerIndex + radius + 1);
  const window = points.slice(start, end);
  if (window.length < 5) return null;
  const fit = linearFit(window);
  if (!Number.isFinite(fit.slope) || Math.abs(fit.slope) < 1e-12) return null;
  return 1000 / fit.slope;
}

export function localTafelSlopes(points: DataPoint[], radius = 4): LocalSlopePoint[] {
  return points.map((point, index) => ({
    potential: point.potential,
    slopeMvDec: localSlopeForWindow(points, index, radius)
  }));
}

function plateauScore(points: DataPoint[], allPoints: DataPoint[]): number {
  const slopes = points
    .map((point) => allPoints.findIndex((candidate) => candidate.index === point.index))
    .map((index) => (index >= 0 ? localSlopeForWindow(allPoints, index, 4) : null))
    .filter((value): value is number => value !== null && Number.isFinite(value) && Math.abs(value) < 5000);

  if (slopes.length < 5) return 0;
  const med = median(slopes);
  if (!Number.isFinite(med) || Math.abs(med) < 1e-12) return 0;
  const mad = median(slopes.map((s) => Math.abs(s - med)));
  const drift = Math.abs(mean(slopes.slice(-3)) - mean(slopes.slice(0, 3)));
  const madFraction = mad / Math.abs(med);
  const driftFraction = drift / Math.abs(med);
  return clamp(1 - 0.75 * madFraction / 0.35 - 0.25 * driftFraction / 0.65);
}

function monotonicFraction(points: DataPoint[], slopeSign: number): number {
  if (points.length < 2) return 0;
  let good = 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const diff = points[i].logi - points[i - 1].logi;
    if (Math.abs(diff) < 1e-12) continue;
    total += 1;
    if (Math.sign(diff) === slopeSign) good += 1;
  }
  return total === 0 ? 0 : good / total;
}

function confidence(r2: number, plateau: number, artifact: number): 'high' | 'medium' | 'low' {
  if (r2 >= 0.995 && plateau >= 0.7 && artifact <= 0.25) return 'high';
  if (r2 >= 0.985 && plateau >= 0.4 && artifact <= 0.55) return 'medium';
  return 'low';
}

function evaluatePick(points: DataPoint[], allPoints: DataPoint[], start: number, end: number, rank: number, label: TafelPick['label']): TafelPick | null {
  const segment = points.slice(start, end + 1);
  if (segment.length < 3) return null;
  const fit = linearFit(segment);
  if (!Number.isFinite(fit.slope) || Math.abs(fit.slope) < 1e-12) return null;
  const tafelSlope = 1000 / fit.slope;
  const pMin = segment[0].potential;
  const pMax = segment[segment.length - 1].potential;
  const logis = segment.map((p) => p.logi);
  const curvature = quadraticCurvature(segment);
  const plateau = plateauScore(segment, allPoints);
  const logSpan = Math.max(...logis) - Math.min(...logis);
  const potentialSpan = pMax - pMin;
  const artifact = clamp(
    (1 - plateau) * 0.55 +
    clamp(curvature / 90) * 0.25 +
    clamp(fit.rmse / 0.08) * 0.2
  );
  const score = 0.42 * clamp(fit.r2) + 0.22 * clamp(logSpan / 0.7) + 0.26 * plateau + 0.10 * (1 - artifact);

  return {
    rank,
    label,
    startIndex: start,
    endIndex: end,
    nPoints: segment.length,
    potentialMin: pMin,
    potentialMax: pMax,
    logiMin: Math.min(...logis),
    logiMax: Math.max(...logis),
    slopeDecPerV: fit.slope,
    intercept: fit.intercept,
    tafelSlopeMvDec: tafelSlope,
    r2: fit.r2,
    rmse: fit.rmse,
    plateauScore: plateau,
    curvatureAbs: curvature,
    artifactPenalty: artifact,
    score,
    confidence: confidence(fit.r2, plateau, artifact)
  };
}

function rawCandidates(points: DataPoint[], config: DetectionConfig): TafelPick[] {
  const candidates: TafelPick[] = [];
  const maxPoints = Math.max(config.minPoints, Math.min(config.maxPoints, points.length));

  for (let start = 0; start <= points.length - config.minPoints; start += 1) {
    const stopMax = Math.min(points.length - 1, start + maxPoints - 1);
    for (let end = start + config.minPoints - 1; end <= stopMax; end += 1) {
      const segment = points.slice(start, end + 1);
      const potentialSpan = segment[segment.length - 1].potential - segment[0].potential;
      const logis = segment.map((p) => p.logi);
      const logSpan = Math.max(...logis) - Math.min(...logis);
      if (potentialSpan < config.minPotentialSpan || logSpan < config.minLogiSpan) continue;

      const fit = linearFit(segment);
      if (!Number.isFinite(fit.slope) || Math.abs(fit.slope) < 1e-12) continue;
      const tafelSlope = 1000 / fit.slope;
      const absSlope = Math.abs(tafelSlope);
      if (absSlope < 10 || absSlope > 1000) continue;
      if (monotonicFraction(segment, Math.sign(fit.slope)) < 0.72) continue;

      const pick = evaluatePick(points, points, start, end, 0, 'core');
      if (pick) candidates.push(pick);
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function buildConsensusPicks(points: DataPoint[], candidates: TafelPick[]): TafelPick[] {
  const top = candidates.slice(0, 3);
  if (top.length === 0) return [];

  const starts = top.map((c) => c.startIndex);
  const ends = top.map((c) => c.endIndex);
  let coreStart = Math.max(...starts);
  let coreEnd = Math.min(...ends);

  if (coreEnd - coreStart + 1 < 5) {
    coreStart = top[0].startIndex;
    coreEnd = top[0].endIndex;
  }

  const unionStart = Math.min(...starts);
  const unionEnd = Math.max(...ends);
  const halfLeft = Math.floor((coreStart - unionStart) / 2);
  const halfRight = Math.floor((unionEnd - coreEnd) / 2);

  const ranges: Array<[number, number, TafelPick['label']]> = [
    [coreStart, coreEnd, 'core'],
    [Math.max(0, coreStart - halfLeft), Math.min(points.length - 1, coreEnd + halfRight), 'expanded'],
    [unionStart, unionEnd, 'more_expanded']
  ];

  return ranges
    .map(([start, end, label], index) => evaluatePick(points, points, start, end, index + 1, label))
    .filter((pick): pick is TafelPick => pick !== null);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function withBootstrap(pick: TafelPick, points: DataPoint[], samples: number, seed: number): TafelPick {
  if (samples <= 0) return pick;
  const segment = points.slice(pick.startIndex, pick.endIndex + 1);
  const rng = mulberry32(seed + pick.rank * 101);
  const slopes: number[] = [];

  for (let sample = 0; sample < samples; sample += 1) {
    const resampled: DataPoint[] = [];
    for (let i = 0; i < segment.length; i += 1) {
      resampled.push(segment[Math.floor(rng() * segment.length)]);
    }
    const uniqueX = new Set(resampled.map((p) => p.potential.toFixed(12)));
    if (uniqueX.size < 3) continue;
    const fit = linearFit(resampled.sort((a, b) => a.potential - b.potential));
    if (Number.isFinite(fit.slope) && Math.abs(fit.slope) > 1e-12) {
      const slope = 1000 / fit.slope;
      if (Number.isFinite(slope) && Math.abs(slope) < 5000) slopes.push(slope);
    }
  }

  if (slopes.length < 20) return pick;
  const ciLow = quantile(slopes, 0.025);
  const ciHigh = quantile(slopes, 0.975);
  const m = mean(slopes);
  const variance = mean(slopes.map((s) => (s - m) ** 2));
  return { ...pick, ciLow, ciHigh, bootstrapStd: Math.sqrt(variance) };
}

export function presetConfig(preset: DetectionPreset): DetectionConfig {
  if (preset === 'strict') {
    return { minPoints: 12, maxPoints: 45, minPotentialSpan: 0.025, minLogiSpan: 0.5, bootstrapSamples: 300, seed: 42, preset };
  }
  if (preset === 'exploratory') {
    return { minPoints: 8, maxPoints: 70, minPotentialSpan: 0.015, minLogiSpan: 0.25, bootstrapSamples: 200, seed: 42, preset };
  }
  return { minPoints: 10, maxPoints: 60, minPotentialSpan: 0.02, minLogiSpan: 0.35, bootstrapSamples: 250, seed: 42, preset };
}

export function detectTafelRegions(points: DataPoint[], config: DetectionConfig): DetectionResult {
  const warnings: string[] = [];
  const candidates = rawCandidates(points, config);

  if (candidates.length === 0) {
    warnings.push('No candidate Tafel region passed the current filters. Try exploratory preset or lower min spans.');
    return { points, picks: [], localSlopes: localTafelSlopes(points), warnings };
  }

  const picks = buildConsensusPicks(points, candidates).map((pick) => withBootstrap(pick, points, config.bootstrapSamples, config.seed));
  if (picks[0]?.confidence === 'low') {
    warnings.push('The top pick has low confidence. Treat this as a screening result, not a final Tafel region.');
  }

  return { points, picks, localSlopes: localTafelSlopes(points), warnings };
}

export function picksToCsv(picks: TafelPick[]): string {
  const headers = [
    'rank', 'label', 'potential_min_V', 'potential_max_V', 'logi_min', 'logi_max', 'n_points',
    'tafel_slope_mV_dec', 'ci95_low_mV_dec', 'ci95_high_mV_dec', 'r2', 'rmse',
    'plateau_score', 'artifact_penalty', 'confidence'
  ];
  const rows = picks.map((pick) => [
    pick.rank,
    pick.label,
    pick.potentialMin,
    pick.potentialMax,
    pick.logiMin,
    pick.logiMax,
    pick.nPoints,
    pick.tafelSlopeMvDec,
    pick.ciLow ?? '',
    pick.ciHigh ?? '',
    pick.r2,
    pick.rmse,
    pick.plateauScore,
    pick.artifactPenalty,
    pick.confidence
  ]);
  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
