# Data dictionary

## Source

`ERA dataset_v4.xlsx`, sheet **`Raw data with readiness level`** — 2,804
facilities × 379 columns. Build against this, not the `.xlsb` ODK export: the
xlsx carries the computed scores plus `UUID`, `Functionality level` and
`BHCPF/NON-BHCPF`, none of which exist in the export.

## Sheets used

| Sheet | Use |
|---|---|
| `Raw data with readiness level` | Master — raw responses, indicator scores, theme scores, `final_facility_archetype` |
| `Tech.infr_readiness scoring` and 3 siblings | Per-theme working; source of the core/supporting boundary |
| `survey` (1,000 rows) | XLSForm field definitions → generated labels |
| `choices` (3,684 rows) | Every response option, plus the zone → state → LGA cascade |
| `Facility Scoring Rubric` | The rubric with fills intact |
| `Internet Speed data` | Measured speeds for the ≥ 5 Mbps check |

## Gotchas

**Duplicate column headers.** Thirteen headers repeat on the master sheet — the
same question appears once with its raw response and once with its 1/3/5 score.
Keying rows by name alone silently takes the last occurrence, swapping labels
for scores and breaking every descriptive figure. The reader suffixes repeats
`#2`, `#3`; the first occurrence keeps the plain name and holds the raw value.

**Header row is not row 0.** It varies by sheet (row 1 on the master, row 3 on
`Tech.infr_readiness scoring`). Located by searching for `Name of facility`.

**Multi-selects are space-delimited in one cell.** `"laptop tablet smartphone"`.
Tokenise before counting — `laptop tablet`, `tablet laptop` and `laptop` all
mean "has a laptop".

**Everything is an ODK slug.** `akwa_ibom`, `ndito_eka_iba_health_centre`.
Resolve through the `choices` sheet where possible; `titleCaseName()` is a
fallback heuristic that will mangle names the choice list would get right.

**Mojibake.** `patient_consultations` contains `â‰¤10` for `≤10` — CP1252/UTF-8
double-encoding. Swept during ingest.

**Names are not keys.** 2,783 distinct names across 2,804 rows. Key on `UUID`.

**Archetype casing.** `Not Ready` in `final_facility_archetype`, `Not ready` in
the theme columns. Normalised on ingest.

**A score column formatted as a date.** `pre_implementation_steps` holds 1/3/5
but carries a date number format, so reading the workbook with SheetJS's
`cellDates` turns a 3 into `1900-01-03`. The reader deliberately does not use
`cellDates`; the only date the ETL emits, `Submission date`, is already stored as
an ISO string. (`Date of visit` is a mix of serials and `dd/mm/yyyy` strings and
is not used.)

**Five duplicated column pairs.** `device_{registration,triage,consultation,lab,
pharm}` are byte-identical to `functional_device_*` in all 2,695 rows. Counting
both double-weights the service-point device question in the workflow core mean.

**Reused ODK question codes.** Two questions are numbered `I1` (whether the
facility transitioned, and the current EMR status), and the laboratory block
numbers both "is there a functional device" and "if yes, what type" as `M4.2`.
Column references in `indicatorBindings.mjs` carry a `~` disambiguator for those.

**`ReviewState` is populated.** All 2,804 rows read `approved` — earlier notes
said the field was absent from the scored sheet. It is present, along with
`FormVersion` (seven values, v6 → v12). Both are carried through.

## Column groups (raw ODK export, 272 cols)

| Prefix | Cols | Theme |
|---|---|---|
| `facility_identification-*` | 5 | Geography |
| `facility_information-*` | 9 | Profile |
| `section_1a_power_infrastructure-*` | 7 | A |
| `section_1b_digital_infrastructure-*` | 33 | A |
| `section_e_internet_network_infrastructure-*` | 10 | A |
| `section_2a_staff_competency-*` | 16 | B |
| `section_2b_staffing_roles-*` | 11 | B |
| `section_3a_workflow_and_transition-*` | 6 | C |
| `section_3b_digital_transition-*` | 15 | C |
| `section_3c_patient_perception-*` | 4 | C (contextual) |
| `section_3d_referral_processes-*` | 11 | C |
| `section_l_data_use-*` | 25 | D |
| `section_m_workflow-*` | 95 | C — 5 service points × 19 fields |

`section_m_workflow` is 5 × 19, not 95 flat fields: registration, examination/
triage, consultation, laboratory, pharmacy, each with the same nineteen
questions. The ETL reshapes it into five `ServicePoint` objects per facility
(`etl/lib/servicePoints.mjs`), which is what the scorecard's service-point grid
renders.

A point that does not exist at a facility still gets an object, with
`present: false` and null scores, so the grid always has five cells and an absent
point reads as absent rather than as missing data.

**Watch the second service point's name.** It is `triage` in the M-block, in the
per-service-point score columns and in H1/H2/H6, but `examination` in H4 and H5.
Both resolve to the canonical id `examination`. Reading only one token silently
drops the duplicate-documentation flag for one point in five. The laboratory and
pharmacy have the same problem in miniature — `lab_infra_score` beside
`pharmacy_infra_score`, `pharm_infra_action_plan_score` beside
`lab_infra_action_plan_score` — so the column names are declared per point rather
than built from a suffix.

There is **no Leadership & Governance section** — confirming that theme is
state-level only.

## Outputs

| File | Contents |
|---|---|
| `facilities-summary.json` | One lean row per facility — drives maps, lists, aggregates. Carries the 4 theme scores and all 10 sub-theme scores, so the explorer can recompute its cube under a filter |
| `facilities/{uuid}.json` | Full detail, fetched on demand |
| `states.json` | 37 states; 12 primary, 25 secondary shells |
| `lgas.json` | LGA aggregates |
| `national.json` | National roll-up |
| `indicators.json` | 133 indicator definitions — class, source and score columns, buckets, why an indicator is unscored, and `answeredCount`: how many of the 2,804 facilities carry a score for it |
| `requirements.json` | The 24 minimum-requirement definitions; facilities carry only `{id, met, measured}` |
| `explorer-cube.json` | `[geoId][themeNodeId]` → `{score, band, n, scored, distribution}`. `distribution` is banded on the *selected node*, not the facility archetype — the two coincide only for `overall`. `scored` is how many of the `n` carry a value for that node, and is what the distribution counts sum to |
| `indicator-scores.json` | The axis' fourth level, deliberately outside the cube: `{ids, answered, byFacility}` — 50 scored indicators × 2,804 facilities, values aligned to `ids`. Fetched by the browser only when an indicator is selected (541 KB raw, ~99 KB gzipped). **Values are unrounded on purpose:** `11/3` is exactly `BAND_UPPER_CUT` and reachable, so rounding at any precision flips a facility from Moderately ready to Ready |
| `snapshot.json` | Build provenance and validation result |

Two files the ETL used to emit are no longer built. `labels.json` (XLSForm field
labels) had no runtime consumer at all — display names are resolved from the
`choices` sheet at build time and baked into every record, so the browser never
needed a label map. `explorer-nodes.json` (the cube's thematic axis) was read
only by `src/lib/explorerCube.test.ts`, which now takes the axis from the cube's
own national cell instead.
