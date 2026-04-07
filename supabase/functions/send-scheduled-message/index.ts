const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  instance_name: string;
  number: string;
  message?: string;
  media_url?: string | null;
  media_type?: string | null;
  file_name?: string | null;
}

const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

async function evolutionFetch(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
      ...options.headers,
    },
  });

  const rawText = await res.text();
  let parsedBody: unknown = {};

  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = { raw: rawText };
    }
  }

  if (!res.ok) {
    return { ok: false, status: res.status, body: parsedBody };
  }

  return { ok: true, status: res.status, body: parsedBody };
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function urlToBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch media: ${res.status}`);
  }

  const mime = res.headers.get("content-type") || "application/octet-stream";
  const buffer = await res.arrayBuffer();

  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return {
    base64: btoa(binary),
    mime,
  };
}

async function sendText(instanceName: string, number: string, text: string) {
  return evolutionFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number, text }),
  });
}

async function sendMedia(
  instanceName: string,
  number: string,
  mediaUrl: string,
  mediaType: string,
  caption?: string,
  fileName?: string,
) {
  const mtype = mediaType === "image" ? "image" : mediaType === "video" ? "video" : "document";
  const ext = (mediaUrl.split("?")[0].split(".").pop() || "").toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    avi: "video/avi",
    mov: "video/quicktime",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  let mimetype = mimeMap[ext]
    || (mtype === "image" ? "image/jpeg" : mtype === "video" ? "video/mp4" : "application/octet-stream");
  let mediaPayload = mediaUrl;

  if (isRemoteUrl(mediaUrl)) {
    try {
      const { base64, mime } = await urlToBase64(mediaUrl);
      mediaPayload = base64;

      if (mime && mime !== "application/octet-stream") {
        mimetype = mime;
      }
    } catch (error) {
      console.warn("Failed to convert scheduled media to base64, falling back to URL:", error);
    }
  }

  return evolutionFetch(`/message/sendMedia/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      number,
      mediatype: mtype,
      mimetype,
      media: mediaPayload,
      caption: caption || "",
      fileName: fileName || (ext ? `file.${ext}` : "arquivo"),
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { instance_name, number, message, media_url, media_type, file_name } = body;

    if (!instance_name || !number) {
      return new Response(JSON.stringify({ error: "Missing instance_name or number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasMedia = Boolean(media_url && media_type);
    const response = hasMedia
      ? await sendMedia(instance_name, number, String(media_url), String(media_type), message || "", file_name || "")
      : await sendText(instance_name, number, message || "");

    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("send-scheduled-message edge function error:", error);

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
