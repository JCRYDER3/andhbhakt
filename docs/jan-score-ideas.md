# Ideas from jan-score, for consideration here

[jan-score](https://github.com/0xVISHWAJEET/jan-score) is a sibling civic-accountability
project — representative-level scores (MP/MLA/Municipal Councillor/Sarpanch), built
independently but tackling much of the same problem space as andhbhakt: turning
scattered official data into an accountable, public score citizens can trust. Since the
two projects already share a data relationship (jan-score's ingestion pipeline reads
andhbhakt's public API as one of its sources), this is a short list of ideas from
jan-score's own design that might be worth adapting here, offered in the spirit of two
projects with the same mission comparing notes — not a claim that either approach is
strictly better, just documenting what jan-score does differently in case any of it is
useful.

## 1. A published, deterministic scoring methodology

jan-score scores every representative across 5 weighted dimensions with 26 named
sub-metrics, each backed by a public methodology page explaining exactly how a score is
computed — source-tier weighting (an ECI affidavit counts differently than an
unverified news report), time-decay on older evidence, and an explicit AI-confidence
band with a distinct "Not Rated" state for anything the evidence doesn't yet support
confidently. andhbhakt's scheme/state/minister scorecards are already evidence-grounded
(PIB vs. CAG vs. NFHS/NCRB/MOSPI), but the scoring function itself doesn't appear to be
published as a discrete, auditable formula the way jan-score's is — worth considering if
"how exactly was this number computed" is a question you want every score to answer for
itself.

## 2. A human moderator review queue in front of automated findings

jan-score runs an AI (Claude) extraction agent over unstructured sources, but nothing an
automated agent finds can move a public score until a human moderator has reviewed and
approved it. Given andhbhakt already does AI-assisted work in its pipeline (per the
architecture notes in this repo), a similar explicit human-in-the-loop gate — even a
lightweight one — could be a useful trust signal to state alongside the methodology page.

## 3. A "Right of Reply" mechanism

Any representative or official who's been scored can submit a public response, shown
alongside their score rather than replacing it. This doesn't change the underlying
evidence, just gives the subject of a score a documented chance to contextualize it —
useful for both fairness and for surfacing corrections you might not otherwise catch.

## 4. Explicit scope boundaries per office ("Responsibility Card")

jan-score scores an MP only on MP-level responsibilities, an MLA only on MLA-level ones,
etc. — never penalizing (or crediting) someone for outcomes outside the actual authority
of their office. For a platform covering both Union schemes and state-level governance
cards, an explicit scope boundary per office/level might help pre-empt "why is this
official being blamed for something they don't control" pushback.

## 5. A lightweight citizen-rating layer, separate from the evidence-based score

jan-score lets one verified email cast one rating per category per year, kept
distinct from (and clearly labeled apart from) the evidence-based score, with a
soft-damping anti-manipulation mechanism against coordinated brigading. This is
optional and genuinely double-edged — it adds a moderation/abuse surface — but it does
give citizens a documented voice on top of the official-data picture, which is
otherwise entirely top-down.

## 6. Score history + side-by-side comparison views

Public score-history tracking per representative, plus a compare view across two or
more of them side by side. Useful for the "did this improve after re-election"
question that a single point-in-time scorecard can't answer on its own.

---

None of this is a request to change andhbhakt's direction — it's already a serious,
well-sourced project on a similar mission. This is just what a sibling project doing
comparable work has learned along the way, offered in case any of it saves you time
or is worth adapting.
