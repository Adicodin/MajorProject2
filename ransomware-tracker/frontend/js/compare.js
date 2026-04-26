/**
 * compare.js – Side-by-side family comparison.
 * Supports 2–3 families. Dynamically shows all columns from all sheets.
 * Highlights differing cells.
 */

let families     = [];   // Array of names being compared
let familyData   = {};   // { name: data_object }
let allFamilyNames = []; // From /api/families

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await getFamilies();
    allFamilyNames = res.families || [];
  } catch (_) {}

  const saved = JSON.parse(localStorage.getItem("compareList") || "[]");
  families = saved.slice(0, 3);

  renderSlots();

  if (families.length >= 2) {
    await loadAndRender();
  }
});

// ── Slot UI ───────────────────────────────────────────────────────────────────
function renderSlots() {
  const wrap = document.getElementById("slots-wrap");
  if (!wrap) return;

  const MAX = 3;
  let html = "";

  for (let i = 0; i < MAX; i++) {
    const selected = families[i] || "";
    const opts = allFamilyNames.map(n =>
      `<option value="${escHtml(n)}" ${n === selected ? "selected" : ""}>${escHtml(n)}</option>`
    ).join("");

    html += `
      <div class="card" style="flex:1;min-width:200px">
        <div class="card-title">Family ${i + 1}</div>
        <select id="slot-${i}" onchange="onSlotChange(${i}, this.value)" style="width:100%">
          <option value="">— Select family —</option>
          ${opts}
        </select>
        ${selected ? `<div style="margin-top:10px"><a href="family.html?name=${encodeURIComponent(selected)}" class="text-sm" style="color:var(--orange)">View details →</a></div>` : ""}
        ${selected ? `<button class="btn btn-sm btn-secondary" style="margin-top:8px" onclick="removeFamily(${i})">Remove</button>` : ""}
      </div>`;
  }

  wrap.innerHTML = html;
}

window.onSlotChange = async function(idx, name) {
  if (!name) {
    families[idx] = "";
    families = families.filter(Boolean);
    renderSlots();
    renderCompareTable();
    return;
  }

  while (families.length <= idx) families.push("");
  families[idx] = name;
  families = families.filter(Boolean);

  localStorage.setItem("compareList", JSON.stringify(families));

  renderSlots();
  await loadAndRender();
};

window.removeFamily = function(idx) {
  const nameToRemove = families[idx];
  families.splice(idx, 1);
  localStorage.setItem("compareList", JSON.stringify(families));
  if (nameToRemove) delete familyData[nameToRemove];
  renderSlots();
  renderCompareTable();
};

// ── Data Loading ──────────────────────────────────────────────────────────────
async function loadAndRender() {
  const tableWrap = document.getElementById("compare-table-wrap");

  const toLoad = families.filter(n => n && !familyData[n]);
  if (toLoad.length) {
    try {
      tableWrap.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div><p class="spinner-text">Loading comparison data…</p></div>`;
      await Promise.all(toLoad.map(async name => {
        try { familyData[name] = await getFamily(name); } catch (_) {}
      }));
    } catch (_) {}
  }

  renderCompareTable();
}

// ── Comparison Table ──────────────────────────────────────────────────────────
function renderCompareTable() {
  const wrap = document.getElementById("compare-table-wrap");
  if (!wrap) return;

  const active = families.filter(n => n && familyData[n]);

  if (active.length < 2) {
    wrap.innerHTML = `<div class="no-data">Select at least 2 families above to compare them side-by-side.</div>`;
    return;
  }

  // Discover all sheets and their columns dynamically
  // Maintain sheet order from first family that has data for that sheet
  const sheetOrder = [];
  const sheetColsMap = {}; // sheet → ordered array of column names

  active.forEach(name => {
    const data = familyData[name] || {};
    Object.entries(data).forEach(([sheet, rows]) => {
      if (!sheetOrder.includes(sheet)) sheetOrder.push(sheet);
      if (!sheetColsMap[sheet]) sheetColsMap[sheet] = [];

      if (rows && rows.length > 0) {
        Object.keys(rows[0]).forEach(col => {
          // Skip the family identifier column
          if (["Family", "family", "Name", "name"].includes(col)) return;
          if (!sheetColsMap[sheet].includes(col)) sheetColsMap[sheet].push(col);
        });
      }
    });
  });

  let html = `<div class="compare-table-wrap"><table class="compare-table">
    <thead><tr>
      <th class="attr-col">Sheet / Attribute</th>
      ${active.map(n => `<th style="text-align:left"><a href="family.html?name=${encodeURIComponent(n)}" style="color:var(--orange)">${escHtml(n)}</a></th>`).join("")}
    </tr></thead>
    <tbody>`;

  sheetOrder.forEach(sheet => {
    const cols = sheetColsMap[sheet] || [];
    if (!cols.length) return;

    // Check if at least one family has any data for this sheet
    const hasAnyData = active.some(name => {
      const rows = (familyData[name] || {})[sheet] || [];
      return rows.length > 0;
    });
    if (!hasAnyData) return;

    // Sheet header row
    html += `<tr>
      <td colspan="${active.length + 1}" style="background:var(--slate);color:#B8B4AD;font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;padding:10px 16px;font-weight:600">
        ${escHtml(sheet)}
      </td>
    </tr>`;

    cols.forEach(col => {
      const cellData = active.map(name => {
        const data = familyData[name] || {};
        const rows = data[sheet] || [];
        const row  = rows[0] || {};
        const val  = row[col] ?? "";

        let cellHtml;
        if (col === "Empirical Validation") {
          const badge  = `<span class="badge ${validationBadge(val)}">${validationLabel(val)}</span>`;
          const hasUrl = /https?:\/\//.test(String(val || ""));
          const link   = hasUrl
            ? `<div style="margin-top:5px;font-size:12px">${renderCellValue(val)}</div>`
            : "";
          cellHtml = badge + link;
        } else {
          cellHtml = renderCellValue(val);
        }

        return { html: cellHtml, raw: String(val || "").trim() };
      });

      const unique  = new Set(cellData.map(c => c.raw).filter(v => v && v !== "-"));
      const isDiff  = unique.size > 1;
      const diffCls = isDiff ? "diff-highlight" : "";

      html += `<tr>
        <td class="attr-name">${escHtml(col)}</td>
        ${cellData.map(c => `<td class="${diffCls}">${c.html}</td>`).join("")}
      </tr>`;
    });
  });

  html += `</tbody></table></div>`;

  html += `<div style="margin-top:12px;font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:8px">
    <span style="display:inline-block;width:16px;height:16px;background:#FFF7ED;border-left:3px solid var(--orange);border-radius:2px"></span>
    Cells highlighted in orange indicate attributes that differ between families.
  </div>`;

  wrap.innerHTML = html;
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
