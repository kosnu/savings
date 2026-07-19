export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
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
      book_members: {
        Row: {
          book_id: number
          created_at: string | null
          id: number
          is_default: boolean
          updated_at: string | null
          user_id: number
        }
        Insert: {
          book_id: number
          created_at?: string | null
          id?: never
          is_default?: boolean
          updated_at?: string | null
          user_id: number
        }
        Update: {
          book_id?: number
          created_at?: string | null
          id?: never
          is_default?: boolean
          updated_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_members_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          created_at: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: never
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: never
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          book_id: number
          created_at: string | null
          id: number
          name: string
          updated_at: string | null
        }
        Insert: {
          book_id?: number
          created_at?: string | null
          id?: never
          name: string
          updated_at?: string | null
        }
        Update: {
          book_id?: number
          created_at?: string | null
          id?: never
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      category_pins: {
        Row: {
          category_id: number
          created_at: string | null
          id: number
          updated_at: string | null
          user_id: number
        }
        Insert: {
          category_id: number
          created_at?: string | null
          id?: never
          updated_at?: string | null
          user_id?: number
        }
        Update: {
          category_id?: number
          created_at?: string | null
          id?: never
          updated_at?: string | null
          user_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_pins_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_pins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      category_budgets: {
        Row: {
          amount: number | null
          book_id: number
          category_id: number
          created_at: string | null
          effective_from: string
          effective_month: number
          effective_year: number
          id: number
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          book_id?: number
          category_id: number
          created_at?: string | null
          effective_from: string
          effective_month?: number
          effective_year?: number
          id?: never
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          book_id?: number
          category_id?: number
          created_at?: string | null
          effective_from?: string
          effective_month?: number
          effective_year?: number
          id?: never
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_budgets_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budgets: {
        Row: {
          amount: number | null
          book_id: number
          created_at: string | null
          effective_from: string
          effective_month: number
          effective_year: number
          id: number
          status: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          book_id?: number
          created_at?: string | null
          effective_from: string
          effective_month?: number
          effective_year?: number
          id?: never
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          book_id?: number
          created_at?: string | null
          effective_from?: string
          effective_month?: number
          effective_year?: number
          id?: never
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_budgets_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          book_id: number
          category_id: number | null
          created_at: string | null
          date: string
          id: number
          note: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          book_id?: number
          category_id?: number | null
          created_at?: string | null
          date: string
          id?: never
          note?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          book_id?: number
          category_id?: number | null
          created_at?: string | null
          date?: string
          id?: never
          note?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string
          id: number
          legacy_external_id: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email: string
          id?: never
          legacy_external_id?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string
          id?: never
          legacy_external_id?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_monthly_budget: {
        Args: { p_amount: number; p_effective_month: string }
        Returns: undefined
      }
      create_category_with_pin: {
        Args: { p_category_name: string; p_pinned: boolean }
        Returns: number
      }
      create_category_with_pin_and_budget: {
        Args: {
          p_budget_amount?: number | null
          p_category_name: string
          p_effective_month: string
          p_pinned: boolean
        }
        Returns: number
      }
      delete_category_with_budget: {
        Args: { p_category_id: number }
        Returns: undefined
      }
      ensure_authenticated_user: {
        Args: { p_initial_display_name: string }
        Returns: undefined
      }
      get_authenticated_default_book_id: { Args: never; Returns: number }
      get_authenticated_user_id: { Args: never; Returns: number }
      get_effective_category_budgets: {
        Args: { p_target_month: string }
        Returns: Json
      }
      get_effective_monthly_budget: {
        Args: { p_target_month: string }
        Returns: Json
      }
      get_monthly_total_amount: { Args: { p_month: string }; Returns: number }
      remove_current_monthly_budget: { Args: never; Returns: undefined }
      update_current_monthly_budget: {
        Args: { p_amount: number }
        Returns: undefined
      }
      update_category_with_pin: {
        Args: {
          p_category_id: number
          p_category_name: string
          p_pinned: boolean
        }
        Returns: undefined
      }
      update_category_with_pin_and_budget: {
        Args: {
          p_budget_action?: string
          p_budget_amount?: number | null
          p_category_id: number
          p_category_name: string
          p_effective_month: string
          p_pinned: boolean
        }
        Returns: undefined
      }
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
