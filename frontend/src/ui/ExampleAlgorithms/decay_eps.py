# Decaying-epsilon greedy bandit agent.
# Exposes: run(state) -> int (action index)
# Expected state dict keys (per step):
#   n_actions: int
#   t: int                       # step number starting at 0
#   last_action: int | None      # action taken at t-1
#   last_reward: float | None    # reward observed at t-1
#   seed: int | None             # optional; only read on first call

import random

class Agent:
    def __init__(self, n_actions, eps_start=0.2, eps_end=0.01, decay=0.0005):
        self.n_actions = n_actions
        self.eps_start = eps_start
        self.eps_end   = eps_end
        self.decay     = decay
        self.counts = [0] * n_actions
        self.values = [0.0] * n_actions  # running averages

    def epsilon(self, t):
        # linear-ish decay (simple + robust)
        e = self.eps_start * (1.0 - self.decay * t)
        return self.eps_end if e < self.eps_end else e

    def select(self, t, rng):
        if rng.random() < self.epsilon(t):
            return rng.randrange(self.n_actions)
        # exploit
        return max(range(self.n_actions), key=lambda a: self.values[a])

    def update(self, a, r):
        self.counts[a] += 1
        c = self.counts[a]
        self.values[a] += (r - self.values[a]) / c

# module-level single agent so state persists across calls
_agent = None
_rng = random.Random()

def run(state: dict) -> int:
    """
    Return the action index to play on this step.
    Called once per environment step; we update with the previous outcome.
    """
    global _agent, _rng
    t = int(state["t"])
    if _agent is None:
        if "seed" in state and state["seed"] is not None:
            _rng.seed(int(state["seed"]))
        _agent = Agent(int(state["n_actions"]))

    # incorporate the outcome from the previous step
    if t > 0 and state.get("last_action") is not None and state.get("last_reward") is not None:
        _agent.update(int(state["last_action"]), float(state["last_reward"]))

    # choose the next action
    return int(_agent.select(t, _rng))