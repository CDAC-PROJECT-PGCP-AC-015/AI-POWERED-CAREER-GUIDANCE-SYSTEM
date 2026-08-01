import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles, User } from "lucide-react";
import { useState } from "react";
import { Button, Card, Field, inputClass } from "@/components/ui-kit";
import { useApp } from "@/lib/app-store";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
// Admin accounts aren't self-registrable (see backend/src/routes/auth.ts) —
// they're provisioned by the seed script or promoted by an existing admin.
type Role = "student" | "mentor";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (search.mode === "login" ? "login" : "register") as Mode,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — CareerAI" },
      {
        name: "description",
        content: "Create your CareerAI account as a student, mentor or institution admin.",
      },
      { property: "og:title", content: "Sign in — CareerAI" },
      { property: "og:description", content: "Join CareerAI to map your future." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { register, login, authError } = useApp();

  const [role, setRole] = useState<Role>("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isRegister && name.trim().length < 2) return setError("Please enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setError("");
    setSubmitting(true);

    const result = isRegister
      ? await register({ name: name.trim(), email: email.trim(), password, role })
      : await login({ email: email.trim(), password });

    setSubmitting(false);
    if (!result) return; // authError from useApp() renders below

    // Navigate based on what login()/register() actually just returned, not
    // useApp()'s `authUser`/`onboarded` read above — those come from this
    // render's closure, captured BEFORE the await, so they're always one
    // render behind here (authUser reads as null, onboarded as false) no
    // matter what really happened. That stale read is what made every
    // student login land on /onboarding regardless of real progress.
    if (result.user.role === "mentor") navigate({ to: "/mentor-portal" });
    else if (result.user.role === "admin") navigate({ to: "/admin" });
    else navigate({ to: result.onboarded ? "/dashboard" : "/onboarding" });
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden />
      <Card className="relative w-full max-w-md p-8 shadow-[var(--shadow-float)]">
        <Link
          to="/"
          className="mb-6 flex items-center justify-center gap-2 text-sm font-bold text-primary"
        >
          <Sparkles className="size-4" /> CareerAI
        </Link>
        <h1 className="text-center text-3xl font-bold">
          {isRegister ? "Create an account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-center text-muted-foreground">
          {isRegister ? "Join CareerAI to map your future" : "Sign in to continue your roadmap"}
        </p>

        {isRegister && (
          <div className="mt-7 grid grid-cols-2 gap-1 rounded-xl bg-accent p-1">
            {(["student", "mentor"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "rounded-lg py-2.5 text-sm font-medium capitalize transition-colors",
                  role === r
                    ? "bg-card text-foreground shadow-[var(--shadow-card)]"
                    : "text-accent-foreground hover:bg-card/50",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {isRegister && (
            <Field label="Full name">
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  className={cn(inputClass, "pl-11")}
                  placeholder="Arjun Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </Field>
          )}

          <Field label="Email address">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                className={cn(inputClass, "pl-11")}
                placeholder="you@student.cdac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </Field>

          <Field
            label="Password"
            hint={<span className="text-sm font-normal text-primary">Forgot password?</span>}
          >
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                className={cn(inputClass, "px-11")}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          {(error || authError) && <p className="text-sm text-destructive">{error || authError}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? "Please wait..." : isRegister ? "Get Started" : "Sign In"}{" "}
            {!submitting && <ArrowRight className="size-4" />}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {isRegister
            ? "Institution admin? Admin accounts aren't self-registered — ask an existing admin to create one."
            : "Works for student, mentor and admin accounts — your account type is detected automatically."}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Talks to the backend at the URL in <code>VITE_API_URL</code> (defaults to{" "}
          <code>http://localhost:5001/api</code>). Make sure <code>server/</code> is running.
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isRegister ? "Already have an account? " : "New to CareerAI? "}
          <Link
            to="/auth"
            search={{ mode: isRegister ? "login" : "register" }}
            className="font-medium text-primary"
          >
            {isRegister ? "Sign in" : "Create one"}
          </Link>
        </p>
      </Card>
    </div>
  );
}
