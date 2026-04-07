import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordOperationalEvent } from "@/lib/operational-events";

type DbMessageType = "text" | "image" | "video" | "audio" | "document";
type DbMessageStatus = "pending" | "sent" | "delivered" | "read";

function unwrapPayload(payload: any) {
  if (payload?.body?.event && payload?.body?.data) {
    return payload.body;
  }

  return payload;
}

function isDirectChatJid(remoteJid: string) {
  return typeof remoteJid === "string" && remoteJid.endsWith("@s.whatsapp.net");
}

function extractPhoneFromJid(remoteJid: string) {
  return typeof remoteJid === "string" ? remoteJid.replace(/@.+$/, "") : "";
}

function getRawMessage(payload: any) {
  return payload?.data?.message || {};
}

function getDocumentMessage(payload: any) {
  const message = getRawMessage(payload);
  return message.documentMessage || message.documentWithCaptionMessage?.message?.documentMessage || null;
}

function detectRawMessageType(payload: any) {
  const explicitType = payload?.data?.messageType;
  if (typeof explicitType === "string" && explicitType) {
    return explicitType;
  }

  const message = getRawMessage(payload);

  if (message.conversation) return "conversation";
  if (message.extendedTextMessage?.text) return "extendedTextMessage";
  if (message.imageMessage) return "imageMessage";
  if (message.videoMessage) return "videoMessage";
  if (message.audioMessage) return "audioMessage";
  if (message.documentWithCaptionMessage?.message?.documentMessage) return "documentWithCaptionMessage";
  if (message.documentMessage) return "documentMessage";
  if (message.stickerMessage) return "stickerMessage";

  return "conversation";
}

function mapToDbMessageType(rawType: string): DbMessageType {
  if (rawType === "imageMessage" || rawType === "stickerMessage") return "image";
  if (rawType === "videoMessage") return "video";
  if (rawType === "audioMessage") return "audio";
  if (rawType === "documentMessage" || rawType === "documentWithCaptionMessage") return "document";
  return "text";
}

function extractMessageContent(payload: any, rawType: string) {
  const message = getRawMessage(payload);
  const documentMessage = getDocumentMessage(payload);

  if (rawType === "conversation") {
    return message.conversation || "";
  }

  if (rawType === "extendedTextMessage") {
    return message.extendedTextMessage?.text || "";
  }

  if (rawType === "imageMessage") {
    return message.imageMessage?.caption || "";
  }

  if (rawType === "videoMessage") {
    return message.videoMessage?.caption || "";
  }

  if (rawType === "documentMessage" || rawType === "documentWithCaptionMessage") {
    return documentMessage?.caption || documentMessage?.fileName || documentMessage?.title || "";
  }

  return "";
}

function buildMessagePreview(messageType: DbMessageType, content: string, rawType: string) {
  const trimmed = content.trim();
  if (trimmed) return trimmed;

  if (messageType === "image") {
    return rawType === "stickerMessage" ? "[Sticker]" : "[Imagem]";
  }

  if (messageType === "video") return "[Video]";
  if (messageType === "audio") return "[Audio]";
  if (messageType === "document") return "[Documento]";

  return "[Mensagem]";
}

function extractMediaUrl(payload: any, rawType: string) {
  const message = getRawMessage(payload);
  const documentMessage = getDocumentMessage(payload);

  if (typeof payload?.media_url === "string" && payload.media_url.trim()) {
    return payload.media_url.trim();
  }

  if (rawType === "imageMessage") return message.imageMessage?.url || null;
  if (rawType === "videoMessage") return message.videoMessage?.url || null;
  if (rawType === "audioMessage") return message.audioMessage?.url || null;
  if (rawType === "documentMessage" || rawType === "documentWithCaptionMessage") {
    return documentMessage?.url || null;
  }
  if (rawType === "stickerMessage") return message.stickerMessage?.url || null;

  return null;
}

function mapStatus(rawStatus: unknown, fromMe: boolean): DbMessageStatus {
  const normalized = String(rawStatus || "").toUpperCase();

  if (normalized.includes("READ")) return "read";
  if (normalized.includes("DELIVERY")) return "delivered";
  if (normalized.includes("SENT")) return "sent";
  if (normalized.includes("PENDING")) return "pending";

  return fromMe ? "sent" : "delivered";
}

