"""Shared catalog access for the Skyfield calculation core."""
from app.astro.catalog import load_bright_star_catalog
from app.core.config import get_settings


def load_catalog():
    return load_bright_star_catalog(str(get_settings().astro_catalog_abspath))