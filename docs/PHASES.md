# Build phases — working tracker

Companion to `../../EMR Dashboard/EMR_DASHBOARD_BUILD_GUIDE.md` §16. The guide
says *what* to build; this file tracks *where we are* and gives a paste-able
kickoff prompt for each phase.

**Update this file at the end of every session.** It is the handoff.

**Last updated:** 15 August 2026 · **Overall: ~5.4 of 7 phases (78%)**

| Phase | Status | |
|---|---|---|
| 1 — Foundation | 100% | ✅ complete |
| 2 — ETL & scoring | ~95% | 🟢 near complete |
| 3 — Maps | 100% | ✅ complete |
| 4 — The four designed modules | ~85% | 🟢 near complete — State Summary and every investment panel still blocked |
| 5 — Drill-Down Explorer | 100% | ✅ complete — all four thematic levels |
| 6 — Investment & roadmap | ~5% | 🔴 blocked |
| 7 — Export, RBAC, polish | ~75% | 🟢 export, accessibility, responsive and the load-state sweep all landed; RBAC needs a decision |

## Blockers, and who owns them

| Blocker | Blocks | Owner |
|---|---|---|
| **State-level assessment table** (Leadership & Governance scores, Overall State Readiness, findings for the 25 secondary states) | Phase 4 → State Summary, and §3.8 deployment matrix | **Client** |
| **Unit costs in ₦** — absent from every supplied file; quantities are largely derivable, prices are not | Phase 6 entirely | **Client** |
| **Does an EMR vendor see PII?** The dataset carries facility GPS, OIC names and phone numbers. Any answer needing real enforcement reopens the no-backend decision — a client-side role toggle over data the browser has already downloaded is theatre | Phase 7 → RBAC, and only RBAC | **Client** |

Nothing blocks Phases 1, 4 (except State Summary), 5, 6 (except the cost
table) or 7 (except RBAC) from proceeding today.

**Cleared in a previous session:** the explorer's filter blocker. The cube is precomputed
at build time, so a facility-type filter had nothing to act on and the
`FilterBar` was kept off the page rather than shipped inert. It now recomputes
client-side from `facilities-summary.json` whenever a filter is active, checked
cell-for-cell against the precomputed cube by test. See Phase 5.

**Cleared in a previous session:** the LGA ADM2 boundary blocker. GRID3 does not
publish a standalone ADM2 download the way it does the ADM1 file `srh`
already ships, but OCHA's COD-AB Nigeria dataset (`data.humdata.org`,
`cod-ab-nga`) redistributes the same GRID3-sourced boundaries end to end,
ADM0–ADM3, and is the dataset GRID3's own ADM1 file is drawn from — so naming
and CRS matched `nigeria-states.geojson` with no reconciliation needed there.

**Cleared a previous session:** the question → ODK column binding, and the
rubric `.xlsx` re-export is no longer needed — see Phase 2's log below.

### Two things to put to the assessment team

Neither blocks anything; both change what the dashboard should say.

1. **Thirty-three rubric questions were written with response buckets and never
   scored** in the published workbook — every referral question, most of the
   device-condition detail, the EMR architecture questions. They are carried as
   contextual with `unscoredReason: 'rubric_scored_workbook_did_not'`. Was that
   deliberate?
2. **Two of the 24 minimum requirements cannot be measured** from the
   instrument: it asks whether *any* staff were trained, never how many, and it
   never asks about a unique patient identifier. Both return `null`.

---

## Phase 1 — Foundation · 100% ✅

Scaffold, design system, app shell, routing, global state.

**Done**
- [x] UI primitives ported from `../NPHCDA_dashboard_int/src/components/ui/` —
      `MultiSelectDropdown`, `Combobox`, `Drawer`, `Modal`, `Toaster`, `Tooltip`,
      `Badge`, rethemed to our tokens. Ported **without** framer-motion (not a
      dependency here); the entrances are CSS keyframes in `tailwind.config.js`,
      which the existing reduced-motion rule already neutralises
- [x] `useDismissable` / `useScrollLock` — outside-click, Escape and scroll-lock,
      shared by every overlay
- [x] `FilterBar` — labelled dropdowns under the page title, per the Figma. Every
      option carries its facility count, and `FilterScopeNote` says when a figure
      is a subset. Filters that are active but have no control on the current
      page — a link carrying `?geo=urban` onto a bar with no Setting dropdown —
      surface as clearable chips, so a shared link cannot narrow a page
      invisibly with Reset as the only escape
- [x] `useFilterUrlSync` — filters ↔ querystring, adapted from NPHCDA's (theirs
      is single-valued, ours arrays). Verified: `?state=Kano` → 436 facilities,
      the link round-trips, and filters survive a route change without the
      relative-navigation bug the source file warns about
- [x] `CascadingLocationFilter` — State → LGA → Facility. The first two filter,
      the third *navigates*; the cascade is data-driven rather than from the
      XLSForm `choices` sheet, so every option has facilities behind it
- [x] `EChart` wrapper + `chartTheme` — resize observer, web-font redraw,
      scheme-aware colours resolved from the CSS tokens
- [x] `ThemeToggle` in the sidebar (light / dark / system)
- [x] **Dark mode fixed.** The brand ramp was inverting `--brand-900` from
      "darkest brand" to near-white while the sidebar used it as a background, so
      the navigation rendered white-on-white and vanished. The rail now has its
      own `--sidebar` tokens that stay dark in both schemes, the 500–700 steps
      get *lighter* in dark rather than darker, and every filled brand swatch
      uses `text-surface` instead of `text-white`

**Previously done**
- [x] Vite + React 18 + TS 5 + Tailwind 3, path alias `@/`, code-split build
- [x] Design tokens from the Figma palette (`src/styles/globals.css`), light + dark
- [x] App shell — `AppShell`, `Sidebar`, `PageHeader` with the next-module arrow
- [x] Five routes, lazy-loaded, with `ErrorBoundary` and `PageSkeleton`
- [x] UI primitives: `Card` / `SectionCard` / `KpiTile`, `BandBadge`, `Skeleton` / `EmptyState`, `ErrorBoundary`
- [x] Stores: `filterStore`, `themeStore`
- [x] `DataProvider` + `useFetchJSON` (shared cache, StrictMode-safe)
- [x] `DataSource` interface + `StaticDataSource`
- [x] Domain logic: `bands.ts`, `archetype.ts`, `themes.ts`, `constants.ts`, `format.ts`
- [x] Home page (fully built, not a shell)

**Exit criteria met** — a user can set filters, see them in the URL, share that
URL and land on the same view; all primitives needed by Phases 4–5 exist.

The filter bar is live on Assessment States, the Facility Scorecard and — as of
Phase 5 — the Drill-Down Explorer, which now recomputes its cube client-side when
a filter is active. It shows a different subset of controls there: the map owns
the geographic axis, so state and LGA dropdowns are omitted. State Summary has no
population to filter until its data arrives.

---

## Phase 2 — ETL & scoring · ~95%

Workbook in, `public/data` out.

