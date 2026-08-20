# How the scores work — a plain-language review copy

This explains every score in the dashboard in ordinary words, so you can check
whether we are producing them the way the assessment intended.

There is a technical version of this document for whoever maintains the data
pipeline. This one is for reviewing the *thinking*, not the code. If anything
below describes a rule you did not intend, that is exactly the thing to flag —
the numbers are only as right as the rules underneath them.

Every figure quoted here is a real one, taken from the dashboard as it stands
today.

---

## The short version

Almost nothing in the dashboard is copied out of the workbook. **Three things
are taken as given, and everything else is calculated from them.**

Taken straight from the workbook, unchanged:

1. **Each facility's 20 indicator scores** (1 to 5).
2. **Each facility's four domain scores** — Technical Infrastructure, Workforce
   Capacity, Workflow & Transition, Data Use & Reporting.
3. **Each state's Leadership & Governance score**, for the 12 states that have
   one.

Everything else — every LGA figure, every state figure, every national figure,
every sub-domain, and each facility's readiness classification — **we calculate.**
None of those exist in the workbook in the form the dashboard shows them.

---

## 1. What we take from the workbook, untouched

The assessment team's workbook already contains each facility's domain scores,
worked out on their own sheets. We do not recalculate those. We read them.

Here is one facility's Technical Infrastructure score, as it appears in the
workbook and as it appears in the dashboard:

| | Must-haves ("Core") | Nice-to-haves ("Supporting") | Final | Rating |
|---|---|---|---|---|
| **Workbook says** | 2.625 | 0.525 | 3.15 | "Developing" |
| **Dashboard shows** | 2.625 | 0.525 | 3.15 | Moderately ready |

Identical. The only change is the wording of the rating — the workbook uses five
rating names, the dashboard uses three, and "Developing" maps onto "Moderately
ready". More on that in section 6.

**We do check the workbook's arithmetic.** We re-do each domain calculation from
the underlying indicator scores and compare it against what the workbook itself
says. All 11,216 of them agree (2,804 facilities × 4 domains). So the domain
scores are the workbook's, and they hold up.

**One thing we deliberately do not take from the workbook: the readiness
classification.** The workbook has a column for it, but it is marked "pending
revised archetype rerun" — the assessment team had not yet re-run their
classification against these revised scores. So we work it out ourselves.
Section 2 explains how, and how closely it matches.

---

## 2. Facility scores

### The domain score

Each domain score comes from the indicators underneath it. The workbook splits
those indicators into **must-haves** and **nice-to-haves**, and weights them
**70% to 30%**:

> A facility's Technical Infrastructure score is 70% of its average must-have
> indicator score, plus 30% of its average nice-to-have indicator score.

Two details behind that, both of which change the answer if you get them wrong:

**Unanswered questions are left out of the average — they never count as zero.**
The survey went through seven versions over the fieldwork. Questions added in
later versions simply do not exist for facilities visited early on. Scoring those
as zero would make the earliest-visited facilities look worse than they are,
purely because of when they were visited.

**Some questions were asked five times, once per service point.** Six of the
workflow questions work this way. Those five answers each count separately in the
average, rather than being merged into one. This matters more than it sounds: if
you merged them first, that block of questions would carry five times its
intended weight, and the totals would no longer match the workbook's.

### The facility's overall score

The simple average of its four domain scores. For example:

```
Technical Infrastructure  3.15
Workforce Capacity        2.90
Workflow & Transition     5.00
Data Use & Reporting      4.35
                          ----
Overall                   3.85
```

All four count equally.

### The readiness classification (Ready / Moderately ready / Not ready)

This is **not** based on the facility's average. It is deliberately stricter,
and it works on the facility's *weakest* areas:

> Look at Technical Infrastructure and Workforce Capacity — take whichever is
> **lower**. That is the facility's foundation.
>
> - If the foundation is **2.9 or below** → **Not ready**.
> - If the foundation is **above 3.9**, *and* the weaker of Workflow & Transition
>   and Data Use & Reporting is **at least 2.5** → **Ready**.
> - Anything else → **Moderately ready**.

