export const SYNC_CONFIGURATION_NAMES = [
  "RECIPE_DOST_ENV",
  "REVENUECAT_BINDING_HMAC_SECRET",
  "REVENUECAT_API_KEY",
  "REVENUECAT_ENTITLEMENT_ID",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
] as const;

export type SyncConfigurationName = typeof SYNC_CONFIGURATION_NAMES[number];
export type RecipeDostEnvironment = "development" | "production";
export type EnvironmentReader = (name: string) => string | undefined;

export type SyncRuntimeConfiguration = {
  environment: RecipeDostEnvironment;
  revenueCatApiKey: string;
  entitlementId: string;
  hmacSecret: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServerKey: string;
};

export type SupabaseRuntimeConfiguration = Pick<
  SyncRuntimeConfiguration,
  "supabaseUrl" | "supabasePublishableKey" | "supabaseServerKey"
>;

export type SyncConfigurationInspection = {
  ok: boolean;
  configuration?: SyncRuntimeConfiguration;
  supabaseConfiguration?: SupabaseRuntimeConfiguration;
  environment?: RecipeDostEnvironment;
  correlationHmacSecret?: string;
  missingConfigNames: SyncConfigurationName[];
  invalidConfigNames: SyncConfigurationName[];
};

export function inspectSyncConfiguration(
  getEnvironment: EnvironmentReader,
): SyncConfigurationInspection {
  const rawEnvironment = readTrimmed(getEnvironment, "RECIPE_DOST_ENV");
  const environment = normalizeEnvironment(rawEnvironment);
  const hmacSecret = readTrimmed(
    getEnvironment,
    "REVENUECAT_BINDING_HMAC_SECRET",
  );
  const revenueCatApiKey = readTrimmed(getEnvironment, "REVENUECAT_API_KEY");
  const entitlementId = readTrimmed(
    getEnvironment,
    "REVENUECAT_ENTITLEMENT_ID",
  );
  const supabaseUrl = readTrimmed(getEnvironment, "SUPABASE_URL");
  const supabasePublishableKey = readTrimmed(
    getEnvironment,
    "SUPABASE_ANON_KEY",
  ) ?? readTrimmed(getEnvironment, "SUPABASE_PUBLISHABLE_KEY");
  const supabaseServerKey = readTrimmed(
    getEnvironment,
    "SUPABASE_SERVICE_ROLE_KEY",
  ) ?? readTrimmed(getEnvironment, "SUPABASE_SECRET_KEY");

  const missingConfigNames: SyncConfigurationName[] = [];
  const invalidConfigNames: SyncConfigurationName[] = [];

  if (!rawEnvironment) missingConfigNames.push("RECIPE_DOST_ENV");
  else if (!environment) invalidConfigNames.push("RECIPE_DOST_ENV");

  if (!hmacSecret) {
    missingConfigNames.push("REVENUECAT_BINDING_HMAC_SECRET");
  } else if (hmacSecret.length < 32) {
    invalidConfigNames.push("REVENUECAT_BINDING_HMAC_SECRET");
  }
  if (!revenueCatApiKey) missingConfigNames.push("REVENUECAT_API_KEY");
  if (!entitlementId) missingConfigNames.push("REVENUECAT_ENTITLEMENT_ID");
  if (!supabaseUrl) missingConfigNames.push("SUPABASE_URL");
  if (!supabasePublishableKey) {
    missingConfigNames.push("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
  }
  if (!supabaseServerKey) {
    missingConfigNames.push(
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SECRET_KEY",
    );
  }

  const supabaseConfiguration = supabaseUrl && supabasePublishableKey &&
      supabaseServerKey
    ? { supabaseUrl, supabasePublishableKey, supabaseServerKey }
    : undefined;
  const correlationHmacSecret = environment && hmacSecret &&
      hmacSecret.length >= 32
    ? hmacSecret
    : undefined;
  const ok = missingConfigNames.length === 0 &&
    invalidConfigNames.length === 0;

  return {
    ok,
    configuration: ok && environment && revenueCatApiKey && entitlementId &&
        correlationHmacSecret && supabaseConfiguration
      ? {
        environment,
        revenueCatApiKey,
        entitlementId,
        hmacSecret: correlationHmacSecret,
        ...supabaseConfiguration,
      }
      : undefined,
    supabaseConfiguration,
    environment,
    correlationHmacSecret,
    missingConfigNames,
    invalidConfigNames,
  };
}

export function normalizeEnvironment(
  value: string | undefined,
): RecipeDostEnvironment | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized === "development" || normalized === "production"
    ? normalized
    : undefined;
}

function readTrimmed(getEnvironment: EnvironmentReader, name: string) {
  const value = getEnvironment(name)?.trim();
  return value || undefined;
}
