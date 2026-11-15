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
grant select on learning_gain, class_module_summary, student_activity to authenticated;