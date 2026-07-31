import type { AnalyticsScalar, ProductEventName } from '@/lib/analytics/policy'

export type SourcePlatform = 'instagram' | 'tiktok' | 'youtube' | 'unknown'
export type EntryPoint =
  | 'home'
  | 'add'
  | 'library'
  | 'detail'
  | 'grocery'
  | 'settings'
  | 'quota_gate'
  | 'unknown'
export type SubscriptionTier = 'free' | 'premium'
export type PlanInterval = 'monthly' | 'yearly' | 'unknown'
export type AnalyticsResult = 'success' | 'failure' | 'cancelled' | 'blocked'
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed'
export type LanguageMode = 'english' | 'urdu' | 'both'
type SubscriptionReconciliationProperties = {
  trigger: string
  local_entitlement_active: boolean
  backend_premium_active: boolean
  expiration_relation: string
  provider_environment: string
  sync_result: string
  normalized_error_code: string
  latency_bucket: string
}

export type ProductEventProperties = {
  app_opened: undefined
  onboarding_started: undefined
  onboarding_completed: undefined
  onboarding_skipped: undefined
  account_recovery_form_opened: {
    mode: 'link' | 'verify' | 'sign_in'
  }
  account_link_started: {
    method: 'email_password'
  }
  account_link_verification_sent: {
    method: 'email_password'
    stage: 'initial' | 'resend'
  }
  account_link_completed: {
    method: 'email_password'
    subscription_refresh_pending: boolean
  }
  account_link_failed: {
    method: 'email_password'
    stage: 'email' | 'verification' | 'resend'
  }
  account_recovery_sign_in_started: {
    method: 'email_password'
  }
  account_recovery_guest_switch_confirmation_required: undefined
  account_recovery_completed: {
    method: 'email_password'
    replaced_empty_guest: boolean
    subscription_refresh_pending: boolean
  }
  account_recovery_sign_in_failed: {
    method: 'email_password'
  }
  account_recovery_subscription_refreshed: undefined
  account_recovery_subscription_refresh_pending: undefined
  account_sign_out_subscription_reset_failed: undefined
  account_signed_out: undefined
  account_deletion_completed: undefined
  ai_recipe_report_submitted: {
    category:
      | 'incorrect_or_misleading'
      | 'unsafe_cooking_instructions'
      | 'allergy_or_food_safety'
      | 'offensive_content'
      | 'other'
  }
  legal_link_opened: undefined
  add_recipe_opened: { entry_point?: EntryPoint }
  recipe_link_save_started: { source_platform: SourcePlatform; entry_point?: EntryPoint }
  recipe_link_saved: { source_platform: SourcePlatform; entry_point?: EntryPoint }
  recipe_link_save_failed: {
    source_platform: SourcePlatform
    entry_point?: EntryPoint
    failure_code: string
  }
  metadata_preview_ready: { has_thumbnail: boolean }
  metadata_preview_failed: { failure_code: string }
  ai_generation_requested: {
    source_platform: SourcePlatform
    entry_point?: EntryPoint
    subscription_tier?: SubscriptionTier
  }
  ai_generation_started: { source_platform: SourcePlatform; job_status: JobStatus }
  ai_generation_completed: {
    source_platform: SourcePlatform
    job_status: JobStatus
    has_thumbnail?: boolean
  }
  ai_generation_failed: {
    source_platform: SourcePlatform
    job_status: JobStatus
    failure_code: string
  }
  ai_generation_blocked: {
    entry_point?: EntryPoint
    subscription_tier?: SubscriptionTier
    failure_code: string
  }
  recipe_detail_viewed: { has_thumbnail?: boolean }
  library_search_used: { result: AnalyticsResult }
  grocery_list_opened: { entry_point?: EntryPoint; language_mode?: LanguageMode }
  paywall_opened: { entry_point?: EntryPoint; subscription_tier?: SubscriptionTier }
  paywall_plan_selected: {
    entry_point?: EntryPoint
    plan_interval: PlanInterval
    subscription_tier?: SubscriptionTier
  }
  purchase_started: { entry_point?: EntryPoint; plan_interval: PlanInterval }
  purchase_completed: {
    entry_point?: EntryPoint
    plan_interval: PlanInterval
    result: 'success'
  }
  purchase_cancelled: {
    entry_point?: EntryPoint
    plan_interval: PlanInterval
    result: 'cancelled'
  }
  purchase_failed: {
    entry_point?: EntryPoint
    plan_interval: PlanInterval
    result: 'failure'
    failure_code: string
  }
  restore_started: { entry_point?: EntryPoint }
  restore_completed: { entry_point?: EntryPoint; result: 'success' }
  restore_failed: {
    entry_point?: EntryPoint
    result: 'failure'
    failure_code: string
  }
  subscription_refresh_started: SubscriptionReconciliationProperties
  subscription_refresh_completed: SubscriptionReconciliationProperties
  subscription_refresh_failed: SubscriptionReconciliationProperties
  subscription_restore_started: SubscriptionReconciliationProperties
  subscription_restore_completed: SubscriptionReconciliationProperties
  subscription_restore_no_entitlement: SubscriptionReconciliationProperties
  subscription_restore_failed: SubscriptionReconciliationProperties
  subscription_state_transition: SubscriptionReconciliationProperties & {
    state_before: string
    state_after: string
  }
  purchase_reconciliation_started: SubscriptionReconciliationProperties
  purchase_reconciliation_completed: SubscriptionReconciliationProperties
  purchase_reconciliation_failed: SubscriptionReconciliationProperties
  posthog_test_event: {
    app_env: 'development'
    platform: 'android' | 'ios' | 'web'
    test_source: 'settings_controlled_test'
    analytics_schema_version: string
  }
  $screen: { $screen_name: string }
}

