import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { isPreCheckoutLabEnabledForHost } from "@/lib/feature-access";
import { buildPreCheckoutAiUserPrompt, PRE_CHECKOUT_AI_SYSTEM_PROMPT } from "@/lib/pre-checkout/ai";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

async function parseBody(req: NextRequest) {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function extractJsonPayload(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

async function openAiFetch(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${OPENAI_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

async function runWithAssistant(input: { token: string; assistantId: string; prompt: string }) {
  const threadResponse = await openAiFetch("/threads", input.token, {
    method: "POST",
    headers: { "OpenAI-Beta": "assistants=v2" },
    body: JSON.stringify({
      messages: [{ role: "user", content: input.prompt }],
    }),
  });

  const threadRaw = await threadResponse.text();
  if (!threadResponse.ok) {
    throw new Error(`OpenAI thread error ${threadResponse.status}: ${threadRaw}`);
  }

  const thread = JSON.parse(threadRaw);
  const runResponse = await openAiFetch(`/threads/${thread.id}/runs`, input.token, {
    method: "POST",
    headers: { "OpenAI-Beta": "assistants=v2" },
    body: JSON.stringify({
      assistant_id: input.assistantId,
      response_format: { type: "json_object" },
    }),
  });

  const runRaw = await runResponse.text();
  if (!runResponse.ok) {
    throw new Error(`OpenAI run error ${runResponse.status}: ${runRaw}`);
  }

  let run = JSON.parse(runRaw);
  const startedAt = Date.now();
  while (!["completed", "failed", "cancelled", "expired"].includes(run.status)) {
    if (Date.now() - startedAt > 45_000) {
      throw new Error("OpenAI agent demorou demais para responder.");
    }

    await new Promise((resolve) => setTimeout(resolve, 900));
    const statusResponse = await openAiFetch(`/threads/${thread.id}/runs/${run.id}`, input.token, {
      method: "GET",
      headers: { "OpenAI-Beta": "assistants=v2" },
    });
    const statusRaw = await statusResponse.text();
    if (!statusResponse.ok) {
      throw new Error(`OpenAI run status error ${statusResponse.status}: ${statusRaw}`);
    }
    run = JSON.parse(statusRaw);
  }

  if (run.status !== "completed") {
    throw new Error(`OpenAI agent finalizou com status ${run.status}.`);
  }

  const messagesResponse = await openAiFetch(`/threads/${thread.id}/messages?order=desc&limit=1`, input.token, {
    method: "GET",
    headers: { "OpenAI-Beta": "assistants=v2" },
  });
  const messagesRaw = await messagesResponse.text();
  if (!messagesResponse.ok) {
    throw new Error(`OpenAI messages error ${messagesResponse.status}: ${messagesRaw}`);
  }

  const messages = JSON.parse(messagesRaw);
  const content = messages?.data?.[0]?.content || [];
  const text = content
    .map((item: any) => item?.type === "text" ? item.text?.value : "")
    .filter(Boolean)
    .join("\n");

  return extractJsonPayload(text);
}

async function runWithPrompt(input: { token: string; promptId: string; model: string; prompt: string }) {
  const response = await openAiFetch("/responses", input.token, {
    method: "POST",
    body: JSON.stringify({
      model: input.model,
      prompt: { id: input.promptId },
      input: input.prompt,
      text: { format: { type: "json_object" } },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI responses error ${response.status}: ${raw}`);
  }

  const parsed = JSON.parse(raw);
  const outputText = parsed?.output_text
    || (parsed?.output || [])
      .flatMap((item: any) => item?.content || [])
      .map((content: any) => content?.text || "")
      .join("\n");

  return extractJsonPayload(outputText);
}

async function runWithChatCompletion(input: { token: string; model: string; prompt: string }) {
  const response = await openAiFetch("/chat/completions", input.token, {
    method: "POST",
    body: JSON.stringify({
      model: input.model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PRE_CHECKOUT_AI_SYSTEM_PROMPT },
        { role: "user", content: input.prompt },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI chat error ${response.status}: ${raw}`);
  }

  const parsed = JSON.parse(raw);
  return extractJsonPayload(parsed?.choices?.[0]?.message?.content);
}

async function saveFormAiMessages(input: {
  userId: string;
  formId?: string | null;
  messages: Array<{ role: "assistant" | "user"; content: string; metadata?: Record<string, unknown> }>;
}) {
  if (!input.messages.length) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ai_chat_messages").insert(
    input.messages.map((message) => ({
      user_id: input.userId,
      scope: "form_builder",
      form_id: input.formId || null,
      role: message.role,
      content: message.content.slice(0, 8000),
      metadata: message.metadata || {},
    })),
  );
  if (error) {
    console.warn("Form AI history save skipped:", error.message);
  }
}

export async function GET(req: NextRequest) {
  if (!isPreCheckoutLabEnabledForHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const formId = req.nextUrl.searchParams.get("formId");
  if (!formId) {
    return NextResponse.json({ messages: [] });
  }

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 30)));
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("role,content,created_at,metadata")
    .eq("user_id", userId)
    .eq("scope", "form_builder")
    .eq("form_id", formId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Form AI history load skipped:", error.message);
    return NextResponse.json({ messages: [] });
  }

  return NextResponse.json({ messages: (data || []).reverse() });
}

export async function POST(req: NextRequest) {
  if (!isPreCheckoutLabEnabledForHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await parseBody(req);
  const businessContext = String(body?.businessContext || "").trim();
  const goal = String(body?.goal || "").trim();
  const formId = String(body?.formId || "").trim() || null;
  const token = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_FORM_MODEL || "gpt-4.1-mini").trim();
  const agentId = String(process.env.OPENAI_FORM_AGENT_ID || process.env.OPENAI_FORM_ASSISTANT_ID || "").trim();
  const promptId = String(process.env.OPENAI_FORM_PROMPT_ID || "").trim();

  if (!businessContext || !goal) {
    return NextResponse.json({ error: "Preencha o contexto do negocio e o objetivo do form." }, { status: 400 });
  }

  if (!token) {
    await saveFormAiMessages({
      userId,
      formId,
      messages: [
        { role: "user", content: goal },
        { role: "assistant", content: "A IA interna ainda nao foi configurada no servidor." },
      ],
    });
    return NextResponse.json({ error: "A IA interna ainda nao foi configurada no servidor." }, { status: 500 });
  }

  const prompt = buildPreCheckoutAiUserPrompt({
    businessContext,
    goal,
    audience: body?.audience,
    offer: body?.offer,
    destination: body?.destination,
    preferredStyle: body?.preferredStyle,
  });

  try {
    const reusablePromptId = promptId || (!agentId.startsWith("asst_") ? agentId : "");
    const result = agentId.startsWith("asst_")
      ? await runWithAssistant({ token, assistantId: agentId, prompt })
      : reusablePromptId
        ? await runWithPrompt({ token, promptId: reusablePromptId, model, prompt })
        : await runWithChatCompletion({ token, model, prompt });

    if (!result) {
      return NextResponse.json({ error: "A IA respondeu, mas nao retornou um JSON valido." }, { status: 400 });
    }

    const message = `Estrutura criada com IA para "${businessContext}"${Array.isArray((result as any).steps) ? ` com ${(result as any).steps.length} etapas` : ""}.`;
    await saveFormAiMessages({
      userId,
      formId,
      messages: [
        { role: "user", content: goal },
        { role: "assistant", content: message, metadata: { provider: agentId.startsWith("asst_") ? "assistant" : reusablePromptId ? "prompt" : "chat_completion" } },
      ],
    });

    return NextResponse.json({ result, message });
  } catch (error: any) {
    const message = "A IA interna nao conseguiu montar o form.";
    await saveFormAiMessages({
      userId,
      formId,
      messages: [
        { role: "user", content: goal },
        { role: "assistant", content: message, metadata: { error: String(error?.message || error || "Falha ao interpretar resposta") } },
      ],
    });
    return NextResponse.json({
      error: message,
      details: String(error?.message || error || "Falha ao interpretar resposta"),
    }, { status: 400 });
  }
}
