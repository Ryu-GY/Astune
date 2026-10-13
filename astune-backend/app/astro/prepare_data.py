"""Download the local ephemeris once; API requests never download files."""
from skyfield.api import Loader
from app.core.config import get_settings


def main() -> None:
    path = get_settings().astro_ephemeris_abspath
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        print(f"Ephemeris already available: {path}")
        return
    if path.name != "de421.bsp":
        raise ValueError("Install a custom ephemeris manually at ASTRO_EPHEMERIS_PATH")
    ephemeris = Loader(str(path.parent))(path.name)
    ephemeris.close()
    print(f"Ephemeris prepared: {path}")


if __name__ == "__main__":
    main()