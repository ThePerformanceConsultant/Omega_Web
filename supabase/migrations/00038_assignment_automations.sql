-- Assignment Automations v1
-- Replaces curriculum-based course automation in active app flows
-- while preserving legacy curriculum tables as archived/read-only.

-- ------------------------------------------------------
-- Enums
-- ------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'automation_assignment_type') then
    create type automation_assignment_type as enum ('course', 'resource');
  end if;

  if not exists (select 1 from pg_type where typname = 'automation_assignment_status') then
    create type automation_assignment_status as enum ('active', 'paused', 'completed', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'automation_step_run_status') then
    create type automation_step_run_status as enum ('pending', 'executed', 'failed', 'skipped');
  end if;
end $$;

-- ------------------------------------------------------
-- Core tables
-- ------------------------------------------------------
create table if not exists automation_templates (
  id bigint generated always as identity primary key,
  coach_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists automation_template_steps (
  id bigint generated always as identity primary key,
  template_id bigint not null references automation_templates(id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  day_offset integer not null default 0 check (day_offset >= 0 and day_offset <= 365),
  title text not null,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, step_order)
);

create table if not exists automation_template_step_assignments (
  id bigint generated always as identity primary key,
  step_id bigint not null references automation_template_steps(id) on delete cascade,
  assignment_type automation_assignment_type not null,
  folder_id bigint not null references vault_folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(step_id, assignment_type, folder_id)
);

create table if not exists client_automation_assignments (
  id bigint generated always as identity primary key,
  coach_id uuid not null references profiles(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  template_id bigint not null references automation_templates(id) on delete cascade,
  start_date date not null,
  timezone text not null default 'Europe/London',
  status automation_assignment_status not null default 'active',
  next_due_at timestamptz,
  paused_at date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists client_automation_step_runs (
  id bigint generated always as identity primary key,
  client_assignment_id bigint not null references client_automation_assignments(id) on delete cascade,
  step_id bigint not null references automation_template_steps(id) on delete cascade,
  due_at timestamptz not null,
  executed_at timestamptz,
  status automation_step_run_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_assignment_id, step_id)
);

-- Dedicated resource access table so resources can be assigned (same as courses).
create table if not exists vault_resource_access (
  folder_id bigint not null references vault_folders(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  granted_via_automation_assignment_id bigint references client_automation_assignments(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(folder_id, client_id)
);

-- ------------------------------------------------------
-- Indexes
-- ------------------------------------------------------
create index if not exists idx_automation_templates_coach
  on automation_templates(coach_id, created_at desc);

create index if not exists idx_automation_template_steps_template
  on automation_template_steps(template_id, step_order);

create index if not exists idx_automation_step_assignments_step
  on automation_template_step_assignments(step_id);

create index if not exists idx_client_automation_assignments_client
  on client_automation_assignments(client_id, status, created_at desc);

create index if not exists idx_client_automation_assignments_coach
  on client_automation_assignments(coach_id, status, created_at desc);

create unique index if not exists uq_client_automation_active_template
  on client_automation_assignments(client_id, template_id)
  where status in ('active', 'paused');

create index if not exists idx_client_automation_step_runs_due
  on client_automation_step_runs(due_at, status);

create index if not exists idx_vault_resource_access_client
  on vault_resource_access(client_id, created_at desc);

-- ------------------------------------------------------
-- Triggers
-- ------------------------------------------------------
drop trigger if exists update_automation_templates_updated_at on automation_templates;
create trigger update_automation_templates_updated_at
  before update on automation_templates
  for each row execute function update_updated_at();

drop trigger if exists update_automation_template_steps_updated_at on automation_template_steps;
create trigger update_automation_template_steps_updated_at
  before update on automation_template_steps
  for each row execute function update_updated_at();

drop trigger if exists update_client_automation_assignments_updated_at on client_automation_assignments;
create trigger update_client_automation_assignments_updated_at
  before update on client_automation_assignments
  for each row execute function update_updated_at();

drop trigger if exists update_client_automation_step_runs_updated_at on client_automation_step_runs;
create trigger update_client_automation_step_runs_updated_at
  before update on client_automation_step_runs
  for each row execute function update_updated_at();

-- ------------------------------------------------------
-- Assignment validation
-- ------------------------------------------------------
create or replace function validate_automation_step_assignment_folder()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_section text;
begin
  select section into v_section
  from vault_folders
  where id = new.folder_id;

  if v_section is null then
    raise exception 'Vault folder % not found', new.folder_id;
  end if;

  if new.assignment_type = 'course' and v_section <> 'courses' then
    raise exception 'Course assignments must target course folders';
  end if;

  if new.assignment_type = 'resource' and v_section <> 'resources' then
    raise exception 'Resource assignments must target resource folders';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_automation_step_assignment_folder_trg on automation_template_step_assignments;
create trigger validate_automation_step_assignment_folder_trg
  before insert or update on automation_template_step_assignments
  for each row execute function validate_automation_step_assignment_folder();

-- ------------------------------------------------------
-- RLS
-- ------------------------------------------------------
alter table automation_templates enable row level security;
alter table automation_template_steps enable row level security;
alter table automation_template_step_assignments enable row level security;
alter table client_automation_assignments enable row level security;
alter table client_automation_step_runs enable row level security;
alter table vault_resource_access enable row level security;

-- Templates

drop policy if exists "Coach manages automation templates" on automation_templates;
create policy "Coach manages automation templates"
  on automation_templates for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- Steps

drop policy if exists "Coach manages automation template steps" on automation_template_steps;
create policy "Coach manages automation template steps"
  on automation_template_steps for all
  using (
    exists (
      select 1
      from automation_templates t
      where t.id = template_id
        and t.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from automation_templates t
      where t.id = template_id
        and t.coach_id = auth.uid()
    )
  );

-- Step assignments

drop policy if exists "Coach manages automation step assignments" on automation_template_step_assignments;
create policy "Coach manages automation step assignments"
  on automation_template_step_assignments for all
  using (
    exists (
      select 1
      from automation_template_steps s
      join automation_templates t on t.id = s.template_id
      where s.id = step_id
        and t.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from automation_template_steps s
      join automation_templates t on t.id = s.template_id
      where s.id = step_id
        and t.coach_id = auth.uid()
    )
  );

-- Client assignments

drop policy if exists "Coach manages client automation assignments" on client_automation_assignments;
create policy "Coach manages client automation assignments"
  on client_automation_assignments for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Client reads own automation assignments" on client_automation_assignments;
create policy "Client reads own automation assignments"
  on client_automation_assignments for select
  using (client_id = auth.uid());

-- Step runs

drop policy if exists "Coach manages client automation step runs" on client_automation_step_runs;
create policy "Coach manages client automation step runs"
  on client_automation_step_runs for all
  using (
    exists (
      select 1
      from client_automation_assignments ca
      where ca.id = client_assignment_id
        and ca.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from client_automation_assignments ca
      where ca.id = client_assignment_id
        and ca.coach_id = auth.uid()
    )
  );

drop policy if exists "Client reads own automation step runs" on client_automation_step_runs;
create policy "Client reads own automation step runs"
  on client_automation_step_runs for select
  using (
    exists (
      select 1
      from client_automation_assignments ca
      where ca.id = client_assignment_id
        and ca.client_id = auth.uid()
    )
  );

-- Resource access

drop policy if exists "Coach manages vault resource access" on vault_resource_access;
create policy "Coach manages vault resource access"
  on vault_resource_access for all
  using (
    exists (
      select 1
      from client_profiles cp
      join vault_folders f on f.id = folder_id
      where cp.id = client_id
        and cp.coach_id = auth.uid()
        and f.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from client_profiles cp
      join vault_folders f on f.id = folder_id
      where cp.id = client_id
        and cp.coach_id = auth.uid()
        and f.coach_id = auth.uid()
    )
  );

drop policy if exists "Client reads own vault resource access" on vault_resource_access;
create policy "Client reads own vault resource access"
  on vault_resource_access for select
  using (client_id = auth.uid());

-- ------------------------------------------------------
-- Helpers
-- ------------------------------------------------------
create or replace function automation_due_at_utc(
  p_start_date date,
  p_day_offset integer,
  p_timezone text default 'Europe/London'
)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select ((p_start_date + greatest(0, coalesce(p_day_offset, 0)))::timestamp + time '08:00')
         at time zone coalesce(nullif(trim(p_timezone), ''), 'Europe/London');
$$;

create or replace function refresh_client_automation_next_due(
  p_assignment_id bigint
)
returns client_automation_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment client_automation_assignments;
  v_next_due timestamptz;
  v_pending_count int;
  v_failed_count int;
begin
  select min(due_at), count(*)
  into v_next_due, v_pending_count
  from client_automation_step_runs
  where client_assignment_id = p_assignment_id
    and status = 'pending';

  select count(*)
  into v_failed_count
  from client_automation_step_runs
  where client_assignment_id = p_assignment_id
    and status = 'failed';

  update client_automation_assignments
  set
    next_due_at = v_next_due,
    status = case
      when status = 'cancelled' then status
      when v_pending_count = 0 and v_failed_count = 0 then 'completed'::automation_assignment_status
      when status = 'completed' and v_pending_count > 0 then 'active'::automation_assignment_status
      else status
    end,
    completed_at = case
      when status = 'cancelled' then completed_at
      when v_pending_count = 0 and v_failed_count = 0 then coalesce(completed_at, now())
      when v_pending_count > 0 then null
      else completed_at
    end,
    updated_at = now()
  where id = p_assignment_id
  returning * into v_assignment;

  return v_assignment;
end;
$$;

-- ------------------------------------------------------
-- RPC: upsert automation template
-- ------------------------------------------------------
create or replace function upsert_automation_template(
  p_id bigint default null,
  p_name text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_steps jsonb default '[]'::jsonb
)
returns automation_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := auth.uid();
  v_template automation_templates;
  v_step jsonb;
  v_assignment jsonb;
  v_step_id bigint;
  v_order int := 0;
begin
  if v_coach_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Template name is required';
  end if;

  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    raise exception 'Steps must be a JSON array';
  end if;

  if p_id is null then
    insert into automation_templates (coach_id, name, description, is_active)
    values (v_coach_id, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), coalesce(p_is_active, true))
    returning * into v_template;
  else
    update automation_templates
    set
      name = trim(p_name),
      description = nullif(trim(coalesce(p_description, '')), ''),
      is_active = coalesce(p_is_active, true),
      updated_at = now()
    where id = p_id
      and coach_id = v_coach_id
    returning * into v_template;

    if v_template.id is null then
      raise exception 'Template not found or not owned by coach';
    end if;

    delete from automation_template_steps
    where template_id = v_template.id;
  end if;

  for v_step in
    select value
    from jsonb_array_elements(p_steps)
  loop
    v_order := v_order + 1;

    insert into automation_template_steps (
      template_id,
      step_order,
      day_offset,
      title,
      message
    )
    values (
      v_template.id,
      v_order,
      greatest(0, coalesce((v_step->>'day_offset')::int, 0)),
      coalesce(nullif(trim(coalesce(v_step->>'title', '')), ''), format('Step %s', v_order)),
      nullif(trim(coalesce(v_step->>'message', '')), '')
    )
    returning id into v_step_id;

    if jsonb_typeof(v_step->'assignments') = 'array' then
      for v_assignment in
        select value
        from jsonb_array_elements(v_step->'assignments')
      loop
        if (v_assignment->>'folder_id') is null then
          continue;
        end if;

        insert into automation_template_step_assignments (
          step_id,
          assignment_type,
          folder_id
        )
        values (
          v_step_id,
          coalesce(nullif(v_assignment->>'assignment_type', ''), 'resource')::automation_assignment_type,
          (v_assignment->>'folder_id')::bigint
        )
        on conflict do nothing;
      end loop;
    end if;
  end loop;

  return v_template;
end;
$$;

-- ------------------------------------------------------
-- RPC: fetch coach templates with nested steps
-- ------------------------------------------------------
create or replace function fetch_coach_automation_templates()
returns table (
  id bigint,
  coach_id uuid,
  name text,
  description text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  active_assignment_count bigint,
  steps jsonb
)
language sql
security definer
set search_path = public
as $$
  with template_base as (
    select t.*
    from automation_templates t
    where t.coach_id = auth.uid()
  )
  select
    t.id,
    t.coach_id,
    t.name,
    t.description,
    t.is_active,
    t.created_at,
    t.updated_at,
    (
      select count(*)
      from client_automation_assignments ca
      where ca.template_id = t.id
        and ca.status in ('active', 'paused')
    ) as active_assignment_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'step_order', s.step_order,
            'day_offset', s.day_offset,
            'title', s.title,
            'message', s.message,
            'assignments', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', a.id,
                    'assignment_type', a.assignment_type,
                    'folder_id', a.folder_id,
                    'folder_name', f.name,
                    'folder_section', f.section
                  )
                  order by f.name
                )
                from automation_template_step_assignments a
                join vault_folders f on f.id = a.folder_id
                where a.step_id = s.id
              ),
              '[]'::jsonb
            )
          )
          order by s.step_order
        )
        from automation_template_steps s
        where s.template_id = t.id
      ),
      '[]'::jsonb
    ) as steps
  from template_base t
  order by t.updated_at desc, t.created_at desc;
