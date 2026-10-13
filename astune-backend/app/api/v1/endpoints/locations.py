from fastapi import APIRouter, Query

from app.schemas.location import LocationRequest, LocationResponse
from app.services.location_service import get_location_resolver

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/resolve", response_model=LocationResponse)
def search_local(q: str = Query(min_length=1, max_length=100)):
    # GET is always local and can safely be used for city suggestions.
    return LocationResponse(data=get_location_resolver().search(LocationRequest(query=q)))


@router.post("/resolve", response_model=LocationResponse)
def resolve(payload: LocationRequest):
    return LocationResponse(data=get_location_resolver().search(payload))
