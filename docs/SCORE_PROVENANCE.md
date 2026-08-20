# Score provenance — what is read, what is computed

Companion to [SCORING.md](SCORING.md), which describes the scoring *model*. This
document answers a narrower question: for every score the dashboard displays, at
every level, **did that number come out of the workbook or did we compute it —
and if we computed it, from what, and how?**

Everything below was traced against the code and then verified numerically
against the shipped `public/data` and against `ERA dataset_v4.xlsx` itself. The
worked figures are real, not illustrative.

---

## The dividing line

Only **three** things are read from the workbook. Every other score in the
dashboard is derived from them.

| Read verbatim | Source | Count |
|---|---|---|
| **Indicator scores** (1–5) | The 4 theme sheets, `<label> — score` columns | 20 per facility |
| **Facility theme scores** — core component, supporting component, final score, maturity band | The 4 theme sheets, `Revised <Theme> weighted Core score (70%)` and siblings | 4 per facility |
| **State leadership score** | `State leadership scoring `, the `Average ` column over 4 indicators | 12 states |

Verified verbatim — facility `d25acb82-e715-4332-a882-77fd3aa55ec6`, Technical
Infrastructure, read straight off `Tech.infr_readiness scoring`:

```
workbook:  core 2.625 | supporting 0.525 | final 3.15 | band "Developing"
shipped:   core 2.625 | supporting 0.525 | final 3.15 | band moderately_ready
```

The only transformation is `normalizeBand()` mapping the workbook's five-band
vocabulary onto the dashboard's three.

