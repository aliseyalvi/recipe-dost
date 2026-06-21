import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RecipePlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "other";

type Difficulty = "easy" | "medium" | "hard";
type Confidence = "high" | "medium" | "low";
type AiProvider =
  | "mock"
  | "gemini"
  | "openai"
  | "openrouter"
  | "kimi"
  | "anthropic";

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json | undefined };

type RecipeItem = {
  id: string;
  user_id: string;
  source_url: string;
  platform: string | null;
  title: string | null;
  description: string | null;
  user_note: string | null;
  pasted_caption: string | null;
  manual_ingredients: string | null;
  meal_type: string | null;
  cuisine: string | null;
  metadata_status: string | null;
};

type RecipeCardPayload = {
  recipe_id: string;
  user_id: string;
  recipe_title: string;
  short_summary: string;
  ingredients_json: Json;
  steps_json: Json;
  time_json: Json;
  servings: string;
  difficulty: string;
  grocery_list_json: Json;
  tags_json: Json;
  substitutions_json: Json;
  storage_tip: string;
  safety_note: string;
  confidence: string;
  missing_info_json: Json;
  source_link: string;
  model_used: string;
  prompt_version: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
};

type UsageCounterRow = {
  id: string;
  user_id: string;
  period: string;
  recipe_cards_used: number;
  grocery_lists_used: number;
  saved_links_used: number;
  total_tokens: number;
  estimated_cost: number;
  created_at: string;
  updated_at: string;
};

type UsageCounterInsert = {
  user_id: string;
  period: string;
  recipe_cards_used?: number;
  grocery_lists_used?: number;
  saved_links_used?: number;
  total_tokens?: number;
  estimated_cost?: number;
};

type UsageCounterUpdate = Partial<
  Pick<
    UsageCounterRow,
    | "recipe_cards_used"
    | "grocery_lists_used"
    | "saved_links_used"
    | "total_tokens"
    | "estimated_cost"
    | "updated_at"
  >
>;

type Database = {
  public: {
    Tables: {
      recipe_items: {
        Row: RecipeItem;
        Insert: Omit<RecipeItem, "id"> & { id?: string };
        Update: Partial<RecipeItem>;
        Relationships: [];
      };
      recipe_cards: {
        Row: RecipeCardPayload & {
          id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: RecipeCardPayload & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<RecipeCardPayload> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      usage_counters: {
        Row: UsageCounterRow;
        Insert: UsageCounterInsert;
        Update: UsageCounterUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type GeneratedRecipeCard = {
  recipe_title: string;
  source_platform: RecipePlatform;
  short_summary: string;
  ingredients: {
    name: string;
    quantity: string;
    notes: string;
  }[];
  steps: {
    step_number: number;
    instruction: string;
    urdu_or_roman_urdu_tip: string;
  }[];
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: string;
  difficulty: Difficulty;
  grocery_list: string[];
  tags: string[];
  local_substitutions: {
    original: string;
    substitute: string;
    note: string;
  }[];
  storage_tip: string;
  safety_note: string;
  confidence: Confidence;
  missing_info: string[];
  source_link: string;
};

type GenerateCardSuccess = {
  ok: true;
  data: {
    recipe_card_id: string;
    recipe_id: string;
    recipe_title: string;
    confidence: Confidence;
  };
  usage: {
    free_recipe_cards_remaining: number;
    should_show_paywall: boolean;
  };
};

type GenerateCardErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "unsupported_ai_provider"
  | "recipe_not_found"
  | "free_limit_reached"
  | "missing_gemini_key"
  | "gemini_rate_limited"
  | "gemini_bad_request"
  | "gemini_invalid_key_or_forbidden"
  | "gemini_model_not_found"
  | "gemini_request_failed"
  | "missing_openai_key"
  | "openai_rate_limited"
  | "openai_insufficient_quota"
  | "openai_invalid_api_key"
  | "openai_model_forbidden"
  | "openai_model_not_found"
  | "openai_bad_request"
  | "openai_request_failed"
  | "missing_openrouter_key"
  | "openrouter_rate_limited"
  | "openrouter_bad_request"
  | "openrouter_invalid_key_or_forbidden"
  | "openrouter_model_not_found"
  | "openrouter_request_failed"
  | "missing_kimi_key"
  | "kimi_rate_limited"
  | "kimi_bad_request"
  | "kimi_invalid_key_or_forbidden"
  | "kimi_model_not_found"
  | "kimi_request_failed"
  | "missing_anthropic_key"
  | "missing_anthropic_model"
  | "anthropic_not_implemented"
  | "invalid_ai_output"
  | "db_insert_failed"
  | "unexpected_generate_card_error";

type GenerateCardError = {
  ok: false;
  error: {
    code: GenerateCardErrorCode;
    message: string;
  };
};

type EdgeSupabaseClient = SupabaseClient<Database>;

type RecipeGenerationInput = {
  source_link: string;
  platform: RecipePlatform;
  title: string | null;
  description: string | null;
  user_note: string | null;
  pasted_caption: string | null;
  manual_ingredients: string | null;
  meal_type: string | null;
  cuisine: string | null;
  metadata_status: string | null;
};

type RecipeGenerationTextKey = Exclude<
  keyof RecipeGenerationInput,
  "source_link" | "platform"
>;

type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

type ProviderSuccess = {
  ok: true;
  provider: AiProvider;
  modelUsed: string;
  promptVersion: string;
  card: GeneratedRecipeCard;
  usage: TokenUsage;
};

type ProviderFailure = {
  ok: false;
  provider: AiProvider;
  stage: string;
  status: number;
  response: GenerateCardError;
  logError?: unknown;
  logExtra?: SafeLogExtra;
};

type ProviderResult = ProviderSuccess | ProviderFailure;

type SafeLogExtra = {
  provider?: AiProvider;
  status?: number;
  model?: string;
};

type ProviderConfig = {
  provider: AiProvider;
  model: string;
  promptVersion: string;
  apiKey?: string;
  baseUrl?: string;
};

declare const Deno: {
  serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const defaultFreeRecipeCardLimit = 3;
const defaultProvider: AiProvider = "gemini";
const defaultMaxInputChars = 6000;
const defaultGeminiModel = "gemini-2.5-flash-lite";
const defaultOpenAiModel = "gpt-4o-mini";
const defaultKimiBaseUrl = "https://api.moonshot.ai/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const openAiRecipeCardJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "recipe_title",
    "source_platform",
    "short_summary",
    "ingredients",
    "steps",
    "prep_time_minutes",
    "cook_time_minutes",
    "servings",
    "difficulty",
    "grocery_list",
    "tags",
    "local_substitutions",
    "storage_tip",
    "safety_note",
    "confidence",
    "missing_info",
    "source_link",
  ],
  properties: {
    recipe_title: { type: "string" },
    source_platform: {
      type: "string",
      enum: ["instagram", "tiktok", "youtube", "facebook", "other"],
    },
    short_summary: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "notes"],
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step_number", "instruction", "urdu_or_roman_urdu_tip"],
        properties: {
          step_number: { type: "number" },
          instruction: { type: "string" },
          urdu_or_roman_urdu_tip: { type: "string" },
        },
      },
    },
    prep_time_minutes: { type: "number" },
    cook_time_minutes: { type: "number" },
    servings: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    grocery_list: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    local_substitutions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "substitute", "note"],
        properties: {
          original: { type: "string" },
          substitute: { type: "string" },
          note: { type: "string" },
        },
      },
    },
    storage_tip: { type: "string" },
    safety_note: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    missing_info: { type: "array", items: { type: "string" } },
    source_link: { type: "string" },
  },
} as const;

