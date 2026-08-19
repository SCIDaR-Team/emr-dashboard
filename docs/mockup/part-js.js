/* ═══════════════════════════════════════════════════════════════════════
   EMR Readiness — clickable mockup.
   Static data, real numbers. Table filters and the facility picker work;
   aggregate charts do not recompute on filter (that is the build step, not
   the mockup step).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var D = window.EMR;

// ── constants ────────────────────────────────────────────────────────
var THEMES = ['technical_infrastructure','workforce_capacity','workflow_transition','data_use_reporting','leadership_governance'];
var TLABEL = {
  technical_infrastructure: 'Technical Infrastructure',
  workforce_capacity: 'Workforce Capacity',
  workflow_transition: 'Workflow & Transition',
  data_use_reporting: 'Data Use & Reporting',
  leadership_governance: 'Leadership & Governance'
};
var TSHORT = { technical_infrastructure:'Tech. Infra.', workforce_capacity:'Workforce',
  workflow_transition:'Workflow', data_use_reporting:'Data Use', leadership_governance:'Leadership' };
var SUBLAB = {
  power:'Power supply', connectivity:'Connectivity', devices:'Devices',
  power_resilience:'Power resilience', connectivity_resilience:'Connectivity resilience',
  device_sustainability:'Device sustainability', data_resilience:'Data resilience',
  digital_competency:'Digital competency', roles_and_accountability:'Roles & accountability',
  digital_familiarity:'Digital familiarity', training_readiness:'Training readiness',
  technical_support:'Technical support', change_readiness:'Change readiness',
  documentation_integration:'Documentation integration', service_point_environment:'Service-point environment',
  workflow_efficiency:'Workflow efficiency', data_quality_review:'Data-quality review',
  routine_data_use:'Routine data use', use_of_routine_reports:'Use of routine reports'
};
var BANDS = ['notready','moderate','ready'];
var BLABEL = { notready:'Not ready', moderate:'Moderately ready', ready:'Ready' };
var BACTION = { notready:'Foundational build', moderate:'Targeted fixes', ready:'Roll out now' };
var CUT_LO = 2.9, CUT_HI = 3.9, FLOOR = 2.5;
var MEAN = D.nat.avg;

// ── helpers ──────────────────────────────────────────────────────────
var fmt = function (n) { return (n == null ? '—' : n.toLocaleString('en-US')); };
var f2 = function (v) { return v == null ? '—' : v.toFixed(2); };
var pct = function (v) { return ((v - 1) / 4) * 100; };            // 1–5 rubric scale
var bandOf = function (v) { return v == null ? null : (v <= CUT_LO ? 'notready' : (v > CUT_HI ? 'ready' : 'moderate')); };
var esc = function (s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
var tipAttr = function (s) { return 'data-tip="' + esc(s) + '"'; };
var titleCase = function (s) { return String(s).toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); };

/* A small textured mark beside a figure — values stay in ink tokens and the
   mark carries the band, so a number is never recoloured to mean something. */
function bandMark(v) {
  var b = bandOf(v);
  if (!b) return '<i class="mark tex-nodata" title="Not scored"></i>';
  return '<i class="mark tex-' + b + '" title="' + BLABEL[b] + '"></i>';
}
function bandChip(b) {
  return '<span class="chip chip--' + b + '"><i class="tex-' + b + '"></i>' + BLABEL[b] + '</span>';
}

/* ── Maturity: the five-level scale ───────────────────────────────────
   Bounds and the round-to-1dp lookup are taken from MATURITY_BANDS /
   toMaturityLevel in src/lib/bands.ts, not re-derived: the bands are not
   uniform (Institutionalized spans 0.5 where others span 0.9/0.4) so it is a
   table lookup, and an unrounded mean lands on 3.9999… often enough that
   comparing unrounded drops a score the panel beside it prints as 4.0. */
var MATURITY = [
  { label:'Nascent',          min:1.0, max:1.9 },
  { label:'Emerging',         min:2.0, max:2.9 },
  { label:'Developing',       min:3.0, max:3.9 },
  { label:'Institutionalized',min:4.0, max:4.5 },
  { label:'Optimized',        min:4.6, max:5.0 }
];
function maturityOf(score) {
  if (score == null || !isFinite(score)) return null;
  var r = Math.round(score * 10) / 10;
  for (var i = 0; i < MATURITY.length; i++) {
    if (r >= MATURITY[i].min && r <= MATURITY[i].max) return i;
  }
  return null;
}
/* Position on the five-step blue ordinal ramp — the same ramp used for every
   other magnitude, so maturity needs no palette of its own. Cumulative fill
   reads as distance travelled toward Optimized. */
function maturityChip(score, big) {
  var i = maturityOf(score);
  if (i == null) {
    return '<span class="mat' + (big ? ' mat--lg' : '') + '"><span class="cells">' +
      '<i></i><i></i><i></i><i></i><i></i></span><span class="lv">Not scored</span></span>';
  }
  var cells = '';
  for (var c = 0; c < 5; c++) {
    cells += '<i' + (c <= i ? ' style="background:' + RAMP[i] + '"' : '') + '></i>';
  }
  return '<span class="mat' + (big ? ' mat--lg' : '') + '" ' +
    tipAttr(MATURITY[i].label + ' · level ' + (i + 1) + ' of 5\n' +
      MATURITY[i].min.toFixed(1) + '–' + MATURITY[i].max.toFixed(1) + ' of 5' +
      (score != null ? '\nthis score: ' + f2(score) : '')) +
    '><span class="cells">' + cells + '</span><span class="lv">' + MATURITY[i].label + '</span></span>';
}

// ── currency ─────────────────────────────────────────────────────────
function ngn(v) {
  if (v == null) return '—';
  return '₦' + Math.round(v).toLocaleString('en-US');
}
function ngnShort(v) {
  if (v == null) return '—';
  var a = Math.abs(v);
  if (a >= 1e9) return '₦' + (v / 1e9).toFixed(2) + 'bn';
  if (a >= 1e6) return '₦' + (v / 1e6).toFixed(1) + 'm';
  if (a >= 1e3) return '₦' + Math.round(v / 1e3) + 'k';
  return '₦' + Math.round(v);
}
function distOf(o) { return { notready:o.d[0], moderate:o.d[1], ready:o.d[2] }; }
function stackBar(o, label) {
  var t = o.d[0] + o.d[1] + o.d[2]; if (!t) return '';
  var order = [['ready',o.d[2]],['moderate',o.d[1]],['notready',o.d[0]]];
  return '<div class="stack">' + order.map(function (p) {
    var w = p[1] / t * 100;
    return '<i class="tex-' + p[0] + '" style="width:' + w.toFixed(2) + '%" ' +
      tipAttr((label || '') + '\n' + BLABEL[p[0]] + ' ' + fmt(p[1]) + ' · ' + w.toFixed(1) + '%') + '></i>';
  }).join('') + '</div>';
}
function trackBar(v, tip, showMean) {
  if (v == null) return '<div class="track tex-nodata" ' + tipAttr((tip||'') + '\nnot scored') + '></div>';
  return '<div class="track" ' + tipAttr(tip) + '><b style="width:' + pct(v).toFixed(1) + '%"></b>' +
    (showMean === false ? '' : '<u style="left:' + pct(MEAN).toFixed(1) + '%"></u>') + '</div>';
}
function subRows(subs, prefix) {
  var keys = Object.keys(subs).filter(function (k) { return !prefix || k.indexOf(prefix + '.') === 0; });
  keys.sort(function (a, b) { return subs[b] - subs[a]; });
  return keys.map(function (k) {
    var nm = SUBLAB[k.split('.')[1]] || titleCase(k.split('.')[1].replace(/_/g,' '));
    var v = subs[k];
    return '<div class="row2"><div class="lab"><span>' + nm + '</span><b>' + f2(v) + '</b></div>' +
      trackBar(v, nm + '\n' + f2(v) + ' / 5 · ' + BLABEL[bandOf(v)] + '\nnational mean ' + f2(MEAN)) + '</div>';
  }).join('');
}

var ICON = {
  home:'<path d="M2 7l6-5 6 5v7a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>',
  map:'<path d="M1 4l4.5-2 5 2L15 2v10l-4.5 2-5-2L1 14z"/><path d="M5.5 2v10M10.5 4v10"/>',
  bars:'<path d="M2 14V9M6 14V4M10 14V7M14 14V2"/>',
  clip:'<path d="M5 2h6v2H5z"/><path d="M4 4H2.8A.8.8 0 002 4.8v9.4c0 .44.36.8.8.8h10.4a.8.8 0 00.8-.8V4.8a.8.8 0 00-.8-.8H12"/><path d="M5 8h6M5 11h4"/>',
  compass:'<circle cx="8" cy="8" r="6.2"/><path d="M10.4 5.6l-1.3 3.5-3.5 1.3 1.3-3.5z"/>',
  file:'<path d="M9 1.5H4.2a.7.7 0 00-.7.7v11.6c0 .39.31.7.7.7h7.6a.7.7 0 00.7-.7V5z"/><path d="M9 1.5V5h3.5M5.8 8.5h4.4M5.8 11h3"/>',
  sun:'<circle cx="8" cy="8" r="3.1"/><path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1"/>',
  moon:'<path d="M13 9.8A5.6 5.6 0 016.2 3 5.8 5.8 0 108.6 14a5.8 5.8 0 004.4-4.2z"/>',
  auto:'<rect x="1.6" y="3" width="12.8" height="8.6" rx="1"/><path d="M5.4 14h5.2"/>',
  panel:'<rect x="1.6" y="2.6" width="12.8" height="10.8" rx="1"/><path d="M6 2.6v10.8"/>',
  down:'<path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 14h11"/>',
  next:'<path d="M3 8h10M9 4l4 4-4 4"/>',
  coins:'<ellipse cx="8" cy="4.2" rx="5.4" ry="2.3"/><path d="M2.6 4.2v3.4c0 1.27 2.42 2.3 5.4 2.3s5.4-1.03 5.4-2.3V4.2"/><path d="M2.6 7.6V11c0 1.27 2.42 2.3 5.4 2.3s5.4-1.03 5.4-2.3V7.6"/>',
  alert:'<path d="M8 1.9L1.4 13.4h13.2z"/><path d="M8 6v3.4M8 11.4v.6"/>'
};
function svgi(name, size) {
  return '<svg width="' + (size||16) + '" height="' + (size||16) + '" viewBox="0 0 16 16" fill="none" ' +
    'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICON[name] + '</svg>';
}
var TICK = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3 7.4l2.8 2.8L11 4.4" stroke="var(--ready)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var CROSS = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="var(--notready)" stroke-width="1.8" stroke-linecap="round"/></svg>';
var DASH = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M3.5 7h7" stroke="var(--nodata)" stroke-width="1.8" stroke-linecap="round"/></svg>';

/* ── Illustrative unit rates ──────────────────────────────────────────
   NOT NPHCDA FIGURES. The assessment workbook publishes no cost table, so
   `unitCostNGN` is null on all 28 items (see etl/lib/investment.mjs). These
   are placeholder rates, off by default, so the costed layout can be reviewed
   before real rates exist. Everything derived from them is stamped
   "illustrative" wherever it appears — a naira total in a government
   investment case must not inherit a number invented here.
   Keyed by item id; unit is one of the item's own quantity units. */
var ILLUSTRATIVE = {
  'ti.device_per_point': 450000, 'ti.electricity': 1250000, 'ti.wiring': 380000,
  'ti.printer': 145000, 'ti.backup': 75000, 'ti.amenity.fan': 35000,
  'ti.amenity.desk': 55000, 'ti.amenity.lockable_door': 85000,
  'ti.amenity.sockets': 12000, 'ti.amenity.chairs_patient': 18000,
  'ti.amenity.chairs_staff': 26000, 'ti.environment.water_leaks': 320000,
  'ti.environment.poor_ventilation': 95000,
  'wf.focal_person': 720000, 'wf.ict_support': 540000, 'wf.literate': 85000,
  'wf.role_specific': 120000, 'wf.resolution_time': 60000,
  'wk.records_shared': 350000, 'wk.point_of_care': 220000, 'wk.sop': 15000,
  'wk.no_duplicates': 40000,
  'du.reporting': 40000, 'du.exchange': 60000, 'du.feedback': 25000,
  'du.quality': 45000, 'du.realtime': 90000, 'du.decisions': 30000
};
/* Unit of the quantity, so a rate is enterable against the right thing. */
var UNIT_OF = {
  'ti.device_per_point':'per device', 'ti.amenity.fan':'per fan',
  'ti.amenity.desk':'per desk', 'ti.amenity.lockable_door':'per door',
  'ti.amenity.sockets':'per socket', 'ti.amenity.chairs_patient':'per chair',
  'ti.amenity.chairs_staff':'per chair', 'ti.environment.water_leaks':'per roof',
  'ti.environment.poor_ventilation':'per room', 'wk.sop':'per SOP set',
  'wf.focal_person':'per person / yr', 'wf.ict_support':'per person / yr'
};
function unitOf(id) { return UNIT_OF[id] || 'per facility'; }

/** Unit rate currently in force for an item: user entry, else illustrative if
 *  switched on, else none. */
