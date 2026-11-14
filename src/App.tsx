import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TabBar } from "@/components/TabBar";
import { Button } from "@/components/ui/button";
import { StoreProvider, useStore } from "@/lib/store/StoreProvider";
import { Family } from "@/screens/Family";
import { LogVisit } from "@/screens/LogVisit";
import { Login } from "@/screens/Login";
import { RestaurantDetail } from "@/screens/RestaurantDetail";
import { Restaurants } from "@/screens/Restaurants";
import { Tonight } from "@/screens/Tonight";

/** Each screen starts at the top, e.g. after saving a visit from the bottom of the logger. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function ErrorBanner() {
  const { saveError, dismissError } = useStore();
  if (!saveError) return null;
  return (
    <div role="alert" className="mb-3 flex items-start gap-2 rounded-2xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
      <span className="flex-1">{saveError}</span>
      <button onClick={dismissError} aria-label="Dismiss" className="-my-1 h-8 w-8 rounded-full">✕</button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-muted">{children}</div>;
}

function Shell() {
  const { status, reload } = useStore();

  if (status === "no-config")
    return (
      <Centered>
        <p className="text-lg font-bold text-fg">Supabase isn't configured</p>
        <p>Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and publishable key, then restart <code>npm run dev</code>.</p>
      </Centered>
    );
  if (status === "checking") return <Centered>Loading…</Centered>;
  if (status === "signed-out") return <Login />;

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <main className="mx-auto max-w-lg px-4 pb-32 pt-[max(env(safe-area-inset-top),1rem)]">
        <ErrorBanner />
        {status === "loading" ? (
          <Centered>Loading your family…</Centered>
        ) : status === "error" ? (
          <Centered>
            <p>We couldn't load your data.</p>
            <Button onClick={() => void reload()}>Try again</Button>
          </Centered>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to="/tonight" replace />} />
            <Route path="/tonight" element={<Tonight />} />
            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/restaurants/:id" element={<RestaurantDetail />} />
            <Route path="/log" element={<LogVisit />} />
            <Route path="/family" element={<Family />} />
            <Route path="*" element={<Navigate to="/tonight" replace />} />
          </Routes>
        )}
      </main>
      <TabBar />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <ScrollToTop />
        <Shell />
      </StoreProvider>
    </BrowserRouter>
  );
}
