import assert from "node:assert/strict";
import {
  calculateAiGenerationAccess,
  evaluateRevenueCatPremium,
  type UserProfile,
} from "./ai-access.ts";

const NOW = Date.parse("2026-07-22T12:00:00.000Z");

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: "11111111-1111-4111-8111-111111111111",
    role: "free",
    is_test_user: false,
    ai_monthly_limit_override: null,
    revenuecat_entitlement: null,
    revenuecat_entitlement_active: false,
    revenuecat_expires_at: null,
    ...overrides,
  };
}

function access(
  userProfile: UserProfile,
  overrides: Partial<{
    usedSuccessfulGenerations: number;
    usedThisMonth: number;
    activeReserved: number;
    monthlyActiveReserved: number;
  }> = {},
) {
  return calculateAiGenerationAccess({
    profile: userProfile,
    usedSuccessfulGenerations: 0,
    usedThisMonth: 0,
    activeReserved: 0,
    monthlyActiveReserved: 0,
    ...overrides,
  });
}

Deno.test("RevenueCat Premium accepts future expiry", () => {
  assert.deepEqual(
    evaluateRevenueCatPremium(
      profile({
        revenuecat_entitlement: "premium",
        revenuecat_entitlement_active: true,
        revenuecat_expires_at: "2026-07-22T12:00:00.001Z",
      }),
      NOW,
    ),
    { active: true, expiryApplied: false },
  );
});

Deno.test("RevenueCat Premium rejects exact expiry boundary", () => {
  assert.deepEqual(
    evaluateRevenueCatPremium(
      profile({
        revenuecat_entitlement: "premium",
        revenuecat_entitlement_active: true,
        revenuecat_expires_at: "2026-07-22T12:00:00.000Z",
      }),
      NOW,
    ),
    { active: false, expiryApplied: true },
  );
});

Deno.test("RevenueCat Premium rejects past or invalid expiry", () => {
  assert.equal(
    evaluateRevenueCatPremium(
      profile({
        revenuecat_entitlement: "premium",
        revenuecat_entitlement_active: true,
        revenuecat_expires_at: "2026-07-01T00:00:00.000Z",
      }),
      NOW,
    ).active,
    false,
  );
  assert.equal(
    evaluateRevenueCatPremium(
      profile({
        revenuecat_entitlement: "premium",
        revenuecat_entitlement_active: true,
        revenuecat_expires_at: "invalid",
      }),
      NOW,
    ).active,
    false,
  );
});

Deno.test("RevenueCat Premium permits a non-expiring null expiry", () => {
  assert.deepEqual(
    evaluateRevenueCatPremium(
      profile({
        revenuecat_entitlement: "premium",
        revenuecat_entitlement_active: true,
        revenuecat_expires_at: null,
      }),
      NOW,
    ),
    { active: true, expiryApplied: false },
  );
});

Deno.test("free allowance remains three total with reservations", () => {
  assert.equal(
    access(profile(), { usedSuccessfulGenerations: 2 }).allowed,
    true,
  );
  assert.equal(
    access(profile(), {
      usedSuccessfulGenerations: 2,
      activeReserved: 1,
    }).allowed,
    false,
  );
  assert.equal(
    access(profile(), { usedSuccessfulGenerations: 3 }).blockReason,
    "free_ai_limit_reached",
  );
});

Deno.test("Premium allowance remains 100 monthly with reservations", () => {
  const premium = profile({
    revenuecat_entitlement: "premium",
    revenuecat_entitlement_active: true,
    revenuecat_expires_at: null,
  });
  assert.equal(access(premium, { usedThisMonth: 99 }).allowed, true);
  const blocked = access(premium, {
    usedThisMonth: 99,
    monthlyActiveReserved: 1,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.monthlyLimit, 100);
  assert.equal(blocked.blockReason, "premium_monthly_limit_reached");
});

Deno.test("tester and admin rules remain unaffected by RevenueCat expiry", () => {
  const expired = {
    revenuecat_entitlement: "premium",
    revenuecat_entitlement_active: true,
    revenuecat_expires_at: "2026-07-01T00:00:00.000Z",
  };
  const tester = access(profile({ role: "tester", ...expired }));
  const admin = access(profile({ role: "admin", ...expired }));
  assert.equal(tester.reason, "tester_override");
  assert.equal(tester.monthlyLimit, 100);
  assert.equal(admin.reason, "admin_override");
  assert.equal(admin.monthlyLimit, 10_000);
});
