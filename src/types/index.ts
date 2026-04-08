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
  provider_message_id?: string | null;
  provider_payload?: Record<string, unknown> | null;
  provider_timestamp?: string | null;
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

export type PreCheckoutTemplateKey =
  | "lead-capture-classic"
  | "application-focus"
  | "warmup-whatsapp";

export type PreCheckoutFormStatus = "draft" | "published" | "paused" | "archived";

export type PreCheckoutFormStepType =
  | "intro"
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "single_choice"
  | "multiple_choice";

export type PreCheckoutFinalAction = "checkout_redirect" | "whatsapp_redirect" | "thank_you" | "flow_only";

export type PreCheckoutSessionStatus = "started" | "in_progress" | "completed" | "abandoned" | "expired";

export type PreCheckoutEventType =
  | "view"
  | "start"
  | "step_answered"
  | "lead_captured"
  | "completed"
  | "redirect_checkout"
  | "redirect_whatsapp"
  | "abandoned";

export interface PreCheckoutThemeBackground {
  mode: "solid" | "image";
  color: string;
  image_url?: string | null;
  image_focus_x: number;
  image_focus_y: number;
  image_overlay: number;
  full_bleed: boolean;
}

export interface PreCheckoutThemeTypography {
  heading_font: string;
  body_font: string;
  button_radius: "sm" | "md" | "lg" | "full";
}

export interface PreCheckoutThemeLayout {
  width: "sm" | "md" | "lg";
  align: "left" | "center";
  spacing: "compact" | "comfortable" | "relaxed";
}

export interface PreCheckoutTheme {
  style_key: "light" | "dark" | "accent";
  primary_color: string;
  text_color: string;
  panel_color: string;
  top_image_url?: string | null;
  background: PreCheckoutThemeBackground;
  typography: PreCheckoutThemeTypography;
  layout: PreCheckoutThemeLayout;
}

export interface PreCheckoutStepOption {
  id: string;
  label: string;
  value: string;
}

export interface PreCheckoutFormStepSettings {
  auto_focus?: boolean;
  max_length?: number | null;
}

export interface PreCheckoutFormStep {
  id: string;
  form_id: string;
  step_key: string;
  position: number;
  type: PreCheckoutFormStepType;
  title: string;
  description?: string | null;
  placeholder?: string | null;
  is_required: boolean;
  options: PreCheckoutStepOption[];
  settings: PreCheckoutFormStepSettings;
  created_at?: string;
  updated_at?: string;
}

export interface PreCheckoutFinalConfig {
  action: PreCheckoutFinalAction;
  redirect_url?: string | null;
  whatsapp_phone?: string | null;
  whatsapp_message?: string | null;
  thank_you_title?: string | null;
  thank_you_description?: string | null;
}

export interface PreCheckoutIntegrationsConfig {
  funnel_id?: string | null;
  stage_id?: string | null;
  tag_ids?: string[];
  flow_on_complete_id?: string | null;
  flow_on_abandon_id?: string | null;
  pixel_id?: string | null;
  pixel_enabled?: boolean;
}

export interface PreCheckoutSessionSettings {
  resume_window_minutes: number;
  abandonment_window_minutes: number;
}