**Done this session**
- [x] **The 132 rubric questions are bound to their ODK columns** —
      `etl/sources/indicatorBindings.mjs`. Hand-authored, because nothing in
      either file joins prose questions to ODK codes. Guarded by a question-text
      fingerprint per row and by an assertion that every scored column in the
      workbook is claimed by exactly one question, so a rubric re-export that
      reorders rows fails the build instead of shifting every binding by one
- [x] **`deriveIndicatorClasses()` fixed** — it was returning 0 core / 94
      supporting because it looked up the class map by rubric-question id while
      the map was keyed by ODK column name, so every lookup missed and fell
      through to the `?? 'supporting'` default. It now returns **28 core / 41
      supporting score columns** (20 / 29 questions), and the recomputed
      components match the published ones for **11,216 of 11,216
      facility-themes**. Two structural corrections were needed and are
      documented in `docs/SCORING.md`: count columns interleaved in the core
      block, and five byte-identical `device_*` / `functional_device_*` pairs
- [x] **95 `section_m_workflow` columns → 5 `ServicePoint` objects** —
      `etl/lib/servicePoints.mjs`, including the `triage` / `examination`
      vocabulary split between the M-block and H4/H5
- [x] **Sub-theme scores** for all 10 facility-level nodes, on a **renormalised**
      70/30 formula — the unrenormalised one capped single-class sub-themes at
      3.5 or 1.5 and scored `workflow_transition.transition` at 0.08. The build
      now asserts every sub-theme score lands in 1.0–5.0
- [x] Per-indicator scores on every facility
- [x] **Explorer cube extended** — 5 thematic nodes → 15 (overall + 4 themes +
      10 sub-themes), across the same 3,122 geographies
- [x] **22 of the 24 minimum requirements wired.** The two that stay `null` are
      not measurable from the instrument, not pipeline gaps — see VALIDATION.md
- [x] `reviewState` and `formVersion` captured — `ReviewState` *is* on the scored
      sheet after all (`approved` on all 2,804 rows)
- [x] Fixed a silent data bug: `pre_implementation_steps` holds 1/3/5 but carries
      a date number format, so `cellDates` was turning a 3 into `1900-01-03`
- [x] `requirements.json` and `explorer-nodes.json` emitted; facility shards
      slimmed by dropping the recomputed components and the repeated requirement
      labels

**Previously done**
- [x] `etl/build.mjs` orchestrator, runs end to end in ~seconds
- [x] Readers: `eraDataset.mjs`, `xlsform.mjs`, `scoringRubric.mjs`
- [x] Scoring engine (`scoring.mjs`) — bands, theme scores, archetype, roll-up
- [x] `rollup.mjs` — LGA → state → national, with secondary-evidence state shells
- [x] `explorerCube.mjs` — 3,122 geo × theme cells
- [x] **Validation gate passing**: archetype split exact at 533 / 1,838 / 433; reliable power 42.3% and power-ready 34.8% reproduce exactly
- [x] `normalize.mjs` — slug→label, multi-select tokenising, mojibake repair
- [x] Emits 2,812 files; facility detail sharded per UUID
- [x] `docs/SCORING.md`, `docs/VALIDATION.md`, `docs/DATA_DICTIONARY.md`

**Remaining**
- [ ] Reconcile LGA count — 305 derived vs 205 on the Figma; `choices` sheet is
      the arbiter. The only substantive item left, and it affects the LGA
      choropleth's denominators more than any current figure
- [x] **Indicator-level nodes** — done in Phase 5, and *not* by extending the
      cube. `etl/lib/indicatorMatrix.mjs` emits `indicator-scores.json`, a
      50 × 2,804 matrix the browser fetches only when an indicator is selected

**Changed in Phase 5** — cube cells gained a per-node band distribution and a
`scored` count, `facilities-summary.json` gained `subThemeScores`, and
`indicators.json` gained `answeredCount`. New output: `indicator-scores.json`.
See Phase 5's log for why. `bandDistribution` is the new name of what was
`archetypeDistribution` in `scoring.mjs`.

**Exit criteria met** — validation green, every indicator carries a class and its
source columns, sub-theme scores exist for all 10 facility-level nodes, and 22 of
the 24 minimum-requirement checks return real booleans. (The spec said 13
sub-theme nodes; three of those are Leadership & Governance, which has no
facility instrument, so 10 is the complete facility-level set.)

**Invariant — do not break:** `npm run data:refresh` must keep the archetype
split at 533 / 1,838 / 433, and `reliablePower` / `powerReady` exact.

---

## Phase 3 — Maps · 100% ✅

Three layers, all sharing one projection.

**Done**
- [x] `src/lib/mapProjection.ts` — the shared equirectangular projection
      (`MIN_LON 2.67, MAX_LON 14.68, MIN_LAT 4.27, MAX_LAT 13.90` → 1000×760),
      `simplifyRing`/`geomToPath`/`geomCentroid`, plus `geomBounds` +
      `unionBounds` + `paddedViewBox` — new helpers the reference dashboards
      don't have, used so a state or LGA zoom is a **viewBox change**, never a
      reprojection
- [x] **LGA (ADM2) boundaries sourced and converted** —
      `scripts/convert-lga-boundaries.mjs` reads OCHA's COD-AB Nigeria ADM2
      layer (774 LGAs nationally; see the blocker note above for provenance),
      filters to the 12 primary states, and joins each of our 305 LGA ids to
      its GRID3 feature by normalised name. All 305 matched — 289 exactly, 16
      via a hand-checked spelling-variant alias table in the script itself
      (`Dambatta`/`danbatta`, `Kano Municipal`/`kano_minicipal_council`,
      `Garum Mallam`/`garun_malam`, etc.). Output:
      `public/geo/nigeria-lgas.geojson` (305 features, ~1.8 MB uncommitted-raw
      — client-side ring simplification handles the rest, same as the 2 MB
      states file already in the repo)
