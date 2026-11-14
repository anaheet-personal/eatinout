import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, Disclaimer, EmptyState, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { dishSummaries, visitsAt } from "@/lib/history";
import { downscaleImage } from "@/lib/image";
import { lastTimeHere } from "@/lib/lastTime";
import { useStore } from "@/lib/store/StoreProvider";
import { RATINGS, TAGS, allergyLabels, type Member, type Rating, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddRestaurantSheet } from "./Restaurants";

interface Row {
  dish: string;
  rating: Rating | null;
  safe: boolean | null;
}
const emptyRow: Row = { dish: "", rating: null, safe: null };

export function LogVisit() {
  const { data, addVisit } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [restaurantId, setRestaurantId] = useState<string | null>(params.get("r"));
  const [date, setDate] = useState(todayISO());
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [photo, setPhoto] = useState<string | undefined>();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [addingPlace, setAddingPlace] = useState(false);

  // Recently visited places first, so the usual spot is one tap away
  const places = useMemo(
    () =>
      data.restaurants
        .map((r) => ({ r, last: visitsAt(r.id, data)[0]?.date ?? "" }))
        .sort((a, b) => b.last.localeCompare(a.last) || a.r.name.localeCompare(b.r.name))
        .map((x) => x.r),
    [data],
  );

  const last = useMemo(() => (restaurantId ? lastTimeHere(restaurantId, data) : null), [restaurantId, data]);
  const row = (id: string) => rows[id] ?? emptyRow;
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...(r[id] ?? emptyRow), ...patch } }));

  const sameAsLastTime = () => {
    if (!last) return;
    const next: Record<string, Row> = { ...rows };
    for (const m of last.members) {
      if (m.last) next[m.member.id] = { ...(next[m.member.id] ?? emptyRow), dish: m.last.dishName };
    }
    setRows(next);
  };

  const filled = data.members.filter((m) => row(m.id).dish.trim());
  const missingRating = filled.filter((m) => row(m.id).rating === null);
  const canSave = !!restaurantId && filled.length > 0 && missingRating.length === 0;

  const save = () => {
    if (!canSave || !restaurantId) return;
    addVisit(
      { restaurantId, date, tags, photoDataUrl: photo },
      filled.map((m) => ({
        memberId: m.id,
        dishName: row(m.id).dish.trim(),
        rating: row(m.id).rating!,
        safe: row(m.id).safe,
      })),
    );
    navigate(`/restaurants/${restaurantId}?saved=1`);
  };

  if (data.members.length === 0) {
    return (
      <>
        <PageHeader title="Log a visit" />
        <EmptyState icon="👨‍👩‍👧‍👦" title="Add your family first">
          <Button className="mt-3" onClick={() => navigate("/family")}>Go to Family</Button>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Log a visit" subtitle="Takes about 20 seconds" />

      {/* 1. Where */}
      <section aria-labelledby="where" className="mb-6">
        <h2 id="where" className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Where did you eat?</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {places.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={restaurantId === r.id}
              onClick={() => setRestaurantId(r.id)}
              className={cn(
                "h-12 shrink-0 rounded-2xl border px-4 font-semibold transition",
                restaurantId === r.id ? "border-primary bg-primary text-primary-fg" : "border-border bg-card",
              )}
            >
              {r.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAddingPlace(true)}
            className="h-12 shrink-0 rounded-2xl border border-dashed border-border px-4 font-semibold text-muted"
          >
            + New place
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="date" className="text-sm font-semibold text-muted">When</label>
          <input
            id="date"
            type="date"
            max={todayISO()}
            value={date}
            onChange={(e) => setDate(e.target.value || todayISO())}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm"
          />
        </div>
      </section>

      {/* 2. Who had what */}
      <section aria-labelledby="who" className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="who" className="text-sm font-bold uppercase tracking-wide text-muted">Who had what?</h2>
          {last && last.visitCount > 0 && (
            <Button variant="soft" size="sm" onClick={sameAsLastTime}>↺ Same as last time</Button>
          )}
        </div>
        <ul className="space-y-3">
          {data.members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              row={row(m.id)}
              onChange={(p) => setRow(m.id, p)}
              suggestions={restaurantId ? dishSummaries(m.id, restaurantId, data).map((d) => d.dishName) : []}
            />
          ))}
        </ul>
        <Disclaimer className="mt-3" />
      </section>

      {/* 3. Extras */}
      <section aria-labelledby="extras" className="mb-6">
        <h2 id="extras" className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Good for kids? (optional)</h2>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => {
            const on = tags.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setTags(on ? tags.filter((x) => x !== t.id) : [...tags, t.id])}
                className={cn(
                  "flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition",
                  on ? "border-primary bg-primary-soft text-primary" : "border-border bg-card",
                )}
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {photo ? (
            <div className="flex items-center gap-3">
              <img src={photo} alt="Receipt or menu" className="h-16 w-16 rounded-xl object-cover" />
              <Button variant="ghost" size="sm" onClick={() => setPhoto(undefined)}>Remove photo</Button>
            </div>
          ) : (
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-semibold text-muted">
              📷 Add receipt or menu photo
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setPhotoError(null);
                    setPhoto(await downscaleImage(f));
                  } catch {
                    setPhotoError("Couldn't read that photo. Try another one.");
                  }
                }}
              />
            </label>
          )}
          {photoError && <p className="mt-1 text-sm text-bad">{photoError}</p>}
        </div>
      </section>

      {/* Save, pinned above the tab bar */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 bg-gradient-to-t from-bg from-60% to-transparent px-4 pb-3 pt-6">
        <Button size="lg" className="w-full" disabled={!canSave} onClick={save}>
          Save visit
        </Button>
        <p className="mt-1.5 text-center text-xs text-muted" aria-live="polite">
          {!restaurantId
            ? "Pick a place to start"
            : filled.length === 0
              ? "Add at least one dish"
              : missingRating.length
                ? `Tap a rating for ${missingRating.map((m) => m.name).join(", ")}`
                : `${filled.length} dish${filled.length > 1 ? "es" : ""} ready`}
        </p>
      </div>

      <AddRestaurantSheet open={addingPlace} onClose={() => setAddingPlace(false)} onAdded={(id) => setRestaurantId(id)} />
    </>
  );
}