In plain terms: a facility cannot be called Ready on the strength of its
paperwork if its power and its people are weak — and it cannot be called Ready at
all unless nothing else is badly broken.

**How well does this match the workbook?** It reproduces the workbook's own
classification for **2,773 of 2,804 facilities — 98.89%.**

We tested the obvious alternatives, and this rule is clearly the right one:

| Rule tried | How often it matched the workbook |
|---|---|
| **The rule above** | **98.89%** |
| Same, but with the 2.5 threshold nudged to 2.46 | 99.00% |
| Same, but ignoring Workflow and Data Use entirely | 95.19% |
| Just the average of all four domains | 72.6% |
| Just the weakest of all four domains | 69.3% |

We kept the threshold at a round **2.5** rather than 2.46, even though 2.46
matched three more facilities. Three facilities out of 2,804 is noise, and a
number like 2.46 makes the rule look more precise than it really is.

**The 31 facilities that do not match are an open question** — see section 7.

---

## 3. From facilities up to LGA, state and national

Every level above the facility is an **average of the facilities themselves**.

The important thing to understand: **each level reaches all the way down to the
facilities. Levels are not stacked on top of each other.** A state's score is not
built from its LGAs' scores. The national score is not built from the states'
scores. Every figure is worked out directly from the facility rows it covers.

At LGA, state and national level we produce:

| Figure | What it is |
|---|---|
| Domain scores | Average of that domain across the facilities in the area |
| Sub-domain scores | Average of that sub-domain across those facilities |
| Overall score | Average of those facilities' overall scores |
| Rating | That overall score turned into Ready / Moderately ready / Not ready |
| Readiness mix | How many facilities fall into each of the three classifications |

Kano, as a worked example — 436 facilities:

```
Technical Infrastructure   3.01
Workforce Capacity         3.62
Workflow & Transition      3.30
Data Use & Reporting       3.98
Overall                    3.48
```

**The 25 desk-review states and the FCT have no scores at all** — not zeros,
genuinely empty. No facilities were visited there, so there is nothing to
average. They appear on the map so the map covers the whole country, but they are
counted in no average anywhere.

**LGAs have no Leadership score and no investment figures.** Leadership is only
assessed at state level, and investment needs are only totalled at state and
national level.

---

## 4. Two results that look wrong but are not

These are the two most likely things to trip up a reader. Both are worth a
decision from you about how they should be described publicly.

### The national score is not the average of the states

```
Average across all 2,804 facilities   3.5349    ← this is what the dashboard shows
Average of the 12 state scores        3.5540    ← this is not used anywhere
```

The national figure treats every **facility** equally, which means bigger states
pull it toward themselves — Kano's 436 facilities count for more than Rivers' 144.

That is a legitimate choice, and arguably the right one: it describes the
facilities that were assessed. But it means the national number is **not "the
average state"**, and describing it that way in a report would be wrong. If you
would rather it treated every state equally, that is a real decision and we can
change it.

### There are two different "overall" numbers, and they are far apart

For Kano: **3.48** and **2.20**. Both are correct. They answer different
questions.

- **3.48** is the average of the actual domain scores — how Kano's facilities
  scored on the 1-to-5 scale.
- **2.20** is the average *after* every facility has been reduced to a single
  classification. Each facility is re-scored as Ready = 5, Moderately ready = 3,
  Not ready = 1, and those are averaged.

The second is much harsher because it throws away the detail: a facility scoring
3.8 and a facility scoring 3.0 both become a flat 3.

The Report Explorer's "overall" view uses the second one. Most other screens use
the first. **Quoting one as if it were the other would be a real error**, and if
you want them labelled differently on screen to keep them apart, say so.

---

## 5. The five domains — and why one is not like the others

| Domain | Built from | Measured where |
|---|---|---|
| Technical Infrastructure | 8 indicators | Every facility |
| Workforce Capacity | 5 indicators | Every facility |
| Workflow & Transition | 4 indicators | Every facility |
| Data Use & Reporting | 3 indicators | Every facility |
| **Leadership & Governance** | 4 questions | **State level only — 12 states** |

