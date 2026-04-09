import Image from "next/image";
import { cn } from "@/lib/utils";
import logoMark from "../../../assets/logo.png";

type BrandLogoProps = {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
};

export default function BrandLogo({
  className,
  iconClassName,
  textClassName,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative h-10 w-10 overflow-hidden rounded-2xl bg-white/[0.02] ring-1 ring-white/10",
          iconClassName,
        )}
      >
        <Image
          src={logoMark}
          alt="Flow Up"
          fill
          priority
          sizes="40px"
          className="object-contain p-1"
        />
      </div>
      <span className={cn("text-xl font-semibold tracking-tight", textClassName)}>
        <span className="brand-flow">Flow</span>{" "}
        <span className="brand-up">Up</span>
      </span>
    </div>
  );
}
