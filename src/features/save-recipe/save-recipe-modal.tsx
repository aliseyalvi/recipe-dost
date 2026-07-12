import { validateRecipeUrl } from "@/features/recipe-draft/validation";
import { detectRecipePlatform } from "@/features/recipe-draft/platform";
import {
  RecipeLibraryItem,
  RecipeApiError,
  SavedRecipeItem,
  refreshRecipeMetadata,
  saveRecipeLink,
} from "@/lib/api/recipes";
import { normalizeRecipeSourceUrl } from "@/lib/recipe-source-url";
import { useAuth } from "@/providers/auth-provider";
import { usePostHog } from "@/providers/posthog-placeholder-provider";
import { colors, radius, spacing, typography } from "@/theme";
import { ImportRecipeSheet } from "@/features/save-recipe/import-recipe-sheet";
import type { BottomSheetModalMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BackHandler, Keyboard, Pressable, Text, View } from "react-native";
import type { TextInput as GestureTextInput } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SaveRecipeModalContextValue = {
  openSaveRecipeModal: (options?: SaveRecipeModalOpenOptions) => void;
  showSaveRecipeMessage: (message: string) => void;
};

type SaveRecipeModalOpenOptions = {
  initialUrl?: string;
  source?: "manual" | "share_intent";
  sourceHint?: string;
};

const SaveRecipeModalContext =
  createContext<SaveRecipeModalContextValue | null>(null);

