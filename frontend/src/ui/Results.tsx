// src/components/Results.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlayCtx, RunResponse } from '@/types'
import ManualPlay from './ManualPlay'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { exportNodeAsPNG, exportNodeAsSVG } from '@/utils/exportChart'
import { scrollTo } from '@/utils/nav'
import { plotFromSession } from '@/api'

/**
* Results
* -------
* Visualises a bandit run with manual interaction and two charts, KPI cards.
*
* High-level flow
* - On play context changes, clear manual history and scroll to this section
* - Derive environment/iteration info from either the finished RunResponse (`data`) or the live session (`playCtx`)
* - Merge algorithm traces with an optional manual trace
* - Compute chart series:
* • `lines`: cumulative average reward/acceptance over time per strategy
* • `barData`: action frequencies per strategy
* • `summaryCards`: final average reward/acceptance per strategy for KPI tiles
* - Provide export helpers (PNG/SVG) per chart using DOM refs
* - Show the ManualPlay panel (left) and the results (right); if no data yet, offer a "Plot Results" button
*
* Props
* - playCtx: live session context (algorithms, env, iterations, session_id)
* - data: finished/aggregated traces from backend (RunResponse)
* - setData: setter for `data` (used by onPlot)
* - resetPlay: resets the live session in the parent
*
* Notes
* - `dangerouslySetInnerHTML` is not used here; chart labels tooltips are pure strings
* - `algoColors` and `algoNames` handle both built-ins and a manual series
* - Guard against missing traces/empty series throughout to avoid runtime errors
*/

type ManualEv = { t: number; action: number; reward: number; accepted?: boolean }

type Trace = { actions: number[]; rewards: number[] };

type Traces = Record<string, Trace>;

