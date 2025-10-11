// src/components/Results.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RunResponse } from '@/types'
import ManualPlay from './ManualPlay'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

type PlayCtx = { sessionId: string; env: any; iterations: number }
type ManualEv = { t: number; action: number; reward: number; accepted?: boolean }
type Trace = { actions: number[]; rewards: number[] };
type Traces = Record<string, Trace>;

export function Results({
  data,
  loading,
  playCtx,
}: {
  data: RunResponse | null
  loading: boolean
  playCtx?: PlayCtx | null
}) {
  // --- manual history managed here (ascending by t) ---
  const [manual, setManual] = useState<ManualEv[]>([])
  useEffect(() => { setManual([]) }, [playCtx?.sessionId])

  // --- high-level flags (no early returns) ---
  const hasPlotted = !!data
  const hasSession = !!playCtx
  const hasManual = manual.length > 0

  // --- env + iterations sourced from whichever we have ---
  const envInfo: any = useMemo(() => {
    if (hasPlotted) return (data as RunResponse).env
    if (hasSession) return playCtx!.env
    // default to something harmless
    return { n_actions: 0, type: 'bernoulli' }
  }, [hasPlotted, hasSession, data, playCtx])

  const iterations = useMemo(() => {
    if (hasPlotted) return (data as RunResponse).iterations
    if (hasSession) return playCtx!.iterations
    return 0
  }, [hasPlotted, hasSession, data, playCtx])

  const envType = (envInfo.type as 'bernoulli' | 'gaussian' | undefined) ?? 'bernoulli'
  const isBernoulli = envType === 'bernoulli'
  const yLabel = isBernoulli ? 'Acceptance rate' : 'Average reward'

  // ---- merge traces (algorithms + manual) ----
  const mergedTraces: Traces = useMemo(() => {
    const base: Record<string, { actions: number[]; rewards: number[] }> =
      hasPlotted ? (data as RunResponse).traces : {}
    const manualTrace = hasManual
      ? {
        actions: manual.map(m => m.action),
        rewards: manual.map(m => m.reward),
      }
      : null
    return { ...base, ...(manualTrace ? { manual: manualTrace } : {}) }
  }, [hasPlotted, data, hasManual, manual])

  const keys = useMemo(() => Object.keys(mergedTraces), [mergedTraces])

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

  const barData = useMemo(() => {
    const n = Number(envInfo.n_actions) || 0
    if (n === 0 || keys.length === 0) return []
    // pre-count once per series
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

  // cfg for ManualPlay (always computed, safe defaults)
  const manualCfg = useMemo(() => ({
    env: envType,
    n_actions: envInfo.n_actions ?? 0,
    iterations,
    algorithms: [],
    seed: undefined,
  }), [envType, envInfo.n_actions, iterations])

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

  // ---------- RENDER ----------
  return (
    <div className="space-y-8">
      {/* top bar */}
      <div className="space-y-1">
        <div className="text-lg font-semibold">
          {(hasPlotted || keys.includes('manual')) ? 'Pizzeria Ergebnisse 🍕' : 'Manual Play Session 🍕'}
        </div>
        <div className="text-sm text-zinc-600">
          Kundenmodell: <span className="font-medium">{isBernoulli ? 'Bernoulli' : 'Gaussian'}</span> •{' '}
          Toppings: <span className="font-medium">{envInfo.n_actions ?? 0}</span>
        </div>
      </div>

      {/* manual surface */}
      {hasSession && (
        <div className="space-y-2">
          <ManualPlay
            cfg={manualCfg}
            sessionId={playCtx!.sessionId}
            mode="backend"
            onSync={handleSync}
            onEvent={handleEvent}
          />
        </div>
      )}

      {/* info states */}
      {loading && <div className="text-zinc-600">Running…</div>}
      {!loading && !hasSession && !hasPlotted && !hasManual && (
        <div className="text-zinc-600">No run yet.</div>
      )}

      {/* charts (render if any series exists) */}
      {hasPlotted && (
        <>
          {/* LINE */}
          <div className="space-y-2">
            <div className="text-lg font-semibold">{yLabel} over time</div>
            <div className="h-64 card">
              <div className="card-pad h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lines}>
                    <XAxis dataKey="t" tickFormatter={(t) => `Kunde ${t}`} />
                    <YAxis
                      domain={isBernoulli ? [0, 1] : ['auto', 'auto']}
                    // tickFormatter={(v) => isBernoulli ? `${Math.round((v as number) * 100)}%` : (v as number)}
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

          {/* BAR */}
          <div className="space-y-2">
            <div className="text-lg font-semibold">Toppings angeboten (Häufigkeit)</div>
            <div className="h-64 card">
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

          {/* KPI */}
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
        </>
      )}
    </div>
  )
}
