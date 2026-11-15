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
