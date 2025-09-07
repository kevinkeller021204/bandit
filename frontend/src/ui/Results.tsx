import type { RunResponse } from '@/types'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

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

  //traces to time series for line chart
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

  //action counts per algorithm for bar chart
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

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <div className="text-lg font-semibold">Environment Feedback</div>
        <div className="text-sm text-zinc-600">Type: <span className="font-medium">{data.env.type}</span></div>
      </div>

      <div className="space-y-2">
        <div className="label">Average Reward over Time</div>
        <div className="h-64 card">
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
        <div className="label">Action Selection Distribution</div>
        <div className="h-64 card">
          <div className="card-pad h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="action" />
                <YAxis />
                <Tooltip />
                <Legend />
                  {keys.map((k, idx) => (
                    <Bar
                      key={k}
                      dataKey={k}
                      fill={algoColors[k]}
                    />
                  ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {keys.map(k => (
          <div
            key={k}
            className="card p-4"
            style={{ borderTop: `4px solid ${algoColors[k] || "black"}` }} // colored line, if you want to change watch out for <bar> implementation
          >
            <div className="text-sm text-zinc-600">{k}</div>
            <div className="text-2xl font-semibold">{data.summary[k].final_avg_reward.toFixed(3)}</div>
            <div className="text-xs text-zinc-500">Final average reward</div>
          </div>
        ))}

      </div>
    </div>
  )
}
