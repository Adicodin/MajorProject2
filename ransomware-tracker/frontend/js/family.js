/**
 * family.js – Family detail page.
 * Reads ?name=<family> from URL, fetches combined data, renders tabs.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const name   = params.get("name");

  if (!name) {
    document.getElementById("family-content").innerHTML =
      `<div class="error-banner">No family specified. <a href="database.html">Browse database →</a></div>`;
    return;
  }

  document.title = `${name} — Ransomware Evolution Matrix`;
  document.getElementById("family-name-display").textContent  = name;
  document.getElementById("family-monogram").textContent      = name.slice(0, 2).toUpperCase();

  const content = document.getElementById("family-content");

  try {
    const data = await withSpinner(content, () => getFamily(name), `Loading ${name} data…`);
    renderFamily(name, data);
  } catch (_) {}

  document.getElementById("add-compare-btn")?.addEventListener("click", () => {
    const list = JSON.parse(localStorage.getItem("compareList") || "[]");
    if (!list.includes(name)) {
      list.push(name);
      if (list.length > 3) list.shift();
      localStorage.setItem("compareList", JSON.stringify(list));
    }
    window.location.href = `compare.html`;
  });
});

// ── Glossary terms ────────────────────────────────────────────────────────────
const GLOSSARY = {
  "RaaS":    "Ransomware-as-a-Service: affiliates rent ransomware from operators to conduct attacks.",
  "AES":     "Advanced Encryption Standard: symmetric block cipher used to encrypt files.",
  "RSA":     "Asymmetric public-key encryption used for key exchange in ransomware.",
  "ChaCha20":"A fast stream cipher often used as an alternative to AES.",
  "ECC":     "Elliptic Curve Cryptography: efficient public-key crypto used in modern ransomware.",
  "BYOVD":   "Bring Your Own Vulnerable Driver: technique to disable security software.",
  "C2":      "Command & Control server: attacker-controlled server ransomware phones home to.",
  "TOR":     "The Onion Router: anonymised network used by ransomware for C2 and payment portals.",
  "MBR":     "Master Boot Record: low-level disk structure targeted by wiper-style ransomware.",
  "VSS":     "Volume Shadow Copy Service: Windows backup mechanism deleted by ransomware.",
  "PE":      "Portable Executable: Windows binary format used by ransomware payloads.",
};

/**
 * Convert raw cell text to HTML:
 *  - Splits on \n, preserves "- " bullet prefix
 *  - Linkifies https:// URLs
 *  - Applies glossary tooltips to plain text parts
 *  - Escapes all other HTML
 */
