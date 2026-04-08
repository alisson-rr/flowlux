import { createCaptureField, defaultCapturePopupFromTemplate } from "@/lib/capture-popups/popups";
import type { CapturePopupTemplateDefinition, CapturePopupTemplateKey } from "@/types";

export const CAPTURE_POPUP_TEMPLATE_LIST: CapturePopupTemplateDefinition[] = [
  {
    key: "lead-capture-minimal",
    version: 1,
    name: "Captura Minimalista",
    description: "Modal clean com foco em nome, email e continuidade para o checkout.",
    category: "Conversao direta",
    thumbnail: "minimal-popup",
    popup: {
      ...defaultCapturePopupFromTemplate("lead-capture-minimal"),
      name: "Captura Minimalista",
      description: "Popup simples para capturar o lead antes do checkout.",
      content: {
        title: "Insira seu nome e email para onde devemos enviar...",
        description: "",
        button_text: "Me envie agora",
        disclaimer: "",
        success_title: "Perfeito",
        success_description: "Recebemos seus dados. Voce esta indo para a proxima etapa.",
        footer_note: "",
      },
      theme: {
        ...defaultCapturePopupFromTemplate("lead-capture-minimal").theme,
        style_key: "light",
        panel_background: "#FFFFFF",
        panel_text_color: "#202229",
        button_color: "#18E53A",
        button_text_color: "#FFFFFF",
        field_background: "#F3F6F8",
        field_text_color: "#202229",
        field_border_color: "#D8E0E6",
        overlay_color: "#111116",
        overlay_opacity: 55,
      },
    },
    fields: [
      { ...createCaptureField("name", 0), field_key: "name", label: "Nome", placeholder: "Escreva seu nome" },
      { ...createCaptureField("email", 1), field_key: "email", label: "E-mail", placeholder: "Informe seu melhor email" },
      { ...createCaptureField("phone", 2), field_key: "phone", label: "WhatsApp", placeholder: "Informe seu numero do WhatsApp" },
    ],
  },
  {
    key: "offer-inline-dark",
    version: 1,
    name: "Oferta Escura",
    description: "Visual promocional mais agressivo com CTA forte para oferta ou checkout.",
    category: "Oferta",
    thumbnail: "dark-offer-popup",
    popup: {
      ...defaultCapturePopupFromTemplate("offer-inline-dark"),
      name: "Oferta Escura",
      description: "Popup promocional para oferta principal.",
      content: {
        title: "Quase la...",
        description: "Preencha os dados abaixo para continuar sua compra.",
        button_text: "Prosseguir com a compra",
        disclaimer: "",
        success_title: "Tudo certo",
        success_description: "Agora vamos te levar para a proxima etapa.",
        footer_note: "",
      },
    },
    fields: [
      { ...createCaptureField("name", 0), field_key: "name", label: "Digite seu nome", placeholder: "Digite seu nome" },
      { ...createCaptureField("email", 1), field_key: "email", label: "Digite seu email", placeholder: "Digite seu email" },
    ],
  },
  {
    key: "whatsapp-fast-pass",
    version: 1,
    name: "WhatsApp Fast Pass",
    description: "Popup enxuto para puxar WhatsApp e seguir para conversa ou fechamento.",
    category: "WhatsApp",
    thumbnail: "whatsapp-fast-pass",
    popup: {
      ...defaultCapturePopupFromTemplate("whatsapp-fast-pass"),
      name: "WhatsApp Fast Pass",
      description: "Capte o WhatsApp e leve o lead para o fluxo certo.",
      content: {
        title: "Receba o acesso no WhatsApp",
        description: "Preencha rapidamente para continuar.",
        button_text: "Quero receber",
        disclaimer: "",
        success_title: "Boa",
        success_description: "Estamos te levando para o WhatsApp.",
        footer_note: "",
      },
      integrations: {
        ...defaultCapturePopupFromTemplate("whatsapp-fast-pass").integrations,
        success_mode: "whatsapp",
      },
    },
    fields: [
      { ...createCaptureField("name", 0), field_key: "name", label: "Nome", placeholder: "Seu nome" },
      { ...createCaptureField("phone", 1), field_key: "phone", label: "WhatsApp", placeholder: "Seu numero com DDD" },
    ],
  },
];

export function buildPopupFromTemplate(templateKey: CapturePopupTemplateKey | string) {
  const template = CAPTURE_POPUP_TEMPLATE_LIST.find((item) => item.key === templateKey);
  if (!template) return null;

  return {
    popup: {
      ...template.popup,
      template_key: template.key,
      template_version: template.version,
    },
    fields: template.fields.map((field) => ({
      ...field,
      id: `temp-${field.field_key}-${Math.random().toString(36).slice(2, 6)}`,
      popup_id: "",
      settings: { ...field.settings },
    })),
  };
}
