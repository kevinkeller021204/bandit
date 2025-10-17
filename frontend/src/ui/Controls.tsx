import { useEffect, useState } from 'react'
import type { EnvType, UploadedAlgorithm, PlayCtx, RunConfig } from '@/types'
import { listAlgorithms, playStart } from '@/api'
import CustomAlgoUpload from './CustomAlgoUpload'
import { NumberStepper } from './NumberStepper'
import { SegmentedToggle } from './SegmentedToggle'

const ALL_ALGOS = [
  { key: 'greedy', label: 'Greedy (min)' },
  { key: 'epsilon_greedy', label: 'Epsilon-Greedy (min)' },
  { key: 'ucb1', label: 'UCB1 (adv)' },
  { key: 'thompson', label: 'Thompson Sampling (adv)' },
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


type ControlsProps = {
  onLoadingChange?: (loading: boolean) => void
  onPlayStarted?: (playCtx: PlayCtx) => void
}

export function Controls({
  onPlayStarted,
}: ControlsProps) {
  const [env, setEnv] = useState<EnvType>('bernoulli')
  const [nActions, setNActions] = useState(10)
  const [iterations, setIterations] = useState(50)
  const [seed, setSeed] = useState<number>()
  const [openInfo, setOpenInfo] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null)

  // built-ins
  const [algos, setAlgos] = useState<string[]>(['greedy', 'epsilon_greedy'])
  // uploaded + selection
  const [uploaded, setUploaded] = useState<UploadedAlgorithm[]>([])
  const [selectedCustom, setSelectedCustom] = useState<string[]>([])

  useEffect(() => { listAlgorithms().then(setUploaded).catch(() => { }) }, [])

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

  function buildRunConfig(): RunConfig {
    return {
      env,
      n_actions: nActions,
      iterations,
      algorithms: algos,
      custom_algorithms: selectedCustom.length ? selectedCustom : undefined,
      seed: seed,
    }
  }

  async function onPlay() {
    const cfg = buildRunConfig()
    const s = await playStart({ env: cfg.env, n_actions: cfg.n_actions, iterations: cfg.iterations, seed: cfg.seed })
    setSessionId(s.session_id)
    onPlayStarted?.({
      algorithms: algos,
      n_actions: nActions,
      data: s
    })
  }

  function toggleInfo(key: string) {
    setOpenInfo(prev => (prev === key ? null : key));
  }

  return (
    <div className="space-y-12 w-1xl">
      <div className="space-y-1 flex flex-wrap items-center">
        <div className="text-lg font-semibold p-2">Pizzeria Setup</div>
        <button
          type="button"
          className="h-6 w-6 rounded-full border border-zinc-300 text-xs leading-6 text-zinc-600 hover:bg-zinc-100"
          title="Erklärung anzeigen"
          onClick={() => toggleInfo("pizza-topping-bandit")}
          aria-expanded={openInfo === "pizza-topping-bandit"}
          aria-controls={`algo-info-${"pizza-topping-bandit"}`}
        >
          ?
        </button>
        {openInfo === "pizza-topping-bandit" && (
          <div
            id={`algo-info-${"pizza-topping-bandit"}`}
            className="mt-2 rounded bg-zinc-50 p-3 text-sm basis-full"
            dangerouslySetInnerHTML={{
              __html: `<p className="text-sm text-zinc-600"> Choose how many <strong>topping options</strong> you offer and which <strong>recommendation strategies</strong> to try.</p>`,
            }}
          />
        )}
        {/*  */}
      </div>

      <div className="grid grid-cols-2 gap-x-[4rem] gap-y-4 justify-items-stretch">
        <SegmentedToggle<EnvType>
          label="Bandit"
          value={env}
          onChange={setEnv}
          options={[
            { label: "Bernoulli", value: "bernoulli" },
            { label: "Gaussian", value: "gaussian" },
          ]}
          size="lg"
          className="w-full"
        />
        <div>
          <NumberStepper
            label="Toppings"
            id="toppings"
            value={nActions}
            onChange={setNActions}
            min={0}
            max={100}
            step={1}
          />
        </div>
        <div>
          <NumberStepper
            label="Customers"
            id="customers"
            value={iterations}
            onChange={setIterations}
            min={0}
            max={10000}
            step={1}
          />
        </div>
        <div>
          <NumberStepper
            label="Random Seed"
            id="customers"
            value={seed}
            onChange={setSeed}
            min={0}
            max={10000}
            step={1}
            required={false}
          />
        </div>
      </div>

      {/* One unified list */}
      <div>
        <div className="label mb-2">Algorithmen</div>
        <div className="grid grid-cols-2 gap-2 items-start">
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
            <div className="rounded border border-zinc-200 p-2">
              {uploaded.map(a => (
                <label key={a.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedCustom.includes(a.id)}
                    onChange={() => toggleCustom(a.id)}
                  />
                  <span>{a.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* inline uploader; once uploaded, its checkbox will appear above */}
      <div className="mt-2">
        <CustomAlgoUpload onUploaded={onUploadedAlgo} />
      </div>

      {/* RUN SECTION */}
      <div className="space-y-3">
        {/* <div className="label">Kunden bedienen</div> CHANGED (was: Execute simulation) */}
        <div className="flex gap-2 justify-center">
          <button className="btn-lg" onClick={onPlay}>Kunden bedienen</button>
        </div>
      </div>
    </div>
  )
}
