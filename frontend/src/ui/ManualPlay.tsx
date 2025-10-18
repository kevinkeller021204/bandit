// src/ui/ManualPlay.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { EnvInfo, PlayCtx } from "@/types";
import { playLog, playReset, playStep } from "@/api";
import { scrollTo } from "@/utils/nav";
import { useTranslation } from "react-i18next";

/**
* ManualPlay
* ------------------------
* Interactive panel to "manually" pull arms (pick toppings) .
*
* Simplified design:
* - No local/demo environment, no RNG, no Gaussian sampling.
* - All state comes from the server via `playLog`, `playStep`, and `playReset`.
* - The component derives labels, progress, and quick feedback from that server truth.
*
* Responsibilities
* - Fetch the current session state (env, iterations, history) on mount/update.
* - Send steps to the server when a topping is clicked and append the returned event.
* - Reset input history on the server and re-sync when requested.
* - Bubble chronological events to the parent via `onSync` (for charts/KPIs).
*
* UX/Perf notes
* - The visible log is newest-first (easier to scan). We still provide chronological history upward.
* - Log is capped to 500 entries to bound DOM size.
* - Topping labels are generated from a static list and remain stable for a given `n_actions`.
*/

/** list of 100 topping base names used to generate N labels */
export const BASE_TOPPINGS = [
  "Ananas", "Salami", "Schinken", "Champignons", "Paprika", "Zwiebeln", "Oliven", "Thunfisch", "Peperoni", "Spinat",
  "Mais", "Artischocken", "Brokkoli", "Rucola", "Feta", "Mozzarella", "Parmesan", "Gorgonzola", "Cheddar", "Gouda",
  "Ricotta", "Burrata", "Pecorino", "Hähnchen", "Speck", "Prosciutto", "Salsiccia", "Chorizo", "Hackfleisch", "Rinderstreifen",
  "Lachs", "Garnelen", "Muscheln", "Sardellen", "Krabben", "Jalapeños", "Peperoncini", "Chili", "Knoblauch", "Getrocknete Tomaten",
  "Tomaten", "Kirschtomaten", "Kapern", "Aubergine", "Zucchini", "Rote Bete", "Kürbis", "Süßkartoffel", "Kartoffeln", "Trüffel",
  "Trüffelöl", "Basilikum", "Oregano", "Petersilie", "Koriander", "Ei", "Pinienkerne", "Walnüsse", "Haselnüsse", "Pistazien",
  "Mandeln", "Honig", "Birne", "Apfel", "Feige", "Trauben", "Mango", "BBQ-Soße", "Pesto", "Ajvar",
  "Hummus", "Crème fraîche", "Sour Cream", "Schmand", "Erbsen", "Edamame", "Kimchi", "Bresaola", "Mortadella", "Pancetta",
  "Gyros", "Kebab", "Pulled Pork", "Pulled Chicken", "Tofu", "Tempeh", "Seitan", "Vegane Wurst", "Veganer Käse", "Blauschimmelkäse",
  "Taleggio", "Provolone", "Emmentaler", "Bergkäse", "Camembert", "Brie", "Ziegenkäse", "Schafskäse", "Lauch", "Frühlingszwiebeln",
  "Rauchlachs", "Kaviar", "Kapernäpfel", "Röstzwiebeln", "Knuspriger Knoblauch", "Salsa Verde", "Salsa Picante", "Chipotle", "Sriracha", "Harissa",
  "Rosenkohl", "Grüner Spargel", "Weißer Spargel", "Lauchzwiebelöl", "Knoblauchöl", "Chimichurri", "Rote Zwiebeln", "Pfefferoni", "Maiscreme", "Ricotta-Zitrone"
] as const;

export type ToppingBase = typeof BASE_TOPPINGS[number];

/**
 * Build N topping labels by cycling BASE_TOPPINGS and suffixing duplicates 
 * e.g. ["Ananas","Salami","Ananas 2","Salami 2",…]
 * Comment: limited toppings to 100 to avoid duplicates
 */
export function buildToppings(total: number, base = BASE_TOPPINGS): string[] {
  const result: string[] = [];
  const counts = new Map<string, number>();
  const n = base.length;

  for (let i = 0; i < total; i++) {
    const name = base[i % n];
    const next = (counts.get(name) ?? 0) + 1;
    counts.set(name, next);
    result.push(next === 1 ? name : `${name} ${next}`);
  }
  return result;
}