function rateOf(id) {
  if (S.iCosts[id] != null && S.iCosts[id] !== '') return +S.iCosts[id];
  if (S.iRates) return ILLUSTRATIVE[id] != null ? ILLUSTRATIVE[id] : null;
  return null;
}
function lineTotal(item) {
  var r = rateOf(item.id);
  return r == null ? null : r * (item.q || 0);
}
/** True once any figure on screen depends on a rate we invented. */
function usingIllustrative() {
  return D.nat.inv.some(function (i) {
    return (S.iCosts[i.id] == null || S.iCosts[i.id] === '') && S.iRates && ILLUSTRATIVE[i.id] != null;
  });
}

// ── navigation ───────────────────────────────────────────────────────
var NAV = [
  { id:'home',       label:'Overview',           icon:'home',    title:'Overview',
    sub:'What the assessment found' },
  { id:'states',     label:'National Coverage',  icon:'map',     title:'National Coverage',
    sub:'All 37 states and how each was evidenced' },
  { id:'assessment', label:'Assessed States',    icon:'bars',    title:'Assessed States',
    sub:'The 12 states visited, down to LGA' },
  { id:'facilities', label:'Facility Scorecard', icon:'clip',    title:'Facility Scorecard',
    sub:'One facility, its gates and its actions' },
  { id:'investment', label:'Investment Plan',    icon:'coins',   title:'Investment Plan',
    sub:'What it will take, itemised and costed' },
  { id:'explore',    label:'Report Explorer',    icon:'compass', title:'Report Explorer',
    sub:'Explore the findings by geography and thematic area' },
  { id:'reports',    label:'Generate Report',    icon:'file',    title:'Generate Report',
    sub:'Scope it, preview it, download it' }
];

// ── state ────────────────────────────────────────────────────────────
var S = {
  route: 'landing',
  collapsed: false,
  theme: 'auto',
  facility: null,               // uuid8 or null
  fState: '', fLga: '',         // facility picker cascade
  sFilter: { state:'', band:'' },
  aFilter: { state:'', lga:'', q:'' },
  xTheme: 'all', xOpen: {}, xState: null, xAgg: 'mean',
  rTemplate: 'national', rSections: null,
  iCosts: {}, iRates: false, iPriority: '', iDomain: '',
  showProto: true
};

// ── map ──────────────────────────────────────────────────────────────
var PATTERNS =
  '<defs>' +
  '<pattern id="pModerate" patternUnits="userSpaceOnUse" width="5" height="5">' +
    '<rect width="5" height="5" fill="var(--moderate)"/>' +
    '<circle cx="1.4" cy="1.4" r="0.9" fill="rgba(0,0,0,.4)"/></pattern>' +
  '<pattern id="pNotready" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(135)">' +
    '<rect width="5" height="5" fill="var(--notready)"/>' +
    '<rect width="5" height="1.7" fill="rgba(0,0,0,.34)"/></pattern>' +
  '<pattern id="pNodata" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">' +
    '<rect width="6" height="6" fill="var(--surface-sunk)"/>' +
    '<rect width="6" height="2" fill="var(--nodata)"/></pattern>' +
  '</defs>';
var FILL = { ready:'var(--ready)', moderate:'url(#pModerate)', notready:'url(#pNotready)' };

/* ── Choropleth encoding ──────────────────────────────────────────────
   Maps carry MAGNITUDE, on the single-hue blue ordinal ramp, not the three
   readiness bands. Reason: every one of the 12 assessed states classifies to
   the same state-level band, so a band choropleth paints twelve identical
   polygons and encodes exactly one value — the flaw in the map this replaces.
   Share-not-ready spans 21%–86% across those same states, so the ramp has
   something to say. Bands stay on the marks that are genuinely classified:
   tiles, stacked bars, chips, gates, table marks. */
var RAMP = ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)'];
function seqStep(v, lo, hi) {
  if (v == null) return null;
  var t = (v - lo) / (hi - lo);
  return Math.max(0, Math.min(4, Math.floor(Math.max(0, Math.min(0.999, t)) * 5)));
}
function seqFill(v, lo, hi) {
  var s = seqStep(v, lo, hi);
  return s == null ? 'url(#pNodata)' : RAMP[s];
}
/* A stepped scale legend. A sequential encoding is unreadable without one. */
function scaleLegend(lo, hi, fmtFn, caption, extra) {
  var cells = RAMP.map(function (c, i) {
    var a = lo + (hi - lo) * i / 5, b = lo + (hi - lo) * (i + 1) / 5;
    return '<div style="flex:1;min-width:0">' +
      '<div style="height:9px;background:' + c + ';border-radius:1px" ' +
      tipAttr(fmtFn(a) + ' – ' + fmtFn(b)) + '></div>' +
      '<div class="fine" style="margin-top:3px;font-size:9px">' + fmtFn(a) + '</div></div>';
  }).join('');
  return '<div style="margin-top:11px">' +
    '<div class="fine" style="letter-spacing:.11em;text-transform:uppercase;margin-bottom:5px">' + caption + '</div>' +
    '<div style="display:flex;gap:2px;align-items:flex-start">' + cells +
      '<div style="flex:0 0 auto;padding-left:10px">' +
        '<div class="tex-nodata" style="height:9px;width:26px;border-radius:1px"></div>' +
        '<div class="fine" style="margin-top:3px;font-size:9px">no data</div></div>' +
    '</div>' +
    (extra ? '<p class="fine" style="margin-top:7px">' + extra + '</p>' : '') +
  '</div>';
}

function bboxOf(ds) {
  var xs = [], ys = [];
  ds.forEach(function (d) {
    var nums = d.match(/-?\d+(\.\d+)?/g) || [];
    for (var i = 0; i < nums.length - 1; i += 2) { xs.push(+nums[i]); ys.push(+nums[i+1]); }
  });
  return [Math.min.apply(null,xs), Math.min.apply(null,ys), Math.max.apply(null,xs), Math.max.apply(null,ys)];
}

/* areas: [{d, fill, tip, id, label, sel}] */
function mapSVG(areas, opts) {
  opts = opts || {};
  var bb = bboxOf(areas.map(function (a) { return a.d; }));
  var pad = (bb[2]-bb[0]) * 0.03 + 4;
  var vb = [bb[0]-pad, bb[1]-pad, (bb[2]-bb[0])+pad*2, (bb[3]-bb[1])+pad*2];
  var labels = '';
  if (opts.labels) {
    labels = areas.filter(function (a) { return a.label; }).map(function (a) {
      var b = bboxOf([a.d]);
      if ((b[2]-b[0]) < vb[2] * 0.045) return '';   // too small to letter
      return '<text class="maplab" x="' + ((b[0]+b[2])/2).toFixed(1) + '" y="' + ((b[1]+b[3])/2).toFixed(1) +
        '" text-anchor="middle" style="font-size:' + (vb[2]*0.0135).toFixed(1) + 'px">' + esc(a.label) + '</text>';
    }).join('');
  }
  return '<div class="mapwrap">' +
    '<svg viewBox="' + vb.map(function (n) { return n.toFixed(1); }).join(' ') + '" role="img" aria-label="' +
      esc(opts.aria || 'Map of Nigeria') + '">' + PATTERNS +
      areas.map(function (a) {
        return '<path class="area' + (a.sel ? ' sel' : '') + '" d="' + a.d + '" fill="' + a.fill + '"' +
          (a.id ? ' data-area="' + esc(a.id) + '"' : '') + ' ' + tipAttr(a.tip) + '></path>';
      }).join('') + labels +
    '</svg>' +
    (opts.tools === false ? '' :
      '<div class="maptools"><button title="Zoom in">+</button><button title="Zoom out">–</button><button title="Reset">⤢</button></div>') +
    '</div>';
}

/* Geometry is keyed by the shapefile's own state spelling, which differs from
   the ETL's in case ("Fct" vs "FCT"). Match on a normalised key so a casing
   difference cannot silently drop a state off the map. */
var GEO_S = {};
Object.keys(D.geo.s).forEach(function (k) { GEO_S[k.toLowerCase().replace(/[^a-z]/g,'')] = D.geo.s[k]; });
function geoState(name) { return GEO_S[String(name).toLowerCase().replace(/[^a-z]/g,'')]; }

/* Share of a node's facilities in the Not-ready band — the measure a rollout
   plan is actually built from, and the one with real spread across states. */
function pctNotReady(o) { return o.n ? o.d[0] / o.n * 100 : null; }

/* Fit the ramp to the observed range rather than 0–100. Across the 12 assessed
   states the measure runs 21%–86%, so a fixed 0–100 domain drops eight of them
   into one step and the map stops discriminating. Legend prints real values, so
   a fitted domain is honest. */
var NR_DOMAIN = (function () {
  var vs = D.states.filter(function (s) { return s.g === 1; })
    .map(pctNotReady).filter(function (v) { return v != null; });
  return [Math.floor(Math.min.apply(null, vs)), Math.ceil(Math.max.apply(null, vs))];
})();

function stateAreas(opts) {
  opts = opts || {};
  return D.states.map(function (s) {
    var d = geoState(s.nm); if (!d) return null;
    var primary = s.g === 1;
    var v = primary ? pctNotReady(s) : null;
    var tip = s.nm + '\n' + (primary
      ? v.toFixed(1) + '% not ready (' + s.d[0] + ' of ' + fmt(s.n) + ')' +
        '\navg ' + f2(s.avg) + ' · ready ' + s.d[2] + ' · moderate ' + s.d[1]
      : 'Desk review only — no facility-level findings');
    return { d:d, fill:seqFill(v, NR_DOMAIN[0], NR_DOMAIN[1]), tip:tip, id:s.id, label:s.nm, sel:opts.sel === s.id };
  }).filter(Boolean);
}

/* Returns { areas, domain }. The domain is fitted to the LGAs actually drawn:
   inside one state the scores cluster in a band or two of the 1–5 scale, so a
   fixed 1–5 ramp renders the whole state one flat colour. The legend prints the
   fitted bounds, so the reader is never guessing what a step means. */
function lgaAreas(stateId, themeKey) {
  var keys = Object.keys(D.geo.l).filter(function (k) { return !stateId || D.geo.l[k].s === stateId; });
  var vals = keys.map(function (k) {
    var l = LGA_BY_ID[k]; return l ? scoreFor(l, themeKey) : null;
  }).filter(function (v) { return v != null; });
  var lo = vals.length ? Math.min.apply(null, vals) : 1;
  var hi = vals.length ? Math.max.apply(null, vals) : 5;
  if (hi - lo < 0.4) { lo = Math.max(1, lo - 0.2); hi = Math.min(5, hi + 0.2); }  // near-uniform scope
  var areas = keys.map(function (k) {
    var g = D.geo.l[k], lga = LGA_BY_ID[k];
    var v = lga ? scoreFor(lga, themeKey) : null;
    return {
      d: g.d, fill: seqFill(v, lo, hi), id: k, label: g.n,
      tip: g.n + (lga && v != null
        ? '\n' + fmt(lga.n) + ' facilities · ' + f2(v) + ' / 5 · ' + BLABEL[bandOf(v)]
        : '\nnot assessed')
    };
  });
  return { areas: areas, domain: [lo, hi] };
}

var LGA_BY_ID = {}; D.lgas.forEach(function (l) { LGA_BY_ID[l.id] = l; });
var STATE_BY_ID = {}; D.states.forEach(function (s) { STATE_BY_ID[s.id] = s; });
var PRIMARY = D.states.filter(function (s) { return s.g === 1; });

function scoreFor(node, themeKey) {
  if (!themeKey || themeKey === 'all') return node.avg;
  var i = THEMES.indexOf(themeKey);
  if (i >= 0) return node.ts[i];
  return node.avg;
}

// ══════════════════ SCREENS ══════════════════

