/**
 * api.js – Centralised fetch helpers for the Ransomware Evolution Tracker.
 * Change API_BASE to point to your FastAPI server.
 */

const API_BASE = "http://localhost:8000";

/**
 * Core fetch wrapper with loading state & error handling.
 * @param {string} path - API path (e.g. "/api/sheets")
 * @returns {Promise<any>}
 */
async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Endpoint wrappers ────────────────────────────────────────────────────────

/** Returns { sheets: [...] } */
const getSheets = () => apiFetch("/api/sheets");

/** Returns { sheet, count, data: [...] } */
const getSheet = (name) => apiFetch(`/api/sheet/${encodeURIComponent(name)}`);

/** Returns { families: [...] } */
const getFamilies = () => apiFetch("/api/families");

/**
 * Returns combined family data object keyed by sheet name.
 * Each value is an array of matching rows.
 */
const getFamily = (name) => apiFetch(`/api/family/${encodeURIComponent(name)}`);

/** Returns dashboard statistics object */
const getStats = () => apiFetch("/api/stats");

// ── UI Helpers ───────────────────────────────────────────────────────────────

/**
 * Show a spinner inside `container` while `asyncFn` runs.
 * Replaces container contents during load.
 */
async function withSpinner(container, asyncFn, label = "Loading data…") {
  container.innerHTML = `
    <div class="spinner-wrap">
      <div class="spinner"></div>
      <p class="spinner-text">${label}</p>
    </div>`;
  try {
    return await asyncFn();
  } catch (err) {
    container.innerHTML = `
      <div class="error-banner">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <strong>Failed to load data</strong><br>
          <span>${err.message}</span><br>
          <span style="font-size:12px;opacity:0.7">Make sure the FastAPI backend is running at ${API_BASE}</span>
        </div>
      </div>`;
    throw err;
  }
}

/**
 * Render an empty-state message into a container.
 */
function renderEmpty(container, msg = "No data available.") {
  container.innerHTML = `<div class="no-data">${msg}</div>`;
}

/**
 * Build a simple sortable/filterable HTML table from an array of objects.
 * Returns the <table> element.
 */
function buildTable(rows, opts = {}) {
  if (!rows || rows.length === 0) return null;

  const {
    columns = Object.keys(rows[0]),   // subset of columns to show
    linkCol = null,                    // column name → link
    linkHref = null,                   // (row) => href string
    badgeCol = null,                   // column to render as badge
    badgeFn  = null,                   // (val) => badge class
    maxCellLen = 120,                  // truncate long cell text
  } = opts;

  const table = document.createElement("table");

  // thead
  const thead = table.createTHead();
  const hrow  = thead.insertRow();
  columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col;
    th.innerHTML += ` <span class="sort-icon">↕</span>`;
    th.dataset.col = col;
    hrow.appendChild(th);
  });

  // tbody
  const tbody = table.createTBody();
  rows.forEach(row => {
    const tr = tbody.insertRow();
    columns.forEach(col => {
      const td = tr.insertCell();
      let val = row[col] ?? "";

      if (badgeCol && col === badgeCol && badgeFn) {
        td.innerHTML = `<span class="badge ${badgeFn(val)}">${val || "—"}</span>`;
      } else if (linkCol && col === linkCol && linkHref) {
        const href = linkHref(row);
        td.innerHTML = `<a href="${href}" class="text-orange">${escHtml(String(val))}</a>`;
      } else {
        const display = String(val).length > maxCellLen
          ? String(val).slice(0, maxCellLen) + "…"
          : String(val);
        td.textContent = display || "—";
      }
    });
  });

  // Sort on header click
  hrow.querySelectorAll("th").forEach((th, i) => {
    let asc = true;
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      const sorted = Array.from(tbody.rows).sort((a, b) => {
        const av = a.cells[i].textContent.toLowerCase();
        const bv = b.cells[i].textContent.toLowerCase();
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      sorted.forEach(r => tbody.appendChild(r));
      asc = !asc;
      hrow.querySelectorAll("th").forEach(h => h.classList.remove("sorted"));
      th.classList.add("sorted");
    });
  });

  return table;
}

/** Escape HTML special chars */
function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render a raw cell value with:
 *  - \n → <br> (preserves lines starting with "- ")
 *  - https?:// URLs → clickable <a> links
 *  - HTML escaping on non-URL text
 * Returns an HTML string safe for innerHTML.
 */
function renderCellValue(val) {
  const str = String(val ?? "").trim();
  if (!str || str === "-") return "<span style='color:var(--text-light)'>—</span>";

  const lines = str.split(/\r?\n/);
  const rendered = lines.map(line => {
    line = line.trim();
    if (!line) return null;

    // Split on URLs (capture group keeps URL in array)
    const parts = line.split(/(https?:\/\/[^\s,;"<>\[\]]+)/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // URL part — escape and wrap in <a>
        const url = part
          .replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      }
      // Text part — just escape
      return part
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }).join("");
  }).filter(l => l !== null);

  return rendered.length ? rendered.join("<br>") : "<span style='color:var(--text-light)'>—</span>";
}

/**
 * Determine badge class from Empirical Validation value.
 */
function validationBadge(val) {
  const v = (val || "").toLowerCase();
  if (v.includes("github")) return "badge-manual";
  if (v === "-" || v === "") return "badge-unknown";
  return "badge-sandbox";
}

function validationLabel(val) {
  const v = (val || "").toLowerCase();
  if (v.includes("github")) return "Manual (GitHub)";
  if (v === "-" || v === "") return "Unknown";
  return "Sandbox";
}

/**
 * Highlight differences across columns in a compare table.
 * `cells` is an array of <td> elements in the same attribute row.
 */
function highlightDiffs(cells) {
  const vals = cells.map(c => c.textContent.trim());
  const unique = new Set(vals.filter(v => v && v !== "—"));
  if (unique.size > 1) {
    cells.forEach(c => c.classList.add("diff-highlight"));
  }
}

// ── Nav active link ──────────────────────────────────────────────────────────
function markActiveNav() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll(".nav-links a").forEach(a => {
    const href = a.getAttribute("href")?.replace(/\/$/, "") || "";
    if (
      (path === "" || path === "/" || path.endsWith("/index.html")) && (href === "/" || href.endsWith("index.html")) ||
      (href !== "/" && href !== "" && path.includes(href.replace(".html", "")))
    ) {
      a.classList.add("active");
    }
  });
}

// Run on every page
document.addEventListener("DOMContentLoaded", markActiveNav);
