/**
 * dashboard.js – Dashboard page logic.
 * Loads stats → renders KPI cards, timeline.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const statsWrap    = document.getElementById("stats-wrap");
  const timelineWrap = document.getElementById("timeline-wrap");

  // ── Load Stats ─────────────────────────────────────────────────────────────
  let stats = {};
  try {
    stats = await withSpinner(statsWrap, getStats, "Computing statistics…");
    renderStats(stats);
  } catch (_) {}

  // ── Load Families for Timeline ─────────────────────────────────────────────
  let overviewRows = [];
  try {
    const res = await getSheet("Overview");
    overviewRows = res.data || [];
  } catch (_) {}

  if (overviewRows.length) renderTimeline(overviewRows);

  // ── Random Family Button ───────────────────────────────────────────────────
  const randBtn = document.getElementById("random-family-btn");
  if (randBtn) {
    randBtn.addEventListener("click", async () => {
      try {
        const res = await getFamilies();
        const names = res.families || [];
        if (names.length) {
          const pick = names[Math.floor(Math.random() * names.length)];
          window.location.href = `family.html?name=${encodeURIComponent(pick)}`;
        }
      } catch (_) {}
    });
  }
});

// ── Stat Cards ────────────────────────────────────────────────────────────────
function renderStats(stats) {
  const wrap = document.getElementById("stats-wrap");
  if (!wrap) return;

  // Compute year range from year_distribution
  const years = Object.keys(stats.year_distribution || {})
    .map(Number).filter(y => y > 1000).sort((a, b) => a - b);
  const minYear = years[0]  || 1989;
  const maxYear = years[years.length - 1] || 2025;
  const span    = maxYear - minYear + 1;

  wrap.innerHTML = `
    <div class="stats-grid fade-in">
      <div class="stat-card">
        <div class="stat-label">Families Tracked</div>
        <div class="stat-value orange">${stats.total_families ?? "—"}</div>
        <div class="stat-desc">Ransomware families catalogued</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Years Covered</div>
        <div class="stat-value">${span}</div>
        <div class="stat-desc">${minYear}–${maxYear} ransomware evolution</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Eras Documented</div>
        <div class="stat-value green">4</div>
        <div class="stat-desc">Dormant → Crypto → Industrial → RaaS</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tech Categories</div>
        <div class="stat-value">7</div>
        <div class="stat-desc">Encryption, propagation, evasion &amp; more</div>
      </div>
    </div>`;
}

// ── Timeline ──────────────────────────────────────────────────────────────────
const ERAS = [
  {
    label: "ERA 1 — Dormant Years",
    start: 1989, end: 2012,
    cls: "era-dormant",
  },
  {
    label: "ERA 2 — Crypto Revolution",
    start: 2013, end: 2015,
    cls: "era-crypto-rev",
  },
  {
    label: "ERA 3 — Industrialisation",
    start: 2016, end: 2018,
    cls: "era-industrial",
  },
  {
    label: "ERA 4 — Human-Operated RaaS",
    start: 2019, end: 2025,
    cls: "era-raas",
  },
];

function eraColor(year) {
  if (year <= 2012) return "#78716C"; // Dormant Years
  if (year <= 2015) return "#D97706"; // Crypto Revolution
  if (year <= 2018) return "#EF4444"; // Industrialisation & Disruption
  return "#F97316";                   // Human-Operated RaaS
}

// Extract a numeric year from values like "January 2013", "2013", "2013.0"
function extractYear(raw) {
  const str = String(raw || "").trim();
  const m = str.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0]) : 0;
}

// Position a dot within the equal-width era layout (each era = 25% of width)
// Returns percentage string, accounting for 3% left/3% right margin
function dotPosition(year) {
  const eraIdx = ERAS.findIndex(e => year >= e.start && year <= e.end);
  if (eraIdx === -1) return "50";
  const era = ERAS[eraIdx];
  const eraRange = Math.max(era.end - era.start, 1);
  const withinEra = (year - era.start) / eraRange;
  // Total usable width = 94% (3% margins each side), split equally per era
  const sliceW  = 94 / ERAS.length;
  const sliceStart = 3 + eraIdx * sliceW;
  return (sliceStart + withinEra * sliceW).toFixed(2);
}

function renderTimeline(rows) {
  const wrap = document.getElementById("timeline-wrap");
  if (!wrap) return;

  const sampleRow = rows[0];
  const familyCol = Object.keys(sampleRow).find(k =>
    k.toLowerCase().includes("family") || k.toLowerCase() === "name"
  ) || "Family";
  const yearCol = Object.keys(sampleRow).find(k => k.toLowerCase() === "year") || "Year";

  const families = rows
    .map(r => ({
      name:    r[familyCol],
      yearRaw: r[yearCol] || "",
      year:    extractYear(r[yearCol]),
    }))
    .filter(f => f.name && f.year);

  if (!families.length) { wrap.innerHTML = '<div class="no-data">No timeline data.</div>'; return; }

  // Era bands — each era gets equal flex width (flex:1 set in CSS)
  const erasHtml = ERAS.map(era =>
    `<div class="era-band ${era.cls}" title="${era.label}">${era.label}</div>`
  ).join("");

  // Dots — group same-year families to offset vertically
  const yearGroups = {};
  families.forEach(f => {
    if (!yearGroups[f.year]) yearGroups[f.year] = [];
    yearGroups[f.year].push(f);
  });

  const dotsHtml = families.map(f => {
    const pct = dotPosition(f.year);
    const col = eraColor(f.year);
    const grp = yearGroups[f.year];
    const idx = grp.indexOf(f);
    const topOffset = grp.length > 1 ? (idx % 2 === 0 ? -14 : 14) : 0;
    return `<div class="timeline-dot"
               style="left:${pct}%;background:${col};margin-top:calc(-6px + ${topOffset}px)"
               data-family="${escHtml(f.name)}"
               data-year="${f.year}"
               onclick="window.location.href='family.html?name=${encodeURIComponent(f.name)}'">
              <span class="dot-tooltip">${escHtml(f.name)} (${escHtml(f.yearRaw) || f.year})</span>
            </div>`;
  }).join("");

  // Year labels at era boundaries only
  const boundaryYears = [ERAS[0].start, ...ERAS.map(e => e.end + 1).slice(0, -1), ERAS[ERAS.length - 1].end];
  const uniqueYears = [...new Set(boundaryYears)];
  let yearLabels = "";
  uniqueYears.forEach(y => {
    const pct = dotPosition(y <= ERAS[0].start ? ERAS[0].start : y >= ERAS[ERAS.length-1].end ? ERAS[ERAS.length-1].end : y);
    // Position at era start/end boundaries
    const eraIdx = ERAS.findIndex(e => y >= e.start && y <= e.end);
    let labelPct;
    if (y === ERAS[0].start) {
      labelPct = "3";
    } else if (y === ERAS[ERAS.length - 1].end) {
      labelPct = "97";
    } else {
      // At boundary between eras: position at the era slice border
      const boundaryEraIdx = ERAS.findIndex(e => e.end + 1 === y);
      if (boundaryEraIdx >= 0) {
        const sliceW = 94 / ERAS.length;
        labelPct = (3 + (boundaryEraIdx + 1) * sliceW).toFixed(2);
      } else {
        labelPct = dotPosition(y);
      }
    }
    yearLabels += `<span style="position:absolute;left:${labelPct}%;transform:translateX(-50%)">${y}</span>`;
  });

  wrap.innerHTML = `
    <div class="timeline-eras">${erasHtml}</div>
    <div class="timeline-track" style="height:80px">
      <div class="timeline-axis"></div>
      ${dotsHtml}
    </div>
    <div class="timeline-year-labels" style="position:relative;height:20px">${yearLabels}</div>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
