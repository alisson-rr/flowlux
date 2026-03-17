import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FlowStep {
  id: string;
  step_order: number;
  step_type: string;
  content: string;
  media_url: string;
  file_name: string;
  delay_seconds: number;
}

interface RequestBody {
  flow_id: string;
  user_id: string;
  instance_id: string;
  instance_name: string;
  remote_jid: string;
  conversation_id: string;
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

async function sendMedia(
  instanceName: string,
  number: string,
  mediaUrl: string,
  mediaType: string,
  caption?: string,
  fileName?: string
) {
  const mtype = mediaType === "image" ? "image" : mediaType === "video" ? "video" : mediaType === "audio" ? "audio" : "document";
  return evolutionFetch(`/message/sendMedia/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      number,
      mediatype: mtype,
      media: mediaUrl,
      caption: caption || "",
      fileName: fileName || "",
    }),
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { flow_id, user_id, instance_id, instance_name, remote_jid, conversation_id } = body;

    if (!flow_id || !user_id || !instance_name || !remote_jid) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load flow steps
    const { data: steps, error: stepsError } = await supabase
      .from("flow_steps")
      .select("*")
      .eq("flow_id", flow_id)
      .order("step_order", { ascending: true });

    if (stepsError || !steps || steps.length === 0) {
      return new Response(JSON.stringify({ error: "Flow steps not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from("flow_executions")
      .insert({
        flow_id,
        user_id,
        instance_id: instance_id || null,
        remote_jid,
        status: "running",
        current_step: 0,
        total_steps: steps.length,
      })
      .select()
      .single();

    if (execError) {
      console.error("Error creating execution:", execError);
    }

    const executionId = execution?.id;
    const number = remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "");

    // Execute steps sequentially
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i] as FlowStep;

      try {
        // Update current step
        if (executionId) {
          await supabase
            .from("flow_executions")
            .update({ current_step: i + 1 })
            .eq("id", executionId);
        }

        if (step.step_type === "delay") {
          await delay((step.delay_seconds || 5) * 1000);
          continue;
        }

        if (step.step_type === "text") {
          if (step.content) {
            await sendText(instance_name, number, step.content);

            // Save message to DB
            await supabase.from("messages").insert({
              conversation_id,
              remote_jid,
              from_me: true,
              message_type: "text",
              content: step.content,
              status: "sent",
            });
          }
        } else if (["image", "video", "audio", "document"].includes(step.step_type)) {
          if (step.media_url) {
            await sendMedia(
              instance_name,
              number,
              step.media_url,
              step.step_type,
              step.content || "",
              step.file_name || ""
            );

            // Save message to DB
            await supabase.from("messages").insert({
              conversation_id,
              remote_jid,
              from_me: true,
              message_type: step.step_type,
              content: step.content || "",
              media_url: step.media_url,
              status: "sent",
            });
          }
        }

        // Update conversation last_message
        await supabase
          .from("conversations")
          .update({
            last_message: step.step_type === "text" ? step.content : `[${step.step_type}]`,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", conversation_id);

        // Small delay between messages to avoid rate limiting
        if (i < steps.length - 1 && step.step_type !== "delay") {
          await delay(1500);
        }
      } catch (stepError) {
        console.error(`Error executing step ${i}:`, stepError);

        if (executionId) {
          await supabase
            .from("flow_executions")
            .update({
              status: "failed",
              error_message: String(stepError),
              completed_at: new Date().toISOString(),
            })
            .eq("id", executionId);
        }

        return new Response(
          JSON.stringify({ error: `Failed at step ${i + 1}: ${stepError}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Mark execution as completed
    if (executionId) {
      await supabase
        .from("flow_executions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", executionId);
    }

    return new Response(
      JSON.stringify({ success: true, execution_id: executionId, steps_executed: steps.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
