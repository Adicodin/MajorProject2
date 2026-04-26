/**
 * sheets.js – Raw sheet viewer page.
 * Populates sheet dropdown, fetches and renders selected sheet as table.
 */

let sheetRows = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Populate sheet selector
  const select = document.getElementById("sheet-select");
  try {
    const res = await getSheets();
    (res.sheets || []).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      select.appendChild(opt);
    });
  } catch (_) {}

  // Pre-select from URL param if present
  const params = new URLSearchParams(window.location.search);
  const preSheet = params.get("sheet");
  if (preSheet) {
    select.value = preSheet;
    loadSheet(preSheet);
  }

  select.addEventListener("change", () => {
    if (select.value) loadSheet(select.value);
  });

  document.getElementById("export-btn")?.addEventListener("click", exportCSV);
  document.getElementById("search-input")?.addEventListener("input", debounce(filterTable, 200));
});

async function loadSheet(name) {
  const wrap = document.getElementById("table-wrap");
  const info = document.getElementById("sheet-info");

  try {
    const res = await withSpinner(wrap, () => getSheet(name), `Loading sheet "${name}"…`);
    sheetRows = res.data || [];
    if (info) info.textContent = `${sheetRows.length} row${sheetRows.length !== 1 ? "s" : ""}`;
    renderSheetTable(sheetRows);
  } catch (_) {}
}

function renderSheetTable(rows) {
  const wrap = document.getElementById("table-wrap");
  if (!wrap) return;

  if (!rows.length) {
    wrap.innerHTML = '<div class="no-data">This sheet is empty.</div>';
    return;
  }

  const cols = Object.keys(rows[0]);
  let html = `<div class="table-wrapper"><table>
    <thead><tr>
      <th style="width:46px;text-align:center">#</th>
      ${cols.map(c => `<th data-col="${escHtml(c)}">${escHtml(c)} <span class="sort-icon">↕</span></th>`).join("")}
    </tr></thead>
    <tbody>`;

  rows.forEach((row, idx) => {
    html += "<tr>";
    // Row index
    html += `<td style="text-align:center;color:var(--text-light);font-family:var(--font-mono);font-size:12px;min-width:0;width:46px">${idx + 1}</td>`;
    cols.forEach(col => {
      const val = row[col] ?? "";
      html += `<td>${renderCellValue(val)}</td>`;
    });
    html += "</tr>";
  });

  html += "</tbody></table></div>";
  wrap.innerHTML = html;

  // Sort handlers (sort by raw text content)
  wrap.querySelectorAll("th[data-col]").forEach((th, idx) => {
    // idx here is 0-based over data cols; add 1 for the # column offset
    const colIdx = idx + 1;
    let asc = true;
    th.addEventListener("click", () => {
      const tbody = wrap.querySelector("tbody");
      const sorted = Array.from(tbody.rows).sort((a, b) => {
        const av = (a.cells[colIdx]?.textContent || "").toLowerCase();
        const bv = (b.cells[colIdx]?.textContent || "").toLowerCase();
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
      sorted.forEach(r => tbody.appendChild(r));
      asc = !asc;
      wrap.querySelectorAll("th").forEach(h => h.classList.remove("sorted"));
      th.classList.add("sorted");
    });
  });
}

function filterTable() {
  const q = (document.getElementById("search-input")?.value || "").toLowerCase();
  const filtered = sheetRows.filter(row =>
    Object.values(row).join(" ").toLowerCase().includes(q)
  );
  const info = document.getElementById("sheet-info");
  if (info) info.textContent = `${filtered.length} row${filtered.length !== 1 ? "s" : ""}`;
  renderSheetTable(filtered);
}

function exportCSV() {
  if (!sheetRows.length) return;
  const cols = Object.keys(sheetRows[0]);
  const lines = [cols.join(",")];
  sheetRows.forEach(row => {
    lines.push(cols.map(c => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  const name = document.getElementById("sheet-select")?.value || "sheet";
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url;
  a.download = `${name.replace(/\s+/g, "_")}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
