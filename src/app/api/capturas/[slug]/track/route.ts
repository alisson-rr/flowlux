import { NextRequest, NextResponse } from "next/server";
import {
  getPublishedCapturePopup,
  insertCapturePopupEvent,
  withPublicCors,
} from "@/lib/capture-popups/server";

function jsonWithCors(body: unknown, init?: ResponseInit) {
  return withPublicCors(NextResponse.json(body, init));
}

async function parseBody(req: NextRequest) {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function OPTIONS() {
  return withPublicCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const bundle = await getPublishedCapturePopup(slug);

  if (!bundle) {
    return jsonWithCors({ error: "Popup nao encontrado" }, { status: 404 });
  }

  const body = await parseBody(req);
  const eventType = String(body?.event_type || "");
  const allowed = new Set(["view", "open", "close", "redirect", "pixel_error"]);
  if (!allowed.has(eventType)) {
    return jsonWithCors({ error: "Evento invalido" }, { status: 400 });
  }

  await insertCapturePopupEvent({
    popupId: bundle.popup.id,
    userId: bundle.popup.user_id,
    eventType,
    sessionToken: body?.session_token || null,
    status: eventType === "pixel_error" ? "error" : "success",
    metadata: {
      source_url: body?.source_url || null,
      referrer: body?.referrer || null,
      detail: body?.detail || null,
    },
  });

  return jsonWithCors({ success: true });
}
