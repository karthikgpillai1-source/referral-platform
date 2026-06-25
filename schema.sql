-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing triggers and functions if they exist (for clean setup)
drop trigger if exists trigger_generate_referral_code on participants;
drop trigger if exists trigger_handle_referral on participants;
drop trigger if exists trigger_generate_certificate_id on certificates;
drop trigger if exists trigger_sync_certificate on certificates;

drop function if exists generate_referral_code();
drop function if exists handle_referral_tracking();
drop function if exists generate_certificate_id();
drop function if exists sync_certificate_to_participant();

-- Create sequences
create sequence if not exists participant_ref_seq start with 1;
create sequence if not exists certificate_id_seq start with 1;

-- 1. Events Table
create table if not exists events (
    id uuid default uuid_generate_v4() primary key,
    event_name varchar(255) not null,
    event_description text,
    event_start_date timestamp with time zone,
    event_end_date timestamp with time zone,
    certificate_template text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Participants Table
create table if not exists participants (
    id uuid default uuid_generate_v4() primary key,
    full_name varchar(255) not null,
    whatsapp_number varchar(20) not null unique,
    email varchar(255) not null unique,
    college varchar(255) not null,
    registration_date timestamp with time zone default timezone('utc'::text, now()) not null,
    referral_code varchar(50) unique,
    referred_by varchar(50), -- code of the person who referred them
    certificate_id varchar(50),
    certificate_url text,
    status varchar(50) default 'registered', -- registered, pledge_completed, certificate_issued
    
    -- Friend Details
    friend_1_name varchar(255) not null,
    friend_1_whatsapp varchar(20) not null,
    friend_2_name varchar(255) not null,
    friend_2_whatsapp varchar(20) not null,
    friend_3_name varchar(255),
    friend_3_whatsapp varchar(20),

    -- Multi-Pledge Completion Tracking
    pledge_1_completed boolean default false,
    pledge_1_completed_at timestamp with time zone,
    pledge_2_completed boolean default false,
    pledge_2_completed_at timestamp with time zone,
    pledge_3_completed boolean default false,
    pledge_3_completed_at timestamp with time zone,
    overall_pledge_completed boolean default false,
    overall_pledge_completed_at timestamp with time zone,
    pledge_text text, -- Last pledge taken or aggregated text

    -- Automated Certificate Delivery tracking
    certificate_sent boolean default false,
    certificate_sent_at timestamp with time zone,
    certificate_delivery_method varchar(50) default 'download', -- download, email, whatsapp, manual

    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Referrals Table
create table if not exists referrals (
    id uuid default uuid_generate_v4() primary key,
    referrer_id uuid references participants(id) on delete cascade,
    referred_id uuid references participants(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint unique_referral unique(referrer_id, referred_id)
);

-- 4. Certificates Table
create table if not exists certificates (
    id uuid default uuid_generate_v4() primary key,
    certificate_id varchar(50) not null unique,
    participant_id uuid references participants(id) on delete cascade,
    issue_date timestamp with time zone default timezone('utc'::text, now()) not null,
    certificate_url text,
    verification_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TRIGGERS & FUNCTIONS FOR AUTOMATION

-- A. Auto-generate referral code (REF0001, REF0002, etc.)
create or replace function generate_referral_code()
returns trigger as $$
begin
    if new.referral_code is null or new.referral_code = '' then
        new.referral_code := 'REF' || lpad(nextval('participant_ref_seq')::text, 4, '0');
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trigger_generate_referral_code
before insert on participants
for each row
execute function generate_referral_code();

-- B. Auto-track referral when a user registers with referred_by code
create or replace function handle_referral_tracking()
returns trigger as $$
declare
    referrer_uuid uuid;
begin
    if new.referred_by is not null and new.referred_by <> '' then
        -- Find the participant owning that referral code
        select id into referrer_uuid from participants where referral_code = new.referred_by;
        
        -- Insert a record into referrals table if referrer exists and isn't the user themselves
        if referrer_uuid is not null and referrer_uuid <> new.id then
            insert into referrals (referrer_id, referred_id)
            values (referrer_uuid, new.id)
            on conflict do nothing;
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trigger_handle_referral
after insert on participants
for each row
execute function handle_referral_tracking();

-- C. Auto-generate certificate_id (CERT-2026-000001)
create or replace function generate_certificate_id()
returns trigger as $$
begin
    if new.certificate_id is null or new.certificate_id = '' then
        new.certificate_id := 'CERT-2026-' || lpad(nextval('certificate_id_seq')::text, 6, '0');
    end if;
    return new;
end;
$$ language plpgsql;

create trigger trigger_generate_certificate_id
before insert on certificates
for each row
execute function generate_certificate_id();

-- D. Auto-sync certificate back to participant and mark status as 'certificate_issued'
create or replace function sync_certificate_to_participant()
returns trigger as $$
begin
    update participants
    set certificate_id = new.certificate_id,
        certificate_url = new.certificate_url,
        status = 'certificate_issued'
    where id = new.participant_id;
    return new;
end;
$$ language plpgsql;

create trigger trigger_sync_certificate
after insert on certificates
for each row
execute function sync_certificate_to_participant();

-- INSERT DEFAULT EVENT FOR DEMONSTRATION
insert into events (event_name, event_description, event_start_date, event_end_date)
values (
    'Anti-Drug Awareness Campaign 2026', 
    'A youth-led campaign pledge to support substance awareness and clean living.',
    '2026-06-01 00:00:00+00', 
    '2026-12-31 23:59:59+00'
) on conflict do nothing;

-- 5. Admin Profiles Table (for Auth role resolution)
create table if not exists admin_profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    email varchar(255) not null,
    role varchar(50) not null check (role in ('admin', 'super_admin')) default 'admin',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on admin_profiles
alter table admin_profiles enable row level security;

-- Admin Policy: Admins can read all profiles, but write is restricted or managed
create policy "Allow read access for authenticated users on admin_profiles" 
on admin_profiles for select to authenticated using (true);