// ── Landing ──────────────────────────────────────────────────────────
function scrLanding() {
  var n = D.nat, t = n.d[0] + n.d[1] + n.d[2];
  var w = [];
  var counts = [['ready', Math.round(n.d[2]/t*100)], ['moderate', Math.round(n.d[1]/t*100)]];
  var nReady = counts[0][1], nMod = counts[1][1], nNot = 100 - nReady - nMod;
  [['ready',nReady],['moderate',nMod],['notready',nNot]].forEach(function (p) {
    for (var i = 0; i < p[1]; i++) {
      w.push('<i class="tex-' + p[0] + '" ' + tipAttr(BLABEL[p[0]]) + '></i>');
    }
  });
  var lowest = Object.keys(n.sub).sort(function (a,b) { return n.sub[a]-n.sub[b]; })[0];
  var highest = Object.keys(n.sub).sort(function (a,b) { return n.sub[b]-n.sub[a]; })[0];

  return '<div class="landing"><div class="lwrap">' +
    '<div class="lnav">' +
      '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="width:26px;height:26px;border:1.5px solid var(--ink);border-radius:3px;display:grid;place-items:center;font-family:var(--mono);font-size:11px;font-weight:700">ER</span>' +
        '<b style="font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase">NPHCDA · EMR readiness</b>' +
      '</div>' +
      '<button class="btn btn--primary" data-go="home">Enter the dashboard ' + svgi('next',14) + '</button>' +
    '</div>' +

    '<div class="lhero">' +
      '<div>' +
        '<p class="eyebrow">National assessment · 2026</p>' +
        '<h1 class="lede">Nigeria\'s health facilities are ready in people and <em>unready in power</em>.</h1>' +
        '<p class="note" style="font-size:14px">Of ' + fmt(n.n) + ' primary healthcare facilities assessed across 12 states, ' +
          fmt(n.d[2]) + ' can run an electronic medical record today. The constraint is not staff ' +
          'willingness or data habits — both score near the top of the instrument. It is electricity, ' +
          'connectivity and backup.</p>' +
        '<div class="lcta">' +
          '<button class="btn btn--primary" data-go="home">Enter the dashboard ' + svgi('next',14) + '</button>' +
          '<button class="btn" data-go="explore">' + svgi('compass',14) + ' Explore the findings</button>' +
        '</div>' +
      '</div>' +
      '<div>' +
        '<p class="eyebrow">Every hundred facilities</p>' +
        '<div class="waffle">' + w.join('') + '</div>' +
        '<p class="fine" style="margin-top:10px">One tile is one per cent of the ' + fmt(t) +
          ' facilities with a computed readiness band. ' + nReady + ' are ready.</p>' +
        '<ul class="legend" style="margin-top:12px">' +
          '<li><i class="tex-ready"></i>Ready</li><li><i class="tex-moderate"></i>Moderate</li>' +
          '<li><i class="tex-notready"></i>Not ready</li></ul>' +
      '</div>' +
    '</div>' +

    '<div class="lfacts">' +
      '<div class="lfact"><div class="v">37</div><div class="k">States &amp; FCT</div></div>' +
      '<div class="lfact"><div class="v">' + fmt(D.lgas.length) + '</div><div class="k">LGAs covered</div></div>' +
      '<div class="lfact"><div class="v">' + fmt(n.n) + '</div><div class="k">Facilities assessed</div></div>' +
      '<div class="lfact"><div class="v">12</div><div class="k">States visited</div></div>' +
    '</div>' +

    '<div class="grid g2" style="margin:26px 0 46px">' +
      '<div class="panel"><div class="body">' +
        '<p class="eyebrow">Strongest sub-theme</p>' +
        '<div style="font-size:28px;font-weight:600;letter-spacing:-.03em;line-height:1" class="num">' + f2(n.sub[highest]) + '<s style="text-decoration:none;font-size:13px;color:var(--ink-3);font-weight:500;margin-left:4px">/5</s></div>' +
        '<div class="h3" style="margin-top:7px">' + (SUBLAB[highest.split('.')[1]]) + '</div>' +
        '<p class="note">Staff expect and accept the move to digital records.</p>' +
      '</div></div>' +
      '<div class="panel"><div class="body">' +
        '<p class="eyebrow">Weakest sub-theme</p>' +
        '<div style="font-size:28px;font-weight:600;letter-spacing:-.03em;line-height:1" class="num">' + f2(n.sub[lowest]) + '<s style="text-decoration:none;font-size:13px;color:var(--ink-3);font-weight:500;margin-left:4px">/5</s></div>' +
        '<div class="h3" style="margin-top:7px">' + (SUBLAB[lowest.split('.')[1]]) + '</div>' +
        '<p class="note">Almost no facility has a fallback when the primary link drops.</p>' +
      '</div></div>' +
    '</div>' +
  '</div></div>';
}

// ── Overview (home) ──────────────────────────────────────────────────
function scrHome() {
  var n = D.nat;
  var tiles = '<div class="tiles g4">' +
    BANDS.slice().reverse().map(function (b) {
      var i = BANDS.indexOf(b), v = n.d[i], t = n.n;
      return '<div class="tile"><div class="k"><i class="tex-' + b + '"></i>' + BLABEL[b] + '</div>' +
        '<div class="v">' + fmt(v) + '<s>' + (v/t*100).toFixed(1) + '%</s></div>' +
        '<div class="a">' + BACTION[b] + '</div></div>';
    }).join('') +
    '<div class="tile"><div class="k">National average</div>' +
      '<div class="v">' + f2(n.avg) + '<s>/5</s></div>' +
      '<div class="a">' + BLABEL[bandOf(n.avg)] + '</div></div>' +
    '</div>';

  // domain small multiples
  var panels = THEMES.filter(function (t) { return t !== 'leadership_governance'; }).map(function (t, i) {
    var v = n.ts[THEMES.indexOf(t)];
    return '<section class="panel"><header style="flex-wrap:wrap"><span class="t">' + TLABEL[t] + '</span>' +
      '<span class="s r mono" style="font-size:14px;font-weight:600">' + f2(v) + '<span style="font-size:10px;color:var(--ink-3);letter-spacing:.08em"> /5</span></span>' +
      '<div style="flex-basis:100%;margin-top:6px">' + maturityChip(v) + '</div></header>' +
      '<div class="body" style="display:flex;flex-direction:column;height:100%">' +
      '<div class="rows" style="flex:1 0 auto">' + subRows(n.sub, t) + '</div>' +
      '<div class="axis"><span>1</span><span>3</span><span>5</span></div>' +
      '</div></section>';
  }).join('');

  var lead = n.ts[4];
  var floors = PRIMARY.filter(function (s) { return s.ts[4] === 1; }).map(function (s) { return s.nm; });

  var invByTheme = {};
  n.inv.forEach(function (i) { invByTheme[i.t] = (invByTheme[i.t]||0) + (i.q||0); });
  var invTotal = Object.keys(invByTheme).reduce(function (a,k) { return a + invByTheme[k]; }, 0);
  var invMax = Math.max.apply(null, THEMES.map(function (t) { return invByTheme[t]||0; }));

  return '<div class="page">' +

  '<section style="margin-bottom:22px">' +
    '<p class="eyebrow">The finding</p>' +
    '<h2 class="h2" style="font-size:24px;max-width:30ch">Ready in people, unready in power</h2>' +
    '<p class="note">Change readiness, digital familiarity and routine data use are the three ' +
      'highest-scoring sub-themes in the instrument. Connectivity resilience, data resilience and ' +
      'device sustainability are the three lowest. The gap is infrastructure, and specifically the ' +
      'resilience of it — what keeps a system running rather than what starts it.</p>' +
  '</section>' +

  tiles +

  '<section style="margin-top:24px">' +
    '<p class="eyebrow">Where the gap is · 19 sub-themes against the national mean of ' + f2(MEAN) + '</p>' +
    '<div class="grid g4">' + panels + '</div>' +
    '<div class="panel" style="border-top:0;border-left-width:2px;border-left-color:var(--notready);background:var(--surface-sunk)">' +
      '<div class="body" style="display:grid;grid-template-columns:minmax(0,180px) minmax(0,1fr) minmax(0,260px);gap:22px;align-items:center">' +
        '<div><div class="h3">' + TLABEL.leadership_governance + '</div>' +
          '<div class="fine">no sub-themes · state-scored</div>' +
          '<div class="num" style="font-size:32px;font-weight:600;letter-spacing:-.03em;line-height:1;margin-top:7px">' + f2(lead) + '<s style="text-decoration:none;font-size:13px;color:var(--ink-3);font-weight:500;margin-left:3px">/5</s></div>' +
          '<div style="margin-top:7px">' + maturityChip(lead) + '</div></div>' +
        '<div>' + trackBar(lead, TLABEL.leadership_governance + '\n' + f2(lead) + ' / 5 · ' + BLABEL[bandOf(lead)]) +
          '<div class="axis"><span>1</span><span>mean ' + f2(MEAN) + ' │</span><span>5</span></div>' +
          '<p class="note" style="margin-top:9px">The weakest domain, and the only one with no sub-themes ' +
          'to diagnose and no costed remedy to fund — it is measured at state level, while the instrument ' +
          'triggers actions at facility level.</p></div>' +
        '<div><p class="eyebrow" style="margin-bottom:7px">At the instrument floor (1.0)</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:5px">' + floors.map(function (f) {
            return '<span class="mono" style="font-size:10.5px;border:1px solid var(--rule-2);padding:3px 7px;background:var(--surface)">' + f + '</span>';
          }).join('') + '</div>' +
          '<p class="fine" style="margin-top:8px">' + floors.length + ' of the 12 assessed states score the minimum possible value.</p></div>' +
      '</div>' +
    '</div>' +
  '</section>' +

  '<section class="grid g2" style="margin-top:24px;align-items:start">' +
    '<div class="panel"><header><span class="t">Where the not-ready facilities are</span>' +
      '<button class="btn r" data-go="states" style="padding:3px 9px;font-size:11.5px">Open ' + svgi('next',12) + '</button></header>' +
      '<div class="body">' + mapSVG(stateAreas(), { labels:false, tools:false, aria:'Share of facilities not ready, by state' }) +
      scaleLegend(NR_DOMAIN[0], NR_DOMAIN[1], function (v) { return Math.round(v) + '%'; },
        'Share of facilities not ready',
        'Hover a state to name it. The 25 desk-review states carry no facility-level findings.') +
      '</div></div>' +

    '<div class="panel"><header><span class="t">Investment required</span>' +
      '<span class="s">' + fmt(invTotal) + ' costed items</span>' +
      '<button class="btn r" data-go="states" style="padding:3px 9px;font-size:11.5px">Detail ' + svgi('next',12) + '</button></header>' +
      '<div class="body"><div class="rows">' +
        THEMES.map(function (t) {
          var q = invByTheme[t] || 0;
          return '<div class="row2"><div class="lab"><span' + (q?'':' style="color:var(--ink-3)"') + '>' + TLABEL[t] + '</span><b>' + (q ? fmt(q) : 'none') + '</b></div>' +
            '<div class="track" ' + tipAttr(TLABEL[t] + '\n' + (q ? fmt(q) + ' items · ' + (q/invTotal*100).toFixed(1) + '% of total' : 'no costed items')) + '>' +
            '<b style="width:' + (q ? (q/invMax*100).toFixed(1) : 0) + '%' + (q?'':';background:var(--nodata)') + '"></b></div></div>';
        }).join('') +
      '</div>' +
      '<div class="callout" style="margin-top:16px"><div class="k">The hole in the plan</div>' +
      '<p><b>Leadership &amp; Governance is the weakest domain at ' + f2(lead) + '</b> and carries ' +
      '<b>zero</b> costed items. The cheapest domain to fix is the one no line item touches.</p></div>' +
      '</div></div>' +
  '</section>' +

  '</div>';
}

