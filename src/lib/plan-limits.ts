export const PLAN_LIMITS = {
  starter: {
    max_leads: 500,
    max_whatsapp_instances: 1,
    max_mass_messages_per_month: 500,
    max_media_gb: 5,
    has_keyword_triggers: false,
    has_unlimited_flows: false,
    has_priority_support: false,
    has_community: false,
    has_early_ai_access: false,
  },
  pro: {
    max_leads: Infinity,
    max_whatsapp_instances: 3,
    max_mass_messages_per_month: 5000,
    max_media_gb: 15,
    has_keyword_triggers: true,
    has_unlimited_flows: true,
    has_priority_support: false,
    has_community: false,
    has_early_ai_access: false,
  },
  black: {
    max_leads: Infinity,
    max_whatsapp_instances: 5,
    max_mass_messages_per_month: 10000,
    max_media_gb: 30,
    has_keyword_triggers: true,
    has_unlimited_flows: true,
    has_priority_support: true,
    has_community: true,
    has_early_ai_access: true,
  },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

export function getPlanLimits(planId: string) {
  return PLAN_LIMITS[planId as PlanId] || PLAN_LIMITS.starter;
}

export function formatLimit(value: number): string {
  if (value === Infinity) return "Ilimitado";
  return value.toLocaleString("pt-BR");
}
