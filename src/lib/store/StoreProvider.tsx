import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { makeSeed } from "../seed";
import { supabase } from "../supabase";
import type { AppData, DishLog, Member, Restaurant, Visit } from "../types";
import { newId } from "../utils";
import { db, getFamilyId, loadFamilyData, withFreshIds } from "./remote";

export type StoreStatus = "no-config" | "checking" | "signed-out" | "loading" | "ready" | "error";

interface Store {
  status: StoreStatus;
  data: AppData;
  userEmail: string | null;
  /** Last failed save or load, shown as a banner. */
  saveError: string | null;
  dismissError: () => void;
  addMember: (m: Omit<Member, "id">) => void;
  updateMember: (m: Member) => void;
  deleteMember: (id: string) => void;
  addRestaurant: (r: Omit<Restaurant, "id">) => Restaurant;
  addVisit: (v: Omit<Visit, "id">, logs: Omit<DishLog, "id" | "visitId">[]) => Visit;
  deleteVisit: (id: string) => void;
  loadDemo: () => Promise<void>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const empty: AppData = { version: 1, members: [], restaurants: [], visits: [], dishLogs: [] };
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(empty);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Track the auth session. Only set state in the callback (no Supabase calls inside it).
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const reload = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoadState("loading");
    try {
      const fid = await getFamilyId(supabase);
      const fresh = await loadFamilyData(supabase);
      setFamilyId(fid);
      setData(fresh);
      setLoadState("ready");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setLoadState("error");
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void reload();
    else {
      setData(empty);
      setFamilyId(null);
      setLoadState("idle");
    }
  }, [userId, reload]);

  /**
   * Optimistic write: the screen updates at once, the save runs in the
   * background. If the save fails, show why and re-sync from the server.
   */
  const persist = useCallback(
    (op: (sb: SupabaseClient, familyId: string) => Promise<unknown>) => {
      if (!supabase || !familyId) return;
      op(supabase, familyId).catch((e: unknown) => {
        setSaveError(e instanceof Error ? e.message : "Couldn't save. Check your connection.");
        void reload();
      });
    },
    [familyId, reload],
  );

  const addMember = useCallback((m: Omit<Member, "id">) => {
    const member = { ...m, id: newId() };
    setData((d) => ({ ...d, members: [...d.members, member] }));
    persist((sb, fid) => db.upsertMember(sb, member, fid));
  }, [persist]);

  const updateMember = useCallback((m: Member) => {
    setData((d) => ({ ...d, members: d.members.map((x) => (x.id === m.id ? m : x)) }));
    persist((sb, fid) => db.upsertMember(sb, m, fid));
  }, [persist]);

  const deleteMember = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      members: d.members.filter((m) => m.id !== id),
      dishLogs: d.dishLogs.filter((l) => l.memberId !== id),
    }));
    persist((sb) => db.deleteMember(sb, id));
  }, [persist]);

  const addRestaurant = useCallback((r: Omit<Restaurant, "id">) => {
    const created = { ...r, id: newId() };
    setData((d) => ({ ...d, restaurants: [...d.restaurants, created] }));
    persist((sb, fid) => db.insertRestaurant(sb, created, fid));
    return created;
  }, [persist]);

  const addVisit = useCallback((v: Omit<Visit, "id">, logs: Omit<DishLog, "id" | "visitId">[]) => {
    const visit: Visit = { ...v, id: newId() };
    const dishLogs = logs.map((l) => ({ ...l, id: newId(), visitId: visit.id }));
    setData((d) => ({ ...d, visits: [...d.visits, visit], dishLogs: [...d.dishLogs, ...dishLogs] }));
    persist(async (sb, fid) => {
      await db.insertVisit(sb, visit, dishLogs, fid);
      if (visit.photoDataUrl) {
        const photoPath = await db.uploadPhoto(sb, fid, visit.id, visit.photoDataUrl);
        setData((d) => ({ ...d, visits: d.visits.map((x) => (x.id === visit.id ? { ...x, photoPath } : x)) }));
      }
    });
    return visit;
  }, [persist]);

  const deleteVisit = useCallback((id: string) => {
    const visit = dataRef.current.visits.find((v) => v.id === id);
    if (!visit) return;
    setData((d) => ({
      ...d,
      visits: d.visits.filter((v) => v.id !== id),
      dishLogs: d.dishLogs.filter((l) => l.visitId !== id),
    }));
    persist((sb) => db.deleteVisit(sb, visit));
  }, [persist]);

  const loadDemo = useCallback(async () => {
    if (!supabase || !familyId) return;
    const demo = withFreshIds(makeSeed(), () => newId());
    try {
      await db.insertAll(supabase, demo, familyId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    }
    await reload();
  }, [familyId, reload]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  const status: StoreStatus = !supabase
    ? "no-config"
    : session === undefined
      ? "checking"
      : !session
        ? "signed-out"
        : loadState === "ready"
          ? "ready"
          : loadState === "error"
            ? "error"
            : "loading";

  const value = useMemo<Store>(
    () => ({
      status, data, userEmail: session?.user.email ?? null, saveError,
      dismissError: () => setSaveError(null),
      addMember, updateMember, deleteMember, addRestaurant, addVisit, deleteVisit, loadDemo, reload, signOut,
    }),
    [status, data, session, saveError, addMember, updateMember, deleteMember, addRestaurant, addVisit, deleteVisit, loadDemo, reload, signOut],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
