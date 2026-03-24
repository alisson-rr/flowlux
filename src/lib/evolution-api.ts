const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || "";

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  // Strip data URI prefix — Evolution API wants raw base64
  const idx = dataUri.indexOf(",");
  return idx >= 0 ? dataUri.substring(idx + 1) : dataUri;
}

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
  createInstance: (instanceName: string, webhookUrl?: string) =>
    evolutionFetch("/instance/create", {
      method: "POST",
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
        webhook: webhookUrl ? {
          url: webhookUrl,
          byEvents: true,
          base64: true,
          events: ["MESSAGES_UPSERT"],
        } : undefined,
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

  sendMedia: async (instanceName: string, number: string, mediaUrl: string, mediaType: string, caption?: string, fileName?: string) => {
    const mtype = mediaType === "image" ? "image" : mediaType === "video" ? "video" : "document";
    const ext = (mediaUrl.split("?")[0].split(".").pop() || "").toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
      mp4: "video/mp4", avi: "video/avi", mov: "video/quicktime", mkv: "video/x-matroska",
      pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      zip: "application/zip", csv: "text/csv", txt: "text/plain",
    };
    const fallbackMime = mtype === "image" ? "image/jpeg" : mtype === "video" ? "video/mp4" : "application/octet-stream";
    const mimetype = mimeMap[ext] || fallbackMime;

    // Convert URL to base64 so Evolution API doesn't need to fetch the URL
    let mediaData = mediaUrl;
    try {
      mediaData = await urlToBase64(mediaUrl);
    } catch (e) {
      console.warn("Failed to convert media to base64, sending URL:", e);
    }

    return evolutionFetch(`/message/sendMedia/${instanceName}`, {
      method: "POST",
      body: JSON.stringify({
        number,
        mediatype: mtype,
        mimetype,
        media: mediaData,
        caption: caption || "",
        fileName: fileName || (ext ? `file.${ext}` : ""),
      }),
    });
  },

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
