import { useEffect, useState } from 'react'
import type { RunConfig, EnvType, UploadedAlgorithm } from '@/types'
import { listAlgorithms } from '@/api'
import CustomAlgoUpload from './CustomAlgoUpload'

const ALL_ALGOS = [
  { key: 'greedy',          label: 'Greedy (min)' },
  { key: 'epsilon_greedy',  label: 'Epsilon-Greedy (min)' },
  { key: 'ucb1',            label: 'UCB1 (adv)' },
  { key: 'thompson',        label: 'Thompson Sampling (adv)' },
]

export function Controls({ onRun, disabled }: { onRun: (cfg: RunConfig) => void; disabled?: boolean }) {
  const [env, setEnv] = useState<EnvType>('bernoulli')
  const [nActions, setNActions] = useState(10)
  const [iterations, setIterations] = useState(1000)
  const [seed, setSeed] = useState<number | ''>('' as any)

  // built-ins
  const [algos, setAlgos] = useState<string[]>(['greedy', 'epsilon_greedy'])
  // uploaded + selection
  const [uploaded, setUploaded] = useState<UploadedAlgorithm[]>([])
  const [selectedCustom, setSelectedCustom] = useState<string[]>([])

  useEffect(() => { listAlgorithms().then(setUploaded).catch(() => {}) }, [])

  function toggleAlgo(key: string) {
    setAlgos(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key])
  }
  function toggleCustom(id: string) {
    setSelectedCustom(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }
  function onUploadedAlgo(a: UploadedAlgorithm) {
    setUploaded(prev => [a, ...prev.filter(x => x.id !== a.id)])
    // instantly show & select the new checkbox
    setSelectedCustom(prev => prev.includes(a.id) ? prev : [a.id, ...prev])
  }

  function run() {
    const cfg: RunConfig = {
      env,
      n_actions: nActions,
      iterations,
      algorithms: algos,
      custom_algorithms: selectedCustom.length ? selectedCustom : undefined,
      seed: seed === '' ? undefined : Number(seed),
    }
    onRun(cfg)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-lg font-semibold">Configuration</div>
        <p className="text-sm text-zinc-600">Define environment and algorithms.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="label mb-1">Bandit Type</div>
          <select value={env} onChange={e => setEnv(e.target.value as EnvType)} className="input w-full">
            <option value="bernoulli">Bernoulli</option>
            <option value="gaussian">Gaussian</option>
          </select>
        </div>
        <div>
          <div className="label mb-1">Number of Actions</div>
          <input type="number" className="input w-full" value={nActions} min={2} max={100}
                 onChange={e => setNActions(Number(e.target.value))} />
        </div>
        <div>
          <div className="label mb-1">Iterations</div>
          <input type="number" className="input w-full" value={iterations} min={1} max={50000}
                 onChange={e => setIterations(Number(e.target.value))} />
        </div>
        <div>
          <div className="label mb-1">Seed (optional)</div>
          <input type="number" className="input w-full" value={seed}
                 onChange={e => setSeed(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
      </div>

      {/* One unified list */}
      <div>
        <div className="label mb-2">Algorithms</div>
        <div className="grid grid-cols-1 gap-2">
          {/* built-ins */}
          {ALL_ALGOS.map(a => (
            <label key={a.key} className="flex items-center gap-3">
              <input type="checkbox" checked={algos.includes(a.key)} onChange={() => toggleAlgo(a.key)} />
              <span>{a.label}</span>
            </label>
          ))}

          {/* uploaded section appears automatically after the first upload */}
          {uploaded.length > 0 && (
            <>
              {uploaded.map(a => (
                <label key={a.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedCustom.includes(a.id)}
                    onChange={() => toggleCustom(a.id)}
                  />
                  <span>{a.name} <span className="text-xs text-zinc-500">(custom, entry: {a.entry})</span></span>
                </label>
              ))}
            </>
          )}

          {/* inline uploader; once uploaded, its checkbox will appear above */}
          <div className="mt-2">
            <CustomAlgoUpload onUploaded={onUploadedAlgo} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="label">Execute simulation</div>
        <button className="btn" onClick={run} disabled={disabled}>Run</button>
      </div>

      <div className="text-xs text-zinc-500">
        Hier ausklappbares Markdown für die Beschreibung der Algorithmen. Fragezeichen soll neben den algos.
      </div>
    </div>
  )
}
