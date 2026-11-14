import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Disclaimer, EmptyState, PageHeader, TagPill } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRelative, todayISO } from "@/lib/dates";
import { rankTonight, type Suggestion } from "@/lib/ranking";
import { useStore } from "@/lib/store/StoreProvider";
import { cn } from "@/lib/utils";
import { DemoButton } from "./Family";

export function Tonight() {
  const { data, loadDemo } = useStore();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const { suggestions, notForEveryone } = useMemo(() => rankTonight(data, todayISO()), [data]);
  const names = data.members.map((m) => m.emoji).join(" ");

  if (data.members.length === 0 && data.restaurants.length === 0) {
    return (
      <>
        <PageHeader title="Welcome to EatinOut" subtitle="Your family's restaurant memory" />
        <EmptyState icon="🍽️" title="Start by adding your family">
          Then log a meal after you eat out. It takes about 20 seconds.
          <div className="mt-4 flex flex-col items-center gap-1">
            <Link to="/family" className={cn(buttonVariants({ size: "md" }))}>Add your family</Link>
            <DemoButton
              busy={loadingDemo}
              onClick={async () => {
                setLoadingDemo(true);
                await loadDemo();
                setLoadingDemo(false);
              }}
            />
          </div>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Where tonight?" subtitle={<>Places everyone liked <span aria-hidden>{names}</span></>} />

      {suggestions.length === 0 ? (
        <EmptyState icon="🤔" title="No place works for everyone yet">
          A place shows up here once every family member has rated a dish there 👍.
          <Link to="/log" className={cn(buttonVariants({ size: "md" }), "mt-4")}>Log a visit</Link>
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {suggestions.map((s, i) => <SuggestionCard key={s.restaurant.id} s={s} rank={i + 1} />)}
        </ol>
      )}

      {notForEveryone.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Not for everyone yet</h2>
          <ul className="space-y-2">
            {notForEveryone.map((n) => (
              <li key={n.restaurant.id}>
                <Link to={`/restaurants/${n.restaurant.id}`}>
                  <Card className="p-3.5">
                    <div className="flex items-center gap-2">
                      <p className="flex-1 font-bold">{n.restaurant.name}</p>
                      <span className="text-muted" aria-hidden>›</span>
                    </div>
                    <p className="text-sm text-muted">{n.reason}</p>
                    {n.warnings.map((w) => (
                      <p key={w} className="mt-1 text-sm font-medium text-bad">⚠ {w}</p>
                    ))}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Disclaimer className="mt-6" />
    </>
  );
}

function SuggestionCard({ s, rank }: { s: Suggestion; rank: number }) {
  const top = rank === 1;
  return (
    <li>
      <Link to={`/restaurants/${s.restaurant.id}`} className="block">
        <Card className={cn("transition active:scale-[0.99]", top && "border-primary ring-2 ring-primary/30")}>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg font-extrabold",
                top ? "bg-primary text-primary-fg" : "bg-soft text-muted",
              )}
              aria-label={`Rank ${rank}`}
            >
              {rank}
            </span>
            <div className="min-w-0 flex-1">
              {top && <p className="text-xs font-bold uppercase tracking-wide text-primary">Top pick</p>}
              <p className="text-lg font-bold leading-snug">{s.restaurant.name}</p>
              <p className="mt-1 text-sm">{s.reason}</p>
              <p className="mt-1 text-xs text-muted">Last visit {formatRelative(s.lastVisit)}</p>
              {s.warnings.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
                  {s.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
                </ul>
              )}
              {s.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.tags.map((t) => <TagPill key={t} tag={t} />)}
                </div>
              )}
            </div>
          </div>
        </Card>
      </Link>
    </li>
  );
}
