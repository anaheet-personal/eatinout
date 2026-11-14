import { daysBetween, formatShort } from "./dates";
import { dishSummaries, visitsAt, type DishSummary } from "./history";
import { allergyLabels, type HistoryData, type Member, type Restaurant, type Tag } from "./types";
import { joinNames } from "./utils";

export interface Suggestion {
  restaurant: Restaurant;
  score: number;
  reason: string;
  warnings: string[];
  tags: Tag[];
  lastVisit: string;
}

export interface NotForEveryone {
  restaurant: Restaurant;
  reason: string;
  warnings: string[];
  lastVisit?: string;
}

export interface TonightResult {
  suggestions: Suggestion[];
  notForEveryone: NotForEveryone[];
}

export interface RankOptions {
  /** A 👍 from this many days ago counts half as much as one from today. */
  halfLifeDays?: number;
  /** Small bonus per distinct family-friendly tag ever logged at the place. */
  tagBonus?: number;
}

/**
 * Rank saved restaurants for tonight using only the family's own history.
 *
 * Rules:
 * - A place is suggested only if EVERY member has at least one 👍 dish there
 *   (latest rating) that was never logged as not safe for them.
 * - Places where someone has no 👍, or only unsafe 👍 dishes, go to
 *   `notForEveryone` with the reason, and are never ranked.
 * - Any dish logged as not safe produces a warning.
 * - Score favors recent 👍 ratings, since kids' tastes change.
 */
export function rankTonight(data: HistoryData, today: string, opts: RankOptions = {}): TonightResult {
  const halfLife = opts.halfLifeDays ?? 90;
  const tagBonus = opts.tagBonus ?? 0.02;
  const weight = (date: string) => 0.5 ** (Math.max(0, daysBetween(date, today)) / halfLife);

  const suggestions: Suggestion[] = [];
  const notForEveryone: NotForEveryone[] = [];

  for (const restaurant of data.restaurants) {
    const visits = visitsAt(restaurant.id, data);
    const lastVisit = visits[0]?.date;

    if (data.members.length === 0) {
      notForEveryone.push({ restaurant, reason: "Add your family first", warnings: [], lastVisit });
      continue;
    }
    if (visits.length === 0) {
      notForEveryone.push({ restaurant, reason: "No visits logged yet", warnings: [], lastVisit });
      continue;
    }

    const warnings: string[] = [];
    const missing: Member[] = [];
    const blocked: Member[] = [];
    const best: { member: Member; dish: DishSummary }[] = [];

    for (const member of data.members) {
      const dishes = dishSummaries(member.id, restaurant.id, data);
      for (const d of dishes.filter((d) => d.everUnsafe)) {
        const allergies = allergyLabels(member);
        warnings.push(
          `${member.name}: ${d.dishName} was logged not safe${allergies.length ? ` (${allergies.join(", ")})` : ""}`,
        );
      }
      const liked = dishes.filter((d) => d.rating === 1);
      const safeLiked = liked.filter((d) => !d.everUnsafe);
      if (liked.length === 0) missing.push(member);
      else if (safeLiked.length === 0) blocked.push(member);
      else {
        const top = [...safeLiked].sort((a, b) => b.date.localeCompare(a.date))[0];
        best.push({ member, dish: top });
      }
    }

    if (missing.length || blocked.length) {
      const parts: string[] = [];
      if (missing.length) parts.push(`No 👍 dish yet for ${joinNames(missing.map((m) => m.name))}`);
      if (blocked.length)
        parts.push(
          `${joinNames(blocked.map((m) => m.name))}'s only 👍 ${blocked.length > 1 ? "dishes were" : "dish was"} logged not safe`,
        );
      notForEveryone.push({ restaurant, reason: parts.join(" · "), warnings, lastVisit });
      continue;
    }

    const tags = [...new Set(visits.flatMap((v) => v.tags))];
    const score = best.reduce((sum, b) => sum + weight(b.dish.date), 0) + tags.length * tagBonus;

    // Highlight the youngest member's favorite: kids are usually the hardest to please.
    const highlight = [...best].sort((a, b) => (a.member.age ?? 999) - (b.member.age ?? 999))[0];
    const reason = `Everyone has a favorite. ${highlight.member.name} loved the ${highlight.dish.dishName.toLowerCase()} (${formatShort(highlight.dish.date, today)}).`;

    suggestions.push({ restaurant, score, reason, warnings, tags, lastVisit: lastVisit! });
  }

  suggestions.sort(
    (a, b) =>
      b.score - a.score ||
      b.lastVisit.localeCompare(a.lastVisit) ||
      a.restaurant.name.localeCompare(b.restaurant.name),
  );
  notForEveryone.sort((a, b) => (b.lastVisit ?? "").localeCompare(a.lastVisit ?? ""));

  return { suggestions, notForEveryone };
}