Leadership & Governance is not comparable to the other four, and this is worth
being blunt about:

- **It was never asked at facility level.** There is no facility instrument
  behind it, so it cannot appear on any facility screen or in any facility
  comparison.
- **It covers 4 of the 14 questions** the assessment framework defines for
  Leadership — state governance structures, digital health strategy, financial
  commitment, and data governance policy. It is closer to one part of Leadership
  than to Leadership as a whole.
- **Only 12 states have it.** The other 25 and the FCT have no Leadership data in
  any file supplied.
- **The national Leadership figure (2.21) is the average of those 12 states
  only.** It is not a national figure in any meaningful sense, and should not be
  quoted as one.

It is the weakest-scoring domain in the dashboard, which makes the caveat more
important rather than less — a weak score built on a quarter of the questions
and a third of the states invites a conclusion the data cannot support.

---

## 6. Sub-domains, and how ratings are assigned

### Sub-domains

The four facility domains break into **19 sub-domains** (power, connectivity,
devices, and so on). These use the same 70/30 must-have / nice-to-have logic as
the domains, with one necessary adjustment.

Most sub-domains contain only one kind of question — either only must-haves or
only nice-to-haves, not both. Applying the 70/30 split unchanged would cap a
must-have-only sub-domain at 3.5 and a nice-to-have-only one at 1.5, no matter
how well the facility actually did. In one case this produced a national
sub-domain score of **0.08** on a scale that starts at 1, and it was being
displayed as a readiness rating.

So sub-domain scores are **rescaled to sit properly on the 1-to-5 scale**. Where
a sub-domain does contain both kinds of question, the rescaling changes nothing.

**These sub-domain scores are ours, not the workbook's.** The workbook does not
publish sub-domain scores, so there is nothing to check them against. See section 7.

### How any score becomes a rating

The same three-way split is applied everywhere — to a facility, a sub-domain, an
LGA, a state, or the country:

| Score | Rating |
|---|---|
| 2.9 or below | **Not ready** |
| Above 2.9, up to 3.9 | **Moderately ready** |
| Above 3.9 | **Ready** |

These cut-offs are the assessment's own, not something we invented, and they are
not even thirds. They come from the workbook's crosswalk between its five rating
names and these three: Nascent and Emerging become Not ready, Developing becomes
Moderately ready, Institutionalized and Optimized become Ready.

A score of exactly 2.9 counts as **Not ready** — confirmed against a row in the
workbook that scores exactly 2.9 and is labelled "Emerging / Not Ready".

---

## 7. Four things worth your attention

These are the honest weak points. None of them is a bug; all of them are places
where the data or the method leaves a question open.

**1. Thirty-one facilities we cannot explain.**
Our classification rule matches the workbook for 2,773 facilities and disagrees
for 31. No alternative rule we tested explains them. Most likely they were
adjusted by hand in the original spreadsheet. Worth confirming with the
assessment team — until then, the rule is 98.89% of a rule.

**2. Sub-domain scores have nothing to check them against.**
Domain scores can be verified against the workbook, and are. Sub-domain scores
cannot, because the workbook does not publish any. If our sub-domain logic ever
drifted, nothing would catch it. These are the numbers to review most carefully,
because they are the least externally supported.

**3. Leadership & Governance is presented beside four complete domains.**
Four questions out of fourteen, twelve states out of thirty-seven — shown next to
four domains that are complete for all 2,804 facilities. The dashboard labels the
gap, but the visual equivalence is doing work the data cannot support.

**4. Two "overall" numbers are in circulation.**
Covered in section 4. Kano is 3.48 on one and 2.20 on the other. Both appear in
the dashboard on different screens.

---

## What I would most like you to check

If you only review three things:

1. **The readiness classification rule in section 2** — is "weakest of
   Infrastructure and Workforce, with a floor on the other two" what the
   assessment actually intended?
2. **The national figure in section 4** — should it weight every facility
   equally, or every state equally?
3. **The Leadership caveats in section 5** — is that domain being presented
   carefully enough, given what is behind it?
