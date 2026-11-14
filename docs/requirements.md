# CIC Curriculum Platform — Requirements

Nov 14, 2026 · @Advait Kankati

## Purpose and conventions

This document is the build contract for Coding in Color's curriculum platform: every requirement has an ID, a priority and a testable acceptance criterion.

- **Source:** Opportunity Hack Fall 2026 brief, Problem 1, and our scope doc.
- **Priorities:** **P0** = must work in the Sunday 2:00 PM demo. **P1** = committed extra. **P2** = stretch, only if P0 and P1 are done.
- **IDs:** `AUTH-`, `CLS-`, `CNT-`, `STU-`, `ASM-`, `PRG-`, `DSH-`, `API-`, `RUN-`, `AI-`. Reference them in commits and PRs.
- **"Must"** means required for the priority listed; **"should"** is preferred but can be cut.

**Glossary**

| Term | Meaning |
| --- | --- |
| Module | A unit of learning on one concept (e.g. "Loops"), with a pretest, lessons and a post-test |
| Lesson | An ordered group of activities inside a module |
| Activity | One step a student completes: video, check question, worksheet, exit question or code exercise |
| Class | A group of students taught by one instructor at one school |
| Cohort | A program run at a school in a term (e.g. "AI Academy – Maryvale – Fall 2026"); a cohort has one or more classes |
| Program | CIC's offering: AI Academy, K12, Summer Camp, Day of Compute |
| Learning gain | Post-test score minus pretest score, in percentage points |

## Roles and permissions

Permissions must be enforced by Postgres row-level security; hiding a button is not enough.

| Action | Student | Instructor | Admin | Reviewer |
| --- | --- | --- | --- | --- |
| View published modules | Assigned only | All | All | All |
| Create or edit modules | No | No | Yes | No |
| Create a class, import roster | No | Own classes | Any class | No |
| Assign modules to a class | No | Own classes | Any class | No |
| Submit activities and tests | Own | No | No | No |
| View student progress and scores | Own | Own classes | All | No |
| View learning gain reports | No | Own classes | All | No |
| Manage users and roles | No | No | Yes | No |
| Create or revoke API keys | No | No | Yes | No |

One user has exactly one role. Only an admin can change a role.

## Accounts, roles and classes

Staff sign in by email magic link; students join with a class code and never need an email.

| ID | Pri | Requirement | Acceptance criterion |
| --- | --- | --- | --- |
| AUTH-1 | P0 | Instructors, admins and reviewers sign in by email magic link | A new email receives a link; clicking it signs in and lands on the role's home page |
| AUTH-2 | P0 | Students join a class with a 6-character class code and pick their name from the roster | No email or password asked; the student lands on their next activity |
| AUTH-3 | P0 | A returning student re-enters with class code + name + a 4-digit PIN they set on first join | Wrong PIN is rejected; correct PIN restores progress on any device |
| AUTH-4 | P0 | Admin can invite a user by email with a role | Invited user signs in with that role |
| AUTH-5 | P0 | Every page checks role on the server | A student URL-hacking to /instructor gets 403 |
| CLS-1 | P0 | Instructor creates a class: name, school, program, cohort | Class appears on their dashboard with a class code |
| CLS-2 | P0 | Instructor imports a roster CSV with columns `name` (required), `school`, `class` | Preview shows rows; invalid rows flagged; confirm creates students; 25 rows import in under 5 s |
| CLS-3 | P0 | Instructor adds or removes a single student by hand | Change shows on the roster immediately |
| CLS-4 | P0 | Instructor assigns one or more published modules to a class, in order | Students see assigned modules in that order |
| CLS-5 | P0 | Instructor can copy the class join link and code | One click copies a link that pre-fills the code |
| CLS-6 | P1 | Admin sees and edits any class | Admin view lists all classes across schools |

## Content model and authoring

Content is data, not code: admins publish modules through a form-based editor with no deploy.