// ── National Coverage ────────────────────────────────────────────────────
function scrStates() {
  var rows = D.states.filter(function (s) {
    if (S.sFilter.state && s.id !== S.sFilter.state) return false;
    if (S.sFilter.band) {
      if (S.sFilter.band === 'secondary') return s.g === 0;
      if (s.g === 0 || BANDS[s.b] !== S.sFilter.band) return false;
    }
    return true;
  });
  var prim = rows.filter(function (s) { return s.g === 1; });
  prim.sort(function (a,b) { return b.avg - a.avg; });
  var sec = rows.filter(function (s) { return s.g === 0; });

  var n = D.nat;
  var invByTheme = {}; n.inv.forEach(function (i) { invByTheme[i.t] = (invByTheme[i.t]||0) + (i.q||0); });
  var invTotal = Object.keys(invByTheme).reduce(function (a,k){ return a+invByTheme[k]; },0);

  return '<div class="page">' +

  '<div class="tiles g4" style="margin-bottom:18px">' +
    '<div class="tile"><div class="k">Assessed by facility survey</div><div class="v">12<s>states</s></div>' +
      '<div class="a">' + fmt(n.n) + ' facilities scored</div></div>' +
    '<div class="tile"><div class="k">Desk review only</div><div class="v">25<s>+ FCT</s></div>' +
      '<div class="a">No facility-level readiness</div></div>' +
    '<div class="tile"><div class="k">National average</div><div class="v">' + f2(n.avg) + '<s>/5</s></div>' +
      '<div class="a">' + BLABEL[bandOf(n.avg)] + '</div></div>' +
    '<div class="tile"><div class="k">Composite readiness</div><div class="v">' + f2(n.comp) + '<s>/5</s></div>' +
      '<div class="a">Weighted 5·ready + 3·mod + 1·not</div></div>' +
  '</div>' +

  '<div class="grid g2" style="align-items:start">' +
    '<div class="panel"><header><span class="t">Where the not-ready facilities are</span>' +
      '<span class="s">37 states · click to filter the table</span></header>' +
      '<div class="body">' +
        mapSVG(stateAreas({ sel:S.sFilter.state }), { labels:false, aria:'Share of facilities not ready, by state' }) +
        scaleLegend(NR_DOMAIN[0], NR_DOMAIN[1], function (v) { return Math.round(v) + '%'; },
          'Share of facilities not ready',
          'The map carries a share, not a band: all 12 assessed states classify to the same ' +
          'state-level band, so a band map would paint twelve identical polygons. The 45° hatch is ' +
          'evidence grade — those 25 states were desk-reviewed and are counted in no average.') +
      '</div></div>' +

    '<div class="panel"><header><span class="t">Domain scores, nationally</span>' +
      '<span class="s">1–5 rubric</span></header><div class="body">' +
      '<div class="rows">' + THEMES.map(function (t, i) {
        var v = n.ts[i];
        return '<div class="row2"><div class="lab"><span>' + TLABEL[t] + '</span>' +
          '<span style="display:inline-flex;align-items:center;gap:11px">' + maturityChip(v) +
          '<b>' + bandMark(v) + f2(v) + '</b></span></div>' +
          trackBar(v, TLABEL[t] + '\n' + f2(v) + ' / 5 · ' + BLABEL[bandOf(v)] +
            (maturityOf(v)!=null ? ' · ' + MATURITY[maturityOf(v)].label : '')) + '</div>';
      }).join('') + '</div>' +
      '<div class="axis"><span>1</span><span>national mean ' + f2(MEAN) + ' │</span><span>5</span></div>' +
      '<p class="note" style="margin-top:13px">Two domains sit below the Not-ready cut of 2.9: Technical ' +
      'Infrastructure and Leadership &amp; Governance. Those two decide the national picture; the other ' +
      'three are already above the mean.</p>' +
      '</div></div>' +
  '</div>' +

  '<section class="panel" style="margin-top:18px"><header>' +
    '<span class="t">The 12 assessed states, ranked</span>' +
    '<span class="s">composition, not average, is what a rollout plan needs</span>' +
    '<ul class="legend r"><li><i class="tex-ready"></i>Ready</li><li><i class="tex-moderate"></i>Moderate</li><li><i class="tex-notready"></i>Not ready</li></ul>' +
  '</header><div class="body"><div class="scroller"><table class="ledger"><thead><tr>' +
    '<th></th><th>State</th><th style="min-width:170px">Readiness composition</th>' +
    '<th class="r">Ready</th><th class="r">Facilities</th><th class="r">Avg</th>' +
    '<th class="r">Tech. infra.</th><th class="r">Leadership</th><th class="r"></th>' +
  '</tr></thead><tbody>' +
    prim.map(function (s, i) {
      return '<tr class="clickable" data-state="' + s.id + '">' +
        '<td class="rk">' + String(i+1).padStart(2,'0') + '</td>' +
        '<td class="st">' + s.nm + '</td>' +
        '<td>' + stackBar(s, s.nm) + '</td>' +
        '<td class="r">' + s.d[2] + '</td>' +
        '<td class="r">' + fmt(s.n) + '</td>' +
        '<td class="r">' + f2(s.avg) + '</td>' +
        '<td class="r">' + bandMark(s.ts[0]) + f2(s.ts[0]) + '</td>' +
        '<td class="r">' + bandMark(s.ts[4]) + f2(s.ts[4]) + '</td>' +
        '<td class="r"><span style="color:var(--accent)">' + svgi('next',13) + '</span></td></tr>';
    }).join('') +
    (prim.length ? '<tr style="background:var(--surface-sunk)"><td class="rk"></td><td class="st">All 12</td>' +
      '<td>' + stackBar(n, 'All assessed states') + '</td><td class="r">' + n.d[2] + '</td>' +
      '<td class="r">' + fmt(n.n) + '</td><td class="r">' + f2(n.avg) + '</td>' +
      '<td class="r">' + bandMark(n.ts[0]) + f2(n.ts[0]) + '</td>' +
      '<td class="r">' + bandMark(n.ts[4]) + f2(n.ts[4]) + '</td><td></td></tr>' : '') +
  '</tbody></table></div>' +
  (sec.length ? '<div style="margin-top:16px"><p class="eyebrow">Desk review only — ' + sec.length + ' states, shown on the map, not ranked</p>' +
    '<div style="display:flex;flex-wrap:wrap;gap:5px">' + sec.map(function (s) {
      return '<span class="mono" style="font-size:10.5px;border:1px solid var(--rule-2);padding:3px 7px;color:var(--ink-2)">' + s.nm + '</span>';
    }).join('') + '</div></div>' : '') +
  '</div></section>' +

  '<section class="panel" style="margin-top:18px"><header>' +
    '<span class="t">Investment required</span>' +
    '<span class="s">' + fmt(invTotal) + ' items · itemised and costed on its own page</span>' +
    '<button class="btn r" data-go="investment" style="padding:3px 9px;font-size:11.5px">' +
      'Open the plan ' + svgi('next',12) + '</button>' +
  '</header><div class="body"><div class="rows">' +
    THEMES.map(function (t) {
      var q = invByTheme[t] || 0;
      var qm = Math.max.apply(null, THEMES.map(function (x) { return invByTheme[x] || 0; }));
      return '<div class="row2"><div class="lab">' +
        '<span' + (q ? '' : ' style="color:var(--ink-3)"') + '>' + TLABEL[t] + '</span>' +
        '<b>' + (q ? fmt(q) + ' items' : 'none') + '</b></div>' +
        '<div class="track" ' + tipAttr(TLABEL[t] + '\n' + (q ? fmt(q) + ' items · ' +
          (q/invTotal*100).toFixed(1) + '% of total' : 'no costed items')) + '>' +
        '<b style="width:' + (q ? (q/qm*100).toFixed(1) : 0) + '%' + (q?'':';background:var(--nodata)') + '"></b>' +
        '</div></div>';
    }).join('') +
  '</div>' +
  '<p class="fine" style="margin-top:12px">Unit and total costs, per-domain subtotals and the full ' +
  D.nat.inv.length + '-action schedule live on the Investment Plan page.</p>' +
  '</div></section>' +

  '</div>';
}

// ── Assessed States ────────────────────────────────────────────────
function scrAssessment() {
  var f = S.aFilter;
  var lgas = D.lgas.filter(function (l) {
    if (f.state && l.s !== f.state) return false;
    if (f.q && (l.nm + ' ' + (STATE_BY_ID[l.s]||{}).nm).toLowerCase().indexOf(f.q.toLowerCase()) < 0) return false;
    return true;
  });
  lgas.sort(function (a,b) { return b.avg - a.avg; });

  var scope = f.state ? STATE_BY_ID[f.state] : D.nat;
  var scopeName = f.state ? STATE_BY_ID[f.state].nm : 'All 12 assessed states';
  var t = scope.d[0] + scope.d[1] + scope.d[2];

  return '<div class="page">' +

  '<div class="tiles g4" style="margin-bottom:18px">' +
    '<div class="tile"><div class="k">Scope</div><div class="v" style="font-size:19px">' + scopeName + '</div>' +
      '<div class="a">' + fmt(scope.n) + ' facilities · ' + lgas.length + ' LGAs</div></div>' +
    BANDS.slice().reverse().map(function (b) {
      var i = BANDS.indexOf(b), v = scope.d[i];
      return '<div class="tile"><div class="k"><i class="tex-' + b + '"></i>' + BLABEL[b] + '</div>' +
        '<div class="v">' + fmt(v) + '<s>' + (v/t*100).toFixed(1) + '%</s></div>' +
        '<div class="a">' + BACTION[b] + '</div></div>';
    }).join('') +
  '</div>' +

  '<div class="grid g2" style="align-items:start">' +
    '<div class="panel"><header><span class="t">Domain scores</span>' +
      '<span class="s">' + scopeName + '</span></header><div class="body">' +
      '<div class="rows">' + THEMES.map(function (th, i) {
        var v = scope.ts[i];
        return '<div class="row2"><div class="lab"><span>' + TLABEL[th] + '</span>' +
          '<span style="display:inline-flex;align-items:center;gap:11px">' + maturityChip(v) +
          '<b>' + bandMark(v) + f2(v) + '</b></span></div>' +
          trackBar(v, TLABEL[th] + '\n' + f2(v) + ' / 5' + (v!=null?' · '+BLABEL[bandOf(v)]:'')) + '</div>';
      }).join('') + '</div>' +
      '<div class="axis"><span>1</span><span>national mean ' + f2(MEAN) + ' │</span><span>5</span></div>' +
      (f.state ? '<p class="fine" style="margin-top:11px">Leadership &amp; Governance is scored once per ' +
        'state, so it has no LGA-level value and does not vary inside this state.</p>' : '') +
      '</div></div>' +

    '<div class="panel"><header><span class="t">How the facilities split</span>' +
      '<span class="s">every facility falls in exactly one band</span></header><div class="body">' +
      '<div class="rows">' + BANDS.slice().reverse().map(function (b) {
        var i = BANDS.indexOf(b), v = scope.d[i], p = v/t*100;
        return '<div class="row2"><div class="lab"><span><i class="mark tex-' + b + '"></i>' + BLABEL[b] +
          '</span><b>' + fmt(v) + ' · ' + p.toFixed(1) + '%</b></div>' +
          '<div class="track" ' + tipAttr(BLABEL[b] + '\n' + fmt(v) + ' facilities · ' + p.toFixed(1) + '%') + '>' +
          '<b class="tex-' + b + '" style="width:' + p.toFixed(1) + '%"></b></div></div>';
      }).join('') + '</div>' +
      '<div class="callout" style="margin-top:16px"><div class="k">What the split means</div>' +
      '<p>The two lower bands are not the same problem. <b>Moderately ready</b> facilities need targeted ' +
      'fixes against named minimum requirements; <b>Not ready</b> facilities are blocked by a core domain ' +
      'and need foundational build first — no amount of training moves them.</p></div>' +
      '</div></div>' +
  '</div>' +

  '<section class="panel" style="margin-top:18px"><header>' +
    '<span class="t">LGAs ranked</span><span class="s">' + lgas.length + ' shown' +
    (f.state || f.q ? ' · filtered' : '') + '</span>' +
    '<ul class="legend r"><li><i class="tex-ready"></i>Ready</li><li><i class="tex-moderate"></i>Moderate</li><li><i class="tex-notready"></i>Not ready</li></ul>' +
  '</header><div class="body"><div class="scroller"><table class="ledger"><thead><tr>' +
    '<th></th><th>LGA</th><th>State</th><th style="min-width:150px">Composition</th>' +
    '<th class="r">Facilities</th><th class="r">Avg</th><th class="r">Tech. infra.</th><th class="r">Workforce</th><th class="r"></th>' +
  '</tr></thead><tbody>' +
    (lgas.length ? lgas.slice(0, 60).map(function (l, i) {
      return '<tr class="clickable" data-lga="' + l.id + '">' +
        '<td class="rk">' + String(i+1).padStart(2,'0') + '</td>' +
        '<td class="st">' + esc(l.nm) + '</td>' +
        '<td style="color:var(--ink-2);font-size:12px">' + ((STATE_BY_ID[l.s]||{}).nm||'') + '</td>' +
        '<td>' + stackBar(l, l.nm) + '</td>' +
        '<td class="r">' + fmt(l.n) + '</td>' +
        '<td class="r">' + f2(l.avg) + '</td>' +
        '<td class="r">' + bandMark(l.ts[0]) + f2(l.ts[0]) + '</td>' +
        '<td class="r">' + bandMark(l.ts[1]) + f2(l.ts[1]) + '</td>' +
        '<td class="r"><span style="color:var(--accent)">' + svgi('next',13) + '</span></td></tr>';
    }).join('') : '<tr><td colspan="9" style="padding:22px 0;text-align:center;color:var(--ink-3)">No LGA matches that filter.</td></tr>') +
  '</tbody></table></div>' +
  (lgas.length > 60 ? '<p class="fine" style="margin-top:11px">Showing the top 60 of ' + lgas.length +
    ' by average score. Narrow the filters, or open the Report Explorer to page through all of them.</p>' : '') +
  '</div></section>' +

  '</div>';
}

// ── Facility Scorecard ───────────────────────────────────────────────
function scrFacilities() {
  if (!S.facility) return facilityEmpty();
  return facilityCard();
}

function facilityEmpty() {
  var picks = [
    ['00019879','Oworo Primary Health Centre','Lagos'],
    null, null, null
  ];
  var samples = D.fac.filter(function (r) { return r[3] === 2; }).slice(0, 3);
  return '<div class="page">' +
    '<div class="panel"><div class="empty"><div class="in">' +
      svgi('clip',26) +
      '<h3 style="margin-top:12px">Choose a facility</h3>' +
      '<p>Pick a state, then an LGA, then a facility from the bar above — or jump ' +
      'straight to one of these.</p>' +
      '<div class="picks">' +
        '<button class="pick" data-fac="00019879">Oworo PHC <span class="fine">Lagos</span></button>' +
        samples.map(function (r) {
          return '<button class="pick" data-fac="' + r[5] + '">' + esc(r[0]) + ' <span class="fine">' +
            ((D.states[r[1]]||{}).nm||'') + '</span></button>';
        }).join('') +
      '</div>' +
      '<p class="fine" style="margin-top:16px">' + fmt(D.fac.length) + ' facilities have a scorecard.</p>' +
    '</div></div></div></div>';
}

