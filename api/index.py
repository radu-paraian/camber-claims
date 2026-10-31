"""
Vercel Serverless Python Entrypoint (`api/index.py`).
Exports the FastAPI `app` instance from `backend.main`.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.main import app

__all__ = ["app"]
