"""Deployment preflight: npm run backend:check (local files only)."""
import json

from app.services.preview_service import get_astronomy_engine


def main():
    engine = get_astronomy_engine()
    try:
        print(json.dumps(engine.preflight(), indent=2))
    finally:
        engine.close()


if __name__ == "__main__":
    main()
