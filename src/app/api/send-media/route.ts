import { NextRequest, NextResponse } from "next/server";

const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || "";

async function evolutionFetch(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.text();
    return { ok: false, status: res.status, error };
  }
  const data = await res.json();
  return { ok: true, status: res.status, data };
}

async function urlToBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch media: ${res.status}`);
  const mime = res.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), mime };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, instance_name, number, media_url, media_type, caption, file_name, audio_base64 } = body;

    if (!instance_name || !number) {
      return NextResponse.json({ error: "Missing instance_name or number" }, { status: 400 });
    }

    // === SEND MEDIA (image/video/document) ===
    if (action === "media") {
      if (!media_url) {
        return NextResponse.json({ error: "Missing media_url" }, { status: 400 });
      }

      const mtype = media_type === "image" ? "image" : media_type === "video" ? "video" : "document";
      const ext = (media_url.split("?")[0].split(".").pop() || "").toLowerCase();
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
        mp4: "video/mp4", avi: "video/avi", mov: "video/quicktime",
        pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      const fallbackMime = mtype === "image" ? "image/jpeg" : mtype === "video" ? "video/mp4" : "application/octet-stream";

      // Download media and convert to base64 server-side
      let mediaData = media_url;
      let mimetype = mimeMap[ext] || fallbackMime;
      try {
        const { base64, mime } = await urlToBase64(media_url);
        mediaData = base64;
        if (mime && mime !== "application/octet-stream") mimetype = mime;
      } catch (e) {
        console.warn("Failed to convert to base64, sending URL:", e);
      }

      const result = await evolutionFetch(`/message/sendMedia/${instance_name}`, {
        number,
        mediatype: mtype,
        mimetype,
        media: mediaData,
        caption: caption || "",
        fileName: file_name || (ext ? `file.${ext}` : ""),
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result.data);
    }

    // === SEND AUDIO ===
    if (action === "audio") {
      // Accept either a URL or base64
      const audioData = audio_base64 || media_url;
      if (!audioData) {
        return NextResponse.json({ error: "Missing audio data" }, { status: 400 });
      }

      // If it's a URL, convert to base64 server-side
      let audioToSend = audioData;
      if (audioData.startsWith("http")) {
        try {
          const { base64 } = await urlToBase64(audioData);
          audioToSend = base64;
        } catch {
          // fallback to URL
        }
      }

      const result = await evolutionFetch(`/message/sendWhatsAppAudio/${instance_name}`, {
        number,
        audio: audioToSend,
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result.data);
    }

    return NextResponse.json({ error: "Invalid action. Use 'media' or 'audio'" }, { status: 400 });
  } catch (err: any) {
    console.error("send-media route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
