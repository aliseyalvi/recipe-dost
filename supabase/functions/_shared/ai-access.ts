import type { SupabaseClient } from "@supabase/supabase-js";
import { hmacSha256Hex } from "./keyed-hash.ts";

export const REVENUECAT_ENTITLEMENT_PREMIUM = "premium";
export const PREMIUM_MONTHLY_AI_LIMIT = 100;
export const TESTER_MONTHLY_AI_LIMIT = 100;
export const ADMIN_MONTHLY_AI_LIMIT = 10_000;

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserProfile = {
  user_id: string;
  role: string | null;
  is_test_user: boolean | null;
  ai_monthly_limit_override: number | null;
  revenuecat_entitlement: string | null;
  revenuecat_entitlement_active: boolean | null;
  revenuecat_expires_at: string | null;
};

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

export type AiGenerationAccessReason =
  | "free_credit_available"
  | "premium_active"
  | "admin_override"
  | "tester_override"
  | "limit_reached";

const ACTIVE_AI_JOB_STATUSES = [
  "queued",
  "processing",
  "analyzing",
  "pending",
  "running",
  "resolving",
  "downloading",
  "validating",
  "thumbnailing",
  "uploading_to_ai",
  "saving_result",
] as const;

export type AiGenerationAccess = {
  allowed: boolean;
  reason: AiGenerationAccessReason;
  plan: "free" | "premium";
  blockReason: string | null;
  freeLimit: number;
  usedSuccessfulGenerations: number;
  activeReserved: number;
  freeSuccessfulUsed: number;
  freeActiveReserved: number;
  freeRemainingToStart: number;
  premiumMonthlyLimit: number;
  premiumMonthlySuccessfulUsed: number;
  premiumMonthlyActiveReserved: number;
  premiumMonthlyRemainingToStart: number;
  remainingToStart: number | null;
  isPremiumOrTester: boolean;
  monthlyLimit: number | null;
  remaining: number | null;
  role: string;
  premiumActive: boolean;
  isTestUser: boolean;
};

type AccessSupabaseClient = SupabaseClient<Record<string, never>>;

export async function getAiGenerationAccess(
  adminClient: AccessSupabaseClient,
  userId: string,
): Promise<AiGenerationAccess> {
  const monthStartIso = getCurrentMonthStartIso();
  const nextMonthStartIso = getNextMonthStartIso();
  const [
    profileResult,
    lifetimeCountResult,
    monthlyCountResult,
    activeCountResult,
    monthlyActiveCountResult,
  ] = await Promise.all([
    adminClient
      .from("user_profiles")
      .select(
        "role, is_test_user, ai_monthly_limit_override, revenuecat_entitlement, revenuecat_entitlement_active, revenuecat_expires_at",
      )
      .eq("user_id", userId)
      .maybeSingle<UserProfile>(),
    buildSuccessfulAiJobsCountQuery(adminClient, userId),
    buildSuccessfulAiJobsCountQuery(adminClient, userId)
      .gte("completed_at", monthStartIso)
      .lt("completed_at", nextMonthStartIso),
    buildActiveAiJobsCountQuery(adminClient, userId),
    buildActiveAiJobsCountQuery(adminClient, userId)
      .gte("created_at", monthStartIso)
      .lt("created_at", nextMonthStartIso),
  ]);

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (lifetimeCountResult.error) {
    throw lifetimeCountResult.error;
  }

  if (monthlyCountResult.error) {
    throw monthlyCountResult.error;
  }

  if (activeCountResult.error) {
    throw activeCountResult.error;
  }

  if (monthlyActiveCountResult.error) {
    throw monthlyActiveCountResult.error;
  }

  const profile = profileResult.data;
  const access = calculateAiGenerationAccess({
    profile,
    usedSuccessfulGenerations: lifetimeCountResult.count ?? 0,
    usedThisMonth: monthlyCountResult.count ?? 0,
    activeReserved: activeCountResult.count ?? 0,
    monthlyActiveReserved: monthlyActiveCountResult.count ?? 0,
    freeLimit: getFreeAiGenerationLimit(),
  });
  const revenueCatPremium = evaluateRevenueCatPremium(profile);

  if (revenueCatPremium.expiryApplied) {
    await logAiAccessExpiryApplied(userId);
  }

  return access;
}

