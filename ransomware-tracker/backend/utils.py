"""
utils.py – Data caching and Excel parsing helpers.

Reads the Excel workbook once at startup, normalises every sheet into a
list-of-dicts, and exposes fast in-memory lookup helpers.
"""

import re
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from collections import Counter

import pandas as pd

logger = logging.getLogger(__name__)

# Sheets we intentionally skip (rough / scratch sheet)
IGNORED_SHEETS = {"list"}

# The sheet that acts as the master family registry
OVERVIEW_SHEET = "overview"

# Column expected in every sheet that identifies the ransomware family
FAMILY_COL_CANDIDATES = ["family", "name", "ransomware", "ransomware family"]


def _normalise_key(key: str) -> str:
    """Lowercase + strip whitespace for dictionary look-up."""
    return str(key).lower().strip()


def _format_year_value(val: str) -> str:
    """
    Convert any date-like string in the Year column to 'MMM YYYY' format.
    Handles: '2013-01-01 00:00:00', '2013-01-01', 'January 2013', 'Jan 2013', '2013'.
    Returns the value unchanged if it cannot be parsed.
    """
    val = val.strip()
    if not val or val == "-":
        return val

    # ISO datetime / date strings produced by pandas (dtype=str on date cells)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(val, fmt).strftime("%b %Y")
        except ValueError:
            pass

    # Full month name, e.g. "January 2013"
    try:
        return datetime.strptime(val, "%B %Y").strftime("%b %Y")
    except ValueError:
        pass

    # Already abbreviated, e.g. "Jan 2013" — normalise capitalisation
    try:
        return datetime.strptime(val, "%b %Y").strftime("%b %Y")
    except ValueError:
        pass

    # Bare year like "2013" or "2013.0"
    m = re.search(r"\b(19|20)\d{2}\b", val)
    if m:
        return m.group(0)

    return val


def _find_family_col(columns: List[str]) -> Optional[str]:
    """Return the column name that holds the family identifier."""
    for col in columns:
        if _normalise_key(col) in FAMILY_COL_CANDIDATES:
            return col
    return None


