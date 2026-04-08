import type {
  CapturePopup,
  CapturePopupField,
  CapturePopupFieldType,
  CapturePopupTemplateKey,
} from "@/types";

export function slugifyCapturePopupName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function defaultCapturePopupFromTemplate(templateKey: CapturePopupTemplateKey | string): Omit<CapturePopup, "id" | "user_id" | "slug" | "created_at" | "updated_at"> {
  return {
    name: "Novo popup",
    description: "Capture nome, email e WhatsApp antes de levar o lead para a proxima etapa.",
    template_key: templateKey,
    template_version: 1,
    status: "draft",
    content: {
      title: "Quase la...",
      description: "Preencha seus dados para continuar.",
      button_text: "Prosseguir com a compra",
      disclaimer: "",
      success_title: "Tudo certo",
      success_description: "Recebemos seus dados. Vamos te redirecionar agora.",
      footer_note: "",
    },
    theme: {
      style_key: "promo",
      panel_background: "#111116",
      panel_text_color: "#FFFFFF",
      button_color: "#FF008A",
      button_text_color: "#FFFFFF",
      field_background: "#FFFFFF",
      field_text_color: "#111116",
      field_border_color: "#FFFFFF",
      overlay_color: "#0B0B10",
      overlay_opacity: 72,
      panel_width: "md",
      panel_padding: "md",
      border_radius: "xl",
      font_family: "Montserrat, sans-serif",
      title_font_family: "Montserrat, sans-serif",
      layout_mode: "column",
      image_position: "top",
      image_size: "md",
      background_mode: "solid",
      background_color: "#0B0B10",
      background_image_url: "",
      background_image_focus_x: 50,
      background_image_focus_y: 50,
      top_image_url: "",
    },
    trigger: {
      mode: "delay",
      delay_seconds: 5,
      click_selector: "",
      frequency: "once_per_session",
      show_close_button: true,
    },
    integrations: {
      success_mode: "redirect",
      redirect_url: "",
      whatsapp_phone: "",
      whatsapp_message: "",
      funnel_id: null,
      stage_id: null,
      tag_ids: [],
      flow_on_submit_id: null,
      pixel_enabled: false,
      pixel_id: "",
    },
    published_at: null,
    archived_at: null,
  };
}

export function createCaptureField(type: CapturePopupFieldType, position: number): CapturePopupField {
  const key = `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  const defaults: Record<CapturePopupFieldType, { label: string; placeholder: string; required: boolean; width: "full" | "half" }> = {
    name: { label: "Nome", placeholder: "Digite seu nome", required: true, width: "full" },
    email: { label: "Email", placeholder: "Digite seu melhor email", required: true, width: "full" },
    phone: { label: "WhatsApp", placeholder: "Digite seu numero com DDD", required: true, width: "full" },
    text: { label: "Campo de texto", placeholder: "Digite sua resposta", required: false, width: "full" },
    textarea: { label: "Mensagem", placeholder: "Digite aqui", required: false, width: "full" },
  };

  return {
    id: `temp-${key}`,
    popup_id: "",
    field_key: key,
    position,
    type,
    label: defaults[type].label,
    placeholder: defaults[type].placeholder,
    is_required: defaults[type].required,
    width: defaults[type].width,
    settings: { max_length: type === "textarea" ? 500 : 160, mask: type === "phone" ? "phone" : "" },
  };
}

export function normalizeCaptureFields(fields: CapturePopupField[]) {
  return [...fields]
    .sort((a, b) => a.position - b.position)
    .map((field, index) => ({ ...field, position: index }));
}

export function validateCapturePopupForPublish(popup: CapturePopup, fields: CapturePopupField[]) {
  const errors: string[] = [];

  if (!popup.name.trim()) errors.push("Defina um nome para o pop-up.");
  if (!popup.slug.trim()) errors.push("Defina um identificador de URL para o pop-up.");
  if (!popup.content.title.trim()) errors.push("Defina um titulo principal.");
  if (!popup.content.button_text.trim()) errors.push("Defina o texto do botao principal.");
  if (!fields.length) errors.push("Adicione pelo menos um campo ao pop-up.");

  const hasEmailOrPhone = fields.some((field) => field.type === "email" || field.type === "phone");
  if (!hasEmailOrPhone) errors.push("Inclua pelo menos email ou telefone para capturar o lead.");

  if (popup.integrations.success_mode === "redirect" && !String(popup.integrations.redirect_url || "").trim()) {
    errors.push("Defina a URL de redirecionamento para o sucesso.");
  }

  if (popup.integrations.success_mode === "whatsapp" && !String(popup.integrations.whatsapp_phone || "").trim()) {
    errors.push("Defina o numero de WhatsApp para o redirecionamento.");
  }

  if (popup.trigger.mode === "click" && !String(popup.trigger.click_selector || "").trim()) {
    errors.push("Defina o seletor CSS quando o gatilho for por clique.");
  }

  if (popup.integrations.pixel_enabled && !String(popup.integrations.pixel_id || "").trim()) {
    errors.push("Defina o ID do pixel ou desligue o pixel.");
  }

  return { isValid: errors.length === 0, errors };
}
