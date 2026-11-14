import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "../supabase";
import type { Allergy, AppData, DishLog, Member, Rating, Restaurant, Tag, Visit } from "../types";

/* ── Row shapes (snake_case, as stored in Postgres) ── */
interface MemberRow { id: string; family_id: string; name: string; age: number | null; emoji: string; allergies: string[]; allergy_other: string; wont_eat: string }
interface RestaurantRow { id: string; family_id: string; name: string; city: string }
interface VisitRow { id: string; family_id: string; restaurant_id: string; visited_on: string; tags: string[]; photo_path: string | null }
interface DishLogRow { id: string; family_id: string; visit_id: string; member_id: string; dish_name: string; rating: number; safe: boolean | null; notes: string | null }

const toMember = (r: MemberRow): Member => ({
  id: r.id, name: r.name, age: r.age, emoji: r.emoji,
  allergies: r.allergies as Allergy[], allergyOther: r.allergy_other, wontEat: r.wont_eat,
});
const toRestaurant = (r: RestaurantRow): Restaurant => ({ id: r.id, name: r.name, city: r.city });
const toVisit = (r: VisitRow): Visit => ({
  id: r.id, restaurantId: r.restaurant_id, date: r.visited_on, tags: r.tags as Tag[],
  photoPath: r.photo_path ?? undefined,
});
const toDishLog = (r: DishLogRow): DishLog => ({
  id: r.id, visitId: r.visit_id, memberId: r.member_id, dishName: r.dish_name,
  rating: r.rating as Rating, safe: r.safe, notes: r.notes ?? undefined,
});

export const memberRow = (m: Member, familyId: string): MemberRow => ({
  id: m.id, family_id: familyId, name: m.name, age: m.age, emoji: m.emoji,
  allergies: m.allergies, allergy_other: m.allergyOther, wont_eat: m.wontEat,
});
export const restaurantRow = (r: Restaurant, familyId: string): RestaurantRow => ({
  id: r.id, family_id: familyId, name: r.name, city: r.city,
});
export const visitRow = (v: Visit, familyId: string): VisitRow => ({
  id: v.id, family_id: familyId, restaurant_id: v.restaurantId, visited_on: v.date,
  tags: v.tags, photo_path: v.photoPath ?? null,
});
export const dishLogRow = (l: DishLog, familyId: string): DishLogRow => ({
  id: l.id, family_id: familyId, visit_id: l.visitId, member_id: l.memberId,
  dish_name: l.dishName, rating: l.rating, safe: l.safe, notes: l.notes ?? null,
});

/** Thrown with a friendly message so the UI can show it. */
function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Couldn't ${what}: ${res.error.message}`);
  return res.data as T;
}

/** Fetch every row of a table, paging past the API's per-request row cap. */
async function fetchAll<T>(sb: SupabaseClient, table: string, order: string): Promise<T[]> {
  const page = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += page) {
    const res = await sb.from(table).select("*").order(order).order("id").range(from, from + page - 1);
    const chunk = check(res, `load ${table}`) as T[];
    rows.push(...chunk);
    if (chunk.length < page) return rows;
  }
}

export async function getFamilyId(sb: SupabaseClient): Promise<string> {
  const rows = check(await sb.from("family_users").select("family_id").limit(1), "find your family");
  if (!rows.length) throw new Error("Your account isn't linked to a family yet.");
  return rows[0].family_id as string;
}

/** RLS already limits every query to the signed-in user's family. */
export async function loadFamilyData(sb: SupabaseClient): Promise<AppData> {
  const [members, restaurants, visits, dishLogs] = await Promise.all([
    fetchAll<MemberRow>(sb, "members", "created_at"),
    fetchAll<RestaurantRow>(sb, "restaurants", "created_at"),
    fetchAll<VisitRow>(sb, "visits", "visited_on"),
    fetchAll<DishLogRow>(sb, "dish_logs", "created_at"),
  ]);
  return {
    version: 1,
    members: members.map(toMember),
    restaurants: restaurants.map(toRestaurant),
    visits: visits.map(toVisit),
    dishLogs: dishLogs.map(toDishLog),
  };
}

export const db = {
  async upsertMember(sb: SupabaseClient, m: Member, familyId: string) {
    check(await sb.from("members").upsert(memberRow(m, familyId)), "save family member");
  },
  async deleteMember(sb: SupabaseClient, id: string) {
    check(await sb.from("members").delete().eq("id", id), "remove family member");
  },
  async insertRestaurant(sb: SupabaseClient, r: Restaurant, familyId: string) {
    check(await sb.from("restaurants").insert(restaurantRow(r, familyId)), "save place");
  },
  async insertVisit(sb: SupabaseClient, v: Visit, logs: DishLog[], familyId: string) {
    check(await sb.from("visits").insert(visitRow({ ...v, photoPath: undefined }, familyId)), "save visit");
    if (logs.length) check(await sb.from("dish_logs").insert(logs.map((l) => dishLogRow(l, familyId))), "save dishes");
  },
  async deleteVisit(sb: SupabaseClient, v: Visit) {
    check(await sb.from("visits").delete().eq("id", v.id), "delete visit");
    if (v.photoPath) await sb.storage.from(PHOTO_BUCKET).remove([v.photoPath]);
  },
  /** Uploads a receipt/menu photo and links it to the visit. Returns the storage path. */
  async uploadPhoto(sb: SupabaseClient, familyId: string, visitId: string, dataUrl: string): Promise<string> {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${familyId}/${visitId}.jpg`;
    check(await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: true }), "upload photo");
    check(await sb.from("visits").update({ photo_path: path }).eq("id", visitId), "link photo");
    return path;
  },
  async insertAll(sb: SupabaseClient, data: AppData, familyId: string) {
    // Space out created_at so the family keeps its order (Bree, Marcus, Leo, Ivy).
    const t0 = Date.now();
    const members = data.members.map((m, i) => ({ ...memberRow(m, familyId), created_at: new Date(t0 + i).toISOString() }));
    check(await sb.from("members").insert(members), "add demo family");
    check(await sb.from("restaurants").insert(data.restaurants.map((r) => restaurantRow(r, familyId))), "add demo places");
    check(await sb.from("visits").insert(data.visits.map((v) => visitRow(v, familyId))), "add demo visits");
    check(await sb.from("dish_logs").insert(data.dishLogs.map((l) => dishLogRow(l, familyId))), "add demo dishes");
  },
};

/** Demo ids are readable strings ("m-leo"); the database needs UUIDs. */
export function withFreshIds(data: AppData, newId: () => string): AppData {
  const map = new Map<string, string>();
  const id = (old: string) => map.get(old) ?? (map.set(old, newId()), map.get(old)!);
  return {
    version: 1,
    members: data.members.map((m) => ({ ...m, id: id(m.id) })),
    restaurants: data.restaurants.map((r) => ({ ...r, id: id(r.id) })),
    visits: data.visits.map((v) => ({ ...v, id: id(v.id), restaurantId: id(v.restaurantId) })),
    dishLogs: data.dishLogs.map((l) => ({ ...l, id: id(l.id), visitId: id(l.visitId), memberId: id(l.memberId) })),
  };
}
