"""
Ransomware Evolution Tracker - FastAPI Backend
Reads MajorProj_Formatted.xlsx and exposes REST endpoints.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import logging

from utils import DataCache

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ransomware Evolution Tracker API",
    description="Serves ransomware family data parsed from Excel.",
    version="1.0.0",
)

# Allow the static frontend (served on any port) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Excel File Path ────────────────────────────────────────────────────────────
# The file is expected in the project root (one level above backend/)
EXCEL_PATH = Path(__file__).parent.parent / "MajorProj_Formatted.xlsx"

# ── Global Data Cache ──────────────────────────────────────────────────────────
cache = DataCache()


@app.on_event("startup")
def startup_event():
    """Load and cache all Excel sheet data at startup."""
    logger.info(f"Loading Excel file from: {EXCEL_PATH}")
    if not EXCEL_PATH.exists():
        logger.error(f"Excel file NOT found at {EXCEL_PATH}. API will return empty data.")
    cache.load(str(EXCEL_PATH))
    logger.info(f"Loaded sheets: {list(cache.data.keys())}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/sheets", summary="List all sheet names")
def get_sheets():
    """Returns list of available sheet names (excluding 'List')."""
    return {"sheets": cache.sheet_names}


@app.get("/api/sheet/{sheet_name}", summary="Get all rows from a sheet")
def get_sheet(sheet_name: str):
    """
    Returns all rows from the specified sheet as a JSON array of objects.
    Sheet names are case-insensitive.
    """
    rows = cache.get_sheet(sheet_name)
    if rows is None:
        raise HTTPException(status_code=404, detail=f"Sheet '{sheet_name}' not found.")
    return {"sheet": sheet_name, "count": len(rows), "data": rows}


@app.get("/api/family/{family_name}", summary="Get all data for a specific family")
def get_family(family_name: str):
    """
    Returns a combined JSON object with data from ALL sheets for the given
    ransomware family.  Matches against the 'Family' column (case-insensitive).
    """
    result = cache.get_family(family_name)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Family '{family_name}' not found.")
    return result


@app.get("/api/families", summary="List all family names")
def get_families():
    """Returns sorted list of all family names from the Overview sheet."""
    return {"families": cache.family_names}


@app.post("/api/reload", summary="Reload Excel file from disk")
def reload_data():
    """Development helper – re-reads the Excel file without restarting."""
    cache.load(str(EXCEL_PATH))
    return {"status": "reloaded", "sheets": cache.sheet_names}


@app.get("/api/stats", summary="Dashboard statistics")
def get_stats():
    """
    Returns high-level statistics used by the dashboard:
    - total families
    - manual validation count (Empirical Validation contains 'github')
    - sandbox count (does not contain 'github' and is not '-')
    - unknown count (value is '-')
    - year distribution
    - top encryption algorithms
    """
    return cache.compute_stats()


@app.get("/", summary="Health check")
def root():
    return {"status": "ok", "message": "Ransomware Evolution Tracker API running."}
