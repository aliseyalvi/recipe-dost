import {
  createClient,
  SupabaseClient,
} from "@supabase/supabase-js";

type RecipePlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "other";

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

type MockRecipeCard = {
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
  prep_time_minutes: 10;
  cook_time_minutes: 20;
  servings: "2-3 people";
  difficulty: "easy";
  grocery_list: string[];
  tags: string[];
  local_substitutions: [];
  storage_tip: "Store leftovers in a covered container in the fridge.";
  safety_note: "Cook chicken, meat, and eggs properly before eating.";
  confidence: "low";
  missing_info: [
    "This is a mock recipe card. Real AI generation will be added later.",
  ];
  source_link: string;
};

type GenerateCardSuccess = {
  ok: true;
  data: {
    recipe_card_id: string;
    recipe_id: string;
    recipe_title: string;
    confidence: "low";
  };
  usage: {
    free_recipe_cards_remaining: number;
    should_show_paywall: boolean;
  };
};

type GenerateCardError = {
  ok: false;
  error: {
    code:
      | "method_not_allowed"
      | "invalid_json"
      | "missing_auth"
      | "unauthorized"
      | "missing_recipe_id"
      | "invalid_recipe_id"
      | "recipe_not_found"
      | "free_limit_reached"
      | "server_config_error"
      | "generation_failed";
    message: string;
  };
};

type EdgeSupabaseClient = SupabaseClient<Database>;

declare const Deno: {
  serve: (
    handler: (request: Request) => Response | Promise<Response>,
  ) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

const freeRecipeCardLimit = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "method_not_allowed",
          message: "Use POST to generate a recipe card.",
        },
      },
      405,
    );
  }

  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "missing_auth",
          message: "Sign in to generate a recipe card.",
        },
      },
      401,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "server_config_error",
          message: "Recipe card generation is not configured yet.",
        },
      },
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
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "unauthorized",
          message: "Sign in to generate a recipe card.",
        },
      },
      401,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "invalid_json",
          message: "Send a JSON body with a recipe_id field.",
        },
      },
      400,
    );
  }

  const recipeIdValidation = validateRecipeId(body);

  if (!recipeIdValidation.ok) {
    return jsonResponse(recipeIdValidation.response, recipeIdValidation.status);
  }

  const recipeResult = await supabase
    .from("recipe_items")
    .select(
      "id, user_id, source_url, platform, title, description, user_note, pasted_caption, manual_ingredients",
    )
    .eq("id", recipeIdValidation.recipeId)
    .eq("user_id", user.id)
    .maybeSingle<RecipeItem>();

  if (recipeResult.error || !recipeResult.data) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "recipe_not_found",
          message: "Recipe link not found.",
        },
      },
      404,
    );
  }

  const existingCard = await getExistingMockCard(
    supabase,
    recipeIdValidation.recipeId,
    user.id,
  );
  const currentCardCount = await countRecipeCards(supabase, user.id);

  if (currentCardCount === null) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "generation_failed",
          message: "Could not check recipe card usage. Please try again.",
        },
      },
      500,
    );
  }

  if (!existingCard && currentCardCount >= freeRecipeCardLimit) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "free_limit_reached",
          message: "You have used your 3 free recipe cards.",
        },
      },
      402,
    );
  }

  const mockCard = buildMockRecipeCard(recipeResult.data);
  const recipeCardPayload: RecipeCardPayload = {
    recipe_id: recipeResult.data.id,
    user_id: user.id,
    recipe_title: mockCard.recipe_title,
    short_summary: mockCard.short_summary,
    ingredients_json: mockCard.ingredients as unknown as Json,
    steps_json: mockCard.steps as unknown as Json,
    time_json: {
      prep_time_minutes: mockCard.prep_time_minutes,
      cook_time_minutes: mockCard.cook_time_minutes,
    },
    servings: mockCard.servings,
    difficulty: mockCard.difficulty,
    grocery_list_json: mockCard.grocery_list,
    tags_json: mockCard.tags,
    substitutions_json: mockCard.local_substitutions,
    storage_tip: mockCard.storage_tip,
    safety_note: mockCard.safety_note,
    confidence: mockCard.confidence,
    missing_info_json: mockCard.missing_info,
    source_link: mockCard.source_link,
    model_used: "mock",
    prompt_version: "mock-v1",
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost: 0,
  };

  const savedCardResult = existingCard
    ? await supabase
      .from("recipe_cards")
      .update({
        ...recipeCardPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingCard.id)
      .eq("user_id", user.id)
      .select("id")
      .single<{ id: string }>()
    : await supabase
      .from("recipe_cards")
      .insert(recipeCardPayload)
      .select("id")
      .single<{ id: string }>();

  if (savedCardResult.error || !savedCardResult.data) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: "generation_failed",
          message: "Could not generate the mock recipe card. Please try again.",
        },
      },
      500,
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
      recipe_title: mockCard.recipe_title,
      confidence: mockCard.confidence,
    },
    usage: {
      free_recipe_cards_remaining: freeRecipeCardsRemaining,
      should_show_paywall: freeRecipeCardsRemaining <= 0,
    },
  });
});

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
      "missing_recipe_id",
      "Choose a saved recipe link first.",
    );
  }

  const recipeId = body.recipe_id.trim();

  if (!recipeId) {
    return validationError(
      "missing_recipe_id",
      "Choose a saved recipe link first.",
    );
  }

  if (!isUuid(recipeId)) {
    return validationError(
      "invalid_recipe_id",
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

async function getExistingMockCard(
  supabase: EdgeSupabaseClient,
  recipeId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("recipe_cards")
    .select("id")
    .eq("recipe_id", recipeId)
    .eq("user_id", userId)
    .eq("model_used", "mock")
    .eq("prompt_version", "mock-v1")
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

function buildMockRecipeCard(recipe: RecipeItem): MockRecipeCard {
  const platform = getRecipePlatform(recipe.platform);
  const platformLabel = getPlatformLabel(platform);
  const ingredientNames = getIngredientNames(recipe.manual_ingredients);
  const recipeTitle = getRecipeTitle(recipe, platformLabel);
  const ingredients = ingredientNames.map((name) => ({
    name,
    quantity: "estimated",
    notes: "Mock ingredient based on the saved link details.",
  }));

  return {
    recipe_title: recipeTitle,
    source_platform: platform,
    short_summary:
      "Mock recipe card generated from your saved link, notes, caption, and manual ingredients.",
    ingredients,
    steps: [
      {
        step_number: 1,
        instruction:
          "Review the saved link, pasted caption, and notes before cooking.",
        urdu_or_roman_urdu_tip:
          "Cooking se pehle caption aur apne notes zaroor check karein.",
      },
      {
        step_number: 2,
        instruction:
          "Prepare the listed ingredients and adjust quantities to your household size.",
        urdu_or_roman_urdu_tip:
          "Ingredients ko apni family size ke hisaab se adjust karein.",
      },
      {
        step_number: 3,
        instruction:
          "Cook using the original video or caption as reference until the recipe is properly done.",
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
      "This is a mock recipe card. Real AI generation will be added later.",
    ],
    source_link: recipe.source_url,
  };
}

function getRecipeTitle(recipe: RecipeItem, platformLabel: string) {
  const existingTitle = recipe.title?.trim();

  if (existingTitle) {
    return existingTitle;
  }

  if (recipe.pasted_caption?.trim() || recipe.user_note?.trim()) {
    return `${platformLabel} Recipe Notes`;
  }

  return `${platformLabel} Saved Recipe`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
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
