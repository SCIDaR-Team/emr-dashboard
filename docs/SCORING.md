# Scoring — as implemented

**Authoritative source: `ERA dataset_v4.xlsx` at the repo root — the v2
workbook.** This replaced the earlier copy in `../EMR Dashboard/` (still read
for XLSForm labels only; see below). The two are genuinely different files —
different sheets, a consolidated scoring methodology, a different indicator
set — not two versions of the same data. `etl/sources/eraDataset.mjs`,
`etl/sources/scoringRubric.mjs` and `etl/lib/indicatorBindings.mjs` are the
v1 reader and are no longer called by `etl/build.mjs`; they are kept only
because `eraDatasetV2.mjs` still imports their generic helpers
(`readSheet`/`resolveColumn`/`indexColumns`/`normalizeBand`).

**Status: provisional.** The v2 workbook's own theme-score columns are
labelled `REVISED — QA ONLY`, and its archetype column `pending revised
archetype rerun` — the assessment team has not signed off on this
methodology against itself yet. Everything below is what the dashboard
computes from what's in the workbook today; it is not a claim that the
workbook's own authors consider it final.

## What changed from v1

| | v1 | v2 |
|---|---|---|
| Scored indicators | 94 | **20** (8 Technical Infrastructure, 5 Workforce Capacity, 4 Workflow & Transition, 3 Data Use & Reporting) |
| Indicator scale | {1, 3, 5} only | Most indicators span the full {1, 2, 3, 4, 5}; a few (wiring, data backup, device use) still take only {1, 3, 5} |
| Class (core/supporting/contextual) | Recovered from column position on the per-theme sheets (colour-fill lost in CSV export) | **Given directly** — `Facility Scoring Rubric_v2_WORK` has an explicit `Included in score?` + status column per indicator |
| Band cut points | Equal terciles (2.333 / 3.667) | **2.9 / 3.9** — from the workbook's own 5-band → 3-band crosswalk |
| Facility archetype | Carried verbatim from `final_facility_archetype`, explained by a recomputed rule | **Computed**, no verbatim column to carry — see below |
| Per-service-point scores | 5 indicators scored once per service point (device, digital skills, infrastructure, action plan, shared staff) | **Gone.** The device question now feeds `tech_core_04` (a Technical Infrastructure indicator) rather than a per-point Workflow score. `ServicePoint` is descriptive-only under v2. |

Two theme scores measurably changed for the same facility between workbook
versions (verified across a 300-facility sample): Workforce Capacity was
identical in every case; Workflow & Transition changed in 300/300; Data Use &
Reporting in 296/300; Technical Infrastructure in 114/300. This is a real
methodology change, not a reformatting of the same numbers.

## Indicator catalog

`etl/lib/indicatorsV2.mjs` — hand-transcribed from `Facility Scoring
Rubric_v2_WORK`, since that sheet names its own indicator IDs, subdomains and
class but not the exact column header on the scoring sheet. Each of the 20
scored indicators binds to one `<label> — actual/derived facility response` /
`<label> — score` column pair on its theme's own `*_readiness scoring` sheet.

```
themeScore = 0.7 × mean(core) + 0.3 × mean(supporting)
```

Read directly from the theme sheet's own `Revised <Theme> weighted
Core/Supporting/final score` columns — not recomputed and compared against a
"published" figure the way v1 was, because the theme sheet's own rollup *is*
the computation now. The 20-indicator recomputation still runs
(`computeThemeScore` in `etl/lib/scoring.mjs`) and is asserted equal to those
same sheet columns in `validate.mjs` — the same invariant v1 held, just
against the workbook's own rollup instead of an external report figure.

**The sheet blanks a whole component when any of its indicators is missing.**
Verified directly: a facility missing only its one Workforce supporting
indicator (`work_sup_03`, "Technical-issue resolution pathway") has its core
component computed (2.1, matching `mean(3,3) × 0.7`) but its supporting
component and final score both left blank by the sheet — not a mean over the
two present supporting indicators. `computeThemeScore()` instead means over
whatever is present (the same policy v1 used, and for the same reason — see
below), so a facility with exactly this pattern is *expected* to disagree
with the sheet: the sheet leaves it blank, the dashboard fills in a mean. 41
of 11,216 facility-themes hit this. `validate.mjs` reports it as an expected
gap, not a binding bug — only a numeric disagreement where both sides have a
value is treated as one.

A skipped indicator is **excluded from its mean, not scored zero** — same
policy as v1, same reason: indicators can be null for a facility without
that meaning the worst case.

Contextual indicators (~35, not scored) are also catalogued, transcribed at
lower fidelity — several cross-domain ones (`flow_xdom_01`, `data_xdom_01`,
`data_xdom_02`) mark where a question now feeds a *different* theme's scored
indicator, per the rubric's own "Cross-domain input" / "Cross-domain
contextual" labelling.

## Bands: 2.9 and 3.9, not equal terciles

`Updated Readiness Pivots` (Table 6.2) gives an explicit crosswalk from the
workbook's five-band scheme onto three:

| 5-band | Range | 3-band |
|---|---|---|
| Nascent | 1.0 – 1.9 | Not ready |
| Emerging | 2.0 – 2.9 | Not ready |
| Developing | 3.0 – 3.9 | Moderately ready |
| Institutionalized | 4.0 – 4.5 | Ready |
| Optimized | 4.6 – 5.0 | Ready |

So `BAND_LOWER_CUT = 2.9`, `BAND_UPPER_CUT = 3.9` (score ≤ 2.9 → not ready;
≤ 3.9 → moderately ready; else ready) — replacing v1's equal terciles
(2.333 / 3.667). Verified against a sample row: a facility with a final
score of exactly 2.9 carries the sheet's own "Emerging" / "Not Ready" labels,
confirming the lower cut is inclusive at 2.9. This is a real methodology
decision, not cosmetic — it reclassifies facilities near the old boundaries,
and it means the v1 archetype distribution (533 ready / 1,838 moderately
ready / 433 not ready) does not carry over: recomputed under v2, the split is
110 / 1,246 / 1,448. Technical Infrastructure is the dominant driver — its
national mean (2.85) sits just below the new lower cut, and it gates the
facility archetype as one of the two core themes (below).

The five-band labels and ranges are unchanged and still live in
`MATURITY_BANDS` (`src/lib/bands.ts`) behind `VITE_USE_MATURITY_BANDS`.

## Facility archetype — computed, not carried

```
core = min(technicalInfrastructure, workforceCapacity)
sup  = min(workflowTransition, dataUseReporting)