**The facility archetype is *not* read**, even though the workbook has a column
for it. That column is explicitly labelled "pending revised archetype rerun" —
the assessment team has not re-run their classification against the revised
scores — so it is recomputed here. See [Archetype](#archetype--computed-and-not-a-mean).

Nothing else in the chain comes from the file. No LGA, state or national score
exists in the workbook in the form the dashboard shows it.

---

## Facility level

### Theme score — read, then re-derived as a check

The four theme scores are read from the sheet. The ETL *also* recomputes each one
from the indicator cells and `validate.mjs` asserts the two agree; the build log
reports `11216/11216 facility-themes` in agreement. The formula the sheet
implements:

```
theme score = 0.7 · mean(core indicators) + 0.3 · mean(supporting indicators)
```

Two subtleties, both load-bearing:

- **The unit of the mean is a score *column*, not an indicator.** Six workflow
  questions are asked once per service point and therefore carry five score
  columns each. Averaging per indicator instead reweights that block by a factor
  of five and stops reproducing the published theme score.
- **Null indicators are excluded from the mean, never scored zero.** Seven form
  versions are in circulation (v6 → v12) and indicators added in later versions
  are null for earlier submissions. Zeroing those would systematically penalise
  the facilities visited first.

Contextual-class indicators carry weight `0` and never enter a mean.

### Indicator score — computed

Mean over that indicator's own score columns, for the columns it actually
carries a value in. Single-column indicators pass straight through.

### Sub-theme score — computed, and **ours, not the workbook's**

```
(0.7·mean(core) + 0.3·mean(supporting)) ÷ (0.7·hasCore + 0.3·hasSupporting)
```

The divisor is the whole point, and it is the one place the dashboard
deliberately diverges from the theme formula. Six of the ten facility sub-themes
hold indicators of only one class. Applying the theme formula unchanged caps a
core-only sub-theme at 3.5 and a supporting-only one at 1.5 — under which
`workflow_transition.transition` scored **0.08** nationally and was rendered
against a 1–5 readiness band. That is an artefact of a missing denominator, not
a finding, and it would have been read as one.

Renormalising preserves the 70/30 relative weighting, keeps the result on 1–5,
and collapses to the theme formula exactly when both classes are present.

Two further adjustments:

- **Zeros clamp to 1.** Four columns encode their worst case as `0` where the
  scale floor is 1 (`paper_digital_transition`, both
  `patient_info_duplicates_*`, `service_delivery_method`, `G6`). The published
  theme scores carry those zeros through, so `computeThemeScore` must too — but a
  sub-theme built mostly from one of them lands below 1. Clamped here; changes no
  facility's band.
- **Sub-themes with no weighted indicator are absent, not null** — so the
  explorer can distinguish "not scored at this level" from "scored, no answer".

19 sub-themes per facility.

### Average domain score — computed

Flat mean of the four theme scores.

```
{3.15, 2.9, 5.0, 4.35} → 3.85   ✓ matches shipped averageDomainScore
```

### Archetype — computed, and **not a mean**

```
core       = min(technical_infrastructure, workforce_capacity)
supporting = min(workflow_transition, data_use_reporting)

core ≤ 2.9                        → not ready
core > 3.9 AND supporting ≥ 2.5   → ready
otherwise                         → moderately ready
```

Reproduces the workbook's own `final_facility_archetype` for **2,773 of 2,804
facilities (98.89%)**. Alternatives tested, with the same cut points:

| Rule | Agreement |
|---|---|
| **min(core) + supporting floor 2.50** | **98.89%** |
| supporting floor fitted to 2.46 | 99.00% (3 facilities better — overfit) |
| no supporting clause at all | 95.19% |
| mean of all four themes | 72.6% |
| min of all four themes | 69.3% |

The floor is held at a round 2.50 rather than the fitted 2.46: three facilities
is noise, and a fitted constant invites the reader to believe the rule is more
exact than it is. The **31 residual facilities follow no tested formulation** and
are presumed manual overrides in the source spreadsheet. That is an open gap.

---

## LGA, state and national

All three levels use **the same function over a different subset of facilities**.
There is no cascade: a state is not built from its LGAs, and the nation is not
built from its states. Every level reaches straight down to the facility rows.

| Field | How |
|---|---|
| `themeScores` (4 facility domains) | flat mean of member facilities' theme scores |
| `subThemeScores` | flat mean of member facilities' sub-theme scores |
| `averageScore` | flat mean of member facilities' `averageDomainScore` |
| `band` | `toBand(averageScore)` |
| `compositeReadiness` | mean of archetypes encoded **ready = 5, moderately ready = 3, not ready = 1** |
| `archetypeDistribution` | counts of the three archetypes; nulls dropped, so counts can sum to less than the population |

Verified on Kano (436 facilities) — all four theme means match the shipped
`states.json` to full float precision:

```
technical_infrastructure  3.013221709006928
workforce_capacity        3.6157834101382473
workflow_transition       3.3030087094418055
data_use_reporting        3.98176605504588
averageScore              3.4840118501578763
compositeReadiness        2.2018348623853212
```

### Gotcha 1 — national is a flat mean over facilities, not the mean of states

```
flat mean over all 2,804 facilities  = 3.534862   ← what ships
mean of the 12 state means           = 3.554009   ← not used anywhere
```

Large states pull the national figure toward themselves. This is defensible —
it is a statement about the facility population — but it is **not** "the average
state", and it should not be described that way in a report.

### Gotcha 2 — `averageScore` and `compositeReadiness` are both "overall" and they disagree

For Kano: **3.48** against **2.20**. They answer different questions.

- `averageScore` — the mean of the underlying 1–5 domain scores.
- `compositeReadiness` — the mean of *banded outcomes*, after each facility has
  been collapsed to ready/moderate/not-ready and re-encoded 5/3/1.

The explorer's `overall` node uses `compositeReadiness`; most other surfaces use
`averageScore`. Both are correct; quoting one as the other is not.

### Level-specific notes

- **LGA** carries no leadership score and `investments: []` — investments roll
  up at state and national only.
- **The 25 secondary states + FCT are synthetic shells.** Every score null,
  `evidenceGrade: 'secondary'`, `facilityCount: 0`. Nothing was computed for
  them because no data exists; they are present so the national map can draw all
  37.

---

## Domains

Five domains, but they are not peers.

| Domain | Built from | Assessed at |
|---|---|---|
| Technical Infrastructure | 8 indicators | facility → rolled up |
| Workforce Capacity | 5 indicators | facility → rolled up |
| Workflow & Transition | 4 indicators | facility → rolled up |
| Data Use & Reporting | 3 indicators | facility → rolled up |
| **Leadership & Governance** | 4 rubric questions | **state only** |

Leadership never touches a facility. It is absent from the explorer cube
entirely — a cell of nulls there would only invite a chart of nothing — and the
explorer's rail disables it and says why.

**National leadership = mean of the 12 states that have a score**, verified at
`2.2083333333333335`. Two caveats that must travel with that number:

1. It describes those 12 states, not Nigeria. The other 25 + FCT have no
   leadership data in any supplied file.
2. It covers only **4 of the rubric's 14** Leadership & Coordination questions
   (state governance structures, digital-health strategy, financial commitment,
   data-governance policy) — closer to the "Governance strengthening" sub-theme
   alone than to the full instrument.

---

## Bands

Applied identically at every level, to whatever score is being banded.

```
score ≤ 2.9         → Not ready
2.9 < score ≤ 3.9   → Moderately ready
score > 3.9         → Ready
```

Not equal terciles. The cut points come from `Updated Readiness Pivots`
Table 6.2, which crosswalks the deck's five-band scheme onto three: Nascent
(1.0–1.9) + Emerging (2.0–2.9) = Not ready; Developing (3.0–3.9) = Moderately
ready; Institutionalized (4.0–4.5) + Optimized (4.6–5.0) = Ready.

The lower cut is **inclusive at 2.9**, verified against a sample row: a final
score of exactly 2.9 carries the sheet's own "Emerging" / "Not Ready" labels.

---

## Open gaps

| Gap | Why it matters |
|---|---|
| **31 facilities whose published archetype no rule reproduces** | Presumed manual overrides. Until confirmed, the classification rule is 98.89% of a rule, not a rule. |
| **Sub-theme scores have no external anchor** | They are the dashboard's own construction. Nothing in the workbook validates them, so nothing catches a drift. |
| **Leadership is 4 of 14 questions, 12 of 37 states** | Presented as a domain score beside four domains that are complete. |
| **`averageScore` vs `compositeReadiness`** | Two "overall" numbers, far apart, both in circulation across the UI. |

---

## Where each of these lives in code

| Concern | File |
|---|---|
| Bands, theme/sub-theme formulas, archetype rule, roll-up helpers | [etl/lib/scoring.mjs](../etl/lib/scoring.mjs) |
| Facility assembly, theme scores read from the sheet | [etl/lib/facilities.mjs](../etl/lib/facilities.mjs) |
| Indicator catalog, theme rollup column names | [etl/lib/indicatorsV2.mjs](../etl/lib/indicatorsV2.mjs) |
| LGA / state / national roll-up | [etl/lib/rollup.mjs](../etl/lib/rollup.mjs) |
| State leadership reader | [etl/sources/stateLeadership.mjs](../etl/sources/stateLeadership.mjs) |
| Explorer cube aggregation | [etl/lib/explorerCube.mjs](../etl/lib/explorerCube.mjs) |
| Browser-side mirrors (recompute under filters) | `src/lib/{bands,archetype,explorerCube}.ts` |
| Validation gate | [etl/lib/validate.mjs](../etl/lib/validate.mjs) |
