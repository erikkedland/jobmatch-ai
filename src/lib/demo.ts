import type { Locale } from "./i18n";

/** Fictional demo CV served from /public (generated from samples/sara-bergstrom-cv.txt). */
export const DEMO_CV_URL = "/demo/sara-bergstrom-cv.pdf";
export const DEMO_CV_NAME = "sara-bergstrom-cv.pdf";

/** Fictional job ads that partly match the demo CV, so the result shows met, partial and gap. */
export const DEMO_JOB_AD: Record<Locale, string> = {
  sv: `Fullstackutvecklare – Göteborg

Vi är ett växande energibolag som bygger digitala tjänster för hundratusentals kunder. Nu söker vi en fullstackutvecklare till vårt kundportalsteam.

Vi söker dig som har:
- Minst 3 års erfarenhet av TypeScript och React
- Erfarenhet av att bygga API:er i Node.js
- Erfarenhet av PostgreSQL och CI/CD
- Erfarenhet av AWS

Det är meriterande om du har:
- Erfarenhet av Kubernetes
- Kunskap om tillgänglighet (WCAG)
- Erfarenhet av Python

Som person är du samarbetsvillig, gillar att dela med dig av din kunskap och uttrycker dig väl på svenska och engelska.

Vi erbjuder hybridarbete, friskvårdsbidrag och kollektivavtal.`,
  en: `Senior Frontend Engineer – Remote (EU)

We're a fintech scale-up building tools that help small businesses manage cash flow. Join our web platform team.

Requirements:
- 5+ years of professional frontend development
- Expert knowledge of React and TypeScript
- Experience with design systems and Storybook
- Experience with automated testing (unit and end-to-end)

Nice to have:
- Experience with GraphQL
- Experience in fintech or payments
- Knowledge of web accessibility

You communicate clearly in English, take ownership of your work and enjoy mentoring others.

We offer remote work, a learning budget and stock options.`,
};
