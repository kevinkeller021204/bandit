import pytest
from backend.app import app  # tests live in backend/, so import directly

@pytest.mark.asyncio
async def test_health_ok():
    client = app.test_client()
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = await resp.get_json()
    assert data["ok"] is True
    assert data["service"] == "epic-k-armed-bandit"
    assert "version" in data

@pytest.mark.asyncio
async def test_run_fallback_on_validation_error():
    client = app.test_client()
    # Bad env → triggers ValidationError branch → fallback config with empty_trace
    resp = await client.post("/api/run", json={"env": "not-a-real-env"})
    assert resp.status_code == 200
    data = await resp.get_json()

    assert data["iterations"] == 50   # fallback iterations
    assert "empty_trace" in data["traces"]
    rewards = data["traces"]["empty_trace"]["rewards"]
    assert len(rewards) == 50
    assert set(rewards) == {0.0}

@pytest.mark.asyncio
async def test_run_bernoulli_two_algos_shapes_and_types():
    client = app.test_client()
    payload = {
        "env": "bernoulli",
        "n_actions": 3,
        "iterations": 20,
        "algorithms": ["greedy", "epsilon_greedy"],
        "seed": 123,
    }
    resp = await client.post("/api/run", json=payload)
    assert resp.status_code == 200
    data = await resp.get_json()

    env = data["env"]
    assert env["type"] == "bernoulli"
    assert env["n_actions"] == 3
    assert len(env["p"]) == 3

    for name in payload["algorithms"]:
        assert name in data["traces"]
        assert len(data["traces"][name]["actions"]) == payload["iterations"]
        assert len(data["traces"][name]["rewards"]) == payload["iterations"]
        # Bernoulli rewards must be 0/1
        assert set(data["traces"][name]["rewards"]).issubset({0.0, 1.0})

@pytest.mark.asyncio
async def test_run_gaussian_three_algos_shapes():
    client = app.test_client()
    payload = {
        "env": "gaussian",
        "n_actions": 4,
        "iterations": 15,
        "algorithms": ["ucb1", "thompson", "gradient"],
        "seed": 7,
    }
    resp = await client.post("/api/run", json=payload)
    assert resp.status_code == 200
    data = await resp.get_json()

    env = data["env"]
    assert env["type"] == "gaussian"
    assert len(env["means"]) == 4
    assert len(env["stds"]) == 4

    for name in payload["algorithms"]:
        assert name in data["traces"]
        assert len(data["traces"][name]["actions"]) == payload["iterations"]
        assert len(data["traces"][name]["rewards"]) == payload["iterations"]
        assert all(isinstance(x, float) for x in data["traces"][name]["rewards"])
