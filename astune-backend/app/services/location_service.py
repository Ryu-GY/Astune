from collections import deque
from functools import cached_property, lru_cache
import csv
import json
from threading import Lock
from time import monotonic
import unicodedata
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from app.core.cache import TTLCache
from app.core.config import Settings, get_settings
from app.core.error_codes import ErrorCode
from app.core.exceptions import AppException, AstuneError
from app.schemas.location import LocationData, LocationRequest, ResolvedLocation
from app.schemas.preview import PreviewRequest

MANUAL_HINT = "위도·경도와 IANA 시간대를 직접 입력해 주세요."


def normalize_query(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def validate_timezone(value: str) -> str:
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise AstuneError(ErrorCode.TIMEZONE_NOT_FOUND, "유효한 IANA 시간대가 필요합니다.") from exc
    return value


class LocationResolver:
    def __init__(self, settings: Settings, *, client=None, clock=monotonic):
        self.settings = settings
        self.clock = clock
        self.cache = TTLCache(settings.location_cache_size, settings.location_cache_ttl, clock)
        self.timezone_cache = TTLCache(settings.location_cache_size, settings.location_cache_ttl, clock)
        self.client = client or httpx.Client(
            timeout=settings.geocoder_timeout,
            headers={"User-Agent": settings.geocoder_user_agent}, follow_redirects=False,
        )
        self._remote_lock = Lock()
        self._last_remote = float("-inf")
        self._daily_requests = deque()

    @cached_property
    def cities(self):
        path = self.settings.city_data_abspath
        try:
            if path.suffix == ".csv":  # Compatibility with an existing developer .env.
                with path.open(encoding="utf-8") as stream:
                    raw = list(csv.DictReader(stream))
            else:
                raw = json.loads(path.read_text(encoding="utf-8"))
            entries = []
            for row in raw:
                name = row["name"]
                country = row.get("country") or None
                location = ResolvedLocation(
                    source="city_table", city_name=name,
                    display_name=", ".join(part for part in (name, country) if part),
                    country_code=country, latitude=float(row["latitude"]), longitude=float(row["longitude"]),
                    timezone=validate_timezone(row["timezone"]), timezone_source="city_table",
                )
                tokens = tuple(normalize_query(value) for value in [name, *row.get("aliases", [])])
                entries.append((location, tokens))
            if not entries:
                raise ValueError("empty city table")
            return tuple(entries)
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise AppException(code=ErrorCode.CATALOG_NOT_READY, message="도시 사전을 읽을 수 없습니다.", status_code=503) from exc

    @cached_property
    def timezone_finder(self):
        from timezonefinder import TimezoneFinder
        return TimezoneFinder(in_memory=self.settings.timezonefinder_in_memory)

    def infer_timezone(self, latitude: float, longitude: float) -> str:
        def lookup():
            zone = self.timezone_finder.timezone_at_land(lat=latitude, lng=longitude)
            if not zone:
                raise AstuneError(ErrorCode.TIMEZONE_REQUIRED, "육지 시간대를 확인하지 못했습니다. " + MANUAL_HINT)
            return validate_timezone(zone)
        # Keep exact coordinates: rounding near a border could select the wrong zone.
        return self.timezone_cache.get_or_create((latitude, longitude), lookup)[0]

    def _local(self, query: str, country: str | None, exact: bool):
        return tuple(
            location for location, tokens in self.cities
            if (country is None or location.country_code == country)
            and any(query == token if exact else query in token for token in tokens)
        )[:10]

    def _external(self, query: str, country: str | None):
        if not self._remote_lock.acquire(blocking=False):
            raise AppException(code=ErrorCode.GEOCODER_RATE_LIMITED, message="잠시 후 다시 검색해 주세요.", status_code=429)
        try:
            now = self.clock()
            while self._daily_requests and self._daily_requests[0] <= now - 86400:
                self._daily_requests.popleft()
            if now - self._last_remote < 1.0 or len(self._daily_requests) >= 9500:
                raise AppException(code=ErrorCode.GEOCODER_RATE_LIMITED, message="검색 요청이 많습니다. " + MANUAL_HINT, status_code=429)
            self._last_remote = now
            self._daily_requests.append(now)
            params = {"name": query, "count": 10, "language": "en", "format": "json"}
            if country:
                params["countryCode"] = country
            response = self.client.get(self.settings.geocoder_url, params=params)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict) or not isinstance(data.get("results", []), list) or data.get("error"):
                raise ValueError("invalid geocoder response")
            items = []
            for row in data.get("results", [])[:10]:
                name = row["name"]
                latitude, longitude = float(row["latitude"]), float(row["longitude"])
                zone = validate_timezone(row["timezone"]) if row.get("timezone") else self.infer_timezone(latitude, longitude)
                items.append(ResolvedLocation(
                    source="geocoder", city_name=name,
                    display_name=", ".join(str(part) for part in (name, row.get("admin1"), row.get("country")) if part),
                    country_code=row.get("country_code"), latitude=latitude, longitude=longitude,
                    timezone=zone, timezone_source="geocoder",
                    attribution="Open-Meteo / GeoNames (CC BY 4.0) · https://open-meteo.com/en/docs/geocoding-api",
                ))
            return tuple(items)
        except (httpx.HTTPError, ValueError, KeyError, TypeError, AstuneError) as exc:
            raise AppException(code=ErrorCode.GEOCODER_UNAVAILABLE, message="외부 위치 검색을 사용할 수 없습니다. " + MANUAL_HINT, status_code=503) from exc
        finally:
            self._remote_lock.release()

    def search(self, request: LocationRequest, *, exact: bool = False) -> LocationData:
        if request.timezone:
            validate_timezone(request.timezone)
        key = (request.query and normalize_query(request.query), request.country_code, request.latitude,
               request.longitude, request.timezone, request.allow_external, exact)

        def resolve():
            if request.latitude is not None:
                zone = request.timezone or self.infer_timezone(request.latitude, request.longitude)
                return (ResolvedLocation(
                    source="coordinates", city_name=request.query, latitude=request.latitude,
                    longitude=request.longitude, timezone=zone,
                    timezone_source="manual" if request.timezone else "coordinates",
                ),)
            query = normalize_query(request.query)
            matches = self._local(query, request.country_code, exact)
            if not matches and request.allow_external and self.settings.geocoder_enabled:
                # Separate key lets preview and explicit search share upstream results.
                matches = self.cache.get_or_create(("external", query, request.country_code), lambda: self._external(query, request.country_code))[0]
            if request.timezone:
                matches = tuple(item.model_copy(update={"timezone": request.timezone, "timezone_source": "manual"}) for item in matches)
            return matches

        items, hit = self.cache.get_or_create(key, resolve)
        return LocationData(items=list(items[:request.limit]), cache_hit=hit)

    def close(self):
        self.client.close()


@lru_cache(maxsize=1)
def get_location_resolver() -> LocationResolver:
    return LocationResolver(get_settings())


def resolve_location(payload: PreviewRequest) -> ResolvedLocation:
    result = get_location_resolver().search(LocationRequest(
        query=payload.city_name, country_code=payload.country_code, latitude=payload.latitude,
        longitude=payload.longitude, timezone=payload.timezone, allow_external=payload.allow_external,
    ), exact=True)
    if not result.items:
        raise AppException(code=ErrorCode.CITY_NOT_FOUND, message="도시명을 찾지 못했습니다. " + MANUAL_HINT, status_code=404)
    if len(result.items) > 1:
        raise AppException(code=ErrorCode.CITY_AMBIGUOUS, message="동일한 이름의 도시가 있습니다. 위치 검색에서 좌표를 선택해 주세요.", status_code=409,
                           details={"items": [item.model_dump() for item in result.items]})
    return result.items[0]
