import { useState } from "react";
import { AllergyChips, Avatar, Disclaimer, EmptyState, PageHeader } from "@/components/common";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useStore } from "@/lib/store/StoreProvider";
import { ALLERGIES, type Allergy, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMOJIS = ["👩", "👨", "🧑", "👧", "👦", "👶", "🦖", "🦄", "🐻", "🐱", "🚀", "🌈", "⚽", "🎨", "👵", "👴"];

type Draft = Omit<Member, "id"> & { id?: string };
const blank: Draft = { name: "", age: null, emoji: "🧑", allergies: [], allergyOther: "", wontEat: "" };

export function Family() {
  const { data, addMember, updateMember, deleteMember, loadDemo, signOut, userEmail } = useStore();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    const clean = { ...draft, name: draft.name.trim(), allergyOther: draft.allergies.includes("other") ? draft.allergyOther : "" };
    if (clean.id) updateMember(clean as Member);
    else addMember(clean);
    setDraft(null);
  };

  const toggleAllergy = (a: Allergy) =>
    setDraft((d) => d && { ...d, allergies: d.allergies.includes(a) ? d.allergies.filter((x) => x !== a) : [...d.allergies, a] });

  return (
    <>
      <PageHeader
        title="Family"
        subtitle="Who's at the table, and what to watch for"
        action={<Button size="sm" onClick={() => setDraft({ ...blank })}>+ Add</Button>}
      />

      {data.members.length === 0 ? (
        <EmptyState icon="👨‍👩‍👧‍👦" title="Add your family">
          Start with everyone who usually eats out with you.
          <DemoButton busy={loadingDemo} onClick={async () => { setLoadingDemo(true); await loadDemo(); setLoadingDemo(false); }} />
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.members.map((m) => (
            <li key={m.id}>
              <button className="w-full text-left" onClick={() => setDraft({ ...m })}>
                <Card className="flex gap-3 transition active:scale-[0.99]">
                  <Avatar member={m} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold">{m.name}</span>
                      {m.age !== null && <span className="text-sm text-muted">{m.age}</span>}
                    </div>
                    <div className="mt-1"><AllergyChips member={m} /></div>
                    {m.wontEat && <p className="mt-1.5 text-sm text-muted">Won't eat: {m.wontEat}</p>}
                  </div>
                  <span className="self-center text-muted" aria-hidden>›</span>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Disclaimer className="mt-5" />

      <div className="mt-10 space-y-1 text-center">
        {userEmail && <p className="text-xs text-muted">Signed in as {userEmail}</p>}
        <Button variant="ghost" size="sm" className="text-muted" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? `Edit ${draft.name}` : "Add family member"}>
        {draft && (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div>
              <Label>Avatar</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-label={`Avatar ${e}`}
                    aria-pressed={draft.emoji === e}
                    onClick={() => setDraft({ ...draft, emoji: e })}
                    className={cn(
                      "grid h-12 w-12 place-items-center rounded-full bg-soft text-2xl",
                      draft.emoji === e && "bg-primary-soft ring-2 ring-primary",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" autoFocus required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  inputMode="numeric"
                  value={draft.age ?? ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    setDraft({ ...draft, age: Number.isFinite(n) ? Math.min(n, 120) : null });
                  }}
                />
              </div>
            </div>
            <div>
              <Label>Allergies and dietary needs</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALLERGIES.map((a) => {
                  const on = draft.allergies.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleAllergy(a.id)}
                      className={cn(
                        "flex h-12 items-center gap-2 rounded-2xl border px-3 font-semibold",
                        on ? "border-warn bg-warn-soft text-warn" : "border-border bg-card",
                      )}
                    >
                      <span aria-hidden>{a.emoji}</span>
                      {a.label}
                      {on && <span className="ml-auto" aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>
              {draft.allergies.includes("other") && (
                <Input
                  className="mt-2"
                  placeholder="e.g. Shellfish, egg"
                  aria-label="Other allergy"
                  value={draft.allergyOther}
                  onChange={(e) => setDraft({ ...draft, allergyOther: e.target.value })}
                />
              )}
            </div>
            <div>
              <Label htmlFor="wont">Won't eat</Label>
              <Textarea
                id="wont"
                placeholder="e.g. Anything green, spicy food"
                value={draft.wontEat}
                onChange={(e) => setDraft({ ...draft, wontEat: e.target.value })}
              />
            </div>
            <Disclaimer />
            <div className="flex gap-2">
              {draft.id && (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm(`Remove ${draft.name}? Their dish history will be removed too.`)) {
                      deleteMember(draft.id!);
                      setDraft(null);
                    }
                  }}
                >
                  Remove
                </Button>
              )}
              <Button type="submit" className="flex-1" disabled={!draft.name.trim()}>
                Save
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}

/** Fills an empty account with Bree's family so every screen can be tried without typing. */
export function DemoButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <Button variant="soft" className="mt-4" disabled={busy} onClick={onClick}>
      {busy ? "Adding demo family…" : "✨ Try with Bree's demo family"}
    </Button>
  );
}
