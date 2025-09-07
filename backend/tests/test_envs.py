from app import BernoulliBanditEnv, GaussianBanditEnv, make_env

def test_make_env_types():
    assert isinstance(make_env("bernoulli", 2, 0), BernoulliBanditEnv)
    assert isinstance(make_env("gaussian", 2, 0), GaussianBanditEnv)

def test_bernoulli_env_step_and_info():
    env = BernoulliBanditEnv(n_actions=4, seed=42)
    # p list is created in reset()
    assert len(env.p) == 4
    vals = [env.step(0) for _ in range(20)]
    assert set(vals).issubset({0.0, 1.0})
    info = env.info()
    assert info["type"] == "bernoulli"
    assert len(info["p"]) == 4
    assert info["n_actions"] == 4

def test_gaussian_env_step_and_info():
    env = GaussianBanditEnv(n_actions=3, seed=42)
    vals = [env.step(2) for _ in range(10)]
    assert all(isinstance(v, float) for v in vals)
    info = env.info()
    assert info["type"] == "gaussian"
    assert len(info["means"]) == 3 and len(info["stds"]) == 3
    assert info["n_actions"] == 3