$$;

-- ------------------------------------------------------
-- RPC: assign template to client
-- ------------------------------------------------------
create or replace function assign_automation_template(
  p_template_id bigint,
  p_client_id uuid,
  p_start_date date default current_date,
  p_timezone text default 'Europe/London'
)
returns client_automation_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid := auth.uid();
  v_template automation_templates;
  v_assignment client_automation_assignments;
begin
  if v_coach_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_template
  from automation_templates
  where id = p_template_id
    and coach_id = v_coach_id;

  if v_template.id is null then
    raise exception 'Template not found or not owned by coach';
  end if;

  if not exists (
    select 1
    from client_profiles cp
    where cp.id = p_client_id
      and cp.coach_id = v_coach_id
  ) then
    raise exception 'Client is not assigned to this coach';
  end if;

  select * into v_assignment
  from client_automation_assignments ca
  where ca.client_id = p_client_id
    and ca.template_id = p_template_id
    and ca.status in ('active', 'paused')
  order by ca.created_at desc
  limit 1;

  if v_assignment.id is null then
    insert into client_automation_assignments (
      coach_id,
      client_id,
      template_id,
      start_date,
      timezone,
      status,
      next_due_at,
      paused_at,
      completed_at
    )
    values (
      v_coach_id,
      p_client_id,
      p_template_id,
      coalesce(p_start_date, current_date),
      coalesce(nullif(trim(p_timezone), ''), 'Europe/London'),
      'active',
      null,
      null,
      null
    )
    returning * into v_assignment;
  else
    update client_automation_assignments
    set
      start_date = coalesce(p_start_date, current_date),
      timezone = coalesce(nullif(trim(p_timezone), ''), 'Europe/London'),
      status = 'active',
      paused_at = null,
      completed_at = null,
      next_due_at = null,
      updated_at = now()
    where id = v_assignment.id
    returning * into v_assignment;

    delete from client_automation_step_runs
    where client_assignment_id = v_assignment.id;
  end if;

  insert into client_automation_step_runs (
    client_assignment_id,
    step_id,
    due_at,
    status
  )
  select
    v_assignment.id,
    s.id,
    automation_due_at_utc(v_assignment.start_date, s.day_offset, v_assignment.timezone),
    'pending'::automation_step_run_status
  from automation_template_steps s
  where s.template_id = v_assignment.template_id
  order by s.step_order;

  select * into v_assignment
  from refresh_client_automation_next_due(v_assignment.id);

  return v_assignment;