- [x] `public/geo/nigeria-states.geojson` — copied from
      `../srh-dashboard/public/nigeria-states.geojson` (unchanged; same GRID3
      ADM1 source the LGA layer's provenance matches)
- [x] `NigeriaChoropleth` — national 37-state choropleth. **Not** a port of
      NPHCDA's `NigeriaMap.tsx`: that component draws hand-tuned inline SVG
      paths on its own `800×614.67` viewBox with no real lon/lat behind them,
      which can't share a projection with real LGA polygons or GPS points.
      Rebuilt against `nigeria-states.geojson` through the shared projection
      instead — the guide's "identical projection constants across all
      layers" only has one consistent reading once two of the three layers
      are real geometry. Colours by the three-band scale via
      `fill-ready`/`fill-moderate`/`fill-notready`/`fill-nodata` (Tailwind
      classes already wired to the CSS tokens in `bands.ts`'s `BAND_CLASSES`,
      so it repaints on the dark-mode toggle for free, no `cssVar()` JS
      needed). Secondary-evidence states render an SVG `<pattern>` hatch
      (`MapHatch.tsx`, the SVG counterpart to `.hatch-secondary`) and are
      non-interactive with an explanatory tooltip, never plain "no data"
- [x] `StateLGAMap` — new, not in either reference dashboard (both are
      state-level only). Filters `nigeria-lgas.geojson` to one state and fits
      its viewBox to that state's own bounds via `paddedViewBox`/`unionBounds`
- [x] `LGAFacilityMap` — adapted from
      `../srh-dashboard/src/components/charts/FacilityMapChart.tsx`'s
      dot-plotting approach, scoped to one LGA with an adaptive dot radius
      (viewBox width ÷ 55, clamped) so points stay legible whether the LGA is
      large or small. Draws the LGA's own outline behind the dots for context
- [x] `MapLegend` — shared 3-band + no-data + secondary-hatch legend, reused
      by all three layers with `showSecondary`/`showNoData` toggles per level
- [x] **Drill-down wired into the Explorer** — `ExplorerMap.tsx` switches
      layer by `geoPath.level` and colours every unit from
      `explorerCube.json[geoId][themeNodeId].band` — the guide §8.3 colouring
      table (all-themes → composite/archetype, thematic area → mean,
      sub-theme → weighted mean, indicator → raw score) turned out to need no
      client-side branching at all, because the cube already resolved all of
      that per node during the ETL. At facility level, selecting a point
      offers "View full Scorecard" rather than duplicating the scorecard, per
      guide §8.3

**Bug found and fixed while wiring drill-down:** `useExplorerSelection`'s URL
key for the geographic path was `geo` — which collides with
`useFilterUrlSync`'s `geo` key (the rural/urban filter, mounted globally in
`AppShell` on every route). Every store-driven sync effect deleted any `geo`
param it didn't recognise as an active filter, so a click that set
`?geo=kano` was silently reverted on the next render — drill-in looked like a
dead click. Renamed the explorer's key to `at` (`?at=kano.dala`), and changed
its `update()` to merge into the existing querystring rather than replace it
wholesale, so a filter param riding along won't get wiped by an explorer
action either. `useExplorerSelection.ts` documents the collision inline so
the key doesn't drift back to `geo`.

**Verified in-browser**, light and dark: National → Bauchi (state) → Katagum
(LGA) → a facility → its full Scorecard, breadcrumb and thematic-tree
disabling correct at each depth; switching the thematic selection (e.g. to
Technical Infrastructure) recolours the map live without a navigation; a
secondary-evidence state (Kebbi) shows the hatch, the explanatory tooltip, and
does not drill in on click.

**Exit criteria met** — click through National → State → LGA → Facility on the
map, with the thematic and aggregation selection surviving each hop and
secondary-evidence states visibly distinct and non-drillable.

---

## Phase 4 — The four designed modules · ~85%

Follow the Figma screenshots in `../EMR Dashboard/`.

- [x] **Home** — built
- [ ] **State Summary** (`/states`) — 🔴 **blocked on state-level data.** Readiness counts, national choropleth, five-domain panel, investment bars, roadmap matrix
- [x] **Assessment States** (`/assessment`) — funnel KPIs, `ArchetypeDonut` +
      per-band action cards, and `RankedStateTable` (facilities and archetype
      split per state, sortable, click a row to scope the whole page to that
      state). Itemised investment table still blocked on the cost table
- [x] **Facility Scorecard** (`/facilities/:uuid`) — full detail fetched per
      UUID via `useFacility`; header card with readiness badge, average domain
      score and a plain-language `explainArchetype()` reason; four theme
      columns each with `DomainDonut`, `MinimumRequirementsChecklist` (null →
      "Not assessed", never a failure) and the still-blocked investments
      panel; `ServicePointGrid` below, five cards including an explicit
      "not present at this facility" state for absent points. Investment
      panels still blocked on the cost table
- [x] Charts: `DomainDonut`, `ArchetypeDonut` — both in `src/components/charts/`,
      both go through the shared `EChart` wrapper and `chartTheme`, no second
      charting path

**Everything except the investment panels now has real data behind it and is
rendered.** The scorecard's four donuts read `themeScores`, the checklist reads
`minimumRequirements` (22 of 24 real, 2 null → "not assessed"), and the
service-point grid reads `servicePoints` — five objects per facility with device,
digital-system, infrastructure, staffing and per-point score fields.
`requirements.json` is now wired into `DataProvider` as `requirementDefs`, and
`DATA_PATHS.requirements` was added for it.

**Note:** the Facility Scorecard has **four** domain columns, not five —
Leadership & Governance is state-level only. Confirmed by the Figma, the ODK
instrument and the scored workbook independently. Do not add a fifth column.

**Exit criteria met for the two non-blocked modules** — Assessment States and
the Facility Scorecard render real data end to end, verified in-browser in both
light and dark mode with two facilities (one with every service point present,
one with an absent point and a null minimum requirement) and with the ranked
state table's row-click filter. State Summary remains blocked on §17.1; every
investment panel remains blocked on §17.4.

---

## Phase 5 — Drill-Down Explorer · 100% ✅

The module that isn't in the Figma. Spec is guide §8. Both axes are now complete
to the depth §8.1 specifies — geographic National → State → LGA → Facility,
thematic All → area → sub-area → **indicator**.

