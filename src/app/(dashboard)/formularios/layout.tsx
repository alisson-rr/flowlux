import { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isPreCheckoutLabEnabledForHost } from "@/lib/feature-access";

export default async function FormulariosLabLayout({ children }: { children: ReactNode }) {
  const headerBag = await headers();
  if (!isPreCheckoutLabEnabledForHost(headerBag.get("host"))) {
    notFound();
  }

  return children;
}
