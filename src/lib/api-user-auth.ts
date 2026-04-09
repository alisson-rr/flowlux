import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function authorizeUserRequest(req: NextRequest, userId: string) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabaseAdmin();

  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    return !!user && user.id === userId;
  }

  const { data: userCheck } = await supabase.auth.admin.getUserById(userId);
  return !!userCheck?.user;
}
