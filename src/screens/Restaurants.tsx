import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, PageHeader } from "@/components/common";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatRelative } from "@/lib/dates";
import { visitsAt } from "@/lib/history";
import { useStore } from "@/lib/store/StoreProvider";

export function Restaurants() {
  const { data } = useStore();
  const [adding, setAdding] = useState(false);

  const rows = useMemo(
    () =>
      data.restaurants
        .map((r) => {
          const visits = visitsAt(r.id, data);
          return { r, count: visits.length, last: visits[0]?.date };
        })
        .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? "") || a.r.name.localeCompare(b.r.name)),
    [data],
  );

  return (
    <>
      <PageHeader
        title="Places"
        subtitle={`${data.restaurants.length} saved`}
        action={<Button size="sm" onClick={() => setAdding(true)}>+ Add</Button>}
      />
      {rows.length === 0 ? (
        <EmptyState icon="🍽️" title="No places yet">Add a restaurant you visit often.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ r, count, last }) => (
            <li key={r.id}>
              <Link to={`/restaurants/${r.id}`}>
                <Card className="flex items-center gap-3 transition active:scale-[0.99]">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-2xl" aria-hidden>
                    🍴
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold">{r.name}</p>
                    <p className="text-sm text-muted">
                      {r.city}
                      {count > 0 ? ` · ${count} visit${count > 1 ? "s" : ""} · last ${formatRelative(last!)}` : " · not visited yet"}
                    </p>
                  </div>
                  <span className="text-muted" aria-hidden>›</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <AddRestaurantSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

export function AddRestaurantSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded?: (id: string) => void;
}) {
  const { addRestaurant, data } = useStore();
  const navigate = useNavigate();
  const lastCity = data.restaurants[data.restaurants.length - 1]?.city ?? "";
  const [name, setName] = useState("");
  const [city, setCity] = useState(lastCity);

  return (
    <Sheet open={open} onClose={onClose} title="Add a place">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const r = addRestaurant({ name: name.trim(), city: city.trim() });
          setName("");
          onClose();
          if (onAdded) onAdded(r.id);
          else navigate(`/restaurants/${r.id}`);
        }}
      >
        <div>
          <Label htmlFor="rname">Name</Label>
          <Input id="rname" autoFocus required placeholder="e.g. Taco Tranquilo" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rcity">City</Label>
          <Input id="rcity" placeholder="e.g. Austin, TX" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={!name.trim()}>
          Save place
        </Button>
      </form>
    </Sheet>
  );
}
