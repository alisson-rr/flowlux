import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type IncomingMessage = {
  role: "assistant" | "user";
  content: string;
};

const DEFAULT_NINA_INSTRUCTIONS = [
  "Voce e a Nina, guia de operacao do Flow Up.",
  "Responda em portugues do Brasil, com tom direto, humano e pratico.",
  "Ajude infoprodutores a configurar captacao, venda e relacionamento dentro do Flow Up.",
  "Sempre tente orientar o proximo passo com clareza, sem respostas longas demais.",
  "Se a pergunta for sobre algo fora do Flow Up, responda brevemente e traga de volta para a operacao do usuario.",
].join("\n");

function sanitizeMessages(input: unknown): IncomingMessage[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((message): message is IncomingMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Record<string, unknown>;
      return (
        (candidate.role === "assistant" || candidate.role === "user") &&
        typeof candidate.content === "string" &&
        candidate.content.trim().length > 0
      );
    })
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 4000),
    }));
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const output = Array.isArray(response?.output) ? response.output : [];
  return output
    .flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .map((content: any) => content?.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function saveNinaMessages(userId: string, messages: IncomingMessage[]) {
  if (!messages.length) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("ai_chat_messages").insert(
    messages.map((message) => ({
      user_id: userId,
      scope: "home",
      role: message.role,
      content: message.content.slice(0, 8000),
      metadata: {},
    })),
  );
  if (error) {
    console.warn("Nina history save skipped:", error.message);
  }
}

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 30)));
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("role,content,created_at")
    .eq("user_id", userId)
    .eq("scope", "home")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Nina history load skipped:", error.message);
    return NextResponse.json({ messages: [] });
  }

  return NextResponse.json({
    messages: (data || []).reverse(),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const messages = sanitizeMessages(body.messages);
  const context = body.context && typeof body.context === "object" ? body.context as Record<string, unknown> : {};

  if (messages.length === 0) {
    return NextResponse.json({ error: "Envie uma mensagem para a Nina." }, { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const setupMessage = "A Nina ja esta desenhada aqui, mas ainda falta conectar a chave da OpenAI. Configure OPENAI_API_KEY no ambiente e eu comeco a responder por aqui.";
    await saveNinaMessages(userId, [
      ...(lastUserMessage ? [lastUserMessage] : []),
      { role: "assistant", content: setupMessage },
    ]);
    return NextResponse.json({
      message: setupMessage,
      setupRequired: true,
    });
  }

  const systemPrompt = process.env.OPENAI_NINA_SYSTEM_PROMPT || DEFAULT_NINA_INSTRUCTIONS;
  const model = process.env.OPENAI_NINA_MODEL || "gpt-5.1";
  const contextBlock = [
    `Contexto atual do usuario no Flow Up:`,
    `- Nivel: ${String(context.level || "Nao informado")}`,
    `- Progresso: ${String(context.progress ?? "0")}%`,
    `- Proxima missao: ${String(context.nextMission || "Nao informada")}`,
    `- Missoes concluidas: ${String(context.completedMissions ?? "0")} de ${String(context.totalMissions ?? "0")}`,
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: `${systemPrompt}\n\n${contextBlock}`,
      input: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      max_output_tokens: 700,
      store: false,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Nina OpenAI error:", payload);
    return NextResponse.json({
      error: "A Nina nao conseguiu responder agora. Confira a configuracao da OpenAI e tente novamente.",
    }, { status: 502 });
  }

  const answer = extractOutputText(payload) || "Me conta onde voce travou que eu te ajudo com o proximo passo.";
  await saveNinaMessages(userId, [
    ...(lastUserMessage ? [lastUserMessage] : []),
    { role: "assistant", content: answer },
  ]);

  return NextResponse.json({
    message: answer,
  });
}
