import { useEffect, useState } from 'react'
import type { EnvType, UploadedAlgorithm, PlayCtx, RunConfig } from '@/types'
import { listAlgorithms, playStart } from '@/api'
import CustomAlgoUpload from './layout/CustomAlgoUpload'
import { NumberStepper } from './layout/NumberStepper'
import { SegmentedToggle } from './layout/SegmentedToggle'
import { useToast } from './layout/ToastProvider'
import { formatError } from '@/utils/formatError'

/**
* Controls
* --------
* A self‑contained control panel for configuring and running a multi‑armed bandit "pizzeria" demo.
*
* Users can:
* - Choose the environment (Bernoulli/Gaussian)
* - Set number of actions ("toppings"), number of iterations ("customers"), and an optional RNG seed
* - Select built‑in algorithms and/or uploaded custom algorithms
* - Upload a new custom algorithm (which is immediately selectable)
* - See inline help/algorithm info via accessible toggle buttons
* - Start a run; results are emitted via the `onPlayStarted` callback
*
* Accessibility notes
* - Each info toggle uses proper aria-expanded and aria-controls that target a unique id
* - The info content is injected via `dangerouslySetInnerHTML`; content is trusted/curated strings
*
* Error handling
* - API errors are routed through ToastProvider and normalized with `formatError`
*/


// Built‑in algorithms visible in the UI
const ALL_ALGOS = [
  { key: 'greedy', label: 'Greedy (min)' },
  { key: 'epsilon_greedy', label: 'Epsilon-Greedy (min)' },
  { key: 'ucb1', label: 'UCB1 (adv)' },
  { key: 'thompson', label: 'Thompson Sampling (adv)' },
]

// Small HTML snippets explaining each algorithm rendered into collapsible panels
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

export function Controls({
  onPlayStarted,
}: { onPlayStarted?: (playCtx: PlayCtx) => void }) {
  // --- Core configuration state ---
  const [env, setEnv] = useState<EnvType>('bernoulli') // type of bandit environment
  const [nActions, setNActions] = useState(10)         // number of arms ("toppings")
  const [iterations, setIterations] = useState(50)     // number of steps ("customers")
  const [seed, setSeed] = useState<number>()           // optional RNG seed

  // Tracks which info panel (?) is open (one at a time); null = none
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  // Toast helpers for success/error feedback
  const { error, success } = useToast();


  // --- Algorithm selection state ---
  // Built‑ins: start with two common baselines preselected
  const [algos, setAlgos] = useState<string[]>(['greedy', 'epsilon_greedy'])
  // Uploaded custom algorithms list (fetched from API)
  const [uploaded, setUploaded] = useState<UploadedAlgorithm[]>([])
  const [selectedCustom, setSelectedCustom] = useState<string[]>([])

  // On mount, fetch the list of uploaded algorithms (ignore errors silently)
  useEffect(() => { listAlgorithms().then(setUploaded).catch(() => { }) }, [])

  /** Toggle a built‑in algorithm by key */
  function toggleAlgo(key: string) {
    setAlgos(s => s.includes(key) ? s.filter(x => x !== key) : [...s, key])
  }

  /** Toggle a custom uploaded algorithm by id */
  function toggleCustom(id: string) {
    setSelectedCustom(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  /**
  * When a new custom algorithm is uploaded:
  * - Insert/replace it at the top of the uploaded list
  * - Auto‑select it so it immediately appears checked in the UI above
  */
  function onUploadedAlgo(a: UploadedAlgorithm) {
    setUploaded(prev => [a, ...prev.filter(x => x.id !== a.id)])
    // instantly show & select the new checkbox
    setSelectedCustom(prev => prev.includes(a.id) ? prev : [a.id, ...prev])
  }

  /** Build a RunConfig object from current UI state */
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

  /**
  * Start a run with the current configuration. On success, notify parent with
  * the algorithms, n_actions, and returned server stream/data. Errors are surfaced via toasts.
  */
  async function onPlay() {
    const cfg = buildRunConfig()
    try {
      const s = await playStart({
        env: cfg.env,
        n_actions: cfg.n_actions,
        iterations: cfg.iterations,
        seed: cfg.seed,
        algorithms: algos
      })
      onPlayStarted?.({
        algorithms: algos,
        n_actions: nActions,
        data: s
      })
    }
    catch (e: any) {
      error(formatError(e));
    }
  }

  /** Open/close an info panel by key (acts like an accordion: only one open) */
  function toggleInfo(key: string) {
    setOpenInfo(prev => (prev === key ? null : key));
  }

  return (
    <div className="space-y-5 w-1xl">
      {/* Header with scenario help */}
      <div className="flex flex-wrap items-center">
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
              __html: `<p class="text-sm text-zinc-600">Choose how many <strong>topping options</strong> you offer and which <strong>recommendation strategies</strong> to try.</p>`,
            }}
          />
        )}
      </div>

      {/* Core numeric/environment controls */}
      <div className="grid grid-cols-2 gap-x-[4rem] gap-y-4 pb-5">
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
            min={2}
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

      {/* Algorithm selection: built‑ins plus (if any) uploaded customs */}
      <div>
        <div className="label mb-2">
          Algorithmen{" "}
          <span className="text-red-600" aria-hidden="true">*</span>
        </div>
        <div className="grid grid-cols-2 gap-2 items-start pb-5">
          {/* Built‑in cards with inline info toggles */}
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

              {/* Collapsible algorithm info */}
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

          {/* Uploaded algorithms (only shown after at least one upload) */}
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

      {/* Upload area with inline help */}
      <div className="mt-2 pb-5">
        <div className="flex flex-wrap items-center">
          <div className="text-lg font-semibold p-2">Upload algorithm</div>
          <button
            type="button"
            className="h-6 w-6 rounded-full border border-zinc-300 text-xs leading-6 text-zinc-600 hover:bg-zinc-100"
            title="Erklärung anzeigen"
            onClick={() => toggleInfo('upload')}
            aria-expanded={openInfo === 'upload'}
            aria-controls="algo-info-upload"
          >
            ?
          </button>
          {openInfo === 'upload' && (
            <div
              id="algo-info-upload"
              className="mt-2 rounded bg-zinc-50 p-3 text-sm basis-full"
              dangerouslySetInnerHTML={{
                __html: `<p class="text-sm text-zinc-600">
                  Bitte orientiere dich beim Implementieren an unserem Beispielalgorithmus auf GitHub,
                  im Ordner <strong>„Example Algorithm“</strong>.
                </p>`,
              }}
            />
          )}
        </div>

        {/* Inline uploader. once uploaded, its checkbox will appear above */}
        <CustomAlgoUpload onUploaded={onUploadedAlgo} />
      </div>

      {/* Run section */}
      <div className="space-y-3">
        <div className="flex gap-2 justify-center">
          <button className="btn-lg" onClick={onPlay}>Kunden bedienen</button>
        </div>
      </div>
    </div>
  )
}