function facilityCard() {
  var o = D.one;   // the one fully-modelled facility in this mockup
  var byId = {}; o.ts.forEach(function (t) { byId[t.t] = t; });
  var ti = byId.technical_infrastructure, wc = byId.workforce_capacity;
  var core = Math.min.apply(null, [ti && ti.s, wc && wc.s].filter(function (v) { return v != null; }));
  var sup = [byId.workflow_transition, byId.data_use_reporting]
    .map(function (t) { return t && t.s; }).filter(function (v) { return v != null; });
  var supMin = sup.length ? Math.min.apply(null, sup) : null;
  var verdict = core <= CUT_LO ? 'notready' : (core > CUT_HI && supMin != null && supMin >= FLOOR ? 'ready' : 'moderate');

  var CORE = { technical_infrastructure:1, workforce_capacity:1 };
  var gateRows = THEMES.filter(function (t) { return t !== 'leadership_governance'; }).map(function (t) {
    var e = byId[t], v = e ? e.s : null;
    var isCore = !!CORE[t];
    var fail = isCore && v != null && v <= CUT_LO;
    if (v == null) {
      return '<div class="gate-row"><div class="g-name">' + TLABEL[t] +
        '<u>' + (isCore ? 'core gate' : 'supporting · floor ' + FLOOR.toFixed(1)) + '</u></div>' +
        '<div class="gt tex-nodata" ' + tipAttr(TLABEL[t] + '\nnot scored — too few measured indicators') + '></div>' +
        '<div class="g-val" style="color:var(--ink-3)">n/s' +
        '<div style="margin-top:4px">' + maturityChip(null) + '</div></div></div>';
    }
    var b = bandOf(v);
    var cutAt = isCore ? CUT_LO : FLOOR;
    return '<div class="gate-row' + (fail ? ' fail' : '') + '">' +
      '<div class="g-name">' + TLABEL[t] + '<u>' + (isCore ? 'core gate · cut 2.9' : 'supporting · floor ' + FLOOR.toFixed(1)) + '</u></div>' +
      '<div class="gt" ' + tipAttr(TLABEL[t] + '\n' + f2(v) + ' / 5 · ' + BLABEL[b] + '\n' + (isCore ? 'core gate cuts at 2.9' : 'supporting floor 2.5')) + '>' +
        '<b style="width:' + pct(v).toFixed(1) + '%;background:var(--' + (b === 'moderate' ? 'moderate' : b) + ')"></b>' +
        '<u style="left:' + pct(cutAt).toFixed(1) + '%"></u></div>' +
      '<div class="g-val">' + f2(v) + '<div style="margin-top:4px">' + maturityChip(v) + '</div></div></div>';
  }).join('');

  // requirements grouped by theme
  var groups = {};
  o.req.forEach(function (r) {
    var meta = D.reqs[r.id]; if (!meta) return;
    (groups[meta.t] = groups[meta.t] || []).push({ l:meta.l, met:r.met, m:r.measured });
  });
  var reqCols = Object.keys(groups).map(function (t) {
    var items = groups[t];
    var met = items.filter(function (i) { return i.met === true; }).length;
    items.sort(function (a,b) {
      var rank = function (i) { return i.met === false ? 0 : (i.met === true ? 1 : 2); };
      return rank(a) - rank(b);
    });
    return '<div class="panel reqcol"><div class="body">' +
      '<h4>' + TLABEL[t] + ' — ' + met + ' of ' + items.length + ' met</h4><ul>' +
      items.map(function (i) {
        var cls = i.met === false ? 'miss' : (i.met === true ? 'have' : 'unk');
        var ic = i.met === false ? CROSS : (i.met === true ? TICK : DASH);
        return '<li class="' + cls + '">' + ic + '<span>' + esc(i.l) + (i.m === false ? ' — not measured' : '') + '</span></li>';
      }).join('') + '</ul></div></div>';
  }).join('');

  var invByT = {};
  o.inv.forEach(function (i) { (invByT[i.t] = invByT[i.t] || []).push(i); });

  var d = o.der;

  return '<div class="page">' +
  '<div class="panel"><header style="align-items:flex-start;padding:16px 16px 15px">' +
    '<div style="min-width:0">' +
      '<div class="fine" style="letter-spacing:.11em;text-transform:uppercase">' + esc(o.lga) + ' LGA · ' +
        esc(o.state) + ' · ' + esc(o.fl) + ' · ' + esc(o.geo) + (o.bhcpf ? ' · BHCPF' : '') + '</div>' +
      '<div style="font-size:18px;font-weight:600;letter-spacing:-.014em;margin-top:4px">' + esc(o.nm) + '</div>' +
      '<div class="note" style="margin-top:3px;font-size:12.5px">' +
        d.servicePointCount + ' service points · ' + d.deviceCount + ' devices · ' +
        (d.usesAnyDigitalSystem ? 'already using a digital system' : 'no digital system') +
        ' · officer in charge ' + esc(o.oic) + ' (' + esc(o.cadre) + ')</div>' +
    '</div>' +
    '<div class="r" style="text-align:right;flex:none">' + bandChip(verdict) +
      '<div style="margin-top:7px;display:flex;justify-content:flex-end">' + maturityChip(o.avg, true) + '</div>' +
      '<div class="note" style="margin-top:6px;font-size:12.5px;max-width:32ch">Blocked by one core domain. Foundational investment first.</div>' +
    '</div>' +
  '</header>' +

  '<div class="body">' + gateRows +
    '<div class="gate-note">Average domain score is <b>' + f2(o.avg) + '</b> — and it does not decide the band. ' +
    'The rule is <code>core = min(' + f2(ti.s) + ', ' + f2(wc.s) + ') = ' + f2(core) + '</code>, and ' +
    '<code>' + f2(core) + ' ≤ 2.9</code>, so this facility is <b>' + BLABEL[verdict] + '</b>. ' +
    'Technical Infrastructure has to clear 2.9 before anything else counts. Hairlines mark the cuts.</div>' +
  '</div></div>' +

  '<section style="margin-top:18px">' +
    '<p class="eyebrow">Where the score comes from</p>' +
    '<div class="grid g4">' + o.ts.filter(function (t) { return Object.keys(t.sub||{}).length; }).map(function (t) {
      return '<div class="panel"><header style="flex-wrap:wrap"><span class="t">' + TLABEL[t.t] + '</span>' +
        '<span class="s r mono" style="font-size:14px;font-weight:600">' + f2(t.s) + '</span>' +
        '<div style="flex-basis:100%;margin-top:6px">' + maturityChip(t.s) + '</div></header>' +
        '<div class="body" style="display:flex;flex-direction:column;height:100%">' +
        '<div class="rows" style="flex:1 0 auto">' + subRows(t.sub, t.t) + '</div>' +
        '<div class="axis"><span>1</span><span>3</span><span>5</span></div></div></div>';
    }).join('') + '</div>' +
  '</section>' +

  '<section style="margin-top:18px">' +
    '<p class="eyebrow">Minimum requirements · ' +
      o.req.filter(function (r) { return r.met === true; }).length + ' of ' + o.req.length + ' met</p>' +
    '<div class="grid g4">' + reqCols + '</div>' +
  '</section>' +

  '<section class="panel" style="margin-top:18px"><header>' +
    '<span class="t">What this facility needs</span>' +
    '<span class="s">' + o.inv.length + ' actions, ordered by priority</span>' +
    '<button class="btn r" style="padding:3px 9px;font-size:11.5px">' + svgi('down',12) + ' Export scorecard</button>' +
  '</header><div class="body"><div class="scroller"><table class="ledger"><thead><tr>' +
    '<th>Action</th><th>Domain</th><th class="r">Quantity</th><th class="r">Priority</th>' +
  '</tr></thead><tbody>' +
    o.inv.slice().sort(function (a,b) {
      var r = { high:0, medium:1, low:2 };
      return r[a.p] - r[b.p];
    }).map(function (i) {
      return '<tr><td class="wrap">' + esc(i.l) + '</td>' +
        '<td style="color:var(--ink-2);font-size:12px">' + TSHORT[i.t] + '</td>' +
        '<td class="r">' + fmt(i.q) + '</td>' +
        '<td class="r"><span class="pri' + (i.p==='high'?' pri--high':'') + '">' + i.p + '</span></td></tr>';
    }).join('') +
  '</tbody></table></div>' +
  '<p class="fine" style="margin-top:11px">Naira costs are omitted throughout: the source workbook has no ' +
  'signed-off unit cost table, so this is a volume of work rather than a budget.</p>' +
  '</div></section>' +

  '<section class="panel" style="margin-top:18px"><header><span class="t">Service points</span>' +
    '<span class="s">' + d.servicePointCount + ' present · where data actually gets captured</span></header>' +
    '<div class="body"><div class="scroller"><table class="ledger"><thead><tr>' +
      '<th>Service point</th><th class="r">Present</th><th class="r">Working device</th><th class="r">Digital system</th>' +
    '</tr></thead><tbody>' +
    o.sp.map(function (p) {
      var yn = function (v) { return v ? TICK : CROSS; };
      return '<tr><td>' + esc(p.l) + '</td><td class="r">' + yn(p.present) + '</td>' +
        '<td class="r">' + yn(p.dev) + '</td>' +
        '<td class="r" style="font-size:12px;color:var(--ink-2)">' + (p.sys ? esc(p.sys) : '—') + '</td></tr>';
    }).join('') +
    '</tbody></table></div></div></section>' +

  '</div>';
}

// ── Report Explorer ──────────────────────────────────────────────
function scrExplore() {
  var themeKey = S.xTheme;
  var scope = S.xState ? STATE_BY_ID[S.xState] : D.nat;
  var scopeName = S.xState ? STATE_BY_ID[S.xState].nm : 'Nigeria';

  // tree
  var tree = '<button class="tnode" aria-pressed="' + (themeKey==='all') + '" data-theme="all">' +
    '<span class="tcaret"></span><span>All themes <span class="tw">overall</span></span>' +
    '<span class="sc">' + f2(scope.avg) + '</span></button>';
  THEMES.forEach(function (t, i) {
    var v = scope.ts[i];
    var open = !!S.xOpen[t];
    var subs = Object.keys(D.nat.sub).filter(function (k) { return k.indexOf(t + '.') === 0; });
    tree += '<button class="tnode" aria-pressed="' + (themeKey===t) + '" data-theme="' + t + '">' +
      '<span class="tcaret">' + (subs.length ? (open ? '−' : '+') : '') + '</span>' +
      '<span>' + TLABEL[t] + (subs.length ? '' : ' <span class="tw">state</span>') + '</span>' +
      '<span class="sc">' + f2(v) + '</span></button>';
    if (open) {
      subs.sort(function (a,b) { return D.nat.sub[b] - D.nat.sub[a]; });
      subs.forEach(function (k) {
        tree += '<div class="tnode sub"><span></span><span>' + (SUBLAB[k.split('.')[1]]||k) + '</span>' +
          '<span class="sc">' + f2(D.nat.sub[k]) + '</span></div>';
      });
    }
  });

  // map: national → states, drilled → LGAs of that state
  var lg = S.xState ? lgaAreas(S.xState, themeKey) : null;
  var areas = lg ? lg.areas : stateAreas({ sel:null });
  var mapNote = S.xState
    ? Object.keys(D.geo.l).filter(function (k) { return D.geo.l[k].s === S.xState; }).length + ' LGAs in ' + scopeName
    : '37 states — click one to drill into its LGAs';

  // ranked rows at the current level
  var rows, cols;
  if (S.xState) {
    rows = D.lgas.filter(function (l) { return l.s === S.xState; });
    cols = 'LGA';
  } else {
    rows = PRIMARY.slice();
    cols = 'State';
  }
  rows.sort(function (a,b) {
    var av = S.xAgg === 'ready' ? (a.d[2]/(a.n||1)) : scoreFor(a, themeKey);
    var bv = S.xAgg === 'ready' ? (b.d[2]/(b.n||1)) : scoreFor(b, themeKey);
    return bv - av;
  });

  var facRows = [];
  if (S.xState) {
    facRows = D.fac.filter(function (r) { return (D.states[r[1]]||{}).id === S.xState; }).slice(0, 12);
  }

  return '<div class="page">' +
  '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px">' +
    '<div class="crumbs"><button data-x-state="">Nigeria</button>' +
      (S.xState ? '<span class="sep">/</span><b>' + scopeName + '</b>' : '') +
    '</div>' +
    '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">' +
      '<span class="fine" style="letter-spacing:.11em;text-transform:uppercase">Aggregate by</span>' +
      '<div class="themeset" style="width:auto">' +
        '<button class="btn" style="border:0;padding:4px 10px;font-size:12px' + (S.xAgg==='mean'?';background:var(--surface);font-weight:600;color:var(--ink)':'') + '" data-agg="mean">Mean score</button>' +
        '<button class="btn" style="border:0;padding:4px 10px;font-size:12px' + (S.xAgg==='ready'?';background:var(--surface);font-weight:600;color:var(--ink)':'') + '" data-agg="ready">% Ready</button>' +
      '</div>' +
      '<button class="btn">' + svgi('down',12) + ' Export view</button>' +
    '</div>' +
  '</div>' +

  '<div style="display:grid;grid-template-columns:258px minmax(0,1fr) 268px;gap:14px;align-items:start" class="xgrid">' +

    '<div class="panel"><header><span class="t">Thematic area</span></header>' +
      '<div class="tree">' + tree + '</div>' +
      '<div class="body" style="border-top:1px solid var(--rule)"><p class="fine">' +
      'Click a domain to recolour the map and re-rank the table. Leadership &amp; Governance has no ' +
      'sub-themes — it is scored once per state.</p></div></div>' +

    '<div class="panel"><header><span class="t">' +
      (themeKey === 'all' ? 'Overall readiness' : TLABEL[themeKey]) + '</span>' +
      '<span class="s">' + mapNote + '</span></header>' +
      '<div class="body">' + mapSVG(areas, { labels:!!S.xState, aria:'Readiness map' }) +
      (S.xState
        ? scaleLegend(lg.domain[0], lg.domain[1], function (v) { return v.toFixed(2); },
            (themeKey === 'all' ? 'Mean score' : TLABEL[themeKey] + ' score') + ' · fitted to this state',
            'Steps are fitted to the range actually present in ' + scopeName + ' (' +
            f2(lg.domain[0]) + '–' + f2(lg.domain[1]) + ' of 5), because a fixed 1–5 ramp renders ' +
            'one state almost uniformly. Band cuts sit at 2.9 and 3.9.')
        : scaleLegend(NR_DOMAIN[0], NR_DOMAIN[1], function (v) { return Math.round(v) + '%'; },
            'Share of facilities not ready',
            'Click an assessed state to drill into its LGAs, where the ramp switches to the ' +
            (themeKey === 'all' ? 'mean' : 'selected domain') + ' score.')) +
      '</div></div>' +

    '<div class="panel"><header><span class="t">' + scopeName + '</span></header><div class="body">' +
      '<div class="num" style="font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1">' +
        f2(scoreFor(scope, themeKey)) + '<s style="text-decoration:none;font-size:13px;color:var(--ink-3);font-weight:500;margin-left:3px">/5</s></div>' +
      '<div style="margin-top:5px">' + bandChip(bandOf(scoreFor(scope, themeKey))) + '</div>' +
      '<div style="margin-top:7px">' + maturityChip(scoreFor(scope, themeKey), true) + '</div>' +
      '<div style="margin-top:14px">' + stackBar(scope, scopeName) + '</div>' +
      '<ul class="legend" style="margin-top:9px"><li><i class="tex-ready"></i>' + scope.d[2] + '</li>' +
        '<li><i class="tex-moderate"></i>' + scope.d[1] + '</li><li><i class="tex-notready"></i>' + scope.d[0] + '</li></ul>' +
      '<div class="rows" style="margin-top:16px">' + THEMES.map(function (th, i) {
        var v = scope.ts[i];
        return '<div class="row2"><div class="lab"><span style="font-size:12px">' + TSHORT[th] + '</span><b>' + f2(v) + '</b></div>' +
          trackBar(v, TLABEL[th] + '\n' + f2(v) + ' / 5') + '</div>';
      }).join('') + '</div>' +
      (S.xState ? '<button class="btn" style="width:100%;justify-content:center;margin-top:15px" data-x-state="">← Back to Nigeria</button>' : '') +
      '</div></div>' +
  '</div>' +

  '<section class="panel" style="margin-top:14px"><header>' +
    '<span class="t">' + cols + 's ranked</span>' +
    '<span class="s">' + (themeKey==='all' ? 'overall readiness' : TLABEL[themeKey]) + ' · ' +
      (S.xAgg==='mean' ? 'by mean score' : 'by share ready') + '</span>' +
  '</header><div class="body"><div class="scroller"><table class="ledger"><thead><tr>' +
    '<th></th><th>' + cols + '</th><th style="min-width:150px">Composition</th>' +
    '<th class="r">Facilities</th><th class="r">Score</th><th class="r">% Ready</th><th class="r"></th>' +
  '</tr></thead><tbody>' +
    rows.slice(0, 40).map(function (r, i) {
      var v = scoreFor(r, themeKey);
      var pr = r.n ? r.d[2]/r.n*100 : 0;
      var attr = S.xState ? 'data-lga="' + r.id + '"' : 'data-x-state="' + r.id + '"';
      return '<tr class="clickable" ' + attr + '>' +
        '<td class="rk">' + String(i+1).padStart(2,'0') + '</td>' +
        '<td class="st">' + esc(r.nm) + '</td>' +
        '<td>' + stackBar(r, r.nm) + '</td>' +
        '<td class="r">' + fmt(r.n) + '</td>' +
        '<td class="r">' + bandMark(v) + f2(v) + '</td>' +
        '<td class="r">' + pr.toFixed(1) + '%</td>' +
        '<td class="r"><span style="color:var(--accent)">' + svgi('next',13) + '</span></td></tr>';
    }).join('') +
  '</tbody></table></div>' +
  (rows.length > 40 ? '<p class="fine" style="margin-top:11px">Showing 40 of ' + rows.length + '.</p>' : '') +
  '</div></section>' +

  (facRows.length ? '<section class="panel" style="margin-top:14px"><header>' +
    '<span class="t">Facilities in ' + scopeName + '</span><span class="s">first 12 · click for the scorecard</span></header>' +
    '<div class="body"><div class="scroller"><table class="ledger"><thead><tr>' +
      '<th>Facility</th><th>LGA</th><th class="r">Band</th><th class="r">Avg</th><th class="r"></th>' +
    '</tr></thead><tbody>' +
    facRows.map(function (r) {
      var b = r[3] != null ? BANDS[r[3]] : null;
      return '<tr class="clickable" data-fac="' + r[5] + '"><td class="wrap">' + esc(r[0]) + '</td>' +
        '<td style="color:var(--ink-2);font-size:12px">' + esc((D.lgas[r[2]]||{}).nm || '') + '</td>' +
        '<td class="r">' + (b ? '<i class="mark tex-' + b + '"></i>' + BLABEL[b] : '—') + '</td>' +
        '<td class="r">' + f2(r[4]) + '</td>' +
        '<td class="r"><span style="color:var(--accent)">' + svgi('next',13) + '</span></td></tr>';
    }).join('') + '</tbody></table></div></div></section>' : '') +

  '</div>';
}