core ≤ 2.9           → not ready
core > 3.9 && sup ≥ 2.50  → ready
otherwise            → moderately ready
```

Same rule shape as v1 (`SUPPORTING_FLOOR = 2.5`, carried over unchanged —
nothing in the v2 workbook gives a basis to refit it), with the v2 cut
points. **Unlike v1, there is no published column to carry verbatim and
compare against** — the workbook's own archetype field is explicitly
labelled "pending revised archetype rerun". So under v2 this rule *is* the
archetype, computed fresh for every facility, and `archetypeIsOverride` is
gone (there is nothing to be an override of). `validate.mjs` reports the
resulting distribution for the record; it is not checked against an expected
count, because there is no external figure to check it against yet.

Leadership & Governance remains a core theme assessed at state level only —
untouched by v2, still absent from this rule.

## What still validates, and against what

The v1 gate compared every figure to the published assessment report,
because the workbook that produced this dashboard was the workbook that
produced the report. That anchor doesn't carry over cleanly for the numbers
the methodology changed. What still has one:

- **Raw-response flags** (reliable power, power-ready, internet access,
  computing devices) — these read fields the scoring revision didn't touch
  (grid hours, backup type, wiring), and reproduce the same national report
  figures as before: power-ready 34.8%, reliable power 42.3%, exact.
- **The device-gap total** in `ERA Data Analysis_Pivot Table` (row 475) —
  4,331 verified-compliant devices against 10,316 required, nationally. Used
  as an informational cross-check for `ti.device_per_point`, not a strict
  pass/fail — the pivot's 42.0% "proportion met" credits some
  unverified-but-functional smartphones under a rule this dashboard's
  stricter "verified devices ≥ minimum" reading doesn't.
- **The 20-indicator recomputation vs. the theme sheet's own rollup** — see
  above.

What has no anchor: the archetype distribution, and by extension the state
composite-readiness figures built on it. Reported, not checked.

## Minimum requirements and service points

Unaffected by the scoring-methodology change — both are derived from raw ODK
response columns (`etl/lib/minimumRequirements.mjs`,
`etl/lib/servicePoints.mjs`), which the v2 workbook carries unchanged from
v1, just reorganised across sheets. Two column references changed name:
`minimum_required_devices` → `Minimum devices required`, and
`computing_devices_available` → `Verified compliant desktops, laptops and
tablets` (deliberately the stricter, "compliant" figure rather than
`Total supported computing devices`, which also counts smartphones and
devices needing repair — the requirement is "1 device per service point",
read as one *usable* device).

## Labels

The v2 workbook has no `survey`/`choices` sheets. `etl/build.mjs` reads those
from the old workbook (`../EMR Dashboard/ERA dataset_v4.xlsx`,
`--labels-source` to override) — the underlying ODK instrument didn't
change, only the scoring layered on top of it. If that file is absent, the
build continues and falls back to `titleCaseName()`; label quality is a
display concern, not a correctness one.

## State roll-up

```
compositeReadiness = (5·ready + 3·moderatelyReady + 1·notReady) ÷ total
```

Unaffected in formula, but its inputs (facility archetypes) are now computed
rather than published — see above. Combining with Overall State Readiness in
a 3 × 3 deployment matrix remains **blocked**: the state-level instrument
output has still not been supplied, under either workbook version.
