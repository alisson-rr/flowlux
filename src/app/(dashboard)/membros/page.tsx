"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MembrosRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/evolua"); }, [router]);
  return null;
}
