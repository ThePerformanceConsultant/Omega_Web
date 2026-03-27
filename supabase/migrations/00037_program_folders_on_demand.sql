-- Program folders + on-demand program support.
-- This enables:
-- 1) Coach-side organization of on-demand sessions into folders.
-- 2) Client read access to coach on-demand sessions and their nested workout data.

create table if not exists program_folders (
  id bigint generated always as identity primary key,
  coach_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table programs
  add column if not exists is_on_demand boolean not null default false;

alter table programs
  add column if not exists folder_id bigint references program_folders(id) on delete set null;

create index if not exists idx_programs_coach_on_demand_created
  on programs(coach_id, is_on_demand, created_at desc);

create index if not exists idx_programs_folder
  on programs(folder_id);

create index if not exists idx_program_folders_coach_sort
  on program_folders(coach_id, sort_order, created_at);

drop trigger if exists update_program_folders_updated_at on program_folders;
create trigger update_program_folders_updated_at
  before update on program_folders
  for each row execute function update_updated_at();

alter table program_folders enable row level security;

drop policy if exists "Coach manages own program folders" on program_folders;
create policy "Coach manages own program folders"
  on program_folders for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Client reads coach program folders" on program_folders;
create policy "Client reads coach program folders"
  on program_folders for select
  using (
    coach_id in (select coach_id from client_profiles where id = auth.uid())
  );

-- Expand client read scope so on-demand programs and nested entities are visible
-- without explicit assignment rows.
drop policy if exists "Client reads assigned programs" on programs;
create policy "Client reads assigned programs"
  on programs for select
  using (
    id in (
      select program_id from client_program_assignments
      where client_id = auth.uid()
    )
    or (
      is_on_demand = true
      and coach_id in (select coach_id from client_profiles where id = auth.uid())
    )
  );

drop policy if exists "Client reads assigned phases" on program_phases;
create policy "Client reads assigned phases"
  on program_phases for select
  using (
    program_id in (
      select p.id
      from programs p
      where p.id = program_phases.program_id
        and (
          p.id in (
            select program_id from client_program_assignments
            where client_id = auth.uid()
          )
          or (
            p.is_on_demand = true
            and p.coach_id in (select coach_id from client_profiles where id = auth.uid())
          )
        )
    )
  );

drop policy if exists "Client reads assigned phase workouts" on phase_workouts;
create policy "Client reads assigned phase workouts"
  on phase_workouts for select
  using (
    phase_id in (
      select pp.id
      from program_phases pp
      join programs p on p.id = pp.program_id
      where
        p.id in (
          select program_id from client_program_assignments
          where client_id = auth.uid()
        )
        or (
          p.is_on_demand = true
          and p.coach_id in (select coach_id from client_profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "Client reads assigned workout sections" on workout_sections;
create policy "Client reads assigned workout sections"
  on workout_sections for select
  using (
    workout_id in (
      select pw.id
      from phase_workouts pw
      join program_phases pp on pp.id = pw.phase_id
      join programs p on p.id = pp.program_id
      where
        p.id in (
          select program_id from client_program_assignments
          where client_id = auth.uid()
        )
        or (
          p.is_on_demand = true
          and p.coach_id in (select coach_id from client_profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "Client reads assigned workout exercises" on workout_exercises;
create policy "Client reads assigned workout exercises"
  on workout_exercises for select
  using (
    workout_id in (
      select pw.id
      from phase_workouts pw
      join program_phases pp on pp.id = pw.phase_id
      join programs p on p.id = pp.program_id
      where
        p.id in (
          select program_id from client_program_assignments
          where client_id = auth.uid()
        )
        or (
          p.is_on_demand = true
          and p.coach_id in (select coach_id from client_profiles where id = auth.uid())
        )
    )
  );

drop policy if exists "Client reads assigned exercise sets" on workout_exercise_sets;
create policy "Client reads assigned exercise sets"
  on workout_exercise_sets for select
  using (
    workout_exercise_id in (
      select we.id
      from workout_exercises we
      join phase_workouts pw on pw.id = we.workout_id
      join program_phases pp on pp.id = pw.phase_id
      join programs p on p.id = pp.program_id
      where
        p.id in (
          select program_id from client_program_assignments
          where client_id = auth.uid()
        )
        or (
          p.is_on_demand = true
          and p.coach_id in (select coach_id from client_profiles where id = auth.uid())
        )
    )
  );
