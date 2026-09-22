# Readsmith

**An AI that understands your project, then documents it.** Point it at a GitHub
repository and its live site — Readsmith investigates both, works out what the project
actually is, and writes a `README.md` shaped around what makes it interesting.

It is deliberately *not* a template filler. The structure is chosen per project: a CLI
reads differently from a SaaS app, which reads differently from a portfolio.

---

## What it does

- **Reads the repository deeply** — metadata, file tree, `package.json` scripts,
  lockfiles, config, `.env.example`, license, tests, Docker/CI, and linkable image assets.
- **Analyzes the live site** — title, description, OG tags, headings, navigation, CTAs,
  and visible copy, to describe the project as a real product.
- **Builds a structured understanding** before writing a single line of Markdown.
- **Designs a README strategy** — the model decides which sections belong and in what order.
- **Writes the README**, grounded strictly in verified signals. No invented features,
  commands, badges, screenshots, or links.
- **Refines on demand** — more concise, more technical, more visual, stronger intro, add
  architecture, or a free-form instruction. Direct Markdown editing too.

## The pipeline

```text
GitHub URL ─┐
            ├─▶ Repository ingestion   (lib/github.ts)
Website URL ┤
            └─▶ Website analysis       (lib/website.ts)
                        │
                        ▼
              Project understanding    (lib/ai.ts → prompts.ts)
                        │
                        ▼
              README strategy          (model chooses sections)
                        │
                        ▼
              README generation        (GitHub-flavored Markdown)
```

Each stage streams to the browser as it completes, so the progress you see reflects real
work rather than a fake spinner.

## Tech stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js 14 (App Router) + TypeScript               |
| UI         | Tailwind CSS, React Markdown, rehype-highlight     |
| AI         | Anthropic Claude via `@anthropic-ai/sdk`           |
| Ingestion  | GitHub REST API (optional token) + raw HTML parse  |

## Getting started

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev               # http://localhost:3000
```

### Environment variables

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-5-sonnet-latest   # optional
GITHUB_TOKEN=                              # optional: private repos + higher rate limits
```

Public repositories work without a token. Keys live server-side only and are never
exposed to the browser.

## Project structure

```text
app/            → routes + API (generate streams NDJSON, refine)
components/     → UI: form, progress stream, result editor, insights, markdown
lib/            → github ingestion, website analysis, AI pipeline, prompts, types
```

## Accuracy

Readsmith treats the repository and website as the source of truth. When a fact can't be
verified from the signals, it is omitted rather than guessed. If the repo and site
disagree, the discrepancy is surfaced in the insights panel instead of being papered over.

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
```
# readsmith
