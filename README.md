# LoopIn

> Where indie apps get discovered — and feedback actually lands.

LoopIn is an open-source platform that solves two problems at once:

**1. Indie app visibility** — apps built by indie devs get buried in Facebook group posts and social feeds. LoopIn gives every app a permanent, searchable home where users can discover it, follow it, and stay updated on what ships.

**2. The feedback loop** — users submit ideas and bug reports, other users upvote what resonates, and builders triage the signal onto a Kanban roadmap — then notify every supporter the moment something ships.

Think Canny × Product Hunt, but open-source and built for the indie dev era.

**Live demo:** [https://zucchini-laughter-production.up.railway.app](https://zucchini-laughter-production.up.railway.app)

---

## Features

**For builders**
- Public feedback board — collect submissions, upvotes, and threaded comments
- Admin triage inbox — approve, reject, or flag posts as spam
- Kanban roadmap — drag from Inbox → Under Review → Planned → In Progress → Shipped
- Announcements and pinned posts
- AI digest — one click turns a noisy backlog into a ranked, reasoned plan
- Auto-notify supporters on approval and when something ships
- Moderation audit trail
- App profile with screenshots, platform tags, and links

**For the community**
- Explore feed — discover public apps sorted by followers or newest
- "Just launched" strip — see what indie devs shipped recently
- Follow apps you care about
- Following feed — feedback, updates, and announcements from apps you follow
- In-app notification center

---

## Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 19, React Router 7, Tailwind CSS v4, shadcn/ui, Vite |
| **Backend** | Node.js, TypeScript, Express (controller–service–route) |
| **Database** | PostgreSQL + Drizzle ORM |
| **Cache** | Redis (sliding-window rate limiting, trending scores) |
| **Storage** | AWS S3 (presigned uploads — avatars, post images, screenshots) |
| **Auth** | Google + GitHub OAuth via Passport.js; JWT httpOnly cookies with refresh rotation |
| **Email** | Resend (transactional — approvals, ship notifications, invites) |
| **AI** | Google Gemini (AI digest; OpenRouter as fallback) |
| **Monitoring** | Sentry (optional), Pino structured logging |
| **Deployment** | Railway (Railpack monorepo — migrations run on start) |

---

## Local setup

### Prerequisites

- **Node.js 20** (LTS)
- **Docker + Docker Compose** — runs PostgreSQL and Redis locally
- **Google OAuth app** — [console.cloud.google.com](https://console.cloud.google.com)
  - Authorized redirect URI: `http://localhost:3001/auth/google/callback`
- **GitHub OAuth app** — [github.com/settings/developers](https://github.com/settings/developers)
  - Callback URL: `http://localhost:3001/auth/github/callback`

Optional (app works without these, features degrade gracefully):
- AWS S3 bucket — for image uploads (avatars, post images, app screenshots)
- Resend account — for transactional email
- Google Gemini API key — for the AI digest feature

### Steps

**1. Clone**

```bash
git clone https://github.com/j-dio/loop-in.git
cd loop-in
```

**2. Environment**

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum: `DATABASE_URL`, `JWT_SECRET`, Google + GitHub OAuth credentials, `CLIENT_URL`, `SERVER_URL`, and `VITE_API_URL`. See [Environment variables](#environment-variables) below.

**3. Install dependencies**

```bash
cd server && npm install
cd ../client && npm install
```

**4. Start infrastructure** (from repo root)

```bash
docker compose up -d
```

This starts PostgreSQL and Redis as defined in `docker-compose.yml`.

**5. Run migrations**

```bash
cd server && npm run migrate
```

**6. (Optional) Seed demo data**

```bash
cd server && SEED_CONFIRM=1 npx tsx src/db/seed.ts
```

Creates demo workspaces, users, posts, and follow edges so the Explore feed looks populated.

**7. Start the API**

```bash
cd server && npm run dev
```

Runs on port **3001**. Health check: `GET /health`

**8. Start the client**

```bash
cd client && npm run dev
```

Open the URL Vite prints — usually **http://localhost:5173**.

> **Cookie gotcha:** `CLIENT_URL`, `SERVER_URL`, and `VITE_API_URL` must all use the same hostname (`localhost`, not `127.0.0.1`). Auth cookies are host-scoped, so a mismatch silently breaks login.

---

## Environment variables

See `.env.example` for the full annotated list. Required to boot:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis URL (default: `redis://127.0.0.1:6379`) |
| `JWT_SECRET` | Long random string for signing JWTs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth app credentials |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app credentials |
| `CLIENT_URL` | Browser app origin (e.g. `http://localhost:5173`) |
| `SERVER_URL` | API base URL (e.g. `http://localhost:3001`) |
| `VITE_API_URL` | Client-side API base URL (must match browser tab hostname) |

Optional features:

| Variable | Purpose |
|---|---|
| `S3_BUCKET` / `AWS_REGION` | AWS S3 bucket for image uploads |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials for S3 (local dev only; use instance role in prod) |
| `RESEND_API_KEY` / `FROM_EMAIL` | Transactional email via Resend |
| `GEMINI_API_KEY` | Google Gemini for the AI digest feature |
| `OPENROUTER_API_KEY` | Optional AI fallback when Gemini key is absent |
| `SENTRY_DSN` | Sentry error monitoring |
| `ONBOARDING_FEATURED_SLUG` | Workspace slug that brand-new users auto-follow on signup. Leave blank in local dev unless you create that workspace first. |

---

## Project structure

```
loop-in/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/      # UI components (landing, admin, brand, shared)
│       ├── pages/           # Route-level pages (Board, Thread, Admin, Explore, Home, …)
│       └── lib/             # apiFetch, theme, motion, workspace color utils
├── server/                  # Express API
│   └── src/
│       ├── db/schema.ts     # All Drizzle table + enum definitions (single source of truth)
│       ├── middleware/      # authenticate, requireWorkspace, requireRole, rateLimit
│       └── modules/         # auth, users, workspaces, posts, comments, upvotes, uploads, explore, ai
├── drizzle/                 # SQL migrations — generated by Drizzle Kit, never edit manually
├── docker-compose.yml
└── .env.example
```

---

## Commands

| Directory | Command | Purpose |
|---|---|---|
| `server/` | `npm run dev` | Start API with hot reload |
| `server/` | `npm run typecheck` | TypeScript check (no emit) |
| `server/` | `npm test` | Run server unit tests |
| `server/` | `npm run migrate` | Apply pending DB migrations |
| `client/` | `npm run dev` | Start Vite dev server |
| `client/` | `npm run build` | Production build |
| `client/` | `npm run lint` | ESLint |
| root | `docker compose up -d` | Start PostgreSQL + Redis |

### Database migrations

```bash
# Generate a migration from schema changes
cd server && npx drizzle-kit generate

# Apply pending migrations
cd server && npm run migrate
```

> **Never use `drizzle-kit push` in production.** Always generate + migrate.

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide — branching conventions, code rules, how migrations work, and the PR checklist.

---

## License

MIT — see [LICENSE](LICENSE).
