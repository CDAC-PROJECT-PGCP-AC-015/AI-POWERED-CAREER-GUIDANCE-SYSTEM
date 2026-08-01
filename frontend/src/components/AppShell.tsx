import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Compass,
  Route as RouteIcon,
  Users,
  BrainCircuit,
  Settings,
  HelpCircle,
  LogOut,
  History,
  Menu,
  X,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

const STUDENT_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/career-path", label: "Career Path", icon: Compass },
  { to: "/guidance", label: "Career Guidance", icon: RouteIcon },
  { to: "/mentorship", label: "Mentorship", icon: Users },
  { to: "/skill-lab", label: "Skill Lab", icon: BrainCircuit },
  { to: "/activity", label: "Activity", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const MENTOR_NAV = [
  { to: "/mentor-portal", label: "Dashboard", icon: LayoutGrid },
  { to: "/mentor-students", label: "My Students", icon: Users },
  { to: "/mentor-sessions", label: "Sessions", icon: CalendarDays },
  { to: "/activity", label: "Activity", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutGrid },
  { to: "/admin-students", label: "Students", icon: Users },
  { to: "/admin-reports", label: "Reports", icon: BarChart3 },
  { to: "/activity", label: "Activity", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = profile?.role ?? "student";
  const NAV: readonly { to: string; label: string; icon: typeof LayoutGrid }[] =
    role === "mentor" ? MENTOR_NAV : role === "admin" ? ADMIN_NAV : STUDENT_NAV;

  const initials = (profile?.name ?? "Student")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-6 pt-7 pb-6">
          <Link to={NAV[0].to} className="block">
            <span className="text-2xl font-bold tracking-tight text-sidebar-accent-foreground">
              CareerAI
            </span>
            <span className="block text-sm text-sidebar-foreground/70">
              {profile?.role === "mentor" ? "Mentor Portal" : profile?.role === "admin" ? "Admin Portal" : "Student Portal"}
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-sidebar-foreground/70 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                )}
                <Icon className="size-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-4">
          <Link
            to={role === "mentor" ? "/mentor-sessions" : role === "admin" ? "/admin-reports" : "/assessment"}
            className="mb-5 block rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {role === "mentor" ? "Manage Availability" : role === "admin" ? "Export Report" : "Retake Assessment"}
          </Link>

          <div className="space-y-1 border-t border-sidebar-border pt-4">
            <Link
              to="/help"
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] text-sidebar-foreground/85 hover:bg-sidebar-accent/50"
            >
              <HelpCircle className="size-[18px] shrink-0" />
              Help Center
            </Link>
            <Link
              to="/"
              onClick={signOut}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] text-sidebar-foreground/85 hover:bg-sidebar-accent/50"
            >
              <LogOut className="size-[18px] shrink-0" />
              Logout
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-sidebar-border pt-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
                {profile?.name ?? "Guest Student"}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                {profile?.email ?? "Not signed in"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[260px]">
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu className="size-6" />
          </button>
          <span className="text-lg font-bold text-primary">CareerAI</span>
        </header>
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-[1280px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
