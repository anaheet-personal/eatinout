import type { ReactNode } from "react";
import { ALLERGIES, TAGS, type Member, type Rating, type Tag } from "@/lib/types";
import { RATINGS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const DISCLAIMER = "EatinOut records your family's experience. Always confirm allergens with the restaurant.";

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex gap-2 rounded-2xl bg-soft px-3 py-2.5 text-xs leading-snug text-muted", className)}>
      <span aria-hidden>ℹ️</span>
      <span>{DISCLAIMER}</span>
    </p>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Avatar({ member, size = "md" }: { member: Pick<Member, "emoji" | "name">; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary-soft",
        size === "sm" && "h-8 w-8 text-lg",
        size === "md" && "h-11 w-11 text-2xl",
        size === "lg" && "h-14 w-14 text-3xl",
      )}
    >
      {member.emoji || member.name.slice(0, 1)}
    </span>
  );
}

export function AllergyChips({ member }: { member: Member }) {
  if (!member.allergies.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {member.allergies.map((a) => {
        const meta = ALLERGIES.find((x) => x.id === a)!;
        const label = a === "other" && member.allergyOther ? member.allergyOther : meta.label;
        return (
          <span key={a} className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">
            <span aria-hidden>{meta.emoji}</span>
            {label}
          </span>
        );
      })}
    </span>
  );
}

export function RatingBadge({ rating }: { rating: Rating }) {
  const r = RATINGS.find((x) => x.value === rating)!;
  return (
    <span role="img" aria-label={r.label} title={r.label} className="text-xl leading-none">
      {r.emoji}
    </span>
  );
}

export function SafetyBadge({ safe }: { safe: boolean | null }) {
  if (safe === null) return null;
  return safe ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-xs font-semibold text-good">
      ✓ Was safe
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-bad-soft px-2 py-0.5 text-xs font-semibold text-bad">
      ⚠ Not safe
    </span>
  );
}

export function TagPill({ tag }: { tag: Tag }) {
  const t = TAGS.find((x) => x.id === tag)!;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-fg">
      <span aria-hidden>{t.emoji}</span>
      {t.label}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-border px-6 py-10 text-center">
      <div className="mb-2 text-4xl" aria-hidden>{icon}</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}
