-- ==========================================
-- SUPPLEMENT PRESCRIPTIONS + DAILY NUTRITION NOTES
-- Coach-defined supplements, client-specific prescriptions,
-- daily adherence tracking, and daily client nutrition notes.
-- ==========================================

create table if not exists supplement_templates (
  id text primary key default gen_random_uuid()::text,
  coach_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  dosage_frequency text not null default 'daily',
  timing text,
  purchase_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (dosage_frequency in ('daily', 'bi_daily', 'every_other_day', 'as_prescribed'))
);

create unique index if not exists idx_supplement_templates_coach_name
  on supplement_templates(coach_id, lower(name));

create index if not exists idx_supplement_templates_coach
  on supplement_templates(coach_id, is_active);

drop trigger if exists update_supplement_templates_updated_at on supplement_templates;
create trigger update_supplement_templates_updated_at
  before update on supplement_templates
  for each row execute function update_updated_at();

create table if not exists client_supplement_prescriptions (
  id text primary key default gen_random_uuid()::text,
  client_id uuid references profiles(id) on delete cascade not null,
  supplement_template_id text references supplement_templates(id) on delete restrict not null,
  supplement_name text not null,
  dosage text,
  dosage_frequency text not null default 'daily',
  timing text,
  purchase_url text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (dosage_frequency in ('daily', 'bi_daily', 'every_other_day', 'as_prescribed', 'pre_workout', 'any'))
);

create unique index if not exists idx_client_supplement_prescriptions_unique_template
  on client_supplement_prescriptions(client_id, supplement_template_id);

create index if not exists idx_client_supplement_prescriptions_client
  on client_supplement_prescriptions(client_id, is_active);

drop trigger if exists update_client_supplement_prescriptions_updated_at on client_supplement_prescriptions;
create trigger update_client_supplement_prescriptions_updated_at
  before update on client_supplement_prescriptions
  for each row execute function update_updated_at();

create table if not exists supplement_adherence_logs (
  id text primary key default gen_random_uuid()::text,
  client_id uuid references profiles(id) on delete cascade not null,
  client_supplement_prescription_id text references client_supplement_prescriptions(id) on delete cascade not null,
  date date not null,
  taken boolean not null default false,
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_supplement_prescription_id, date)
);

create index if not exists idx_supplement_adherence_logs_client_date
  on supplement_adherence_logs(client_id, date desc);

create index if not exists idx_supplement_adherence_logs_client_prescription_date
  on supplement_adherence_logs(client_id, client_supplement_prescription_id, date desc);

drop trigger if exists update_supplement_adherence_logs_updated_at on supplement_adherence_logs;
create trigger update_supplement_adherence_logs_updated_at
  before update on supplement_adherence_logs
  for each row execute function update_updated_at();

create table if not exists nutrition_daily_notes (
  id text primary key default gen_random_uuid()::text,
  client_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, date)
);

create index if not exists idx_nutrition_daily_notes_client_date
  on nutrition_daily_notes(client_id, date desc);

drop trigger if exists update_nutrition_daily_notes_updated_at on nutrition_daily_notes;
create trigger update_nutrition_daily_notes_updated_at
  before update on nutrition_daily_notes
  for each row execute function update_updated_at();

alter table supplement_templates enable row level security;
alter table client_supplement_prescriptions enable row level security;
alter table supplement_adherence_logs enable row level security;
alter table nutrition_daily_notes enable row level security;

drop policy if exists "Coach manages own supplement templates" on supplement_templates;
create policy "Coach manages own supplement templates"
  on supplement_templates for all
  to authenticated
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

drop policy if exists "Client reads assigned supplement templates" on supplement_templates;
create policy "Client reads assigned supplement templates"
  on supplement_templates for select
  to authenticated
  using (
    exists (
      select 1
      from client_supplement_prescriptions csp
      where csp.supplement_template_id = supplement_templates.id
        and csp.client_id = auth.uid()
        and csp.is_active = true
    )
  );

drop policy if exists "Coach manages client supplement prescriptions" on client_supplement_prescriptions;
create policy "Coach manages client supplement prescriptions"
  on client_supplement_prescriptions for all
  to authenticated
  using (
    exists (
      select 1
      from client_profiles cp
      where cp.id = client_supplement_prescriptions.client_id
        and cp.coach_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from client_profiles cp
      where cp.id = client_supplement_prescriptions.client_id
        and cp.coach_id = auth.uid()
    )
  );

drop policy if exists "Client reads own supplement prescriptions" on client_supplement_prescriptions;
create policy "Client reads own supplement prescriptions"
  on client_supplement_prescriptions for select
  to authenticated
  using (client_id = auth.uid());

drop policy if exists "Client manages own supplement adherence logs" on supplement_adherence_logs;
create policy "Client manages own supplement adherence logs"
  on supplement_adherence_logs for all
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "Coach reads client supplement adherence logs" on supplement_adherence_logs;
create policy "Coach reads client supplement adherence logs"
  on supplement_adherence_logs for select
  to authenticated
  using (
    client_id in (
      select id from client_profiles where coach_id = auth.uid()
    )
  );

drop policy if exists "Client manages own nutrition daily notes" on nutrition_daily_notes;
create policy "Client manages own nutrition daily notes"
  on nutrition_daily_notes for all
  to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists "Coach reads client nutrition daily notes" on nutrition_daily_notes;
create policy "Coach reads client nutrition daily notes"
  on nutrition_daily_notes for select
  to authenticated
  using (
    client_id in (
      select id from client_profiles where coach_id = auth.uid()
    )
  );
