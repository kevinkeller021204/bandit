import math
from backend.app import Greedy, EpsilonGreedy, UCB1, ThompsonSampling

def test_greedy_update_and_select():
    algo = Greedy(3, seed=0)
    for _ in range(5):
        algo.update(0, 1.0)
    assert algo.counts[0] == 5
    assert math.isclose(algo.q_values[0], 1.0, rel_tol=1e-9, abs_tol=1e-12)
    # Only arm 0 has max Q
    assert algo.select_action() == 0

def test_epsilon_greedy_with_zero_epsilon_is_pure_greedy():
    algo = EpsilonGreedy(2, seed=0, epsilon=0.0)
    algo.q_values = [0.2, 0.7]
    for _ in range(5):
        assert algo.select_action() == 1

def test_ucb1_initial_explores_each_arm_once():
    algo = UCB1(3, seed=0)
    # While any arm has count 0, it should return that arm (in order)
    assert algo.select_action() == 0
    algo.update(0, 0.0)
    assert algo.select_action() == 1
    algo.update(1, 0.0)
    assert algo.select_action() == 2

def test_thompson_sampling_update_counters():
    algo = ThompsonSampling(2, seed=0)
    s0, f0 = algo.successes[0], algo.failures[0]
    algo.update(0, 1.0)
    assert algo.successes[0] == s0 + 1
    algo.update(0, 0.0)
    assert algo.failures[0] == f0 + 1
    a = algo.select_action()
    assert 0 <= a < 2