export interface PreCheckoutForm {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string | null;
  template_key: PreCheckoutTemplateKey | string;
  template_version: number;
  status: PreCheckoutFormStatus;
  theme: PreCheckoutTheme;
  final_config: PreCheckoutFinalConfig;
  integrations: PreCheckoutIntegrationsConfig;
  session_settings: PreCheckoutSessionSettings;
  published_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreCheckoutAnswer {
  id: string;
  form_id: string;
  session_id: string;
  step_id: string;
  user_id: string;
  answer_text?: string | null;
  answer_json?: Record<string, unknown>;
  confirmed_at: string;
  created_at: string;
  updated_at: string;
}

export interface PreCheckoutSession {
  id: string;
  form_id: string;
  user_id: string;
  session_token: string;
  resume_token: string;
  status: PreCheckoutSessionStatus;
  lead_id?: string | null;
  current_step_position: number;
  answers_count: number;
  visitor_phone_raw?: string | null;
  visitor_phone_e164?: string | null;
  visitor_phone_search_keys?: string[];
  visitor_email?: string | null;
  metadata?: Record<string, unknown>;
  started_at: string;
  last_interaction_at?: string | null;
  completed_at?: string | null;
  abandoned_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreCheckoutEvent {
  id: string;
  form_id: string;
  user_id: string;
  session_id?: string | null;
  lead_id?: string | null;
  event_type: PreCheckoutEventType;
  status: "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface PreCheckoutTemplateDefinition {
  key: PreCheckoutTemplateKey;
  version: number;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  supports: {
    topImage: boolean;
    backgroundImage: boolean;
    redirect: boolean;
    pixel: boolean;
  };
  lockedFields: string[];
  form: Pick<
    PreCheckoutForm,
    "description" | "theme" | "final_config" | "integrations" | "session_settings"
  > & { name: string };
  steps: Array<
    Pick<
      PreCheckoutFormStep,
      "step_key" | "position" | "type" | "title" | "description" | "placeholder" | "is_required" | "options" | "settings"
    >
  >;
}

export type CapturePopupTemplateKey =
  | "lead-capture-minimal"
  | "offer-inline-dark"
  | "whatsapp-fast-pass";

export type CapturePopupStatus = "draft" | "published" | "paused" | "archived";

export type CapturePopupFieldType = "name" | "email" | "phone" | "text" | "textarea";

export type CapturePopupFieldWidth = "full" | "half";

export type CapturePopupTriggerMode = "on_load" | "delay" | "click" | "manual";

export type CapturePopupDisplayFrequency = "once_per_session" | "once_per_day" | "always";

export type CapturePopupSuccessMode = "inline_message" | "redirect" | "whatsapp";

export type CapturePopupEventType =
  | "view"
  | "open"
  | "close"
  | "submit"
  | "redirect"
  | "pixel_error";

export interface CapturePopupTheme {
  style_key: "light" | "dark" | "promo";
  panel_background: string;
  panel_text_color: string;
  button_color: string;
  button_text_color: string;
  field_background: string;
  field_text_color: string;
  field_border_color: string;
  overlay_color: string;
  overlay_opacity: number;
  panel_width: "xs" | "sm" | "md" | "lg" | "xl";
  panel_padding: "xs" | "sm" | "md" | "lg" | "xl";
  border_radius: "md" | "lg" | "xl";
  font_family: string;
  title_font_family: string;
  layout_mode: "column" | "row";
  image_position: "top" | "bottom" | "left" | "right";
  image_size: "sm" | "md" | "lg" | "half";
  background_mode: "solid" | "image";
  background_color: string;
  background_image_url?: string | null;
  background_image_focus_x: number;
  background_image_focus_y: number;
  top_image_url?: string | null;
}

export interface CapturePopupContent {
  title: string;
  description?: string | null;
  button_text: string;
  disclaimer?: string | null;
  success_title?: string | null;
  success_description?: string | null;
  footer_note?: string | null;
}

export interface CapturePopupTrigger {
  mode: CapturePopupTriggerMode;
  delay_seconds: number;
  click_selector?: string | null;
  frequency: CapturePopupDisplayFrequency;
  show_close_button: boolean;
}

export interface CapturePopupIntegrations {
  redirect_url?: string | null;
  success_mode: CapturePopupSuccessMode;
  whatsapp_phone?: string | null;
  whatsapp_message?: string | null;
  funnel_id?: string | null;
  stage_id?: string | null;
  tag_ids?: string[];
  flow_on_submit_id?: string | null;
  pixel_enabled?: boolean;
  pixel_id?: string | null;
}

export interface CapturePopupFieldSettings {
  max_length?: number | null;
  mask?: string | null;
}

export interface CapturePopupField {
  id: string;
  popup_id: string;
  field_key: string;
  position: number;
  type: CapturePopupFieldType;
  label: string;
  placeholder?: string | null;
  is_required: boolean;
  width: CapturePopupFieldWidth;
  settings: CapturePopupFieldSettings;
  created_at?: string;
  updated_at?: string;
}

export interface CapturePopup {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description?: string | null;
  template_key: CapturePopupTemplateKey | string;
  template_version: number;
  status: CapturePopupStatus;
  content: CapturePopupContent;
  theme: CapturePopupTheme;
  trigger: CapturePopupTrigger;
  integrations: CapturePopupIntegrations;
  published_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapturePopupSubmission {
  id: string;
  popup_id: string;
  user_id: string;
  lead_id?: string | null;
  submission_token: string;
  visitor_name?: string | null;
  visitor_email?: string | null;
  visitor_phone_raw?: string | null;
  visitor_phone_e164?: string | null;
  visitor_phone_search_keys?: string[];
  answers: Record<string, unknown>;
  source_url?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface CapturePopupEvent {
  id: string;
  popup_id: string;
  user_id: string;
  submission_id?: string | null;
  lead_id?: string | null;
  session_token?: string | null;
  event_type: CapturePopupEventType;
  status: "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface CapturePopupTemplateDefinition {
  key: CapturePopupTemplateKey;
  version: number;
  name: string;
  description: string;
  category: string;
  thumbnail: string;
  popup: Pick<CapturePopup, "content" | "theme" | "trigger" | "integrations" | "description"> & { name: string };
  fields: Array<
    Pick<CapturePopupField, "field_key" | "position" | "type" | "label" | "placeholder" | "is_required" | "width" | "settings">
  >;
}