class DataCache:
    """Holds all sheet data in memory and provides lookup helpers."""

    def __init__(self):
        # Raw data: {normalised_sheet_name: [row_dict, ...]}
        self.data: Dict[str, List[Dict[str, Any]]] = {}
        # Map normalised → original sheet name
        self._sheet_name_map: Dict[str, str] = {}
        # Sorted list of family names (from Overview)
        self.family_names: List[str] = []

    # ── Loading ───────────────────────────────────────────────────────────────

    def load(self, path: str) -> None:
        """Read all sheets from the Excel file and cache them."""
        try:
            # read_excel with sheet_name=None returns {sheet_name: DataFrame}
            raw: Dict[str, pd.DataFrame] = pd.read_excel(
                path, sheet_name=None, dtype=str
            )
        except FileNotFoundError:
            logger.error(f"Excel file not found: {path}")
            return
        except Exception as exc:
            logger.error(f"Failed to read Excel file: {exc}")
            return

        self.data = {}
        self._sheet_name_map = {}

        for sheet_name, df in raw.items():
            norm = _normalise_key(sheet_name)
            if norm in IGNORED_SHEETS:
                logger.info(f"Skipping sheet: {sheet_name}")
                continue

            # Fill NaN → empty string, then convert to list of dicts
            records = df.fillna("").to_dict(orient="records")

            # Strip whitespace from all string values
            cleaned = []
            for row in records:
                stripped = {k: (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
                # Normalise any "Year" column to "MMM YYYY" format
                for col in list(stripped.keys()):
                    if col.strip().lower() == "year" and isinstance(stripped[col], str):
                        stripped[col] = _format_year_value(stripped[col])
                cleaned.append(stripped)

            self.data[norm] = cleaned
            self._sheet_name_map[norm] = sheet_name
            logger.info(f"Loaded sheet '{sheet_name}': {len(cleaned)} rows")

        # Populate family names from Overview sheet
        self._index_families()

    def _index_families(self) -> None:
        """Build the sorted family name list from the Overview sheet."""
        overview = self.data.get(OVERVIEW_SHEET, [])
        if not overview:
            logger.warning("Overview sheet not found or empty.")
            self.family_names = []
            return

        col = _find_family_col(list(overview[0].keys())) if overview else None
        if not col:
            logger.warning("Could not find Family column in Overview sheet.")
            self.family_names = []
            return

        names = sorted(
            {row[col].strip() for row in overview if row.get(col, "").strip()},
            key=str.lower,
        )
        self.family_names = names

    # ── Accessors ─────────────────────────────────────────────────────────────

    @property
    def sheet_names(self) -> List[str]:
        """Return original sheet names in the order they were loaded."""
        return list(self._sheet_name_map.values())

    def get_sheet(self, name: str) -> Optional[List[Dict[str, Any]]]:
        """Return all rows for a sheet (case-insensitive)."""
        return self.data.get(_normalise_key(name))

    def get_family(self, family_name: str) -> Optional[Dict[str, Any]]:
        """
        Return a dict keyed by sheet name, each value being the matching row(s)
        for the given family across all sheets.
        """
        target = family_name.strip().lower()
        result: Dict[str, Any] = {}
        found_in_any = False

        for norm_sheet, rows in self.data.items():
            if not rows:
                continue
            col = _find_family_col(list(rows[0].keys()))
            if not col:
                continue

            matches = [
                r for r in rows if r.get(col, "").strip().lower() == target
            ]
            original_sheet = self._sheet_name_map.get(norm_sheet, norm_sheet)
            result[original_sheet] = matches if matches else []
            if matches:
                found_in_any = True

        return result if found_in_any else None

    # ── Statistics ────────────────────────────────────────────────────────────

    def compute_stats(self) -> Dict[str, Any]:
        """Compute dashboard statistics from cached data."""
        overview = self.data.get(OVERVIEW_SHEET, [])
        if not overview:
            return {}

        total = len(overview)
        manual = sandbox = unknown = 0

        year_counter: Counter = Counter()
        family_col = _find_family_col(list(overview[0].keys())) if overview else None

        for row in overview:
            ev = row.get("Empirical Validation", row.get("empirical validation", "")).lower()
            if "github" in ev:
                manual += 1
            elif ev.strip() == "-" or ev.strip() == "":
                unknown += 1
            else:
                sandbox += 1

            # Year distribution — handles "2013", "2013.0", or "January 2013"
            year_val = row.get("Year", row.get("year", "")).strip()
            if year_val and year_val != "":
                try:
                    year_counter[int(float(year_val))] += 1
                except ValueError:
                    m = re.search(r'\b(19|20)\d{2}\b', year_val)
                    if m:
                        year_counter[int(m.group(0))] += 1

        # Top encryption algorithms from Encryption sheet
        enc_rows = self.data.get("encryption", [])
        enc_counter: Counter = Counter()
        for row in enc_rows:
            # Try common column names
            for col_key in ["Encryption", "encryption", "Algorithm", "algorithm",
                            "Encryption Algorithm", "Symmetric", "symmetric"]:
                val = row.get(col_key, "").strip()
                if val and val != "-":
                    # Split on common delimiters and count each algorithm
                    for part in re.split(r"[,/+&\n]", val):
                        part = part.strip()
                        if part and len(part) > 1:
                            enc_counter[part] += 1
                    break

        # Propagation methods from Propagation sheet
        prop_sheet_key = next(
            (k for k in self.data if "propagation" in k), None
        )
        prop_counter: Counter = Counter()
        if prop_sheet_key:
            for row in self.data[prop_sheet_key]:
                val = row.get("Propagation", "").strip()
                if val and val != "-":
                    for part in re.split(r"[,/\n]", val):
                        part = part.strip()
                        if part and len(part) > 1:
                            prop_counter[part] += 1

        # Anti-analysis from Anti Analysis sheet
        anti_sheet_key = next(
            (k for k in self.data if "anti" in k), None
        )
        anti_counter: Counter = Counter()
        if anti_sheet_key:
            for row in self.data[anti_sheet_key]:
                val = row.get("Anti Analysis", "").strip()
                if val and val != "-":
                    for part in re.split(r"[,/\n]", val):
                        part = part.strip()
                        if part and len(part) > 1:
                            anti_counter[part] += 1

        return {
            "total_families": total,
            "manual_validation": manual,
            "sandbox_validation": sandbox,
            "unknown_validation": unknown,
            "year_distribution": dict(sorted(year_counter.items())),
            "top_encryption": dict(enc_counter.most_common(12)),
            "top_propagation": dict(prop_counter.most_common(10)),
            "top_anti_analysis": dict(anti_counter.most_common(10)),
        }