export function calculateAiGenerationAccess({
  profile,
  usedSuccessfulGenerations,
  usedThisMonth,
  activeReserved,
  monthlyActiveReserved,
  freeLimit = 3,
}: {
  profile: UserProfile | null | undefined;
  usedSuccessfulGenerations: number;
  usedThisMonth: number;
  activeReserved: number;
  monthlyActiveReserved: number;
  freeLimit?: number;
}): AiGenerationAccess {
  const role = normalizeRole(profile?.role);
  const override = getMonthlyLimitOverride(profile);
  const premiumActive = isPremiumActive(profile);
  const isTestUser = role === "tester" || profile?.is_test_user === true;
  const isPremiumOrTester = role === "admin" || isTestUser || premiumActive;
  const freeRemaining = Math.max(
    0,
    freeLimit - usedSuccessfulGenerations - activeReserved,
  );

  if (role === "admin") {
    return buildMonthlyAccess({
      reason: "admin_override",
      role,
      monthlyLimit: override ?? ADMIN_MONTHLY_AI_LIMIT,
      usedThisMonth,
      usedSuccessfulGenerations,
      activeReserved,
      monthlyActiveReserved,
      freeLimit,
      freeRemaining,
      premiumActive,
      isTestUser,
      isPremiumOrTester,
    });
  }

  if (isTestUser) {
    return buildMonthlyAccess({
      reason: "tester_override",
      role,
      monthlyLimit: override ?? TESTER_MONTHLY_AI_LIMIT,
      usedThisMonth,
      usedSuccessfulGenerations,
      activeReserved,
      monthlyActiveReserved,
      freeLimit,
      freeRemaining,
      premiumActive,
      isTestUser,
      isPremiumOrTester,
    });
  }

  if (premiumActive) {
    return buildMonthlyAccess({
      reason: "premium_active",
      role,
      monthlyLimit: override ?? PREMIUM_MONTHLY_AI_LIMIT,
      usedThisMonth,
      usedSuccessfulGenerations,
      activeReserved,
      monthlyActiveReserved,
      freeLimit,
      freeRemaining,
      premiumActive,
      isTestUser,
      isPremiumOrTester,
    });
  }

  return {
    allowed: freeRemaining > 0,
    reason: freeRemaining > 0 ? "free_credit_available" : "limit_reached",
    plan: "free",
    blockReason: freeRemaining > 0 ? null : "free_ai_limit_reached",
    freeLimit,
    usedSuccessfulGenerations,
    activeReserved,
    freeSuccessfulUsed: usedSuccessfulGenerations,
    freeActiveReserved: activeReserved,
    freeRemainingToStart: freeRemaining,
    premiumMonthlyLimit: PREMIUM_MONTHLY_AI_LIMIT,
    premiumMonthlySuccessfulUsed: usedThisMonth,
    premiumMonthlyActiveReserved: monthlyActiveReserved,
    premiumMonthlyRemainingToStart: Math.max(
      0,
      PREMIUM_MONTHLY_AI_LIMIT - usedThisMonth - monthlyActiveReserved,
    ),
    remainingToStart: freeRemaining,
    isPremiumOrTester,
    monthlyLimit: null,
    remaining: freeRemaining,
    role,
    premiumActive,
    isTestUser,
  };
}

export function toSafeAiGenerationAccessMetadata(access: AiGenerationAccess) {
  return {
    allowed: access.allowed,
    reason: access.reason,
    free_limit: access.freeLimit,
    freeLimit: access.freeLimit,
    plan: access.plan,
    block_reason: access.blockReason,
    blockReason: access.blockReason,
    successful_used: access.usedSuccessfulGenerations,
    used_successful_generations: access.usedSuccessfulGenerations,
    usedSuccessfulGenerations: access.usedSuccessfulGenerations,
    active_reserved: access.activeReserved,
    activeReserved: access.activeReserved,
    monthly_limit: access.monthlyLimit,
    monthlyLimit: access.monthlyLimit,
    remaining_to_start: access.remainingToStart,
    remainingToStart: access.remainingToStart,
    remaining: access.remaining,
    free_successful_used: access.freeSuccessfulUsed,
    freeSuccessfulUsed: access.freeSuccessfulUsed,
    free_active_reserved: access.freeActiveReserved,
    freeActiveReserved: access.freeActiveReserved,
    free_remaining_to_start: access.freeRemainingToStart,
    freeRemainingToStart: access.freeRemainingToStart,
    premium_monthly_limit: access.premiumMonthlyLimit,
    premiumMonthlyLimit: access.premiumMonthlyLimit,
    premium_monthly_successful_used: access.premiumMonthlySuccessfulUsed,
    premiumMonthlySuccessfulUsed: access.premiumMonthlySuccessfulUsed,
    premium_monthly_active_reserved: access.premiumMonthlyActiveReserved,
    premiumMonthlyActiveReserved: access.premiumMonthlyActiveReserved,
    premium_monthly_remaining_to_start: access.premiumMonthlyRemainingToStart,
    premiumMonthlyRemainingToStart: access.premiumMonthlyRemainingToStart,
    can_start_ai_job: access.allowed,
    canStartAiJob: access.allowed,
    is_premium_or_tester: access.isPremiumOrTester,
    isPremiumOrTester: access.isPremiumOrTester,
    role: access.role,
    premium_active: access.premiumActive,
    premiumActive: access.premiumActive,
    is_test_user: access.isTestUser,
    isTestUser: access.isTestUser,
  } satisfies Json;
}

