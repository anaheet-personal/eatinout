import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { rankTonight } from "./ranking";
import { makeSeed } from "./seed";
import type { DishLog, HistoryData, Member, Rating } from "./types";

const TODAY = "2026-11-07";

const member = (id: string, name: string, extra: Partial<Member> = {}): Member => ({
  id, name, age: 30, emoji: "🙂", allergies: [], allergyOther: "", wontEat: "", ...extra,
});

/** Tiny builder: visit(restaurant, daysAgo, [[memberId, dish, rating, safe]]) */
function build(members: Member[], restaurantIds: string[]) {
  const data: HistoryData = {
    members,
    restaurants: restaurantIds.map((id) => ({ id, name: id, city: "Austin" })),
    visits: [],
    dishLogs: [],
  };
  let n = 0;
  const visit = (rid: string, daysAgo: number, logs: [string, string, Rating, (boolean | null)?][]) => {
    const vid = `v${++n}`;
    data.visits.push({ id: vid, restaurantId: rid, date: addDays(TODAY, -daysAgo), tags: [] });
    logs.forEach(([memberId, dishName, rating, safe = null], i) =>
      data.dishLogs.push({ id: `${vid}-${i}`, visitId: vid, memberId, dishName, rating, safe } as DishLog),
    );
  };
  return { data, visit };
}

describe("rankTonight", () => {
  const fam = [member("a", "Ann"), member("b", "Ben"), member("c", "Cal", { age: 4 })];

  it("never ranks a place first when one member has no liked dish", () => {
    const { data, visit } = build(fam, ["Favorite", "Okay"]);
    // "Favorite" is loved by two members many times, very recently...
    for (let i = 0; i < 5; i++)
      visit("Favorite", i, [["a", "Steak", 1], ["b", "Fries", 1], ["c", "Salad", -1]]);
    // ...but "Okay" is liked by everyone, long ago.
    visit("Okay", 300, [["a", "Soup", 1], ["b", "Soup", 1], ["c", "Noodles", 1]]);

    const { suggestions, notForEveryone } = rankTonight(data, TODAY);
    expect(suggestions.map((s) => s.restaurant.id)).toEqual(["Okay"]);
    expect(notForEveryone.map((n) => n.restaurant.id)).toContain("Favorite");
    expect(notForEveryone.find((n) => n.restaurant.id === "Favorite")!.reason).toContain("Cal");
  });

  it("suggests nothing when no place works for everyone", () => {
    const { data, visit } = build(fam, ["X"]);
    visit("X", 1, [["a", "Steak", 1], ["b", "Fries", 1]]); // Cal never ate here
    expect(rankTonight(data, TODAY).suggestions).toEqual([]);
  });

  it("uses the latest rating of a dish, so a changed taste stops counting", () => {
    const { data, visit } = build(fam, ["Tacos"]);
    visit("Tacos", 100, [["a", "Taco", 1], ["b", "Taco", 1], ["c", "Quesadilla", 1]]);
    visit("Tacos", 10, [["c", "Quesadilla", -1]]);
    const { suggestions, notForEveryone } = rankTonight(data, TODAY);
    expect(suggestions).toEqual([]);
    expect(notForEveryone[0].reason).toMatch(/No 👍 dish yet for Cal/);
  });

  it("warns about an unsafe dish but still suggests the place if the member has another safe favorite", () => {
    const leo = member("c", "Leo", { allergies: ["peanut"], age: 6 });
    const { data, visit } = build([fam[0], fam[1], leo], ["Thai"]);
    visit("Thai", 60, [["a", "Curry", 1], ["b", "Curry", 1], ["c", "Pad thai", 1, false]]);
    visit("Thai", 20, [["c", "Fried rice", 1, true]]);
    const [s] = rankTonight(data, TODAY).suggestions;
    expect(s.restaurant.id).toBe("Thai");
    expect(s.warnings).toEqual(["Leo: Pad thai was logged not safe (Peanut)"]);
  });

  it("excludes a place where a member's only liked dish was logged unsafe", () => {
    const ivy = member("c", "Ivy", { allergies: ["dairy"], age: 3 });
    const { data, visit } = build([fam[0], fam[1], ivy], ["Cafe"]);
    visit("Cafe", 5, [["a", "Toast", 1], ["b", "Eggs", 1], ["c", "Pancakes", 1, false]]);
    const { suggestions, notForEveryone } = rankTonight(data, TODAY);
    expect(suggestions).toEqual([]);
    expect(notForEveryone[0].reason).toBe("Ivy's only 👍 dish was logged not safe");
    expect(notForEveryone[0].warnings).toHaveLength(1);
  });

  it("ranks recent favorites above old ones", () => {
    const { data, visit } = build(fam, ["Old", "Recent"]);
    visit("Old", 400, [["a", "A", 1], ["b", "B", 1], ["c", "C", 1]]);
    visit("Recent", 7, [["a", "A", 1], ["b", "B", 1], ["c", "C", 1]]);
    expect(rankTonight(data, TODAY).suggestions.map((s) => s.restaurant.id)).toEqual(["Recent", "Old"]);
  });

  it("breaks exact ties by most recent visit, then name", () => {
    const { data, visit } = build(fam, ["Beta", "Alpha"]);
    visit("Beta", 10, [["a", "A", 1], ["b", "B", 1], ["c", "C", 1]]);
    visit("Alpha", 10, [["a", "A", 1], ["b", "B", 1], ["c", "C", 1]]);
    expect(rankTonight(data, TODAY).suggestions.map((s) => s.restaurant.id)).toEqual(["Alpha", "Beta"]);
  });

  it("puts places with no visits in the not-for-everyone list", () => {
    const { data } = build(fam, ["New"]);
    const { suggestions, notForEveryone } = rankTonight(data, TODAY);
    expect(suggestions).toEqual([]);
    expect(notForEveryone[0].reason).toBe("No visits logged yet");
  });

  it("works on Bree's demo data as designed", () => {
    const { suggestions, notForEveryone } = rankTonight(makeSeed(TODAY), TODAY);
    expect(suggestions.map((s) => s.restaurant.name)).toEqual([
      "Taco Tranquilo", "Slice of Eastside", "Bangkok Garden",
    ]);
    expect(suggestions.find((s) => s.restaurant.id === "r-thai")!.warnings[0]).toMatch(/Leo: Pad thai/);
    const blocked = Object.fromEntries(notForEveryone.map((n) => [n.restaurant.id, n.reason]));
    expect(blocked["r-bbq"]).toBe("No 👍 dish yet for Ivy");
    expect(blocked["r-cafe"]).toBe("Ivy's only 👍 dish was logged not safe");
  });
});
