# EMR Readiness Assessment Dashboard

Decision-support dashboard visualising the national assessment of primary
healthcare facilities' readiness for Electronic Medical Record (EMR)
implementation, for **NPHCDA**, in partnership with NTBLCP, The Global Fund and
Solina.

Readiness findings across **36 states + FCT**, **205 LGAs** and **2,808
healthcare facilities** — 12 states assessed by primary facility survey, the
remaining 25 plus the FCT by secondary desk review.

> **Specification:** [`../EMR Dashboard/EMR_DASHBOARD_BUILD_GUIDE.md`](../EMR%20Dashboard/EMR_DASHBOARD_BUILD_GUIDE.md).
> Read §3 (the scoring model) before touching anything that computes a score.
>
> **Where we are:** [`docs/PHASES.md`](docs/PHASES.md) — per-phase checklists,
> blockers, and a paste-able kickoff prompt for each phase. Update it at the end
> of every session.

---

## Stack

React 18 · TypeScript 5 · Vite 5 · Tailwind 3 · Zustand 4 ·
React Router 7 · Netlify (static)

No charting library. Every measure on screen is a bar, a track or a five-step
meter built from plain DOM in `src/components/ui/Meter.tsx`, and the maps are
hand-projected SVG — so the readiness palette, its textures and the dark scheme
are defined once in CSS and inherited, rather than restated in a canvas theme.

No backend. The assessment is complete and the dataset is fixed, so all scoring
and aggregation happens at build time in `etl/` and the app serves precomputed
JSON. The `DataSource` interface in `src/data/datasource/` is the escape hatch
if a live feed is ever added.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run data:refresh   # builds public/data from ERA dataset_v4.xlsx
npm run dev
```

`data:refresh` expects the source workbook at `../EMR Dashboard/ERA
dataset_v4.xlsx`. Override with `--source <path>`.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck and production build |
| `npm run data:refresh` | Run the ETL, writing `public/data` |
| `npm run data:refresh -- --strict` | Same, but fail on validation drift (use in CI) |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Deployment

Netlify, static, built from `netlify.toml` — see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the runbook and post-deploy
checks.

One invariant is worth repeating here, because the intuitive change breaks
production silently: **`public/data/` is committed, generated though it is.**
The ETL's input (`etl/data/`) is not in the repository and `npm run build` never
runs the ETL, so nothing in CI can rebuild that data. Ignoring it still yields a
green build and a dashboard whose home page looks fine — only the facility
scorecards 404. Refresh it by running the ETL locally and committing the diff.

## Modules

| Route | Module | Status |
|---|---|---|
| `/` | Home — coverage and module launcher | Built |
| `/states` | State Summary — all 37 states, state-level findings | Blocked (see below) |
| `/assessment` | Assessment States — the 12 primary states | Live metrics + filters; needs the ranked table |
| `/facilities/:uuid` | Facility Scorecard | Cascading selector; panels are Phase 4 |
| `/explore` | Drill-Down Explorer — geography × thematic area | Navigation + full thematic cube |

Filters are shared across modules and live in the URL, so any scoped view is a
link: [`/assessment?state=Kano&archetype=ready`](http://localhost:5173/assessment?state=Kano&archetype=ready).

## The scoring model, in brief

Full detail in §3 of the build guide. The short version, because two of these
are easy to get wrong:

- **Indicator scores are only 1, 3 or 5.** The rubric's three response buckets
  ("Not Ready / Moderately Ready / Ready") map onto a 1–5 scale at those points.
  Verified against every `*_score` column in the workbook — no other value
  occurs. It is not a 1–3 scale.
- **Theme score** = `0.7 × mean(core indicators) + 0.3 × mean(supporting)`.
  Contextual indicators (84 of 133) carry 0% weight. A skipped question is
  excluded from its mean, never scored zero. The unit of the mean is a score
  *column*: six workflow questions are asked once per service point and carry
  five columns each. Recomputing this from the bound columns reproduces the
  published components for all 11,216 facility-themes, and the build fails if it
  ever stops.
- **Sub-theme scores are ours, not the workbook's**, and use a renormalised
  70/30 — three of the ten sub-themes hold indicators of only one class, and the
  plain formula caps those at 3.5 or 1.5. They therefore do **not** average to
  the theme score and are not a decomposition of it. See `docs/SCORING.md`.
- **Bands are three, not five** — equal terciles of 1–5: Not ready ≤ 2.333,
  Moderately ready ≤ 3.667, Ready above. The assessment deck also describes a
  five-band Nascent→Optimized scheme; the three-band model is what produced the
  published figures, so it is what ships.
- **Facility archetype** is a rule chain over the core themes, not a threshold
  on an average:
  ```
  core = min(technicalInfrastructure, workforceCapacity)
  sup  = min(workflowTransition, dataUseReporting)
  core ≤ 2.333                → not ready
  core > 3.667 && sup ≥ 2.50  → ready
  otherwise                   → moderately ready
  ```
  This reproduces the published `final_facility_archetype` for 98.89% of
  facilities (2,773 of 2,804). **The published column is authoritative and is carried through
  verbatim**; the rule exists to explain a classification and to recompute one
  when the user filters the population.
- **Leadership & Governance** is a core theme but is assessed at state level
  only. It has no facility instrument and does not enter the facility rule.
  Three sources agree independently: the ODK instrument has no leadership
  section, the scored workbook has four theme blocks, and the Figma's Facility
  Scorecard renders four domain columns while its State Summary renders five.
  Its absence from the scorecard is intended — do not add a placeholder column.

### Validation

`npm run data:refresh` asserts against the published national figures —
electricity access 85.2% → reliable power 42.3% → power-ready 34.8%, internet
83%, devices 82%, and the 533/1,838/433 archetype split. It also recomputes every
facility's theme components from the bound indicator columns and requires them to
equal the published ones exactly, which is what makes the core/supporting
classification trustworthy rather than plausible. The dashboard and the
assessment report will be read side by side, so drift fails the build under
`--strict`.

## Known gaps

| Gap | Effect |
|---|---|
| **State-level assessment output not supplied** | `/states` cannot render. No source for Leadership & Governance scores, Overall State Readiness, or any finding for the 25 secondary states. |
| **Unit costs absent from every supplied file** | All investment and roadmap figures. Quantities are largely derivable (`minimum_required_devices`, `computing_devices_available`, `number_service_points`); prices are not — a full-text sweep of the workbook, the 89-slide deck and the ODK export found none. Prototype figures are placeholders. |
| **LGA boundary polygons** | The State and Explorer choropleths. Source GRID3 ADM2 and convert with the shapefile script. |
| **LGA count conflict** | 305 distinct values in the ODK export vs 205 on the prototype. The XLSForm `choices` sheet is the arbiter. |
| **Two minimum requirements are unmeasurable** | The instrument asks whether *any* staff were trained, never how many, and never asks about a unique patient identifier. Both return `null` — rendered "not assessed", never `false`. The other 22 are wired. |
| **33 rubric questions were never scored** | Response buckets were written for them and the published workbook scored none — every referral question, most device-condition detail. Carried as contextual. Worth confirming with the assessment team. |

## Layout

```
etl/            Build-time pipeline — workbook in, public/data out
  sources/      Readers: ERA dataset, scoring rubric, XLSForm
                · indicatorBindings.mjs — the 132 questions → ODK columns
  lib/          Scoring, service points, roll-up, explorer cube, validation