end;
$$;

-- ------------------------------------------------------
-- RPC: fetch automations assigned to a client
-- ------------------------------------------------------
create or replace function fetch_client_automations(
  p_client_id uuid default null
)
returns table (
  assignment_id bigint,
  template_id bigint,
  template_name text,
  template_description text,
  status automation_assignment_status,
  start_date date,
  timezone text,
  next_due_at timestamptz,
  completed_at timestamptz,
  total_steps integer,
  executed_steps integer,
  failed_steps integer,
  steps jsonb
)
language sql
security definer
set search_path = public
as $$
  with requested_client as (
    select coalesce(p_client_id, auth.uid()) as client_id
  ), scoped as (
    select
      ca.*,
      t.name as template_name,
      t.description as template_description
    from client_automation_assignments ca
    join automation_templates t on t.id = ca.template_id
    join requested_client rc on rc.client_id = ca.client_id
    where
      ca.client_id = rc.client_id
      and (
        ca.client_id = auth.uid()
        or ca.coach_id = auth.uid()
      )
  )
  select
    ca.id as assignment_id,
    ca.template_id,
    ca.template_name,
    ca.template_description,
    ca.status,
    ca.start_date,
    ca.timezone,
    ca.next_due_at,
    ca.completed_at,
    (
      select count(*)::int
      from client_automation_step_runs r
      where r.client_assignment_id = ca.id
    ) as total_steps,
    (
      select count(*)::int
      from client_automation_step_runs r
      where r.client_assignment_id = ca.id
        and r.status = 'executed'
    ) as executed_steps,
    (
      select count(*)::int
      from client_automation_step_runs r
      where r.client_assignment_id = ca.id
        and r.status = 'failed'
    ) as failed_steps,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'step_id', s.id,
            'step_order', s.step_order,
            'day_offset', s.day_offset,
            'title', s.title,
            'message', s.message,
            'run_status', r.status,
            'due_at', r.due_at,
            'executed_at', r.executed_at,
            'error', r.error,
            'assignments', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'assignment_type', a.assignment_type,
                    'folder_id', a.folder_id,
                    'folder_name', f.name,
                    'folder_section', f.section
                  )
                  order by f.name
                )
                from automation_template_step_assignments a
                join vault_folders f on f.id = a.folder_id
                where a.step_id = s.id
              ),
              '[]'::jsonb
            )
          )
          order by s.step_order
        )
        from automation_template_steps s
        left join client_automation_step_runs r
          on r.step_id = s.id
         and r.client_assignment_id = ca.id
        where s.template_id = ca.template_id
      ),
      '[]'::jsonb
    ) as steps
  from scoped ca
  order by ca.created_at desc;
