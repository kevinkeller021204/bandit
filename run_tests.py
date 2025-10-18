#!/usr/bin/env python3
"""
Run tests in a self-managed virtualenv:
- Creates .venv if missing
- Installs backend/requirements.txt
- Ensures pytest is installed
- Runs pytest with any args you pass (e.g. `python run_tests.py backend/tests/test_algos.py`)
"""

import os
import sys
import subprocess
import shutil
import platform
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV_DIR = ROOT / ".venv"
REQS = ROOT / "backend" / "requirements.txt"

IS_WINDOWS = platform.system().lower().startswith("win")
VENV_PY = VENV_DIR / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")
VENV_PIP = [str(VENV_PY), "-m", "pip"]

def step(msg):
    print(f"\n=== {msg} ===")

def run(cmd, **kwargs):
    print("  →", " ".join(cmd))
    return subprocess.check_call(cmd, **kwargs)

def ensure_venv():
    if VENV_PY.exists():
        step("Using existing virtualenv (.venv)")
        return
    step("Creating virtualenv (.venv)")
    run([sys.executable, "-m", "venv", str(VENV_DIR)])

def ensure_pip():
    step("Upgrading pip/setuptools/wheel")
    run(VENV_PIP + ["install", "--upgrade", "pip", "setuptools", "wheel"])

def ensure_requirements():
    if REQS.exists():
        step(f"Installing dependencies from {REQS.relative_to(ROOT)}")
        run(VENV_PIP + ["install", "-r", str(REQS)])
    else:
        step("No backend/requirements.txt found — skipping dependency install")

def ensure_pytest():
    step("Ensuring pytest is installed")
    try:
        run([str(VENV_PY), "-c", "import pytest; print(pytest.__version__)"])
    except subprocess.CalledProcessError:
        run(VENV_PIP + ["install", "pytest"])
        # async tests need pytest-asyncio; install if missing
        try:
            run([str(VENV_PY), "-c", "import pytest_asyncio"])
        except subprocess.CalledProcessError:
            run(VENV_PIP + ["install", "pytest-asyncio"])

def run_pytest():
    step("Running pytest")
    # Alles, was du an run_tests.py anhängst, wird an pytest durchgereicht:
    #   python run_tests.py backend/tests/test_algos.py -k greedy -q
    args = sys.argv[1:]
    cmd = [str(VENV_PY), "-m", "pytest"] + (args if args else [])
    return subprocess.call(cmd)

def main():
    # hübsche Header-Ausgabe
    in_venv = os.environ.get("VIRTUAL_ENV")
    print(f"Project root: {ROOT}")
    print(f"Python used to create venv: {sys.executable}")
    print(f"Existing venv: {'yes' if VENV_PY.exists() else 'no'}")
    print(f"Currently inside a venv: {'yes' if in_venv else 'no'}")

    ensure_venv()
    ensure_pip()
    ensure_requirements()
    ensure_pytest()
    code = run_pytest()

    if code == 0:
        print("\n✅  All tests passed!")
    else:
        print(f"\n❌  Tests failed with exit code {code}")
    sys.exit(code)

if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Command failed with exit code {e.returncode}")
        sys.exit(e.returncode)
