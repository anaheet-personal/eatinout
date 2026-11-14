import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/tonight", label: "Tonight", icon: "🌙" },
  { to: "/restaurants", label: "Places", icon: "🍽️" },
  { to: "/log", label: "Log visit", icon: "＋", primary: true },
  { to: "/family", label: "Family", icon: "👨‍👩‍👧‍👦" },
];

export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map((t) => (
          <li key={t.to}>
            <NavLink
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                  isActive ? "text-primary" : "text-muted",
                )
              }
            >
              {({ isActive }) =>
                t.primary ? (
                  <>
                    <span
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full bg-primary text-xl font-bold text-primary-fg shadow",
                        isActive && "ring-4 ring-primary-soft",
                      )}
                    >
                      {t.icon}
                    </span>
                    {t.label}
                  </>
                ) : (
                  <>
                    <span className={cn("text-2xl leading-none transition", !isActive && "opacity-60 grayscale")}>{t.icon}</span>
                    {t.label}
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