$$;

-- ------------------------------------------------------
-- RPC: run due automation steps
-- ------------------------------------------------------
create or replace function run_due_automation_steps(
  p_now timestamptz default now(),
  p_limit integer default 200,
  p_client_id uuid default null,
  p_coach_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row record;
  v_assignment_folder record;
  v_processed int := 0;
  v_executed int := 0;
  v_failed int := 0;
begin
  for v_row in
    select
      r.id as run_id,
      r.client_assignment_id,
      r.step_id,
      ca.client_id,
      ca.coach_id
    from client_automation_step_runs r
    join client_automation_assignments ca on ca.id = r.client_assignment_id
    where r.status = 'pending'
      and r.due_at <= coalesce(p_now, now())
      and ca.status = 'active'
      and (p_client_id is null or ca.client_id = p_client_id)
      and (p_coach_id is null or ca.coach_id = p_coach_id)
      and (
        v_actor is null
        or ca.coach_id = v_actor
        or ca.client_id = v_actor
      )
    order by r.due_at asc, r.id asc
    limit greatest(1, least(coalesce(p_limit, 200), 1000))
  loop
    v_processed := v_processed + 1;

    begin
      for v_assignment_folder in
        select
          a.assignment_type,
          a.folder_id
        from automation_template_step_assignments a
        where a.step_id = v_row.step_id
      loop
        if v_assignment_folder.assignment_type = 'course' then
          insert into vault_course_access (folder_id, client_id)
          values (v_assignment_folder.folder_id, v_row.client_id)
          on conflict (folder_id, client_id) do nothing;
        elsif v_assignment_folder.assignment_type = 'resource' then
          insert into vault_resource_access (folder_id, client_id, granted_via_automation_assignment_id)
          values (v_assignment_folder.folder_id, v_row.client_id, v_row.client_assignment_id)
          on conflict (folder_id, client_id) do update
            set granted_via_automation_assignment_id = excluded.granted_via_automation_assignment_id;
        end if;
      end loop;

      update client_automation_step_runs
      set
        status = 'executed',
        executed_at = coalesce(p_now, now()),
        error = null,
        updated_at = now()
      where id = v_row.run_id;

      v_executed := v_executed + 1;
    exception when others then
      update client_automation_step_runs
      set
        status = 'failed',
        error = left(sqlerrm, 1000),
        updated_at = now()
      where id = v_row.run_id;

      v_failed := v_failed + 1;
    end;

    perform refresh_client_automation_next_due(v_row.client_assignment_id);
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'executed', v_executed,
    'failed', v_failed
  );