export function Results({
  playCtx,
  data,
  setData,
  resetPlay
}: {
  playCtx?: PlayCtx | null
  data: RunResponse | null
  setData: React.Dispatch<React.SetStateAction<RunResponse | null>>
  resetPlay: () => void
}) {
  // Local record of manual interactions
  const [manual, setManual] = useState<ManualEv[]>([])
  const hasManual = manual.length > 0

  // Whenever the play context changes (new run), clear manual inputs and jump here
  useEffect(() => {
    setManual([])
    scrollTo("results")
  }, [playCtx])

  // Derive environment + iterations from whichever source is available
  const envInfo: any = useMemo(() => {
    if (data) return (data as RunResponse).env
    if (playCtx) return playCtx!.data.env
    // default to something harmless
    return { n_actions: 0, type: 'bernoulli' }
  }, [data, playCtx])

  const iterations = useMemo(() => {
    if (data) return (data as RunResponse).iterations
    if (playCtx) return playCtx!.data.iterations
    return 0
  }, [data, playCtx])

  // Axis label depends on env type
  const envType = (envInfo.type as 'bernoulli' | 'gaussian' | undefined) ?? 'bernoulli'
  const isBernoulli = envType === 'bernoulli'
  const yLabel = isBernoulli ? 'Acceptance rate' : 'Average reward'

  // Merge traces (algorithms from backend + manual)
  const mergedTraces: Traces = useMemo(() => {
    const base: Record<string, { actions: number[]; rewards: number[] }> =
      data ? (data as RunResponse).traces : {}

    // Convert manual events to a trace if present
    const manualTrace = hasManual
      ? {
        actions: manual.map(m => m.action),
        rewards: manual.map(m => m.reward),
      }
      : null

    return { ...base, ...(manualTrace ? { manual: manualTrace } : {}) }
  }, [data, hasManual, manual])

  // Series keys (algorithm ids + optional "manual")
  const keys = useMemo(() => Object.keys(mergedTraces), [mergedTraces])

  // Build line series with cumulative averages at each timestep for each strategy
  const lines = useMemo(() => {
    if (keys.length === 0) return []
    const len = Math.max(...keys.map(k => mergedTraces[k].rewards.length))
    return Array.from({ length: len }, (_, i) => {
      const row: any = { t: i + 1 }
      for (const k of keys) {
        const r = mergedTraces[k].rewards
        if (i < r.length) {
          let cum = 0
          for (let j = 0; j <= i; j++) cum += r[j]
          row[k] = cum / (i + 1)
        }
      }
      return row
    })
  }, [keys, mergedTraces])

  // Build bar series of action counts per strategy
  const barData = useMemo(() => {
    const n = Number(envInfo.n_actions) || 0
    if (n === 0 || keys.length === 0) return []

    // Pre-count once per series for performance
    const countsBySeries: Record<string, number[]> = {}
    for (const k of keys) {
      const counts = Array(n).fill(0)
      for (const a of mergedTraces[k].actions) if (a >= 0 && a < n) counts[a] += 1
      countsBySeries[k] = counts
    }

    return Array.from({ length: n }, (_, a) => {
      const row: any = { action: `T${a + 1}` }
      for (const k of keys) row[k] = countsBySeries[k][a] ?? 0
      return row
    })

  }, [keys, mergedTraces, envInfo.n_actions])

  // KPI tile data: final cumulative average per strategy
  const summaryCards = useMemo(() => {
    const out: Record<string, { final_avg_reward: number }> = {}
    for (const k of keys) {
      const r = mergedTraces[k].rewards
      if (!r.length) { out[k] = { final_avg_reward: 0 }; continue }
      let cum = 0, last = 0
      for (let i = 0; i < r.length; i++) { cum += r[i]; last = cum / (i + 1) }
      out[k] = { final_avg_reward: last }
    }
    return out
  }, [keys, mergedTraces])

  // Export refs + helpers (only used when plotted)
  const lineRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  // Filename components: stable base plus an ISO-like timestamp without ':' or '.'
  const ts = useMemo(() => new Date().toISOString().replace(/[:.]/g, '-'), [])
  const base = useMemo(() => `${envInfo.type}-${envInfo.n_actions}a-${iterations}it`, [envInfo.type, envInfo.n_actions, iterations])

  // Export helpers for the line chart
  const exportLinePNG = useCallback(async () => {
    if (!lineRef.current) return
    await exportNodeAsPNG(lineRef.current, {
      width: 1920, height: 1080, background: '#ffffff', pixelRatio: 2,
      filename: `${base}-avg-reward-${ts}.png`
    })
  }, [base, ts])

  const exportLineSVG = useCallback(() => {
    if (!lineRef.current) return
    exportNodeAsSVG(lineRef.current, `${base}-avg-reward-${ts}.svg`)
  }, [base, ts])

  // Export helpers for the bar chart
  const exportBarPNG = useCallback(async () => {
    if (!barRef.current) return
    await exportNodeAsPNG(barRef.current, {
      width: 1920, height: 1080, background: '#ffffff', pixelRatio: 2,
      filename: `${base}-action-dist-${ts}.png`
    })
  }, [base, ts])

  const exportBarSVG = useCallback(() => {
    if (!barRef.current) return
    exportNodeAsSVG(barRef.current, `${base}-action-dist-${ts}.svg`)
  }, [base, ts])

  // Friendly display names and colors per series (covers built-ins + manual)
  const algoNames: Record<string, string> = {
    greedy: "Greedy",
    epsilon_greedy: "ε-Greedy",
    ucb1: "UCB1",
    thompson: "Thompson",
    gradient: "Gradient",
    manual: "You (manual)",
  }
  const algoColors: Record<string, string> = {
    greedy: "blue",
    epsilon_greedy: "orange",
    ucb1: "green",
    thompson: "red",
    gradient: "purple",
    manual: "#111827",
  }

  // Handlers passed into ManualPlay: keep local state in sync with emitted events
  const handleSync = useCallback((hist: ManualEv[]) => setManual(hist), []);
  const handleEvent = useCallback((ev: ManualEv) => {
    setManual(prev => {
      const next = [...prev];
      const i = next.findIndex(x => x.t === ev.t);
      if (i >= 0) next[i] = ev; else next.push(ev);
      next.sort((a, b) => a.t - b.t);
      return next;
    });
  }, []);

  // Fetch aggregated traces for the current session and store in parent state
  async function onPlot() {
    if (!playCtx) return
    const resp = await plotFromSession({
      session_id: playCtx.data.session_id,
      algorithms: playCtx.algorithms,
      custom_algorithms: playCtx.custom_algorithms,
      iterations: playCtx.data.iterations,
    })
    setData(resp)
  }

  return playCtx && (
    <section className="card card-pad w-4/5 scroll-mt-[72px]" id="results">
      <div className="flex gap-8 items-start md:grid-cols-2">
        {/* Left column: interactive manual tester */}
        <div className="space-y-2 flex-1">
          <ManualPlay
            playCtx={playCtx}
            mode="backend"
            onSync={handleSync}
            onEvent={handleEvent}
            resetPlay={resetPlay}
          />
        </div>

        {/* Right column: charts + KPIs */}
        {data ? (
          <div className="space-y-8 flex-1 ">
            {/* LINE CHART*/}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{yLabel} over time</div>
                <div className="flex gap-2 mr-4">
                  <button type="button" className="btn-subtle" onClick={exportLinePNG} title="Download PNG (1920×1080)">PNG</button>
                  <button type="button" className="btn-subtle" onClick={exportLineSVG} title="Download SVG">SVG</button>
                </div>
              </div>
              <div className="h-64 card" ref={lineRef}>
                <div className="card-pad h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lines}>
                      <XAxis dataKey="t" tickFormatter={(t) => `Kunde ${t}`} />
                      <YAxis
                        domain={isBernoulli ? [0, 1] : ['auto', 'auto']}
                      />
                      <Tooltip
                        labelFormatter={(t) => `Kunde ${t}`}
                        formatter={(value: any, name: string) => [
                          isBernoulli ? `${(value as number * 100).toFixed(1)}%` : (value as number).toFixed(3),
                          algoNames[name] || name
                        ]}
                      />
                      <Legend />
                      {keys.map(k => (
                        <Line key={k} type="monotone" dot={false} dataKey={k} stroke={algoColors[k] || "black"} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* BAR CHART */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Toppings angeboten (Häufigkeit)</div>
                <div className="flex gap-2 mr-4">
                  <button type="button" className="btn-subtle" onClick={exportBarPNG} title="Download PNG (1920×1080)">PNG</button>
                  <button type="button" className="btn-subtle" onClick={exportBarSVG} title="Download SVG">SVG</button>
                </div>
              </div>
              <div className="h-64 card" ref={barRef}>
                <div className="card-pad h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis dataKey="action" />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(v) => `Topping ${String(v).replace('T', '')}`}
                        formatter={(value: any, name: string) => [value, algoNames[name] || name]}
                      />
                      <Legend formatter={(v) => algoNames[v] || v} />
                      {keys.map((k) => (
                        <Bar key={k} dataKey={k} name={algoNames[k] || k} fill={algoColors[k] || 'black'} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>


            {/* KPI tiles */}
            <div className="space-y-2">
              <div className="text-lg font-semibold">Leistung je Strategie</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {keys.map(k => (
                  <div key={k} className="card p-4" style={{ borderTop: `4px solid ${algoColors[k] || "black"}` }}>
                    <div className="text-sm text-zinc-600">{algoNames[k] || k}</div>
                    <div className="text-2xl font-semibold">
                      {isBernoulli
                        ? `${(summaryCards[k].final_avg_reward * 100).toFixed(1)}%`
                        : summaryCards[k].final_avg_reward.toFixed(3)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {isBernoulli ? 'Finale Akzeptanzrate' : 'Finaler durchschnittl. Reward'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) :
          // No aggregated data yet: allow the user to compute/plot results from the session
          <div className="flex-1 h-[50rem] flex justify-center items-center" >
            <button className="btn" onClick={onPlot}>Plot Results</button>
          </div>
        }
      </div>
    </section>
  )
}