function buildSuccessfulAiJobsCountQuery(
  adminClient: AccessSupabaseClient,
  userId: string,
) {
  return adminClient
    .from("media_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .not("result_recipe_card_id", "is", null)
    .not("ai_provider", "is", null);
}

function buildActiveAiJobsCountQuery(
  adminClient: AccessSupabaseClient,
  userId: string,
) {
  return adminClient
    .from("media_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ACTIVE_AI_JOB_STATUSES);
}

function buildMonthlyAccess({
  reason,
  role,
  monthlyLimit,
  usedThisMonth,
  usedSuccessfulGenerations,
  activeReserved,
  monthlyActiveReserved,
  freeLimit,
  freeRemaining,
  premiumActive,
  isTestUser,
  isPremiumOrTester,
}: {
  reason: Exclude<AiGenerationAccessReason, "free_credit_available">;
  role: string;
  monthlyLimit: number;
  usedThisMonth: number;
  usedSuccessfulGenerations: number;
  activeReserved: number;
  monthlyActiveReserved: number;
  freeLimit: number;
  freeRemaining: number;
  premiumActive: boolean;
  isTestUser: boolean;
  isPremiumOrTester: boolean;
}): AiGenerationAccess {
  const remaining = Math.max(
    0,
    monthlyLimit - usedThisMonth - monthlyActiveReserved,
  );

  return {
    allowed: remaining > 0,
    reason: remaining > 0 ? reason : "limit_reached",
    plan: "premium",
    blockReason: remaining > 0 ? null : "premium_monthly_limit_reached",
    freeLimit,
    usedSuccessfulGenerations,
    activeReserved,
    freeSuccessfulUsed: usedSuccessfulGenerations,
    freeActiveReserved: activeReserved,
    freeRemainingToStart: freeRemaining,
    premiumMonthlyLimit: monthlyLimit,
    premiumMonthlySuccessfulUsed: usedThisMonth,
    premiumMonthlyActiveReserved: monthlyActiveReserved,
    premiumMonthlyRemainingToStart: remaining,
    remainingToStart: remaining,
    isPremiumOrTester,
    monthlyLimit,
    remaining,
    role,
    premiumActive,
    isTestUser,
  };
}

function getFreeAiGenerationLimit() {
  const value = Number(Deno.env.get("FREE_AI_GENERATION_LIMIT"));

  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 3;
}

function normalizeRole(role: string | null | undefined) {
  const normalizedRole = role?.trim().toLowerCase();

  return normalizedRole || "free";
}

function getMonthlyLimitOverride(profile: UserProfile | null | undefined) {
  const value = profile?.ai_monthly_limit_override;

  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function isPremiumActive(profile: UserProfile | null | undefined) {
  return evaluateRevenueCatPremium(profile).active;
}

export function evaluateRevenueCatPremium(
  profile: UserProfile | null | undefined,
  nowMs = Date.now(),
) {
  if (
    profile?.revenuecat_entitlement !== REVENUECAT_ENTITLEMENT_PREMIUM ||
    profile.revenuecat_entitlement_active !== true
  ) {
    return { active: false, expiryApplied: false };
  }

  if (profile.revenuecat_expires_at === null) {
    return { active: true, expiryApplied: false };
  }

  const expiresAtMs = Date.parse(profile.revenuecat_expires_at);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
    return { active: false, expiryApplied: true };
  }

  return { active: true, expiryApplied: false };
}

async function logAiAccessExpiryApplied(userId: string) {
  const hmacSecret = Deno.env.get("REVENUECAT_BINDING_HMAC_SECRET")?.trim();
  const environment = Deno.env.get("SUPABASE_ENV_NAME")?.trim().toLowerCase();

  if (
    !hmacSecret || hmacSecret.length < 32 || !environment ||
    !/^[a-z0-9_-]{1,40}$/.test(environment)
  ) {
    return;
  }

  const userHash = await hmacSha256Hex(
    hmacSecret,
    `user:${environment}:${userId}`,
  );
  console.log(JSON.stringify({
    event: "ai_access_expiry_applied",
    supabase_user_hash: userHash,
    environment,
    trigger: "ai_access_check",
    status_class: "2xx",
    sync_result: "cached_premium_expired",
    entitlement_active: false,
    freshness: "cached",
    latency_bucket: "not_measured",
    attempt_count: 0,
  }));
}

function getCurrentMonthStartIso() {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString();
}

function getNextMonthStartIso() {
  const now = new Date();

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString();
}
