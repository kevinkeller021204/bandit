from __future__ import annotations
import random
import uuid
from dataclasses import dataclass
from typing import List, Dict, Literal, Optional
import math
import sys
from quart import Quart, jsonify, request, send_from_directory
from quart_cors import cors
from pydantic import BaseModel, Field, ValidationError
import os
import json, zipfile, importlib.util, hashlib, shutil



r'''
              .7
            .'/
           / /
          / /
         / /
        / /
       / /
      / /
     / /         
    / /          
  __|/
,-\__\
|f-"Y\|
\()7L/
 cgD                            __ _
 |\(                          .'  Y '>,
  \ \                        / _   _   \
   \\\                       )(_) (_)(|}
    \\\                      {  4A   } /
     \\\                      \uLuJJ/\l
      \\\                     |3    p)/
       \\\___ __________      /nnm_n//
       c7___-__,__-)\,__)(".  \_>-<_/D
                  //V     \_"-._.__G G_c__.-__<"/ ( \
                         <"-._>__-,G_.___)\   \7\
                        ("-.__.| \"<.__.-" )   \ \
                        |"-.__"\  |"-.__.-".\   \ \
                        ("-.__"". \"-.__.-".|    \_\
                        \"-.__""|!|"-.__.-".)     \ \
                         "-.__""\_|"-.__.-"./      \ l
                          ".__""">G>-.__.-">       .--,_
                              ""  G'''


BASE = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
def find_frontend_dir():
    candidates = []

    # 1) PyInstaller temp dir (Onefile)
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(os.path.join(meipass, "frontend_dist"))

    # 2) Neben der ausführbaren Datei (Onefile ohne --add-data, wie bei dir)
    exe_dir = os.path.dirname(os.path.abspath(getattr(sys, "executable", __file__)))
    candidates.append(os.path.join(exe_dir, "frontend_dist"))

    # 3) Neben der .py-Datei (Dev-Run)
    file_dir = os.path.dirname(os.path.abspath(__file__))
    candidates.append(os.path.join(file_dir, "frontend_dist"))

    # 4) Optional: Override per ENV
    env_dir = os.getenv("FRONTEND_DIR")
    if env_dir:
        candidates.insert(0, env_dir)

    for path in candidates:
        if path and os.path.isdir(path):
            return path
    return None

FRONTEND_DIR = find_frontend_dir()
EXEC_DIR = os.path.dirname(os.path.abspath(getattr(sys, "executable", __file__)))
ALGO_DIR = os.environ.get("ALGO_DIR") or os.path.join(EXEC_DIR, "alg_store")
os.makedirs(ALGO_DIR, exist_ok=True)


class BanditEnvBase:
    #base class (bp)
    def __init__(self, n_actions: int, seed: Optional[int] = None):
        self.n_actions = n_actions
        self._rng = random.Random(seed)
        self.reset()

    def reset(self) -> None:
        pass

    def step(self, action: int) -> float:
        raise NotImplementedError

    def info(self) -> dict:
        return { "n_actions": self.n_actions }


class BernoulliBanditEnv(BanditEnvBase):
    #documentation will be added, still mock probs
    def reset(self) -> None:
        # Mock success probabilities for demonstration
        self.p = [self._rng.uniform(0.1, 0.9) for _ in range(self.n_actions)]

    def step(self, action: int) -> float:
        # Mock reward: 1 with prob p[action], else 0
        return 1.0 if self._rng.random() < self.p[action] else 0.0

    def info(self) -> dict:
        base = super().info()
        base.update({"type": "bernoulli", "p": self.p})
        return base


class GaussianBanditEnv(BanditEnvBase):
    def reset(self) -> None:
        #random Mittelwerte zwischen -1 und 1
        self.means = [self._rng.uniform(-1.0, 1.0) for _ in range(self.n_actions)]
        #random Standardabweichungen zwischen 0.1 und 1.0
        self.stds  = [self._rng.uniform(0.1, 1.0) for _ in range(self.n_actions)]

    def step(self, action: int) -> float:
        m = self.means[action]
        s = self.stds[action]
        #reward ~ Normalverteilung mit Mittelwert m und Standardabweichung s
        return self._rng.gauss(m, s)

    def info(self) -> dict:
        base = super().info()
        base.update({
            "type": "gaussian",
            "means": self.means,
            "stds": self.stds
        })
        return base



# ----------------- Algorithms -------------------------- # 
#                                                         #
#                                                         #
#---------------------------------------------------------#