| ID | Pri | Requirement | Acceptance criterion |
| --- | --- | --- | --- |
| CNT-1 | P0 | Hierarchy: module → lesson → activity, each with an order field | Reordering in the editor changes the order students see |
| CNT-2 | P0 | Activity types: `video` (YouTube/Vimeo URL or slides URL), `check` (multiple choice or short answer), `worksheet` (list of questions), `exit` (one question), `code` (prompt, starter code, test cases) | Each type has its own editor form and student renderer |
| CNT-3 | P0 | Default module template: pretest → lesson with video, check, worksheet → exit question → post-test | "New module" pre-fills this structure |
| CNT-4 | P0 | Worksheet question types: multiple choice, short text, long text, code | A worksheet mixing all four renders and submits |
| CNT-5 | P0 | Each question can have a correct answer for auto-scoring (multiple choice, code tests); open text is marked complete on submit | Score saves for auto-scored items only |
| CNT-6 | P0 | Module states: draft, published. Students and reviewers see published only | Draft module is invisible to students |
| CNT-7 | P0 | Admin can preview a module as a student | Preview renders without saving submissions |
| CNT-8 | P0 | Each module has concept tags (e.g. `loops`, `variables`) | Tags show on the module and are available to reports |
| CNT-9 | P1 | Editing a published module does not erase existing submissions | Existing scores still display after an edit |
| CNT-10 | P2 | Upload a worksheet PDF or image; AI drafts a module for review | Draft module created; nothing publishes without an admin |

## Student flow, assessments and progress

A student always sees one clear "next" step, like a code.org lesson.

| ID | Pri | Requirement | Acceptance criterion |
| --- | --- | --- | --- |
| STU-1 | P0 | Student home shows assigned modules with status: locked, available, in progress, complete | Status matches the unlock rule (Business rules) |
| STU-2 | P0 | A "Continue" button opens the student's next incomplete activity | From home, one click reaches the right activity |
| STU-3 | P0 | Activity player shows one activity at a time with Back, Submit and Next, plus a progress bar for the module | Keyboard-only user can complete a module |
| STU-4 | P0 | Submit saves the answer, score and time on task, then shows feedback (correct / incorrect for auto-scored items) | Submission row exists after Submit; refresh keeps it |
| STU-5 | P0 | A late-joining student starts at the first module where they have not passed the unlock rule | Student who joins in week 3 with no work lands on module 1 pretest, not module 3 |
| STU-6 | P0 | Student sees their own progress: modules complete, scores | Shows only their own data |
| STU-7 | P0 | Student pages work on a 375 px wide phone screen and a Chromebook | No horizontal scroll on student pages |
| ASM-1 | P0 | Each module has one pretest and one post-test with the same number of questions | Editor blocks publishing if counts differ |
| ASM-2 | P0 | Pretest is required before the first lesson; post-test unlocks after the exit question | Lessons are locked until the pretest is submitted |
| ASM-3 | P0 | Each test is taken once; the score is stored as a percentage | A second attempt is blocked; score shows 0–100 |
| PRG-1 | P0 | Record per activity: started\_at, submitted\_at, time\_spent\_sec, score, completed | Fields populated for every submission |
| PRG-2 | P0 | Track last activity time per student per class | Used by the "stuck" rule |

## Dashboard, read API, code runner and AI hints

Instructors see who needs help at a glance; CIC's own dashboard reads aggregated numbers through a keyed API.

| ID | Pri | Requirement | Acceptance criterion |
| --- | --- | --- | --- |
| DSH-1 | P0 | Class dashboard: roster table with each student's current module, % complete, pre score, post score, gain, last active | Values match the database for seed data |
| DSH-2 | P0 | "Stuck" and "Not started" lists at the top of the class dashboard | Lists follow the Business rules definitions |
| DSH-3 | P0 | Class summary per module: % complete, average pre, average post, average gain | Averages exclude students missing either test |
| DSH-4 | P0 | Admin overview: every cohort with completion % and average gain, filterable by program and school | Filter changes the totals |
| DSH-5 | P1 | Concept mastery: % of class answering each concept tag correctly | Shows e.g. "loops: 42%" |
| API-1 | P0 | `GET /api/v1/cohorts` returns per cohort: id, name, program, school, students, completion\_pct, avg\_pre, avg\_post, avg\_gain | JSON matches the admin overview |
| API-2 | P0 | `GET /api/v1/classes/{id}/summary` returns per-module aggregates | No student names in any response |
| API-3 | P0 | `GET /api/v1/programs` returns totals per program | Sum across programs equals total students |
| API-4 | P0 | Auth by `Authorization: Bearer <key>`; keys created and revoked by admins; stored as SHA-256 hashes | Missing or revoked key returns 401 |
| API-5 | P0 | Optional `from` and `to` query params (ISO dates) on every endpoint | Filters by submission date |
| API-6 | P0 | API documented in README with curl examples and an OpenAPI file | CIC can call it without asking us |
| RUN-1 | P1 | `code` activity runs Python in the browser with Pyodide in a web worker | `print("hi")` outputs in under 1 s after first load |
| RUN-2 | P1 | Hidden test cases run on Submit; score = tests passed / total | Score saves to the submission |
| RUN-3 | P1 | Infinite loops are stopped after 5 s with a friendly message | Page stays responsive |
| AI-1 | P1 | "Hint" button on check, worksheet and code activities calls an LLM through a server route | API key never reaches the browser |
| AI-2 | P1 | Hints are Socratic: a guiding question, never the answer or full code | 10 test prompts produce no direct answers |
| AI-3 | P1 | Each hint is logged: student, activity, concept tag, timestamp | Instructor sees hint counts per concept |
| AI-4 | P1 | Rate limit: 5 hints per student per activity | 6th request shows a limit message |

