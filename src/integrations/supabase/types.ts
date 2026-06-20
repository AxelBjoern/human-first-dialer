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
  public: {
    Tables: {
      call_logs: {
        Row: {
          agent_id: string
          client_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["call_direction"]
          duration_s: number | null
          ended_at: string | null
          external_call_id: string | null
          follow_up_at: string | null
          id: string
          notes: string | null
          organization_id: string
          outcome_code: string | null
          phone_e164: string
          recording_url: string | null
          started_at: string
          vdnx_synced_at: string | null
        }
        Insert: {
          agent_id: string
          client_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          duration_s?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          follow_up_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          outcome_code?: string | null
          phone_e164: string
          recording_url?: string | null
          started_at?: string
          vdnx_synced_at?: string | null
        }
        Update: {
          agent_id?: string
          client_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          duration_s?: number | null
          ended_at?: string | null
          external_call_id?: string | null
          follow_up_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          outcome_code?: string | null
          phone_e164?: string
          recording_url?: string | null
          started_at?: string
          vdnx_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_outcome_code_fkey"
            columns: ["outcome_code"]
            isOneToOne: false
            referencedRelation: "call_outcomes"
            referencedColumns: ["code"]
          },
        ]
      }
      call_outcomes: {
        Row: {
          code: string
          color: string | null
          label: string
          sort: number
        }
        Insert: {
          code: string
          color?: string | null
          label: string
          sort?: number
        }
        Update: {
          code?: string
          color?: string | null
          label?: string
          sort?: number
        }
        Relationships: []
      }
      call_reminders: {
        Row: {
          agent_id: string
          call_time: string
          client_id: string | null
          created_at: string
          done: boolean
          id: string
          note: string | null
          organization_id: string
        }
        Insert: {
          agent_id: string
          call_time: string
          client_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          note?: string | null
          organization_id: string
        }
        Update: {
          agent_id?: string
          call_time?: string
          client_id?: string | null
          created_at?: string
          done?: boolean
          id?: string
          note?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_reminders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string
          email: string | null
          external_id: string | null
          first_name: string | null
          id: string
          investment_status: string | null
          last_name: string | null
          notes: string | null
          organization_id: string
          owner_id: string
          personal_org_number: string | null
          phone: string | null
          postal_code: string | null
          source_app: Database["public"]["Enums"]["source_app"] | null
          updated_at: string
          vdnx_client_id: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          investment_status?: string | null
          last_name?: string | null
          notes?: string | null
          organization_id: string
          owner_id: string
          personal_org_number?: string | null
          phone?: string | null
          postal_code?: string | null
          source_app?: Database["public"]["Enums"]["source_app"] | null
          updated_at?: string
          vdnx_client_id?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          investment_status?: string | null
          last_name?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string
          personal_org_number?: string | null
          phone?: string | null
          postal_code?: string | null
          source_app?: Database["public"]["Enums"]["source_app"] | null
          updated_at?: string
          vdnx_client_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "org_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_connections: {
        Row: {
          base_url: string
          created_at: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          name: string
          organization_id: string
          source_app: Database["public"]["Enums"]["source_app"]
          token: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          base_url: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          name: string
          organization_id: string
          source_app: Database["public"]["Enums"]["source_app"]
          token: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          name?: string
          organization_id?: string
          source_app?: Database["public"]["Enums"]["source_app"]
          token?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_webhooks: {
        Row: {
          created_at: string
          enabled: boolean
          event: string
          id: string
          organization_id: string
          secret: string
          target_url: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event: string
          id?: string
          organization_id: string
          secret: string
          target_url: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event?: string
          id?: string
          organization_id?: string
          secret?: string
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          source_app: Database["public"]["Enums"]["source_app"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          source_app?: Database["public"]["Enums"]["source_app"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          source_app?: Database["public"]["Enums"]["source_app"] | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_country: string
          default_organization_id: string | null
          email: string | null
          extension: string | null
          first_name: string | null
          id: string
          last_name: string | null
          presence: Database["public"]["Enums"]["presence_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_country?: string
          default_organization_id?: string | null
          email?: string | null
          extension?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          presence?: Database["public"]["Enums"]["presence_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_country?: string
          default_organization_id?: string | null
          email?: string | null
          extension?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          presence?: Database["public"]["Enums"]["presence_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_organization_id_fkey"
            columns: ["default_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          _min: Database["public"]["Enums"]["org_role"]
          _org: string
          _uid: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent"
      call_direction: "outbound" | "inbound"
      org_role: "owner" | "admin" | "agent"
      presence_status: "available" | "busy" | "away" | "offline"
      source_app: "vdnx" | "energy" | "executive"
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
    Enums: {
      app_role: ["admin", "manager", "agent"],
      call_direction: ["outbound", "inbound"],
      org_role: ["owner", "admin", "agent"],
      presence_status: ["available", "busy", "away", "offline"],
      source_app: ["vdnx", "energy", "executive"],
    },
  },
} as const