class AlgorithmBase:

    name: str = "AlgorithmBase"

    def __init__(self, n_actions: int, seed: Optional[int] = None):
        self.n_actions = n_actions
        self._rng = random.Random(seed)

    def select_action(self) -> int:
        #placeholder 
        return self._rng.randrange(self.n_actions)

    def update(self, action: int, reward: float) -> None:
        pass


class Greedy(AlgorithmBase):
    name = "Greedy"

    def __init__(self, n_actions: int, seed: Optional[int] = None):
        super().__init__(n_actions, seed)
        self.q_values = [0.0] * n_actions
        self.counts = [0] * n_actions

    def select_action(self) -> int:
        max_q = max(self.q_values)
        candidates = [i for i, q in enumerate(self.q_values) if q == max_q]
        return self._rng.choice(candidates)

    def update(self, action: int, reward: float) -> None:
        self.counts[action] += 1
        n = self.counts[action]
        self.q_values[action] += (reward - self.q_values[action]) / n


class EpsilonGreedy(AlgorithmBase):
    name = "Epsilon-Greedy"

    def __init__(self, n_actions: int, seed: Optional[int] = None, epsilon: float = 0.1):
        super().__init__(n_actions, seed)
        self.epsilon = epsilon
        self.q_values = [0.0] * n_actions
        self.counts = [0] * n_actions

    def select_action(self) -> int:
        if self._rng.random() < self.epsilon:
            return self._rng.randrange(self.n_actions)
        max_q = max(self.q_values)
        candidates = [i for i, q in enumerate(self.q_values) if q == max_q]
        return self._rng.choice(candidates)

    def update(self, action: int, reward: float) -> None:
        self.counts[action] += 1
        n = self.counts[action]
        self.q_values[action] += (reward - self.q_values[action]) / n


class UCB1(AlgorithmBase):
    name = "UCB1"

    def __init__(self, n_actions: int, seed: Optional[int] = None):
        super().__init__(n_actions, seed)
        self.q_values = [0.0] * n_actions
        self.counts = [0] * n_actions
        self.total_steps = 0

    def select_action(self) -> int:
        self.total_steps += 1
        for i in range(self.n_actions):
            if self.counts[i] == 0:
                return i
        ucb_values = [
            self.q_values[i] + math.sqrt(2.0 * math.log(self.total_steps) / self.counts[i])
            for i in range(self.n_actions)
        ]

        max_ucb = max(ucb_values)
        candidates = [i for i, val in enumerate(ucb_values) if val == max_ucb]
        return self._rng.choice(candidates)

    def update(self, action: int, reward: float) -> None:
        self.counts[action] += 1
        n = self.counts[action]
        self.q_values[action] += (reward - self.q_values[action]) / n


class ThompsonSampling(AlgorithmBase):
    name = "Thompson Sampling"

    def __init__(self, n_actions: int, seed: Optional[int] = None):
        super().__init__(n_actions, seed)
        #will add doc
        self.successes = [1] * n_actions
        self.failures = [1] * n_actions

    def select_action(self) -> int:
        samples = [self._rng.betavariate(self.successes[i], self.failures[i]) for i in range(self.n_actions)]
        max_sample = max(samples)
        candidates = [i for i, s in enumerate(samples) if s == max_sample]
        return self._rng.choice(candidates)

    def update(self, action: int, reward: float) -> None:
        if reward == 1:
            self.successes[action] += 1
        else:
            self.failures[action] += 1



ALGOS = {
    "greedy": Greedy,
    "epsilon_greedy": EpsilonGreedy,
    "ucb1": UCB1,
    "thompson": ThompsonSampling
}

# ----------------- API ----------------- #
#                                         #
#                                         #
#                                         #
# ----------------------------------------# 

EnvType = Literal["bernoulli", "gaussian"]

class RunRequest(BaseModel):
    env: EnvType
    n_actions: int = Field(ge=2, le=100)
    iterations: int = Field(ge=1, le=50_000)
    algorithms: List[str] = Field(default_factory=lambda: ["greedy", "epsilon_greedy"])
    seed: Optional[int] = None
    custom_algorithms: Optional[List[str]] = None  # NEW


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(ROOT, "frontend_dist") 

