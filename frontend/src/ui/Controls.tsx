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

const ALGO_INFO_HTML: Record<string, string> = {
  greedy: `
    <h3 class="font-semibold mb-1">Greedy</h3>
    <ul class="list-disc pl-5 space-y-1">
      <li>Wählt immer die aktuell beste bekannte Aktion (höchster geschätzter Wert).</li>
      <li><strong>Vorteil:</strong> nutzt vorhandenes Wissen maximal aus.</li>
      <li><strong>Nachteil:</strong> keine Exploration &rarr; kann in lokalem Optimum stecken bleiben.</li>
      <li>Update der Schätzung: inkrementelles Mittel der beobachteten Rewards.</li>
    </ul>
  `,
  epsilon_greedy: `
    <h3 class="font-semibold mb-1">Epsilon-Greedy</h3>
    <ul class="list-disc pl-5 space-y-1">
      <li>Mit Wahrscheinlichkeit <code>ε</code> wird zufällig exploriert, sonst greedy ausgebeutet.</li>
      <li><strong>Parameter:</strong> <code>ε</code> in [0,1] (z. B. 0.1).</li>
      <li><strong>Trade-off:</strong> Exploration vs. Exploitation.</li>
      <li>Geeignet als einfacher, robuster Standard.</li>
    </ul>
  `,
  ucb1: `
    <h3 class="font-semibold mb-1">UCB1 (Upper Confidence Bound)</h3>
    <ul class="list-disc pl-5 space-y-1">
      <li>Wählt Aktion mit <em>Schätzwert + Unsicherheitsbonus</em>.</li>
      <li>Intuition: bevorzugt gute Mittelwerte <em>und</em> wenig beprobte Aktionen.</li>
      <li>Formel (vereinfacht): <code>mean_i + sqrt(2 * ln(t) / n_i)</code></li>
      <li>Sehr wirksam bei stationären Banditen.</li>
    </ul>
  `,
  thompson: `
    <h3 class="font-semibold mb-1">Thompson Sampling</h3>
    <ul class="list-disc pl-5 space-y-1">
      <li>Bayesianisch: zieht zufällig aus Posterior-Verteilungen (z. B. Beta bei Bernoulli).</li>
      <li>Natürliche Balance zwischen Exploration &amp; Exploitation.</li>
      <li>Oft sehr schnelle Konvergenz und starke praktische Performance.</li>
    </ul>
  `,
};


export function Controls({ onRun, disabled }: { onRun: (cfg: RunConfig) => void; disabled?: boolean }) {
  const [env, setEnv] = useState<EnvType>('bernoulli')
  const [nActions, setNActions] = useState(10)
  const [iterations, setIterations] = useState(1000)
  const [seed, setSeed] = useState<number | ''>('' as any)
  const [openInfo, setOpenInfo] = useState<string | null>(null);

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

  function toggleInfo(key: string) {
  setOpenInfo(prev => (prev === key ? null : key));
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
  <div key={a.key} className="rounded border border-zinc-200 p-2">
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={algos.includes(a.key)}
          onChange={() => toggleAlgo(a.key)}
        />
        <span>{a.label}</span>
      </label>

      {/* ?-Button rechts */}
      <button
        type="button"
        className="h-6 w-6 rounded-full border border-zinc-300 text-xs leading-6 text-zinc-600 hover:bg-zinc-100"
        title="Erklärung anzeigen"
        onClick={() => toggleInfo(a.key)}
        aria-expanded={openInfo === a.key}
        aria-controls={`algo-info-${a.key}`}
      >
        ?
      </button>
    </div>

    {/* Ausklappbarer Bereich */}
    {openInfo === a.key && (
      <div
        id={`algo-info-${a.key}`}
        className="mt-2 rounded bg-zinc-50 p-3 text-sm"
        dangerouslySetInnerHTML={{
          __html: ALGO_INFO_HTML[a.key] || '<em>Keine Beschreibung verfügbar.</em>',
        }}
      />
    )}
  </div>
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


    </div>
  )
}