export type LegacyEventName =
  | ProductEventName
  | 'ai_credit_limit_reached'
  | 'anonymous_auth_bootstrap_completed'
  | 'anonymous_auth_bootstrap_failed'
  | 'anonymous_auth_bootstrap_started'
  | 'anonymous_auth_signed_out'
  | 'delete_account_data_confirmation_opened'
  | 'delete_account_data_request_placeholder_tapped'
  | 'delete_account_data_request_unavailable_confirmed'
  | 'generate_ai_recipe_tapped'
  | 'grocery_card_menu_opened'
  | 'grocery_detail_back_tapped'
  | 'grocery_filter_changed'
  | 'grocery_item_checked'
  | 'grocery_language_changed'
  | 'grocery_list_copied'
  | 'grocery_list_copy_failed'
  | 'grocery_list_share_failed'
  | 'grocery_list_shared'
  | 'grocery_list_unchecked_all'
  | 'grocery_list_viewed'
  | 'grocery_overview_card_opened'
  | 'grocery_overview_viewed'
  | 'grocery_recipe_opened'
  | 'grocery_search_cleared'
  | 'grocery_search_submitted'
  | 'grocery_usage_pill_tapped'
  | 'home_editorial_card_opened'
  | 'home_primary_cta_clicked'
  | 'home_section_opened'
  | 'home_usage_pill_tapped'
  | 'home_viewed'
  | 'language_preference_changed'
  | 'language_selected'
  | 'library_filter_changed'
  | 'library_item_menu_action'
  | 'library_item_menu_opened'
  | 'library_item_opened'
  | 'library_search_cancelled'
  | 'library_search_opened'
  | 'library_tab_changed'
  | 'library_usage_pill_tapped'
  | 'library_viewed'
  | 'media_job_create_failed'
  | 'media_job_completed'
  | 'media_job_created'
  | 'media_job_failed'
  | 'media_job_status_viewed'
  | 'metadata_refresh_completed'
  | 'metadata_refresh_started'
  | 'navigation_back_tapped'
  | 'onboarding_option_selected'
  | 'onboarding_skipped'
  | 'onboarding_step_viewed'
  | 'original_source_opened'
  | 'paywall_closed'
  | 'paywall_plans_unavailable'
  | 'paywall_viewed'
  | 'premium_entitlement_sync_failed'
  | 'premium_entitlement_synced'
  | 'premium_offerings_bootstrap_failed'
  | 'premium_offerings_refresh_failed'
  | 'premium_paywall_active_viewed'
  | 'premium_plan_card_tapped'
  | 'premium_status_refreshed'
  | 'processing_leave_tapped'
  | 'processing_wait_here_tapped'
  | 'purchase_pending'
  | 'recipe_delete_failed'
  | 'recipe_deleted'
  | 'recipe_favorite_toggle_failed'
  | 'recipe_favorite_toggled'
  | 'recipe_link_save_failed'
  | 'recipe_link_saved'
  | 'recipe_result_opened'
  | 'recipe_result_viewed'
  | 'recipe_save_preview_viewed'
  | 'recipe_tag_search_opened'
  | 'save_recipe_clipboard_used'
  | 'save_recipe_duplicate_found'
  | 'save_recipe_link_failed'
  | 'save_recipe_link_saved'
  | 'save_recipe_link_submitted'
  | 'save_recipe_modal_opened'
  | 'saved_recipe_card_opened'
  | 'screen_viewed'
  | 'secondary_recipe_language_option_tapped'
  | 'secondary_recipe_language_saved'
  | 'settings_delete_account_data_viewed'
  | 'settings_privacy_data_viewed'
  | 'settings_row_tapped'
  | 'settings_screen_viewed'
  | 'settings_secondary_language_viewed'
  | 'settings_subscription_refresh_completed'
  | 'settings_subscription_refresh_started'
  | 'share_intent_received'
  | 'share_url_extracted'
  | 'share_url_invalid'
  | 'shared_recipe_save_completed'
  | 'shared_recipe_save_failed'
  | 'shared_recipe_save_started'
  | 'subscription_manage_tapped'
  | 'tab_changed'
  | 'upgrade_placeholder_viewed'
  | 'usage_summary_viewed'

