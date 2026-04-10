import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface GuidedEmptyStateProps {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  steps?: string[];
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

function EmptyAction({ action, primary = false }: { action: EmptyStateAction; primary?: boolean }) {
  const content = (
    <>
      {action.label}
      {primary ? <ArrowRight className="ml-2 h-3.5 w-3.5" /> : null}
    </>
  );

  if (action.href) {
    return (
      <Button asChild variant={primary ? "default" : "outline"} size="sm">
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button variant={primary ? "default" : "outline"} size="sm" onClick={action.onClick}>
      {content}
    </Button>
  );
}

export function GuidedEmptyState({
  icon: Icon,
  eyebrow = "Primeiro passo",
  title,
  description,
  steps = [],
  primaryAction,
  secondaryAction,
  className,
}: GuidedEmptyStateProps) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-border bg-background/30 p-8 text-center", className)}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{eyebrow}</p>
      <h3 className="mt-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>

      {steps.length > 0 ? (
        <div className="mx-auto mt-5 grid max-w-2xl gap-2 text-left sm:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="rounded-xl border border-border/70 bg-card/60 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                {index + 1}
              </span>
              {step}
            </div>
          ))}
        </div>
      ) : null}

      {(primaryAction || secondaryAction) ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? <EmptyAction action={primaryAction} primary /> : null}
          {secondaryAction ? <EmptyAction action={secondaryAction} /> : null}
        </div>
      ) : null}
    </div>
  );
}
