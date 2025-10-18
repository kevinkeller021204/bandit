from __future__ import annotations
"""
app.py — Quart backend for the SliceWise bandit sandbox
------------------------------------------------------

Features
- Serves the React frontend (dev via Vite proxy, prod from `frontend_dist`)
- Exposes /api/play endpoints for a live, stateful bandit session (manual play)
- Exposes /api/plot to simulate/compare algorithms offline against the *same* env
- Supports uploading custom Python algorithms (.py / .zip) and wraps them

Architecture
- In-memory session store `PLAY` with TTL-based GC
- Two envs: Bernoulli and Gaussian (both seeded)
- Built-in algorithms: Greedy, ε-Greedy, UCB1, Thompson Sampling
- Custom algos loaded by function name from uploaded module (default `run`)
"""

import math
import os
import sys
import time
import json
import uuid
import shutil
import zipfile
import hashlib
import random
from typing import List, Dict, Literal, Optional
from dataclasses import dataclass

from quart import Quart, jsonify, request, send_from_directory, redirect
from quart_cors import cors
from pydantic import BaseModel, Field, ValidationError
import importlib.util

# -----------------------------------------------------------------------------
# Frontend location discovery (works for dev, PyInstaller onefile, and prod)
# -----------------------------------------------------------------------------

def find_frontend_dir():
    """Try multiple locations to find the built frontend directory.

    Order:
    1) Env override FRONTEND_DIR
    2) PyInstaller temp dir (sys._MEIPASS)/frontend_dist
    3) Folder next to executable (PyInstaller onefile)
    4) Folder next to this .py (dev run)
    """
    candidates = []

    env_dir = os.getenv("FRONTEND_DIR")
    if env_dir:
        candidates.append(env_dir)

    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(os.path.join(meipass, "frontend_dist"))

    exe_dir = os.path.dirname(os.path.abspath(getattr(sys, "executable", __file__)))
    candidates.append(os.path.join(exe_dir, "frontend_dist"))

    file_dir = os.path.dirname(os.path.abspath(__file__))
    candidates.append(os.path.join(file_dir, "frontend_dist"))

    for path in candidates:
        if path and os.path.isdir(path):
            return path
    return None

FRONTEND_DIR = find_frontend_dir()
EXEC_DIR = os.path.dirname(os.path.abspath(getattr(sys, "executable", __file__)))
ALGO_DIR = os.environ.get("ALGO_DIR") or os.path.join(EXEC_DIR, "alg_store")
os.makedirs(ALGO_DIR, exist_ok=True)

# -----------------------------------------------------------------------------
# Bandit Environments
# -----------------------------------------------------------------------------

class BanditEnvBase:
    """Base class. Subclasses implement `reset()`, `step()` and `info()`.

    - Keeps a `random.Random` seeded RNG for reproducibility
    - `info()` returns a JSON-serializable dict with parameters
    """

    def __init__(self, n_actions: int, seed: Optional[int] = None):
        self.n_actions = n_actions
        self._rng = random.Random(seed)
        self.reset()

    def reset(self) -> None:
        pass

    def step(self, action: int) -> float:
        raise NotImplementedError

    def info(self) -> dict:
        return {"n_actions": self.n_actions}


class BernoulliBanditEnv(BanditEnvBase):
    """Bernoulli arms with per-action success probabilities p[i] ∈ [0.1, 0.9]."""

    def reset(self) -> None:
        self.p = [self._rng.uniform(0.1, 0.9) for _ in range(self.n_actions)]

    def step(self, action: int) -> float:
        return 1.0 if self._rng.random() < self.p[action] else 0.0

    def info(self) -> dict:
        base = super().info()
        base.update({"type": "bernoulli", "p": self.p})
        return base


class GaussianBanditEnv(BanditEnvBase):
    """Gaussian arms with per-action mean μ ∈ [-1,1] and σ ∈ [0.1,1.0]."""

    def reset(self) -> None:
        self.means = [self._rng.uniform(-1.0, 1.0) for _ in range(self.n_actions)]
        self.stds = [self._rng.uniform(0.1, 1.0) for _ in range(self.n_actions)]

    def step(self, action: int) -> float:
        return self._rng.gauss(self.means[action], self.stds[action])

    def info(self) -> dict:
        base = super().info()
        base.update({"type": "gaussian", "means": self.means, "stds": self.stds})
        return base

# -----------------------------------------------------------------------------
# Algorithms — built-ins and a thin wrapper for custom upload
# -----------------------------------------------------------------------------

