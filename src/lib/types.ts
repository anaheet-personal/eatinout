export type Allergy = "peanut" | "dairy" | "gluten" | "other";
export type Rating = 1 | 0 | -1;
export type Tag =
  | "high_chairs"
  | "kids_menu"
  | "patio"
  | "bike_rack"
  | "quiet"
  | "fast_service";

export interface Member {
  id: string;
  name: string;
  age: number | null;
  emoji: string;
  allergies: Allergy[];
  allergyOther: string;
  wontEat: string;
}

export interface Restaurant {
  id: string;
  name: string;
  city: string;
}

export interface Visit {
  id: string;
  restaurantId: string;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  tags: Tag[];
  /** Path of the receipt or menu photo in Supabase Storage. Stored, never parsed. */
  photoPath?: string;
  /** Local copy of a just-taken photo, shown until the upload finishes. */
  photoDataUrl?: string;
}

export interface DishLog {
  id: string;
  visitId: string;
  memberId: string;
  dishName: string;
  rating: Rating;
  /** Family's own experience: true = was fine, false = was not, null = not recorded */
  safe: boolean | null;
  notes?: string;
}

export interface AppData {
  version: 1;
  members: Member[];
  restaurants: Restaurant[];
  visits: Visit[];
  dishLogs: DishLog[];
}

export type HistoryData = Pick<AppData, "members" | "restaurants" | "visits" | "dishLogs">;

export const ALLERGIES: { id: Allergy; label: string; emoji: string }[] = [
  { id: "peanut", label: "Peanut", emoji: "🥜" },
  { id: "dairy", label: "Dairy", emoji: "🥛" },
  { id: "gluten", label: "Gluten", emoji: "🌾" },
  { id: "other", label: "Other", emoji: "⚠️" },
];

export const TAGS: { id: Tag; label: string; emoji: string }[] = [
  { id: "high_chairs", label: "High chairs", emoji: "🪑" },
  { id: "kids_menu", label: "Kids' menu", emoji: "🧒" },
  { id: "patio", label: "Patio", emoji: "☀️" },
  { id: "bike_rack", label: "Bike rack", emoji: "🚲" },
  { id: "quiet", label: "Quiet enough", emoji: "🤫" },
  { id: "fast_service", label: "Food came fast", emoji: "⚡" },
];

export const RATINGS: { value: Rating; emoji: string; label: string }[] = [
  { value: 1, emoji: "👍", label: "Liked it" },
  { value: 0, emoji: "😐", label: "It was okay" },
  { value: -1, emoji: "👎", label: "Didn't like it" },
];

export const ratingEmoji = (r: Rating) => RATINGS.find((x) => x.value === r)!.emoji;

export function allergyLabels(m: Member): string[] {
  return m.allergies.map((a) =>
    a === "other" && m.allergyOther.trim() ? m.allergyOther.trim() : ALLERGIES.find((x) => x.id === a)!.label,
  );
}