// ── Investment Plan ──────────────────────────────────────────
function scrInvestment() {
  var inv = D.nat.inv.slice();
  if (S.iPriority) inv = inv.filter(function (i) { return i.p === S.iPriority; });
  if (S.iDomain) inv = inv.filter(function (i) { return i.t === S.iDomain; });

  var qty = inv.reduce(function (a, i) { return a + (i.q || 0); }, 0);
  var costed = inv.filter(function (i) { return lineTotal(i) != null; });
  var grand = costed.reduce(function (a, i) { return a + lineTotal(i); }, 0);
  var allCosted = costed.length === inv.length && inv.length > 0;
  var illus = usingIllustrative();

  // domain roll-up — the block from the current dashboard, rebuilt
  var byT = {};
  THEMES.forEach(function (t) { byT[t] = { q:0, cost:0, costed:0, n:0 }; });
  D.nat.inv.forEach(function (i) {
    var g = byT[i.t]; if (!g) return;
    g.q += (i.q || 0); g.n += 1;
    var lt = lineTotal(i);
    if (lt != null) { g.cost += lt; g.costed += 1; }
  });
  var qMax = Math.max.apply(null, THEMES.map(function (t) { return byT[t].q; }));
  var totalQ = THEMES.reduce(function (a, t) { return a + byT[t].q; }, 0);

  // group rows by domain so subtotals mean something
  var order = THEMES.filter(function (t) { return inv.some(function (i) { return i.t === t; }); });
  var body = '';
  order.forEach(function (t) {
    var rows = inv.filter(function (i) { return i.t === t; })
      .sort(function (a, b) { var r = { high:0, medium:1, low:2 }; return r[a.p] - r[b.p] || (b.q||0) - (a.q||0); });
    var sub = 0, subKnown = 0;
    rows.forEach(function (i) { var lt = lineTotal(i); if (lt != null) { sub += lt; subKnown += 1; } });
    body += '<tr class="subtotal"><td colspan="7" style="padding-top:13px">' +
      TLABEL[t] + ' <span class="fine" style="text-transform:none;letter-spacing:0"> — ' +
      rows.length + ' actions · ' + fmt(byT[t].q) + ' units</span></td></tr>';
    rows.forEach(function (i) {
      var r = rateOf(i.id), lt = lineTotal(i);
      var isIll = (S.iCosts[i.id] == null || S.iCosts[i.id] === '') && S.iRates && ILLUSTRATIVE[i.id] != null;
      body += '<tr>' +
        '<td class="wrap">' + esc(i.l) + '</td>' +
        '<td class="r"><span class="pri' + (i.p==='high'?' pri--high':'') + '">' + i.p + '</span></td>' +
        '<td class="r">' + fmt(i.f) + '</td>' +
        '<td class="r">' + fmt(i.q) + '</td>' +
        '<td class="r fine" style="font-size:10px">' + unitOf(i.id) + '</td>' +
        '<td class="r"><input class="cost" type="text" inputmode="numeric" data-cost="' + i.id + '"' +
          ' value="' + (S.iCosts[i.id] != null && S.iCosts[i.id] !== '' ? esc(S.iCosts[i.id]) : (isIll ? r : '')) + '"' +
          ' placeholder="not set" aria-label="Unit cost for ' + esc(i.l) + '"' +
          (isIll ? ' style="color:var(--ink-2);border-style:dashed"' : '') + '></td>' +
        '<td class="money" data-total="' + i.id + '">' +
          (lt == null ? '<span class="pending">pending</span>' : ngn(lt)) + '</td>' +
      '</tr>';
    });
    body += '<tr class="subtotal"><td colspan="6" class="r" style="font-family:var(--mono);font-size:11px;' +
      'letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)">' + TLABEL[t] + ' subtotal</td>' +
      '<td class="money" data-sub="' + t + '">' +
      (subKnown ? ngn(sub) + (subKnown < rows.length ? ' *' : '') : '<span class="pending">pending</span>') +
      '</td></tr>';
  });

  return '<div class="page">' +

  (illus ? '<div class="warn">' +
    '<span class="ic">' + svgi('alert',16) + '</span>' +
    '<span class="tx"><b>These naira figures are illustrative placeholders, not NPHCDA rates.</b>' +
    '<p>The assessment workbook publishes no cost table, so every unit cost in your data is null. ' +
    'The rates below were invented to show the costed layout — do not quote any total from this view. ' +
    'Type over any cell to enter a real rate, or switch the placeholders off.</p></span>' +
  '</div>' : '') +

  '<div class="tiles g4" style="margin-bottom:16px">' +
    '<div class="tile"><div class="k">Total costed items</div>' +
      '<div class="v">' + fmt(totalQ) + '</div>' +
      '<div class="a">' + D.nat.inv.length + ' distinct actions</div></div>' +
    '<div class="tile"><div class="k">Facilities with at least one action</div>' +
      '<div class="v">' + fmt(D.nat.n - D.nat.d[2]) + '<s>of ' + fmt(D.nat.n) + '</s></div>' +
      '<div class="a">Every non-ready facility</div></div>' +
    '<div class="tile"><div class="k">High-priority actions</div>' +
      '<div class="v">' + D.nat.inv.filter(function (i) { return i.p==='high'; }).length +
      '<s>of ' + D.nat.inv.length + '</s></div>' +
      '<div class="a">Blocking EMR deployment</div></div>' +
    '<div class="tile"><div class="k">Estimated total' + (illus ? ' · illustrative' : '') + '</div>' +
      '<div class="v" data-grandshort>' + (grand ? ngnShort(grand) : '—') + '</div>' +
      '<div class="a">' + (allCosted ? (illus ? 'From placeholder rates' : 'From entered rates')
        : costed.length ? costed.length + ' of ' + inv.length + ' actions priced'
        : 'Awaiting a signed-off cost table') + '</div></div>' +
  '</div>' +

  '<div class="grid g2" style="align-items:start;margin-bottom:16px">' +
    '<div class="panel"><header><span class="t">Items by domain</span>' +
      '<span class="s">' + fmt(totalQ) + ' units across ' + D.nat.inv.length + ' actions</span></header>' +
      '<div class="body"><div class="rows">' +
      THEMES.map(function (t) {
        var g = byT[t];
        return '<div class="row2"><div class="lab">' +
          '<span' + (g.q ? '' : ' style="color:var(--ink-3)"') + '>' + TLABEL[t] + '</span>' +
          '<b>' + (g.q ? fmt(g.q) : 'none') + '</b></div>' +
          '<div class="track" ' + tipAttr(TLABEL[t] + '\n' + (g.q
            ? fmt(g.q) + ' units · ' + g.n + ' actions · ' + (g.q/totalQ*100).toFixed(1) + '% of all items'
            : 'no costed items — assessed at state level')) + '>' +
          '<b style="width:' + (g.q ? (g.q/qMax*100).toFixed(1) : 0) + '%' + (g.q?'':';background:var(--nodata)') + '"></b>' +
          '</div></div>';
      }).join('') + '</div>' +
      '<div class="callout" style="margin-top:15px"><div class="k">The hole in the plan</div>' +
      '<p><b>Leadership &amp; Governance carries zero costed items</b> while scoring ' + f2(D.nat.ts[4]) +
      ' — the weakest domain nationally. It is measured at state level and the instrument only ' +
      'triggers actions at facility level, so the weakest domain has no line to fund.</p></div>' +
      '</div></div>' +

    '<div class="panel"><header><span class="t">Cost by domain</span>' +
      '<span class="s">' + (illus ? 'illustrative rates' : allCosted ? 'entered rates' : 'awaiting rates') + '</span></header>' +
      '<div class="body">' +
      (grand ? '<div class="rows">' + THEMES.map(function (t) {
        var g = byT[t];
        var cMax = Math.max.apply(null, THEMES.map(function (x) { return byT[x].cost; })) || 1;
        return '<div class="row2"><div class="lab">' +
          '<span' + (g.cost ? '' : ' style="color:var(--ink-3)"') + '>' + TLABEL[t] + '</span>' +
          '<b>' + (g.cost ? ngnShort(g.cost) : '—') + '</b></div>' +
          '<div class="track" ' + tipAttr(TLABEL[t] + '\n' + (g.cost ? ngn(g.cost) +
            ' · ' + (g.cost/grand*100).toFixed(1) + '% of total' : 'no cost')) + '>' +
          '<b style="width:' + (g.cost ? (g.cost/cMax*100).toFixed(1) : 0) + '%"></b></div></div>';
      }).join('') + '</div>' +
      '<p class="fine" style="margin-top:13px">Share of spend is not share of items: Technical ' +
      'Infrastructure is ' + (byT.technical_infrastructure.q/totalQ*100).toFixed(0) + '% of units but ' +
      (byT.technical_infrastructure.cost/grand*100).toFixed(0) + '% of cost, because power and devices ' +
      'carry the heaviest unit rates.</p>'
      : '<div class="empty" style="padding:30px 10px"><div class="in">' +
        '<h3>No rates entered yet</h3><p>Your data has no unit costs, so this panel has nothing to ' +
        'total. Enter rates in the table below, or switch on the placeholder rates to see the ' +
        'costed layout.</p>' +
        '<button class="btn btn--primary" data-rates="on">Use illustrative rates</button>' +
        '</div></div>') +
      '</div></div>' +
  '</div>' +

  '<section class="panel"><header>' +
    '<span class="t">Itemised schedule</span>' +
    '<span class="s">' + inv.length + ' of ' + D.nat.inv.length + ' actions' +
      (S.iPriority || S.iDomain ? ' · filtered' : '') + '</span>' +
    '<button class="btn r" style="padding:3px 9px;font-size:11.5px">' + svgi('down',12) + ' Export XLSX</button>' +
  '</header>' +

  '<div class="body">' +
    '<div class="costbar">' +
      '<span class="fine" style="letter-spacing:.11em;text-transform:uppercase">Unit rates</span>' +
      '<div class="seg">' +
        '<button data-rates="off" aria-pressed="' + (!S.iRates) + '">From your data</button>' +
        '<button data-rates="on" aria-pressed="' + (S.iRates) + '">Illustrative placeholders</button>' +
      '</div>' +
      (Object.keys(S.iCosts).length ? '<button class="reset" data-rates="clear">Clear my entries (' +
        Object.keys(S.iCosts).length + ')</button>' : '') +
      '<span class="spacer" style="margin-left:auto"></span>' +
      '<span class="fine">Type in any Unit cost cell to price an action</span>' +
    '</div>' +

    '<div class="scroller"><table class="ledger"><thead><tr>' +
      '<th>Action</th><th class="r">Priority</th><th class="r">Facilities</th>' +
      '<th class="r">Quantity</th><th class="r">Unit</th>' +
      '<th class="r">Unit cost (₦)</th><th class="r">Total cost (₦)</th>' +
    '</tr></thead><tbody>' + body +
    '<tr class="grand"><td colspan="3">Grand total</td>' +
      '<td class="r">' + fmt(qty) + '</td><td></td><td></td>' +
      '<td class="money" data-grand>' + (grand ? ngn(grand) : '<span class="pending">pending</span>') + '</td>' +
    '</tr>' +
    '</tbody></table></div>' +

    '<p class="fine" style="margin-top:12px">' +
      (costed.length && costed.length < inv.length ? '* Subtotal covers only the priced actions in that domain. ' : '') +
      'Quantity units differ by action — devices and fans are counted per unit, most others per ' +
      'facility, so the Unit column names what a rate buys. Source: ' +
      '<code style="font-family:var(--mono)">national.json</code> investments, ' +
      D.nat.inv.length + ' actions, ' + fmt(totalQ) + ' units.' +
    '</p>' +
  '</div></section>' +

  '</div>';
}

