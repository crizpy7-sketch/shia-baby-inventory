// Hand-written to match supabase/migrations/0001_init.sql.
// Once the project is linked to a real Supabase instance, regenerate with
// `supabase gen types typescript --linked > src/types/database.ts` and
// reconcile — this file is the interim source of truth.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: Partial<{ user_id: string; created_at: string }>;
        Relationships: [];
      };
      collections: {
        Row: {
          id: string;
          handle: string;
          name: string;
          description: string | null;
          type: "manual" | "smart";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          handle: string;
          name: string;
          description?: string | null;
          type?: "manual" | "smart";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["collections"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          handle: string;
          name: string;
          description: string | null;
          status: "draft" | "active" | "archived";
          vendor: string | null;
          product_type: string | null;
          tags: string[];
          price_cents: number;
          compare_at_price_cents: number | null;
          gift_ready: boolean;
          materials: string | null;
          care_instructions: string | null;
          images: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          handle: string;
          name: string;
          description?: string | null;
          status?: "draft" | "active" | "archived";
          vendor?: string | null;
          product_type?: string | null;
          tags?: string[];
          price_cents: number;
          compare_at_price_cents?: number | null;
          gift_ready?: boolean;
          materials?: string | null;
          care_instructions?: string | null;
          images?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      product_collections: {
        Row: { product_id: string; collection_id: string };
        Insert: { product_id: string; collection_id: string };
        Update: Partial<{ product_id: string; collection_id: string }>;
        Relationships: [];
      };
      variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          size: string | null;
          color: string | null;
          price_override_cents: number | null;
          inventory_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sku: string;
          size?: string | null;
          color?: string | null;
          price_override_cents?: number | null;
          inventory_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["variants"]["Insert"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      addresses: {
        Row: {
          id: string;
          customer_id: string;
          line1: string;
          line2: string | null;
          city: string;
          state: string;
          postal_code: string;
          country: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          line1: string;
          line2?: string | null;
          city: string;
          state: string;
          postal_code: string;
          country?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["addresses"]["Insert"]>;
        Relationships: [];
      };
      discounts: {
        Row: {
          id: string;
          code: string;
          type: "percentage" | "fixed";
          value: number;
          min_subtotal_cents: number;
          active: boolean;
          expires_at: string | null;
          usage_limit: number | null;
          times_used: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          type: "percentage" | "fixed";
          value: number;
          min_subtotal_cents?: number;
          active?: boolean;
          expires_at?: string | null;
          usage_limit?: number | null;
          times_used?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["discounts"]["Insert"]>;
        Relationships: [];
      };
      gift_cards: {
        Row: {
          id: string;
          code: string;
          initial_balance_cents: number;
          balance_cents: number;
          issued_to_email: string | null;
          status: "active" | "redeemed" | "disabled";
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          initial_balance_cents: number;
          balance_cents: number;
          issued_to_email?: string | null;
          status?: "active" | "redeemed" | "disabled";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["gift_cards"]["Insert"]>;
        Relationships: [];
      };
      carts: {
        Row: {
          id: string;
          customer_email: string | null;
          status: "open" | "converted" | "abandoned";
          discount_code: string | null;
          gift_card_code: string | null;
          gift_wrap: boolean;
          gift_note: string | null;
          checkout_snapshot: Json | null;
          locked_at: string | null;
          stripe_checkout_session_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_email?: string | null;
          status?: "open" | "converted" | "abandoned";
          discount_code?: string | null;
          gift_card_code?: string | null;
          gift_wrap?: boolean;
          gift_note?: string | null;
          checkout_snapshot?: Json | null;
          locked_at?: string | null;
          stripe_checkout_session_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["carts"]["Insert"]>;
        Relationships: [];
      };
      cart_items: {
        Row: { id: string; cart_id: string; variant_id: string; quantity: number; created_at: string };
        Insert: { id?: string; cart_id: string; variant_id: string; quantity: number; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["cart_items"]["Insert"]>;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          token: string;
          customer_id: string | null;
          customer_email: string;
          status: "pending_payment" | "paid" | "fulfilled" | "cancelled" | "refunded";
          subtotal_cents: number;
          discount_cents: number;
          discount_code: string | null;
          gift_wrap: boolean;
          gift_wrap_cents: number;
          gift_note: string | null;
          gift_card_code: string | null;
          gift_card_cents: number;
          shipping_cents: number;
          tax_cents: number;
          total_cents: number;
          shipping_address: Json | null;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["orders"]["Row"]> & {
          order_number: string;
          customer_email: string;
          subtotal_cents: number;
          total_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Row"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          variant_id: string | null;
          product_name: string;
          variant_label: string | null;
          quantity: number;
          unit_price_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          variant_id?: string | null;
          product_name: string;
          variant_label?: string | null;
          quantity: number;
          unit_price_cents: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          stripe_payment_intent_id: string | null;
          amount_cents: number;
          status: "succeeded" | "refunded" | "failed";
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          stripe_payment_intent_id?: string | null;
          amount_cents: number;
          status?: "succeeded" | "refunded" | "failed";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      order_events: {
        Row: { id: string; order_id: string; type: string; data: Json; created_at: string };
        Insert: { id?: string; order_id: string; type: string; data?: Json; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["order_events"]["Insert"]>;
        Relationships: [];
      };
      waitlist_signups: {
        Row: {
          id: string;
          email: string;
          role: "expecting" | "gifting" | "grandparent" | "other" | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role?: "expecting" | "gifting" | "grandparent" | "other" | null;
          source?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["waitlist_signups"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_order_from_snapshot: {
        Args: {
          p_cart_id: string;
          p_stripe_session_id: string;
          p_stripe_payment_intent_id: string | null;
          p_customer_email: string;
        };
        Returns: { order_id: string; order_token: string }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
