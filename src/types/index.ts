export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar_url?: string;
  created_at: string;
}

export interface WhatsappInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: "connected" | "disconnected" | "connecting";
  phone_number?: string;
  created_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email?: string;
  stage_id: string;
  tags: Tag[];
  notes: Note[];
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface FunnelStage {
  id: string;
  user_id: string;
  name: string;
  color: string;
  order: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
}

export interface Note {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  instance_id: string;
  remote_jid: string;
  contact_name?: string;
  contact_phone: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  remote_jid: string;
  from_me: boolean;
  message_type: "text" | "image" | "video" | "audio" | "document";
  content: string;
  media_url?: string;
  status: "pending" | "sent" | "delivered" | "read";
  created_at: string;
}

export interface AutomationTrigger {
  id: string;
  user_id: string;
  name: string;
  type: "keyword" | "schedule" | "event";
  keywords?: string[];
  schedule_cron?: string;
  message_template: string;
  is_active: boolean;
  created_at: string;
}

export interface MassMessage {
  id: string;
  user_id: string;
  name: string;
  message: string;
  target_tags?: string[];
  target_stages?: string[];
  status: "draft" | "scheduled" | "sending" | "completed" | "completed_with_errors" | "failed" | "cancelled";
  scheduled_at?: string;
  sent_count: number;
  failed_count: number;
  total_count: number;
  started_at?: string;
  completed_at?: string;
  last_error?: string;
  created_at: string;
}

export interface MassMessageDelivery {
  id: string;
  mass_message_id: string;
  user_id: string;
  lead_id?: string | null;
  instance_id?: string | null;
  lead_name: string;
  lead_phone: string;
  normalized_phone: string;
  remote_jid?: string | null;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  attempt_count: number;
  last_attempt_at?: string | null;
  sent_at?: string | null;
  failure_reason?: string | null;
  provider_response?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ScheduledMessage {
  id: string;
  user_id: string;
  lead_id?: string | null;
  instance_id?: string | null;
  message: string;
  scheduled_at: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  attempt_count: number;
  claimed_at?: string | null;
  last_attempt_at?: string | null;
  sent_at?: string | null;
  failure_reason?: string | null;
  provider_response?: Record<string, unknown>;
  media_url?: string | null;
  media_type?: "image" | "video" | "document" | null;
  file_name?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ScheduledMessageAttempt {
  id: string;
  scheduled_message_id: string;
  user_id: string;
  lead_id?: string | null;
  instance_id?: string | null;
  attempt_number: number;
  target_phone: string;
  normalized_phone?: string | null;
  lead_name: string;
  instance_name?: string | null;
  status: "processing" | "sent" | "failed" | "skipped";
  attempted_at: string;
  completed_at?: string | null;
  failure_reason?: string | null;
  provider_response?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  category?: string;
  created_at: string;
}

export interface HotmartWebhook {
  id: string;
  user_id: string;
  event: string;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: "starter" | "pro" | "black";
  status: "pending" | "pending_payment" | "authorized" | "paused" | "cancelled" | "trial" | "active";
  mp_preapproval_id?: string;
  mp_payer_id?: string;
  mp_payer_email?: string;
  trial_start?: string;
  trial_end?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPayment {
  id: string;
  user_id: string;
  subscription_id?: string;
  mp_payment_id?: string;
  status: "approved" | "pending" | "in_process" | "rejected" | "refunded" | "cancelled";
  amount: number | null;
  currency: string;
  payment_method?: string;
  description?: string;
  paid_at?: string;
  created_at: string;
}

export interface DashboardMetrics {
  total_leads: number;
  new_leads_today: number;
  total_conversations: number;
  messages_sent_today: number;
  conversion_rate: number;
  leads_by_stage: { stage: string; count: number; color: string }[];
  messages_over_time: { date: string; sent: number; received: number }[];
  top_tags: { tag: string; count: number; color: string }[];
}