function MemberRow({
  member,
  row,
  onChange,
  suggestions,
}: {
  member: Member;
  row: Row;
  onChange: (p: Partial<Row>) => void;
  suggestions: string[];
}) {
  const listId = `dishes-${member.id}`;
  const allergies = allergyLabels(member);
  return (
    <li>
      <Card className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <Avatar member={member} size="sm" />
          <span className="font-bold">{member.name}</span>
        </div>
        <Input
          aria-label={`What did ${member.name} have?`}
          placeholder="What did they have?"
          list={listId}
          value={row.dish}
          onChange={(e) => onChange({ dish: e.target.value })}
          autoComplete="off"
        />
        <datalist id={listId}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
        <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`${member.name}'s rating`}>
          {RATINGS.map((r) => {
            const on = row.rating === r.value;
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={r.label}
                onClick={() => onChange({ rating: on ? null : r.value })}
                className={cn(
                  "grid h-14 place-items-center rounded-2xl border text-3xl transition active:scale-90",
                  on
                    ? r.value === 1
                      ? "border-good bg-good-soft"
                      : r.value === 0
                        ? "border-warn bg-warn-soft"
                        : "border-bad bg-bad-soft"
                    : "border-border bg-soft",
                  row.rating !== null && !on && "opacity-40",
                )}
              >
                {r.emoji}
              </button>
            );
          })}
        </div>
        {allergies.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="flex-1 text-muted">Safe for {allergies.join(", ").toLowerCase()}?</span>
            {([true, false] as const).map((v) => {
              const on = row.safe === v;
              return (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange({ safe: on ? null : v })}
                  className={cn(
                    "h-10 min-w-16 rounded-xl border px-3 font-semibold",
                    on ? (v ? "border-good bg-good-soft text-good" : "border-bad bg-bad-soft text-bad") : "border-border bg-card",
                  )}
                >
                  {v ? "Yes" : "No"}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </li>
  );
}
