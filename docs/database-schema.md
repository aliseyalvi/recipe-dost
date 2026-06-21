# Recipe Dost Database Schema Plan

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
- user_note text
- pasted_caption text
- manual_ingredients text
- meal_type text
- cuisine text
- metadata_status text
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

## Indexes
Add indexes on:
- user_id
- created_at
- recipe_id
- collection_id
- period
- status where useful
