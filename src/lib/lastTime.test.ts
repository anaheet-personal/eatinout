import { describe, expect, it } from "vitest";
import { lastTimeHere } from "./lastTime";
import { makeSeed } from "./seed";

const TODAY = "2026-11-07";
const data = makeSeed(TODAY);
const byName = (rid: string) =>
  Object.fromEntries(lastTimeHere(rid, data).members.map((m) => [m.member.name, m]));

describe("lastTimeHere", () => {
  it("shows what each member ordered on their most recent visit, with the date", () => {
    const tacos = byName("r-tacos");
    expect(tacos.Leo.last).toMatchObject({ dishName: "Bean and cheese taco", rating: 1, date: "2026-10-29" });
    expect(lastTimeHere("r-tacos", data)).toMatchObject({ lastVisitDate: "2026-10-29", visitCount: 5 });
  });

  it("never suggests trying a dish again that was logged unsafe", () => {
    const thai = byName("r-thai");
    expect(thai.Leo.tryAgain?.dishName).toBe("Chicken fried rice");
    const cafe = byName("r-cafe");
    expect(cafe.Ivy.tryAgain?.dishName).toBe("Fruit cup"); // pancakes were 👍 but not dairy-safe
  });

  it("does not suggest a dish whose latest rating is 👎", () => {
    const bbq = byName("r-bbq");
    expect(bbq.Ivy.tryAgain?.dishName).toBe("Pulled pork, plain");
    const tacos = byName("r-tacos");
    expect(tacos.Leo.tryAgain?.dishName).toBe("Bean and cheese taco");
  });

  it("prefers the newest dish when ratings tie", () => {
    expect(byName("r-pizza").Leo.tryAgain?.dishName).toBe("Pepperoni pizza");
  });

  it("handles a member who has never eaten here", () => {
    const d = { ...data, members: [...data.members, { id: "m-new", name: "Grandma", age: 70, emoji: "👵", allergies: [], allergyOther: "", wontEat: "" }] };
    const g = lastTimeHere("r-tacos", d).members.find((m) => m.member.id === "m-new")!;
    expect(g.last).toBeUndefined();
    expect(g.tryAgain).toBeUndefined();
  });
});