// ── Generate Report ───────────────────────────────────────────────────
var TEMPLATES = [
  { id:'national', n:'National readiness summary', d:'Headline findings across the assessed population',
    sec:['Overview','Readiness distribution','Thematic area scores','State ranking','Investment schedule','Coverage & evidence'] },
  { id:'state', n:'State briefing', d:'One state, its LGAs and its investment schedule',
    sec:['State overview','LGA ranking','Thematic gaps','Minimum requirements','Investment schedule'] },
  { id:'facility', n:'Facility scorecard pack', d:'Per-facility scorecards for a chosen scope',
    sec:['Scope summary','Facility scorecards','Requirement gaps','Action list'] },
  { id:'invest', n:'Investment case', d:'What it will take, itemised and prioritised',
    sec:['Executive summary','Investment by domain','Priority actions','Facilities affected','Assumptions'] }
];
function scrReports() {
  var tpl = TEMPLATES.filter(function (t) { return t.id === S.rTemplate; })[0];
  if (!S.rSections) S.rSections = tpl.sec.slice();
  var n = D.nat;

  return '<div class="page"><div class="rbgrid">' +
    '<div style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="panel"><header><span class="t">Scope</span></header><div class="body">' +
        '<p class="note" style="font-size:12.5px">Set by the filter bar above. The report covers exactly ' +
        'that selection.</p>' +
        '<div class="tiles" style="grid-template-columns:1fr;margin-top:12px">' +
          '<div class="tile"><div class="k">In scope</div><div class="v">' + fmt(n.n) + '<s>facilities</s></div>' +
          '<div class="a">12 states · ' + fmt(D.lgas.length) + ' LGAs</div></div>' +
        '</div></div></div>' +

      '<div class="panel"><header><span class="t">Template</span></header>' +
        '<div class="tmpl">' + TEMPLATES.map(function (t) {
          return '<button class="tmplopt" aria-pressed="' + (t.id===S.rTemplate) + '" data-tpl="' + t.id + '">' +
            '<div class="n">' + t.n + '</div><div class="d">' + t.d + '</div></button>';
        }).join('') + '</div></div>' +

      '<div class="panel"><header><span class="t">Sections</span>' +
        '<span class="s r">' + S.rSections.length + ' of ' + tpl.sec.length + '</span></header><div class="body">' +
        '<div class="checks">' + tpl.sec.map(function (s) {
          return '<label class="check"><input type="checkbox" data-sec="' + esc(s) + '"' +
            (S.rSections.indexOf(s) >= 0 ? ' checked' : '') + '><span>' + s + '</span></label>';
        }).join('') + '</div>' +
        '<button class="btn btn--primary" style="width:100%;justify-content:center;margin-top:15px">' +
          svgi('down',13) + ' Download PDF</button>' +
        '<button class="btn" style="width:100%;justify-content:center;margin-top:7px">Download XLSX</button>' +
      '</div></div>' +
    '</div>' +

    '<div class="panel" style="background:var(--surface-sunk)"><header style="background:var(--surface)">' +
      '<span class="t">Preview</span><span class="s">' + tpl.n + ' · ' + S.rSections.length + ' sections</span>' +
      '<span class="r fine">A4 · portrait</span></header>' +
      '<div class="body" style="padding:22px 18px">' +
      '<div class="sheet">' +
        '<h2>' + tpl.n + '</h2>' +
        '<div class="meta">NPHCDA · EMR readiness assessment · ' + fmt(n.n) + ' facilities · 12 states</div>' +
        (S.rSections.indexOf('Overview') >= 0 || S.rSections.indexOf('Executive summary') >= 0 || S.rSections.indexOf('State overview') >= 0 || S.rSections.indexOf('Scope summary') >= 0 ?
          '<h3>Overview</h3><p>Of ' + fmt(n.n) + ' facilities assessed across 12 states, <b>' + fmt(n.d[2]) +
          '</b> (' + (n.d[2]/n.n*100).toFixed(1) + '%) are ready for EMR deployment today, ' + fmt(n.d[1]) +
          ' require targeted intervention and ' + fmt(n.d[0]) + ' require foundational investment. The ' +
          'national average domain score is ' + f2(n.avg) + ' of 5.</p>' : '') +
        (S.rSections.indexOf('Readiness distribution') >= 0 ?
          '<h3>Readiness distribution</h3>' + stackBar(n, 'National') +
          '<ul class="legend" style="margin-top:9px"><li><i class="tex-ready"></i>Ready ' + fmt(n.d[2]) + '</li>' +
          '<li><i class="tex-moderate"></i>Moderate ' + fmt(n.d[1]) + '</li>' +
          '<li><i class="tex-notready"></i>Not ready ' + fmt(n.d[0]) + '</li></ul>' : '') +
        (S.rSections.indexOf('Thematic area scores') >= 0 || S.rSections.indexOf('Thematic gaps') >= 0 ?
          '<h3>Thematic area scores</h3><div class="rows">' + THEMES.map(function (t, i) {
            var v = n.ts[i];
            return '<div class="row2"><div class="lab"><span>' + TLABEL[t] + '</span><b>' + f2(v) + '</b></div>' +
              trackBar(v, '') + '</div>';
          }).join('') + '</div>' : '') +
        (S.rSections.indexOf('State ranking') >= 0 || S.rSections.indexOf('LGA ranking') >= 0 ?
          '<h3>State ranking</h3><table class="ledger"><thead><tr><th>State</th>' +
          '<th class="r">Facilities</th><th class="r">Ready</th><th class="r">Avg</th></tr></thead><tbody>' +
          PRIMARY.slice().sort(function (a,b) { return b.avg-a.avg; }).map(function (s) {
            return '<tr><td class="st">' + s.nm + '</td><td class="r">' + fmt(s.n) + '</td>' +
              '<td class="r">' + s.d[2] + '</td><td class="r">' + f2(s.avg) + '</td></tr>';
          }).join('') + '</tbody></table>' : '') +
        (S.rSections.indexOf('Investment schedule') >= 0 || S.rSections.indexOf('Investment by domain') >= 0 || S.rSections.indexOf('Priority actions') >= 0 ?
          '<h3>Priority actions</h3><table class="ledger"><thead><tr><th>Action</th>' +
          '<th class="r">Facilities</th><th class="r">Priority</th></tr></thead><tbody>' +
          n.inv.filter(function (i) { return i.p === 'high'; }).sort(function (a,b) { return b.f-a.f; }).slice(0,6).map(function (i) {
            return '<tr><td class="wrap">' + esc(i.l) + '</td><td class="r">' + fmt(i.f) + '</td>' +
              '<td class="r"><span class="pri pri--high">high</span></td></tr>';
          }).join('') + '</tbody></table>' : '') +
        (S.rSections.indexOf('Coverage & evidence') >= 0 || S.rSections.indexOf('Assumptions') >= 0 ?
          '<h3>Coverage &amp; evidence</h3><p>12 states were assessed by primary facility survey. The ' +
          'remaining 25 states and the FCT were assessed by secondary desk review and carry no ' +
          'facility-level readiness band. Naira costs are omitted: the source workbook has no signed-off ' +
          'unit cost table.</p>' : '') +
      '</div></div></div>' +
  '</div></div>';
}

// ══════════════════ FILTER BARS ══════════════════
function stateOptions(sel, allLabel) {
  return '<option value="">' + (allLabel || 'All 12 states') + '</option>' +
    PRIMARY.slice().sort(function (a,b) { return a.nm.localeCompare(b.nm); }).map(function (s) {
      return '<option value="' + s.id + '"' + (sel===s.id?' selected':'') + '>' + s.nm + '</option>';
    }).join('');
}
function lgaOptions(stateId, sel) {
  var ls = D.lgas.filter(function (l) { return !stateId || l.s === stateId; });
  ls.sort(function (a,b) { return a.nm.localeCompare(b.nm); });
  return '<option value="">All LGAs' + (stateId ? '' : ' (' + D.lgas.length + ')') + '</option>' +
    ls.map(function (l) { return '<option value="' + l.id + '"' + (sel===l.id?' selected':'') + '>' + esc(l.nm) + '</option>'; }).join('');
}

