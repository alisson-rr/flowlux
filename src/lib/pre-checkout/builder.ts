import type {
  PreCheckoutConnectConfig,
  PreCheckoutFormStep,
  PreCheckoutFormStepType,
  PreCheckoutStepOption,
  PreCheckoutWorkflowAction,
  PreCheckoutWorkflowTrigger,
} from "@/types";

export type PreCheckoutStepPaletteCategory =
  | "Contato"
  | "Escolha"
  | "Escala"
  | "Conteudo"
  | "Finalizacao";

export interface PreCheckoutStepPaletteItem {
  type: PreCheckoutFormStepType;
  label: string;
  description: string;
  category: PreCheckoutStepPaletteCategory;
}

export const PRE_CHECKOUT_STEP_PALETTE: PreCheckoutStepPaletteItem[] = [
  { type: "welcome_screen", label: "Tela inicial", description: "Abre o form com contexto e CTA", category: "Conteudo" },
  { type: "statement", label: "Bloco de texto", description: "Texto informativo entre perguntas", category: "Conteudo" },
  { type: "short_text", label: "Texto curto", description: "Resposta curta", category: "Contato" },
  { type: "long_text", label: "Texto longo", description: "Resposta mais aberta", category: "Contato" },
  { type: "email", label: "E-mail", description: "Valida e-mail", category: "Contato" },
  { type: "phone", label: "Telefone", description: "Telefone com máscara inteligente", category: "Contato" },
  { type: "number", label: "Número", description: "Valor numérico", category: "Contato" },
  { type: "date", label: "Data", description: "Escolha uma data", category: "Contato" },
  { type: "single_choice", label: "Múltipla escolha", description: "Escolha única com botões", category: "Escolha" },
  { type: "dropdown", label: "Dropdown", description: "Lista suspensa", category: "Escolha" },
  { type: "yes_no", label: "Sim ou não", description: "Pergunta binária", category: "Escolha" },
  { type: "multiple_choice", label: "Checkbox", description: "Múltiplas opções", category: "Escolha" },
  { type: "rating", label: "Avaliação", description: "Nota de 1 a 5", category: "Escala" },
  { type: "opinion_scale", label: "Escala de opinião", description: "Escala mais ampla", category: "Escala" },
  { type: "legal", label: "Consentimento", description: "Aceite legal/termos", category: "Finalizacao" },
  { type: "end_screen", label: "Tela final", description: "Mensagem final antes da ação", category: "Finalizacao" },
];

function createChoiceOptions(baseKey: string): PreCheckoutStepOption[] {
  return [
    { id: `${baseKey}_1`, label: "Opção 1", value: "opcao_1" },
    { id: `${baseKey}_2`, label: "Opção 2", value: "opcao_2" },
    { id: `${baseKey}_3`, label: "Opção 3", value: "opcao_3" },
  ];
}

