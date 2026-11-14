import type { HistoryData, Rating, Visit } from "./types";

export interface DishSummary {
  dishName: string;
  /** Rating from the most recent time this member had this dish here */
  rating: Rating;
  /** Date of the most recent time */
  date: string;
  /** Safe flag from the most recent time */
  safe: boolean | null;
  /** True if this dish was ever logged as not safe for this member */
  everUnsafe: boolean;
  timesOrdered: number;
}

export const dishKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function visitsAt(restaurantId: string, data: Pick<HistoryData, "visits">): Visit[] {
  return data.visits
    .filter((v) => v.restaurantId === restaurantId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * One entry per distinct dish a member has had at a restaurant.
 * Ratings use the latest log, so a kid who used to love a dish but now
 * gives it 👎 no longer counts as liking it.
 */
export function dishSummaries(
  memberId: string,
  restaurantId: string,
  data: Pick<HistoryData, "visits" | "dishLogs">,
): DishSummary[] {
  const visitDate = new Map(
    data.visits.filter((v) => v.restaurantId === restaurantId).map((v) => [v.id, v.date]),
  );
  const logs = data.dishLogs
    .filter((l) => l.memberId === memberId && visitDate.has(l.visitId))
    .map((l) => ({ log: l, date: visitDate.get(l.visitId)! }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byDish = new Map<string, DishSummary>();
  for (const { log, date } of logs) {
    const key = dishKey(log.dishName);
    const prev = byDish.get(key);
    byDish.set(key, {
      dishName: log.dishName.trim(),
      rating: log.rating,
      date,
      safe: log.safe,
      everUnsafe: (prev?.everUnsafe ?? false) || log.safe === false,
      timesOrdered: (prev?.timesOrdered ?? 0) + 1,
    });
  }
  return [...byDish.values()];
}