function sampleNormal(rand: () => number, mean = 0, std = 1) {
  const u = 1 - rand(), v = 1 - rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + std * z;
}

type ManualPlayProps = {
  playCtx: PlayCtx
  mode?: "auto" | "backend" | "local";
  onClose?: () => void;
  onEvent?: (ev: { t: number; action: number; reward: number; accepted?: boolean }) => void;
  onSync?: (hist: Array<{ t: number; action: number; reward: number; accepted?: boolean }>) => void;
  resetPlay: () => void
}

export default function ManualPlay({
  playCtx,
  mode = "auto",
  onClose,
  onEvent,
  onSync,
  resetPlay
}: ManualPlayProps) {
  const { t } = useTranslation();

  // ---- derive inputs from playCtx (backend only) ----
  const sessionId = playCtx.data.session_id;
  const nActions = playCtx.n_actions;

  // ---- local UI state ----
  const [backendEnv, setBackendEnv] = useState<EnvInfo | null>(null);
  const [iterations, setIterations] = useState<number>(playCtx.data.iterations ?? 0);
  const [tstep, setTstep] = useState<number>(1); // current timestep (1-based)
  const [log, setLog] = useState<{ t: number; a: number; r: number; ok?: boolean }[]>([]); // newest first
  const [last, setLast] = useState<{ t: number; a: number; r: number; ok?: boolean } | null>(null);
  const [showTruth, setShowTruth] = useState(false); // reveals env params per topping
  const [loading, setLoading] = useState(false);
  const onSyncRef = useRef<typeof onSync>();
  useEffect(() => { onSyncRef.current = onSync }, [onSync]);

  // ---- initial sync from server ----
  useEffect(() => {
    let cancel = false;
    async function init() {
      if (!sessionId) return;
      try {
        const info = await playLog(sessionId);
        if (cancel) return;

        const env = info.env.type === "bernoulli"
          ? { type: "bernoulli" as const, n_actions: info.env.n_actions, p: info.env.p ?? [] }
          : { type: "gaussian" as const, n_actions: info.env.n_actions, means: info.env.means ?? [], stds: info.env.stds ?? [] };

        setBackendEnv(env);
        setIterations(info.iterations);
        setTstep(Math.max(1, info.t + 1));

        const uiHist = [...info.history].reverse().map(h => ({
          t: h.t, a: h.action, r: h.reward, ok: h.accepted,
        }));
        setLog(uiHist);
        setLast(uiHist[0] ?? null);

        const chrono = [...info.history].map(h => ({
          t: h.t, action: h.action, reward: h.reward, accepted: h.accepted,
        })).sort((a, b) => a.t - b.t);
        onSync?.(chrono);
      } catch (e) {
        console.error("playLog failed:", e);
      }
    }
    init();
    return () => { cancel = true; };
  }, [sessionId]);

  // ---- derived UI helpers ----
  const N = backendEnv?.n_actions ?? nActions;
  const toppings = useMemo(() => buildToppings(N), [N]);
  const T = iterations;

  /** Handle a user picking arm */
  async function pick(a: number) {
    if (!sessionId || !backendEnv) return;
    if (tstep > T) return;

    try {
      setLoading(true);
      const res = await playStep(sessionId, a);
      const item = { t: res.t, a, r: res.reward, ok: res.accepted };
      setLog(prev => [item, ...prev].slice(0, 500));
      setLast(item);
      setTstep(res.t + 1);

      onEvent?.({ t: res.t, action: a, reward: res.reward, accepted: res.accepted });
    } catch (e) {
      console.error("playStep failed:", e);
    } finally {
      setLoading(false);
    }
  }

  /** Reset only the interaction history on the **server**, then re-sync */
  async function reset() {
    if (!sessionId) return;
    try {
      setLoading(true);
      await playReset(sessionId);
      const info = await playLog(sessionId);

      setIterations(info.iterations);
      setTstep(Math.max(1, info.t + 1));
      const uiHist = [...info.history].reverse().map(h => ({ t: h.t, a: h.action, r: h.reward, ok: h.accepted }));
      setLog(uiHist);
      setLast(uiHist[0] ?? null);

      const chrono = info.history.map(h => ({ t: h.t, action: h.action, reward: h.reward, accepted: h.accepted }));
      onSync?.(chrono);
    } catch (e) {
      console.error("reset failed:", e);
    } finally {
      setLoading(false);
    }
  }

  /** Reset the entire session (parent-owned) and navigate back to selection */
  function resetHard() {
    resetPlay();
    scrollTo("selection");
  }

  const envKind: "bernoulli" | "gaussian" =
    (backendEnv?.type ?? (playCtx.data.env.type as "bernoulli" | "gaussian"));

  const sessionMissing = !sessionId;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-lg font-semibold">{t('manual.title')}</div>
          <p className="text-sm text-zinc-600">
            {sessionMissing ? t('manual.local') : t('manual.live')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-600">
            {t('manual.customersShort', { current: Math.min(tstep, T), total: T })}
          </span>
          <button className="btn" onClick={reset} disabled={loading || sessionMissing}>
            {t('manual.resetInput')}
          </button>
          <button className="btn" onClick={resetHard} disabled={loading}>
            {t('manual.resetSession')}
          </button>
          {onClose && (
            <button className="btn" onClick={onClose}>
              {t('a11y.dismiss')}
            </button>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="rounded border border-zinc-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">{t('manual.toppings')}</div>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={showTruth}
              onChange={e => setShowTruth(e.target.checked)}
            />
            {t('manual.showTruth')}
          </label>
        </div>

        {/* Topping grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 ">
          {Array.from({ length: N }).map((_, i) => {
            const truth =
              backendEnv?.type === "bernoulli" ? backendEnv.p?.[i] :
                backendEnv?.type === "gaussian" ? backendEnv.means?.[i] :
                  undefined;

            return (
              <button
                key={i}
                onClick={() => pick(i)}
                disabled={tstep > T}
                className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-60 truncate"
                title={toppings[i]}
              >
                <div className="font-medium">{toppings[i]}</div>
                {showTruth && truth != null && (
                  <div className="text-xs text-zinc-600">
                    {envKind === "bernoulli"
                      ? t('manual.pApprox', { v: truth.toFixed(2) })
                      : t('manual.muApprox', { v: truth.toFixed(2) })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick feedback cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded border border-zinc-200 bg-white p-3">
          <div className="text-sm text-zinc-600">{t('manual.lastChoice')}</div>
          <div className="mt-1 text-lg font-semibold">{last ? toppings[last.a] : '—'}</div>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-3">
          <div className="text-sm text-zinc-600">{t('manual.outcome')}</div>
          <div className="mt-1 text-lg font-semibold">
            {!last ? '—' :
              envKind === 'bernoulli'
                ? (last.ok ? t('manual.accepted') : t('manual.skipped'))
                : last.r.toFixed(3)}
          </div>
        </div>
        <div className="rounded border border-zinc-200 bg-white p-3">
          <div className="text-sm text-zinc-600">{t('manual.reward')}</div>
          <div className="mt-1 text-lg font-semibold">
            {last ? (envKind === 'bernoulli' ? last.r : last.r.toFixed(3)) : '—'}
          </div>
        </div>
      </div>

      {/* Event log (newest first) */}
      <div className="rounded border border-zinc-200 bg-white p-3">
        <div className="mb-2 font-semibold">{t('manual.eventLog')}</div>
        <div className="h-[26rem] overflow-auto text-sm leading-6">
          {log.length === 0 ? (
            <div className="text-zinc-500">{t('manual.noEvents')}</div>
          ) : (
            log.map(e => (
              <div key={`${e.t}-${e.a}`} className="border-b border-zinc-100 last:border-0">
                <span className="text-zinc-500">t={e.t}</span>{' • '}
                <span>{toppings[e.a]}</span>{' • '}
                {envKind === "bernoulli"
                  ? <span>
                    {e.ok ? t('manual.acceptedRaw') : t('manual.skippedRaw')}
                    {' '}
                    ({t('manual.rewardEq', { v: e.r })})
                  </span>
                  : <span>{t('manual.rewardEq', { v: e.r.toFixed(3) })}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
