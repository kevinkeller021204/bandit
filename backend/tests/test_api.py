import pytest
from backend.app import app  # dein Quart-App-Objekt

@pytest.mark.asyncio
async def test_health_ok():
    client = app.test_client()
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = await resp.get_json()
    assert data["ok"] is True
    assert data["service"] == "epic-k-armed-bandit"
    assert "version" in data  # 1 laut Code

@pytest.mark.asyncio
async def test_play_start_and_step_bernoulli_happy_path():
    client = app.test_client()

    # Start-Session
    payload = {
        "env": "bernoulli",
        "n_actions": 3,
        "iterations": 5,
        "seed": 123,
    }
    resp = await client.post("/api/play/start", json=payload)
    assert resp.status_code == 200
    data = await resp.get_json()
    assert "session_id" in data and isinstance(data["session_id"], str)
    assert data["t"] == 0
    assert data["iterations"] == payload["iterations"]

    env = data["env"]
    assert env["type"] == "bernoulli"
    assert env["n_actions"] == payload["n_actions"]
    assert len(env["p"]) == payload["n_actions"]

    sid = data["session_id"]

    # Step-Schleife (immer Aktion 0)
    done = False
    for i in range(payload["iterations"]):
        step = await client.post("/api/play/step", json={"session_id": sid, "action": 0})
        assert step.status_code == 200
        sd = await step.get_json()
        assert sd["t"] == i + 1
        assert sd["action"] == 0
        assert sd["reward"] in (0.0, 1.0)  # Bernoulli
        assert "done" in sd
        # Bei Bernoulli setzt der Server "accepted"
        assert "accepted" in sd
        done = sd["done"]

    assert done is True  # nach iterations Durchläufen

@pytest.mark.asyncio
async def test_play_step_invalid_session_404():
    client = app.test_client()
    step = await client.post("/api/play/step", json={"session_id": "does-not-exist", "action": 0})
    assert step.status_code == 404
    data = await step.get_json()
    assert data.get("error") == "invalid session"

@pytest.mark.asyncio
async def test_play_step_action_out_of_range_400():
    client = app.test_client()

    # gültige Session starten
    start = await client.post("/api/play/start", json={"env": "gaussian", "n_actions": 4, "iterations": 2, "seed": 7})
    assert start.status_code == 200
    sid = (await start.get_json())["session_id"]

    # ungültige Aktion: == n_actions
    bad = await client.post("/api/play/step", json={"session_id": sid, "action": 4})
    assert bad.status_code == 400
    data = await bad.get_json()
    assert data.get("error") == "action out of range"