class CustomAlgoWrapper(AlgorithmBase):
    name = "Custom"

    def __init__(self, n_actions: int, seed: Optional[int], entry_fn):
        super().__init__(n_actions, seed)
        self._entry = entry_fn
        self._t = 0
        self._last_action: Optional[int] = None
        self._last_reward: Optional[float] = None
        self._seed = seed

    def select_action(self) -> int:
        state = {
            "n_actions": self.n_actions,
            "t": self._t,
            "last_action": self._last_action,
            "last_reward": self._last_reward,
            "seed": self._seed,
        }
        try:
            a = int(self._entry(state))
        except Exception as e:
            raise RuntimeError(f"Custom algorithm error at t={self._t}: {e}")
        return max(0, min(self.n_actions - 1, a))

    def update(self, action: int, reward: float) -> None:
        self._last_action = int(action)
        self._last_reward = float(reward)
        self._t += 1

app = cors(Quart(__name__), allow_origin="*", allow_headers="*", allow_methods=["GET", "POST", "OPTIONS"])
# (Optional) keep this for safety, but it’s no longer needed for init-time routing:
app.config["PROVIDE_AUTOMATIC_OPTIONS"] = True


def make_env(env_type: EnvType, n_actions: int, seed: Optional[int]) -> BanditEnvBase:
    if env_type == "bernoulli":
        return BernoulliBanditEnv(n_actions, seed=seed)
    return GaussianBanditEnv(n_actions, seed=seed)

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def _find_main_py(root: str) -> str | None:
    # prefer common names
    for cand in ("main.py", "algo.py", "algorithm.py"):
        p = os.path.join(root, cand)
        if os.path.isfile(p):
            return cand
    # else first .py anywhere
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if fn.endswith(".py"):
                return os.path.relpath(os.path.join(dirpath, fn), root)
    return None

