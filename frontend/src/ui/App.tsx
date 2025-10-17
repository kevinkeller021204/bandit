// src/App.tsx
import { useState } from 'react'
import { Controls } from './Controls'
import { Results } from './Results'
import type { RunResponse } from '@/types'
import Header from './Header'

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
      <Header
        selectionId="selection"
        resultsId="results"
        onTranslate={() => console.log("translate clicked")}
      />

      <main className="mx-auto w-4xl p-6 grid gap-6 grid-cols-1 justify-items-center" >
        {/* LEFT: Controls (creates a Play session and later triggers Plot) */}
        <section className="card card-pad w-2/5 scroll-mt-[72px]"  id="selection">
          <Controls
            disabled={loading}
            onLoadingChange={setLoading}
            onPlotDone={(resp) => setData(resp)}
            onPlayStarted={handlePlayStarted}
          />
        </section>

        {/* RIGHT: Results (renders charts after play or plot) */}
        <Results data={data} loading={loading} playCtx={playCtx} />
      </main>
    </div>
  )
}
