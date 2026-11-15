-- 0004: student PIN lockout (AUTH-3) and keeping pin_hash out of the browser.
-- Run after 0001–0003. Safe to re-run.

-- 1. Lockout columns. After 5 wrong PINs a student is locked for 10 minutes.
alter table students
  add column if not exists failed_pin_attempts int not null default 0,
  add column if not exists pin_locked_until timestamptz;

-- 2. Record one wrong PIN atomically (no lost updates when two tries race).
--    On the 5th miss: lock for 10 minutes and reset the counter.
--    Returns pin_locked_until (null while not locked).
create or replace function record_failed_pin(p_student uuid) returns timestamptz
  language sql volatile security definer set search_path = public
  as $$
    update students set
      failed_pin_attempts = case when failed_pin_attempts + 1 >= 5 then 0
                                 else failed_pin_attempts + 1 end,
      pin_locked_until    = case when failed_pin_attempts + 1 >= 5 then now() + interval '10 minutes'
                                 else pin_locked_until end
    where id = p_student
    returning pin_locked_until
  $$;

-- Only the server (service role) may call it.
revoke execute on function record_failed_pin(uuid) from public, anon, authenticated;
grant execute on function record_failed_pin(uuid) to service_role;

-- 3. proxy.ts calls current_student_id() as the signed-in user to guard /learn.
--    It only ever returns the caller's own student id.
grant execute on function current_student_id() to authenticated;

-- 4. Never expose pin_hash through the API. 0002 granted select on every table;
--    replace that for students with a column list that leaves pin_hash out.
--    RLS still decides which rows. Server code reads pin_hash with the service role.
revoke select on students from authenticated;
grant select (id, class_id, display_name, school, joined_at, failed_pin_attempts, pin_locked_until)
  on students to authenticated;