const geminiRecipeCardSchema = {
  type: "OBJECT",
  required: openAiRecipeCardJsonSchema.required,
  properties: {
    recipe_title: { type: "STRING" },
    source_platform: {
      type: "STRING",
      enum: ["instagram", "tiktok", "youtube", "facebook", "other"],
    },
    short_summary: { type: "STRING" },
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["name", "quantity", "notes"],
        properties: {
          name: { type: "STRING" },
          quantity: { type: "STRING" },
          notes: { type: "STRING" },
        },
      },
    },
    steps: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["step_number", "instruction", "urdu_or_roman_urdu_tip"],
        properties: {
          step_number: { type: "NUMBER" },
          instruction: { type: "STRING" },
          urdu_or_roman_urdu_tip: { type: "STRING" },
        },
      },
    },
    prep_time_minutes: { type: "NUMBER" },
    cook_time_minutes: { type: "NUMBER" },
    servings: { type: "STRING" },
    difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
    grocery_list: { type: "ARRAY", items: { type: "STRING" } },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    local_substitutions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["original", "substitute", "note"],
        properties: {
          original: { type: "STRING" },
          substitute: { type: "STRING" },
          note: { type: "STRING" },
        },
      },
    },
    storage_tip: { type: "STRING" },
    safety_note: { type: "STRING" },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    missing_info: { type: "ARRAY", items: { type: "STRING" } },
    source_link: { type: "STRING" },
  },
} as const;

Deno.serve((request) =>
  handleGenerateCardRequest(request).catch((error) =>
    errorResponse(
      "unexpected",
      "unexpected_generate_card_error",
      "Something went wrong while creating your recipe card.",
      500,
      error,
    )
  )
);

async function handleGenerateCardRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return errorResponse(
      "request_method",
      "invalid_request",
      "Use POST to generate a recipe card.",
      405,
    );
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse(
      "auth_header",
      "unauthorized",
      "Sign in to generate a recipe card.",
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return errorResponse(
      "supabase_config",
      "unexpected_generate_card_error",
      "Recipe card generation is not configured yet.",
      500,
    );
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      "auth_user",
      "unauthorized",
      "Sign in to generate a recipe card.",
      401,
      authError,
    );
  }

  const providerConfigResult = getProviderConfig();

  if (!providerConfigResult.ok) {
    return errorResponse(
      "provider_config",
      providerConfigResult.response.error.code,
      providerConfigResult.response.error.message,
      providerConfigResult.status,
      providerConfigResult.response.error.message,
      providerConfigResult.logExtra,
    );
  }

  const providerConfig = providerConfigResult.config;
  const freeRecipeCardLimit = getFreeRecipeCardLimit();
  const maxInputChars = getPositiveInteger(
    Deno.env.get("MAX_INPUT_CHARS"),
    defaultMaxInputChars,
  );

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "request_json",
      "invalid_request",
      "Send a JSON body with a recipe_id field.",
      400,
    );
  }

  const recipeIdValidation = validateRecipeId(body);

  if (!recipeIdValidation.ok) {
    return errorResponse(
      "request_validation",
      recipeIdValidation.response.error.code,
      recipeIdValidation.response.error.message,
      recipeIdValidation.status,
    );
  }

  const recipeResult = await supabase
    .from("recipe_items")
    .select(
      "id, user_id, source_url, platform, title, description, user_note, pasted_caption, manual_ingredients, meal_type, cuisine, metadata_status",
    )
    .eq("id", recipeIdValidation.recipeId)
    .eq("user_id", user.id)
    .maybeSingle<RecipeItem>();

  if (recipeResult.error || !recipeResult.data) {
    return errorResponse(
      "recipe_lookup",
      "recipe_not_found",
      "Recipe link not found.",
      404,
      recipeResult.error,
    );
  }

  const existingCard = await getExistingRecipeCard(
    supabase,
    recipeIdValidation.recipeId,
    user.id,
    providerConfig.promptVersion,
  );
  const currentCardCount = await countRecipeCards(supabase, user.id);

  if (currentCardCount === null) {
    return errorResponse(
      "usage_count",
      "unexpected_generate_card_error",
      "Could not check recipe card usage. Please try again.",
      500,
    );
  }

  if (!existingCard && currentCardCount >= freeRecipeCardLimit) {
    return errorResponse(
      "free_limit",
      "free_limit_reached",
      "You have used your 3 free recipe cards.",
      402,
    );
  }

  const recipeInput = buildRecipeGenerationInput(
    recipeResult.data,
    maxInputChars,
  );
  const providerResult = await generateWithProvider(
    providerConfig,
    recipeInput,
  );

  if (!providerResult.ok) {
    return errorResponse(
      providerResult.stage,
      providerResult.response.error.code,
      providerResult.response.error.message,
      providerResult.status,
      providerResult.logError,
      providerResult.logExtra,
    );
  }

  const normalizedCard = {
    ...providerResult.card,
    source_platform: recipeInput.platform,
    source_link: recipeInput.source_link,
  };
  const savedCardResult = await saveRecipeCard({
    supabase,
    existingCardId: existingCard?.id ?? null,
    recipeId: recipeResult.data.id,
    userId: user.id,
    card: normalizedCard,
    modelUsed: providerResult.modelUsed,
    promptVersion: providerResult.promptVersion,
    usage: providerResult.usage,
  });

  if (savedCardResult.error || !savedCardResult.data) {
    return errorResponse(
      "recipe_card_save",
      "db_insert_failed",
      "Recipe card was created but could not be saved.",
      500,
      savedCardResult.error,
      {
        provider: providerResult.provider,
        model: providerResult.modelUsed,
      },
    );
  }

  if (!existingCard) {
    await incrementUsageCounter(supabase, user.id);
  }

  const nextCardCount = existingCard ? currentCardCount : currentCardCount + 1;
  const freeRecipeCardsRemaining = Math.max(
    0,
    freeRecipeCardLimit - nextCardCount,
  );

  return jsonResponse({
    ok: true,
    data: {
      recipe_card_id: savedCardResult.data.id,
      recipe_id: recipeResult.data.id,
      recipe_title: normalizedCard.recipe_title,
      confidence: normalizedCard.confidence,
    },
    usage: {
      free_recipe_cards_remaining: freeRecipeCardsRemaining,
      should_show_paywall: freeRecipeCardsRemaining <= 0,
    },
  });
}

