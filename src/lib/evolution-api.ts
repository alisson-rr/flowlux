const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "https://evo.devnoflow.com.br";
const EVOLUTION_API_KEY = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || "gJRYf6JN8RsL2jrPolWZaI7LNOe6XDMC";

async function evolutionFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Evolution API error: ${res.status} - ${error}`);
  }

  return res.json();
}

export const evolutionApi = {
  // Instance management
  createInstance: (instanceName: string) =>
    evolutionFetch("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    }),

  getInstanceStatus: (instanceName: string) =>
    evolutionFetch(`/instance/connectionState/${instanceName}`),

  getQrCode: (instanceName: string) =>
    evolutionFetch(`/instance/connect/${instanceName}`),

  restartInstance: (instanceName: string) =>
    evolutionFetch(`/instance/restart/${instanceName}`, { method: "PUT" }),

  logoutInstance: (instanceName: string) =>
    evolutionFetch(`/instance/logout/${instanceName}`, { method: "DELETE" }),

  deleteInstance: (instanceName: string) =>
    evolutionFetch(`/instance/delete/${instanceName}`, { method: "DELETE" }),

  fetchInstances: () => evolutionFetch("/instance/fetchInstances"),

  // Messaging
  sendText: (instanceName: string, number: string, text: string) =>
    evolutionFetch(`/message/sendText/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number,
        text,
      }),
    }),

  sendMedia: (instanceName: string, number: string, mediaUrl: string, mediaType: string, caption?: string, fileName?: string) =>
    evolutionFetch(`/message/sendMedia/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number,
        mediatype: mediaType === "image" ? "image" : mediaType === "video" ? "video" : "document",
        media: mediaUrl,
        caption: caption || "",
        fileName: fileName || "",
      }),
    }),

  sendAudio: (instanceName: string, number: string, audioUrl: string) =>
    evolutionFetch(`/message/sendWhatsAppAudio/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number,
        audio: audioUrl,
      }),
    }),

  // Chat
  fetchMessages: (instanceName: string, remoteJid: string, limit = 50) =>
    evolutionFetch(`/chat/findMessages/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        where: { key: { remoteJid } },
        limit,
      }),
    }),

  fetchChats: (instanceName: string) =>
    evolutionFetch(`/chat/findChats/${instanceName}`),

  // Webhook
  setWebhook: (instanceName: string, webhookUrl: string) =>
    evolutionFetch(`/webhook/set/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        enabled: true,
        url: webhookUrl,
        webhookByEvents: true,
        webhookBase64: true,
        events: [
          "MESSAGES_UPSERT",
        ],
      }),
    }),
};
