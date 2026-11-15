// Hand-written to match supabase/migrations/*.sql exactly. Once the project is
// linked to a real Supabase instance, regenerate with:
//   supabase gen types typescript --local > src/types/database.ts
// and reconcile any drift against the migrations.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type RouteStatus = "unknown" | "available" | "sold_out";
export type RouteEventType = "became_available" | "sold_out" | "scrape_error";
export type PollingTier = "high" | "standard" | "low";
export type AlertChannel = "email" | "push" | "sms";
export type SubscriptionPlan = "free" | "premium";
export type SubscriptionStatus = "inactive" | "active" | "past_due" | "canceled";

export interface Database {
  public: {
    Tables: {
      airports: {
        Row: {
          code: string;
          name: string;
          city: string;
          timezone: string;
          is_tracked: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          city: string;
          timezone: string;
          is_tracked?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["airports"]["Insert"]>;
      };
      routes: {
        Row: {
          id: number;
          origin_airport_code: string;
          destination_airport_code: string;
          is_active: boolean;
          polling_tier: PollingTier;
          created_at: string;
        };
        Insert: {
          id?: number;
          origin_airport_code: string;
          destination_airport_code: string;
          is_active?: boolean;
          polling_tier?: PollingTier;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["routes"]["Insert"]>;
      };
      route_states: {
        Row: {
          route_id: number;
          status: RouteStatus;
          first_detected_available_at: string | null;
          sold_out_at: string | null;
          last_available_at: string | null;
          last_checked_at: string | null;
          seats_remaining: number | null;
          consecutive_error_count: number;
          updated_at: string;
        };
        Insert: {
          route_id: number;
          status?: RouteStatus;
          first_detected_available_at?: string | null;
          sold_out_at?: string | null;
          last_available_at?: string | null;
          last_checked_at?: string | null;
          seats_remaining?: number | null;
          consecutive_error_count?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["route_states"]["Insert"]>;
      };
      route_events: {
        Row: {
          id: number;
          route_id: number;
          event_type: RouteEventType;
          occurred_at: string;
          metadata: Json | null;
        };
        Insert: {
          id?: number;
          route_id: number;
          event_type: RouteEventType;
          occurred_at?: string;
          metadata?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["route_events"]["Insert"]>;
      };
      scrape_snapshots: {
        Row: {
          id: number;
          route_id: number;
          checked_at: string;
          success: boolean;
          raw_status: string | null;
          raw_payload: Json | null;
        };
        Insert: {
          id?: number;
          route_id: number;
          checked_at?: string;
          success: boolean;
          raw_status?: string | null;
          raw_payload?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["scrape_snapshots"]["Insert"]>;
      };
      daily_route_stats: {
        Row: {
          route_id: number;
          stat_date: string;
          was_available: boolean;
          sellout_duration_minutes: number | null;
          created_at: string;
        };
        Insert: {
          route_id: number;
          stat_date: string;
          was_available?: boolean;
          sellout_duration_minutes?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["daily_route_stats"]["Insert"]>;
      };
      users: {
        Row: {
          id: string;
          email: string;
          home_airport_code: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          home_airport_code?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      alert_subscriptions: {
        Row: {
          id: number;
          user_id: string;
          route_id: number;
          channel: AlertChannel;
          created_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          route_id: number;
          channel: AlertChannel;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alert_subscriptions"]["Insert"]>;
      };
      notification_log: {
        Row: {
          id: number;
          user_id: string;
          route_id: number;
          route_event_id: number | null;
          channel: AlertChannel;
          sent_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          route_id: number;
          route_event_id?: number | null;
          channel: AlertChannel;
          sent_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notification_log"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: number;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan: SubscriptionPlan;
          status: SubscriptionStatus;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan?: SubscriptionPlan;
          status?: SubscriptionStatus;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
    };
  };
}
