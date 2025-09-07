import { useState } from 'react'
import { Controls } from './Controls'
import { Results } from './Results'
import type { RunResponse, RunConfig, EnvType } from '@/types'
import { runExperiment } from '@/api'

export default function App() {
  const [data, setData] = useState<RunResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function onRun(cfg: RunConfig) {
    setLoading(true)
    try {
      const res = await runExperiment(cfg)
      setData(res)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight">Very Epic k‑Armed Bandit</div>
          <div className="text-xs text-zinc-600">SPA • React • Quart</div> 
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6 grid gap-6 md:grid-cols-[360px,1fr]">
        <section className="card card-pad">
          <Controls onRun={onRun} disabled={loading} />
        </section>
        <section className="card card-pad">
          <Results data={data} loading={loading} />
        </section>
      </main>
    </div>
  )
}