## Business rules and formulas

These definitions are the single source of truth for unlocking, reporting and the API.

- **Activity complete:** a submission exists for it. Auto-scored items do not need to be correct to count.
- **Module complete:** pretest, every required activity, exit question and post-test all submitted.
- **Unlock:** module 1 of a class's assignment list is always available. Module N+1 unlocks when module N is complete. Inside a module, activities unlock in order.
- **Current module:** the first assigned module that is not complete.
- **Stuck:** has started the current module, and no submission for 3 or more days. The 3-day threshold should be a setting.
- **Not started:** enrolled, with no submissions at all.
- **Test score:** correct answers / total questions × 100, rounded to 1 decimal.
- **Learning gain (student, module):** post score − pre score, in percentage points. Null if either test is missing.
- **Learning gain (class, cohort, program):** mean of the non-null student gains in that group. Also report the count of students included.
- **Completion % (class):** completed module-assignments / (students × assigned modules) × 100.

```latex
\text{gain}_{student} = \text{post} - \text{pre}, \qquad \text{gain}_{class} = \frac{1}{n}\sum_{i=1}^{n} \text{gain}_i
```

## Non-functional requirements

The brief judges these directly, so they are P0 unless marked.

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-1 | Privacy | Students are minors: store only name, school, class and a hashed PIN. No student email, birthdate, photo or address |
| NFR-2 | Security | RLS on every table; service-role key and LLM key server-side only; API keys hashed; no shared passwords |
| NFR-3 | Accessibility | Lighthouse accessibility ≥ 95 on student home, activity player, class dashboard and module editor; full keyboard navigation; visible focus states |
| NFR-4 | Performance | Student pages load in under 3 s on a school Chromebook; Pyodide loads only on code activities |
| NFR-5 | Devices | Student pages responsive down to 375 px; staff pages work from 1024 px |
| NFR-6 | Cost | Runs within $20/month: Vercel + Supabase free tiers plus LLM usage |
| NFR-7 | Usability | An instructor creates a class, imports a roster and assigns a module in under 10 minutes with no training |
| NFR-8 | Handoff | README covers local setup, deploy, environment variables, creating the first admin, authoring a module and issuing an API key |
| NFR-9 | Data | A seed script creates 2 modules, 2 classes and 25 synthetic students with varied progress |

## Acceptance test checklist

Run this end to end on the deployed site before the Sunday 11:00 AM freeze; every box must be ticked.

- [ ] Admin creates a module from the template, previews it and publishes it
- [ ] Instructor signs in, creates a class, imports a 25-row CSV and assigns 2 modules in under 10 minutes (timed)
- [ ] Student joins with class code, picks name, sets PIN, takes pretest
- [ ] Student completes video, check, worksheet and exit question; post-test unlocks; module 2 unlocks after post-test
- [ ] Student signs back in on another device with code + name + PIN and resumes at the same activity
- [ ] A late-joining student lands on module 1 pretest
- [ ] Class dashboard shows correct stuck and not-started lists for seed data
- [ ] Learning gain per student and per class matches a hand calculation on 3 students
- [ ] Student cannot open /instructor; instructor cannot see another instructor's class (both return 403)
- [ ] Reviewer can browse modules and sees no student data
- [ ] `curl` with a valid key returns cohort JSON; revoked key returns 401
- [ ] Lighthouse accessibility ≥ 95 on the four key pages
- [ ] (P1) Python code runs and auto-grades; infinite loop stops after 5 s
- [ ] (P1) Hint asks a question and does not give the answer in 10 test prompts
