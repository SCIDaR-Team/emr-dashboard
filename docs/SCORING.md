# Scoring — as implemented

Authoritative source: `ERA dataset_v4.xlsx`. Where the assessment deck, the
rubric CSV and the Figma prototype disagree, the workbook wins — it is what
produced the published findings.

## Indicator scores: 1, 3, 5

The rubric shows three response buckets per question — "1 - Not Ready",
"2 - Moderately Ready", "3 - Ready". Those are **bucket labels, not scores**.
They map onto a 1–5 scale at 1, 3 and 5.

Verified across every `*_score` column in the workbook:

| Value | Occurrences |
|---|---|
| 1.0 | 6,126 |
| 3.0 | 7,688 |
| 5.0 | 11,381 |

No other value occurs. Implement as a lookup from response option → {1, 3, 5};
treating it as a 1–3 scale shifts every downstream threshold.

## Weights

| Class | Weight | Rubric questions | Score columns |
|---|---|---|---|
| Core | 70% | 20 | 28 |
| Supporting | 30% | 29 | 41 |
| Contextual | 0% | 84 | — |

```
themeScore = 0.7 × mean(core) + 0.3 × mean(supporting)
```

**The unit of the mean is a score column, not a question.** Six workflow
questions are asked once per service point and carry five score columns each; the
published component columns average those five individually. Averaging per
question instead reweights the whole service-point block by a factor of five.

A skipped question is **excluded from its mean, not scored zero**. Seven form
versions are in circulation (v6 → v12); indicators added later are null for
early submissions, and zeroing them would penalise the facilities visited first.

### Where the class actually comes from — resolved

In the source Google Sheet the class is cell fill colour, and CSV export dropped
it. It is recovered instead from column position on the per-theme scoring
sheets: score columns between the end of the shared preamble (which ends at
question B7) and the `(core components)` marker are core; those between that
marker and `(supporting components)` are supporting.

Position alone is not enough, and two corrections were needed. Both were found
by checking the result against the published component columns rather than by
reading the sheet:

1. **The blocks are not solid runs of score columns.** The technical core block
   also holds four counts — `computing_devices_available`,
   `number_service_points`, `number_permanent_digital_staff`,
   `minimum_required_devices`. Membership is decided by the values a column
   holds (every value in {0, 1, 3, 5}), not by position alone.
2. **`device_*` and `functional_device_*` are five pairs of byte-identical
   columns.** Counting both double-weights the service-point device question.
   One family is counted; the other is reported as excluded on every build.

One further column is excluded by name: `emr_transition_status` holds 1/3/5 and
sits immediately before the workflow supporting marker, but including it puts the
recomputed supporting component wrong for all 150 EMR facilities and right for
none. It is carried as contextual — displayed with its score, weighted zero.

With those handled the derivation is **exact**: the recomputed core and
supporting components equal the published ones for every row of all four themes
(2,804 · 2 for technical infrastructure and workforce capacity, 2,695 · 2 for
workflow and data use). `verifyThemeComponents()` asserts it on every build and
fails hard, so the classification cannot drift unnoticed.

Re-supplying the rubric as `.xlsx` is no longer needed.

## The question → column binding

`etl/sources/indicatorBindings.mjs` maps each of the 132 rubric questions to its
ODK response column(s) and, where one exists, its score column. Nothing in the
rubric or the workbook joins the two — the rubric names its questions in prose
and the workbook names its columns in ODK codes — so the table is hand-authored
and is the join.

It is keyed by position and guarded two ways: each entry carries the first 60
characters of its rubric question, checked against the CSV on every build, and
every scored column in the workbook must be claimed by exactly one question.
A rubric re-export that adds, removes or reorders a row fails the build rather
than silently binding question 71 to question 70's column.

### What the rubric scores and the workbook does not

The rubric defines response buckets for 94 of its 132 questions. The published
workbook holds 70 score columns, covering 50 questions — 69 columns across 49
questions carry weight, plus the unweighted `emr_transition_status`. The other 84
indicators are contextual, and `unscoredReason` says which kind each is:

| Reason | n | Meaning |
|---|---|---|
| `descriptive` | 36 | No buckets in the rubric — context or perception |
| `rubric_scored_workbook_did_not` | 33 | Buckets defined, never scored in the published workbook |
| `state_level_only` | 14 | Leadership & Governance — no facility instrument |
| `scored_but_unweighted` | 1 | `emr_transition_status`, above |

