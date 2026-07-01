import type { SupabaseClient } from "@supabase/supabase-js";

export const REVENUECAT_ENTITLEMENT_PREMIUM = "premium";
export const FREE_AI_GENERATION_LIMIT = 3;
export const PREMIUM_MONTHLY_AI_LIMIT = 60;
export const TESTER_MONTHLY_AI_LIMIT = 100;
export const ADMIN_MONTHLY_AI_LIMIT = 10_000;

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type UserProfile = {
  user_id: string;
  role: string | null;
  is_test_user: boolean | null;
  ai_monthly_limit_override: number | null;
  revenuecat_entitlement: string | null;
  revenuecat_entitlement_active: boolean | null;
};

export type AiGenerationAccessReason =
  | "free_credit_available"
  | "premium_active"
  | "admin_override"
  | "tester_override"
  | "limit_reached";

export type AiGenerationAccess = {
  allowed: boolean;
  reason: AiGenerationAccessReason;
  freeLimit: number;
  usedSuccessfulGenerations: number;
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
  const [profileResult, lifetimeCountResult, monthlyCountResult] =
    await Promise.all([
      adminClient
        .from("user_profiles")
        .select(
          "role, is_test_user, ai_monthly_limit_override, revenuecat_entitlement, revenuecat_entitlement_active",
        )
        .eq("user_id", userId)
        .maybeSingle<UserProfile>(),
      buildSuccessfulAiJobsCountQuery(adminClient, userId),
      buildSuccessfulAiJobsCountQuery(adminClient, userId)
        .gte("completed_at", getCurrentMonthStartIso())
        .lt("completed_at", getNextMonthStartIso()),
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

  const profile = profileResult.data;
  const role = normalizeRole(profile?.role);
  const usedSuccessfulGenerations = lifetimeCountResult.count ?? 0;
  const usedThisMonth = monthlyCountResult.count ?? 0;
  const override = getMonthlyLimitOverride(profile);
  const premiumActive = isPremiumActive(profile, role);
  const isTestUser = role === "tester" || profile?.is_test_user === true;

  if (role === "admin") {
    return buildMonthlyAccess({
      reason: "admin_override",
      role,
      monthlyLimit: override ?? ADMIN_MONTHLY_AI_LIMIT,
      usedThisMonth,
      usedSuccessfulGenerations,
      premiumActive,
      isTestUser,
    });
  }

  if (isTestUser) {
    return buildMonthlyAccess({
      reason: "tester_override",
      role,
      monthlyLimit: override ?? TESTER_MONTHLY_AI_LIMIT,
      usedThisMonth,
      usedSuccessfulGenerations,
      premiumActive,
      isTestUser,
    });
  }

  if (premiumActive) {
    return buildMonthlyAccess({
      reason: "premium_active",
      role,
      monthlyLimit: override ?? PREMIUM_MONTHLY_AI_LIMIT,
      usedThisMonth,
      usedSuccessfulGenerations,
      premiumActive,
      isTestUser,
    });
  }

  const freeRemaining = Math.max(
    0,
    FREE_AI_GENERATION_LIMIT - usedSuccessfulGenerations,
  );

  return {
    allowed: freeRemaining > 0,
    reason: freeRemaining > 0 ? "free_credit_available" : "limit_reached",
    freeLimit: FREE_AI_GENERATION_LIMIT,
    usedSuccessfulGenerations,
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
    used_successful_generations: access.usedSuccessfulGenerations,
    monthly_limit: access.monthlyLimit,
    remaining: access.remaining,
    role: access.role,
    premium_active: access.premiumActive,
    is_test_user: access.isTestUser,
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

function buildMonthlyAccess({
  reason,
  role,
  monthlyLimit,
  usedThisMonth,
  usedSuccessfulGenerations,
  premiumActive,
  isTestUser,
}: {
  reason: Exclude<AiGenerationAccessReason, "free_credit_available">;
  role: string;
  monthlyLimit: number;
  usedThisMonth: number;
  usedSuccessfulGenerations: number;
  premiumActive: boolean;
  isTestUser: boolean;
}): AiGenerationAccess {
  const remaining = Math.max(0, monthlyLimit - usedThisMonth);

  return {
    allowed: remaining > 0,
    reason: remaining > 0 ? reason : "limit_reached",
    freeLimit: FREE_AI_GENERATION_LIMIT,
    usedSuccessfulGenerations,
    monthlyLimit,
    remaining,
    role,
    premiumActive,
    isTestUser,
  };
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

function isPremiumActive(
  profile: UserProfile | null | undefined,
  role: string,
) {
  return role === "premium" ||
    (
      profile?.revenuecat_entitlement === REVENUECAT_ENTITLEMENT_PREMIUM &&
      profile.revenuecat_entitlement_active === true
    );
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
