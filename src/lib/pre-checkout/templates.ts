import type {
  PreCheckoutForm,
  PreCheckoutFormStep,
  PreCheckoutTemplateDefinition,
  PreCheckoutTemplateKey,
} from "@/types";

const defaultTheme: PreCheckoutForm["theme"] = {
  style_key: "dark",
  primary_color: "#8B5CF6",
  text_color: "#F5F5F7",
  panel_color: "#17171C",
  top_image_url: null,
  background: {
    mode: "solid",
    color: "#0B0B10",
    image_url: null,
    image_focus_x: 50,
    image_focus_y: 50,
    image_overlay: 45,
    full_bleed: true,
  },
  typography: {
    heading_font: "Inter",
    body_font: "Inter",
    button_radius: "lg",
  },
  layout: {
    width: "md",
    align: "center",
    spacing: "comfortable",
  },
};

const defaultSessionSettings: PreCheckoutForm["session_settings"] = {
  resume_window_minutes: 1440,
  abandonment_window_minutes: 60,
};

const baseSupports = {
  topImage: true,
  backgroundImage: true,
  redirect: true,
  pixel: true,
};

export const PRE_CHECKOUT_TEMPLATES: Record<PreCheckoutTemplateKey, PreCheckoutTemplateDefinition> = {
  "lead-capture-classic": {
    key: "lead-capture-classic",
    version: 1,
    name: "Captura Clássica",
    description: "Formulário direto para aquecer o lead antes do checkout.",
    category: "Conversão",
    thumbnail: "gradient-lead-classic",
    supports: baseSupports,
    lockedFields: ["template_key", "template_version"],
    form: {
      name: "Pré-checkout Clássico",
      description: "Colete o essencial, aqueça o lead e redirecione para a próxima ação.",
      theme: defaultTheme,
      final_config: {
        action: "checkout_redirect",
        redirect_url: "",
        thank_you_title: "Tudo certo",
        thank_you_description: "Você está indo para a próxima etapa.",
      },
      integrations: {
        tag_ids: [],
        pixel_enabled: true,
      },
      session_settings: defaultSessionSettings,
    },
    steps: [
      {
        step_key: "nome",
        position: 0,
        type: "short_text",
        title: "Qual é o seu nome?",
        description: "Quero te chamar do jeito certo na próxima etapa.",
        placeholder: "Digite seu nome",
        is_required: true,
        options: [],
        settings: { auto_focus: true, max_length: 120 },
      },
      {
        step_key: "telefone",
        position: 1,
        type: "phone",
        title: "Qual é o seu WhatsApp?",
        description: "É por onde vamos te avisar e acompanhar.",
        placeholder: "(11) 99999-9999",
        is_required: true,
        options: [],
        settings: { max_length: 24 },
      },
      {
        step_key: "email",
        position: 2,
        type: "email",
        title: "Qual é o seu melhor e-mail?",
        description: "Vamos te enviar o acesso e materiais complementares.",
        placeholder: "voce@exemplo.com",
        is_required: false,
        options: [],
        settings: { max_length: 160 },
      },
    ],
  },
  "application-focus": {
    key: "application-focus",
    version: 1,
    name: "Aplicação e Qualificação",
    description: "Modelo para filtrar leads antes de liberar oferta ou reunião.",
    category: "Qualificação",
    thumbnail: "gradient-application-focus",
    supports: baseSupports,
    lockedFields: ["template_key", "template_version"],
    form: {
      name: "Pré-checkout de Qualificação",
      description: "Descubra se o lead está no perfil certo antes de seguir.",
      theme: {
        ...defaultTheme,
        style_key: "light",
        text_color: "#12141A",
        panel_color: "#FFFFFF",
        background: {
          ...defaultTheme.background,
          color: "#F5F7FB",
          image_overlay: 18,
        },
      },
      final_config: {
        action: "thank_you",
        thank_you_title: "Aplicação enviada",
        thank_you_description: "Agora vamos revisar seu perfil e te chamar no próximo passo.",
      },
      integrations: {
        tag_ids: [],
        pixel_enabled: true,
      },
      session_settings: defaultSessionSettings,
    },
    steps: [
      {
        step_key: "nome",
        position: 0,
        type: "short_text",
        title: "Como você quer ser chamado?",
        description: "",
        placeholder: "Seu nome",
        is_required: true,
        options: [],
        settings: { auto_focus: true, max_length: 120 },
      },
      {
        step_key: "faturamento",
        position: 1,
        type: "single_choice",
        title: "Qual faixa de faturamento atual do seu negócio?",
        description: "Isso nos ajuda a personalizar a próxima etapa.",
        placeholder: "",
        is_required: true,
        options: [
          { id: "ate-10k", label: "Até R$ 10 mil", value: "ate-10k" },
          { id: "10k-30k", label: "De R$ 10 mil a R$ 30 mil", value: "10k-30k" },
          { id: "30k-100k", label: "De R$ 30 mil a R$ 100 mil", value: "30k-100k" },
          { id: "100k-plus", label: "Acima de R$ 100 mil", value: "100k-plus" },
        ],
        settings: {},
      },
      {
        step_key: "telefone",
        position: 2,
        type: "phone",
        title: "Qual é o seu WhatsApp principal?",
        description: "Se fizer sentido, seguimos por aqui.",
        placeholder: "(11) 99999-9999",
        is_required: true,
        options: [],
        settings: { max_length: 24 },
      },
    ],
  },
  "warmup-whatsapp": {
    key: "warmup-whatsapp",
    version: 1,
    name: "Aquecimento para WhatsApp",
    description: "Modelo rápido para redirecionar o lead para a conversa certa.",
    category: "WhatsApp",
    thumbnail: "gradient-whatsapp-warmup",
    supports: baseSupports,
    lockedFields: ["template_key", "template_version"],
    form: {
      name: "Pré-checkout via WhatsApp",
      description: "Capture intenção e continue o atendimento com contexto.",
      theme: {
        ...defaultTheme,
        primary_color: "#22C55E",
      },
      final_config: {
        action: "whatsapp_redirect",
        whatsapp_phone: "",
        whatsapp_message: "Olá! Acabei de preencher o formulário e quero continuar.",
      },
      integrations: {
        tag_ids: [],
        pixel_enabled: true,
      },
      session_settings: defaultSessionSettings,
    },
    steps: [
      {
        step_key: "nome",
        position: 0,
        type: "short_text",
        title: "Qual é o seu nome?",
        description: "",
        placeholder: "Digite seu nome",
        is_required: true,
        options: [],
        settings: { auto_focus: true, max_length: 120 },
      },
      {
        step_key: "objetivo",
        position: 1,
        type: "long_text",
        title: "O que você quer resolver agora?",
        description: "Quanto melhor você responder, melhor será o atendimento no WhatsApp.",
        placeholder: "Conte brevemente o seu cenário",
        is_required: true,
        options: [],
        settings: { max_length: 500 },
      },
      {
        step_key: "telefone",
        position: 2,
        type: "phone",
        title: "Qual é o seu melhor número de contato?",
        description: "",
        placeholder: "(11) 99999-9999",
        is_required: true,
        options: [],
        settings: { max_length: 24 },
      },
    ],
  },
};

