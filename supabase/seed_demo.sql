-- Synthetic dashboard data for the seeded LOOPS1 class. Safe to re-run.
-- Run after seed.sql; all progress belongs to the ten synthetic seeded students.
with ranked_students as (
  select id, row_number() over (order by display_name) as rn
  from students
  where class_id = '00000000-0000-4000-8000-000000000002'
), test_rows as (
  select s.id as student_id, a.id as assessment_id, a.kind,
    case
      when a.kind = 'pre' then case when s.rn <= 2 then 60 + s.rn * 5 when s.rn <= 7 then 20 + s.rn * 5 else 0 end
      else case when s.rn = 1 then 90 when s.rn = 2 then 80 else 0 end
    end as score,
    case when a.kind = 'pre' then now() - interval '12 days'
         when s.rn = 1 then now() - interval '1 day'
         else now() - interval '10 days' end as taken_at
  from ranked_students s
  join assessments a on a.module_id = '00000000-0000-4000-8000-000000000003'
  where (a.kind = 'pre' and s.rn <= 7) or (a.kind = 'post' and s.rn <= 2)
)
insert into assessment_results (student_id, assessment_id, answers, score, taken_at)
select student_id, assessment_id, '{}'::jsonb, score, taken_at from test_rows
on conflict (student_id, assessment_id) do update
set answers = excluded.answers, score = excluded.score, taken_at = excluded.taken_at;

with ranked_students as (
  select id, row_number() over (order by display_name) as rn
  from students
  where class_id = '00000000-0000-4000-8000-000000000002'
), ranked_activities as (
  select a.id, row_number() over (order by l.position, a.position) as activity_no
  from activities a
  join lessons l on l.id = a.lesson_id
  where l.module_id = '00000000-0000-4000-8000-000000000003'
), demo_submissions as (
  select s.id as student_id, a.id as activity_id,
    case when s.rn = 5 then now() - interval '5 days'
         when s.rn <= 2 then now() - interval '2 days' + (a.activity_no * interval '1 hour')
         else now() - interval '1 day' + (a.activity_no * interval '1 hour') end as submitted_at
  from ranked_students s
  cross join ranked_activities a
  where (s.rn <= 2 and a.activity_no <= 4)
     or (s.rn in (3, 4) and a.activity_no <= 2)
     or (s.rn = 5 and a.activity_no = 1)
)
insert into submissions (student_id, activity_id, answer, score, submitted_at)
select student_id, activity_id, '{"demo":true}'::jsonb, null, submitted_at
from demo_submissions
on conflict (student_id, activity_id) do update
set answer = excluded.answer, submitted_at = excluded.submitted_at;