**Done this session — the indicator level (guide §8.1's fourth thematic step)**
- [x] **`indicator-scores.json`, fetched on demand** — 50 scored indicators ×
      2,804 facilities, 541 KB raw / ~99 KB gzipped. Deliberately *not* in the
      cube: 50 more nodes across 3,122 geographies would roughly quadruple a
      6.7 MB file to serve a level most sessions never open. `useExplorerData`
      passes `useFetchJSON` a null path until an indicator is actually selected,
      and the hook's module cache means selecting a second one is free.
      **Verified in-browser: zero requests on page load, zero when expanding the
      rail to read the questions, one when an indicator is selected**
- [x] **Values ship unrounded, and there is a test saying why.** A question asked
      once per service point, at a facility with three of the five present,
      yields 11/3 — which *is* `BAND_UPPER_CUT`, so the facility is Moderately
      ready. Rounded to 2, 4, 6 or 8 decimal places it lands above the cut and
      silently becomes Ready. The long floats this preserves are 0.1% of values
      and cost nothing after gzip
- [x] **`answeredCount` on every indicator definition** — `indicators.json` is
      loaded up front, the matrix is not, so the rail can warn about thin
      coverage *before* the click rather than after a download resolves to
      nothing
- [x] `ThematicTree` gained a third expandable level, showing each question with
      its respondent count and, where it applies, an "unweighted" marker
- [x] `ContextPanel` gained a coverage note, a class badge and a loading state;
      `describeThemeNode` resolves indicator ids against the runtime definitions

**Coverage is the whole story at this level, and the UI is built around it.**
Every facility carries all four theme scores and all ten sub-theme scores, so
until now `scored` and `n` were always equal and the machinery for showing the
difference was theoretical. At indicator level it is routine, and often by
design: the EMR-transition questions sit behind a skip pattern and are answered
by 158 facilities of 2,804, `data_use_reporting.inefficiencies.q106` by 20. A
national mean over 158 respondents is sound about those 158 and badly wrong
about Nigeria, and nothing in a score, a band or a distribution bar reveals
which of the two it is. So the panel states the answer rate on every indicator
selection, warns when it is below half, and says outright when it is zero —
"nothing here is a readiness finding, it is an absence of data". The rail marks
partial coverage before selection, the CSV carries `Facilities scored` beside
`Facilities assessed`, and the ranked table shows em-dashes rather than zeros.

**One reporting bug found and fixed**
- **Two different unrankable states read as one.** Selecting Q106 at Lagos —
  where no facility answered it — produced "Nigeria has no peer set" in the rank
  card, because both "there is no peer set" and "this unit has no value to be
  ranked by" collapsed to a null `peers`. `ExplorerPeers.rank` is now nullable,
  and the second case says "Not ranked — nothing here is measured on this
  selection, and an unmeasured unit is not a bottom-placed one. 2 of the 37
  states in Nigeria do carry a value." Also: the zero-respondent warning said
  "no facility here answered" at the facility leaf, where the population is one.

**Verified in-browser**, light and dark:

- Q2 (grid hours) nationally: 1.86/5, Not ready, 1,449 of 2,804 answered (52%),
  1,015 / 242 / 192 across the bands — checked against an independent Node
  recompute over the raw matrix
- Q2 × Kano × `funding=BHCPF`: 401 facilities, 163 answered, 1.28/5, top LGAs
  Rano 4.00 (n=7), Takai 2.00 (n=8), Bagwai 1.80 (n=9) — also independently
  recomputed. The indicator level composes with filters exactly as the cube
  levels do
- Q106 × Lagos: no respondents → "No facility here answered this question",
  band "No data", all 20 LGA rows em-dashed with their facility counts intact,
  and the map grey rather than Not ready
- ~11 ms per keystroke on an indicator node at national level in the dev build

**Previously done this phase**
- [x] **One resolver behind every surface** — `useExplorerData` answers the whole
      (geography × theme × aggregation × filters) query once, and the map, the
      context panel and the ranked table are three views of its output. That is
      what makes guide §8.3's "every number on screen must reflect the filters"
      enforceable rather than aspirational: there is now exactly one place a
      figure can come from. `ExplorerMap` was rewired onto it and no longer
      reads the cube itself
- [x] **The cube recomputes under filters** — no filter active, cells are read
      from `explorer-cube.json` (a lookup, per §8.4); filter active, they are
      recomputed from `facilities-summary.json`, because filters restrict the
      population *before* aggregation and a build-time cube cannot answer that.
      `src/lib/explorerCube.ts` is the browser mirror of
      `etl/lib/explorerCube.mjs`
- [x] **The mirror is pinned by test, not by discipline** —
      `src/lib/explorerCube.test.ts` recomputes the shipped cube from the
      shipped summary and asserts agreement cell for cell: national and all 12
      states × all 15 nodes, all 305 LGAs, 200 single-facility cells. Two copies
      of one formula drift, and the symptom here would be figures that change
      depending on whether a filter happened to be active
- [x] **`FilterBar` is now on this page** — funding, functionality and setting,
      plus search. State and LGA dropdowns are deliberately *not* shown: the map
      owns the geographic axis and a second geography control would leave two
      answers to "where am I". One carried in from another module still surfaces
      as a clearable chip. A scope banner says which population is in force and
      that it will not equal the published national figures
- [x] `ContextPanel` — score, band, n, distribution bar, peer rank, and the
      five-theme small multiples (clickable, so they double as a theme picker).
      Leadership renders as state-level-only with the §17.1 blocker named, never
      as missing data
- [x] `RankedTable` — child units ranked on the active aggregation, sortable on
      every column, click-through to drill, CSV export
- [x] `src/lib/export.ts` — `exportCSV` + `exportFilename`, ported from
      NPHCDA's `export.ts` but cut to CSV alone; pulling `xlsx`/`html2canvas`/
      `jspdf` in before anything calls them would cost every visitor the
      download for a Phase 7 feature. UTF-8 BOM included or Excel mangles `₦`.
      *(Phase 7 has since added Excel, PNG and PDF behind `await import()`, and
      the ranked table's single "Export CSV" button is now an `ExportMenu`.)*

**Data-shape changes made to support the above** (`npm run data:refresh` re-run,
invariants re-verified: 533 / 1,838 / 433 exact, `reliablePower` 42.3 and
`powerReady` 34.8 exact, 11,216/11,216 theme components)
- [x] **Cube cells now carry a per-node band distribution**, not the archetype
      split repeated against every node. The two coincide only for `overall` —
      where the encoded 1/3/5 values band back to the archetype they came from,
      so that cell is unchanged — but for a thematic area they answer different
      questions, and captioning a workforce selection with the archetype split
      put a number on screen unrelated to the theme the user picked
- [x] **Cells carry `scored` alongside `n`** — how many of the `n` facilities
      hold a value for this node, and the denominator the distribution sums to.
      Equal to `n` across the whole current dataset; a bar drawn over a smaller
      denominator than the `n` printed beside it would overstate its coverage
- [x] **`facilities-summary.json` carries `subThemeScores`** — the ten
      facility-level sub-theme scores per row, ~19 KB gzipped over the file.
      Without them the explorer's ten sub-theme nodes would go blank the moment
      anything was filtered, which is the same broken promise as a control that
      does nothing. Precomputing a cube per filter combination (the other option
      §8.4 offers) is 12+ × 6.7 MB and was not close
- [x] `bandDistribution` replaces `archetypeDistribution` in `etl/lib/scoring.mjs`
      — same function, and it is now called with banded theme scores as well as
      with archetypes, so the old name had started to lie

**Two reporting bugs found and fixed while building the panel**
- **Ranks hid ties.** All ten facilities in Kano › Dala are Moderately ready, so
  on the overall node all ten hold the value 3 and every one of them rendered
  "1st of 10" — which reads as *best in the LGA*. `PeerRank` now carries
  `tiedWith` and the panel says "Joint 1st … level with 9 of them".
- **The CSV called its first column "Rank"** while the reader could re-sort the
  table by any column, so "3" could mean third by facility count. It is now
  `Position` with a `Sorted by` column stating the actual sort and direction.

Smaller corrections: the breadcrumb was title-casing an ODK UUID at facility
level (now takes the facility's name); a facility's overall cell holds its
archetype encoded as 1/3/5, so the panel prints the facility's own average
domain score instead of "3.0/5"; desk-review rows in the national table no
longer drill, matching the map, which disables them with a reason; LGA names
are title-cased out of the export's shouty caps; a single-facility small
multiple says "Moderately ready" rather than "0% ready".

**Previously done**
- [x] `ExplorerPage` layout, `ThematicTree`, `ExplorerBreadcrumb`,
      `AggregationToggle`
- [x] `useExplorerSelection` — both axes plus aggregation in the URL (URL key
      for the geo path is `at`, not `geo` — see Phase 3's bug note; do not
      rename it back)
- [x] Sub-theme cells hold real scores — 15 thematic nodes × 3,122 geographies
- [x] `ExplorerMap` — the three map layers, built in Phase 3

**Nothing remaining.** The module is complete against guide §8.

**Exit criteria met** — verified in-browser in both themes at 1280 and 1440:

- "Power-stabilisation readiness across the LGAs of Kano" is two clicks (Power
  in the rail, Kano on the map) and produces
  `/explore?theme=technical_infrastructure.power&at=kano`, which reproduces the
  view from a cold load
- Kano × Power: 3.31/5, moderately ready, 436 facilities, 87/143/206 across the
  bands, 9th of 12 states in Nigeria, 44 LGAs ranked below
- Adding `funding=BHCPF` moves every one of those figures (3.44/5, 401
  facilities, 64/132/205) and the map fills with them; all three were checked
  against an independent Node recompute over the raw summary
- Switching to % Ready re-ranks the LGAs into a different order — which is the
  entire reason both measures are offered
- Table row-click drills National → State → LGA → Facility; at the facility leaf
  the table keeps listing its siblings with the selected one highlighted, and the
  panel links out to the Scorecard rather than duplicating it
- The 25 secondary-evidence states appear in the national table with a
  "desk review" chip and em-dashes, sorted last, non-drillable — never as zero
- CSV export carries geography, thematic path, sort, both measures, band, `n`,
  `scored`, band counts and evidence grade
- A filter keystroke costs ~18 ms end-to-end at national level in the dev build
  (full recompute, 37 polygons repainted, panel and 37-row table re-rendered)

---

## Phase 6 — Investment & roadmap · ~5% · 🔴 blocked

- [x] Structure scaffolded — `etl/lib/investment.mjs`, `COST_TABLE`, `QUANTITY_RULES`
- [ ] **Unit costs in ₦** — client
- [ ] Quantity rules: devices and staffing are derivable from the workbook; roofs, furniture, venues and IT personnel have no measured source
- [ ] Priority assignment rule (High / Medium / Low)
- [ ] Roadmap horizon decision — the Figma's single 6-month plan contradicts the deck's per-archetype timelines
- [ ] `InvestmentList`, `InvestmentBars`, `RoadmapMatrix`

Fill `COST_TABLE` and `QUANTITY_RULES` and this goes live without touching
anything downstream. Publishing invented naira figures against a government
investment plan would be worse than publishing none.

---

## Phase 7 — Export, RBAC, polish · ~90%

### Done this session — the export port, finished

- [x] **Excel, PNG and PDF, all behind `await import()`.** `src/lib/export.ts`
      now holds `exportCSV`, `exportExcel`, `exportElementToPNG`,
      `exportElementToPDF` and `exportTablePDF`. **Verified against a production
      build:** `xlsx` (500 kB), `html2canvas` (201 kB), `jspdf` (390 kB) and
      `jspdf-autotable` (31 kB) each emit their own chunk, none is referenced by
      the entry chunk or preloaded from `index.html`, and a cold load of
      `/explore` fetches none of them. The initial bundle grew 3.4 kB
- [x] **`ExportMenu`** — one export control, used by the explorer's ranked
      table, the explorer page, the Facility Scorecard and the ranked state
      table. Holds a visible working state (every format costs a round-trip on
      first use) and surfaces failures as a toast, because rasterising a large
      page is the one interaction here that can genuinely fail at runtime
- [x] **`exportTablePDF` typesets the table rather than photographing it.** A
      305-row LGA ranking rasterised is megabytes of unsearchable image broken
      across pages mid-row; through `jspdf-autotable` — a dependency that had
      been sitting unused — it is 20 kB of selectable text with the header
      repeated. Checked at 120 rows → 4 pages, 20 KB
- [x] **Every format carries its provenance.** The CSV already did, in columns.
      Excel gets an About sheet, the PDF a header block, and the PNG a caption
      strip burnt into the image. A filtered map pasted into a slide is visually
      identical to an unfiltered one, which is the misquote `ScopeBanner` exists
      to prevent — and once it has left the app nobody can tell
- [x] Excel: blanks stay genuinely blank (so `AVERAGE` skips unmeasured units
      rather than reading them as zero), columns sized to content, autofilter on
- [x] `html2canvas` and `xlsx` **moved from devDependencies to dependencies** —
      they now ship in the client bundle, and `npm ci --omit=dev` would have
      failed the build

**Bug found and fixed while verifying the PDF:** `exportElementToPDF` drew the
header, then the capture, then the two white rects that cut the capture back to
the page's printable band — and the top rect painted straight over the header.
The header is now measured before the masks and drawn after them; `drawHeader`
grew a `draw: false` mode for exactly that. Caught by decoding a probe PDF's
content stream, not by looking at it, which is the only reason it was found.

### Done this session — accessibility

The scale is red / amber / green, the single worst combination for deuteranopia
and protanopia, and our amber and red sit within four points of the same
lightness so they do not separate in greyscale either. `BandBadge` always paired
colour with an icon and a label; that pattern now reaches the surfaces where no
label fits.

- [x] **One carrier vocabulary, three renderings** — `BAND_TEXTURE`,
      `BAND_MARKER` and `bandDecal()`. Solid for Ready, dots for Moderately
      ready, 135° stripes for Not ready. Ready is deliberately the untextured
      one: it is the band that should read as complete, and leaving the best
      case clean stops the texture reading as damage
      - HTML areas → `.band-texture-*` in `globals.css` (distribution bars,
        legend swatches)
      - SVG areas → `components/map/BandPattern.tsx` (both choropleth layers)
      - canvas → `bandDecal()` in `chartTheme.ts` (both donuts)
- [x] **135°, not 45°.** `MapHatch` owns 45° for the *evidence* grade, which is
      a different axis. Lines at one angle mean "desk review", lines at the
      other mean "not ready". Lines = evidence, dots = readiness
- [x] **Facility markers use shape, not texture** — circle / square / triangle,
      equal-area so they read as different shapes rather than different sizes. A
      dot on the facility layer is a few pixels across and a stripe inside one is
      neither visible nor countable
- [x] **Texture tiles scale with the live viewBox** (`textureUnit()`), so a dot
      is the same size on screen on the ~700-unit national view and on a
      sub-20-unit rural LGA, and does not inflate as the reader zooms. Same
      correction the stroke widths already made
- [x] **Marks are a fixed dark ink, not `--foreground`.** Found in dark mode:
      the band colours do not follow the colour scheme — amber is the same amber
      — so a mark drawn from `--foreground` flipped to near-white against a
      background that had not changed, and the texture all but vanished
- [x] `MapLegend` shows the textures and the marker shapes, and takes
      `marks="point"` at facility level. A legend showing three flat colours
      against a textured map is worse than none: it tells the reader who cannot
      separate the colours that there is nothing else to look for
- [x] Small multiples in `ContextPanel` gained the band glyph (`BandIcon`) — the
      score's colour was the only thing saying which band it was
- [x] Service-point chips now print the score (`Device 5`, `Action plan —`).
      The tint was the band; the label named the measure, not the result
- [x] **Drillable table rows are reachable from a keyboard.** Both ranked tables
      hung the drill on `<tr onClick>` alone. The name cell is now a real
      `<button>`; the row stays clickable as a convenience. `role="button"` on a
      `<tr>` would have "fixed" it by destroying the table semantics a screen
      reader navigates with. `aria-selected` → `aria-current` on those rows
- [x] **Skip link** — `AppShell` had a comment claiming one for years and no
      link. Five navigation items came before the content on every route

### Done this session — responsive

The Figma has no mobile design at all, so these are decisions, not translations.

- [x] **The Explorer's small-screen behaviour, decided first** (it is the widest
      surface: 18rem rail + map + panel + 15-column table). Below `lg` the
      thematic rail moves behind a picker button that *states the current
      selection* and opens a drawer over the map — `ThemePicker.tsx`, which
      carries the argument in full. The two alternatives and why they lose:
      stacking the rail above the map means scrolling past ~50 indicator nodes
      on every theme change; Map | Themes tabs kill the one interaction that
      joins the two axes, which is picking a theme and watching the fills move.
      The picker keeps guide §8.1's "one interaction per axis" — tap the button,
      tap a node, the drawer closes onto the recoloured map
- [x] **App shell** — the 16rem rail was 68% of a 375px viewport. Below `lg` it
      becomes a top bar plus a slide-over (`MobileNavBar`). Written by hand
      rather than through the shared `Drawer` because the rail is the one
      surface that stays dark in both schemes, and `Drawer` is a `bg-surface`
      panel. Not narrowed to an icon strip: the labels are what make this
      navigable to someone who has not used it before
- [x] `min-w-0` on the shell's content column — without it the flex child sized
      itself to the widest ranked table and the whole page scrolled sideways
      instead of the table scrolling inside its card
- [x] Page padding, title sizes and card padding step down at `sm`/`lg`; filter
      controls share rows below `sm` instead of each taking one; the next-module
      arrow is hidden on phones, where it competes with the navigation button
- [x] **Verified in-browser at 375, 768 and 1440**, light and dark: no
      horizontal page scroll at any width, the ranked table scrolls inside its
      own card with name and metric visible first, the theme picker round-trips
      (`?theme=technical_infrastructure`), and the desktop layout is unchanged

- [x] Dark mode — token ramp fixed in Phase 1; every surface added this session
      re-verified in both schemes

### Done this session — loading, empty and error states

The three outcomes besides "has data" were collapsing into one message, and the
one they collapsed into was usually wrong.

- [x] **`LoadError`** — a shared, retryable failure state beside `EmptyState`,
      deliberately not styled like it. An empty state is an answer and the
      reader can stop looking; a failed fetch is the absence of one and they
      should try again. It shows the technical detail rather than hiding it in a
      console: the people operating this dashboard are the people who deploy it
- [x] **The bug this exists for.** A 404 on `facilities-summary.json` reached
      the reader as *"No facility data loaded — run `npm run data:refresh`"*,
      sending whoever saw it to rebuild an ETL over what was a bad path. Every
      module now branches on `error` **before** the empty check
- [x] **`FetchError` carries the HTTP status**, and `isNotFound()` reads it. The
      Facility Scorecard reported *every* failure as "Facility not found",
      including timeouts — sending the reader hunting for a typo in a UUID that
      was correct. Only a real 404 on the shard says that now
- [x] **A missing data file does not 404 — it succeeds.** Found while forcing
      failures: netlify.toml's `from = "/*"` SPA fallback returns `index.html`
      with a 200 for any unmatched path, so a data file left out of a deploy
      arrives as HTML, `res.json()` throws inside the parser, and the single
      most likely production failure this app has reported itself as
      `Unexpected token '<'`. Fixed in both places — `/data/*` and `/geo/*` now
      404 ahead of the catch-all, and `useFetchJSON` detects the shell and says
      *"returned the application shell instead of JSON — the file is missing
      from this build or deploy"*
- [x] **`LGAFacilityMap` had no error branch at all** — a failed boundary fetch
      left it on its skeleton indefinitely. All three map layers now share the
      same retryable state
- [x] **Assessment States**: a skeleton while the summary is in flight. It used
      to render `—` in the KPI tiles, a grey "No data" donut and three band
      cards reading `0`, which is an in-flight state dressed as a finding
- [x] **"No data" and "no matches" separated.** Assessment States' empty message
      fired both when nothing loaded *and* when filters excluded everything, so
      picking Rivers + Functional L2 told the reader to rebuild the ETL
- [x] Failures never blank readable figures: `useFetchJSON` keeps the last good
      value, so where data is present the error rides above it as a staleness
      warning rather than replacing it. Only a cold failure takes the page

**Verified in-browser by taking `public/data` and `public/geo` offline** and
sampling the DOM through a retry: error → skeleton (6 bars, error still shown)
→ figures, with "Try again" recovering without a reload. Home and State Summary
need none of this — both are built entirely from constants and fetch nothing.

### Done this session — the performance pass

Measured before anything was changed, on the **production build** served by
`vite preview`, and re-measured after. Desktop, 15 cores — so read every figure
below as a floor, not a ceiling: the audience that matters is a mid-tier Android
phone on a weak connection, and CPU-bound work there runs roughly 4–6× slower.

**Method, and its one limit.** Wire cost is measured — `gzip -9` over the actual
payloads, since neither dev nor preview compresses `.geojson`. CPU cost is
measured directly (`PerformanceObserver` on `longtask`, `JSON.parse` timed over
the real files). The browser surface available here exposes no CDP throttling,
so the mobile figures quoted are *arithmetic* on measured desktop work, not
observed on a throttled profile. A CDP CPU throttle is a rate limiter, so ×4 on
a measured block is a faithful model of one — but it is a model, and worth
confirming on a real handset before anyone quotes it externally.

#### What was actually wrong — and it was not the cube

The finding this pass started from was real but second-order. The one that
mattered was found by decomposing a long task nobody had looked inside.

- [x] **`geomLabelPoint` was the cost, not `geomToPath` — by 8.5×.** Both run in
      the same `useMemo` in every map layer. Over the national view's 37 states
      (53,761 vertices) `geomToPath` costs 51 ms and `geomLabelPoint` costs
      **435 ms**. The two together account for essentially all of the 503 ms long
      task measured on a cold Explorer entry. `polylabel`'s `signedDistance` is
      O(all vertices) per candidate cell, and it ran ~3,760 cells
- [x] **The memo was per-component-instance, so the cost repeated.**
      `NigeriaChoropleth` unmounts on drill-in and mounts again on drill-out, and
      its memo dies with it — even though `geo.data` is a stable reference across
      those mounts (`useFetchJSON` caches parsed JSON per path for the session).
      Every drill-out repaid it: **132 ms** measured. So did every switch between
      the two routes that show the national map
- [x] **Fixed by caching, not by approximating** — `WeakMap`s in
      `mapProjection.ts` keyed on the geometry object, for the path (per `eps`),
      the label anchor and the bounds. Derivations are pure functions of geometry
      and depend on no score, filter, theme or viewport, so they are now computed
      once per geometry per session
- [x] **`signedDistance` optimised exactly** — squared distances (one `sqrt` at
      the end instead of one `Math.hypot` per segment) plus a per-segment
      bounding-box reject. 1.5× on states, 1.9× on LGAs, verified at **zero**
      label displacement and zero inscribed-radius delta across all 37 states and
      all 305 LGAs
- [x] **The obvious optimisation was measured and rejected.** Simplifying the
      ring before `polylabel` — the way `geomToPath` already simplifies before
      emitting commands — buys 3.4× at `eps=1` and moves labels by up to **40
      viewBox units** on a 1000-unit-wide map. That is precisely the "label is
      not inside its own area" failure the pole of inaccessibility exists to
      prevent. The rejection is recorded in the function's comment so it is not
      rediscovered as a good idea

#### Route-scoping the cube

- [x] **`explorer-cube.json` is fetched on `/explore` only**, via the Phase 5
      null-path pattern. `DataProvider` moved inside `BrowserRouter` so it can
      read the location, and holds a one-way latch — once requested it stays
      requested, so returning to the explorer never shows an empty cube for a
      frame. Landing on Home went from **9.57 MB to 2.86 MB** decoded and from
      **~562 kB to ~309 kB** on the wire
- [x] **`facilities-summary.json` deliberately left eager.** Comparable weight
      (2.45 MB / 255 kB gz) but three of the five routes read it, it backs the
      filter bar's option counts on all of them, and scoping it would trade a
      faster landing page for a stall on the first navigation that matters. The
      cube had no such claim — four routes out of five never touch it

#### Measured fine, changed nothing

- [x] **The client-side cube recompute under filters.** Re-checked at LGA level
      as asked: drilled into a state, 14 keystrokes into the search box, each one
      a full recompute plus a map repaint. **Not one keystroke exceeded 16 ms**,
      let alone the 50 ms long-task threshold. Phase 5's ~18 ms figure holds and
      LGA level does not degrade it
- [x] **`echarts` is correctly isolated.** Confirmed statically: it is reached
      only from `AssessmentStatesPage` and `FacilityScorecardPage`, and confirmed
      in the browser that a cold load of Home fetches four JS chunks totalling
      ~75 kB gz with `echarts` not among them. **`echarts/core` with per-chart
      registration was not done** — it would touch every chart to fix a chunk
      that two routes already pay for lazily and three never see
- [x] **`geomToPath` on state drill**, the specific suspicion raised: real, and
      1.4–3.8 ms. Now cached to zero on repeat, but it was never the problem

#### Caching headers

- [x] `/data/*` gains `stale-while-revalidate=86400`. Under plain
      `max-age=3600` the hour expires and the next visit *blocks* on
      re-downloading files that are almost always byte-identical; SWR serves the
      cached copy and refreshes behind it
- [x] `/geo/*` had **no cache policy at all** and now gets a week plus a month of
      SWR — administrative boundaries are not ETL output and change only when a
      boundary source is replaced. An explicit `Content-Type` too: `vite preview`
      serves `.geojson` unrecognised and therefore **uncompressed**, 2.04 MB
      against 877 kB gzipped. **Worth confirming against the real deploy's
      response headers** — this is a header, not a proof
- [ ] Content-hashed data filenames, which would allow `immutable` and remove
      revalidation entirely. Needs the ETL to emit hashed names and the app to
      resolve them through a manifest. Not a header change, and not needed yet

#### Net

| production build, desktop | before | after |
| --- | --- | --- |
| Home — data decoded | 9.57 MB | 2.86 MB |
| Home — wire (gzip) | ~562 kB | ~309 kB |
| Explorer cold entry — main-thread block | 557 ms | 328 ms |
| Drill out to national | 132 ms | 0 |
| Repeat drill into a state | 82 ms | 0 |
| Filter keystroke at LGA level | <16 ms | <16 ms |

### Done this session — the report builder

`/reports`, a sixth module. Layout and interaction model ported from
`../sfm-dashboard/apps/web/app/(app)/reports/page.tsx`; **nothing else** — SFM
builds its reports on a Python backend and previews them in an `<iframe
srcDoc>`, and this dashboard has no server.

- [x] **The preview is real DOM, and the PDF is a capture of that same element.**
      An iframe would not inherit the theme, could not be selected with the page,
      would be invisible to the app's accessibility tree, and — decisively —
      could not be handed to `html2canvas`. So there is one description of a
      report (`reportModel.ts`), one builder (`buildReport.ts`), one rendering
      (`ReportDocument.tsx`), and the file cannot disagree with the screen
- [x] **A consumer of `lib/export.ts`, not a second export path.** PDF via
      `exportElementToPDF`, PNG via `exportElementToPNG`, both behind
      `await import()`. Verified in the production build: `ReportBuilderPage` is
      its own 28.5 kB / 8.98 kB gz chunk, the initial bundle grew **0.44 kB
      gzipped**, and `jspdf` + `html2canvas` are fetched only when Download is
      pressed. A national summary exports to a 220 kB PDF in ~3 s
- [x] **Four templates**, each authored against what the data supports —
      national summary, state brief, thematic deep-dive, facility scorecard pack.
      A template whose scope cannot support it is **disabled with the reason**
      rather than generating a page of dashes: the state brief refuses with
      *"12 states are in scope. This brief covers one."*
- [x] **The scorecard pack is capped at 40** and says so in the report. Facility
      detail is sharded per UUID, so it fetches 40 shards (389 kB, ~1 s
      measured). A truncated pack that does not admit it reads as a complete one.
      Failed shards raise a toast and are named as missing rather than silently
      dropped
- [x] **Every report carries its provenance** in the same `ExportNote` shape the
      CSV, Excel, PNG and PDF exports already use — rendered into the document
      *and* passed as the PDF header block, so the claim survives the file
- [x] Single `busy` state machine (`null | 'generate' | 'export'`), per the port
- [x] The caveats are load-bearing content, not decoration: Leadership &
      Governance absent from every facility breakdown, sub-themes not decomposing
      their theme score, theme bands not matching the archetype split, the two
      permanently-unassessable minimum requirements, and the 12-primary-state
      limit on every national figure

**Three bugs found while verifying, all in-browser:**

1. **The national summary claimed a "Thematic selection" it never used.** The
   theme picker always holds a value so the deep-dive has a default, and the
   provenance block listed it regardless — a report asserting a narrowing that
   never happened. Now scoped to the deep-dive alone. Provenance that overstates
   is the exact failure the block exists to prevent
2. **`text-white` on `bg-brand-600` measured 1.97:1 in dark mode** — an AA
   failure, and a violation of a rule `globals.css` already states beside the
   brand ramp: *pair a filled 500 with `text-surface`, never `text-white`*. The
   ramp inverts between schemes and white does not. Now `bg-brand-500` /
   `text-surface`, measured **6.23:1 in both schemes**. This is the same
   token-port trap that made NPHCDA's `--c-bg` render black, caught this time by
   measuring rather than looking
3. "across 1 states" — pluralisation, fixed

**Verified in-browser at 375, 768 and 1440 in both schemes**, all four templates
generated, PDF export exercised end-to-end. No horizontal overflow at any width;
wide tables scroll inside their own container. Distribution figures check against
`VALIDATION_TARGETS` exactly (533 / 1,838 / 433).

### Remaining

- [ ] **RBAC — still needs the decision, and it is not a data blocker.** Does an
      EMR vendor see PII? The dataset carries facility GPS, OIC names and phone
      numbers. Deliberately untouched: any answer that involves real enforcement
      reopens the no-backend decision, and a client-side role toggle over data
      the browser has already downloaded is security theatre, not access
      control. `../sfm-dashboard/apps/api/app/auth/` is the reference if a
      backend is on the table
- [ ] **"Refine with AI" — dropped, and now gated on the same question as RBAC.**
      SFM's version calls a backend endpoint; an API key in a static client
      bundle is a leaked key, so it cannot exist on the current deploy. **The
      client has since said the target is AWS with a Lambda**, which does not
      change what shipped this session but does change the constraint: if a
      Lambda lands, this and RBAC both reopen, and RBAC stops being theatre
      because the server can filter the payload rather than the client hiding it.
      Neither is built against a deploy target that does not exist yet —
      `netlify.toml` is still the deploy
- [ ] A **fifth report template** — the client selected "Something else" alongside
      the four built here but the custom text did not come through. Ask
- [ ] **Two constants disagree with the shipped data**, found while building the
      report builder and left alone deliberately, since both are sanity-check
      figures rather than anything the app computes from:
      `COVERAGE.lgas` says 205 where the facility population has 304 distinct
      LGA ids (and the geo file 305), and `PRIMARY_STATE_FACILITY_COUNTS.Rivers`
      says 146 where the data has 144. Worth someone confirming which is right
      before either is quoted

---

## Kickoff prompts

Paste into a fresh session. Each assumes the guide and this file are read first.

### Phase 4 — done except the two blocked pieces

Facility Scorecard and Assessment States are built and verified in-browser
(`DomainDonut`, `ArchetypeDonut`, `MinimumRequirementsChecklist`,
`ServicePointGrid`, `RankedStateTable`, `useFacility`). What's left in this
phase is not more building — it's unblocking: State Summary needs the
state-level data table (§17.1), and every investment panel across both modules
needs the cost table (§17.4). Revisit this phase only when one of those lands.

### Phase 3 — complete

All three map layers are built and wired into the Explorer, verified
in-browser in both themes. Nothing left to revisit unless a real bug turns up.

### Phase 5 — complete

All four thematic levels, all four geographic levels, the context panel, the
ranked table, CSV export and the filter-aware recompute are built and verified
in-browser in both themes. The exit criteria and the figures they were checked
against are logged in the Phase 5 section above. Nothing here needs revisiting
unless a real bug turns up.

Two things to know before changing anything in this module:

1. **Run `npx vitest run src/lib/explorerCube.test.ts` and read the header of
   `src/lib/explorerCube.ts`.** Every cube cell has two independent
   implementations — the ETL's and the browser's — and that test is what holds
   them together by recomputing the shipped cube from the shipped summary. If
   you change how a cell is computed, change both.
2. **Do not round `indicator-scores.json`.** It looks like obvious dead weight
   at 541 KB of long floats. `11/3` is exactly `BAND_UPPER_CUT` and is reachable
   by any facility with three of five service points, so rounding at *any*
   precision moves it from Moderately ready to Ready. There is a test asserting
   this; if it ever fails, the fix is not to loosen it.

### Phase 7 — the remainder (current — start here)

Export, accessibility, responsive, the loading/empty/error sweep, the
performance pass and the report builder are all done and verified in-browser.
What is left is not building — it is one decision the client owns, and whatever
that decision unlocks.

**Before changing anything in the band scale:** `BAND_TEXTURE` and `BAND_MARKER`
in `src/lib/bands.ts` are the source of truth, and there are three renderings of
them — CSS classes in `globals.css`, `<pattern>` elements in
`components/map/BandPattern.tsx`, and `bandDecal()` in `chartTheme.ts`. They
have to keep saying the same thing; a reader who learns "dots mean moderate" on
the map must not meet a different dots on the donut beside it. The mark ink is
deliberately a fixed dark, *not* `--foreground` — see the comment there before
"fixing" it.

**Before touching any map layer:** the geometry derivations in
`mapProjection.ts` are cached in `WeakMap`s keyed on the geometry object, which
is what makes drill-out free. That cache is only correct because `useFetchJSON`
returns a stable parsed-JSON reference per path for the session. If that ever
changes, the cache silently stops hitting and the 435 ms comes back with no
error to notice it by. The comment there carries the measurements.

**Before "optimising" `polylabel`:** simplifying the ring first was measured and
rejected — it moves labels up to 40 viewBox units, outside their own polygons.
Read the comment on `signedDistance` before trying it again.

```
Phase 7 (Export, RBAC, polish) of the EMR Readiness Assessment Dashboard —
the last of it. Read docs/PHASES.md Phase 7 first.

Export, accessibility, responsive, the loading/empty/error sweep, the
performance pass and the report builder have all landed and are verified
in-browser at 375/768/1440 in both schemes. What is left is gated on decisions,
not effort:

1. RBAC — still the one blocking question: does an EMR vendor see PII? The
   dataset carries facility GPS, OIC names and phone numbers. A client-side role
   toggle over data the browser has already downloaded is theatre.
2. The client has said the deploy target is AWS with a Lambda. That is a change
   of constraint, not a task: if a Lambda lands, RBAC stops being theatre (the
   server can filter the payload) and the report builder's "Refine with AI" card
   becomes possible. Neither should be built against a target that does not
   exist yet — netlify.toml is still the deploy. Establish whether the Lambda is
   real before writing anything that assumes it.
3. A fifth report template — the client picked "Something else" alongside the
   four that are built, and the custom text never arrived. Ask what it is.
4. Confirm two constants against the data before anyone quotes them:
   COVERAGE.lgas says 205 against 304 distinct LGA ids in the population, and
   PRIMARY_STATE_FACILITY_COUNTS.Rivers says 146 against 144.

House rules that bit this session, so they are not rediscovered:
- Run `npx vitest run src/lib/explorerCube.test.ts` before and after anything
  near the cube.
- Pair a filled brand background with `text-surface`, never `text-white` — the
  brand ramp inverts between schemes and white does not. globals.css says so
  beside the ramp; ignoring it produced a 1.97:1 button.
- Verify in-browser at 375, 768 and 1440 in both schemes before calling anything
  done, and measure contrast rather than eyeballing it.

Update docs/PHASES.md before finishing.
```
