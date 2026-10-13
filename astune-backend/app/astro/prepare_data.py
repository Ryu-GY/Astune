"""Download the local ephemeris once; API requests never download files."""
from skyfield.api import Loader
from app.core.config import get_settings
from app.astro.engine import AstronomyEngine, EngineConfig


def main() -> None:
    path = get_settings().astro_ephemeris_abspath
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        if path.name != "de421.bsp":
            raise ValueError("Install a custom ephemeris manually at ASTRO_EPHEMERIS_PATH")
        ephemeris = Loader(str(path.parent))(path.name)
        ephemeris.close()
    engine = AstronomyEngine(EngineConfig(catalog_path=get_settings().astro_catalog_abspath, ephemeris_path=path))
    try:
        coverage = engine.preflight()
        print(f"Ephemeris verified: {path.name}, {coverage['start_tdb']} to {coverage['end_tdb']} TDB")
    finally:
        engine.close()


if __name__ == "__main__":
    main()