end;
$$;

-- ------------------------------------------------------
-- Access helpers for client vault visibility
-- ------------------------------------------------------
create or replace function vault_accessible_course_folder_ids(
  p_client_id uuid
)
returns table (folder_id bigint)
language sql
security definer
set search_path = public
as $$
  with recursive seed as (
    select vca.folder_id
    from vault_course_access vca
    where vca.client_id = p_client_id
  ), tree as (
    select f.id
    from vault_folders f
    join seed s on s.folder_id = f.id

    union all

    select child.id
    from vault_folders child
    join tree t on t.id = child.parent_id
    where child.section = 'courses'
  )
  select distinct id as folder_id
  from tree;
$$;

create or replace function vault_accessible_resource_folder_ids(
  p_client_id uuid
)
returns table (folder_id bigint)
language sql
security definer
set search_path = public
as $$
  with recursive seed as (
    select vra.folder_id
    from vault_resource_access vra
    where vra.client_id = p_client_id
  ), tree as (
    select f.id
    from vault_folders f
    join seed s on s.folder_id = f.id

    union all

    select child.id
    from vault_folders child
    join tree t on t.id = child.parent_id
    where child.section = 'resources'
  )
  select distinct id as folder_id
  from tree;
$$;

-- ------------------------------------------------------
-- Replace client vault read RPCs with assignment-based access
-- ------------------------------------------------------
create or replace function fetch_client_vault_folders(
  p_section text,
  p_parent_id bigint default null
)
returns table (
  id bigint,
  coach_id uuid,
  parent_id bigint,
  section text,
  name text,
  description text,
  thumbnail_url text,
  sort_order int,
  drip_enabled boolean,
  drip_interval_days int,
  created_at timestamptz,
  is_locked boolean,
  unlock_at timestamptz,
  unlock_week int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_coach_id uuid;
begin
  if v_client_id is null then
    return;
  end if;

  perform run_due_automation_steps(now(), 250, v_client_id, null);

  select coach_id into v_coach_id
  from client_profiles
  where id = v_client_id;

  if v_coach_id is null then
    return;
  end if;

  return query
  select
    f.id,
    f.coach_id,
    f.parent_id,
    f.section,
    f.name,
    f.description,
    f.thumbnail_url,
    f.sort_order,
    f.drip_enabled,
    f.drip_interval_days,
    f.created_at,
    false as is_locked,
    null::timestamptz as unlock_at,
    null::int as unlock_week
  from vault_folders f
  where f.coach_id = v_coach_id
    and f.section = p_section
    and (
      (p_parent_id is null and f.parent_id is null)
      or (p_parent_id is not null and f.parent_id = p_parent_id)
    )
    and (
      (p_section = 'courses' and f.id in (select folder_id from vault_accessible_course_folder_ids(v_client_id)))
      or (p_section = 'resources' and f.id in (select folder_id from vault_accessible_resource_folder_ids(v_client_id)))
    )
  order by f.sort_order asc, f.name asc;
end;
$$;

create or replace function fetch_client_vault_items(
  p_folder_id bigint
)
returns table (
  id bigint,
  folder_id bigint,
  coach_id uuid,
  title text,
  description text,
  item_type text,
  file_url text,
  external_url text,
  thumbnail_url text,
  file_size bigint,
  sort_order int,
  created_at timestamptz,
  is_locked boolean,
  unlock_at timestamptz,
  unlock_week int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid := auth.uid();
  v_folder vault_folders%rowtype;
  v_coach_id uuid;
begin
  if v_client_id is null then
    return;
  end if;

  perform run_due_automation_steps(now(), 250, v_client_id, null);

  select coach_id into v_coach_id
  from client_profiles
  where id = v_client_id;

  if v_coach_id is null then
    return;
  end if;

  select *
  into v_folder
  from vault_folders
  where id = p_folder_id
    and coach_id = v_coach_id;

  if v_folder.id is null then
    return;
  end if;

  if v_folder.section = 'courses'
     and v_folder.id not in (select folder_id from vault_accessible_course_folder_ids(v_client_id)) then
    return;
  end if;

  if v_folder.section = 'resources'
     and v_folder.id not in (select folder_id from vault_accessible_resource_folder_ids(v_client_id)) then
    return;
  end if;

  return query
  select
    i.id,
    i.folder_id,
    i.coach_id,
    i.title,
    i.description,
    i.item_type,
    i.file_url,
    i.external_url,
    i.thumbnail_url,
    i.file_size,
    i.sort_order,
    i.created_at,
    false as is_locked,
    null::timestamptz as unlock_at,
    null::int as unlock_week
  from vault_items i
  where i.folder_id = p_folder_id
  order by i.sort_order asc, i.title asc;
end;
$$;

-- ------------------------------------------------------
-- Grants
-- ------------------------------------------------------
grant execute on function upsert_automation_template(bigint, text, text, boolean, jsonb) to authenticated;
grant execute on function fetch_coach_automation_templates() to authenticated;
grant execute on function assign_automation_template(bigint, uuid, date, text) to authenticated;
grant execute on function fetch_client_automations(uuid) to authenticated;
grant execute on function run_due_automation_steps(timestamptz, integer, uuid, uuid) to authenticated;
grant execute on function vault_accessible_course_folder_ids(uuid) to authenticated;
grant execute on function vault_accessible_resource_folder_ids(uuid) to authenticated;
grant execute on function fetch_client_vault_folders(text, bigint) to authenticated;
grant execute on function fetch_client_vault_items(bigint) to authenticated;
