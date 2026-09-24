/* Human GPCR-Ligand Interactome — client
 *
 * Loads only web/manifest.json (~52 KB) on open, then fetches one ~11 KB slice per
 * receptor or ligand on demand. Structures come out of the Zenodo archive parts with a
 * single HTTP byte-range request each (~76 KB), gunzipped in the browser.
 */
"use strict";

const C = { NAME:0, AFF:1, PIC50:2, PBIND:3, IPTM:4, PLDDT:5, IPLDDT:6, IPDE:7, CONF:8, PART:9, OFF:10, LEN:11 };
// Columns where a SMALLER number is the better result, so the first sort click shows those first.
const LOWER_BETTER = new Set([1, 7]);   // aff (log10 IC50), complex iPDE
let M = null;                 // manifest
let rows = [];                // rows currently loaded (compact arrays)
let view = [];                // rows after filtering, in display order
let mode = { kind:"top", key:null, label:null };
let sort = { col:C.AFF, desc:false };
let sel = -1;
let viewer = null, structText = null, structName = null;
const structCache = new Map();

const $ = id => document.getElementById(id);
const fmt = (v,n=2) => (v===null||v===undefined||Number.isNaN(v)) ? "–" : Number(v).toFixed(n);

/* ---------------- boot ---------------- */
fetch("web/manifest.json")
  .then(r => { if (!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
  .then(m => {
    M = m;
    $("stat-pairs").textContent = m.n_pairs.toLocaleString();
    $("stat-gpcr").textContent  = m.n_gpcr;
    $("stat-lig").textContent   = m.n_ligand;
    const zl = "https://zenodo.org/records/" + m.record_id;
    $("zenodo-link").href = zl;
    buildSuggestIndex();
    // landing view: the precomputed strongest pairs, no extra request
    rows = m.top.map(r => r.slice(1).concat([r[0]]));   // [.., gpcr] appended for context
    mode = { kind:"top", key:null, label:null };
    applyAndRender();
  })
  .catch(e => {
    console.error(e);
    $("context-label").innerHTML = '<strong>Could not load web/manifest.json.</strong> ' + e.message;
  });

/* ---------------- suggestions ---------------- */
let SUG = [];
function buildSuggestIndex(){
  SUG = [];
  for (const g of M.gpcrs)
    SUG.push({ kind:"g", name:g.n, slug:g.s, meta:g.f || g.c || "", low:g.n.toLowerCase() });
  for (const l of M.ligands)
    SUG.push({ kind:"l", name:l.n, slug:l.s, pep:l.p, meta:l.p ? "peptide" : "", low:l.n.toLowerCase() });
}

let sugItems = [], sugIdx = -1;
function renderSuggest(q){
  const box = $("suggest");
  const s = q.trim().toLowerCase();
  if (!s) { box.hidden = true; $("searchBox").setAttribute("aria-expanded","false"); return; }
  // prefix matches first, then substring — both lists are small so this is instant
  const score = x => x.low.startsWith(s) ? 0 : (x.low.includes(s) ? 1 : -1);
  const hits = SUG.map(x => [score(x), x]).filter(p => p[0] >= 0)
                  .sort((a,b) => a[0]-b[0] || a[1].name.length-b[1].name.length)
                  .map(p => p[1]);
  const gs = hits.filter(x => x.kind === "g").slice(0, 8);
  const ls = hits.filter(x => x.kind === "l").slice(0, 8);
  sugItems = []; sugIdx = -1;
  let html = "";
  const hl = n => n.replace(new RegExp("("+s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","i"), "<mark>$1</mark>");
  if (gs.length){
    html += '<div class="sg-group">Receptors</div>';
    gs.forEach(x => { html += `<div class="sg-item" data-i="${sugItems.length}"><span class="badge">GPCR</span><span class="nm">${hl(x.name)}</span><span class="meta">${x.meta}</span></div>`; sugItems.push(x); });
  }
  if (ls.length){
    html += '<div class="sg-group">Ligands</div>';
    ls.forEach(x => { html += `<div class="sg-item" data-i="${sugItems.length}"><span class="badge ${x.pep?"pep":"lig"}">${x.pep?"PEP":"LIG"}</span><span class="nm">${hl(x.name)}</span><span class="meta">${x.meta}</span></div>`; sugItems.push(x); });
  }
  if (!sugItems.length) html = '<div class="sg-empty">Nothing matches &ldquo;'+q+'&rdquo;.</div>';
  box.innerHTML = html;
  box.hidden = false;
  $("searchBox").setAttribute("aria-expanded","true");
  box.querySelectorAll(".sg-item").forEach(el =>
    el.addEventListener("mousedown", ev => { ev.preventDefault(); choose(sugItems[+el.dataset.i]); }));
}
function moveSug(d){
  if ($("suggest").hidden || !sugItems.length) return;
  sugIdx = (sugIdx + d + sugItems.length) % sugItems.length;
  const els = $("suggest").querySelectorAll(".sg-item");
  els.forEach((e,i) => e.classList.toggle("active", i === sugIdx));
  els[sugIdx].scrollIntoView({ block:"nearest" });
}

/* ---------------- selection ---------------- */
async function choose(x){
  if (!x) return;
  $("searchBox").value = x.name;
  $("suggest").hidden = true;
  $("clearBtn").hidden = false;
  $("context-label").innerHTML = "Loading <strong>" + x.name + "</strong>…";
  const path = (x.kind === "g" ? "web/g/" : "web/l/") + encodeURIComponent(x.slug) + ".json";
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error("HTTP " + r.status + " for " + path);
    rows = await r.json();
  } catch (e) {
    console.error(e);
    $("context-label").innerHTML = "<strong>Could not load " + x.name + ".</strong> " + e.message;
    return;
  }
  mode = { kind:x.kind, key:x.slug, label:x.name, meta:x.meta };
  sort = { col:C.AFF, desc:false };
  sel = -1;
  applyAndRender();
}

function applyAndRender(){
  const hi = $("hiconf").checked;
  view = hi ? rows.filter(r => r[C.PBIND] >= 0.9) : rows.slice();
  const c = sort.col, s = sort.desc ? -1 : 1;
  view.sort((a,b) => (typeof a[c] === "string")
    ? s * -String(a[c]).localeCompare(String(b[c]))
    : s * -((a[c] - b[c])));
  renderContext();
  renderTable();
}

function renderContext(){
  const lab = $("context-label");
  if (mode.kind === "top")
    lab.innerHTML = "Showing the <strong>250 strongest predicted pairs</strong> across the whole matrix — search above to explore one receptor or one ligand.";
  else if (mode.kind === "g")
    lab.innerHTML = "<strong>" + mode.label + "</strong> vs all " + M.n_ligand + " endogenous ligands" + (mode.meta ? ' <span class="pill">'+mode.meta+'</span>' : "");
  else
    lab.innerHTML = "<strong>" + mode.label + "</strong> vs all " + M.n_gpcr + " receptors";
  const n = view.length, tot = rows.length;
  $("rowcount").textContent = n === tot ? n + " rows" : n + " of " + tot + " rows";
}

function renderTable(){
  const tb = document.querySelector("#resultsTable tbody");
  const partner = mode.kind === "g" ? "Ligand" : (mode.kind === "l" ? "Receptor" : "Receptor – ligand");
  document.querySelector('th[data-col="0"]').firstChild.textContent = partner;
  document.querySelectorAll("th.sortable").forEach(th => {
    th.classList.remove("sorted-asc","sorted-desc");
    if (+th.dataset.col === sort.col) th.classList.add(sort.desc ? "sorted-desc" : "sorted-asc");
  });
  if (!view.length){ tb.innerHTML = ""; $("table-empty").hidden = false; return; }
  $("table-empty").hidden = true;
  const lo = 3, hi = 9.5;                                // pIC50 bar scale
  const frag = document.createDocumentFragment();
  view.forEach((r, i) => {
    const tr = document.createElement("tr");
    const label = (mode.kind === "top") ? (r[r.length-1] + " · " + r[C.NAME]) : r[C.NAME];
    const w = Math.max(0, Math.min(100, 100 * (r[C.PIC50]-lo) / (hi-lo)));
    tr.innerHTML =
      '<td class="name" title="' + label.replace(/"/g,"&quot;") + '">' + label + "</td>" +
      '<td class="num aff">' + fmt(r[C.AFF],3) + "</td>" +
      '<td class="num"><span class="bar" style="--w:' + w.toFixed(0) + '%">' + fmt(r[C.PIC50],2) + "</span></td>" +
      '<td class="num">' + fmt(r[C.PBIND],3) + "</td>" +
      '<td class="num">' + fmt(r[C.IPTM],3) + "</td>" +
      '<td class="num">' + fmt(r[C.PLDDT],3) + "</td>" +
      '<td><button class="viewbtn">View</button></td>';
    tr.querySelector("button").addEventListener("click", () => { selectRow(i, tr); });
    frag.appendChild(tr);
  });
  tb.innerHTML = ""; tb.appendChild(frag);
}

document.addEventListener("click", ev => {
  const th = ev.target.closest("th.sortable");
  if (!th) { if (!ev.target.closest("#combo")) $("suggest").hidden = true; return; }
  const c = +th.dataset.col;
  sort = (sort.col === c) ? { col:c, desc:!sort.desc } : { col:c, desc:!LOWER_BETTER.has(c) };
  applyAndRender();
});
$("searchBox").addEventListener("input", e => { $("clearBtn").hidden = !e.target.value; renderSuggest(e.target.value); });
$("searchBox").addEventListener("keydown", e => {
  if (e.key === "ArrowDown"){ e.preventDefault(); moveSug(1); }
  else if (e.key === "ArrowUp"){ e.preventDefault(); moveSug(-1); }
  else if (e.key === "Enter"){ e.preventDefault(); choose(sugIdx >= 0 ? sugItems[sugIdx] : sugItems[0]); }
  else if (e.key === "Escape"){ $("suggest").hidden = true; }
});
$("clearBtn").addEventListener("click", () => {
  $("searchBox").value = ""; $("clearBtn").hidden = true; $("suggest").hidden = true;
  rows = M.top.map(r => r.slice(1).concat([r[0]]));
  mode = { kind:"top", key:null, label:null }; sort = { col:C.AFF, desc:false };
  applyAndRender(); $("searchBox").focus();
});
$("hiconf").addEventListener("change", applyAndRender);

/* ---------------- structures: one ranged GET per complex ---------------- */
async function fetchStructure(part, off, len){
  const key = part + ":" + off;
  if (structCache.has(key)) return structCache.get(key);
  const url = M.part_url.replace("{PP}", String(part).padStart(2,"0"));
  const resp = await fetch(url, { headers:{ Range: "bytes=" + off + "-" + (off+len-1) } });
  if (resp.status !== 206 && resp.status !== 200) throw new Error("Zenodo returned " + resp.status);
  let buf = await resp.arrayBuffer();
  if (resp.status === 206 && buf.byteLength !== len)
    throw new Error("short read: " + buf.byteLength + " of " + len + " bytes");
  const ds = new DecompressionStream("gzip");
  buf = await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
  const text = new TextDecoder().decode(buf);
  structCache.set(key, text);
  return text;
}

async function selectRow(i, tr){
  document.querySelectorAll("#resultsTable tbody tr").forEach(x => x.classList.remove("selected"));
  tr.classList.add("selected");
  sel = i;
  const r = view[i];
  const name = (mode.kind === "g") ? mode.label + " – " + r[C.NAME]
            : (mode.kind === "l") ? r[C.NAME] + " – " + mode.label
            : r[r.length-1] + " – " + r[C.NAME];
  $("viewer-title").textContent = name;
  renderScores(r);
  const ph = $("viewer-placeholder");
  if (ph) ph.textContent = "Loading structure…";
  let text;
  try { text = await fetchStructure(r[C.PART], r[C.OFF], r[C.LEN]); }
  catch (e) {
    console.error(e);
    if (ph) ph.textContent = "Could not load structure: " + e.message;
    return;
  }
  if (ph) ph.remove();
  structText = text;
  structName = name.replace(/[^A-Za-z0-9._-]+/g, "_") + ".cif";
  $("download-structure").disabled = false;
  draw(text);
}

function draw(text){
  const el = $("viewer");
  if (!viewer) viewer = $3Dmol.createViewer(el, { backgroundColor:"white" });
  viewer.clear();
  viewer.addModel(text, "mmcif");
  viewer.setStyle({ resn:"HOH" }, {});
  viewer.setStyle({ hetflag:false }, { cartoon:{ colorscheme:{ prop:"b", gradient:"roygb", min:50, max:100 } } });
  viewer.setStyle({ hetflag:true }, { stick:{ radius:0.22 }, sphere:{ radius:0.32 } });
  viewer.setClickable({}, true, atom => {
    viewer.removeAllLabels();
    viewer.addLabel(atom.resn + " " + atom.resi + (atom.chain ? " (" + atom.chain + ")" : ""),
      { position:atom, backgroundColor:"black", fontColor:"white", fontSize:12, padding:2 });
    viewer.zoomTo({ resi:atom.resi, chain:atom.chain });
    viewer.render();
  });
  const cv = viewer.getCanvas();
  if (cv && !cv.dataset.dbl){
    cv.dataset.dbl = "1";
    cv.addEventListener("dblclick", e => { e.preventDefault(); viewer.removeAllLabels(); viewer.zoomTo(); viewer.render(); });
  }
  viewer.zoomTo();
  viewer.render();
}

function renderScores(r){
  const t = [
    ["Affinity <span class=\"mono\">affinity_pred_value</span><br><small>log<sub>10</sub>(IC<sub>50</sub> / 1 µM), model output</small>", fmt(r[C.AFF],4)],
    ["Predicted pIC<sub>50</sub> <small>= 6 − affinity</small>", fmt(r[C.PIC50],2)],
    ["P(binder)", fmt(r[C.PBIND],3)],
    ["ipTM", fmt(r[C.IPTM],3)],
    ["Complex pLDDT", fmt(r[C.PLDDT],3)],
    ["Complex ipLDDT", fmt(r[C.IPLDDT],3)],
    ["Complex iPDE", fmt(r[C.IPDE],3)],
    ["Confidence score", fmt(r[C.CONF],3)]
  ];
  document.querySelector("#scoresTable tbody").innerHTML =
    t.map(([k,v]) => "<tr><td>" + k + "</td><td>" + v + "</td></tr>").join("");
}

$("download-structure").addEventListener("click", () => {
  if (!structText) return;
  const url = URL.createObjectURL(new Blob([structText], { type:"chemical/x-cif" }));
  const a = document.createElement("a");
  a.href = url; a.download = structName || "structure.cif";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
