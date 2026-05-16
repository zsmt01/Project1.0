-- 1. Create the PROFILES table
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  phone text,
  role text default 'client',
  fitness_goals text,
  injuries text,
  created_at timestamp with time zone default now()
);
-- Ensure PROFILE columns exist (updates if table exists)
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role text default 'client';
alter table public.profiles add column if not exists fitness_goals text;
alter table public.profiles add column if not exists injuries text;
alter table public.profiles add column if not exists trainer_notes text;
-- 2. Create the REQUESTS table
create table if not exists public.requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  start_time timestamp without time zone not null,
  end_time timestamp without time zone not null,
  status text default 'pending',
  notes text,
  -- Rescheduling fields
  proposed_start timestamp without time zone,
  proposed_end timestamp without time zone,
  move_status text default 'none', -- 'none', 'pending', 'rejected'
  created_at timestamp with time zone default now()
);
-- Ensure REQUESTS columns exist
alter table public.requests add column if not exists status text default 'pending';
alter table public.requests add column if not exists notes text;
alter table public.requests add column if not exists proposed_start timestamp without time zone;
alter table public.requests add column if not exists proposed_end timestamp without time zone;
alter table public.requests add column if not exists move_status text default 'none';
-- Coerce explicit timezone removal on strictly formatted start/end strings 
alter table public.requests alter column start_time type timestamp without time zone;
alter table public.requests alter column end_time type timestamp without time zone;
alter table public.requests alter column proposed_start type timestamp without time zone;
alter table public.requests alter column proposed_end type timestamp without time zone;
-- 3. Enable Row Level Security (The Guardrails)
alter table public.profiles enable row level security;
alter table public.requests enable row level security;
-- 4. Create a "Safety Policy" (Temporary for Development)
drop policy if exists "Allow all access for dev" on public.profiles;
create policy "Allow all access for dev" on public.profiles
for all using (true) with check (true);
drop policy if exists "Allow all access for dev requests" on public.requests;
create policy "Allow all access for dev requests" on public.requests
for all using (true) with check (true);
-- 5. Add "Anti-Spam" Constraint (No double booking same slot)
alter table requests drop constraint if exists one_request_per_slot_per_user;
alter table requests
add constraint one_request_per_slot_per_user unique (user_id, start_time);
-- 6. Create the MEASUREMENTS table (Tracking Progress)
create table if not exists public.measurements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  date_taken date default current_date,
  
  height_cm numeric,          
  waist_cm numeric,           
  arm_left_cm numeric,        
  arm_right_cm numeric,       
  body_fat_percent numeric, 
  leg_right_cm numeric,  
  leg_left_cm numeric,
  hip_cm numeric,
  bmi numeric,
  notes text,
  created_at timestamp with time zone default now()
);
-- Ensure MEASUREMENTS columns exist (Crucial for updates)
alter table public.measurements add column if not exists height_cm numeric;
alter table public.measurements add column if not exists waist_cm numeric;
alter table public.measurements add column if not exists arm_left_cm numeric;
alter table public.measurements add column if not exists arm_right_cm numeric;
alter table public.measurements add column if not exists leg_right_cm numeric;
alter table public.measurements add column if not exists leg_left_cm numeric;
alter table public.measurements add column if not exists hip_cm numeric;
alter table public.measurements add column if not exists bmi numeric;
alter table public.measurements add column if not exists body_fat_percent numeric;
alter table public.measurements add column if not exists notes text;
-- 7. Enable RLS for Measurements
alter table public.measurements enable row level security;
-- 8. Add "Safety Policy" for Measurements
drop policy if exists "Allow all access for dev measurements" on public.measurements;
create policy "Allow all access for dev measurements" on public.measurements
for all using (true) with check (true);
-- 9. Create BLOCKED_TIME table (Admin Blocks)
create table if not exists public.blocked_time (
  id uuid default gen_random_uuid() primary key,
  start_time timestamp without time zone not null,
  end_time timestamp without time zone not null,
  reason text,
  created_at timestamp with time zone default now()
);
-- Coerce explicit timezone removal on strictly formatted admin blocks
alter table public.blocked_time alter column start_time type timestamp without time zone;
alter table public.blocked_time alter column end_time type timestamp without time zone;
-- 10. Enable RLS for BLOCKED_TIME
alter table public.blocked_time enable row level security;
-- 11. Add "Safety Policy" for BLOCKED_TIME
drop policy if exists "Allow all access for dev blocked_time" on public.blocked_time;
create policy "Allow all access for dev blocked_time" on public.blocked_time
for all using (true) with check (true);
-- ==============================================================================
-- 12. ENABLE REALTIME (Crucial for Client Dashboard "Instant" Updates)
-- ==============================================================================
-- This ensures the client dashboard sees blocked times instantly
-- Supabase usually has the 'supabase_realtime' publication by default.
-- Add tables to the publication (Safe/Idempotent way)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'blocked_time') then
    alter publication supabase_realtime add table public.blocked_time;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'requests') then
    alter publication supabase_realtime add table public.requests;
  end if;
end $$;
