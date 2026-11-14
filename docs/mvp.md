# CIC Curriculum Platform — MVP Build Plan

Nov 14, 2026 · @Advait Kankati

## MVP goal

The MVP is the thinnest working loop: an instructor sets up a class, a student completes one module end to end, and the instructor sees the result with learning gain.

You build the base (repo, Supabase, schema, auth, one hard-coded flow) by about Sat 8:00 PM. Claude Code then extends it feature by feature using the requirements doc IDs.

**The base is done when:**

- [ ] Deployed on Vercel and connected to Supabase
- [ ] Schema migrated with RLS on, and the seed script loads 1 module, 1 class and 10 students
- [ ] A staff user signs in by magic link; a student joins by class code + name + PIN
- [ ] A student completes pretest → video → check → worksheet → exit → post-test for the seeded module
- [ ] The class dashboard shows each student's progress and learning gain from real rows

## In the base vs. after

The base proves the data model and the core loop; everything else is layered on by Claude Code.

| Area | In the base (you) | After the base (Claude Code) |
| --- | --- | --- |
| Auth | Magic link for staff, class code + name + PIN for students, role on profile | Admin invites, role changes (AUTH-4) |
| Classes | Seeded class; simple "create class" form | Roster CSV import (CLS-2), assign modules UI (CLS-4) |
| Content | Seeded module as JSON; student renderer for video, check, worksheet, exit | Module editor UI (CNT-1 to CNT-7), reviewer view |
| Student flow | Activity player, submit, unlock in order, pre/post tests | Student progress page, late-joiner polish |
| Reporting | `learning_gain` and `student_progress` views; basic class dashboard table | Stuck / not-started lists, admin overview, concept mastery |
| API | — | Read API + key management (API-1 to API-6) |
| P1 | — | Pyodide runner (RUN-*), Socratic hints (AI-*) |
| Quality | RLS on all tables | Lighthouse pass, README, full seed data |

## Stack, repo and setup

Next.js App Router + TypeScript + Tailwind + shadcn/ui on Vercel, with Supabase for Postgres and auth.

**Student sign-in design:** students have no email. The browser signs in with Supabase **anonymous auth**; a server route checks class code + name + PIN and links that anonymous user to the student row in `student_devices`. RLS then resolves the student through a `current_student_id()` function. This works across devices and keeps student data minimal.

**Repo layout**

```text
cic-curriculum/
  app/
    (staff)/login/            magic-link sign-in
    (staff)/instructor/       class list, class dashboard
    (staff)/admin/            overview, modules (editor later), API keys (later)
    (student)/join/           class code + name + PIN
    (student)/learn/          student home
    (student)/learn/[moduleId]/[activityId]/   activity player
    api/student/join/route.ts     verifies PIN, links device
    api/submissions/route.ts      saves a submission
    api/v1/...                    read API (later)
  components/activities/      VideoActivity, CheckActivity, WorksheetActivity, ExitActivity, CodeActivity (later)
  lib/supabase/               server.ts, client.ts, admin.ts (service role, server only)
  lib/rules.ts                unlock, current module, stuck: one place
  supabase/migrations/        0001_schema.sql, 0002_rls.sql, 0003_views.sql
  supabase/seed.sql           1 module, 1 class, 10 students
  CLAUDE.md                   instructions for Claude Code
  README.md
```

**Setup steps**

1. `npx create-next-app@latest cic-curriculum --ts --tailwind --app` and `npx shadcn@latest init`.
2. Create a Supabase project; enable Email (magic link) and Anonymous sign-ins under Authentication → Providers.
3. `npm i @supabase/supabase-js @supabase/ssr zod bcryptjs papaparse`.
4. Add `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and later `OPENAI_BASE_URL=https://ai.ohack.dev/v1` and `OPENAI_API_KEY` (OHack AI gateway key from the team card).
5. Run the migrations and seed with the Supabase CLI (`supabase db push`) or paste them into the SQL editor.
6. Push to GitHub, import into Vercel, add the same env vars, deploy.

## Database schema

Three migration files define the whole MVP; staff are `auth.users` with a profile, and students are plain rows linked to anonymous sessions.

**Rule that shapes the RLS:** students never read `activities` or `assessments` directly, because those rows contain answers. Server components load content with the service role and strip `answer` fields. Submissions are also written by a server route, which computes the score.

**0001\_schema.sql**

