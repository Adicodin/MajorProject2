/**
 * database.js – Overview table with search, sort, filter, CSV export.
 * Features: row index, word-wrap, newline rendering, clickable links.
 */

let allRows      = [];
let filteredRows = [];
let currentPage  = 1;
const PAGE_SIZE  = 25;

document.addEventListener("DOMContentLoaded", async () => {
  const tableWrap = document.getElementById("table-wrap");

  try {
    const res = await withSpinner(tableWrap, () => getSheet("Overview"), "Loading ransomware database…");
    allRows      = res.data || [];
    filteredRows = [...allRows];
    renderTable();
    initControls();
  } catch (_) {}
});

// ── Controls ──────────────────────────────────────────────────────────────────
function initControls() {
  document.getElementById("search-input")?.addEventListener("input", debounce(applyFilters, 200));
  document.getElementById("validation-filter")?.addEventListener("change", applyFilters);
  document.getElementById("export-btn")?.addEventListener("click", exportCSV);
}

function applyFilters() {
  const q  = (document.getElementById("search-input")?.value || "").toLowerCase();
  const vf = document.getElementById("validation-filter")?.value || "all";

  filteredRows = allRows.filter(row => {
    const text = Object.values(row).join(" ").toLowerCase();
    if (q && !text.includes(q)) return false;

    if (vf !== "all") {
      const ev = (row["Empirical Validation"] || "").toLowerCase();
      if (vf === "manual"  && !ev.includes("github")) return false;
      if (vf === "sandbox" && (ev.includes("github") || ev === "-" || ev === "")) return false;
      if (vf === "unknown" && ev !== "-" && ev !== "") return false;
    }
    return true;
  });

  currentPage = 1;
  renderTable();
}

// ── Table Rendering ───────────────────────────────────────────────────────────
function renderTable() {
  const wrap    = document.getElementById("table-wrap");
  const countEl = document.getElementById("row-count");
  if (!wrap) return;

  if (!filteredRows.length) {
    wrap.innerHTML = '<div class="no-data">No matching families found.</div>';
    if (countEl) countEl.textContent = "0 results";
    renderPagination(0);
    return;
  }

  if (countEl) countEl.textContent = `${filteredRows.length} result${filteredRows.length !== 1 ? "s" : ""}`;

  const start    = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

  const allCols  = allRows.length ? Object.keys(allRows[0]) : [];
  const familyCol = allCols.find(c =>
    c.toLowerCase().includes("family") || c.toLowerCase() === "name"
  ) || "Family";

  // Build table — first column is row index #
  let html = `<div class="table-wrapper"><table>
    <thead><tr>
      <th style="width:46px;text-align:center">#</th>
      ${allCols.map(col => `<th data-col="${escHtml(col)}">${escHtml(col)} <span class="sort-icon">↕</span></th>`).join("")}
      <th style="width:80px">Details</th>
    </tr></thead>
    <tbody>`;

  pageRows.forEach((row, idx) => {
    html += "<tr>";

    // Index column
    html += `<td style="text-align:center;color:var(--text-light);font-family:var(--font-mono);font-size:12px;min-width:0;width:46px">${start + idx + 1}</td>`;

    allCols.forEach(col => {
      const val = row[col] ?? "";

      if (col === "Empirical Validation") {
        // Badge + clickable link if value contains a URL
        const badge   = `<span class="badge ${validationBadge(val)}">${escHtml(validationLabel(val))}</span>`;
        const hasUrl  = /https?:\/\//.test(String(val));
        const linkHtml = hasUrl
          ? `<div style="margin-top:5px;font-size:12px">${renderCellValue(val)}</div>`
          : "";
        html += `<td>${badge}${linkHtml}</td>`;

      } else if (col === familyCol) {
        html += `<td><strong>${escHtml(String(val))}</strong></td>`;

      } else if (col === "References") {
        // Always render as clickable links
        html += `<td style="min-width:160px">${renderCellValue(val)}</td>`;

      } else {
        // All other columns: render with newline + URL support, no truncation
        html += `<td>${renderCellValue(val)}</td>`;
      }
    });

    const name = row[familyCol] || "";
    html += `<td><a href="family.html?name=${encodeURIComponent(name)}" class="btn btn-sm btn-ghost">View →</a></td>`;
    html += "</tr>";
  });

  html += "</tbody></table></div>";
  wrap.innerHTML = html;

  // Attach sort handlers
  wrap.querySelectorAll("th[data-col]").forEach(th => {
    let asc = true;
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      filteredRows.sort((a, b) => {
        const av = String(a[col] ?? "").toLowerCase();
        const bv = String(b[col] ?? "").toLowerCase();
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      asc = !asc;
      wrap.querySelectorAll("th").forEach(h => h.classList.remove("sorted"));
      th.classList.add("sorted");
      currentPage = 1;
      renderTable();
    });
  });

  renderPagination(filteredRows.length);
}

// ── Pagination ────────────────────────────────────────────────────────────────
function renderPagination(total) {
  const pgWrap = document.getElementById("pagination");
  if (!pgWrap) return;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { pgWrap.innerHTML = ""; return; }

  let html = "";
  const addBtn = (label, page, disabled = false, active = false) => {
    html += `<button class="page-btn${active ? " active" : ""}"
               onclick="goPage(${page})"
               ${disabled ? "disabled style='opacity:0.4;cursor:not-allowed'" : ""}>
               ${label}</button>`;
  };

  addBtn("←", currentPage - 1, currentPage === 1);

  let s = Math.max(1, currentPage - 2);
  let e = Math.min(totalPages, currentPage + 2);
  if (s > 1) { addBtn(1, 1); if (s > 2) html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`; }
  for (let p = s; p <= e; p++) addBtn(p, p, false, p === currentPage);
  if (e < totalPages) { if (e < totalPages - 1) html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`; addBtn(totalPages, totalPages); }

  addBtn("→", currentPage + 1, currentPage === totalPages);

  pgWrap.innerHTML = html;
}

function goPage(p) {
  currentPage = p;
  renderTable();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.goPage = goPage;

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!filteredRows.length) return;
  const cols  = Object.keys(filteredRows[0]);
  const lines = [cols.join(",")];
  filteredRows.forEach(row => {
    lines.push(cols.map(c => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "ransomware_overview.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