function getProviderConfig():
  | { ok: true; config: ProviderConfig }
  | {
    ok: false;
    status: number;
    response: GenerateCardError;
    logExtra?: SafeLogExtra;
  } {
  const providerValue = (Deno.env.get("AI_PROVIDER")?.trim().toLowerCase() ||
    defaultProvider) as AiProvider;

  if (!isAiProvider(providerValue)) {
    return providerConfigError(
      "unsupported_ai_provider",
      "AI provider is not supported.",
      providerValue,
    );
  }

  switch (providerValue) {
    case "mock":
      return {
        ok: true,
        config: {
          provider: "mock",
          model: "mock",
          promptVersion: "mock-v1",
        },
      };
    case "gemini": {
      const apiKey = Deno.env.get("GEMINI_API_KEY");
      const model = Deno.env.get("GEMINI_MODEL")?.trim() || defaultGeminiModel;

      if (!apiKey) {
        return providerConfigError(
          "missing_gemini_key",
          "Gemini generation is not configured yet.",
          providerValue,
          model,
        );
      }

      return {
        ok: true,
        config: {
          provider: "gemini",
          apiKey,
          model,
          promptVersion: "recipe-card-v1-gemini",
        },
      };
    }
    case "openai": {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      const model = Deno.env.get("OPENAI_MODEL")?.trim() || defaultOpenAiModel;

      if (!apiKey) {
        return providerConfigError(
          "missing_openai_key",
          "AI generation is not configured yet.",
          providerValue,
          model,
        );
      }

      return {
        ok: true,
        config: {
          provider: "openai",
          apiKey,
          model,
          promptVersion: "recipe-card-v1-openai",
        },
      };
    }
    case "openrouter": {
      const apiKey = Deno.env.get("OPENROUTER_API_KEY");
      const model = Deno.env.get("OPENROUTER_MODEL")?.trim();

      if (!apiKey) {
        return providerConfigError(
          "missing_openrouter_key",
          "OpenRouter generation is not configured yet.",
          providerValue,
          model,
        );
      }

      if (!model) {
        return providerConfigError(
          "openrouter_bad_request",
          "OpenRouter model is not configured yet.",
          providerValue,
        );
      }

      return {
        ok: true,
        config: {
          provider: "openrouter",
          apiKey,
          model,
          promptVersion: "recipe-card-v1-openrouter",
          baseUrl: "https://openrouter.ai/api/v1",
        },
      };
    }
    case "kimi": {
      const apiKey = Deno.env.get("KIMI_API_KEY");
      const model = Deno.env.get("KIMI_MODEL")?.trim();
      const baseUrl = Deno.env.get("KIMI_BASE_URL")?.trim() ||
        defaultKimiBaseUrl;

      if (!apiKey) {
        return providerConfigError(
          "missing_kimi_key",
          "Kimi generation is not configured yet.",
          providerValue,
          model,
        );
      }

      if (!model) {
        return providerConfigError(
          "kimi_bad_request",
          "Kimi model is not configured yet.",
          providerValue,
        );
      }

      return {
        ok: true,
        config: {
          provider: "kimi",
          apiKey,
          model,
          promptVersion: "recipe-card-v1-kimi",
          baseUrl,
        },
      };
    }
    case "anthropic": {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      const model = Deno.env.get("ANTHROPIC_MODEL")?.trim();

      if (!apiKey) {
        return providerConfigError(
          "missing_anthropic_key",
          "Anthropic generation is not configured yet.",
          providerValue,
          model,
        );
      }

      if (!model) {
        return providerConfigError(
          "missing_anthropic_model",
          "Anthropic model is not configured yet.",
          providerValue,
        );
      }

      return {
        ok: true,
        config: {
          provider: "anthropic",
          apiKey,
          model,
          promptVersion: "recipe-card-v1-anthropic",
        },
      };
    }
  }
}

function providerConfigError(
  code: GenerateCardErrorCode,
  message: string,
  provider: string,
  model?: string,
) {
  return {
    ok: false as const,
    status: 500,
    response: {
      ok: false as const,
      error: {
        code,
        message,
      },
    },
    logExtra: {
      provider: isAiProvider(provider) ? provider : undefined,
      model,
    },
  };
}

async function generateWithProvider(
  config: ProviderConfig,
  recipeInput: RecipeGenerationInput,
): Promise<ProviderResult> {
  switch (config.provider) {
    case "mock":
      return generateWithMock(config, recipeInput);
    case "gemini":
      return generateWithGemini(config, recipeInput);
    case "openai":
      return generateWithOpenAI(config, recipeInput);
    case "openrouter":
      return generateWithOpenAiCompatibleChat(config, recipeInput);
    case "kimi":
      return generateWithOpenAiCompatibleChat(config, recipeInput);
    case "anthropic":
      return generateWithAnthropic(config, recipeInput);
  }
}