export function SaveRecipeModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { track } = usePostHog();
  const bottomSheetRef = useRef<BottomSheetModalMethods>(null);
  const urlInputRef = useRef<GestureTextInput | undefined>(undefined);
  const previousIsOpenRef = useRef(false);
  const isClosingRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapPoints = useMemo(() => ["72%", "92%"], []);
  const [isOpen, setIsOpen] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [modalSource, setModalSource] =
    useState<SaveRecipeModalOpenOptions["source"]>("manual");
  const [sourceHint, setSourceHint] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const validationResult = useMemo(
    () => validateRecipeUrl(sourceUrl),
    [sourceUrl],
  );
  const validationMessage = validationResult.success
    ? null
    : "Paste a valid Instagram, TikTok, or YouTube recipe link.";

  const openSaveRecipeModal = useCallback(
    (options?: SaveRecipeModalOpenOptions) => {
      const initialUrl = options?.initialUrl?.trim();

      if (
        isOpen &&
        options?.source === "share_intent" &&
        initialUrl &&
        sourceUrl === initialUrl
      ) {
        return;
      }

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }

      isClosingRef.current = false;

      if (initialUrl) {
        setSourceUrl(initialUrl);
      } else {
        setSourceUrl("");
      }

      setModalSource(options?.source ?? "manual");
      setSourceHint(options?.sourceHint ?? null);
      setIsOpen(true);
      setBannerMessage(null);
      setErrorMessage(null);
      track("save_recipe_modal_opened", {
        source: options?.source ?? "manual",
        has_initial_url: Boolean(initialUrl),
      });
    },
    [isOpen, sourceUrl, track],
  );

  const requestCloseSheet = useCallback(
    (options?: { force?: boolean }) => {
      if (isClosingRef.current || (isSaving && !options?.force)) {
        return;
      }

      isClosingRef.current = true;

      urlInputRef.current?.blur?.();
      Keyboard.dismiss();

      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }

      closeTimerRef.current = setTimeout(() => {
        bottomSheetRef.current?.dismiss();
        closeTimerRef.current = null;
      }, 180);
    },
    [isSaving],
  );

  const resetClosedSheetState = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    isClosingRef.current = false;
    previousIsOpenRef.current = false;
    setIsOpen(false);
    setSourceUrl("");
    setModalSource("manual");
    setSourceHint(null);
    setErrorMessage(null);
  }, []);

  const handleSheetDismiss = useCallback(() => {
    Keyboard.dismiss();
    resetClosedSheetState();
  }, [resetClosedSheetState]);

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      Keyboard.dismiss();
    }
  }, []);

  useEffect(() => {
    const wasOpen = previousIsOpenRef.current;

    if (isOpen && !wasOpen) {
      bottomSheetRef.current?.present();
    }

    if (!isOpen && wasOpen) {
      bottomSheetRef.current?.dismiss();
    }

    previousIsOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        requestCloseSheet();
        return true;
      },
    );

    return () => {
      backHandler.remove();
    };
  }, [isOpen, requestCloseSheet]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const showSaveRecipeMessage = useCallback((message: string) => {
    setBannerMessage(message);
  }, []);

  const upsertSavedItemInCache = useCallback(
    (savedItem: SavedRecipeItem | RecipeLibraryItem) => {
      if (!user?.id) {
        return;
      }

      const libraryItem =
        "latest_card" in savedItem ? savedItem : toRecipeLibraryItem(savedItem);

      queryClient.setQueryData<RecipeLibraryItem[]>(
        ["recent-recipes", user.id],
        (currentItems) => upsertRecipeLibraryItem(currentItems, libraryItem, 6),
      );
      queryClient.setQueryData<RecipeLibraryItem[]>(
        ["recipe-library", user.id],
        (currentItems) => upsertRecipeLibraryItem(currentItems, libraryItem),
      );
    },
    [queryClient, user?.id],
  );

  const refetchRecipeLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["recent-recipes"] });
    void queryClient.invalidateQueries({ queryKey: ["recipe-library"] });
    void queryClient.invalidateQueries({ queryKey: ["usage-summary"] });
  }, [queryClient]);

  const refreshMetadataInBackground = useCallback(
    async (recipeItemId: string) => {
      track("metadata_refresh_started");

      try {
        const result = await refreshRecipeMetadata(recipeItemId);
        track("metadata_refresh_completed", {
          metadata_status: result.metadata_status,
          worker_status: result.worker_status,
          error_code: result.error_code,
          title_present: result.title_present,
          thumbnail_present: result.thumbnail_present,
        });
      } catch (caughtError) {
        track("metadata_refresh_completed", {
          metadata_status: "failed",
          has_error: true,
        });
      } finally {
        void queryClient.invalidateQueries({
          queryKey: ["recipe-item", recipeItemId],
        });
        refetchRecipeLists();
      }
    },
    [queryClient, refetchRecipeLists, track],
  );

  const submitRecipeLink = async () => {
    if (isSaving) {
      return;
    }

    setErrorMessage(null);

    if (!validationResult.success) {
      setErrorMessage(
        "Paste a valid Instagram, TikTok, or YouTube recipe link.",
      );
      return;
    }

    if (!user?.id) {
      setErrorMessage("Could not prepare your app profile. Please retry.");
      track("save_recipe_link_failed", {
        source: modalSource ?? "manual",
        reason: "missing_session",
      });
      return;
    }

    const recipeUrl = validationResult.data;
    const normalizedSourceKey = normalizeRecipeSourceUrl(recipeUrl);

    if (!normalizedSourceKey) {
      setErrorMessage(
        "Paste a valid Instagram, TikTok, or YouTube recipe link.",
      );
      return;
    }

    const existingItem = findDuplicateSavedItemInCache({
      queryClient,
      userId: user?.id,
      normalizedSourceKey,
    });

    if (existingItem) {
      track("save_recipe_duplicate_found", {
        platform: existingItem.platform ?? savedPlatformFromUrl(recipeUrl),
        source: modalSource ?? "manual",
      });
      upsertSavedItemInCache(existingItem);
      setErrorMessage("This recipe is already saved.");
      return;
    }

    const recipePlatform = savedPlatformFromUrl(recipeUrl);

    setIsSaving(true);
    track("save_recipe_link_submitted", {
      platform: recipePlatform,
      source: modalSource ?? "manual",
    });
    if (modalSource === "share_intent") {
      track("shared_recipe_save_started", {
        platform: recipePlatform,
      });
    }

    try {
      const saveResult = await saveRecipeLink(recipeUrl);
      const savedItem = saveResult.recipe_item;

      upsertSavedItemInCache(savedItem);
      refetchRecipeLists();

      if (saveResult.duplicate === true) {
        track("save_recipe_duplicate_found", {
          platform: savedItem.platform ?? recipePlatform,
          source: modalSource ?? "manual",
        });
        setErrorMessage("This recipe is already saved.");
        return;
      }

      track("save_recipe_link_saved", {
        platform: savedItem.platform ?? "other",
        metadata_status: savedItem.metadata_status ?? "pending",
        duplicate: false,
      });
      if (modalSource === "share_intent") {
        track("shared_recipe_save_completed", {
          platform: savedItem.platform ?? recipePlatform,
          metadata_status: savedItem.metadata_status ?? "pending",
          duplicate: false,
        });
      }

      void refreshMetadataInBackground(savedItem.id);
      requestCloseSheet({ force: true });
      router.navigate(`/recipe/${savedItem.id}?returnTo=/home`);
    } catch (caughtError) {
      const errorCategory = getSaveRecipeErrorCategory(caughtError);
      setErrorMessage(getSaveRecipeErrorMessage(caughtError));
      track("save_recipe_link_failed", {
        platform: recipePlatform,
        source: modalSource ?? "manual",
        reason: errorCategory,
      });
      if (modalSource === "share_intent") {
        track("shared_recipe_save_failed", {
          platform: recipePlatform,
          reason: errorCategory,
        });
      }
      refetchRecipeLists();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SaveRecipeModalContext.Provider
      value={{ openSaveRecipeModal, showSaveRecipeMessage }}
    >
      {children}
      {bannerMessage ? (
        <View
          style={{
            position: "absolute",
            top: insets.top + spacing.md,
            right: spacing.lg,
            left: spacing.lg,
            zIndex: 20,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            padding: spacing.md,
            boxShadow: "0 12px 28px rgba(0, 0, 0, 0.3)",
          }}
        >
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {bannerMessage}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setBannerMessage(null)}
            style={{ marginTop: spacing.sm }}
          >
            <Text
              selectable={false}
              style={[
                typography.caption,
                { color: colors.primary, fontWeight: "800" },
              ]}
            >
              Dismiss
            </Text>
          </Pressable>
        </View>
      ) : null}
      <ImportRecipeSheet
        sheetRef={bottomSheetRef}
        inputRef={urlInputRef}
        snapPoints={snapPoints}
        bottomInset={insets.bottom}
        sourceUrl={sourceUrl}
        sourceHint={sourceHint}
        isSaving={isSaving}
        validationMessage={validationMessage}
        errorMessage={errorMessage}
        onChangeUrl={setSourceUrl}
        onClientError={setErrorMessage}
        onClipboardResult={(result) => {
          track("save_recipe_clipboard_used", { result });
        }}
        onSubmit={() => {
          void submitRecipeLink();
        }}
        onRequestClose={() => requestCloseSheet()}
        onDismiss={handleSheetDismiss}
        onChange={handleSheetChange}
      />
    </SaveRecipeModalContext.Provider>
  );
}

