// src/App.tsx
import { useState } from 'react'
import { Controls } from './Controls'
import { Results } from './Results'
import type { RunResponse } from '@/types'

export default function App() {
  const [data, setData] = useState<RunResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [playCtx, setPlayCtx] = useState<{
    sessionId: string
    env: any
    iterations: number
  } | null>(null)

  function handlePlayStarted(ctx: { sessionId: string; env: any; iterations: number }) {
    setPlayCtx(ctx)
    setData(null)
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-semibold tracking-tight">SliceWise 🍕 — Topping-Bandit-Labor</div>
          <div className="text-xs text-zinc-600">SPA • React • Quart</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6 grid gap-6 md:grid-cols-[360px,1fr]">
        {/* LEFT: Controls (creates a Play session and later triggers Plot) */}
        <section className="card card-pad">
          <Controls
            disabled={loading}
            onLoadingChange={setLoading}          // ★ App owns loading spinner
            onPlotDone={(resp) => setData(resp)}  // ★ results from /api/plot land here
            onPlayStarted={handlePlayStarted}
          />
        </section>

        {/* RIGHT: Results (renders charts after Plot) */}
        <section className="card card-pad">
          <Results data={data} loading={loading} playCtx={playCtx} />
        </section>
      </main>
    </div>
  )
}