function generateWithMock(
  config: ProviderConfig,
  recipeInput: RecipeGenerationInput,
): ProviderSuccess {
  const ingredientNames = getIngredientNames(recipeInput.manual_ingredients);
  const ingredients = ingredientNames.map((name) => ({
    name,
    quantity: "estimated",
    notes: "Mock ingredient based on saved notes or manual ingredients.",
  }));
  const card: GeneratedRecipeCard = {
    recipe_title: getMockRecipeTitle(recipeInput),
    source_platform: recipeInput.platform,
    short_summary:
      "Mock recipe card generated from saved link details for offline testing.",
    ingredients,
    steps: [
      {
        step_number: 1,
        instruction:
          "Review the saved caption, notes, and manual ingredients before cooking.",
        urdu_or_roman_urdu_tip:
          "Cooking se pehle caption aur apne notes zaroor check karein.",
      },
      {
        step_number: 2,
        instruction:
          "Prepare the listed ingredients and adjust quantities to your household.",
        urdu_or_roman_urdu_tip:
          "Ingredients ko apni family size ke hisaab se adjust karein.",
      },
      {
        step_number: 3,
        instruction:
          "Cook carefully using your saved details as the source reference.",
        urdu_or_roman_urdu_tip:
          "Chicken, meat, ya eggs use kar rahe hain to achi tarah paka lein.",
      },
    ],
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    servings: "2-3 people",
    difficulty: "easy",
    grocery_list: ingredientNames,
    tags: ["mock", "saved-link"],
    local_substitutions: [],
    storage_tip: "Store leftovers in a covered container in the fridge.",
    safety_note: "Cook chicken, meat, and eggs properly before eating.",
    confidence: "low",
    missing_info: [
      "This is a mock recipe card for offline testing. Use real provider output before relying on recipe details.",
    ],
    source_link: recipeInput.source_link,
  };

  return {
    ok: true,
    provider: "mock",
    modelUsed: config.model,
    promptVersion: config.promptVersion,
    card,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
    },
  };
}

