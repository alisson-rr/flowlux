export const PLAN_LIMITS = {
  starter: {
    max_leads: 500,
    max_whatsapp_instances: 1,
    max_mass_messages_per_month: 500,
    has_automations_ai: false,
    has_members_area: false,
    has_media_management: false,
    has_priority_support: false,
  },
  professional: {
    max_leads: Infinity,
    max_whatsapp_instances: 3,
    max_mass_messages_per_month: Infinity,
    has_automations_ai: true,
    has_members_area: true,
    has_media_management: true,
    has_priority_support: true,
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
