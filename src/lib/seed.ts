import { addDays, todayISO } from "./dates";
import type { AppData, DishLog, Rating, Tag, Visit } from "./types";

type M = "bree" | "marcus" | "leo" | "ivy";
/** [member, dish, rating, safe?] */
type L = [M, string, Rating, (boolean | null)?];

/**
 * Demo data for Bree's family in Austin. Dates are relative to `today`
 * so the demo always looks fresh.
 *
 * Built to exercise every rule:
 * - Taco Tranquilo: Leo's tastes changed (quesadilla 👍 → 👎, now bean tacos).
 * - Bangkok Garden: Leo's pad thai was not peanut-safe → warning, but he likes the fried rice.
 * - Smokey Pecan BBQ: Ivy has no 👍 dish → never suggested.
 * - Bluebonnet Café: Ivy's only 👍 (pancakes) wasn't dairy-safe → never suggested.
 * - Slice of Eastside: Marcus's regular crust wasn't gluten-safe; GF crust is.
 */
export function makeSeed(today = todayISO()): AppData {
  const members = [
    { id: "m-bree", name: "Bree", age: 35, emoji: "👩", allergies: [], allergyOther: "", wontEat: "Cilantro" },
    { id: "m-marcus", name: "Marcus", age: 37, emoji: "👨", allergies: ["gluten" as const], allergyOther: "", wontEat: "" },
    { id: "m-leo", name: "Leo", age: 6, emoji: "🦖", allergies: ["peanut" as const], allergyOther: "", wontEat: "Anything green, mushrooms" },
    { id: "m-ivy", name: "Ivy", age: 3, emoji: "🦄", allergies: ["dairy" as const], allergyOther: "", wontEat: "Spicy food" },
  ];

  const restaurants = [
    { id: "r-tacos", name: "Taco Tranquilo", city: "Austin, TX" },
    { id: "r-pizza", name: "Slice of Eastside", city: "Austin, TX" },
    { id: "r-thai", name: "Bangkok Garden", city: "Austin, TX" },
    { id: "r-bbq", name: "Smokey Pecan BBQ", city: "Austin, TX" },
    { id: "r-cafe", name: "Bluebonnet Café", city: "Austin, TX" },
  ];

  const visits: Visit[] = [];
  const dishLogs: DishLog[] = [];
  let n = 0;
  const visit = (restaurantId: string, daysAgo: number, tags: Tag[], logs: L[]) => {
    const id = `v-${++n}`;
    visits.push({ id, restaurantId, date: addDays(today, -daysAgo), tags });
    logs.forEach(([m, dishName, rating, safe = null], i) =>
      dishLogs.push({ id: `${id}-d${i}`, visitId: id, memberId: `m-${m}`, dishName, rating, safe }),
    );
  };

  // Taco Tranquilo: 5 visits, the family's go-to after weekend bike rides
  visit("r-tacos", 170, ["kids_menu", "patio", "bike_rack"], [
    ["bree", "Fish tacos", 1], ["marcus", "Fajita tacos on corn", 1, true],
    ["leo", "Chicken quesadilla", 1, true], ["ivy", "Bean taco, no cheese", 1, true],
  ]);
  visit("r-tacos", 120, ["patio", "bike_rack", "fast_service"], [
    ["bree", "Fish tacos", 1], ["marcus", "Fajita tacos on corn", 1, true],
    ["leo", "Chicken quesadilla", 1, true], ["ivy", "Bean taco, no cheese", 0, true],
  ]);
  visit("r-tacos", 75, ["patio", "bike_rack"], [
    ["bree", "Al pastor tacos", 1], ["marcus", "Carnitas plate", 0, true],
    ["leo", "Chicken quesadilla", -1, true], ["ivy", "Rice and beans", 1, true],
  ]);
  visit("r-tacos", 30, ["kids_menu", "patio", "bike_rack", "fast_service"], [
    ["bree", "Al pastor tacos", 1], ["marcus", "Fajita tacos on corn", 1, true],
    ["leo", "Bean and cheese taco", 1, true], ["ivy", "Rice and beans", 1, true],
  ]);
  visit("r-tacos", 9, ["patio", "bike_rack", "fast_service"], [
    ["bree", "Fish tacos", 1], ["marcus", "Fajita tacos on corn", 1, true],
    ["leo", "Bean and cheese taco", 1, true], ["ivy", "Bean taco, no cheese", 1, true],
  ]);

  // Slice of Eastside: 3 visits
  visit("r-pizza", 150, ["high_chairs", "kids_menu"], [
    ["bree", "Margherita", 1], ["marcus", "Pepperoni (regular crust)", 0, false],
    ["leo", "Cheese pizza", 1, true], ["ivy", "Dairy-free veggie pizza", 1, true],
  ]);
  visit("r-pizza", 60, ["high_chairs", "kids_menu", "quiet"], [
    ["bree", "Margherita", 1], ["marcus", "Gluten-free pepperoni", 1, true],
    ["leo", "Cheese pizza", 1, true], ["ivy", "Dairy-free veggie pizza", 0, true],
  ]);
  visit("r-pizza", 20, ["high_chairs", "kids_menu"], [
    ["bree", "Hot honey pizza", 0], ["marcus", "Gluten-free pepperoni", 1, true],
    ["leo", "Pepperoni pizza", 1, true], ["ivy", "Dairy-free veggie pizza", 1, true],
  ]);

  // Bangkok Garden: 3 visits
  visit("r-thai", 140, ["quiet"], [
    ["bree", "Panang curry", 1], ["marcus", "Green curry", 0, true],
    ["leo", "Pad thai", 1, false], ["ivy", "Coconut chicken and rice", 1, true],
  ]);
  visit("r-thai", 90, ["quiet", "high_chairs"], [
    ["bree", "Panang curry", 1], ["marcus", "Basil chicken (no soy)", 1, true],
    ["leo", "Chicken fried rice", 1, true], ["ivy", "Coconut chicken and rice", 1, true],
  ]);
  visit("r-thai", 45, ["quiet", "high_chairs", "fast_service"], [
    ["bree", "Drunken noodles", 0], ["marcus", "Basil chicken (no soy)", 1, true],
    ["leo", "Chicken fried rice", 1, true], ["ivy", "Jasmine rice and chicken", 0, true],
  ]);

  // Smokey Pecan BBQ: 2 visits, Ivy hasn't found anything she likes
  visit("r-bbq", 110, ["patio", "bike_rack"], [
    ["bree", "Pork ribs", 1], ["marcus", "Brisket plate", 1, true],
    ["leo", "Brisket sandwich", 0, true], ["ivy", "Mac and cheese", -1, false],
  ]);
  visit("r-bbq", 35, ["patio", "bike_rack", "high_chairs"], [
    ["bree", "Pork ribs", 1], ["marcus", "Brisket plate", 1, true],
    ["leo", "Sausage link", 1, true], ["ivy", "Pulled pork, plain", 0, true],
  ]);

  // Bluebonnet Café: 2 visits, Ivy's favorite wasn't dairy-safe
  visit("r-cafe", 100, ["high_chairs", "kids_menu", "quiet"], [
    ["bree", "Avocado toast", 1], ["marcus", "Eggs and bacon", 1, true],
    ["leo", "Mini waffles", 1, true], ["ivy", "Buttermilk pancakes", 1, false],
  ]);
  visit("r-cafe", 50, ["high_chairs", "kids_menu"], [
    ["bree", "Avocado toast", 1], ["marcus", "Eggs and bacon", 1, true],
    ["leo", "Mini waffles", 1, true], ["ivy", "Fruit cup", 0, true],
  ]);

  return { version: 1, members, restaurants, visits, dishLogs };
}
