'use client';

import { useMemo, useState } from 'react';
import { parseCsv } from '@/lib/csv';
import {
  detectTafelRegions,
  normalizeRows,
  picksToCsv,
  presetConfig,
  type DetectionConfig,
  type DetectionPreset,
  type DetectionResult,
  type NormalizedInput
} from '@/lib/tafel';
import { TafelChart } from '@/components/TafelChart';

function downloadText(filename: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function displayRegionLabel(label: string): string {
  if (label === 'core') return 'tafel region';
  if (label === 'expanded') return 'extended region';
  if (label === 'more_expanded') return 'farthur extended region';
  return label;
}

function format(value: number | undefined, digits = 3): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return value.toFixed(digits);
}

export function TafelApp() {
  const [preset, setPreset] = useState<DetectionPreset>('balanced');
  const [minPoints, setMinPoints] = useState<number>(presetConfig('balanced').minPoints);
  const [minPotentialSpan, setMinPotentialSpan] = useState<number>(presetConfig('balanced').minPotentialSpan);
  const [minLogiSpan, setMinLogiSpan] = useState<number>(presetConfig('balanced').minLogiSpan);
  const [bootstrapSamples, setBootstrapSamples] = useState<number>(presetConfig('balanced').bootstrapSamples);
  const [normalized, setNormalized] = useState<NormalizedInput | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config: DetectionConfig = useMemo(() => {
    const base = presetConfig(preset);
    return {
      ...base,
      minPoints,
      minPotentialSpan,
      minLogiSpan,
      bootstrapSamples
    };
  }, [preset, minPoints, minPotentialSpan, minLogiSpan, bootstrapSamples]);

  function applyPreset(nextPreset: DetectionPreset) {
    const next = presetConfig(nextPreset);
    setPreset(nextPreset);
    setMinPoints(next.minPoints);
    setMinPotentialSpan(next.minPotentialSpan);
    setMinLogiSpan(next.minLogiSpan);
    setBootstrapSamples(next.bootstrapSamples);
  }

  function analyzeText(text: string) {
    try {
      const parsed = parseCsv(text);
      const input = normalizeRows(parsed.headers, parsed.rows);
      const nextResult = detectTafelRegions(input.points, config);
      setNormalized(input);
      setResult(nextResult);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setNormalized(null);
      setResult(null);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    analyzeText(text);
  }

  async function loadSample() {
    const response = await fetch('/sample.csv');
    const text = await response.text();
    analyzeText(text);
  }

  const topPick = result?.picks[0];

  return (
    <main className="container">
      <section className="hero">
        <h1>Tafel Auto Detector</h1>
      </section>

      <section className="grid">
        <aside className="panel stack">
          <h2>Input</h2>
          <div className="field">
            <label htmlFor="csv-file">CSV file</label>
            <input id="csv-file" type="file" accept=".csv,.txt" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
            <div className="help">Supported columns: eta/logi, potential/current, E_V/j_A_cm2, and common aliases.</div>
          </div>

          <div className="field">
            <label htmlFor="preset">Preset</label>
            <select id="preset" value={preset} onChange={(event) => applyPreset(event.target.value as DetectionPreset)}>
              <option value="exploratory">exploratory</option>
              <option value="balanced">balanced</option>
              <option value="strict">strict</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="min-points">Minimum points</label>
            <input id="min-points" type="number" min={5} max={80} value={minPoints} onChange={(event) => setMinPoints(Number(event.target.value))} />
          </div>

          <div className="field">
            <label htmlFor="potential-span">Minimum potential span / V</label>
            <input id="potential-span" type="number" step="0.005" min={0} value={minPotentialSpan} onChange={(event) => setMinPotentialSpan(Number(event.target.value))} />
          </div>

          <div className="field">
            <label htmlFor="logi-span">Minimum log-current span / dec</label>
            <input id="logi-span" type="number" step="0.05" min={0} value={minLogiSpan} onChange={(event) => setMinLogiSpan(Number(event.target.value))} />
          </div>

          <div className="field">
            <label htmlFor="bootstrap">Bootstrap samples</label>
            <input id="bootstrap" type="number" min={0} max={2000} value={bootstrapSamples} onChange={(event) => setBootstrapSamples(Number(event.target.value))} />
          </div>

          <div className="actions">
            <button type="button" onClick={loadSample}>Load sample</button>
            <button type="button" disabled={!normalized} onClick={() => normalized && setResult(detectTafelRegions(normalized.points, config))}>Re-run</button>
            <button
              type="button"
              className="primary"
              disabled={!result?.picks.length}
              onClick={() => result && downloadText('tafel_candidate_regions.csv', picksToCsv(result.picks))}
            >
              Download CSV
            </button>
          </div>

          <div className="help">
            Vercel deployment version: static Next.js app. No data is uploaded to a server.
          </div>
        </aside>

        <section className="stack">
          {error && <div className="notice">{error}</div>}

          {normalized && (
            <div className="panel">
              <h2>Dataset</h2>
              <div className="metrics">
                <div className="metric"><span>Mode</span><strong>{normalized.mode}</strong></div>
                <div className="metric"><span>Points</span><strong>{normalized.points.length}</strong></div>
                <div className="metric"><span>X column</span><strong>{normalized.potentialColumn}</strong></div>
                <div className="metric"><span>Y/current column</span><strong>{normalized.logiColumn ?? normalized.currentColumn}</strong></div>
              </div>
            </div>
          )}

          {topPick && (
            <div className="panel">
              <h2>Top region</h2>
              <div className="metrics">
                <div className="metric"><span>Slope</span><strong>{topPick.tafelSlopeMvDec.toFixed(1)} mV/dec</strong></div>
                <div className="metric"><span>95% CI</span><strong>{topPick.ciLow !== undefined ? `${topPick.ciLow.toFixed(1)}-${topPick.ciHigh?.toFixed(1)}` : '-'}</strong></div>
                <div className="metric"><span>R2</span><strong>{format(topPick.r2, 4)}</strong></div>
                <div className="metric"><span>Confidence</span><strong className={`badge ${topPick.confidence}`}>{topPick.confidence}</strong></div>
              </div>
              {result?.warnings.map((warning) => <div key={warning} className="notice">{warning}</div>)}
            </div>
          )}

          {result && result.picks.length > 0 && (
            <>
              <div className="panel chart-card">
                <h3>Consensus-expanded Tafel regions</h3>
                <TafelChart points={result.points} picks={result.picks} />
              </div>

              <div className="panel">
                <h3>Candidate regions</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>region</th><th>range / V</th><th>slope</th><th>CI95</th><th>R2</th><th>confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.picks.map((pick) => (
                        <tr key={pick.rank}>
                          <td>{displayRegionLabel(pick.label)}</td>
                          <td>{pick.potentialMin.toFixed(4)}-{pick.potentialMax.toFixed(4)}</td>
                          <td>{pick.tafelSlopeMvDec.toFixed(2)}</td>
                          <td>{pick.ciLow !== undefined ? `${pick.ciLow.toFixed(2)}-${pick.ciHigh?.toFixed(2)}` : '-'}</td>
                          <td>{pick.r2.toFixed(5)}</td>
                          <td><span className={`badge ${pick.confidence}`}>{pick.confidence}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!result && !error && (
            <div className="panel">
              <h2>Ready</h2>
              <p className="footer-note">Upload a CSV or load the sample data. The browser implementation focuses on the repaired local-window algorithm and bootstrap CI. Full-curve/Bayesian fitting is intentionally not shown in this Vercel static app until its acceptance criteria are stricter.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
