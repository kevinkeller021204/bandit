import { useState } from 'react'
import type { RunConfig, EnvType } from '@/types'

const ALL_ALGOS = [
  { key: 'greedy', label: 'Greedy (min)' },
  { key: 'epsilon_greedy', label: 'Epsilon-Greedy (min)' },
  { key: 'ucb1', label: 'UCB1 (adv)' },
  { key: 'thompson', label: 'Thompson Sampling (adv)' },
  { key: 'gradient', label: 'Gradient Bandit (adv)' },
]

export function Controls({ onRun, disabled }: { onRun: (cfg: RunConfig) => void; disabled?: boolean }) {
  const [env, setEnv] = useState<EnvType>('bernoulli')
  const [nActions, setNActions] = useState(10)
  const [iterations, setIterations] = useState(1000)
  const [seed, setSeed] = useState<number | ''>('' as any)
  const [algos, setAlgos] = useState<string[]>(['greedy', 'epsilon_greedy'])

  function toggleAlgo(key: string) {
    setAlgos(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key])
  }

  function run() {
    const cfg: RunConfig = {
      env,
      n_actions: nActions,
      iterations,
      algorithms: algos,
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
          <input type="number" className="input w-full" value={nActions} min={2} max={100} onChange={e => setNActions(Number(e.target.value))} />
        </div>
        <div>
          <div className="label mb-1">Iterations</div>
          <input type="number" className="input w-full" value={iterations} min={1} max={50000} onChange={e => setIterations(Number(e.target.value))} />
        </div>
        <div>
          <div className="label mb-1">Seed (optional)</div>
          <input type="number" className="input w-full" value={seed} onChange={e => setSeed(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
      </div>

      <div>
        <div className="label mb-2">Algorithms</div>
        <div className="grid grid-cols-1 gap-2">
          {ALL_ALGOS.map(a => (
            <label key={a.key} className="flex items-center gap-3">
              <input type="checkbox" checked={algos.includes(a.key)} onChange={() => toggleAlgo(a.key)} />
              <span>{a.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button className="btn" onClick={run} disabled={disabled}>Run</button>
      </div>

      <div className="text-xs text-zinc-500">
        Minimum: Greedy, Epsilon‑Greedy. Advanced: UCB, Optimistic Init, Thompson, Gradient.
      </div>
    </div>
  )
}
