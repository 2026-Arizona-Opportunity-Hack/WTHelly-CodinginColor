# WTHelly — Coding in Color

Built at [ASU Fall Hackathon 2026 | Phoenix Hackathon for Nonprofits: Nov 14-15](https://www.ohack.dev/hack/fall-2026) for the public good (MIT license).

> **⚠️ This is your team's ONE repository — all code goes here.** Please don't create
> another repo (personal or org). Judges, the Team Dashboard's code-activity card,
> the public project page and the nonprofit all read **this** repo; work pushed
> anywhere else is invisible to them and won't count. Everyone on the team should be
> a collaborator here — ask an organizer in Slack if someone can't push.

| | |
|---|---|
| **Nonprofit** | [Coding in Color](https://www.ohack.dev/nonprofit/YIXYdYCoxIZC08uQ5DL3) |
| **Problem statement** | [Curriculum & Student Progress Platform (CIC Problem 1)](https://www.ohack.dev/project/d09466fadf1b11f18e63deadc507a848) |
| **Team page** | [WTHelly](https://www.ohack.dev/hack/fall-2026/team/917b7ac8e06311f19a62deadfb009123) · [Team Dashboard](https://www.ohack.dev/hack/fall-2026/manageteam) (story, demo video, submit) |
| **Slack** | team: [#wthelly](https://opportunity-hack.slack.com/app_redirect?channel=wthelly) · nonprofit: [#npo-coding-in-color](https://opportunity-hack.slack.com/app_redirect?channel=npo-coding-in-color) · help: [#ask-a-mentor](https://opportunity-hack.slack.com/archives/C01E5CGDQ74) |
| **Built by** | WTHelly — see the team below |

## Final day

Start recording your demo video by **Sun Nov 15, 12:00 PM MST** — hacking ends at **Sun Nov 15, 2:00 PM MST**, and a demo you recorded with time to spare beats a feature you finished at 1:59.

- Sun Nov 15, 11:00 AM MST — Presentation Feedback Hour
- **Sun Nov 15, 12:00 PM MST — Start recording your demo video**
- Sun Nov 15, 12:30 PM MST — Judges Arrive
- **Sun Nov 15, 2:00 PM MST — 🛑 Submission Deadline: Hacking ends**
- Sun Nov 15, 2:05 PM MST — Judging Round 1
- Sun Nov 15, 3:40 PM MST — Judging Final Round
- Sun Nov 15, 4:30 PM MST — Closing Ceremony: Winners Announced

## Before hacking ends — the submission checklist

Everything is submitted from your [Team Dashboard](https://www.ohack.dev/hack/fall-2026/manageteam); judges read the dashboard, this README and your demo video.

- [ ] **Code pushed** to this repo, in small PRs (see `AGENTS.md`) — judges and future recruiters read the history
- [ ] **Project story** written on the dashboard (`#project`): the problem, who it helps, what you built, what's next
- [ ] **Demo video** (4 minutes or less) on YouTube, Vimeo, Loom or Google Drive, linked on the dashboard (`#demo`) — show it working, not slides
- [ ] **Submit** on the dashboard (you can keep editing until the close)
- [ ] This README filled in below: team, tech stack, how to run it, live link if you have one
- Optional: a [DevPost entry](https://opportunity-hack-2026-arizona.devpost.com/) — the dashboard is the submission of record.

Judges score **Scope, Documentation, Polish and Security**, plus a separate **Accessibility** prize — the rubric is at [ohack.dev/hackathon-judging-criteria](https://www.ohack.dev/hackathon-judging-criteria). Document your work as GitHub Issues as you go: that's how you get public credit for it.

## Team

- [Advait Kankati](https://github.com/adv23) — database, authentication, submissions and tests, module editor and admin pages
- [Mukund Giridhar](https://github.com/MukundG07) — activity player, digital worksheets and browser Python runner
- [Skandarsini Ramagiri Ramesh](https://github.com/SKANDARSINI) — class dashboard, aggregate read API and accessibility
- [Mitul Balamurugan](https://github.com/Mitul9703) — Student join

## What we built

A curriculum and student progress platform for Coding in Color. Students learn at their own pace without email accounts, while instructors set up classes and see how students are progressing.

- **Student join:** class code, name and a four-digit PIN.
- **Self-paced learning:** pretests, videos, checks, digital worksheets, exit questions and post-tests. The activity player saves submissions before students continue.
- **Python practice:** run code in the browser with Pyodide, console output, Stop, Reset and a five-second timeout. Code submissions are saved, but are not server-graded yet.
- **Class setup:** create classes, import a roster, assign modules and share a join link.
- **Class dashboard:** see completion, pre/post scores and learning gain (post-test minus pretest).
- **Module editor:** create, check and publish curriculum content.
- **Admin and reviewer views:** overview for admins and read-only curriculum access for reviewers.
- **Read API:** key-protected aggregate class, cohort and program progress for CIC's dashboard.

Activity content is loaded on the server without answer keys. Checks, worksheets and assessments are scored on the server; progression follows confirmed submissions.

### Read API

CIC's dashboard can read aggregate cohort, class and program progress through the bearer-key API. Admins manage keys at `/admin/api-keys`. See [`docs/api.md`](docs/api.md) for endpoints, date filters, response examples and curl commands; the OpenAPI definition is [`docs/openapi.yaml`](docs/openapi.yaml).

Preview the player locally at `/demo/activity-player` after `npm run dev`. Choose a video, check, worksheet or exit screen; this preview does not submit.

- Requirements with IDs and acceptance criteria: [`docs/requirements.md`](docs/requirements.md)
- Build plan, database schema and routes: [`docs/mvp.md`](docs/mvp.md)
- Rules for AI coding tools: [`AGENTS.md`](AGENTS.md)

## Tech stack

- Frontend: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- Backend: Next.js server components and route handlers
- Database and auth: Supabase (Postgres, row-level security, magic-link email for staff, anonymous sign-in + class code + PIN for students)
- APIs / services: aggregate read API and Pyodide (Python in the browser). Socratic AI hints are planned.
- Hosting: Vercel

## Run it locally

You need **Node 22 LTS** (20.9+ works) and **Git**. The GitHub CLI is optional for contributors.

```bash
git clone https://github.com/2026-Arizona-Opportunity-Hack/WTHelly-CodinginColor.git
cd WTHelly-CodinginColor
npm ci
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev                  # http://localhost:3000
```

Fill in `.env.local` (it is gitignored; never commit it):

| Variable | Where to find it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys / Data API → Project URL | Safe in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys → anon / publishable key | Safe in the browser; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → service_role / secret key | **Server only.** Bypasses all security |
| `OPENAI_BASE_URL` | `https://ai.ohack.dev/v1` | Needed for AI hints (later) |
| `OPENAI_API_KEY` | OHack team card | **Server only** |

Teammates: get the values from a teammate by DM, never in a channel, issue or commit. Restart `npm run dev` after changing `.env.local`.

Other commands: `npm run build` (production build), `npm run lint`.

### Supabase setup for a new deployment

1. Create a Supabase project. In its SQL editor, run `supabase/migrations/0001_schema.sql` through `0005_service_role_grants.sql` **in order**, then `supabase/seed.sql`. Run `supabase/seed_demo.sql` only when you want synthetic demo data.
2. In **Authentication → Providers**, enable **Allow anonymous sign-ins** and the **Email** provider. Set up a custom SMTP sender for staff magic links; Supabase's built-in sender is rate-limited.
3. In **Authentication → URL Configuration**, set the **Site URL** to the deployed site. Add redirect URLs for the live site, Vercel previews (`https://*-<team>.vercel.app/**`) and local development (`http://localhost:3000/**`). Replace `<team>` with your Vercel team slug.
4. Put the Supabase URL, publishable/anon key and service-role key in the deployment's environment settings using the variable names above. Keep the service-role key server-only.
5. Create the first admin Auth user and `profiles` row as described below. Staff need an existing profile to sign in.

Supabase's **Automatically expose new tables** setting is off for this project. Any future table needs both row-level security policies and the required grants; see [`AGENTS.md`](AGENTS.md).

### Staff sign-in (one-time Supabase setup)

Staff sign in at `/login` with a magic link. Only emails that already exist in Supabase Auth **and** have a `profiles` row can get in; nobody can sign themselves up.

1. Supabase → Authentication → URL Configuration: set **Site URL** to the deployed URL and add `http://localhost:3000/auth/callback` and `https://<your-vercel-app>/auth/callback` to **Redirect URLs**.
2. Add a staff user: Authentication → Users → **Add user → Create new user** with their email and **Auto confirm** checked (no email is sent). Magic links need custom SMTP (Authentication → Emails → SMTP Settings); Supabase's built-in sender allows only a few emails per hour.
3. Give them a profile and role in the SQL editor (the first admin is made this way; later, admins invite from the app — AUTH-4):

   ```sql
   insert into profiles (id, full_name, role)
   select id, 'Your Name', 'admin' from auth.users where email = 'you@example.org'
   on conflict (id) do update set role = excluded.role;
   ```

After sign-in, admins land on `/admin`, instructors on `/instructor` and reviewers on `/review`. A signed-in user without a profile, or with the wrong role for a page, gets the "no access" page with HTTP 403 (`proxy.ts` checks first, then each staff layout checks again on the server).

### Python runner demo

After starting `npm run dev`, open [http://localhost:3000/demo/python-runner](http://localhost:3000/demo/python-runner) and press **Run code**. The starter prints `1`, `2`, `3`. Pyodide loads from jsDelivr on the first run, so the browser needs internet access. Stop, reset and a five-second timeout are available. The activity-player preview also includes Python practice. In a student code activity, Run executes locally and Submit saves `{ code }` through `/api/submissions`; the server currently marks code complete without grading tests.

### Digital worksheets demo

After starting `npm run dev`, open [http://localhost:3000/demo/worksheets](http://localhost:3000/demo/worksheets) and try the multiple-choice, short-answer, long-answer and code-entry questions. The live answer preview shows the data received through `onChange`; answers are not saved or submitted.

## Security and student privacy

- Student records use minimal personal data: display name and school/class information, without student email accounts.
- PINs are stored as bcrypt hashes and locked for 10 minutes after five failed attempts. Raw PINs stay out of client-readable database rows.
- Activity and assessment answer keys are removed before content reaches the browser. Scoring and progression decisions run on the server.
- Database tables use row-level security and explicit grants. The aggregate read API stores key hashes with SHA-256 and does not return student-level data.
- The team workflow calls for a human review before each pull request is merged.

## Known limitations and what's next

- Anyone with a class code can claim an unclaimed student name by choosing its first PIN. Consider teacher-issued starter PINs or teacher approval for new joins.
- Cohorts are currently created in Supabase; add an admin page for this.
- Add staff invitations in the app (AUTH-4), and use CIC's own SMTP sender before go-live.
- Add student preview, new lessons and more activity types to the module editor (CNT-7).
- Build Socratic AI hints and log concepts students struggle with (AI-1–4).
- Add a concept mastery view per class (DSH-5).
- Supabase's default anonymous sign-in limit is about 30 per hour per network. Raise the limit or add CAPTCHA before using the app with full classrooms.

## How we work (team rules)

**Branches**
- Never commit to `main`. Start every task from an up-to-date `main`:
  `git checkout main && git pull && git checkout -b cls-2-roster-import`
- Delete your branch after its PR is merged.

**Commits**
- Commit whenever something works. The message says *why*: `Strip answers server-side so students can't read them`, not `update files`.
- Run `git status` before `git add .`. Never commit `.env.local` or keys (the repo's hook blocks most of it).

**Pull requests**
- One change per PR: one build step or one requirement ID from `docs/requirements.md`, under 400 changed lines.
- Title: imperative, under 72 characters, with the ID: `Add roster CSV import (CLS-2)`.
- Description in the template order: what changed, why, how to test, screenshot for UI; end with `Closes #<issue>`.
- One teammate looks before merging. Merge small PRs fast; everyone pulls `main` after each merge. Never force-push.

**Issues**
- One GitHub issue per task, closed by its PR. That's how judges see who did what.

**Database (one shared Supabase project)**
- Schema changes go in a **new** file in `supabase/migrations/`; post in #wthelly before pushing one.
- Every new table needs RLS policies **and** grants ("Automatically expose new tables" is off).
- Never auto-create profiles on sign-up: anonymous students are users too. Staff profiles come from admin invites.

**AI coding tools**
- Claude Code, Copilot and others read `AGENTS.md` and `docs/`. Point them at requirement IDs.
- Review every change yourself before committing. To stop Claude Code from committing, pushing or merging, create `.claude/settings.local.json` with deny rules for `git commit`, `git push`, `git merge` and `gh pr merge`, and keep it out of git with `.git/info/exclude`.

## Links

- Live site: [wthelly-codingincolor.vercel.app](https://wthelly-codingincolor.vercel.app)
- Demo video: coming at 1:30 PM MST on Nov 15, 2026
- Read API: [`docs/api.md`](docs/api.md)
- Design / docs: [`docs/requirements.md`](docs/requirements.md), [`docs/mvp.md`](docs/mvp.md)

## After the hackathon

Winning teams finish the project with the nonprofit — the [Definition of Done](https://www.ohack.dev/about/completion) (deployed, nonprofit sign-off, docs, open source) is tracked on your team page. Keep the repo public and the README honest; recruiters do read these.

Need a hand this weekend? [#ask-a-mentor](https://opportunity-hack.slack.com/archives/C01E5CGDQ74) on Slack, or ask in [#wthelly](https://opportunity-hack.slack.com/app_redirect?channel=wthelly) and a mentor will drop in.