export function createBuilderStep(type: PreCheckoutFormStepType, position: number): PreCheckoutFormStep {
  const baseKey = `etapa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  const baseStep: PreCheckoutFormStep = {
    id: `temp-${baseKey}`,
    form_id: "",
    step_key: baseKey,
    position,
    type,
    title: "Nova etapa",
    description: "",
    placeholder: "",
    is_required: true,
    options: [],
    settings: {
      auto_focus: position === 0,
      max_length: 160,
      map_to_contact_field: null,
      media_layout_desktop: "background",
      media_layout_mobile: "background",
    },
  };

  switch (type) {
    case "welcome_screen":
      return {
        ...baseStep,
        is_required: false,
        title: "Vamos começar",
        description: "Responda rapidinho para continuar.",
        settings: { ...baseStep.settings, button_label: "Começar" },
      };
    case "statement":
      return {
        ...baseStep,
        is_required: false,
        title: "Informação importante",
        description: "Use esse espaço para orientar o lead antes da próxima pergunta.",
        settings: { ...baseStep.settings, button_label: "Continuar" },
      };
    case "email":
      return {
        ...baseStep,
        title: "Qual é o seu melhor e-mail?",
        placeholder: "nome@exemplo.com",
        settings: { ...baseStep.settings, map_to_contact_field: "email" },
      };
    case "phone":
      return {
        ...baseStep,
        title: "Qual é o seu WhatsApp?",
        placeholder: "(11) 99999-9999",
        settings: { ...baseStep.settings, max_length: 24, map_to_contact_field: "phone" },
      };
    case "number":
      return {
        ...baseStep,
        title: "Digite um número",
        placeholder: "0",
        settings: { ...baseStep.settings, min_value: 0, max_value: 100 },
      };
    case "date":
      return {
        ...baseStep,
        title: "Escolha uma data",
        placeholder: "",
      };
    case "single_choice":
      return {
        ...baseStep,
        title: "Selecione uma opção",
        options: createChoiceOptions(baseKey),
      };
    case "dropdown":
      return {
        ...baseStep,
        title: "Escolha em uma lista",
        options: createChoiceOptions(baseKey),
      };
    case "yes_no":
      return {
        ...baseStep,
        title: "Sim ou não?",
        options: [
          { id: `${baseKey}_yes`, label: "Sim", value: "sim" },
          { id: `${baseKey}_no`, label: "Não", value: "nao" },
        ],
      };
    case "multiple_choice":
      return {
        ...baseStep,
        title: "Marque as opções que fazem sentido",
        options: createChoiceOptions(baseKey),
      };
    case "rating":
      return {
        ...baseStep,
        title: "Como você avalia isso?",
        settings: { ...baseStep.settings, min_value: 1, max_value: 5 },
      };
    case "opinion_scale":
      return {
        ...baseStep,
        title: "Em uma escala de 1 a 10, qual a sua opinião?",
        settings: { ...baseStep.settings, min_value: 1, max_value: 10, min_label: "Baixo", max_label: "Alto" },
      };
    case "legal":
      return {
        ...baseStep,
        title: "Confirme para continuar",
        description: "Eu concordo em receber contato sobre esta oferta.",
        settings: {
          ...baseStep.settings,
          legal_consent_text: "Eu concordo em receber contato sobre esta oferta.",
          legal_required_label: "Obrigatório para continuar",
          button_label: "Aceitar e continuar",
        },
      };
    case "end_screen":
      return {
        ...baseStep,
        is_required: false,
        title: "Tudo certo",
        description: "Clique abaixo para concluir e seguir.",
        settings: { ...baseStep.settings, button_label: "Finalizar" },
      };
    default:
      return baseStep;
  }
}

export function normalizeBuilderSteps(steps: PreCheckoutFormStep[]) {
  return [...steps]
    .sort((a, b) => a.position - b.position)
    .map((step, index) => ({ ...step, position: index }));
}

export function createDefaultWorkflowAction(type: PreCheckoutWorkflowAction["type"]): PreCheckoutWorkflowAction {
  return {
    id: `action_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    type,
    enabled: true,
    label: "",
    config: {
      message: "",
      phone: "",
      tag_ids: [],
      funnel_id: null,
      stage_id: null,
      flow_id: null,
      url: "",
      webhook_url: "",
      webhook_method: "POST",
      webhook_headers: [],
    },
  };
}

export function createDefaultWorkflowTrigger(type: PreCheckoutWorkflowTrigger["type"]): PreCheckoutWorkflowTrigger {
  return {
    id: `trigger_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    name:
      type === "abandoned"
        ? "Quando houver abandono"
        : type === "ending_reached"
          ? "Quando a etapa final for atingida"
          : type === "full_response_with_conditions"
            ? "Quando houver resposta completa com condição"
            : "Quando houver resposta completa",
    type,
    enabled: true,
    ending_step_key: null,
    conditions: [],
    actions: [],
  };
}

export function createDefaultConnectConfig(): PreCheckoutConnectConfig {
  return {
    meta_pixel_enabled: false,
    meta_pixel_id: "",
    ga4_enabled: false,
    ga4_measurement_id: "",
    gtm_enabled: false,
    gtm_container_id: "",
  };
}