function parseProviderTimestamp(rawTimestamp: unknown) {
  const timestampNumber = Number(rawTimestamp);
  if (!Number.isFinite(timestampNumber) || timestampNumber <= 0) {
    return new Date().toISOString();
  }

  const milliseconds = timestampNumber > 1_000_000_000_000 ? timestampNumber : timestampNumber * 1000;
  return new Date(milliseconds).toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const incomingPayload = await req.json();
    const payload = unwrapPayload(incomingPayload);
    const supabase = getSupabaseAdmin();

    const event = payload?.event || "";
    if (event !== "messages.upsert") {
      return NextResponse.json({ success: true, processed: false, reason: "ignored_event", event });
    }

    const remoteJid = payload?.data?.key?.remoteJid || "";
    if (!isDirectChatJid(remoteJid)) {
      return NextResponse.json({ success: true, processed: false, reason: "ignored_jid", remoteJid });
    }

    const providerMessageId = payload?.data?.key?.id || "";
    if (!providerMessageId) {
      return NextResponse.json(
        { success: true, processed: false, reason: "missing_provider_message_id" },
        { status: 400 }
      );
    }

    const instanceName = payload?.instance || payload?.data?.instance || "";
    if (!instanceName) {
      return NextResponse.json({ success: true, processed: false, reason: "missing_instance" }, { status: 400 });
    }

    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, user_id, instance_name")
      .eq("instance_name", instanceName)
      .is("deleted_at", null)
      .limit(1)
      .single();

    if (instanceError || !instance) {
      await recordOperationalEvent({
        source: "chat_inbound_v2",
        eventType: "instance_not_found",
        severity: "error",
        status: "error",
        message: "Webhook da Evolution recebido para uma instancia inexistente.",
        metadata: {
          instance_name: instanceName,
          remote_jid: remoteJid,
          provider_message_id: providerMessageId || null,
        },
      });

      return NextResponse.json(
        { success: false, processed: false, reason: "instance_not_found", instance_name: instanceName },
        { status: 404 }
      );
    }

    const rawType = detectRawMessageType(payload);
    const messageType = mapToDbMessageType(rawType);
    const content = extractMessageContent(payload, rawType);
    const preview = buildMessagePreview(messageType, content, rawType);
    const mediaUrl = extractMediaUrl(payload, rawType);
    const fromMe = Boolean(payload?.data?.key?.fromMe);
    const status = mapStatus(payload?.data?.status, fromMe);
    const providerTimestamp = parseProviderTimestamp(payload?.data?.messageTimestamp);
    const contactName = payload?.data?.pushName || null;
    const contactPhone = extractPhoneFromJid(remoteJid);

    const { data: rpcResult, error: rpcError } = await supabase.rpc("upsert_inbound_chat_message", {
      p_instance_id: instance.id,
      p_user_id: instance.user_id,
      p_remote_jid: remoteJid,
      p_contact_name: contactName,
      p_contact_phone: contactPhone,
      p_provider_message_id: providerMessageId,
      p_from_me: fromMe,
      p_message_type: messageType,
      p_content: content,
      p_media_url: mediaUrl,
      p_status: status,
      p_message_created_at: providerTimestamp,
      p_message_preview: preview,
      p_provider_payload: payload,
    });

    if (rpcError) {
      console.error("Evolution webhook RPC error:", rpcError);
      await recordOperationalEvent({
        userId: instance.user_id,
        source: "chat_inbound_v2",
        eventType: "persist_failed",
        severity: "error",
        status: "error",
        entityType: "whatsapp_instance",
        entityId: instance.id,
        message: rpcError.message,
        metadata: {
          instance_name: instance.instance_name,
          remote_jid: remoteJid,
          provider_message_id: providerMessageId,
          message_type: messageType,
          from_me: fromMe,
        },
      });
      return NextResponse.json({ success: false, processed: false, error: rpcError.message }, { status: 500 });
    }

    // Fase 2: persistencia idempotente primeiro. O dispatcher de automacoes entra no passo seguinte.
    return NextResponse.json({
      success: true,
      processed: true,
      event,
      instance_name: instance.instance_name,
      remote_jid: remoteJid,
      result: rpcResult,
    });
  } catch (error: any) {
    console.error("Evolution webhook error:", error);
    await recordOperationalEvent({
      source: "chat_inbound_v2",
      eventType: "unhandled_exception",
      severity: "error",
      status: "error",
      message: String(error?.message || error),
    });
    return NextResponse.json({ success: false, error: String(error?.message || error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