src/
  app/          Navigation config
  components/   ui · filters · layout · charts · map · scorecard
  modules/      One folder per module
  data/         DataSource interface, geography
  hooks/        Fetching, filtering, URL sync, overlays, explorer selection
  lib/          Types, constants, bands, archetype, themes, formatting
  state/        DataProvider and its context
  store/        Zustand — filters, theme, toasts
docs/           PHASES (tracker) · SCORING · DATA_DICTIONARY · VALIDATION
```

`etl/sources/indicatorBindings.mjs` is the join between the rubric's prose
questions and the workbook's ODK column codes. Nothing in either file connects
them, so that table is hand-authored and everything downstream rests on it. It is
guarded by a per-row question fingerprint and by an assertion that every scored
column is claimed exactly once — read the header before editing it.

## Accessibility note

The readiness scale is red/amber/green — the exact combination that fails for
the most common colour-vision deficiencies and in greyscale print. Every band
indicator pairs colour with an icon or text label (`BandBadge`), and map fills
are accompanied by a legend and hover labels. Keep that pairing when adding new
surfaces. `Badge` deliberately has no readiness tones, so it cannot be used to
render a band without the icon.

## Theming note

Tokens are defined by *role*, not by lightness, because dark mode cannot simply
invert them. `--brand-700` is "heading text" in both schemes and gets lighter in
dark; `--brand-50` is "subtle wash" and stays dark. The navigation rail has its
own `--sidebar` tokens that do not follow the scheme at all — it is a fixed dark
green by design, and when it borrowed `--brand-900` the dark-mode redefinition of
that token turned the whole rail white-on-white.

The recurring trap is `text-white` on a filled brand colour: white reads fine on
light-mode `brand-500` (30% lightness) and fails on the dark-mode one (52%). Use
`text-surface`, which follows the scheme.
