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

-- Grants
grant usage on schema public to anon, authenticated;

grant select on all tables in schema public to authenticated;   -- includes the views

grant insert, update, delete on
  profiles, cohorts, classes, students, assignments,
  modules, lessons, activities, assessments, api_keys
to authenticated;

-- student_devices, submissions, assessment_results, hint_logs:
-- written only by server routes using the service role, so no write grants.