export type LegacyAnalyticsProperties = Partial<
  Record<
    | 'access_plan'
    | 'action'
    | 'backend_access_ready'
    | 'checked_count'
    | 'category'
    | 'code'
    | 'completed'
    | 'confidence'
    | 'configured'
    | 'current_plan'
    | 'destination'
    | 'duplicate'
    | 'duplicate_active_job'
    | 'error_code'
    | 'fallback_route'
    | 'filter'
    | 'filter_type'
    | 'had_existing_session'
    | 'had_query'
    | 'has_categories'
    | 'has_error'
    | 'has_initial_url'
    | 'has_intro_offer'
    | 'has_grocery_list'
    | 'has_missing_info'
    | 'has_management_url'
    | 'has_query'
    | 'has_recipe_title'
    | 'has_urdu'
    | 'is_checked'
    | 'is_favorite'
    | 'is_premium'
    | 'item_count'
    | 'item_type'
    | 'language'
    | 'layout'
    | 'limit'
    | 'limit_type'
    | 'metadata_status'
    | 'opened_item_type'
    | 'option_id'
    | 'outcome'
    | 'package_count'
    | 'plan'
    | 'platform'
    | 'premium_active'
    | 'progress'
    | 'reason'
    | 'requires_manual_caption'
    | 'result'
    | 'result_count'
    | 'retry_attempt'
    | 'role'
    | 'row'
    | 'screen_name'
    | 'secondary_recipe_language_code'
    | 'section'
    | 'selected_plan'
    | 'selected_tab'
    | 'source'
    | 'status'
    | 'source_mode'
    | 'step_id'
    | 'step_number'
    | 'tab'
    | 'tag_count'
    | 'thumbnail_present'
    | 'title_present'
    | 'trigger'
    | 'used'
    | 'value'
    | 'worker_status',
    AnalyticsScalar | null | undefined
  >
>
