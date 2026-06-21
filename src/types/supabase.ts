export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      collection_items: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_user_id_fkey"
            columns: ["collection_id", "user_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "collection_items_recipe_id_user_id_fkey"
            columns: ["recipe_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recipe_items"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      grocery_lists: {
        Row: {
          created_at: string
          id: string
          items_json: Json
          source_recipe_ids: string[]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items_json?: Json
          source_recipe_ids?: string[]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items_json?: Json
          source_recipe_ids?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      metadata_fetch_logs: {
        Row: {
          error_code: string | null
          fetched_at: string
          id: string
          provider: string | null
          recipe_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          error_code?: string | null
          fetched_at?: string
          id?: string
          provider?: string | null
          recipe_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          error_code?: string | null
          fetched_at?: string
          id?: string
          provider?: string | null
          recipe_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metadata_fetch_logs_recipe_id_user_id_fkey"
            columns: ["recipe_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recipe_items"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      recipe_cards: {
        Row: {
          confidence: string | null
          created_at: string
          difficulty: string | null
          estimated_cost: number
          grocery_list_json: Json
          id: string
          ingredients_json: Json
          input_tokens: number
          missing_info_json: Json
          model_used: string | null
          output_tokens: number
          prompt_version: string | null
          recipe_id: string
          recipe_title: string | null
          safety_note: string | null
          servings: string | null
          short_summary: string | null
          source_link: string | null
          steps_json: Json
          storage_tip: string | null
          substitutions_json: Json
          tags_json: Json
          time_json: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          difficulty?: string | null
          estimated_cost?: number
          grocery_list_json?: Json
          id?: string
          ingredients_json?: Json
          input_tokens?: number
          missing_info_json?: Json
          model_used?: string | null
          output_tokens?: number
          prompt_version?: string | null
          recipe_id: string
          recipe_title?: string | null
          safety_note?: string | null
          servings?: string | null
          short_summary?: string | null
          source_link?: string | null
          steps_json?: Json
          storage_tip?: string | null
          substitutions_json?: Json
          tags_json?: Json
          time_json?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: string | null
          created_at?: string
          difficulty?: string | null
          estimated_cost?: number
          grocery_list_json?: Json
          id?: string
          ingredients_json?: Json
          input_tokens?: number
          missing_info_json?: Json
          model_used?: string | null
          output_tokens?: number
          prompt_version?: string | null
          recipe_id?: string
          recipe_title?: string | null
          safety_note?: string | null
          servings?: string | null
          short_summary?: string | null
          source_link?: string | null
          steps_json?: Json
          storage_tip?: string | null
          substitutions_json?: Json
          tags_json?: Json
          time_json?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_cards_recipe_id_user_id_fkey"
            columns: ["recipe_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recipe_items"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          created_at: string
          cuisine: string | null
          description: string | null
          id: string
          manual_ingredients: string | null
          meal_type: string | null
          metadata_status: string | null
          pasted_caption: string | null
          platform: string | null
          source_url: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          user_id: string
          user_note: string | null
        }
        Insert: {
          created_at?: string
          cuisine?: string | null
          description?: string | null
          id?: string
          manual_ingredients?: string | null
          meal_type?: string | null
          metadata_status?: string | null
          pasted_caption?: string | null
          platform?: string | null
          source_url: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          user_note?: string | null
        }
        Update: {
          created_at?: string
          cuisine?: string | null
          description?: string | null
          id?: string
          manual_ingredients?: string | null
          meal_type?: string | null
          metadata_status?: string | null
          pasted_caption?: string | null
          platform?: string | null
          source_url?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          user_note?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          entitlement: string
          expires_at: string | null
          product_id: string | null
          revenuecat_app_user_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entitlement?: string
          expires_at?: string | null
          product_id?: string | null
          revenuecat_app_user_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entitlement?: string
          expires_at?: string | null
          product_id?: string | null
          revenuecat_app_user_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          app_version: string | null
          created_at: string
          id: string
          issue_type: string | null
          message: string
          platform: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: string
          issue_type?: string | null
          message: string
          platform?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: string
          issue_type?: string | null
          message?: string
          platform?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          created_at: string
          estimated_cost: number
          grocery_lists_used: number
          id: string
          period: string
          recipe_cards_used: number
          saved_links_used: number
          total_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost?: number
          grocery_lists_used?: number
          id?: string
          period: string
          recipe_cards_used?: number
          saved_links_used?: number
          total_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost?: number
          grocery_lists_used?: number
          id?: string
          period?: string
          recipe_cards_used?: number
          saved_links_used?: number
          total_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          cooking_level: string | null
          cooking_preferences: string[]
          created_at: string
          cuisine_preference: string | null
          household_size: string | null
          language: string | null
          main_use: string | null
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          cooking_level?: string | null
          cooking_preferences?: string[]
          created_at?: string
          cuisine_preference?: string | null
          household_size?: string | null
          language?: string | null
          main_use?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          cooking_level?: string | null
          cooking_preferences?: string[]
          created_at?: string
          cuisine_preference?: string | null
          household_size?: string | null
          language?: string | null
          main_use?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
