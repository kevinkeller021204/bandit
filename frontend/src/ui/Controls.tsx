// src/Controls.tsx
import { useEffect, useState } from 'react'
import type { RunConfig, EnvType, UploadedAlgorithm } from '@/types'
import { listAlgorithms } from '@/api'
import CustomAlgoUpload from './CustomAlgoUpload'
import { useI18n } from '../language/LanguageContext'

const ALL_ALGOS = [
  { key: 'greedy',          labelKey: 'algo.greedy' },
  { key: 'epsilon_greedy',  labelKey: 'algo.eps' },
  { key: 'ucb1',            labelKey: 'algo.ucb1' },
  { key: 'thompson',        labelKey: 'algo.ts' },
]

// (ALGO_INFO_HTML bleibt vorerst DE – kann später pro Sprache erweitert werden)
const ALGO_INFO_HTML: Record<string, string> = {
  greedy: `
  
      \section{Bernoulli-Bandit}

Der \textbf{Bernoulli-Bandit} beschreibt ein Entscheidungsmodell, bei dem mehrere Optionen mit unbekannter Erfolgswahrscheinlichkeit zur Auswahl stehen. Jede Option liefert bei einem Versuch entweder einen Erfolg (1) mit Wahrscheinlichkeit $p_i$ oder einen Misserfolg (0) mit Wahrscheinlichkeit $1 - p_i$. Ziel ist es, durch wiederholtes Ausprobieren die Option mit der höchsten Erfolgswahrscheinlichkeit zu identifizieren und bevorzugt zu wählen.

Der Bandit funktioniert, indem er bei jedem Durchlauf eine Option auswählt, das Ergebnis beobachtet und die geschätzte Wahrscheinlichkeit aktualisiert. Dabei steht er ständig vor der Entscheidung, ob er neue Optionen testet (Exploration) oder die aktuell beste nutzt (Exploitation). Mit jedem weiteren Versuch werden die Schätzungen präziser, bis sich das System automatisch auf die erfolgreichste Option einpendelt.</ul>
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
  const { t } = useI18n()
  const [env, setEnv] = useState<EnvType>('bernoulli')
  const [nActions, setNActions] = useState(10)
  const [iterations, setIterations] = useState(1000)
  const [seed, setSeed] = useState<number | ''>('' as any)
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  const [algos, setAlgos] = useState<string[]>(['greedy', 'epsilon_greedy'])
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
        <div className="text-lg font-semibold">{t('cfg.title')}</div>
        <p className="text-sm text-zinc-600">{t('cfg.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="label mb-1">{t('cfg.env')}</div>
          <select value={env} onChange={e => setEnv(e.target.value as EnvType)} className="input w-full">
            <option value="bernoulli">Bernoulli</option>
            <option value="gaussian">Gaussian</option>
          </select>
        </div>
        <div>
          <div className="label mb-1">{t('cfg.actions')}</div>
          <input type="number" className="input w-full" value={nActions} min={2} max={100}
                 onChange={e => setNActions(Number(e.target.value))} />
        </div>
        <div>
          <div className="label mb-1">{t('cfg.iterations')}</div>
          <input type="number" className="input w-full" value={iterations} min={1} max={50000}
                 onChange={e => setIterations(Number(e.target.value))} />
        </div>
        <div>
          <div className="label mb-1">{t('cfg.seed')}</div>
          <input type="number" className="input w-full" value={seed}
                 onChange={e => setSeed(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
      </div>

      <div>
        <div className="label mb-2">{t('cfg.algos')}</div>
        <div className="grid grid-cols-1 gap-2">
          {ALL_ALGOS.map(a => (
            <div key={a.key} className="rounded border border-zinc-200 p-2">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={algos.includes(a.key)}
                    onChange={() => toggleAlgo(a.key)}
                  />
                  <span>{t(a.labelKey)}</span>
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
              {openInfo === a.key && (
                <div
                  id={`algo-info-${a.key}`}
                  className="mt-2 rounded bg-zinc-50 p-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: ALGO_INFO_HTML[a.key] || '<em>Keine Beschreibung verfügbar.</em>' }}
                />
              )}
            </div>
          ))}

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

          <div className="mt-2">
            <CustomAlgoUpload onUploaded={onUploadedAlgo} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="label">{t('cfg.runSection')}</div>
        <button className="btn" onClick={run} disabled={disabled}>{t('cfg.runBtn')}</button>
      </div>
    </div>
  )
}
