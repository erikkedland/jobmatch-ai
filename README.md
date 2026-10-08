# JobMatch AI

An AI agent that matches your CV against a job ad, backed by quoted evidence from your CV, and writes a tailored cover letter.

> 🚧 Work in progress. A live demo, an architecture diagram and eval results will be added as the project develops.

## Getting started

Requirements: Node.js 20+ and an [Anthropic API key](https://console.anthropic.com/settings/keys).

```bash
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev
```

Open http://localhost:3000.

## Tech stack

- **Next.js** (App Router) + **TypeScript**: one codebase for the UI and the API
- **Tailwind CSS**: styling
- **unpdf**: server-side PDF text extraction
- **Zod**: runtime validation of AI output
- **Claude API**: requirement extraction, matching and writing
