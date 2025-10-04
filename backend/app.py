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

#!!keep allow origin!!, needed for further proxy config for package
app = cors(Quart(__name__), allow_origin="*")


def make_env(env_type: EnvType, n_actions: int, seed: Optional[int]) -> BanditEnvBase:
    if env_type == "bernoulli":
        return BernoulliBanditEnv(n_actions, seed=seed)
    return GaussianBanditEnv(n_actions, seed=seed)



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

    #line stays at zero when user picks no algorithm
    if not cfg.algorithms:
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

    algs: Dict[str, AlgorithmBase] = {
        key: ALGOS[key](cfg.n_actions, seed=cfg.seed) for key in cfg.algorithms if key in ALGOS
    }

    traces: Dict[str, Dict[str, list]] = {
        name: {"rewards": [], "actions": []} for name in algs.keys()
    }

    for t in range(cfg.iterations):
        for name, algo in algs.items():
            a = algo.select_action()
            r = env.step(a)
            algo.update(a, r)
            traces[name]["actions"].append(a)
            traces[name]["rewards"].append(r)

    summary = {}
    for name, data in traces.items():
        rewards = data["rewards"]
        cum = 0.0
        avg = []
        for i, v in enumerate(rewards, start=1):
            cum += v
            avg.append(cum / i)
        summary[name] = {
            "mean_reward": sum(rewards) / len(rewards) if rewards else 0.0,
            "final_avg_reward": avg[-1] if avg else 0.0,
        }

    return jsonify({
        "env": env.info(),
        "iterations": cfg.iterations,
        "traces": traces,
        "summary": summary,
    })


#dont change port, if ngrok throws an error ask kevin or chatgpt, probable cause in index.ts 
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050)