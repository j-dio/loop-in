# Contributing to LoopIn

Thanks for taking the time to contribute. Here's everything you need to know before opening a PR.

---

## Getting started

Follow the setup in [README.md](README.md) first. The project should be running locally before you make any changes. Setup takes about 10–15 minutes.

---

## Branching

Fork the repo, then create a branch off `main`:

```bash
git checkout -b feat/your-feature-name
git checkout -b fix/the-thing-you-are-fixing
```

Prefixes: `feat/` · `fix/` · `refactor/` · `docs/` · `chore/` · `perf/`

---

## Code conventions

### Backend (`server/`)

- New endpoints go in `server/src/modules/<module>/`. Follow the existing **controller → service → route** pattern.
- Validate all request bodies with **Zod at the controller boundary** — not in the service layer.
- No `console.log` in server code. Use the Pino logger: `import logger from "@/lib/logger"`.
- The middleware chain for workspace routes is: `optionalAuth → rateLimit → authenticate → requireWorkspace → requireRole(...)`. Don't break this order.
- New write endpoints need a rate limiter entry in `middleware/rateLimit.ts`.

### Frontend (`client/`)

- All API calls go through `apiFetch` from `client/src/lib/api.ts`. It handles 401 → token refresh automatically. Never use raw `fetch` for API requests.
- Use design system CSS tokens — `--foreground`, `--brand`, `--border`, `--muted-foreground`, etc. No hardcoded hex colors in component code.
- New UI components follow the shadcn/ui pattern: unstyled primitives + Tailwind utility classes.
- Light and dark mode must both work. Test both before submitting.

### Both

- TypeScript strict mode is on. Avoid `any` — if you must use it, add a comment explaining why.
- Immutable updates: spread (`{ ...obj, key: val }`) instead of mutating in place.
- No `console.log` anywhere. Ever.
- Don't add features for hypothetical future requirements. Solve the problem in the PR.

---

## Database migrations

If your change modifies `server/src/db/schema.ts`:

```bash
cd server
npx drizzle-kit generate   # generates a new file in drizzle/
npm run migrate            # applies it to your local DB
```

Commit the generated migration file alongside your schema change. One migration per PR — don't bundle unrelated schema changes.

> **Never use `drizzle-kit push` in production.** It bypasses the migration history and will corrupt the database.

---

## Checks before opening a PR

Run these locally and make sure they pass:

```bash
# Server
cd server && npm run typecheck
cd server && npm test

# Client
cd client && npm run build
cd client && npm run lint
```

**Known baseline lint issues** (pre-existing — do not fix these in unrelated PRs):
- `react-hooks/exhaustive-deps` warning in `client/src/pages/Admin.tsx`
- Two TypeScript strict-mode errors in `client/src/lib/lenis.ts`

Do not introduce new lint errors on top of these.

---

## Running E2E tests

E2E tests use Playwright and require the full dev stack to be running (both server and client):

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev

# Terminal 3
cd client && npx playwright test
```

Specs live in `client/e2e/`. New critical user flows should have a spec.

---

## PR checklist

Before marking your PR ready for review:

- [ ] `npm run typecheck` passes in `server/`
- [ ] `npm test` passes in `server/`
- [ ] `npm run build` passes in `client/`
- [ ] `npm run lint` passes in `client/` (no new errors)
- [ ] Migration file included if schema changed
- [ ] No hardcoded secrets, credentials, or API keys
- [ ] No `console.log` in server or client code
- [ ] UI changes tested in both light and dark mode

---

## PR title and description

**Title format:** `type: short description`

Examples:
- `feat: add post reactions`
- `fix: upvote race condition on concurrent requests`
- `refactor: split workspace service into smaller modules`
- `docs: add S3 setup guide to README`

**Description should include:**
- What changed and why
- How to test it manually (step-by-step)
- Which migration file was added, if any
- Screenshots for any UI changes

---

## Commit format

```
feat: add post reactions

Adds emoji reactions to posts. Builders can enable or disable reactions
per workspace in Admin → Settings.
```

Types: `feat` · `fix` · `refactor` · `docs` · `test` · `chore` · `perf`

Keep the subject line under 72 characters. Body is optional but welcome for anything non-obvious.

---

## Questions and ideas

Open a [Discussion](../../discussions) before building a large feature — it's faster to align early than to refactor after. For confirmed bugs, open an [Issue](../../issues) with steps to reproduce.

---

## Code of conduct

Be respectful. This is a community project — treat contributors the way you'd want to be treated.
