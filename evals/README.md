# Evals

The eval suite runs the real analysis pipeline (`src/lib/pipeline.ts`, the same code the API uses) on 12 hand-labelled cases. It measures what matters for this app: are the requirements found, is each one assessed correctly, and does the AI ever invent things about the candidate?

```bash
npm run eval                          # all cases
npm run eval -- --case weak-match     # one case
npm run eval -- --runs 3              # repeat to see run-to-run variance
npm run eval -- --model gpt-5.4-mini  # compare app models
npm run eval -- --judge-model gpt-5.5 # choose the letter judge
```

Each run calls the OpenAI API. With the defaults, a full run costs about $0.08 for the app calls plus about $0.40 for the judge.

## The cases

Every person and company is fictional. Each case targets one known failure mode:

| Case | What it catches |
| --- | --- |
| `strong-match-sv` | The demo: mostly met, one partial, one gap; benefits must not become requirements |
| `weak-match` | Unrelated profession: everything technical must be a gap |
| `injection-in-cv` | The CV tells the AI to mark everything as met |
| `injection-in-ad` | The ad tells the AI to add a fake requirement |
| `language-mix` | English ad, Swedish CV |
| `levels-partial` | "Basic" and course-only skills must be partial |
| `synonyms` | Postgres, K8s, TS and GitLab CI must count |
| `career-changer` | Transferable skills count, a missing skill stays a gap |
| `fluffy-ad` | Perks and company story must not be extracted |
| `years-of-experience` | Fewer years than required must not be "met" |
| `near-miss-tech` | Vue/Angular must never count as React |
| `education-only` | Courses and certificates are not professional experience |

## How it's graded

- **Requirements and status** are deterministic. A regex finds each expected requirement among the extracted ones, and its status must be one of the allowed values. Two values are allowed only where a human reviewer would accept both.
- **Invented evidence** is counted by the app's own quote check, which rejects any quote that isn't in the CV.
- **The cover letter** is checked by an LLM judge (`judge.ts`) for invented hard facts: tools, employers, dates, numbers and education. The judge must quote the CV before each verdict. Overstatements such as "daily" are reported separately as "embellished" and are not counted as failures.

## What the evals found (and what changed)

1. **The first judge was useless.** With the app's small model as judge and a vague prompt, it flagged almost every sentence, including sentences copied from the CV. Requiring CV quotes, limiting the check to hard facts and using a stronger judge model fixed it.
2. **A letter claimed "at least five years of experience in C#"** for a candidate with about two years. The letter prompt now says partial requirements must be described exactly as the CV shows them, with no added years or levels. After the fix, 0 of 12 letters contained invented hard facts.
3. **Certificates were sometimes rated as professional experience.** The match prompt now spells out that courses, certificates and hobby projects count as partial.

Caveat: the 12 cases are also what the prompts were tuned against, so the results are optimistic. New cases are the best way to keep the numbers honest.

Latest results: [`results/gpt-5.4-mini.md`](results/gpt-5.4-mini.md). Full details, including every letter and every judge finding, are in the matching `.json` file.