export function useSaveRecipeModal() {
  const value = useContext(SaveRecipeModalContext);

  if (!value) {
    throw new Error(
      "useSaveRecipeModal must be used inside SaveRecipeModalProvider.",
    );
  }

  return value;
}

function toRecipeLibraryItem(savedItem: SavedRecipeItem): RecipeLibraryItem {
  return {
    id: savedItem.id,
    source_url: savedItem.source_url,
    platform: savedItem.platform,
    title: savedItem.title,
    description: savedItem.description,
    thumbnail_url: savedItem.thumbnail_url,
    duration_seconds: savedItem.duration_seconds,
    metadata_status: savedItem.metadata_status,
    source_metadata: savedItem.source_metadata,
    user_note: savedItem.user_note,
    pasted_caption: savedItem.pasted_caption,
    manual_ingredients: savedItem.manual_ingredients,
    meal_type: savedItem.meal_type,
    cuisine: savedItem.cuisine,
    is_favorite: savedItem.is_favorite === true,
    created_at: savedItem.created_at,
    updated_at: savedItem.updated_at,
    latest_card: null,
    latest_media_job: null,
  };
}

function upsertRecipeLibraryItem(
  currentItems: RecipeLibraryItem[] | undefined,
  nextItem: RecipeLibraryItem,
  limit?: number,
) {
  const items = currentItems ?? [];
  const nextSourceKey = getRecipeSourceKey(nextItem);
  const filteredItems = items.filter(
    (item) =>
      item.id !== nextItem.id &&
      item.source_url !== nextItem.source_url &&
      (!nextSourceKey || getRecipeSourceKey(item) !== nextSourceKey),
  );
  const nextItems = [nextItem, ...filteredItems].sort(
    (firstItem, secondItem) =>
      new Date(secondItem.created_at).getTime() -
      new Date(firstItem.created_at).getTime(),
  );

  return typeof limit === "number" ? nextItems.slice(0, limit) : nextItems;
}

function savedPlatformFromUrl(sourceUrl: string) {
  return detectRecipePlatform(sourceUrl);
}

function findDuplicateSavedItemInCache({
  queryClient,
  userId,
  normalizedSourceKey,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  userId: string | undefined;
  normalizedSourceKey: string;
}) {
  if (!userId) {
    return null;
  }

  const cachedLists = [
    queryClient.getQueryData<RecipeLibraryItem[]>(["recent-recipes", userId]),
    queryClient.getQueryData<RecipeLibraryItem[]>(["recipe-library", userId]),
  ];

  for (const items of cachedLists) {
    const duplicateItem = items?.find(
      (item) => getRecipeSourceKey(item) === normalizedSourceKey,
    );

    if (duplicateItem && !duplicateItem.id.startsWith("optimistic:")) {
      return duplicateItem;
    }
  }

  return null;
}

function getRecipeSourceKey(item: RecipeLibraryItem) {
  const metadataKey = getNormalizedSourceKeyFromMetadata(item.source_metadata);

  return metadataKey ?? normalizeRecipeSourceUrl(item.source_url);
}

function getNormalizedSourceKeyFromMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const key = (value as { normalized_source_key?: unknown })
    .normalized_source_key;

  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null;
}

function getSaveRecipeErrorMessage(error: unknown) {
  if (
    error instanceof RecipeApiError &&
    (error.code === "unauthorized" || error.status === 401)
  ) {
    return "Could not prepare your app profile. Please retry.";
  }

  return "Could not save this link. Please try again.";
}

function getSaveRecipeErrorCategory(error: unknown) {
  if (
    error instanceof RecipeApiError &&
    (error.code === "unauthorized" || error.status === 401)
  ) {
    return "auth";
  }

  return error instanceof RecipeApiError ? "api" : "network_or_unknown";
}