class AlgorithmBase:
    """Base policy: override select_action() and update()."""
    name: str = "AlgorithmBase"

    def __init__(self, n_actions: int, seed: Optional[int] = None):
        self.n_actions = n_actions
        self._rng = random.Random(seed)

    def select_action(self) -> int:
        # Placeholder: random / ε=1 policy
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
        # Try each arm once
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
        # Beta(1,1) priors (uniform) for Bernoulli rewards
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
    "thompson": ThompsonSampling,
}

# -----------------------------------------------------------------------------
# API models and session store
# -----------------------------------------------------------------------------

EnvType = Literal["bernoulli", "gaussian"]

class RunRequest(BaseModel):
    env: EnvType
    n_actions: int = Field(ge=2, le=100)
    iterations: int = Field(ge=1, le=50_000)
    algorithms: List[str] = Field(default_factory=lambda: ["greedy", "epsilon_greedy"], min_items=1)
    seed: Optional[int] = None
    custom_algorithms: Optional[List[str]] = None

class PlayStartReq(BaseModel):
    env: EnvType
    n_actions: int = Field(ge=2, le=100)
    iterations: int = Field(ge=1, le=10_000)
    algorithms: List[str] = Field(default_factory=lambda: ["greedy", "epsilon_greedy"], min_items=1)
    seed: Optional[int] = None

class PlayStepReq(BaseModel):
    session_id: str
    action: int = Field(ge=0)

class PlaySessionReq(BaseModel):
    session_id: str

class PlotReq(BaseModel):
    session_id: str
    algorithms: List[str] = Field(default_factory=list)
    custom_algorithms: Optional[List[str]] = None
    iterations: Optional[int] = None  # default: use session.iterations

class PlayResetReq(BaseModel):
    session_id: str

@dataclass
class PlaySession:
    id: str
    env: BanditEnvBase          # fixed env instance with p / means, stds
    iterations: int
    t: int
    history: list[dict]         # [{t, action, reward, accepted?}]
    last_access: float
    seed: Optional[int] = None

PLAY: dict[str, PlaySession] = {}
PLAY_TTL = 30 * 60  # 30 minutes


def _gc(now: float | None = None):
    """Garbage-collect expired sessions by last_access timestamp."""
    now = now or time.time()
    dead = [sid for sid, s in PLAY.items() if now - s.last_access > PLAY_TTL]
    for sid in dead:
        PLAY.pop(sid, None)

# -----------------------------------------------------------------------------
# Frontend serving (dev vs prod)
# -----------------------------------------------------------------------------

IS_DEV = os.environ.get("VITE_DEV", "0") == "1"
VITE_URL = os.environ.get("VITE_URL", "http://localhost:5173")

