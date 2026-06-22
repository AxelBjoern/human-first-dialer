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
      ai_call_jobs: {
        Row: {
          attempts: number
          call_log_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          organization_id: string
          phone_e164: string
          prompt: string | null
          scheduled_at: string
          session_id: string | null
          status: Database["public"]["Enums"]["ai_job_status"]
          updated_at: string
          voice_config: Json
        }
        Insert: {
          attempts?: number
          call_log_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          organization_id: string
          phone_e164: string
          prompt?: string | null
          scheduled_at?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
          updated_at?: string
          voice_config?: Json
        }
        Update: {
          attempts?: number
          call_log_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          organization_id?: string
          phone_e164?: string
          prompt?: string | null
          scheduled_at?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["ai_job_status"]
          updated_at?: string
          voice_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_jobs_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_artifact_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_jobs_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency: string
          features: Json
          id: string
          monthly_ai_minute_quota: number | null
          monthly_call_quota: number | null
          name: string
          price_cents: number
          seat_quota: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          monthly_ai_minute_quota?: number | null
          monthly_call_quota?: number | null
          name: string
          price_cents?: number
          seat_quota?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency?: string
          features?: Json
          id?: string
          monthly_ai_minute_quota?: number | null
          monthly_call_quota?: number | null
          name?: string
          price_cents?: number
          seat_quota?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          agent_id: string
          ai_job_id: string | null
          answered: boolean
          caller_type: Database["public"]["Enums"]["caller_type"]
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
          provider: string | null
          recording_id: string | null
          recording_url: string | null
          ring_time_s: number | null
          started_at: string
          talk_time_s: number | null
          vdnx_synced_at: string | null
          voicemail_url: string | null
        }
        Insert: {
          agent_id: string
          ai_job_id?: string | null
          answered?: boolean
          caller_type?: Database["public"]["Enums"]["caller_type"]
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
          provider?: string | null
          recording_id?: string | null
          recording_url?: string | null
          ring_time_s?: number | null
          started_at?: string
          talk_time_s?: number | null
          vdnx_synced_at?: string | null
          voicemail_url?: string | null
        }
        Update: {
          agent_id?: string
          ai_job_id?: string | null
          answered?: boolean
          caller_type?: Database["public"]["Enums"]["caller_type"]
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
          provider?: string | null
          recording_id?: string | null
          recording_url?: string | null
          ring_time_s?: number | null
          started_at?: string
          talk_time_s?: number | null
          vdnx_synced_at?: string | null
          voicemail_url?: string | null
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
            foreignKeyName: "call_logs_ai_job_id_fkey"
            columns: ["ai_job_id"]
            isOneToOne: false
            referencedRelation: "ai_call_jobs"
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
      call_monitors: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          mode: string
          organization_id: string
          session_id: string | null
          started_at: string
          supervisor_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mode?: string
          organization_id: string
          session_id?: string | null
          started_at?: string
          supervisor_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mode?: string
          organization_id?: string
          session_id?: string | null
          started_at?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_monitors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_monitors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_monitors_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
      call_sessions: {
        Row: {
          agent_id: string | null
          answered_at: string | null
          call_log_id: string | null
          caller_type: Database["public"]["Enums"]["caller_type"]
          client_id: string | null
          created_at: string
          ended_at: string | null
          error: string | null
          external_call_id: string | null
          from_extension: string | null
          id: string
          last_polled_at: string | null
          meta: Json
          organization_id: string
          phone_e164: string
          provider: string
          recording_id: string | null
          recording_url: string | null
          started_at: string | null
          state: Database["public"]["Enums"]["call_session_state"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          answered_at?: string | null
          call_log_id?: string | null
          caller_type?: Database["public"]["Enums"]["caller_type"]
          client_id?: string | null
          created_at?: string
          ended_at?: string | null
          error?: string | null
          external_call_id?: string | null
          from_extension?: string | null
          id?: string
          last_polled_at?: string | null
          meta?: Json
          organization_id: string
          phone_e164: string
          provider?: string
          recording_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          state?: Database["public"]["Enums"]["call_session_state"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          answered_at?: string | null
          call_log_id?: string | null
          caller_type?: Database["public"]["Enums"]["caller_type"]
          client_id?: string | null
          created_at?: string
          ended_at?: string | null
          error?: string | null
          external_call_id?: string | null
          from_extension?: string | null
          id?: string
          last_polled_at?: string | null
          meta?: Json
          organization_id?: string
          phone_e164?: string
          provider?: string
          recording_id?: string | null
          recording_url?: string | null
          started_at?: string | null
          state?: Database["public"]["Enums"]["call_session_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_artifact_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_organization_id_fkey"
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
          owner_id: string | null
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
          owner_id?: string | null
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
          owner_id?: string | null
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
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          team_id?: string | null
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
          {
            foreignKeyName: "org_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          current_period_start: string
          notes: string | null
          organization_id: string
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          notes?: string | null
          organization_id: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          notes?: string | null
          organization_id?: string
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      org_usage_daily: {
        Row: {
          ai_minutes: number
          calls_count: number
          day: string
          organization_id: string
          transcription_minutes: number
          updated_at: string
        }
        Insert: {
          ai_minutes?: number
          calls_count?: number
          day: string
          organization_id: string
          transcription_minutes?: number
          updated_at?: string
        }
        Update: {
          ai_minutes?: number
          calls_count?: number
          day?: string
          organization_id?: string
          transcription_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_usage_daily_organization_id_fkey"
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
          company_name: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          org_number: string | null
          slug: string
          source_app: Database["public"]["Enums"]["source_app"] | null
          updated_at: string
          vdnx_company_id: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          org_number?: string | null
          slug: string
          source_app?: Database["public"]["Enums"]["source_app"] | null
          updated_at?: string
          vdnx_company_id?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          org_number?: string | null
          slug?: string
          source_app?: Database["public"]["Enums"]["source_app"] | null
          updated_at?: string
          vdnx_company_id?: string | null
        }
        Relationships: []
      }
      platform_staff: {
        Row: {
          created_at: string
          created_by: string | null
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
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
      teams: {
        Row: {
          created_at: string
          id: string
          lead_user_id: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_user_id?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_user_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_lead_user_id_fkey"
            columns: ["lead_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telavox_configs: {
        Row: {
          api_token: string | null
          auth_kind: string
          base_url: string
          caller_id_e164: string | null
          created_at: string
          default_extension: string | null
          enabled: boolean
          extension_map: Json
          id: string
          organization_id: string
          transcription_config: Json
          transcription_provider: string
          updated_at: string
          voice_config: Json
          voice_provider: string
          webhook_secret: string | null
        }
        Insert: {
          api_token?: string | null
          auth_kind?: string
          base_url?: string
          caller_id_e164?: string | null
          created_at?: string
          default_extension?: string | null
          enabled?: boolean
          extension_map?: Json
          id?: string
          organization_id: string
          transcription_config?: Json
          transcription_provider?: string
          updated_at?: string
          voice_config?: Json
          voice_provider?: string
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string | null
          auth_kind?: string
          base_url?: string
          caller_id_e164?: string | null
          created_at?: string
          default_extension?: string | null
          enabled?: boolean
          extension_map?: Json
          id?: string
          organization_id?: string
          transcription_config?: Json
          transcription_provider?: string
          updated_at?: string
          voice_config?: Json
          voice_provider?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telavox_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transcriptions: {
        Row: {
          call_log_id: string | null
          created_at: string
          id: string
          language: string | null
          organization_id: string
          provider: string
          segments: Json | null
          session_id: string | null
          status: Database["public"]["Enums"]["transcription_status"]
          summary: string | null
          text: string | null
          updated_at: string
        }
        Insert: {
          call_log_id?: string | null
          created_at?: string
          id?: string
          language?: string | null
          organization_id: string
          provider?: string
          segments?: Json | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["transcription_status"]
          summary?: string | null
          text?: string | null
          updated_at?: string
        }
        Update: {
          call_log_id?: string | null
          created_at?: string
          id?: string
          language?: string | null
          organization_id?: string
          provider?: string
          segments?: Json | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["transcription_status"]
          summary?: string | null
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcriptions_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_artifact_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcriptions_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcriptions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
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
      voice_cue_cache: {
        Row: {
          created_at: string
          cue_key: string
          id: string
          organization_id: string
          storage_path: string
          text_hash: string
        }
        Insert: {
          created_at?: string
          cue_key: string
          id?: string
          organization_id: string
          storage_path: string
          text_hash: string
        }
        Update: {
          created_at?: string
          cue_key?: string
          id?: string
          organization_id?: string
          storage_path?: string
          text_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_cue_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_activity_view: {
        Row: {
          agent_id: string | null
          answered_calls: number | null
          avg_talk_time_s: number | null
          caller_type: Database["public"]["Enums"]["caller_type"] | null
          calls: number | null
          day: string | null
          missed_calls: number | null
          organization_id: string | null
          total_talk_time_s: number | null
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
            foreignKeyName: "call_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_artifact_view: {
        Row: {
          agent_id: string | null
          caller_type: Database["public"]["Enums"]["caller_type"] | null
          client_id: string | null
          duration_s: number | null
          id: string | null
          organization_id: string | null
          outcome_code: string | null
          phone_e164: string | null
          provider: string | null
          recording_url: string | null
          started_at: string | null
          transcript_segments: Json | null
          transcript_status:
            | Database["public"]["Enums"]["transcription_status"]
            | null
          transcript_text: string | null
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
      org_usage_current_period: {
        Row: {
          ai_minutes: number | null
          calls_count: number | null
          current_period_end: string | null
          current_period_start: string | null
          organization_id: string | null
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          transcription_minutes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_supervise: {
        Args: { _org: string; _target: string; _uid: string }
        Returns: boolean
      }
      check_org_can_use: {
        Args: { _kind: string; _org: string }
        Returns: undefined
      }
      create_organization:
        | { Args: { p_name: string; p_slug: string }; Returns: string }
        | {
            Args: {
              p_company_name?: string
              p_name: string
              p_org_number?: string
              p_slug: string
            }
            Returns: string
          }
      get_telephony_mode: {
        Args: { _org: string }
        Returns: {
          enabled: boolean
          provider: string
        }[]
      }
      has_org_role: {
        Args: {
          _min: Database["public"]["Enums"]["org_role"]
          _org: string
          _uid: string
        }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          _min: Database["public"]["Enums"]["platform_role"]
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
      is_platform_staff: { Args: { _uid: string }; Returns: boolean }
      rollup_org_usage_day: {
        Args: { _day: string; _org: string }
        Returns: undefined
      }
      users_share_org: { Args: { _a: string; _b: string }; Returns: boolean }
    }
    Enums: {
      ai_job_status:
        | "pending"
        | "queued"
        | "in_progress"
        | "completed"
        | "failed"
        | "canceled"
      app_role: "admin" | "manager" | "agent"
      call_direction: "outbound" | "inbound"
      call_session_state:
        | "queued"
        | "dialing"
        | "ringing"
        | "active"
        | "completed"
        | "failed"
        | "canceled"
      caller_type: "human" | "ai"
      org_role: "owner" | "admin" | "team_lead" | "agent"
      platform_role: "superadmin" | "staff" | "billing" | "support"
      presence_status: "available" | "busy" | "away" | "offline"
      source_app: "vdnx" | "energy" | "executive"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "suspended"
      transcription_status: "pending" | "processing" | "completed" | "failed"
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
      ai_job_status: [
        "pending",
        "queued",
        "in_progress",
        "completed",
        "failed",
        "canceled",
      ],
      app_role: ["admin", "manager", "agent"],
      call_direction: ["outbound", "inbound"],
      call_session_state: [
        "queued",
        "dialing",
        "ringing",
        "active",
        "completed",
        "failed",
        "canceled",
      ],
      caller_type: ["human", "ai"],
      org_role: ["owner", "admin", "team_lead", "agent"],
      platform_role: ["superadmin", "staff", "billing", "support"],
      presence_status: ["available", "busy", "away", "offline"],
      source_app: ["vdnx", "energy", "executive"],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "suspended",
      ],
      transcription_status: ["pending", "processing", "completed", "failed"],
    },
  },
} as const
