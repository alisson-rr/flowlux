import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || "";
const EVOLUTION_API_KEY = process.env.NEXT_PUBLIC_EVOLUTION_API_KEY || "";

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

async function sendText(instanceName: string, number: string, text: string) {
  return evolutionFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number, text }),
  });
}

async function urlToBase64Server(url: string): Promise<{ base64: string; detectedMime: string }> {
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { base64: buffer.toString("base64"), detectedMime: contentType };
}

async function sendMedia(instanceName: string, number: string, mediaUrl: string, mediaType: string, caption?: string, fileName?: string) {
  const mtype = mediaType === "image" ? "image" : mediaType === "video" ? "video" : "document";
  const ext = (mediaUrl.split("?")[0].split(".").pop() || "").toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
    mp4: "video/mp4", avi: "video/avi", mov: "video/quicktime",
    pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  const fallbackMime = mtype === "image" ? "image/jpeg" : mtype === "video" ? "video/mp4" : "application/octet-stream";

  // Convert URL to base64 so Evolution API doesn't need to fetch the URL
  let mediaData = mediaUrl;
  let mimetype = mimeMap[ext] || fallbackMime;
  try {
    const { base64, detectedMime } = await urlToBase64Server(mediaUrl);
    mediaData = base64;
    if (detectedMime && detectedMime !== "application/octet-stream") mimetype = detectedMime;
  } catch (e) {
    console.warn("Failed to convert media to base64, sending URL:", e);
  }

  return evolutionFetch(`/message/sendMedia/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number, mediatype: mtype, mimetype, media: mediaData, caption: caption || "", fileName: fileName || (ext ? `file.${ext}` : "") }),
  });
}

async function sendAudio(instanceName: string, number: string, audioUrl: string) {
  return evolutionFetch(`/message/sendWhatsAppAudio/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number, audio: audioUrl }),
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { flow_id, user_id, instance_id, instance_name, remote_jid, conversation_id } = body;

    if (!flow_id || !user_id || !instance_name || !remote_jid) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auth check: verify via Authorization header (Bearer token) or validate user exists
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (token) {
      // Validate the token via Supabase
      const supabaseAuth = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
      );
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      if (!user || user.id !== user_id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      // Fallback: verify user_id exists via service role (for internal calls)
      const supabase = getSupabase();
      const { data: userCheck } = await supabase.auth.admin.getUserById(user_id);
      if (!userCheck?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = getSupabase();

    const { data: steps, error: stepsError } = await supabase
      .from("flow_steps")
      .select("*")
      .eq("flow_id", flow_id)
      .order("step_order", { ascending: true });

    if (stepsError || !steps || steps.length === 0) {
      return NextResponse.json({ error: "Flow steps not found", detail: stepsError?.message }, { status: 404 });
    }

    // Create execution record (non-blocking - table may not exist yet)
    let executionId: string | null = null;
    try {
      const { data: execution } = await supabase
        .from("flow_executions")
        .insert({ flow_id, user_id, instance_id: instance_id || null, remote_jid, status: "running", current_step: 0, total_steps: steps.length })
        .select().single();
      executionId = execution?.id || null;
    } catch { /* flow_executions table may not exist */ }
    const number = remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "");

    // Execute steps sequentially — send message first, then DB writes in parallel
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        if (step.step_type === "delay") {
          await delay((step.delay_seconds || 5) * 1000);
          continue;
        }

        // 1) Send via Evolution API (must complete before DB writes)
        let msgType = step.step_type;
        let msgContent = step.content || "";
        let msgMediaUrl: string | null = null;

        if (step.step_type === "text" && step.content) {
          await sendText(instance_name, number, step.content);
        } else if (step.step_type === "audio" && step.media_url) {
          await sendAudio(instance_name, number, step.media_url);
          msgContent = "";
          msgMediaUrl = step.media_url;
        } else if (["image", "video", "document"].includes(step.step_type) && step.media_url) {
          await sendMedia(instance_name, number, step.media_url, step.step_type, step.content || "", step.file_name || "");
          msgMediaUrl = step.media_url;
        }

        // 2) DB writes in parallel (messages insert + conversation update)
        await Promise.all([
          supabase.from("messages").insert({
            conversation_id, remote_jid, from_me: true, message_type: msgType,
            content: msgContent, media_url: msgMediaUrl, status: "sent",
          }).then(),
          supabase.from("conversations").update({
            last_message: step.step_type === "text" ? step.content : `[${step.step_type}]`,
            last_message_at: new Date().toISOString(),
          }).eq("id", conversation_id).then(),
        ]);
      } catch (stepError: any) {
        if (executionId) {
          await supabase.from("flow_executions").update({ status: "failed", error_message: String(stepError), completed_at: new Date().toISOString() }).eq("id", executionId);
        }
        return NextResponse.json({ error: `Failed at step ${i + 1}: ${stepError}` }, { status: 500 });
      }
    }

    if (executionId) {
      await supabase.from("flow_executions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", executionId);
    }

    return NextResponse.json({ success: true, execution_id: executionId, steps_executed: steps.length });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