async function generateWithGemini(
  config: ProviderConfig,
  recipeInput: RecipeGenerationInput,
): Promise<ProviderResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${
    encodeURIComponent(config.model)
  }:generateContent`;
  const responseResult = await safeFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey ?? "",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildProviderPrompt(recipeInput),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
        responseSchema: geminiRecipeCardSchema,
      },
    }),
  });

  if (!responseResult.ok) {
    return providerRequestFailure(
      config,
      "gemini_fetch",
      getProviderRequestFailedCode(config.provider),
      "Gemini request failed before receiving a response.",
      502,
    );
  }

  const { response, body } = responseResult;

  if (!response.ok) {
    return providerHttpFailure(config, "gemini_response", response.status);
  }

  const text = extractGeminiText(body);
  return parseProviderCard(config, "gemini_parse", parseJson(text), body);
}

async function generateWithOpenAI(
  config: ProviderConfig,
  recipeInput: RecipeGenerationInput,
): Promise<ProviderResult> {
  const responseResult = await safeFetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: getSystemPrompt(),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildUserPrompt(recipeInput),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "recipe_card",
            strict: true,
            schema: openAiRecipeCardJsonSchema,
          },
        },
      }),
    },
  );

  if (!responseResult.ok) {
    return providerRequestFailure(
      config,
      "openai_fetch",
      "openai_request_failed",
      "OpenAI request failed before receiving a response.",
      502,
    );
  }

  const { response, body } = responseResult;

  if (!response.ok) {
    return providerHttpFailure(
      config,
      "openai_response",
      response.status,
      body,
    );
  }

  const parsedOutput = extractParsedOutput(body);
  const textOutput = typeof parsedOutput === "string"
    ? parsedOutput
    : extractOutputText(body);
  const rawCard = isRecord(parsedOutput) ? parsedOutput : parseJson(textOutput);
  return parseProviderCard(config, "openai_parse", rawCard, body);
}

async function generateWithOpenAiCompatibleChat(
  config: ProviderConfig,
  recipeInput: RecipeGenerationInput,
): Promise<ProviderResult> {
  const endpoint = `${
    trimTrailingSlash(config.baseUrl ?? "")
  }/chat/completions`;
  const responseResult = await safeFetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(recipeInput),
        },
      ],
      temperature: 0.3,
      response_format: {
        type: "json_object",
      },
    }),
  });

  if (!responseResult.ok) {
    return providerRequestFailure(
      config,
      `${config.provider}_fetch`,
      getProviderRequestFailedCode(config.provider),
      `${
        getProviderLabel(config.provider)
      } request failed before receiving a response.`,
      502,
    );
  }

  const { response, body } = responseResult;

  if (!response.ok) {
    return providerHttpFailure(
      config,
      `${config.provider}_response`,
      response.status,
      body,
    );
  }

  const text = extractChatCompletionText(body);
  return parseProviderCard(
    config,
    `${config.provider}_parse`,
    parseJson(text),
    body,
  );
}

async function generateWithAnthropic(
  config: ProviderConfig,
  recipeInput: RecipeGenerationInput,
): Promise<ProviderResult> {
  const responseResult = await safeFetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 3000,
        temperature: 0.3,
        system: getSystemPrompt(),
        messages: [
          {
            role: "user",
            content: buildUserPrompt(recipeInput),
          },
        ],
      }),
    },
  );

  if (!responseResult.ok) {
    return providerRequestFailure(
      config,
      "anthropic_fetch",
      "anthropic_not_implemented",
      "Anthropic request failed before receiving a response.",
      502,
    );
  }

  const { response, body } = responseResult;

  if (!response.ok) {
    return providerRequestFailure(
      config,
      "anthropic_response",
      "anthropic_not_implemented",
      "Anthropic generation is not available right now.",
      response.status >= 500 ? 502 : 400,
      response.status,
    );
  }

  const text = extractAnthropicText(body);
  return parseProviderCard(config, "anthropic_parse", parseJson(text), body);
}

function parseProviderCard(
  config: ProviderConfig,
  stage: string,
  rawCard: unknown,
  providerBody: unknown,
): ProviderResult {
  const card = validateGeneratedRecipeCard(rawCard);

  if (!card) {
    return providerRequestFailure(
      config,
      stage,
      "invalid_ai_output",
      "Recipe card could not be generated. Please add more details and try again.",
      502,
    );
  }

  return {
    ok: true,
    provider: config.provider,
    modelUsed: config.model,
    promptVersion: config.promptVersion,
    card,
    usage: getProviderUsage(config.provider, providerBody),
  };
}

function providerRequestFailure(
  config: ProviderConfig,
  stage: string,
  code: GenerateCardErrorCode,
  message: string,
  status: number,
  providerStatus?: number,
): ProviderFailure {
  return {
    ok: false,
    provider: config.provider,
    stage,
    status,
    response: {
      ok: false,
      error: {
        code,
        message,
      },
    },
    logError: message,
    logExtra: {
      provider: config.provider,
      model: config.model,
      status: providerStatus,
    },
  };
}

function providerHttpFailure(
  config: ProviderConfig,
  stage: string,
  status: number,
  body?: unknown,
): ProviderFailure {
  const code = getHttpErrorCode(config.provider, status, body);
  return providerRequestFailure(
    config,
    stage,
    code,
    getFriendlyProviderMessage(code),
    status === 429 ? 429 : 502,
    status,
  );
}

async function safeFetch(input: string, init: RequestInit) {
  try {
    const response = await fetch(input, init);
    let body: unknown = null;

    try {
      body = await response.clone().json();
    } catch {
      try {
        body = await response.clone().text();
      } catch {
        body = null;
      }
    }

    return {
      ok: true as const,
      response,
      body,
    };
  } catch {
    return {
      ok: false as const,
    };
  }
}

function getSystemPrompt() {
  return [
    "You are Recipe Dost, an AI recipe organizer for Pakistani and Urdu-English home cooks.",
    "Create a practical recipe card only from the saved link metadata, user notes, pasted caption, and manual ingredients provided.",
    "Do not fetch, open, scrape, download, summarize, or claim to have watched the source video.",
    "If details are missing, use estimated quantities and add clear missing_info instead of pretending certainty.",
    "Keep steps simple, home-cook friendly, and include Urdu or Roman Urdu cooking tips.",
    "Do not make medical, allergy, calorie, macro, diet, weight-loss, diagnosis, or disease claims.",
    "Return valid JSON only, matching the requested recipe card shape.",
  ].join("\n");
}

function buildProviderPrompt(recipeInput: RecipeGenerationInput) {
  return `${getSystemPrompt()}\n\n${buildUserPrompt(recipeInput)}`;
}

function buildUserPrompt(recipeInput: RecipeGenerationInput) {
  return JSON.stringify({
    request_type: "generate_recipe_card",
    prompt_version: "recipe-card-v1",
    output_rules: {
      response_format: "JSON object only",
      substitutions_field: "Use local_substitutions[].note, not reason.",
      uncertainty:
        "Use estimated quantities where needed and list missing details in missing_info.",
    },
    recipe_source: recipeInput,
  });
}

function buildRecipeGenerationInput(
  recipe: RecipeItem,
  maxInputChars: number,
): RecipeGenerationInput {
  const sourceInput: RecipeGenerationInput = {
    source_link: recipe.source_url,
    platform: getRecipePlatform(recipe.platform),
    title: cleanOptionalText(recipe.title),
    description: cleanOptionalText(recipe.description),
    user_note: cleanOptionalText(recipe.user_note),
    pasted_caption: cleanOptionalText(recipe.pasted_caption),
    manual_ingredients: cleanOptionalText(recipe.manual_ingredients),
    meal_type: cleanOptionalText(recipe.meal_type),
    cuisine: cleanOptionalText(recipe.cuisine),
    metadata_status: cleanOptionalText(recipe.metadata_status),
  };

  return truncateRecipeGenerationInput(sourceInput, maxInputChars);
}

function truncateRecipeGenerationInput(
  input: RecipeGenerationInput,
  maxInputChars: number,
): RecipeGenerationInput {
  const nextInput = { ...input };
  const textKeys: RecipeGenerationTextKey[] = [
    "title",
    "description",
    "user_note",
    "pasted_caption",
    "manual_ingredients",
    "meal_type",
    "cuisine",
    "metadata_status",
  ];
  let remaining = maxInputChars;

  for (const key of textKeys) {
    const value = nextInput[key];

    if (typeof value !== "string") {
      continue;
    }

    const truncatedValue = truncateText(value, Math.max(0, remaining));
    nextInput[key] = truncatedValue;
    remaining -= truncatedValue.length;
  }

  return nextInput;
}

function validateRecipeId(body: unknown):
  | {
    ok: true;
    recipeId: string;
  }
  | {
    ok: false;
    status: number;
    response: GenerateCardError;
  } {
  if (!isRecord(body) || typeof body.recipe_id !== "string") {
    return validationError(
      "invalid_request",
      "Choose a saved recipe link first.",
    );
  }

  const recipeId = body.recipe_id.trim();

  if (!recipeId) {
    return validationError(
      "invalid_request",
      "Choose a saved recipe link first.",
    );
  }

  if (!isUuid(recipeId)) {
    return validationError(
      "invalid_request",
      "Choose a valid saved recipe link.",
    );
  }

  return {
    ok: true,
    recipeId,
  };
}

function validationError(
  code: GenerateCardError["error"]["code"],
  message: string,
): {
  ok: false;
  status: number;
  response: GenerateCardError;
} {
  return {
    ok: false,
    status: 400,
    response: {
      ok: false,
      error: {
        code,
        message,
      },
    },
  };
}

async function getExistingRecipeCard(
  supabase: EdgeSupabaseClient,
  recipeId: string,
  userId: string,
  promptVersion: string,
) {
  const { data, error } = await supabase
    .from("recipe_cards")
    .select("id")
    .eq("recipe_id", recipeId)
    .eq("user_id", userId)
    .eq("prompt_version", promptVersion)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    return null;
  }

  return data;
}

async function countRecipeCards(
  supabase: EdgeSupabaseClient,
  userId: string,
) {
  const { count, error } = await supabase
    .from("recipe_cards")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId);

  if (error || count === null) {
    return null;
  }

  return count;
}

async function saveRecipeCard({
  supabase,
  existingCardId,
  recipeId,
  userId,
  card,
  modelUsed,
  promptVersion,
  usage,
}: {
  supabase: EdgeSupabaseClient;
  existingCardId: string | null;
  recipeId: string;
  userId: string;
  card: GeneratedRecipeCard;
  modelUsed: string;
  promptVersion: string;
  usage: TokenUsage;
}) {
  const recipeCardPayload: RecipeCardPayload = {
    recipe_id: recipeId,
    user_id: userId,
    recipe_title: card.recipe_title,
    short_summary: card.short_summary,
    ingredients_json: card.ingredients as unknown as Json,
    steps_json: card.steps as unknown as Json,
    time_json: {
      prep_time_minutes: card.prep_time_minutes,
      cook_time_minutes: card.cook_time_minutes,
    },
    servings: card.servings,
    difficulty: card.difficulty,
    grocery_list_json: card.grocery_list,
    tags_json: card.tags,
    substitutions_json: card.local_substitutions as unknown as Json,
    storage_tip: card.storage_tip,
    safety_note: card.safety_note,
    confidence: card.confidence,
    missing_info_json: card.missing_info,
    source_link: card.source_link,
    model_used: modelUsed,
    prompt_version: promptVersion,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    estimated_cost: 0,
  };

  return existingCardId
    ? await supabase
      .from("recipe_cards")
      .update({
        ...recipeCardPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingCardId)
      .eq("user_id", userId)
      .select("id")
      .single<{ id: string }>()
    : await supabase
      .from("recipe_cards")
      .insert(recipeCardPayload)
      .select("id")
      .single<{ id: string }>();
}

async function incrementUsageCounter(
  supabase: EdgeSupabaseClient,
  userId: string,
) {
  const period = new Date().toISOString().slice(0, 7);
  const { data: existingCounter } = await supabase
    .from("usage_counters")
    .select("id, recipe_cards_used")
    .eq("user_id", userId)
    .eq("period", period)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; recipe_cards_used: number }>();

  if (existingCounter) {
    const usageCounterUpdate: UsageCounterUpdate = {
      recipe_cards_used: existingCounter.recipe_cards_used + 1,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("usage_counters")
      .update(usageCounterUpdate)
      .eq("id", existingCounter.id)
      .eq("user_id", userId);
    return;
  }

  const usageCounterInsert: UsageCounterInsert = {
    user_id: userId,
    period,
    recipe_cards_used: 1,
  };

  await supabase
    .from("usage_counters")
    .insert(usageCounterInsert);
}

function validateGeneratedRecipeCard(
  value: unknown,
): GeneratedRecipeCard | null {
  const record = isRecord(value) ? value : null;

  if (!record) {
    return null;
  }

  const recipeTitle = getRequiredString(record.recipe_title);
  const sourcePlatform = getRecipePlatform(
    getRequiredString(record.source_platform),
  );
  const shortSummary = getRequiredString(record.short_summary);
  const prepTimeMinutes = getRequiredNumber(record.prep_time_minutes);
  const cookTimeMinutes = getRequiredNumber(record.cook_time_minutes);
  const servings = getRequiredString(record.servings);
  const difficulty = getDifficulty(record.difficulty);
  const storageTip = getRequiredString(record.storage_tip);
  const safetyNote = getRequiredString(record.safety_note);
  const confidence = getConfidence(record.confidence);
  const sourceLink = getRequiredString(record.source_link);
  const ingredients = getIngredients(record.ingredients);
  const steps = getSteps(record.steps);
  const groceryList = getStringArray(record.grocery_list);
  const tags = getStringArray(record.tags);
  const localSubstitutions = getSubstitutions(record.local_substitutions);
  const missingInfo = getStringArray(record.missing_info);

  if (
    !recipeTitle ||
    !shortSummary ||
    prepTimeMinutes === null ||
    cookTimeMinutes === null ||
    !servings ||
    !difficulty ||
    !storageTip ||
    !safetyNote ||
    !confidence ||
    !sourceLink ||
    ingredients.length === 0 ||
    steps.length === 0
  ) {
    return null;
  }

  return {
    recipe_title: recipeTitle,
    source_platform: sourcePlatform,
    short_summary: shortSummary,
    ingredients,
    steps,
    prep_time_minutes: prepTimeMinutes,
    cook_time_minutes: cookTimeMinutes,
    servings,
    difficulty,
    grocery_list: groceryList,
    tags,
    local_substitutions: localSubstitutions,
    storage_tip: storageTip,
    safety_note: safetyNote,
    confidence,
    missing_info: missingInfo,
    source_link: sourceLink,
  };
}

function getIngredients(value: unknown): GeneratedRecipeCard["ingredients"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = isRecord(item) ? item : null;

      if (!record) {
        return null;
      }

      const name = getRequiredString(record.name);
      const quantity = getRequiredString(record.quantity);
      const notes = getRequiredString(record.notes);

      if (!name || !quantity || !notes) {
        return null;
      }

      return { name, quantity, notes };
    })
    .filter((item): item is GeneratedRecipeCard["ingredients"][number] =>
      Boolean(item)
    );
}

function getSteps(value: unknown): GeneratedRecipeCard["steps"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = isRecord(item) ? item : null;

      if (!record) {
        return null;
      }

      const stepNumber = getRequiredNumber(record.step_number);
      const instruction = getRequiredString(record.instruction);
      const tip = getRequiredString(record.urdu_or_roman_urdu_tip);

      if (stepNumber === null || !instruction || !tip) {
        return null;
      }

      return {
        step_number: stepNumber,
        instruction,
        urdu_or_roman_urdu_tip: tip,
      };
    })
    .filter((item): item is GeneratedRecipeCard["steps"][number] =>
      Boolean(item)
    );
}

function getSubstitutions(
  value: unknown,
): GeneratedRecipeCard["local_substitutions"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = isRecord(item) ? item : null;

      if (!record) {
        return null;
      }

      const original = getRequiredString(record.original);
      const substitute = getRequiredString(record.substitute);
      const note = getRequiredString(record.note);

      if (!original || !substitute || !note) {
        return null;
      }

      return { original, substitute, note };
    })
    .filter((
      item,
    ): item is GeneratedRecipeCard["local_substitutions"][number] =>
      Boolean(item)
    );
}

function extractGeminiText(value: unknown) {
  const record = isRecord(value) ? value : null;
  const candidates = Array.isArray(record?.candidates) ? record.candidates : [];
  const firstCandidate = isRecord(candidates[0]) ? candidates[0] : null;
  const content = isRecord(firstCandidate?.content)
    ? firstCandidate.content
    : null;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const firstPart = isRecord(parts[0]) ? parts[0] : null;

  return getRequiredString(firstPart?.text);
}

function extractChatCompletionText(value: unknown) {
  const record = isRecord(value) ? value : null;
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const firstChoice = isRecord(choices[0]) ? choices[0] : null;
  const message = isRecord(firstChoice?.message) ? firstChoice.message : null;
  const content = message?.content;

  if (typeof content === "string") {
    return content;
  }

  return null;
}

function extractAnthropicText(value: unknown) {
  const record = isRecord(value) ? value : null;
  const content = Array.isArray(record?.content) ? record.content : [];
  const firstText = content
    .map((item) => (isRecord(item) ? getRequiredString(item.text) : null))
    .find(Boolean);

  return firstText ?? null;
}

function extractParsedOutput(value: unknown): unknown {
  const record = isRecord(value) ? value : null;

  if (!record) {
    return null;
  }

  if (isRecord(record.output_parsed)) {
    return record.output_parsed;
  }

  return findParsedValue(record.output);
}

function findParsedValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsedValue = findParsedValue(item);

      if (parsedValue) {
        return parsedValue;
      }
    }

    return null;
  }

  const record = isRecord(value) ? value : null;

  if (!record) {
    return null;
  }

  if (isRecord(record.parsed)) {
    return record.parsed;
  }

  return findParsedValue(record.content);
}

function extractOutputText(value: unknown): string | null {
  const record = isRecord(value) ? value : null;

  if (record && typeof record.output_text === "string") {
    return record.output_text.trim();
  }

  const texts: string[] = [];
  collectOutputText(record?.output, texts);

  const text = texts.join("\n").trim();
  return text || null;
}

function collectOutputText(value: unknown, texts: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectOutputText(item, texts);
    }

    return;
  }

  const record = isRecord(value) ? value : null;

  if (!record) {
    return;
  }

  if (
    typeof record.text === "string" &&
    (record.type === "output_text" || record.type === "text")
  ) {
    texts.push(record.text);
  }

  collectOutputText(record.content, texts);
  collectOutputText(record.output, texts);
}

function parseJson(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getProviderUsage(provider: AiProvider, value: unknown): TokenUsage {
  const record = isRecord(value) ? value : null;

  if (provider === "gemini") {
    const usage = isRecord(record?.usageMetadata) ? record.usageMetadata : null;
    return {
      inputTokens: getOptionalNumber(usage?.promptTokenCount) ?? 0,
      outputTokens: getOptionalNumber(usage?.candidatesTokenCount) ?? 0,
    };
  }

  if (provider === "anthropic") {
    const usage = isRecord(record?.usage) ? record.usage : null;
    return {
      inputTokens: getOptionalNumber(usage?.input_tokens) ?? 0,
      outputTokens: getOptionalNumber(usage?.output_tokens) ?? 0,
    };
  }

  const usage = isRecord(record?.usage) ? record.usage : null;
  return {
    inputTokens: getOptionalNumber(usage?.input_tokens) ??
      getOptionalNumber(usage?.prompt_tokens) ??
      0,
    outputTokens: getOptionalNumber(usage?.output_tokens) ??
      getOptionalNumber(usage?.completion_tokens) ??
      0,
  };
}

function getHttpErrorCode(
  provider: AiProvider,
  status: number,
  body?: unknown,
): GenerateCardErrorCode {
  if (provider === "mock") {
    return "unexpected_generate_card_error";
  }

  if (status === 429) {
    return `${provider}_rate_limited` as GenerateCardErrorCode;
  }

  if (provider === "openai") {
    const errorType = getProviderErrorType(body);
    const errorCode = getProviderErrorCode(body);

    if (
      status === 402 ||
      errorType === "insufficient_quota" ||
      errorCode === "insufficient_quota"
    ) {
      return "openai_insufficient_quota";
    }

    if (status === 401) {
      return "openai_invalid_api_key";
    }

    if (status === 403) {
      return "openai_model_forbidden";
    }

    if (status === 404) {
      return "openai_model_not_found";
    }

    if (status === 400) {
      return "openai_bad_request";
    }

    return "openai_request_failed";
  }

  if (status === 401 || status === 403) {
    return `${provider}_invalid_key_or_forbidden` as GenerateCardErrorCode;
  }

  if (status === 404) {
    return `${provider}_model_not_found` as GenerateCardErrorCode;
  }

  if (status === 400) {
    return `${provider}_bad_request` as GenerateCardErrorCode;
  }

  return `${provider}_request_failed` as GenerateCardErrorCode;
}

function getProviderErrorType(value: unknown) {
  const record = isRecord(value) ? value : null;
  const errorRecord = isRecord(record?.error) ? record.error : null;
  return getRequiredString(errorRecord?.type);
}

function getProviderErrorCode(value: unknown) {
  const record = isRecord(value) ? value : null;
  const errorRecord = isRecord(record?.error) ? record.error : null;
  return getRequiredString(errorRecord?.code);
}

function getFriendlyProviderMessage(code: GenerateCardErrorCode) {
  switch (code) {
    case "missing_gemini_key":
      return "Gemini generation is not configured yet.";
    case "gemini_rate_limited":
      return "Gemini is busy right now. Please try again in a few minutes.";
    case "gemini_bad_request":
      return "Gemini could not use this request. Please try again.";
    case "gemini_invalid_key_or_forbidden":
      return "Gemini generation is not allowed with the current key.";
    case "gemini_model_not_found":
      return "Gemini model is not available.";
    case "gemini_request_failed":
      return "Gemini could not create the recipe card right now.";
    case "missing_openai_key":
      return "AI generation is not configured yet.";
    case "openai_rate_limited":
      return "AI service is busy right now. Please try again in a few minutes.";
    case "openai_insufficient_quota":
      return "OpenAI quota is not available for this project.";
    case "openai_invalid_api_key":
      return "OpenAI key is invalid or unavailable.";
    case "openai_model_forbidden":
      return "OpenAI model is not allowed for this key.";
    case "openai_model_not_found":
      return "OpenAI model is not available.";
    case "openai_bad_request":
      return "OpenAI could not use this request. Please try again.";
    case "openai_request_failed":
      return "AI service could not create the recipe card right now.";
    case "missing_openrouter_key":
      return "OpenRouter generation is not configured yet.";
    case "openrouter_rate_limited":
      return "OpenRouter is busy right now. Please try again in a few minutes.";
    case "openrouter_bad_request":
      return "OpenRouter could not use this request. Please try again.";
    case "openrouter_invalid_key_or_forbidden":
      return "OpenRouter generation is not allowed with the current key.";
    case "openrouter_model_not_found":
      return "OpenRouter model is not available.";
    case "openrouter_request_failed":
      return "OpenRouter could not create the recipe card right now.";
    case "missing_kimi_key":
      return "Kimi generation is not configured yet.";
    case "kimi_rate_limited":
      return "Kimi is busy right now. Please try again in a few minutes.";
    case "kimi_bad_request":
      return "Kimi could not use this request. Please try again.";
    case "kimi_invalid_key_or_forbidden":
      return "Kimi generation is not allowed with the current key.";
    case "kimi_model_not_found":
      return "Kimi model is not available.";
    case "kimi_request_failed":
      return "Kimi could not create the recipe card right now.";
    case "missing_anthropic_key":
      return "Anthropic generation is not configured yet.";
    case "missing_anthropic_model":
      return "Anthropic model is not configured yet.";
    case "anthropic_not_implemented":
      return "Anthropic generation is not available right now.";
    case "invalid_ai_output":
      return "Recipe card could not be generated. Please add more details and try again.";
    case "db_insert_failed":
      return "Recipe card was created but could not be saved.";
    default:
      return "Something went wrong while creating your recipe card.";
  }
}

function getProviderRequestFailedCode(
  provider: AiProvider,
): GenerateCardErrorCode {
  switch (provider) {
    case "gemini":
      return "gemini_request_failed";
    case "openai":
      return "openai_request_failed";
    case "openrouter":
      return "openrouter_request_failed";
    case "kimi":
      return "kimi_request_failed";
    case "anthropic":
      return "anthropic_not_implemented";
    case "mock":
      return "unexpected_generate_card_error";
  }
}

function getProviderLabel(provider: AiProvider) {
  switch (provider) {
    case "gemini":
      return "Gemini";
    case "openai":
      return "OpenAI";
    case "openrouter":
      return "OpenRouter";
    case "kimi":
      return "Kimi";
    case "anthropic":
      return "Anthropic";
    case "mock":
      return "Mock";
  }
}

function getMockRecipeTitle(recipeInput: RecipeGenerationInput) {
  if (recipeInput.title) {
    return recipeInput.title;
  }

  if (recipeInput.pasted_caption || recipeInput.user_note) {
    return `${getPlatformLabel(recipeInput.platform)} Recipe Notes`;
  }

  return `${getPlatformLabel(recipeInput.platform)} Saved Recipe`;
}

function getIngredientNames(manualIngredients: string | null) {
  const ingredientNames = (manualIngredients ?? "")
    .split(/[\n,]/)
    .map((ingredient) => ingredient.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (ingredientNames.length > 0) {
    return ingredientNames;
  }

  return ["Main ingredient", "Spices", "Oil", "Water"];
}

function getPlatformLabel(platform: RecipePlatform) {
  switch (platform) {
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
    case "facebook":
      return "Facebook";
    case "other":
      return "Saved";
  }
}

function cleanOptionalText(value: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 0) {
    return "";
  }

  return value.slice(0, maxLength);
}

function getPositiveInteger(value: string | undefined, fallback: number) {
  const parsedValue = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function getFreeRecipeCardLimit() {
  return getPositiveInteger(
    Deno.env.get("FREE_RECIPE_CARD_LIMIT") ?? String(defaultFreeRecipeCardLimit),
    defaultFreeRecipeCardLimit,
  );
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => getRequiredString(item))
    .filter((item): item is string => Boolean(item));
}

function getRequiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getRequiredNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function getOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getDifficulty(value: unknown): Difficulty | null {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }

  return null;
}

function getConfidence(value: unknown): Confidence | null {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  return null;
}

function getRecipePlatform(platform: string | null): RecipePlatform {
  if (
    platform === "instagram" ||
    platform === "tiktok" ||
    platform === "youtube" ||
    platform === "facebook" ||
    platform === "other"
  ) {
    return platform;
  }

  return "other";
}

function isAiProvider(value: string): value is AiProvider {
  return (
    value === "mock" ||
    value === "gemini" ||
    value === "openai" ||
    value === "openrouter" ||
    value === "kimi" ||
    value === "anthropic"
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}

function errorResponse(
  stage: string,
  code: GenerateCardErrorCode,
  message: string,
  status: number,
  error?: unknown,
  extra?: SafeLogExtra,
) {
  logFunctionError(stage, code, error ?? message, {
    ...extra,
    status: extra?.status ?? status,
  });

  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    status,
  );
}

function logFunctionError(
  stage: string,
  code: GenerateCardErrorCode,
  error: unknown,
  extra?: SafeLogExtra,
) {
  const logPayload: {
    event: "generate_card_error";
    stage: string;
    provider?: AiProvider;
    model?: string;
    status?: number;
    code: GenerateCardErrorCode;
    message: string;
  } = {
    event: "generate_card_error",
    stage,
    code,
    message: getSafeLogMessage(error),
  };

  if (extra?.provider) {
    logPayload.provider = extra.provider;
  }

  if (extra?.model) {
    logPayload.model = extra.model;
  }

  if (typeof extra?.status === "number") {
    logPayload.status = extra.status;
  }

  console.error(JSON.stringify(logPayload));
}

function getSafeLogMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  const record = isRecord(error) ? error : null;
  const message = record && typeof record.message === "string"
    ? record.message
    : null;

  return message ?? "No safe error message available.";
}

function jsonResponse(
  body: GenerateCardSuccess | GenerateCardError,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
