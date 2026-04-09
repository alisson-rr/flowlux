import { CheckCircle2, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type VideoMockupProps = {
  label: string;
  title: string;
  description: string;
  checklist: string[];
  className?: string;
  compact?: boolean;
};

export default function VideoMockup({
  label,
  title,
  description,
  checklist,
  className,
  compact = false,
}: VideoMockupProps) {
  return (
    <div className={cn("video-shell rounded-[28px] p-4 md:p-5", className)}>
      {/* TODO: Substituir este placeholder pelo video real do Flow Up quando a interface gravada estiver atualizada. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="tag-mono">{label}</div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slate-200">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          Mockup de video
        </div>
      </div>

      <div
        className={cn(
          "landing-grid relative overflow-hidden rounded-[24px] border border-white/10 bg-[#05070D] px-5 py-6",
          compact ? "aspect-[4/3]" : "aspect-video",
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.18),transparent_30%),radial-gradient(circle_at_center,rgba(34,211,238,0.10),transparent_45%)]" />
        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-1 text-[11px] font-medium text-cyan-200">
              <Play className="h-3.5 w-3.5 fill-current" />
              Video sugerido
            </div>
            <h3 className={cn("font-semibold text-white", compact ? "text-base" : "text-xl")}>
              {title}
            </h3>
            <p className={cn("max-w-2xl text-slate-300/80", compact ? "text-xs" : "text-sm")}>
              {description}
            </p>
          </div>

          <div className={cn("grid gap-2", compact ? "mt-4" : "mt-6 md:grid-cols-2")}>
            {checklist.slice(0, compact ? 2 : checklist.length).map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-[#08111F]/80 px-3 py-2 text-left text-sm text-slate-200"
              >
                <span className="inline-flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span className={compact ? "text-xs" : ""}>{item}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute right-5 top-5 rounded-full border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <Play className={cn("fill-white text-white", compact ? "h-6 w-6" : "h-8 w-8")} />
        </div>
      </div>
    </div>
  );
}