app = cors(Quart(__name__), allow_origin="*", allow_headers="*", allow_methods=["GET", "POST", "OPTIONS"])
app.config["PROVIDE_AUTOMATIC_OPTIONS"] = True


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
async def serve_frontend(path: str):
    """Serve React app.

    - DEV: redirect to Vite for HMR
    - PROD: serve from resolved FRONTEND_DIR with long cache for static assets
    """
    if IS_DEV:
        to = f"{VITE_URL}/{path}" if path else f"{VITE_URL}/"
        return redirect(to, code=307)  # 307 preserves method

    if not FRONTEND_DIR:
        return "Frontend fehlt. Gesucht in _MEIPASS, neben der Binary und neben app.py.", 500

    full = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(full):
        resp = await send_from_directory(FRONTEND_DIR, path)
        if any(path.endswith(ext) for ext in (".js", ".css", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2")):
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            resp.headers["Cache-Control"] = "no-cache"
        return resp

    resp = await send_from_directory(FRONTEND_DIR, "index.html")
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp

# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return jsonify({"ok": True, "service": "epic-k-armed-bandit", "version": 1})

# -----------------------------------------------------------------------------
# Play session API
# -----------------------------------------------------------------------------

def make_env(env_type: EnvType, n_actions: int, seed: Optional[int]) -> BanditEnvBase:
    return BernoulliBanditEnv(n_actions, seed) if env_type == "bernoulli" else GaussianBanditEnv(n_actions, seed)

@app.post("/api/play/start")
async def api_play_start():
    payload = await request.get_json() or {}
    try:
        req = PlayStartReq(**payload)
    except ValidationError as e:
        return jsonify({"error": "invalid payload", "detail": json.loads(e.json())}), 400

    env = make_env(req.env, req.n_actions, req.seed)
    sid = uuid.uuid4().hex
    PLAY[sid] = PlaySession(id=sid, env=env, iterations=req.iterations, t=0, history=[], last_access=time.time(), seed=req.seed)
    _gc()
    return jsonify({"session_id": sid, "env": env.info(), "t": 0, "iterations": req.iterations})

@app.post("/api/play/step")
async def api_play_step():
    payload = await request.get_json() or {}
    try:
        req = PlayStepReq(**payload)
    except ValidationError as e:
        return jsonify({"error": "invalid payload", "detail": json.loads(e.json())}), 400

    s = PLAY.get(req.session_id)
    if not s:
        return jsonify({"error": "invalid session"}), 404
    if req.action < 0 or req.action >= s.env.n_actions:
        return jsonify({"error": "action out of range"}), 400
    if s.t >= s.iterations:
        return jsonify({"t": s.t, "done": True}), 200

    r = s.env.step(int(req.action))
    s.t += 1
    s.last_access = time.time()
    ev = {"t": s.t, "action": int(req.action), "reward": float(r)}
    if s.env.info().get("type") == "bernoulli":
        ev["accepted"] = bool(r >= 1.0)
    s.history.append(ev)
    return jsonify({**ev, "done": s.t >= s.iterations})

@app.get("/api/play/log")
async def api_play_log():
    session_id = request.args.get("session_id") or ""
    s = PLAY.get(session_id)
    if not s:
        return jsonify({"error": "invalid session"}), 404
    s.last_access = time.time()
    return jsonify({"t": s.t, "iterations": s.iterations, "history": s.history, "env": s.env.info()})

@app.post("/api/play/end")
async def api_play_end():
    payload = await request.get_json() or {}
    try:
        req = PlaySessionReq(**payload)
    except ValidationError:
        return jsonify({"error": "invalid payload"}), 400
    ok = PLAY.pop(req.session_id, None) is not None
    _gc()
    return jsonify({"ok": ok})

@app.post("/api/play/reset")
async def api_play_reset():
    payload = await request.get_json() or {}
    try:
        req = PlayResetReq(**payload)
    except ValidationError:
        return jsonify({"error": "invalid payload"}), 400

    s = PLAY.get(req.session_id)
    if not s:
        return jsonify({"error": "invalid session"}), 404

    # keep the same environment; just clear progress
    s.t = 0
    s.history = []
    s.last_access = time.time()
    return jsonify({"ok": True, "t": 0})

# -----------------------------------------------------------------------------
# Plot API — batch simulate selected algorithms against the session's env
# -----------------------------------------------------------------------------

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _find_main_py(root: str) -> str | None:
    """Find a main module: prefer common names; fall back to first .py discovered."""
    for cand in ("main.py", "algo.py", "algorithm.py"):
        p = os.path.join(root, cand)
        if os.path.isfile(p):
            return cand
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
    """Import `func_name` from a Python source file at `module_path`."""
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


@app.post("/api/plot")
async def api_plot():
    payload = await request.get_json() or {}
    try:
        req = PlotReq(**payload)
    except ValidationError as e:
        return jsonify({"error": "invalid payload", "detail": json.loads(e.json())}), 400

    s = PLAY.get(req.session_id)
    if not s:
        return jsonify({"error": "invalid session"}), 404

    # Rebuild env with the *same parameters* but a deterministic RNG
    env_info = s.env.info()
    n_actions = int(env_info["n_actions"])
    env_type = env_info.get("type")
    seed = s.seed  # reuse session seed (may be None)

    if env_type == "bernoulli":
        env = BernoulliBanditEnv(n_actions, seed=seed)
        env.p = list(env_info["p"])  # reuse probabilities
    else:
        env = GaussianBanditEnv(n_actions, seed=seed)
        env.means = list(env_info["means"])
        env.stds = list(env_info["stds"])

    iterations = int(req.iterations or s.iterations)

    # Build algorithm set (built-ins + custom)
    builtins: Dict[str, AlgorithmBase] = {}
    errors: list[str] = []

    for key in (req.algorithms or []):
        if key not in ALGOS:
            errors.append(f"unknown algorithm '{key}' skipped")
            continue
        try:
            builtins[key] = ALGOS[key](n_actions, seed=seed)
        except Exception as e:
            errors.append(f"init '{key}' failed: {e}")

    customs: Dict[str, AlgorithmBase] = {}
    if req.custom_algorithms:
        for aid in req.custom_algorithms:
            meta = _load_meta(aid)
            if not meta:
                errors.append(f"custom id '{aid}' not found")
                continue
            module_path = os.path.join(ALGO_DIR, aid, meta.get("module", "main.py"))
            entry_name = meta.get("entry", "run")
            try:
                entry_fn = _import_callable(module_path, entry_name)
            except Exception as e:
                errors.append(f"[custom:{aid}] load '{entry_name}' failed: {e}")
                continue

            label = f"custom:{meta.get('name', aid)}"
            try:
                customs[label] = CustomAlgoWrapper(n_actions, seed, entry_fn)
            except Exception as e:
                errors.append(f"[custom:{aid}] wrapper failed: {e}")

    algs: Dict[str, AlgorithmBase] = {**builtins, **customs}

    # No algos selected → consistent empty trace
    if not algs:
        traces = {"empty_trace": {"actions": list(range(iterations)), "rewards": [0.0] * iterations}}
        summary = {"empty_trace": {"mean_reward": 0.0, "final_avg_reward": 0.0}}
        resp = {"env": env_info, "iterations": iterations, "traces": traces, "summary": summary}
        if errors:
            resp["warnings"] = errors
        return jsonify(resp)

    # Run batch
    traces: Dict[str, Dict[str, list]] = {name: {"rewards": [], "actions": []} for name in algs.keys()}
    for t in range(iterations):
        for name, algo in algs.items():
            try:
                a = algo.select_action()
                r = env.step(a)
                algo.update(a, r)
            except Exception as e:
                print(f"[algo {name}] t={t} error: {e}", file=sys.stderr)
                errors.append(f"[algo {name}] t={t} error: {e}")
                a, r = 0, 0.0
            traces[name]["actions"].append(int(a))
            traces[name]["rewards"].append(float(r))

    # Summary
    summary: Dict[str, dict] = {}
    for name, data_ in traces.items():
        rewards = data_["rewards"]
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

    resp = {"env": env_info, "iterations": iterations, "traces": traces, "summary": summary}
    if errors:
        resp["warnings"] = errors  # optional field: visible in Network tab
    return jsonify(resp)

# -----------------------------------------------------------------------------
# Custom algorithm upload API
# -----------------------------------------------------------------------------

class CustomAlgoWrapper(AlgorithmBase):
    """Adapter that calls a user-provided function(state) -> action.

    State passed to the function:
      { n_actions, t, last_action, last_reward, seed }
    """
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


@app.post("/api/algorithms")
async def api_upload_algorithm():
    """Upload a .py or .zip containing a custom algorithm.

    Multipart form fields:
      - file: uploaded file (.py or .zip)
      - meta: JSON { name, language:'python', entry:'run', sha256 }

    Stores under `ALGO_DIR/<id>/meta.json` and returns { id, name, language, entry, sha256 }.
    """
    files = await request.files
    form = await request.form
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

    # Save original upload
    orig_path = os.path.join(out_dir, f.filename)
    await f.save(orig_path)  # Quart FileStorage supports await save()

    # Extract if zip; otherwise use the single .py as module
    module_rel: Optional[str] = None
    if orig_path.lower().endswith(".zip"):
        with zipfile.ZipFile(orig_path, "r") as z:
            z.extractall(out_dir)
        # Optional manifest override
        mpath = os.path.join(out_dir, "manifest.json")
        if os.path.isfile(mpath):
            try:
                m = json.load(open(mpath, "r", encoding="utf-8"))
                entry = (m.get("entry") or entry).strip()
                module_rel = m.get("module")
            except Exception:
                pass
        if not module_rel:
            module_rel = _find_main_py(out_dir)
    else:
        module_rel = os.path.basename(orig_path)

    if not module_rel:
        shutil.rmtree(out_dir, ignore_errors=True)
        return jsonify({"error": "No Python file found in upload"}), 400

    digest = sha256_file(orig_path)
    claimed = (meta.get("sha256") or "").lower().strip()
    if claimed and claimed != digest:
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

    return jsonify({k: meta_out[k] for k in ("id", "name", "language", "entry", "sha256")}), 201


@app.get("/api/algorithms")
async def api_list_algorithms():
    items = []
    for aid in os.listdir(ALGO_DIR):
        meta = _load_meta(aid)
        if meta:
            items.append({k: meta[k] for k in ("id", "name", "language", "entry", "sha256") if k in meta})
    # newest first (ids are UUID hex; this is approximate ordering)
    items.sort(key=lambda m: m.get("id", ""), reverse=True)
    return jsonify(items)

# -----------------------------------------------------------------------------
# Entrypoint
# -----------------------------------------------------------------------------

# NOTE: Port must stay 5050 (the frontend expects it in some places)
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050)
