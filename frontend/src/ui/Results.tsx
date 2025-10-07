import { useRef } from 'react'
import type { RunResponse } from '@/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { exportNodeAsPNG, exportNodeAsSVG, copyNodeAsPNGToClipboard } from './exportChart'

export function Results({ data, loading }: { data: RunResponse | null, loading: boolean }) {
  if (loading) return <div className="text-zinc-600">Running…</div>
  if (!data) return <div className="text-zinc-600">No run yet.</div>

  const algoColors: Record<string, string> = {
    greedy: "blue",
    epsilon_greedy: "orange",
    ucb1: "green",
    thompson: "red",
    gradient: "purple"
  }

  const keys = Object.keys(data.traces)
  const len = data.traces[keys[0]].rewards.length

  const lines = Array.from({ length: len }, (_, i) => {
    const row: any = { t: i + 1 }
    for (const k of keys) {
      const r = data.traces[k].rewards
      const cum = r.slice(0, i + 1).reduce((a, b) => a + b, 0)
      row[k] = cum / (i + 1)
    }
    return row
  })

  const actionCounts: Record<string, number[]> = {}
  const nActions = data.env.n_actions
  for (const k of keys) {
    const counts = Array(nActions).fill(0)
    for (const a of data.traces[k].actions) counts[a] += 1
    actionCounts[k] = counts
  }

  const barData = Array.from({ length: nActions }, (_, a) => {
    const row: any = { action: `A${a}` }
    for (const k of keys) row[k] = actionCounts[k][a]
    return row
  })

  const lineRef = useRef<HTMLDivElement | null>(null)
  const barRef  = useRef<HTMLDivElement | null>(null)

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const base = `${data.env.type}-${data.env.n_actions}a-${len}it`

  async function exportLinePNG() {
    await exportNodeAsPNG(lineRef.current!, { width: 1920, height: 1080, background: '#ffffff', pixelRatio: 2, filename: `${base}-avg-reward-${ts}.png` })
  }
  function exportLineSVG() {
    exportNodeAsSVG(lineRef.current!, `${base}-avg-reward-${ts}.svg`)
  }
  async function copyLinePNG() {
    await copyNodeAsPNGToClipboard(lineRef.current!, { width: 1920, height: 1080, background: '#ffffff', pixelRatio: 2 })
  }

  async function exportBarPNG() {
    await exportNodeAsPNG(barRef.current!, { width: 1920, height: 1080, background: '#ffffff', pixelRatio: 2, filename: `${base}-action-dist-${ts}.png` })
  }
  function exportBarSVG() {
    exportNodeAsSVG(barRef.current!, `${base}-action-dist-${ts}.svg`)
  }
  async function copyBarPNG() {
    await copyNodeAsPNGToClipboard(barRef.current!, { width: 1920, height: 1080, background: '#ffffff', pixelRatio: 2 })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="text-lg font-semibold">Environment Feedback</div>
        <div className="text-sm text-zinc-600">
          Type: <span className="font-medium">{data.env.type}</span> • Actions: <span className="font-medium">{data.env.n_actions}</span> • Iterations: <span className="font-medium">{len}</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="label">Average Reward over Time</div>
          <div className="flex gap-2">
            <button className="btn-subtle" onClick={exportLinePNG} title="Download PNG (1920×1080)">PNG</button>
            <button className="btn-subtle" onClick={exportLineSVG} title="Download SVG">SVG</button>
            <button className="btn-subtle" onClick={copyLinePNG} title="Copy PNG to clipboard">Copy</button>
          </div>
        </div>
        <div className="h-64 card" ref={lineRef}>
          <div className="card-pad h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lines}>
                <XAxis dataKey="t" />
                <YAxis />
                <Tooltip />
                <Legend />
                {keys.map(k => (
                  <Line key={k} type="monotone" dot={false} dataKey={k} stroke={algoColors[k] || "black"} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="label">Action Selection Distribution</div>
          <div className="flex gap-2">
            <button className="btn-subtle" onClick={exportBarPNG} title="Download PNG (1920×1080)">PNG</button>
            <button className="btn-subtle" onClick={exportBarSVG} title="Download SVG">SVG</button>
            <button className="btn-subtle" onClick={copyBarPNG} title="Copy PNG to clipboard">Copy</button>
          </div>
        </div>
        <div className="h-64 card" ref={barRef}>
          <div className="card-pad h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="action" />
                <YAxis />
                <Tooltip />
                <Legend />
                {keys.map((k) => (
                  <Bar key={k} dataKey={k} fill={algoColors[k]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {keys.map(k => (
          <div key={k} className="card p-4" style={{ borderTop: `4px solid ${algoColors[k] || "black"}` }}>
            <div className="text-sm text-zinc-600">{k}</div>
            <div className="text-2xl font-semibold">{data.summary[k].final_avg_reward.toFixed(3)}</div>
            <div className="text-xs text-zinc-500">Final average reward</div>
          </div>
        ))}
      </div>
    </div>
  )
}