function applyGlossary(text) {
  const str = String(text ?? "").trim();
  if (!str || str === "-") return "";

  const lines = str.split(/\r?\n/);
  const rendered = lines.map(line => {
    line = line.trim();
    if (!line) return null;

    // Split into URL / non-URL alternating parts
    const parts = line.split(/(https?:\/\/[^\s,;"<>\[\]]+)/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // URL — escape and linkify
        const url = escHtml(part);
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      }
      // Plain text — escape, then apply glossary tooltips
      let escaped = escHtml(part);
      Object.entries(GLOSSARY).forEach(([term, def]) => {
        const re = new RegExp(`\\b${term}\\b`, "g");
        const defEsc = def.replace(/"/g, "&quot;");
        escaped = escaped.replace(re,
          `<span class="glossary-term" data-def="${defEsc}">${term}</span>`);
      });
      return escaped;
    }).join("");
  }).filter(l => l !== null);

  return rendered.join("<br>");
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderFamily(name, data) {
  const content = document.getElementById("family-content");
  if (!data) {
    content.innerHTML = `<div class="error-banner">No data found for "${escHtml(name)}".</div>`;
    return;
  }

  const overviewRows = data["Overview"] || [];
  const overviewRow  = overviewRows[0] || {};
  const year = overviewRow["Year"] || "";
  const ev   = overviewRow["Empirical Validation"] || "";

  const metaEl = document.getElementById("family-meta");
  if (metaEl) {
    metaEl.innerHTML = `
      ${year ? `<span class="badge badge-orange">📅 ${escHtml(String(year))}</span>` : ""}
      <span class="badge ${validationBadge(ev)}">${validationLabel(ev)}</span>`;
  }

  const TABS = [
    { id: "tab-overview",     label: "🧾 Overview",      render: () => renderOverview(overviewRow) },
    { id: "tab-encryption",   label: "🔐 Encryption",    render: () => renderEncryption(findSheetRows(data, "Encryption")[0] || {}) },
    { id: "tab-file",         label: "📁 File Activity", render: () => renderGenericKV(findSheetRows(data, "File")[0] || {}, ["Brief", "Target", "Mutex"]) },
    { id: "tab-network",      label: "🌐 Network",       render: () => renderGenericKV(findSheetRows(data, "Network")[0] || {}, ["Protocol", "Network Activity"]) },
    { id: "tab-persistence",  label: "⚙️ Persistence",   render: () => renderGenericKV(findSheetRows(data, "Persistance")[0] || {}, ["Persistance Method", "Persistence Method"]) },
    { id: "tab-anti",         label: "🛡️ Anti-Analysis", render: () => renderGenericKV(findSheetRows(data, "Anti Analysis")[0] || {}, ["Anti Analysis", "Defense Evasion", "Packed"]) },
    { id: "tab-prop",         label: "📡 Propagation",   render: () => renderGenericKV(findSheetRows(data, "Propagation")[0] || {}, ["Propagation", "Ransom Mechanism"]) },
  ];

  const tabsEl = document.getElementById("tabs-nav");
  tabsEl.innerHTML = TABS.map((t, i) =>
    `<button class="tab-btn${i === 0 ? " active" : ""}" data-tab="${t.id}">${t.label}</button>`
  ).join("");

  content.innerHTML = TABS.map((t, i) =>
    `<div id="${t.id}" class="tab-content${i === 0 ? " active" : ""}"></div>`
  ).join("");

  document.getElementById(TABS[0].id).innerHTML = TABS[0].render();

  tabsEl.querySelectorAll(".tab-btn").forEach((btn, i) => {
    btn.addEventListener("click", () => {
      tabsEl.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      content.querySelectorAll(".tab-content").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const pane = document.getElementById(TABS[i].id);
      pane.classList.add("active");
      if (!pane.innerHTML.trim()) pane.innerHTML = TABS[i].render();
    });
  });
}

function findSheetRows(data, sheetPartial) {
  const key = Object.keys(data).find(k => k.toLowerCase().includes(sheetPartial.toLowerCase()));
  return key ? data[key] : [];
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function renderOverview(row) {
  if (!row || !Object.keys(row).length) return noData();

  const skip = ["family", "Family", "name", "Name"];

  let html = `<div class="kv-grid">`;
  Object.entries(row).forEach(([k, v]) => {
    if (!v || skip.includes(k)) return;

    let valHtml;
    if (k === "References" || k === "references") {
      // Each line may be a URL — use renderCellValue (from api.js)
      valHtml = renderCellValue(v);
    } else if (k === "Empirical Validation" || k === "empirical validation") {
      const badge = `<span class="badge ${validationBadge(v)}">${validationLabel(v)}</span>`;
      const hasUrl = /https?:\/\//.test(String(v));
      const link   = hasUrl
        ? `<div style="margin-top:6px;font-size:13px">${renderCellValue(v)}</div>`
        : "";
      valHtml = badge + link;
    } else {
      valHtml = applyGlossary(v) || "<em style='color:var(--text-light)'>—</em>";
    }

    html += `<div class="kv-item">
               <div class="kv-label">${escHtml(k)}</div>
               <div class="kv-value">${valHtml}</div>
             </div>`;
  });
  html += `</div>`;
  return html;
}

// ── Encryption Tab ────────────────────────────────────────────────────────────
function renderEncryption(row) {
  if (!row || !Object.keys(row).length) return noData();
  return renderGenericKV(row, Object.keys(row).filter(k => !["family","Family"].includes(k)));
}

// ── Generic KV Card Layout ────────────────────────────────────────────────────
function renderGenericKV(row, wantedKeys) {
  if (!row || !Object.keys(row).length) return noData();

  let keys = wantedKeys.filter(k => k in row);
  if (!keys.length) {
    keys = Object.keys(row).filter(k => !["family","Family"].includes(k));
  }
  if (!keys.length) return noData();

  let html = `<div class="kv-grid">`;
  keys.forEach(k => {
    const v      = row[k] ?? "";
    const isEmpty = !v || v === "-";
    const valHtml = isEmpty
      ? "<em style='color:var(--text-light)'>Not documented</em>"
      : applyGlossary(v);

    html += `<div class="kv-item">
               <div class="kv-label">${escHtml(k)}</div>
               <div class="kv-value${isEmpty ? " empty" : ""}">${valHtml}</div>
             </div>`;
  });
  html += `</div>`;
  return html;
}

function noData() {
  return `<div class="no-data">No data available for this family in this category.</div>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
