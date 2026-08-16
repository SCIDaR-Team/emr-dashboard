# Validation

`npm run data:refresh` checks every recomputed figure against the assessment
report. The dashboard and the report will be read side by side, so drift is
caught at build time. `--strict` makes it fatal (use in CI).

## Current status

| Check | Computed | Published | Result |
|---|---|---|---|
| Archetype — Ready | 533 | 533 | ✓ exact |
| Archetype — Moderately ready | 1,838 | 1,838 | ✓ exact |
| Archetype — Not ready | 433 | 433 | ✓ exact |
| Archetype rule agreement | 98.89% | — | ✓ above 98.5% floor |
| Reliable power | 42.3% | 42.3% | ✓ exact |
| Power-ready | 34.8% | 34.8% | ✓ exact |
| Internet access | 82.8% | 83% | ✓ |
| Computing devices | 81.7% | 82% | ✓ |
| Electricity access | 83.1% | 85.2% | ⚠ different denominator |
| EMR transitioned | 6.7% | 6% | ⚠ different definition |
| Uses ≥1 digital system | 37.2% | 44% | ⚠ different denominator |
| Indicator binding — recomputed theme components vs published | 11,216 / 11,216 facility-themes | — | ✓ exact |
| Sub-theme scores within 1.0–5.0 | all | — | ✓ |
| Minimum requirements wired | 22 / 24 | — | · two unmeasurable |

## What the binding check proves

The 132-question → ODK-column binding is the thing most likely to be wrong, and
a wrong binding produces theme scores that look entirely reasonable. So every
facility's core and supporting components are recomputed from the bound columns
and compared against the published ones — all four themes, every row. Any drift
at all fails.

It is not a smoke test: it is the reason the core/supporting classification can
be trusted, and it caught both of the corrections documented in
[SCORING.md](SCORING.md) (the count columns inside the core block, and the five
duplicated `device_*` / `functional_device_*` pairs).

The sub-theme range check exists for the same reason in the other direction:
those scores are ours rather than the workbook's, so nothing external constrains
them. Before renormalisation `workflow_transition.transition` scored 0.08
nationally and was rendered as a readiness band.

## The denominator problem

Four different facility counts are in circulation:

| Count | Source |
|---|---|
| 2,808 | Sample design |
| 2,825 | Raw ODK export |
| **2,804** | Scored rows in `ERA dataset_v4.xlsx` — what we use |
| 2,696 | Denominator behind several figures in the report |

Some published figures are computed on 2,804 (reliable power and power-ready
both reproduce exactly), others on 2,696. Those are checked with a wider band
and labelled rather than dropped — hiding them would conceal the problem.

**This needs resolving with the assessment team.** Stakeholders will compare
dashboard and report side by side on day one.

## Definitional variances

- **EMR transitioned** — `emr_status = 5` marks 189 facilities; the report
  counts 152. A definitional difference in what "transitioned" means, not an
  ingest error.
- **Sub-floor scores** — 33 facilities carry a theme score below the
  theoretical minimum of 1.0 (workforce down to 0.65, data use to 0.70).
  Four columns encode their worst case as `0` where the scale's floor is 1:
  `paper_digital_transition`, both `patient_info_duplicates_*`,
  `service_delivery_method` and the `G6` score copy. Preserved in the theme
  scores for fidelity with the published figures, and flagged. Sub-theme scores
  clamp them to the floor — see SCORING.md.

## Minimum requirements

22 of the 24 return a real boolean. Two cannot, and stay `null` (rendered "not
assessed", never as a failure):

- **All staff should receive training** — the instrument asks whether *any* staff
  were trained (F4), never how many. Answering it from F4 would report one
  facility-wide yes as full coverage.
- **Unique patient identifier** — no column in the instrument carries a patient
  identifier scheme.

Both are questions for the assessment team rather than pipeline gaps. Where a
question was skipped, each check states in code whether a skip means false (a
facility with no EMR demonstrably has no built-in reporting) or unknown.

## Derived definitions

Reproduced exactly as the report defines them:

- **Reliable power** — ≥ 9 hrs/day from grid, **or** a fully functional backup
  running ≥ 9 hrs
- **Power-ready** — reliable power **and** fully functional wiring
- **Computing device** — laptop, desktop or tablet; smartphones excluded
- **Electricity access** — any grid hours, or any backup source present