export const PRE_CHECKOUT_TEMPLATE_LIST = Object.values(PRE_CHECKOUT_TEMPLATES);

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getPreCheckoutTemplate(templateKey: string): PreCheckoutTemplateDefinition | null {
  return PRE_CHECKOUT_TEMPLATES[templateKey as PreCheckoutTemplateKey] || null;
}

export function buildFormFromTemplate(templateKey: string): {
  form: Omit<PreCheckoutForm, "id" | "user_id" | "slug" | "status" | "published_at" | "archived_at" | "created_at" | "updated_at"> & { name: string };
  steps: Array<Omit<PreCheckoutFormStep, "id" | "form_id" | "created_at" | "updated_at">>;
} | null {
  const template = getPreCheckoutTemplate(templateKey);
  if (!template) return null;

  return {
    form: {
      name: template.form.name,
      description: template.form.description,
      template_key: template.key,
      template_version: template.version,
      theme: deepClone(template.form.theme),
      final_config: deepClone(template.form.final_config),
      integrations: deepClone(template.form.integrations),
      session_settings: deepClone(template.form.session_settings),
    },
    steps: template.steps.map((step) => ({
      step_key: step.step_key,
      position: step.position,
      type: step.type,
      title: step.title,
      description: step.description,
      placeholder: step.placeholder,
      is_required: step.is_required,
      options: deepClone(step.options),
      settings: deepClone(step.settings),
    })),
  };
}
