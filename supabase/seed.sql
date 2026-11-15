-- Seed data for the MVP base: 1 admin profile, 1 cohort, 1 class, 10 students,
-- 1 published module with pre/post tests and one lesson of 4 activities.
--
-- Prerequisite: akankati@asu.edu has already signed in once by magic link,
-- so the auth.users row exists. This script never creates auth users and
-- adds no sign-up trigger.
--
-- Safe to re-run: it deletes its own rows (fixed ids / join code) first.
-- Re-running wipes any submissions made by the seeded students.
-- All students are synthetic: first name + last initial only, no PINs.

do $$
declare
  v_admin   uuid;
  v_cohort  uuid := '00000000-0000-4000-8000-000000000001';
  v_class   uuid := '00000000-0000-4000-8000-000000000002';
  v_module  uuid := '00000000-0000-4000-8000-000000000003';
  v_lesson  uuid := '00000000-0000-4000-8000-000000000004';
begin
  -- 1. Admin: look up by email, fail loudly if they haven't signed in yet.
  select id into v_admin from auth.users where email = 'akankati@asu.edu';
  if v_admin is null then
    raise exception 'No auth user for akankati@asu.edu. Sign in once by magic link, then re-run the seed.';
  end if;

  insert into profiles (id, full_name, role, school)
  values (v_admin, 'Advait Kankati', 'admin', null)
  on conflict (id) do update set role = 'admin';

  -- 2. Clean out previous seed rows (cascades remove students, assignments,
  --    lessons, activities, assessments, submissions and results).
  delete from classes where id = v_class or join_code = 'LOOPS1';
  delete from modules where id = v_module;
  delete from cohorts where id = v_cohort;

  -- 3. Cohort and class.
  insert into cohorts (id, name, program, school, term)
  values (v_cohort, 'AI Academy – Maryvale – Fall 2026', 'AI Academy', 'Maryvale', 'Fall 2026');

  insert into classes (id, name, cohort_id, instructor_id, join_code)
  values (v_class, 'AI Academy – Maryvale', v_cohort, v_admin, 'LOOPS1');

  -- 4. Ten synthetic students, no PINs (set on first join).
  insert into students (class_id, display_name, school)
  select v_class, n, 'Maryvale'
  from unnest(array[
    'Maya R.', 'Jalen T.', 'Sofia M.', 'Andre W.', 'Aaliyah B.',
    'Diego L.', 'Imani K.', 'Marcus J.', 'Valeria G.', 'Tyrell H.'
  ]) as n;

  -- 5. Module.
  insert into modules (id, title, description, concept_tags, status, created_by)
  values (
    v_module,
    'Intro to Loops in Python',
    'Repeat code with for loops and range().',
    array['loops', 'range'],
    'published',
    v_admin
  );

  -- 6. Pretest and post-test: 5 MCQs each, same concepts. answer = index into options.
  insert into assessments (module_id, kind, questions) values
  (v_module, 'pre', $json$[
    {"id": "pre1", "prompt": "What does a for loop do?",
     "options": ["Runs a block of code once", "Repeats a block of code for each item in a sequence", "Stops the program", "Creates a new variable type"],
     "answer": 1},
    {"id": "pre2", "prompt": "Which numbers does range(3) produce?",
     "options": ["1, 2, 3", "0, 1, 2, 3", "0, 1, 2", "3, 2, 1"],
     "answer": 2},
    {"id": "pre3", "prompt": "How many times does this print \"hi\"?\nfor i in range(4):\n    print(\"hi\")",
     "options": ["3", "4", "5", "1"],
     "answer": 1},
    {"id": "pre4", "prompt": "Which numbers does range(2, 6) produce?",
     "options": ["2, 3, 4, 5", "2, 3, 4, 5, 6", "3, 4, 5, 6", "2, 6"],
     "answer": 0},
    {"id": "pre5", "prompt": "What tells Python which lines are inside the loop?",
     "options": ["Curly braces { }", "A semicolon at the end", "Indentation", "The word end"],
     "answer": 2}
  ]$json$::jsonb),
  (v_module, 'post', $json$[
    {"id": "post1", "prompt": "Why would you use a for loop?",
     "options": ["To repeat code without copying it many times", "To make code run only once", "To name a variable", "To end a program early"],
     "answer": 0},
    {"id": "post2", "prompt": "Which numbers does range(5) produce?",
     "options": ["1, 2, 3, 4, 5", "0, 1, 2, 3, 4", "0, 1, 2, 3, 4, 5", "5, 4, 3, 2, 1"],
     "answer": 1},
    {"id": "post3", "prompt": "What does this print?\nfor i in range(3):\n    print(i)",
     "options": ["1 2 3", "0 1 2 3", "3", "0 1 2"],
     "answer": 3},
    {"id": "post4", "prompt": "Which numbers does range(1, 4) produce?",
     "options": ["1, 2, 3, 4", "1, 2, 3", "0, 1, 2, 3", "2, 3, 4"],
     "answer": 1},
    {"id": "post5", "prompt": "In range(0, 10, 2), what does the 2 mean?",
     "options": ["Start at 2", "Stop at 2", "Repeat 2 times", "Count up by 2 each step"],
     "answer": 3}
  ]$json$::jsonb);

  -- 7. Lesson with 4 activities, in order.
  insert into lessons (id, module_id, title, position)
  values (v_lesson, v_module, 'For loops and range()', 1);

  insert into activities (lesson_id, type, title, content, position) values
  (v_lesson, 'video', 'Watch: Python for loops', $json$
    {"type": "video",
     "url": "https://www.youtube.com/embed/6iF8Xb7Z3wQ",
     "notes": "Watch how a for loop repeats code once for each item, and how range() makes a list of numbers to loop over."}
  $json$::jsonb, 1),
  (v_lesson, 'check', 'Quick check', $json$
    {"type": "check",
     "prompt": "How many times does the loop body run in: for i in range(5):",
     "options": ["4", "5", "6"],
     "answer": 1}
  $json$::jsonb, 2),
  (v_lesson, 'worksheet', 'Practice worksheet', $json$
    {"type": "worksheet",
     "questions": [
       {"id": "q1", "kind": "mcq",
        "prompt": "What is the last number printed by: for i in range(1, 6): print(i)",
        "options": ["4", "5", "6", "1"],
        "answer": 1},
       {"id": "q2", "kind": "short",
        "prompt": "In your own words, what does range(10) give you?",
        "options": [],
        "answer": null},
       {"id": "q3", "kind": "code",
        "prompt": "Write a for loop that prints the numbers 1 to 5, one per line.",
        "options": [],
        "answer": null}
     ]}
  $json$::jsonb, 3),
  (v_lesson, 'exit', 'Exit ticket', $json$
    {"type": "exit",
     "prompt": "Name one thing you could use a loop for in a program you'd want to build.",
     "kind": "short",
     "options": [],
     "answer": null}
  $json$::jsonb, 4);

  -- 8. Assign the module to the class.
  insert into assignments (class_id, module_id, position)
  values (v_class, v_module, 1);
end $$;
