# IELTS Mastery

A production-ready IELTS preparation site built with Next.js App Router, React, TypeScript, Vinext/OpenAI Sites, Cloudflare D1, Drizzle ORM and platform-provided Sign in with ChatGPT.

## Local development

1. Open this folder in VS Code.
2. Install dependencies with `npm install`.
3. Start the local site with `npm run dev`.
4. Open `http://localhost:3000`.

The public landing page and assessment work without authentication. The dashboard and assessment-result APIs expect OpenAI Sites authentication headers; the complete sign-in flow is available on the deployed Sites URL.

Signed-in students receive a persistent three-task daily plan at `/dashboard`. Task completions drive points, streaks, weekly progress and recent activity. The protected `/mock-test` route provides a four-skill weekend practice mock, saves one calculated result per week and compares it with the previous attempt. Writing responses and microphone recordings are never persisted.

## Quality checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run db:generate` after changing `db/schema.ts`

The generated D1 migration is stored in `drizzle/`. The logical production binding is `DB`.
