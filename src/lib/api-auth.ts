import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const accessToken = match?.[1];

  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}
