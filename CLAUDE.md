# Working on this project

Companion to `README.md`, which covers installation. This file gathers what you cannot infer from reading the code: how deployment actually works, the conventions in use, and the traps already encountered.

---

## Deployment runs through two independent channels

This is the single most important thing to know, and the source of most confusion.

| Channel | What it deploys | Trigger |
|---|---|---|
| **Vercel** | the React front end | automatic, on push to `main` |
| **Supabase** | database migrations | automatic, on push to `main` |
| **Supabase — Edge Functions** | server-side functions | ⚠️ **manual, never automatic** |

Production: https://holos-perf.vercel.app

### ⚠️ Edge Functions never deploy on their own

Supabase's GitHub integration applies migrations, **but not functions**. Any change under `supabase/functions/` requires:

```bash
git checkout main && git pull
supabase functions deploy <function-name>
```

Skip it and the function keeps running its previous version — **with no warning whatsoever**. A pull request can be reviewed, merged and "deployed" while the server still executes the old code.

### Confirming a deployment actually happened

```bash
# Front end: the file name changes on every deployment
curl -s https://holos-perf.vercel.app/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'

# Database: nothing should be missing on the remote side
supabase migration list

# Functions: check the version number
supabase functions list
```

---

## Release process

```
feature pull request  →  develop
"[Release] …" request  →  main      ← triggers deployments
```

`main` is protected: no direct pushes, pull request required, and **merge commits only** (no squash, no rebase, so both branches keep their history).

Run the checks above after every release. A release can succeed on the front end and fail on the database, or the reverse, with nothing to signal it.

### Pull request descriptions

Non-developers read these pull requests, and they are written in French. Descriptions follow a ticket-style format:

1. **Type** (✨ Fonctionnalité · 🐛 Bug · 🔧 Maintenance · 📚 Documentation · 🔒 Sécurité) and where the request came from
2. **🧾 En bref** — one sentence anyone can understand
3. **✅ Ce que fait cette PR** — plain language, no jargon
4. **📌 Impact** — per audience: users, coaches and administrators, production and data
5. **📸 Capture** — only when the interface changes
6. **🔧 Détails techniques** — inside a collapsible `<details>` block

Titles carry a bracketed prefix and stay readable by a non-technical person. Release pull requests are **always** prefixed `[Release]`, whatever they contain.

---

## Database

### Row level security must stay on everywhere

All 16 public tables have RLS enabled. Without it the anon key — public by design, embedded in the JavaScript bundle — grants full read and write access.

```sql
-- Must return no rows
select relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
```

A policy that exists but was never enabled is **inert**: PostgreSQL does not evaluate it until `ENABLE ROW LEVEL SECURITY` has been set on the table. Any new table must therefore enable RLS **and** define its policies.

### Every schema change goes through a migration

```bash
supabase migration new <name>
```

Never change the schema from the dashboard SQL editor: the change lands in production untracked, the local database drifts, and later migrations assume a state that does not exist.

### ⚠️ Reads are capped at 1000 rows

Supabase caps every response at `max_rows` — **1000** here, set in `supabase/config.toml`. Past that, a plain query returns the first thousand rows of the requested order **with no error and no warning**.

Asking for more does not help: the server limit wins over the client's. An export requesting 5000 rows received 1000.

The entity wrapper in `src/api/supabaseClient.js` pages through results, so `list`, `filter` and `filterIn` all return everything. **Any raw `supabaseRaw.from(...)` query bypasses that and will truncate silently** — including in Edge Functions, which do not use the wrapper at all.

When writing a query against a table that may grow past a thousand rows:

- prefer the wrapper, or page explicitly with `.range()`
- always add a stable tiebreaker to the ordering, e.g. `.order('id', { ascending: true })` — without it a row can appear on two pages, or on none
- better still, filter server-side so the result stays small: a date range, an athlete, a template

This has already caused two production bugs: coach-facing totals understated by hundreds, with two questionnaires showing zero responses when they had 23 and 13; and a reminder function that kept notifying athletes who had already answered, because their responses fell outside the first thousand.

### ⚠️ Never run `supabase config push`

`supabase/config.toml` describes the **local** environment. Pushing it would overwrite `site_url` and the redirect URLs with local addresses, making sign-in impossible in production.

To compare without changing anything: `supabase config diff`. To change a production setting: the dashboard.

---

## Push notifications

Full chain: browser subscribes → stored in `user_preferences.preferences` → scheduled job every 15 minutes → `send-reminders` Edge Function → push service → device.

- **The VAPID public key is hardcoded in `src/lib/pushNotifications.js`**, not an environment variable: it is public by design and permanent. Changing it would invalidate every existing subscription.
- `VITE_VAPID_PUBLIC_KEY` still takes precedence when present, so local development uses a separate pair and can never reach a real device.
- The private key lives in Supabase secrets, never in the repository.
- `src/lib/pushNotifications.js` checks the **current browser's** subscription, not just what the database says: a subscription is tied to a (browser, origin) pair, so a desktop one means nothing for a phone.
- On iOS, notifications only work once the app is **installed to the home screen**. Subscribing from a Safari tab fails.
- The subscription endpoint is user-written, so it is validated against the list of legitimate push services before any send — otherwise the server would become a relay toward internal addresses.

---

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm run lint         # 63 pre-existing problems: do not add more

supabase start       # local stack (needs Docker, ~2.3 GB)
supabase stop        # keeps your data
supabase db reset    # replays migrations + seed
```

The seed creates five test accounts under `@holos.test`, password `password123`, one of them an administrator. **It must never be applied to a reachable environment.**

---

## Traps already hit

- A **"Redeploy"** from the Vercel dashboard replays the existing commit, **not** the latest one. Deploying a commit left behind requires a fresh event.
- **Transferring the repository to another owner breaks the Vercel link** silently. Symptom: the Vercel check disappears from pull requests.
- Neither Vercel nor Supabase **catch up retroactively**: connecting an integration does not apply merges that already happened.
- Vercel previews sit behind authentication and cannot be opened without an account on the team.
- Comparing an incoming token to `SUPABASE_SERVICE_ROLE_KEY` by string equality does not work: Supabase issues several valid credentials for that role. Check the token's `role` claim instead — the platform has already verified its signature.
- A query returning exactly 1000 rows is almost certainly truncated, not complete. See *Reads are capped at 1000 rows* above.