def _load_meta(aid: str) -> dict | None:
    p = os.path.join(ALGO_DIR, aid, "meta.json")
    if os.path.isfile(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def _import_callable(module_path: str, func_name: str):
    """Import function from an absolute file path."""
    mod_name = "custom_algo_" + os.path.basename(os.path.dirname(module_path)).replace("-", "_")
    spec = importlib.util.spec_from_file_location(mod_name, module_path)
    if not spec or not spec.loader:
        raise RuntimeError("Failed to create module spec for custom algorithm")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[attr-defined]
    fn = getattr(mod, func_name, None)
    if not callable(fn):
        raise RuntimeError(f"Entry function '{func_name}' not found in '{module_path}'")
    return fn


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
async def serve_frontend(path: str):
    if not FRONTEND_DIR:
        return "Frontend fehlt. Gesucht in _MEIPASS, neben der Binary und neben app.py.", 500
    full = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(full):
        return await send_from_directory(FRONTEND_DIR, path)
    return await send_from_directory(FRONTEND_DIR, "index.html")

@app.get("/api/health")
async def health():
    return jsonify({"ok": True, "service": "epic-k-armed-bandit", "version": 1})


@app.post("/api/run")
async def run_experiment():
    try:
        payload = await request.get_json() or {}
        cfg = RunRequest(**payload)
    except ValidationError:
        cfg = RunRequest(env="bernoulli", n_actions=5, iterations=50, algorithms=[])

    env = make_env(cfg.env, cfg.n_actions, cfg.seed)

    # Build algorithm set: built-ins + custom uploads
    builtins: Dict[str, AlgorithmBase] = {
        key: ALGOS[key](cfg.n_actions, seed=cfg.seed)
        for key in (cfg.algorithms or [])
        if key in ALGOS
    }

    customs: Dict[str, AlgorithmBase] = {}
    if getattr(cfg, "custom_algorithms", None):
        for aid in cfg.custom_algorithms:
            meta = _load_meta(aid)
            if not meta:
                continue
            module_path = os.path.join(ALGO_DIR, aid, meta.get("module", "main.py"))
            try:
                entry_fn = _import_callable(module_path, meta.get("entry", "run"))
            except Exception as e:
                # skip broken custom algo but keep running others
                print(f"[custom:{aid}] load failed: {e}", file=sys.stderr)
                continue
            label = f"custom:{meta.get('name', aid)}"
            customs[label] = CustomAlgoWrapper(cfg.n_actions, cfg.seed, entry_fn)

    algs: Dict[str, AlgorithmBase] = {**builtins, **customs}

    #line stays at zero when user picks no algorithm
    if not algs:
        iterations = cfg.iterations
        traces = {
            "empty_trace": {
                "actions": list(range(iterations)),
                "rewards": [0.0] * iterations
            }
        }
        summary = {
            "empty_trace": {
                "mean_reward": 0.0,
                "final_avg_reward": 0.0
            }
        }
        return jsonify({
            "env": env.info(),
            "iterations": iterations,
            "traces": traces,
            "summary": summary
        })

    traces: Dict[str, Dict[str, list]] = {
        name: {"rewards": [], "actions": []} for name in algs.keys()
    }

    for t in range(cfg.iterations):
        for name, algo in algs.items():
            try:
                a = algo.select_action()
                r = env.step(a)
                algo.update(a, r)
            except Exception as e:
                # if an algo errors mid-run, record a safe fallback and continue
                print(f"[algo {name}] t={t} error: {e}", file=sys.stderr)
                a, r = 0, 0.0
            traces[name]["actions"].append(a)
            traces[name]["rewards"].append(r)

    summary: Dict[str, dict] = {}
    for name, data in traces.items():
        rewards = data["rewards"]
        if rewards:
            cum = 0.0
            last_avg = 0.0
            for i, v in enumerate(rewards, start=1):
                cum += v
                last_avg = cum / i
            mean = cum / len(rewards)
        else:
            mean = last_avg = 0.0
        summary[name] = {"mean_reward": mean, "final_avg_reward": last_avg}

    return jsonify({
        "env": env.info(),
        "iterations": cfg.iterations,
        "traces": traces,
        "summary": summary,
    })
    
@app.post("/api/algorithms")
async def api_upload_algorithm():
    """
    Multipart form:
      file: .py or .zip
      meta: JSON { name, language:'python', entry:'run', sha256 }
    Stores under ALGO_DIR/<id>/ and returns { id, name, language, entry }.
    """
    files = await request.files
    form  = await request.form
    f = files.get("file")
    meta_raw = form.get("meta") or "{}"
    try:
        meta = json.loads(meta_raw)
    except Exception:
        return jsonify({"error": "Invalid meta JSON"}), 400

    if not f:
        return jsonify({"error": "file missing"}), 400

    name = (meta.get("name") or f.filename or "custom").strip()
    entry = (meta.get("entry") or "run").strip()
    aid = uuid.uuid4().hex
    out_dir = os.path.join(ALGO_DIR, aid)
    os.makedirs(out_dir, exist_ok=True)

    # Save original
    orig_path = os.path.join(out_dir, f.filename)
    await f.save(orig_path)  # Quart's FileStorage supports await save()

    # If zip → extract
    module_rel: Optional[str] = None
    if orig_path.lower().endswith(".zip"):
        with zipfile.ZipFile(orig_path, "r") as z:
            z.extractall(out_dir)
        # allow manifest.json to override entry/module
        mpath = os.path.join(out_dir, "manifest.json")
        if os.path.isfile(mpath):
            try:
                m = json.load(open(mpath, "r", encoding="utf-8"))
                entry = (m.get("entry") or entry).strip()
                module_rel = m.get("module")  # optional e.g. "my_agent.py"
            except Exception:
                pass
        if not module_rel:
            module_rel = _find_main_py(out_dir)
    else:
        # single .py → use that as module
        module_rel = os.path.basename(orig_path)

    if not module_rel:
        shutil.rmtree(out_dir, ignore_errors=True)
        return jsonify({"error": "No Python file found in upload"}), 400

    digest = sha256_file(orig_path)
    claimed = (meta.get("sha256") or "").lower().strip()
    if claimed and claimed != digest:
        # not fatal, but report mismatch
        return jsonify({"error": "sha256 mismatch", "have": digest, "want": claimed}), 400

    meta_out = {
        "id": aid,
        "name": name,
        "language": "python",
        "entry": entry,
        "module": module_rel.replace("\\", "/"),
        "sha256": digest,
    }
    with open(os.path.join(out_dir, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta_out, fh)

    # minimal response for your UI
    return jsonify({k: meta_out[k] for k in ("id", "name", "language", "entry", "sha256")}), 201


@app.get("/api/algorithms")
async def api_list_algorithms():
    items = []
    for aid in os.listdir(ALGO_DIR):
        meta = _load_meta(aid)
        if meta:
            items.append({k: meta[k] for k in ("id", "name", "language", "entry", "sha256") if k in meta})
    # newest first
    items.sort(key=lambda m: m.get("id", ""), reverse=True)
    return jsonify(items)



#dont change port, if ngrok throws an error ask kevin or chatgpt, probable cause in index.ts 
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050)