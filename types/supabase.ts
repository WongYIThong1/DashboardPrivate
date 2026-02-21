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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      user_files: {
        Row: {
          created_at: string
          file_path: string
          file_size: number
          file_type: string
          filename: string
          id: string
          line_count: number | null
          mime_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          file_size: number
          file_type: string
          filename: string
          id?: string
          line_count?: number | null
          mime_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          file_size?: number
          file_type?: string
          filename?: string
          id?: string
          line_count?: number | null
          mime_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          attempt_count: number
          created_at: string
          id: string
          identifier: string
          last_attempt: string
          window_start: string
        }
        Insert: {
          action: string
          attempt_count?: number
          created_at?: string
          id?: string
          identifier: string
          last_attempt?: string
          window_start?: string
        }
        Update: {
          action?: string
          attempt_count?: number
          created_at?: string
          id?: string
          identifier?: string
          last_attempt?: string
          window_start?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_hash: string | null
          avatar_updated_at: string | null
          avatar_url: string | null
          created_at: string
          credits: number
          email: string | null
          id: string
          max_tasks: number
          plan: string
          privacy_mode: boolean
          storage_limit: number
          storage_used: number
          subscription_days: number | null
          subscription_expires_at: string | null
          system_notification: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_hash?: string | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          credits?: number
          email?: string | null
          id: string
          max_tasks?: number
          plan?: string
          privacy_mode?: boolean
          storage_limit?: number
          storage_used?: number
          subscription_days?: number | null
          subscription_expires_at?: string | null
          system_notification?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_hash?: string | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          credits?: number
          email?: string | null
          id?: string
          max_tasks?: number
          plan?: string
          privacy_mode?: boolean
          storage_limit?: number
          storage_used?: number
          subscription_days?: number | null
          subscription_expires_at?: string | null
          system_notification?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          ai_mode: boolean
          ai_sensitivity_level: string
          auto_dumper: boolean
          baseline_profiling: boolean
          created_at: string
          file_id: string
          found: number
          id: string
          injection_boolean: boolean
          injection_error: boolean
          injection_timebased: boolean
          injection_union: boolean
          name: string
          parameter_risk_filter: string
          preset: string | null
          response_pattern_drift: boolean
          started_at: string | null
          status: string
          structural_change_detection: boolean
          target: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_mode?: boolean
          ai_sensitivity_level?: string
          auto_dumper?: boolean
          baseline_profiling?: boolean
          created_at?: string
          file_id: string
          found?: number
          id?: string
          injection_boolean?: boolean
          injection_error?: boolean
          injection_timebased?: boolean
          injection_union?: boolean
          name: string
          parameter_risk_filter?: string
          preset?: string | null
          response_pattern_drift?: boolean
          started_at?: string | null
          status?: string
          structural_change_detection?: boolean
          target?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_mode?: boolean
          ai_sensitivity_level?: string
          auto_dumper?: boolean
          baseline_profiling?: boolean
          created_at?: string
          file_id?: string
          found?: number
          id?: string
          injection_boolean?: boolean
          injection_error?: boolean
          injection_timebased?: boolean
          injection_union?: boolean
          name?: string
          parameter_risk_filter?: string
          preset?: string | null
          response_pattern_drift?: boolean
          started_at?: string | null
          status?: string
          structural_change_detection?: boolean
          target?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "user_files"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_downgrade_expired_subscriptions: {
        Args: never
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_identifier: string
          p_max_attempts: number
          p_window_minutes: number
        }
        Returns: Json
      }
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      extend_subscription: {
        Args: { p_additional_days: number; p_user_id: string }
        Returns: Json
      }
      get_subscription_status: { Args: { p_user_id: string }; Returns: Json }
      set_subscription: {
        Args: { p_days: number; p_plan: string; p_user_id: string }
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
  public: {
    Enums: {},
  },
} as const