```sql
create extension if not exists pgcrypto;

create type user_role as enum ('instructor', 'admin', 'reviewer');
create type activity_type as enum ('video', 'check', 'worksheet', 'exit', 'code');
create type assessment_kind as enum ('pre', 'post');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role user_role not null default 'instructor',
  school text,
  created_at timestamptz default now()
);

create table cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program text not null check (program in ('AI Academy', 'K12', 'Summer Camp', 'Day of Compute')),
  school text not null,
  term text not null
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cohort_id uuid references cohorts on delete set null,
  instructor_id uuid not null references profiles,
  join_code text not null unique,
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes on delete cascade,
  display_name text not null,
  school text,
  pin_hash text,                 -- bcrypt, set on first join
  joined_at timestamptz,
  unique (class_id, display_name)
);

create table student_devices (
  auth_user_id uuid primary key references auth.users on delete cascade,
  student_id uuid not null references students on delete cascade,
  linked_at timestamptz default now()
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  concept_tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references profiles,
  updated_at timestamptz default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules on delete cascade,
  title text not null,
  position int not null
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons on delete cascade,
  type activity_type not null,
  title text not null,
  content jsonb not null,        -- shape per type, validated by zod in lib/content-schema.ts
  position int not null,
  required boolean not null default true
);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules on delete cascade,
  kind assessment_kind not null,
  questions jsonb not null,      -- [{id, prompt, options, answer}]
  unique (module_id, kind)
);

create table assignments (
  class_id uuid references classes on delete cascade,
  module_id uuid references modules on delete cascade,
  position int not null,
  assigned_at timestamptz default now(),
  primary key (class_id, module_id)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  activity_id uuid not null references activities on delete cascade,
  answer jsonb not null,
  score numeric(5,1),            -- null when not auto-scored
  started_at timestamptz,
  submitted_at timestamptz not null default now(),
  time_spent_sec int,
  unique (student_id, activity_id)
);

create table assessment_results (
  student_id uuid references students on delete cascade,
  assessment_id uuid references assessments on delete cascade,
  answers jsonb not null,
  score numeric(5,1) not null,
  taken_at timestamptz default now(),
  primary key (student_id, assessment_id)
);

-- used after the base
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text not null unique, -- sha256 of the key
  created_by uuid references profiles,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create table hint_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students on delete cascade,
  activity_id uuid references activities on delete cascade,
  concept_tag text,
  created_at timestamptz default now()
);
```

**0002\_rls.sql**

```sql
create or replace function my_role() returns user_role
  language sql stable security definer set search_path = public
  as $$ select role from profiles where id = auth.uid() $$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce(my_role() = 'admin', false) $$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public
  as $$ select my_role() is not null $$;

create or replace function current_student_id() returns uuid
  language sql stable security definer set search_path = public
  as $$ select student_id from student_devices where auth_user_id = auth.uid() $$;

create or replace function teaches(c uuid) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from classes where id = c and instructor_id = auth.uid()) $$;

alter table profiles enable row level security;
alter table cohorts enable row level security;
alter table classes enable row level security;
alter table students enable row level security;
alter table student_devices enable row level security;   -- no policies: service role only
alter table modules enable row level security;
alter table lessons enable row level security;
alter table activities enable row level security;
alter table assessments enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table assessment_results enable row level security;
alter table api_keys enable row level security;
alter table hint_logs enable row level security;

-- profiles
create policy profiles_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_admin on profiles for all using (is_admin()) with check (is_admin());

-- cohorts: staff read, admin write
create policy cohorts_read on cohorts for select using (is_staff());
create policy cohorts_admin on cohorts for all using (is_admin()) with check (is_admin());

-- classes
create policy classes_read on classes for select
  using (instructor_id = auth.uid() or is_admin() or id = (select class_id from students where id = current_student_id()));
create policy classes_insert on classes for insert with check (instructor_id = auth.uid() or is_admin());
create policy classes_update on classes for update using (instructor_id = auth.uid() or is_admin());

-- students
create policy students_read on students for select
  using (teaches(class_id) or is_admin() or id = current_student_id());
create policy students_write on students for all
  using (teaches(class_id) or is_admin()) with check (teaches(class_id) or is_admin());

-- content: staff only (students get stripped content via server)
create policy modules_read on modules for select using (is_staff() and (status = 'published' or is_admin()));
create policy modules_admin on modules for all using (is_admin()) with check (is_admin());
create policy lessons_read on lessons for select using (is_staff());
create policy lessons_admin on lessons for all using (is_admin()) with check (is_admin());
create policy activities_read on activities for select using (is_staff());
create policy activities_admin on activities for all using (is_admin()) with check (is_admin());
create policy assessments_read on assessments for select using (is_admin() or my_role() = 'instructor');
create policy assessments_admin on assessments for all using (is_admin()) with check (is_admin());

-- assignments
create policy assignments_read on assignments for select
  using (teaches(class_id) or is_admin() or class_id = (select class_id from students where id = current_student_id()));
create policy assignments_write on assignments for all
  using (teaches(class_id) or is_admin()) with check (teaches(class_id) or is_admin());

-- submissions and results: read only; writes go through server routes
create policy submissions_read on submissions for select
  using (student_id = current_student_id() or is_admin()
         or teaches((select class_id from students where id = student_id)));
create policy results_read on assessment_results for select
  using (student_id = current_student_id() or is_admin()
         or teaches((select class_id from students where id = student_id)));

-- admin only
create policy api_keys_admin on api_keys for all using (is_admin()) with check (is_admin());
create policy hints_read on hint_logs for select
  using (is_admin() or teaches((select class_id from students where id = student_id)));
```

