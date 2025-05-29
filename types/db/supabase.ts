export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
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
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          permissions: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          permissions?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          permissions?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          organization_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          permissions: Json | null
          role: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          permissions?: Json | null
          role: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          permissions?: Json | null
          role?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          account_status: string | null
          business_details: Json
          country: string
          created_at: string | null
          created_by: string | null
          data_vault_id: string | null
          description: string | null
          entity_type: string
          fbo_account_id: string | null
          global_organization_id: string | null
          id: string
          industry: string | null
          invited_at: string | null
          invited_by: string | null
          last_verified_at: string | null
          logo_url: string | null
          name: string
          operational_wallet: Json | null
          preferences: Json | null
          primary_address: Json | null
          ramping_entity_id: string | null
          subscription_tier: string
          treasury_wallet: Json | null
          updated_at: string | null
          verification_provider: string | null
          verification_status: string
          website: string | null
          yield_wallet: Json | null
        }
        Insert: {
          account_status?: string | null
          business_details?: Json
          country: string
          created_at?: string | null
          created_by?: string | null
          data_vault_id?: string | null
          description?: string | null
          entity_type?: string
          fbo_account_id?: string | null
          global_organization_id?: string | null
          id?: string
          industry?: string | null
          invited_at?: string | null
          invited_by?: string | null
          last_verified_at?: string | null
          logo_url?: string | null
          name: string
          operational_wallet?: Json | null
          preferences?: Json | null
          primary_address?: Json | null
          ramping_entity_id?: string | null
          subscription_tier?: string
          treasury_wallet?: Json | null
          updated_at?: string | null
          verification_provider?: string | null
          verification_status?: string
          website?: string | null
          yield_wallet?: Json | null
        }
        Update: {
          account_status?: string | null
          business_details?: Json
          country?: string
          created_at?: string | null
          created_by?: string | null
          data_vault_id?: string | null
          description?: string | null
          entity_type?: string
          fbo_account_id?: string | null
          global_organization_id?: string | null
          id?: string
          industry?: string | null
          invited_at?: string | null
          invited_by?: string | null
          last_verified_at?: string | null
          logo_url?: string | null
          name?: string
          operational_wallet?: Json | null
          preferences?: Json | null
          primary_address?: Json | null
          ramping_entity_id?: string | null
          subscription_tier?: string
          treasury_wallet?: Json | null
          updated_at?: string | null
          verification_provider?: string | null
          verification_status?: string
          website?: string | null
          yield_wallet?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_invited_by_organization_id_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          created_by: string
          currency: string
          due_date: string | null
          fee_amount: number
          id: string
          invoices: Json
          memo: string | null
          metadata: Json | null
          payment_method: string | null
          proof_data: Json
          recipient_name: string
          recipient_organization_id: string | null
          sender_name: string
          sender_organization_id: string | null
          signature: string | null
          status: string
          token_mint: string
          transaction_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          created_by: string
          currency?: string
          due_date?: string | null
          fee_amount?: number
          id?: string
          invoices?: Json
          memo?: string | null
          metadata?: Json | null
          payment_method?: string | null
          proof_data?: Json
          recipient_name: string
          recipient_organization_id?: string | null
          sender_name: string
          sender_organization_id?: string | null
          signature?: string | null
          status: string
          token_mint: string
          transaction_type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          due_date?: string | null
          fee_amount?: number
          id?: string
          invoices?: Json
          memo?: string | null
          metadata?: Json | null
          payment_method?: string | null
          proof_data?: Json
          recipient_name?: string
          recipient_organization_id?: string | null
          sender_name?: string
          sender_organization_id?: string | null
          signature?: string | null
          status?: string
          token_mint?: string
          transaction_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_recipient_organization"
            columns: ["recipient_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sender_organization"
            columns: ["sender_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recipient_organization_id_fkey"
            columns: ["recipient_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sender_organization_id_fkey"
            columns: ["sender_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          last_sign_in: string | null
          mailing_address: Json | null
          phone_number: string | null
          preferences: Json | null
          primary_address: Json | null
          profile_image_url: string | null
          status: string | null
          timezone: string | null
          updated_at: string | null
          wallet_address: string
        }
        Insert: {
          auth_id: string
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          last_sign_in?: string | null
          mailing_address?: Json | null
          phone_number?: string | null
          preferences?: Json | null
          primary_address?: Json | null
          profile_image_url?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          wallet_address: string
        }
        Update: {
          auth_id?: string
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          last_sign_in?: string | null
          mailing_address?: Json | null
          phone_number?: string | null
          preferences?: Json | null
          primary_address?: Json | null
          profile_image_url?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string | null
          email: string | null
          expires_at: string
          id: string
          metadata: Json | null
          organization_id: string | null
          purpose: string
          used: boolean | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          email?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          purpose: string
          used?: boolean | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          purpose?: string
          used?: boolean | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_transactions: {
        Args: { org_id: string }
        Returns: boolean
      }
      current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_org_member: {
        Args: { org_id: string; roles?: string[] }
        Returns: boolean
      }
      set_claim: {
        Args: { claim: string; value: string }
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
