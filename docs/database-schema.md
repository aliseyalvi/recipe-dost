# Recipe Dost Database Schema Plan

## M24.1 service-only subscription state

`revenuecat_customer_bindings` stores one environment-scoped keyed RevenueCat
customer binding per Supabase user. The customer key is an Edge Function HMAC;
the raw RevenueCat original ID is never stored. Unique constraints prevent one
customer from binding to two users and one user from binding to two customers in
the same environment.

`revenuecat_sync_state` stores an expiring synchronization lease plus last
attempt/success/result/latency metadata per environment and Supabase user.

Both tables reference `auth.users`, enable RLS, have no anonymous/authenticated
policies, and grant table/RPC access only to `service_role`. Service-role-only
invoker functions atomically acquire/complete leases, create/verify bindings,
and transactionally update the existing `user_profiles` entitlement projection
and binding verification metadata.

Use Supabase Postgres.

Use Supabase auth.users as the auth user table.
Do not create a separate custom users table unless needed.
Every user-owned table must include user_id uuid references auth.users(id).

## Tables

### user_profiles
- user_id uuid primary key references auth.users(id)
- language text
- household_size text
- cooking_level text
- cuisine_preference text
- main_use text
- cooking_preferences text[]
- onboarding_completed boolean
- created_at timestamptz
- updated_at timestamptz

### recipe_items
- id uuid primary key
- user_id uuid references auth.users(id)
- source_url text not null
- platform text
- title text
- description text
- thumbnail_url text
- duration_seconds integer
- user_note text
- pasted_caption text
- manual_ingredients text
- meal_type text
- cuisine text
- metadata_status text
- source_metadata jsonb
- created_at timestamptz
- updated_at timestamptz

### recipe_cards
- id uuid primary key
- recipe_id uuid references recipe_items(id)
- user_id uuid references auth.users(id)
- recipe_title text
- short_summary text
- ingredients_json jsonb
- steps_json jsonb
- time_json jsonb
- servings text
- difficulty text
- grocery_list_json jsonb
- tags_json jsonb
- substitutions_json jsonb
- storage_tip text
- safety_note text
- confidence text
- missing_info_json jsonb
- source_link text
- model_used text
- prompt_version text
- input_tokens integer
- output_tokens integer
- estimated_cost numeric
- created_at timestamptz
- updated_at timestamptz

### collections
- id uuid primary key
- user_id uuid references auth.users(id)
- name text
- type text
- created_at timestamptz

### collection_items
- id uuid primary key
- user_id uuid references auth.users(id)
- collection_id uuid references collections(id)
- recipe_id uuid references recipe_items(id)
- created_at timestamptz

### grocery_lists
- id uuid primary key
- user_id uuid references auth.users(id)
- title text
- items_json jsonb
- source_recipe_ids uuid[]
- created_at timestamptz
- updated_at timestamptz

### usage_counters
- id uuid primary key
- user_id uuid references auth.users(id)
- period text
- recipe_cards_used integer
- grocery_lists_used integer
- saved_links_used integer
- total_tokens integer
- estimated_cost numeric
- created_at timestamptz
- updated_at timestamptz

### subscriptions
- user_id uuid primary key references auth.users(id)
- revenuecat_app_user_id text
- entitlement text
- status text
- product_id text
- expires_at timestamptz
- updated_at timestamptz

### metadata_fetch_logs
- id uuid primary key
- recipe_id uuid references recipe_items(id)
- user_id uuid references auth.users(id)
- provider text
- status text
- error_code text
- fetched_at timestamptz

### media_jobs
- id uuid primary key
- user_id uuid references auth.users(id)
- recipe_item_id uuid references recipe_items(id)
- source_url text not null
- platform text not null
- status text
- source_mode text
- resolver_provider text
- ai_provider text
- ai_model text
- progress integer
- error_code text
- error_message text
- thumbnail_url text
- raw_media_storage_path text
- gemini_file_name text
- media_duration_seconds integer
- media_size_bytes bigint
- result_recipe_card_id uuid references recipe_cards(id)
- started_at timestamptz
- completed_at timestamptz
- expires_at timestamptz
- created_at timestamptz
- updated_at timestamptz

Status values:
- queued
- resolving
- downloading
- validating
- thumbnailing
- uploading_to_ai
- analyzing
- saving_result
- completed
- failed
- needs_caption

`progress` is constrained to `0-100`.

### media_job_events
- id uuid primary key
- media_job_id uuid references media_jobs(id)
- event_type text not null
- message text
- metadata jsonb
- created_at timestamptz

### support_tickets
- id uuid primary key
- user_id uuid references auth.users(id)
- issue_type text
- message text
- app_version text
- platform text
- status text
- created_at timestamptz

## RLS Rules
Enable RLS on all user-owned tables.

User can:
- select their own rows
- insert their own rows
- update their own rows
- delete their own rows where safe

Service role can:
- process RevenueCat webhook
- update subscriptions
- update usage counters
- insert metadata logs
- support account deletion
- create and update media jobs and media job events

## M14G-1 Media Job Security

- `media_jobs` and `media_job_events` have RLS enabled.
- Authenticated users receive Data API `SELECT` grants only.
- Users can select only their own jobs.
- Users can select events only when the parent job belongs to them.
- Mobile clients cannot insert or update media job rows directly.
- `create-media-job` verifies the user JWT and recipe ownership with a caller-scoped client, then inserts the queued job with a server-only key.
- Future workers use a server/service role to update status and append events.
- No raw video is stored in M14G-1. Storage path and Gemini file columns are nullable future-worker placeholders.

## Indexes
Add indexes on:
- user_id
- created_at
- recipe_id
- collection_id
- period
- status where useful