**Grants (add at the end of 0002\_rls.sql).** The Supabase project has "Automatically expose new tables" off, so access is granted explicitly; RLS still decides which rows. Every future table needs its own grant line in its migration.

```sql
grant usage on schema public to anon, authenticated;

grant select on all tables in schema public to authenticated;   -- includes the views

grant insert, update, delete on
  profiles, cohorts, classes, students, assignments,
  modules, lessons, activities, assessments, api_keys
to authenticated;

-- student_devices, submissions, assessment_results, hint_logs:
-- written only by server routes using the service role, so no write grants.
```

**No profile trigger.** Anonymous students are rows in `auth.users`, so never auto-create a `profiles` row on sign-up (with the `instructor` default, every student would become an instructor). Staff profiles are created only by admin invite; insert the first admin by hand.

**0003\_views.sql**

```sql
create view learning_gain with (security_invoker = true) as
select s.id as student_id, s.class_id, a.module_id,
  max(r.score) filter (where a.kind = 'pre')  as pre_score,
  max(r.score) filter (where a.kind = 'post') as post_score,
  max(r.score) filter (where a.kind = 'post') - max(r.score) filter (where a.kind = 'pre') as gain
from students s
join assessment_results r on r.student_id = s.id
join assessments a on a.id = r.assessment_id
group by s.id, s.class_id, a.module_id;

create view class_module_summary with (security_invoker = true) as
select class_id, module_id,
  count(gain) as students_with_both,
  round(avg(pre_score)  filter (where gain is not null), 1) as avg_pre,
  round(avg(post_score) filter (where gain is not null), 1) as avg_post,
  round(avg(gain), 1) as avg_gain
from learning_gain
group by class_id, module_id;

create view student_activity as
select s.id as student_id, s.class_id, s.display_name,
  count(sub.id) as activities_done,
  max(sub.submitted_at) as last_active
from students s
left join submissions sub on sub.student_id = s.id
group by s.id;
alter view student_activity set (security_invoker = true);
```

**seed.sql** (write by hand or have Claude Code generate it): 1 cohort (AI Academy, Maryvale, Fall 2026), 1 instructor profile, 1 class with join code `LOOPS1`, 10 students, and a published "Intro to Loops" module with a 5-question pretest and post-test plus one lesson containing a video, check, worksheet and exit activity.

## Pages and routes

Eight pages and two server routes make up the base; later items are listed so the structure doesn't change.

| Route | Who | In base | Purpose |
| --- | --- | --- | --- |
| `/login` | Staff | Yes | Magic-link sign-in |
| `/instructor` | Instructor | Yes | List of my classes + "New class" form |
| `/instructor/classes/[id]` | Instructor | Yes | Roster table: current module, % complete, pre, post, gain, last active |
| `/admin` | Admin | Yes (basic) | All classes; later cohort overview and filters |
| `/admin/modules` | Admin | Later | Module list and editor |
| `/admin/api-keys` | Admin | Later | Create and revoke API keys |
| `/review` | Reviewer | Later | Read-only module browser |
| `/join` | Student | Yes | Class code → pick name → set or enter PIN |
| `/learn` | Student | Yes | Assigned modules with lock status + Continue button |
| `/learn/[moduleId]/pretest` and `/posttest` | Student | Yes | Take the test once |
| `/learn/[moduleId]/[activityId]` | Student | Yes | Activity player |
| `POST /api/student/join` | Student | Yes | Verify code + name + PIN, insert `student_devices` row |
| `POST /api/submissions` | Student | Yes | Validate, score, upsert submission or test result |
| `POST /api/hints` | Student | Later | Socratic hint via LLM, logs to `hint_logs` |
| `GET /api/v1/*` | API key | Later | Read API |

**Activity `content` JSON shapes** (validate with zod in `lib/content-schema.ts`):

