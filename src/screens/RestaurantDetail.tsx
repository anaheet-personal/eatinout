import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { Avatar, Disclaimer, RatingBadge, SafetyBadge, TagPill } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VisitPhoto } from "@/components/VisitPhoto";
import { formatRelative, formatShort } from "@/lib/dates";
import { visitsAt } from "@/lib/history";
import { lastTimeHere, type MemberLastTime } from "@/lib/lastTime";
import { useStore } from "@/lib/store/StoreProvider";
import { TAGS, ratingEmoji, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RestaurantDetail() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { data, deleteVisit } = useStore();
  const [showSaved, setShowSaved] = useState(params.get("saved") === "1");

  useEffect(() => {
    if (!showSaved) return;
    setParams({}, { replace: true });
    const t = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(t);
  }, [showSaved, setParams]);

  const restaurant = data.restaurants.find((r) => r.id === id);
  const summary = useMemo(() => lastTimeHere(id, data), [id, data]);
  const visits = useMemo(() => visitsAt(id, data), [id, data]);
  const tagCounts = useMemo(() => {
    const counts = new Map<Tag, number>();
    visits.forEach((v) => v.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return TAGS.filter((t) => counts.has(t.id)).map((t) => ({ ...t, count: counts.get(t.id)! }));
  }, [visits]);

  if (!restaurant) return <Navigate to="/restaurants" replace />;
  const memberName = (mid: string) => data.members.find((m) => m.id === mid);

  return (
    <>
      <Link to="/restaurants" className="-ml-2 mb-2 inline-flex h-10 items-center px-2 text-sm font-semibold text-muted">
        ‹ Places
      </Link>
      <header className="mb-4">
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{restaurant.name}</h1>
        <p className="text-sm text-muted">
          {restaurant.city}
          {summary.visitCount > 0 && ` · ${summary.visitCount} visit${summary.visitCount > 1 ? "s" : ""}`}
        </p>
      </header>

      {showSaved && (
        <div role="status" className="mb-4 rounded-2xl bg-good-soft px-4 py-3 font-semibold text-good">
          ✓ Visit saved
        </div>
      )}

      {/* The core card */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-baseline justify-between bg-primary-soft px-4 py-3">
          <h2 className="text-lg font-extrabold text-primary">Last time here</h2>
          {summary.lastVisitDate && (
            <span className="text-sm font-semibold text-primary">
              {formatShort(summary.lastVisitDate)} · {formatRelative(summary.lastVisitDate)}
            </span>
          )}
        </div>
        {summary.visitCount === 0 ? (
          <p className="px-4 py-6 text-center text-muted">No visits yet. Log one after your meal.</p>
        ) : (
          <ul className="divide-y divide-border">
            {summary.members.map((m) => (
              <MemberLastRow key={m.member.id} m={m} lastVisitDate={summary.lastVisitDate!} />
            ))}
          </ul>
        )}
        <div className="px-4 pb-4 pt-1">
          <Disclaimer />
        </div>
      </Card>

      <Link to={`/log?r=${restaurant.id}`} className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}>
        + Log a visit here
      </Link>

      {tagCounts.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Good for kids</h2>
          <div className="flex flex-wrap gap-2">
            {tagCounts.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-medium shadow-sm ring-1 ring-border">
                <span aria-hidden>{t.emoji}</span>
                {t.label}
                <span className="text-muted">×{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {visits.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">All visits</h2>
          <ul className="space-y-3">
            {visits.map((v) => {
              const logs = data.dishLogs.filter((l) => l.visitId === v.id);
              return (
                <li key={v.id}>
                  <Card>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold">
                        {formatShort(v.date)} <span className="font-normal text-muted">· {formatRelative(v.date)}</span>
                      </p>
                      <button
                        className="h-9 rounded-lg px-2 text-sm text-muted hover:bg-soft"
                        onClick={() => confirm("Delete this visit?") && deleteVisit(v.id)}
                        aria-label={`Delete visit on ${formatShort(v.date)}`}
                      >
                        Delete
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {logs.map((l) => {
                        const mem = memberName(l.memberId);
                        return (
                          <li key={l.id} className="flex items-center gap-2 text-sm">
                            <span aria-hidden>{mem?.emoji}</span>
                            <span className="font-semibold">{mem?.name}</span>
                            <span className="min-w-0 flex-1 truncate text-muted">{l.dishName}</span>
                            {l.safe === false && <span className="text-bad" title="Logged not safe">⚠</span>}
                            <span aria-label={`rated ${ratingEmoji(l.rating)}`}>{ratingEmoji(l.rating)}</span>
                          </li>
                        );
                      })}
                    </ul>
                    {(v.tags.length > 0 || v.photoPath || v.photoDataUrl) && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {v.tags.map((t) => <TagPill key={t} tag={t} />)}
                        <VisitPhoto visit={v} />
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function MemberLastRow({ m, lastVisitDate }: { m: MemberLastTime; lastVisitDate: string }) {
  const { member, last, tryAgain } = m;
  const sameDish = last && tryAgain && last.dishName.toLowerCase() === tryAgain.dishName.toLowerCase();
  return (
    <li className="flex gap-3 px-4 py-4">
      <Avatar member={member} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">{member.name}</p>
        {last ? (
          <>
            <div className="mt-0.5 flex items-start gap-2">
              <p className="min-w-0 flex-1 text-lg font-bold leading-snug">{last.dishName}</p>
              <RatingBadge rating={last.rating} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>
                {formatShort(last.date)}
                {last.date !== lastVisitDate && ` · ${formatRelative(last.date)}`}
              </span>
              <SafetyBadge safe={last.safe} />
            </div>
          </>
        ) : (
          <p className="mt-0.5 text-muted">Hasn't eaten here yet</p>
        )}
        {tryAgain && !sameDish && (
          <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-good-soft px-2.5 py-1.5 text-sm text-good">
            <span className="font-semibold">Try again:</span>
            {tryAgain.dishName} {ratingEmoji(tryAgain.rating)}
            <span className="opacity-75">({formatShort(tryAgain.date)})</span>
          </p>
        )}
        {tryAgain && sameDish && tryAgain.rating === 1 && (
          <p className="mt-2 text-sm font-semibold text-good">✓ Order it again</p>
        )}
        {last && !tryAgain && (
          <p className="mt-2 text-sm text-warn">Nothing liked here yet. Try something new.</p>
        )}
      </div>
    </li>
  );
}
