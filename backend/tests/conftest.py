# Wird von pytest automatisch vor den Tests geladen.
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[2]  # .../bandit
sys.path.insert(0, str(ROOT))