```json
{ "type": "video",     "url": "https://www.youtube.com/embed/...", "notes": "optional text" }
{ "type": "check",     "prompt": "...", "options": ["a","b","c"], "answer": 1 }
{ "type": "worksheet", "questions": [{ "id": "q1", "kind": "mcq|short|long|code", "prompt": "...", "options": [], "answer": null }] }
{ "type": "exit",      "prompt": "...", "kind": "mcq|short", "options": [], "answer": null }
{ "type": "code",      "prompt": "...", "starter": "...", "tests": [{ "input": "", "expected": "" }] }
```

## Build order

Build the base in this order; each step ends with something you can click on the deployed site.

1. **Scaffold and deploy (30 min).** Next.js app, Supabase clients in `lib/supabase/`, empty pages, deployed to Vercel with env vars.
2. **Schema (45 min).** Run 0001–0003, then the seed. Check in the Supabase table editor that the module, class and students exist.
3. **Staff auth (45 min).** `/login` magic link, middleware that loads the profile and redirects by role. Make yourself an admin with one SQL update.
4. **Student join (1 h).** `/join` page and `POST /api/student/join`: anonymous sign-in, find class by code, list names, bcrypt the PIN on first join, insert `student_devices`.
5. **Content loader (30 min).** Server function that loads a module with the service role and strips every `answer` field.
6. **Activity player (2 h).** Renderers for video, check, worksheet and exit; Back / Submit / Next; progress bar.
7. **Submissions and tests (1 h).** `POST /api/submissions` scores server-side and upserts; pretest and post-test pages; `lib/rules.ts` for unlocking.
8. **Class dashboard (1 h).** Roster table from `student_activity` and `learning_gain`, plus current module from `lib/rules.ts`.
9. **Smoke test.** Run the five "base is done" checks at the top of this doc, then hand the repo to Claude Code.

## Claude Code handoff

Export the requirements doc as Markdown into `docs/requirements.md`, append the rules below to AGENTS.md (the hackathon repo's CLAUDE.md already imports it), then give Claude Code one prompt per feature.

**CLAUDE.md**

```markdown
# CIC Curriculum Platform

Link-based curriculum platform for Coding in Color (Opportunity Hack Fall 2026, Problem 1).
Requirements with IDs: docs/requirements.md. Build plan: docs/mvp.md.

## Stack
Next.js App Router, TypeScript, Tailwind, shadcn/ui, Supabase (Postgres, Auth, RLS), Vercel.

## Rules
- Students are minors: store only display_name, school, class, pin_hash. Never add student PII.
- Every table has RLS. New tables need policies in a new migration in supabase/migrations/.
- Students never read activities or assessments directly. Load content server-side with
  lib/supabase/admin.ts and strip `answer` fields before sending to the client.
- Scoring happens in server routes, never in the browser.
- SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY are server-only. Never import lib/supabase/admin.ts in a client component.
- Business rules (unlock, current module, stuck, learning gain) live only in lib/rules.ts and the SQL views.
- Accessibility: semantic HTML, labels on every input, visible focus, keyboard navigable. Target Lighthouse a11y >= 95.
- Student pages must work at 375px wide.
- Reference requirement IDs (e.g. CLS-2) in commit messages.

## Commands
npm run dev | npm run build | npm run lint | supabase db push

## Done means
The requirement's acceptance criterion in docs/requirements.md passes on the deployed site.
```

**Prompts, in order** (one at a time; test each before the next):

1. "Implement CLS-2 and CLS-3: roster CSV import with preview and validation on `/instructor/classes/[id]`, using papaparse. Follow CLAUDE.md."
2. "Implement CLS-4 and CLS-5: assign and order modules for a class, and copy the join link."
3. "Implement DSH-2 and DSH-3: stuck and not-started lists and the per-module class summary, using rules in lib/rules.ts and the class\_module\_summary view."
4. "Implement CNT-1 to CNT-7: module editor at `/admin/modules` with the default template, per-type activity forms, draft/publish and student preview."
5. "Implement API-1 to API-6: read API under `/api/v1`, API key management at `/admin/api-keys`, OpenAPI file and README section."
6. "Implement the reviewer view at `/review` (read-only, published modules, no student data) and DSH-4 admin overview."
7. "Implement RUN-1 to RUN-3: `code` activity with Pyodide in a web worker, hidden tests on submit, 5 s timeout."
8. "Implement AI-1 to AI-4: Socratic hint route with rate limiting and hint\_logs; the hint must never contain the answer."
9. "Expand supabase/seed.sql to 2 modules, 2 classes and 25 students with varied progress (NFR-9), then fix every Lighthouse accessibility issue on the four key pages."
10. "Write README.md covering NFR-8."

After each prompt, run the matching items in the requirements doc's acceptance checklist.