function filterBar() {
  var r = S.route;
  if (r === 'home' || r === 'landing') return '';
  if (r === 'states') {
    return '<div class="filters">' +
      '<div class="field"><label>State</label><select class="sel" data-f="s.state">' +
        '<option value="">All 37 states</option>' +
        D.states.slice().sort(function (a,b){return a.nm.localeCompare(b.nm);}).map(function (s) {
          return '<option value="' + s.id + '"' + (S.sFilter.state===s.id?' selected':'') + '>' + s.nm +
            (s.g===0 ? ' — desk review' : '') + '</option>';
        }).join('') + '</select></div>' +
      '<div class="field"><label>Readiness</label><select class="sel" data-f="s.band">' +
        '<option value="">All readiness levels</option>' +
        BANDS.slice().reverse().map(function (b) {
          return '<option value="' + b + '"' + (S.sFilter.band===b?' selected':'') + '>' + BLABEL[b] + '</option>';
        }).join('') +
        '<option value="secondary"' + (S.sFilter.band==='secondary'?' selected':'') + '>Desk review only</option>' +
      '</select></div>' +
      (S.sFilter.state || S.sFilter.band ? '<button class="reset" data-reset="s">Clear filters</button>' : '') +
      '<span class="spacer"></span>' +
      '<button class="btn">' + svgi('down',12) + ' Export</button>' +
    '</div>';
  }
  if (r === 'assessment') {
    return '<div class="filters">' +
      '<div class="field"><label>State</label><select class="sel" data-f="a.state">' + stateOptions(S.aFilter.state) + '</select></div>' +
      '<div class="field"><label>LGA</label><select class="sel" data-f="a.lga">' + lgaOptions(S.aFilter.state, S.aFilter.lga) + '</select></div>' +
      '<div class="field"><label>Functionality</label><select class="sel"><option>All levels</option><option>Functional L1</option><option>Functional L2</option><option>Non-functional</option></select></div>' +
      '<div class="field grow"><input class="sel" type="search" placeholder="Search LGA or state" data-f="a.q" value="' + esc(S.aFilter.q) + '"></div>' +
      (S.aFilter.state || S.aFilter.q ? '<button class="reset" data-reset="a">Clear</button>' : '') +
      '<button class="btn">' + svgi('down',12) + ' Export</button>' +
    '</div>';
  }
  if (r === 'facilities') {
    var facs = D.fac.filter(function (rr) {
      if (S.fState && (D.states[rr[1]]||{}).id !== S.fState) return false;
      if (S.fLga && (D.lgas[rr[2]]||{}).id !== S.fLga) return false;
      return true;
    });
    return '<div class="filters">' +
      '<div class="field"><label>State</label><select class="sel" data-f="f.state">' + stateOptions(S.fState) + '</select></div>' +
      '<div class="field"><label>LGA</label><select class="sel" data-f="f.lga">' + lgaOptions(S.fState, S.fLga) + '</select></div>' +
      '<div class="field grow"><select class="sel" data-f="f.fac" style="width:100%">' +
        '<option value="">' + fmt(facs.length) + ' facilities — open a scorecard</option>' +
        facs.slice(0, 400).map(function (rr) {
          return '<option value="' + rr[5] + '"' + (S.facility===rr[5]?' selected':'') + '>' + esc(rr[0]) +
            ' — ' + esc((D.lgas[rr[2]]||{}).nm||'') + '</option>';
        }).join('') + '</select></div>' +
      (S.facility ? '<button class="reset" data-reset="f">Clear facility</button>' : '') +
      '<span class="spacer"></span>' +
      (S.facility ? '<button class="btn">' + svgi('down',12) + ' Export</button>' : '') +
    '</div>';
  }
  if (r === 'explore') {
    return '<div class="filters">' +
      '<div class="field"><label>Setting</label><select class="sel"><option>All</option><option>Urban</option><option>Rural</option></select></div>' +
      '<div class="field"><label>Funding</label><select class="sel"><option>All</option><option>BHCPF</option><option>Non-BHCPF</option></select></div>' +
      '<div class="field"><label>Functionality</label><select class="sel"><option>All levels</option><option>Functional L1</option><option>Functional L2</option></select></div>' +
      '<div class="field grow"><input class="sel" type="search" placeholder="Search facility, LGA or state"></div>' +
      '<span class="spacer"></span>' +
      '<span class="fine">Published figures, read from the precomputed cube</span>' +
    '</div>';
  }
  if (r === 'reports') {
    return '<div class="filters">' +
      '<div class="field"><label>State</label><select class="sel">' + stateOptions('') + '</select></div>' +
      '<div class="field"><label>LGA</label><select class="sel">' + lgaOptions('', '') + '</select></div>' +
      '<div class="field"><label>Readiness</label><select class="sel"><option>All readiness levels</option>' +
        BANDS.slice().reverse().map(function (b) { return '<option>' + BLABEL[b] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field grow"><input class="sel" type="search" placeholder="Search facility, LGA or state"></div>' +
    '</div>';
  }
  return '';
}

// ══════════════════ SHELL ══════════════════
function railHTML() {
  return '<aside class="rail">' +
    '<button class="brand" data-go="landing" title="Back to the landing page">' +
      '<span class="glyph">ER</span>' +
      '<span class="txt"><b>EMR Readiness</b><u>NPHCDA</u></span>' +
    '</button>' +
    '<div class="navsec">Modules</div>' +
    '<nav>' + NAV.map(function (n) {
      return '<button class="navitem" data-go="' + n.id + '"' + (S.route===n.id ? ' aria-current="page"' : '') +
        ' title="' + esc(n.label) + '">' + svgi(n.icon) + '<span>' + n.label + '</span></button>';
    }).join('') + '</nav>' +
    '<div class="railfoot">' +
      '<div class="themeset" role="group" aria-label="Colour theme">' +
        '<button data-theme-set="light" aria-pressed="' + (S.theme==='light') + '" title="Light">' + svgi('sun',14) + '</button>' +
        '<button data-theme-set="dark" aria-pressed="' + (S.theme==='dark') + '" title="Dark">' + svgi('moon',14) + '</button>' +
        '<button data-theme-set="auto" aria-pressed="' + (S.theme==='auto') + '" title="Match system">' + svgi('auto',14) + '</button>' +
      '</div>' +
      '<button class="railtoggle" data-collapse title="Collapse the rail">' + svgi('panel',14) + '<span>Collapse</span></button>' +
    '</div>' +
  '</aside>';
}

function headerHTML() {
  var n = NAV.filter(function (x) { return x.id === S.route; })[0];
  if (!n) return '';
  var sub = n.sub;
  if (S.route === 'facilities' && S.facility) sub = D.one.nm + ' · ' + D.one.lga + ' LGA, ' + D.one.state;
  return '<div class="phead">' +
    '<div class="ttl"><h1>' + n.title + '</h1><span class="sub">' + esc(sub) + '</span></div>' +
    '<div class="acts">' +
      '<button class="btn" data-next title="Next module">' + svgi('next',13) + '</button>' +
    '</div>' +
  '</div>';
}

var SCREENS = { landing:scrLanding, home:scrHome, states:scrStates, assessment:scrAssessment,
  facilities:scrFacilities, explore:scrExplore, investment:scrInvestment, reports:scrReports };

function render() {
  var root = document.getElementById('root');
  if (S.route === 'landing') {
    root.className = '';
    root.innerHTML = '<div class="scroll" style="height:100vh">' + scrLanding() + '</div>';
  } else {
    root.className = 'app' + (S.collapsed ? ' collapsed' : '');
    root.innerHTML = railHTML() +
      '<div class="main">' +
        (S.showProto ? '<div class="protobar"><b>Design mockup</b> · real assessment numbers · ' +
          'table filters and the facility picker work; charts do not recompute' +
          '<button class="x" data-hide-proto title="Hide">×</button></div>' : '') +
        headerHTML() + filterBar() +
        '<div class="scroll">' + SCREENS[S.route]() + '</div>' +
      '</div>';
  }
  var sc = root.querySelector('.scroll');
  if (sc) sc.scrollTop = 0;
}

// ══════════════════ EVENTS ══════════════════
function applyTheme() {
  var r = document.documentElement;
  if (S.theme === 'auto') r.removeAttribute('data-theme');
  else r.setAttribute('data-theme', S.theme);
}

document.addEventListener('click', function (e) {
  var t;
  if ((t = e.target.closest('[data-go]'))) {
    var to = t.getAttribute('data-go');
    if (to !== S.route) { S.route = to; if (to !== 'facilities') S.facility = S.facility; render(); }
    return;
  }
  if ((t = e.target.closest('[data-collapse]'))) { S.collapsed = !S.collapsed; render(); return; }
  if ((t = e.target.closest('[data-hide-proto]'))) { S.showProto = false; render(); return; }
  if ((t = e.target.closest('[data-theme-set]'))) { S.theme = t.getAttribute('data-theme-set'); applyTheme(); render(); return; }
  if ((t = e.target.closest('[data-next]'))) {
    var i = NAV.map(function (n) { return n.id; }).indexOf(S.route);
    S.route = NAV[(i + 1) % NAV.length].id; render(); return;
  }
  if ((t = e.target.closest('[data-fac]'))) { S.facility = t.getAttribute('data-fac'); S.route = 'facilities'; render(); return; }
  if ((t = e.target.closest('[data-theme]'))) {
    var k = t.getAttribute('data-theme');
    if (k === S.xTheme && k !== 'all') { S.xOpen[k] = !S.xOpen[k]; } else { S.xTheme = k; if (k !== 'all') S.xOpen[k] = true; }
    render(); return;
  }
  if ((t = e.target.closest('[data-agg]'))) { S.xAgg = t.getAttribute('data-agg'); render(); return; }
  if ((t = e.target.closest('[data-x-state]'))) {
    S.xState = t.getAttribute('data-x-state') || null; S.route = 'explore'; render(); return;
  }
  if ((t = e.target.closest('[data-tpl]'))) { S.rTemplate = t.getAttribute('data-tpl'); S.rSections = null; render(); return; }
  if ((t = e.target.closest('[data-rates]'))) {
    var m = t.getAttribute('data-rates');
    if (m === 'on') S.iRates = true;
    if (m === 'off') S.iRates = false;
    if (m === 'clear') S.iCosts = {};
    S.route = 'investment';
    render(); return;
  }
  if ((t = e.target.closest('[data-reset]'))) {
    var w = t.getAttribute('data-reset');
    if (w === 's') S.sFilter = { state:'', band:'' };
    if (w === 'a') S.aFilter = { state:'', lga:'', q:'' };
    if (w === 'f') { S.facility = null; }
    render(); return;
  }
  // map click: state → drill in the Report Explorer, or filter National Coverage
  if ((t = e.target.closest('path.area'))) {
    var id = t.getAttribute('data-area');
    if (!id) return;
    if (S.route === 'explore') {
      if (!S.xState && STATE_BY_ID[id] && STATE_BY_ID[id].g === 1) { S.xState = id; render(); }
      return;
    }
    if (S.route === 'states') {
      S.sFilter.state = (S.sFilter.state === id ? '' : id); render(); return;
    }
  }
  // table row drill
  if ((t = e.target.closest('tr[data-state]'))) {
    S.xState = t.getAttribute('data-state'); S.route = 'explore'; render(); return;
  }
  if ((t = e.target.closest('tr[data-lga]'))) {
    var lg = LGA_BY_ID[t.getAttribute('data-lga')];
    if (lg) { S.xState = lg.s; S.route = 'explore'; render(); }
    return;
  }
});

document.addEventListener('change', function (e) {
  var t = e.target.closest('[data-f]');
  if (t) {
    var f = t.getAttribute('data-f'), v = t.value;
    if (f === 's.state') S.sFilter.state = v;
    if (f === 's.band') S.sFilter.band = v;
    if (f === 'a.state') { S.aFilter.state = v; S.aFilter.lga = ''; }
    if (f === 'a.lga') S.aFilter.lga = v;
    if (f === 'f.state') { S.fState = v; S.fLga = ''; }
    if (f === 'f.lga') S.fLga = v;
    if (f === 'f.fac') S.facility = v || null;
    render(); return;
  }
  var s = e.target.closest('[data-sec]');
  if (s) {
    var name = s.getAttribute('data-sec');
    var i = S.rSections.indexOf(name);
    if (s.checked && i < 0) S.rSections.push(name);
    if (!s.checked && i >= 0) S.rSections.splice(i, 1);
    render(); return;
  }
});

/* Recompute the money columns in place. A full re-render on every keystroke
   would blur the field the user is typing in, so the totals, subtotals and
   grand total are written directly instead. */
function recalcCosts() {
  var grand = 0, anyKnown = false;
  var subs = {}; THEMES.forEach(function (t) { subs[t] = { sum:0, known:0, rows:0 }; });

  D.nat.inv.forEach(function (i) {
    var lt = lineTotal(i);
    var cell = document.querySelector('[data-total="' + i.id + '"]');
    if (cell) cell.innerHTML = (lt == null ? '<span class="pending">pending</span>' : ngn(lt));
    var s = subs[i.t]; if (!s) return;
    s.rows += 1;
    if (lt != null) { s.sum += lt; s.known += 1; grand += lt; anyKnown = true; }
  });

  THEMES.forEach(function (t) {
    var cell = document.querySelector('[data-sub="' + t + '"]');
    if (!cell) return;
    var s = subs[t];
    cell.innerHTML = s.known
      ? ngn(s.sum) + (s.known < s.rows ? ' *' : '')
      : '<span class="pending">pending</span>';
  });

  var g = document.querySelector('[data-grand]');
  if (g) g.innerHTML = anyKnown ? ngn(grand) : '<span class="pending">pending</span>';
  var gs = document.querySelector('[data-grandshort]');
  if (gs) gs.textContent = anyKnown ? ngnShort(grand) : '—';
}

document.addEventListener('input', function (e) {
  var c = e.target.closest('[data-cost]');
  if (c) {
    var id = c.getAttribute('data-cost');
    var raw = c.value.replace(/[^\d.]/g, '');
    if (raw === '') delete S.iCosts[id]; else S.iCosts[id] = raw;
    recalcCosts();
    return;
  }
  var t = e.target.closest('[data-f="a.q"]');
  if (!t) return;
  S.aFilter.q = t.value;
  var pos = t.selectionStart;
  render();
  var again = document.querySelector('[data-f="a.q"]');
  if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (err) {} }
});

// tooltip
(function () {
  var tip = document.getElementById('tip');
  document.addEventListener('mouseover', function (e) {
    var t = e.target.closest('[data-tip]'); if (!t) return;
    tip.textContent = t.getAttribute('data-tip'); tip.classList.add('on');
  });
  document.addEventListener('mousemove', function (e) {
    if (!tip.classList.contains('on')) return;
    tip.style.left = e.clientX + 'px'; tip.style.top = (e.clientY - 12) + 'px';
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest('[data-tip]')) tip.classList.remove('on');
  });
})();

/* Hash routing. The real app keeps its scope in the URL so any view is a link;
   a mockup that loses that understates the design, and it makes each screen
   directly addressable for review. */
function readHash() {
  var h = (location.hash || '').replace(/^#\/?/, '');
  if (!h) return;
  var parts = h.split('/');
  if (SCREENS[parts[0]]) S.route = parts[0];
  if (parts[0] === 'explore' && parts[1] && STATE_BY_ID[parts[1]]) S.xState = parts[1];
  if (parts[0] === 'facilities' && parts[1]) S.facility = parts[1];
  if (parts[0] === 'states' && parts[1] && STATE_BY_ID[parts[1]]) S.sFilter.state = parts[1];
}
function writeHash() {
  var h = '#/' + S.route;
  if (S.route === 'explore' && S.xState) h += '/' + S.xState;
  if (S.route === 'facilities' && S.facility) h += '/' + S.facility;
  if (S.route === 'states' && S.sFilter.state) h += '/' + S.sFilter.state;
  if (location.hash !== h) history.replaceState(null, '', h);
}
var _render = render;
render = function () { _render(); writeHash(); };
window.addEventListener('hashchange', function () { readHash(); render(); });

readHash();
applyTheme();
render();
})();
