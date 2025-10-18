// src/App.tsx
import { useState } from 'react'
import { Controls } from './Controls'
import { Results } from './Results'
import type { PlayCtx, RunResponse } from '@/types'
import Header from './layout/Header'

export default function App() {
  const [loading, setLoading] = useState(false)
  const [playCtx, setPlayCtx] = useState<PlayCtx | null>(null)
  const [data, setData] = useState<RunResponse | null>(null)

  function handlePlayStarted(ctx: PlayCtx) {
    setPlayCtx(ctx)
    setData(null)
  }

  function resetPlay() {
    setPlayCtx(null)
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
        <section className="card card-pad w-2/5 scroll-mt-[72px]" id="selection">
          <Controls
            onLoadingChange={setLoading}
            onPlayStarted={handlePlayStarted}
          />
        </section>

        {/* RIGHT: Results (renders charts after play or plot) */}
        <Results
          data={data}
          setData={setData}
          loading={loading}
          playCtx={playCtx}
          resetPlay={resetPlay}
        />
      </main>
      {/* <a className="p-3 text-gray-400" href="https://www.freepik.com/free-vector/hand-drawn-food-pattern-background_72159777.htm#fromView=search&page=1&position=2&uuid=27d277a2-f9d0-40e0-b811-5c3d50825a1a&query=pizza">Image by pikisuperstar on Freepik</a> */}
    </div>
  )
}
