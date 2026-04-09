import { NextRequest, NextResponse } from "next/server";
import { isPreCheckoutLabEnabledForHost } from "@/lib/feature-access";
import { buildPreCheckoutAiUserPrompt, PRE_CHECKOUT_AI_SYSTEM_PROMPT } from "@/lib/pre-checkout/ai";

async function parseBody(req: NextRequest) {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  if (!isPreCheckoutLabEnabledForHost(req.headers.get("host"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await parseBody(req);
  const businessContext = String(body?.businessContext || "").trim();
  const goal = String(body?.goal || "").trim();
  const token = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(body?.model || process.env.OPENAI_FORM_MODEL || "gpt-4.1-mini").trim();

  if (!businessContext || !goal) {
    return NextResponse.json({ error: "Preencha o contexto do negocio e o objetivo do form." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "A IA interna ainda nao foi configurada no servidor." }, { status: 500 });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PRE_CHECKOUT_AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildPreCheckoutAiUserPrompt({
            businessContext,
            goal,
            audience: body?.audience,
            offer: body?.offer,
            destination: body?.destination,
            preferredStyle: body?.preferredStyle,
          }),
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    return NextResponse.json({
      error: `OpenAI respondeu com erro: ${response.status}`,
      details: raw,
    }, { status: 400 });
  }

  try {
    const parsed = JSON.parse(raw);
    const content = parsed?.choices?.[0]?.message?.content;
    const payload = typeof content === "string" ? JSON.parse(content) : null;
    if (!payload) throw new Error("Resposta vazia");
    return NextResponse.json({ result: payload });
  } catch (error: any) {
    return NextResponse.json({
      error: "A IA respondeu, mas o JSON veio inválido.",
      details: String(error?.message || error || "Falha ao interpretar resposta"),
      raw,
    }, { status: 400 });
  }
}
