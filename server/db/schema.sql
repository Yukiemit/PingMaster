-- Saan Tayo? database schema (Supabase / Postgres).
-- Run with `npm run db:setup` (from server/), or paste into the Supabase SQL Editor.
-- Safe to run more than once.

create table if not exists users (
  id            text primary key,
  name          text not null,
  email         text unique,            -- null for guests
  password_hash text,                   -- null for guests
  is_guest      boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists auth_tokens (
  token      text primary key,
  user_id    text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists auth_tokens_user_idx on auth_tokens(user_id);

create table if not exists friend_groups (
  id         text primary key,
  owner_id   text not null references users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists friend_groups_owner_idx on friend_groups(owner_id);

create table if not exists group_members (
  id         text primary key,
  group_id   text not null references friend_groups(id) on delete cascade,
  name       text not null,
  preference text not null default 'No restrictions',
  seq        bigserial                  -- keeps members in the order they were added
);
create index if not exists group_members_group_idx on group_members(group_id);

create table if not exists sessions (
  id                   text primary key,
  code                 text not null unique,   -- invite link: /join/<code>
  pin                  text not null,          -- 4-digit PIN
  name                 text not null,
  organizer_id         text not null references users(id) on delete cascade,
  status               text not null default 'open' check (status in ('open', 'voting', 'done')),
  created_at           timestamptz not null default now(),
  picked_restaurant_id text,
  schedule_date        date,
  schedule_time        text
);
-- A PIN only has to be unique among sessions that are still open or voting.
create unique index if not exists sessions_active_pin_idx on sessions(pin) where status <> 'done';

-- A participant id is unique within its session (the organizer's id is their user id).
create table if not exists participants (
  session_id   text not null references sessions(id) on delete cascade,
  id           text not null,
  name         text not null,
  role         text not null check (role in ('organizer', 'member')),
  user_id      text references users(id) on delete set null,   -- null = invited placeholder
  invited_only boolean not null default false,
  seq          bigserial,
  primary key (session_id, id)
);
create index if not exists participants_user_idx on participants(user_id);

create table if not exists preferences (
  session_id     text not null,
  participant_id text not null,
  budget_min     double precision not null default 0,
  budget_max     double precision not null default 0,
  max_walk       double precision not null default 0,
  cravings       text[] not null default '{}',
  diet           text[] not null default '{}',
  updated_at     timestamptz not null default now(),
  primary key (session_id, participant_id),
  foreign key (session_id, participant_id) references participants(session_id, id) on delete cascade
);

create table if not exists votes (
  session_id     text not null,
  participant_id text not null,
  restaurant_id  text not null,
  value          text not null check (value in ('yes', 'maybe')),
  primary key (session_id, participant_id, restaurant_id),
  foreign key (session_id, participant_id) references participants(session_id, id) on delete cascade
);

-- Only the Express server talks to these tables (through the database connection string).
-- Row Level Security with no policies blocks Supabase's public REST API from reading them.
alter table users          enable row level security;
alter table auth_tokens    enable row level security;
alter table friend_groups  enable row level security;
alter table group_members  enable row level security;
alter table sessions       enable row level security;
alter table participants   enable row level security;
alter table preferences    enable row level security;
alter table votes          enable row level security;

-- ---- Meetup spot + real restaurants (Google Places) ------------------------------
alter table sessions add column if not exists meet_lat      double precision;
alter table sessions add column if not exists meet_lng      double precision;
alter table sessions add column if not exists meet_label    text;
alter table sessions add column if not exists meet_place_id text;

-- Nearby restaurants fetched from Google for a session's meetup spot (refetched when the spot changes).
create table if not exists session_places (
  session_id text not null references sessions(id) on delete cascade,
  place_id   text not null,
  data       jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (session_id, place_id)
);

-- Walking route from the meetup spot to a restaurant (Google Routes API), cached.
create table if not exists session_routes (
  session_id text not null references sessions(id) on delete cascade,
  place_id   text not null,
  data       jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (session_id, place_id)
);

alter table session_places enable row level security;
alter table session_routes enable row level security;

-- ---- Group members are real accounts ---------------------------------------------
-- user_id links a member to their account so the group also shows in their My Group.
-- (Older rows without an account keep user_id = null.)
alter table group_members add column if not exists user_id text references users(id) on delete cascade;
create unique index if not exists group_members_user_idx on group_members(group_id, user_id) where user_id is not null;
create index if not exists group_members_user_lookup_idx on group_members(user_id);

-- ---- Sessions started from a group ---------------------------------------------------
-- Only the group owner starts a group's session; members see it and join with one tap.
alter table sessions add column if not exists group_id text references friend_groups(id) on delete set null;
create index if not exists sessions_group_idx on sessions(group_id);

-- ---- Date & time picks -------------------------------------------------------------
-- Everyone suggests a date and time; the organizer (group owner) makes the final call.
create table if not exists time_proposals (
  session_id     text not null,
  participant_id text not null,
  date           date not null,
  time           text not null,
  updated_at     timestamptz not null default now(),
  primary key (session_id, participant_id),
  foreign key (session_id, participant_id) references participants(session_id, id) on delete cascade
);
alter table time_proposals enable row level security;

-- ---- Email verification & password reset -------------------------------------------
-- Accounts that existed before verification was added are treated as verified (null -> true, once).
alter table users add column if not exists email_verified boolean;
update users set email_verified = true where email_verified is null;
alter table users alter column email_verified set default false;

-- One active 6-digit code per user and purpose; only a hash of the code is stored.
create table if not exists email_codes (
  user_id    text not null references users(id) on delete cascade,
  purpose    text not null check (purpose in ('verify', 'reset')),
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, purpose)
);
alter table email_codes enable row level security;