The workbook decides, not the rubric: it is what produced the published figures.
The 36 is the deck's "38 contextual indicators" less two that the rubric gave no
buckets for but the workbook scored anyway — "how many computing devices" became
`computing_device_score`, and the service-point roster became
`service_points_score`.

**Group 2 is worth raising with the assessment team.** Thirty-three questions
were written with response buckets and never scored, among them every referral
question and most of the device-condition and EMR-architecture detail.

One column runs the other way: `use_of_data` sits in the Data Use core block and
enters the published core mean, but the rubric lists no question for it. It is
carried as a 133rd indicator flagged `rubricUnmatched`, because dropping it would
break the reproduction of the published theme score.

## Sub-theme scores are ours, not the workbook's

The workbook computes nothing below thematic area. The 10 facility-level
sub-theme scores are computed here, and they use a **renormalised** formula:

```
subThemeScore = (0.7·mean(core) + 0.3·mean(supporting))
              ÷ (0.7·hasCore + 0.3·hasSupporting)
```

The divisor is the difference from the theme formula, and it matters. Three of
the ten sub-themes hold indicators of only one class. Applying the theme formula
unchanged caps a core-only sub-theme at 3.5 and a supporting-only one at 1.5 —
`workflow_transition.transition`, every one of whose indicators is supporting,
scored **0.08** nationally and rendered as a readiness band. That was an artefact
of a missing denominator, not a finding, and it would have been read as one.

Renormalising keeps the 70/30 relative weighting, keeps the result on 1–5, and
collapses to the theme formula exactly when both classes are present.

Two consequences to keep in mind:

- A sub-theme score and a theme score are **not computed identically**. The theme
  formula is fixed by the published workbook and cannot be touched.
- Sub-theme scores do **not** average to the theme score, and must never be
  presented as a decomposition of it.

Four columns encode their worst case as `0` where the scale's floor is 1
(`paper_digital_transition` on 2,504 rows, both `patient_info_duplicates_*`,
`service_delivery_method`, `G6`). The theme scores carry those zeros through
because the published columns do; the sub-theme scores clamp them to 1, which
changes no facility's band and keeps the number inside the range it is rendered
against. The build asserts every sub-theme score lands in 1.0–5.0.

## Bands: three, not five

Equal terciles of the 1–5 range.

| Band | Range |
|---|---|
| Not ready | 1.000 – 2.333 |
| Moderately ready | 2.333 – 3.667 |
| Ready | 3.667 – 5.000 |

Derived from the observed score range of each published `…(maturity level)`
label across all four scored themes.

The assessment deck also describes five bands (Nascent 1.0–1.9 → Optimized
4.6–5.0) and the Figma prototype uses both schemes at once, matching neither
exactly. The three-band model ships; the five-band mapping lives behind
`VITE_USE_MATURITY_BANDS`.

## Facility archetype

```
core = min(technicalInfrastructure, workforceCapacity)
sup  = min(workflowTransition, dataUseReporting)

core ≤ 2.333                → not ready
core > 3.667 && sup ≥ 2.50  → ready
otherwise                   → moderately ready
```

Reproduces the published `final_facility_archetype` for **2,773 of 2,804
(98.89%)**.

| Variant | Agreement |
|---|---|
| No supporting-floor clause | 95.19% |
| Supporting floor 2.50 (shipped) | 98.89% |
| Supporting floor fitted to 2.46 | 99.00% |
| mean(all four themes) | 72.6% |
| min(all four themes) | 69.3% |

The floor is held at a round 2.50. The fitted 2.46 gains three facilities and
would imply more precision than the rule has.

The 31 residual facilities follow no tested formulation and are presumed manual
overrides. **The published column is carried through verbatim** and those rows
are flagged `archetypeIsOverride` so a later recompute cannot silently change
them.

Leadership & Governance is a core theme but is assessed at state level only —
no facility instrument, and it does not enter this rule.

## State roll-up

```
compositeReadiness = (5·ready + 3·moderatelyReady + 1·notReady) ÷ total
```

Combined with Overall State Readiness in a 3 × 3 matrix to give the deployment
level. **Blocked** — the state-level instrument output has not been supplied.
