import { dishSummaries, visitsAt, type DishSummary } from "./history";
import type { HistoryData, Member, Rating } from "./types";

export interface LastDish {
  dishName: string;
  rating: Rating;
  date: string;
  safe: boolean | null;
}

export interface MemberLastTime {
  member: Member;
  /** What they ordered the most recent time they ate here */
  last?: LastDish;
  /** Best-rated dish (newest wins ties), never one logged as not safe or 👎 */
  tryAgain?: DishSummary;
}

export interface LastTimeHere {
  lastVisitDate?: string;
  visitCount: number;
  members: MemberLastTime[];
}

export function lastTimeHere(restaurantId: string, data: HistoryData): LastTimeHere {
  const visits = visitsAt(restaurantId, data); // newest first

  const members = data.members.map((member): MemberLastTime => {
    let last: LastDish | undefined;
    for (const v of visits) {
      const log = data.dishLogs.find((l) => l.visitId === v.id && l.memberId === member.id);
      if (log) {
        last = { dishName: log.dishName, rating: log.rating, date: v.date, safe: log.safe };
        break;
      }
    }

    const tryAgain = dishSummaries(member.id, restaurantId, data)
      .filter((d) => !d.everUnsafe && d.rating >= 0)
      .sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date))[0];

    return { member, last, tryAgain };
  });

  return { lastVisitDate: visits[0]?.date, visitCount: visits.length, members };
}
