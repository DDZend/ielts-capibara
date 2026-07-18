# IELTS Mastery

A production-ready IELTS preparation site built with Next.js App Router, React, TypeScript, Vinext/OpenAI Sites, Cloudflare D1, Drizzle ORM and platform-provided Sign in with ChatGPT.

## Local development

1. Open this folder in VS Code.
2. Install dependencies with `npm install`.
3. Start the local site with `npm run dev`.
4. Open `http://localhost:3000`.

The public landing page and assessment work without authentication. The dashboard and assessment-result APIs expect OpenAI Sites authentication headers; the complete sign-in flow is available on the deployed Sites URL.

## Quality checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run db:generate` after changing `db/schema.ts`

The generated D1 migration is stored in `drizzle/`. The logical production binding is `DB`.
