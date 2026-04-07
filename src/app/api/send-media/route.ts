import { NextRequest, NextResponse } from "next/server";
import { recordOperationalEvent } from "@/lib/operational-events";

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

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function POST(req: NextRequest) {
  let parsedBody: any = null;

  try {
    parsedBody = await req.json();
    const body = parsedBody;
    const { action, instance_name, number, media_url, media_type, caption, file_name, audio_base64, user_id, conversation_id } = body;

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

      let mimetype = mimeMap[ext] || fallbackMime;
      const payload = {
        number,
        mediatype: mtype,
        mimetype,
        caption: caption || "",
        fileName: file_name || (ext ? `file.${ext}` : ""),
      };

      const directResult = await evolutionFetch(`/message/sendMedia/${instance_name}`, {
        ...payload,
        media: media_url,
      });

      if (directResult.ok) {
        return NextResponse.json(directResult.data);
      }

      if (!isRemoteUrl(media_url)) {
        await recordOperationalEvent({
          userId: user_id || null,
          source: "chat_send_media",
          eventType: "provider_send_failed",
          severity: "error",
          status: "error",
          entityType: "conversation",
          entityId: conversation_id || null,
          message: String(directResult.error || "Erro ao enviar mídia"),
          metadata: {
            action,
            instance_name,
            number,
            media_type,
          },
        });
        return NextResponse.json({ error: directResult.error }, { status: directResult.status });
      }

      try {
        const { base64, mime } = await urlToBase64(media_url);
        if (mime && mime !== "application/octet-stream") {
          mimetype = mime;
        }

        const fallbackResult = await evolutionFetch(`/message/sendMedia/${instance_name}`, {
          ...payload,
          mimetype,
          media: base64,
        });

        if (!fallbackResult.ok) {
          await recordOperationalEvent({
            userId: user_id || null,
            source: "chat_send_media",
            eventType: "provider_send_failed",
            severity: "error",
            status: "error",
            entityType: "conversation",
            entityId: conversation_id || null,
            message: String(fallbackResult.error || "Erro ao enviar mídia"),
            metadata: {
              action,
              instance_name,
              number,
              media_type,
              fallback: "base64",
            },
          });
          return NextResponse.json({ error: fallbackResult.error }, { status: fallbackResult.status });
        }

        return NextResponse.json(fallbackResult.data);
      } catch (error) {
        console.warn("Failed to convert media URL to base64 after direct send failure:", error);
        await recordOperationalEvent({
          userId: user_id || null,
          source: "chat_send_media",
          eventType: "provider_send_failed",
          severity: "error",
          status: "error",
          entityType: "conversation",
          entityId: conversation_id || null,
          message: String(directResult.error || error || "Erro ao enviar mídia"),
          metadata: {
            action,
            instance_name,
            number,
            media_type,
            fallback: "base64_conversion_failed",
          },
        });
        return NextResponse.json({ error: directResult.error }, { status: directResult.status });
      }
    }

    // === SEND AUDIO ===
    if (action === "audio") {
      // Accept either a URL or base64
      const audioData = audio_base64 || media_url;
      if (!audioData) {
        return NextResponse.json({ error: "Missing audio data" }, { status: 400 });
      }

      const directResult = await evolutionFetch(`/message/sendWhatsAppAudio/${instance_name}`, {
        number,
        audio: audioData,
      });

      if (directResult.ok) {
        return NextResponse.json(directResult.data);
      }

      if (!isRemoteUrl(audioData)) {
        await recordOperationalEvent({
          userId: user_id || null,
          source: "chat_send_media",
          eventType: "provider_send_failed",
          severity: "error",
          status: "error",
          entityType: "conversation",
          entityId: conversation_id || null,
          message: String(directResult.error || "Erro ao enviar áudio"),
          metadata: {
            action,
            instance_name,
            number,
          },
        });
        return NextResponse.json({ error: directResult.error }, { status: directResult.status });
      }

      try {
        const { base64 } = await urlToBase64(audioData);
        const fallbackResult = await evolutionFetch(`/message/sendWhatsAppAudio/${instance_name}`, {
          number,
          audio: base64,
        });

        if (!fallbackResult.ok) {
          await recordOperationalEvent({
            userId: user_id || null,
            source: "chat_send_media",
            eventType: "provider_send_failed",
            severity: "error",
            status: "error",
            entityType: "conversation",
            entityId: conversation_id || null,
            message: String(fallbackResult.error || "Erro ao enviar áudio"),
            metadata: {
              action,
              instance_name,
              number,
              fallback: "base64",
            },
          });
          return NextResponse.json({ error: fallbackResult.error }, { status: fallbackResult.status });
        }

        return NextResponse.json(fallbackResult.data);
      } catch (error) {
        console.warn("Failed to convert audio URL to base64 after direct send failure:", error);
        await recordOperationalEvent({
          userId: user_id || null,
          source: "chat_send_media",
          eventType: "provider_send_failed",
          severity: "error",
          status: "error",
          entityType: "conversation",
          entityId: conversation_id || null,
          message: String(directResult.error || error || "Erro ao enviar áudio"),
          metadata: {
            action,
            instance_name,
            number,
            fallback: "base64_conversion_failed",
          },
        });
        return NextResponse.json({ error: directResult.error }, { status: directResult.status });
      }
    }

    return NextResponse.json({ error: "Invalid action. Use 'media' or 'audio'" }, { status: 400 });
  } catch (err: any) {
    console.error("send-media route error:", err);
    await recordOperationalEvent({
      userId: parsedBody?.user_id || null,
      source: "chat_send_media",
      eventType: "unhandled_exception",
      severity: "error",
      status: "error",
      entityType: "conversation",
      entityId: parsedBody?.conversation_id || null,
      message: String(err?.message || err),
      metadata: {
        action: parsedBody?.action || null,
        instance_name: parsedBody?.instance_name || null,
        number: parsedBody?.number || null,
      },
    });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
