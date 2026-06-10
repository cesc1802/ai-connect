import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, Building2, Check, Cpu, Eye, EyeOff, KeyRound, LoaderCircle,
  Moon, ShieldCheck, Smartphone, Sun, User,
} from "lucide-react";
import { AntMark } from "@/components/brand/ant-mark";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

const THEME_KEY = "growing-theme";

export function LoginScreen() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(THEME_KEY) as "light" | "dark") || "light";
  });
  const [showToken, setShowToken] = useState(false);
  const [uid, setUid] = useState("system");
  const [token, setToken] = useState("");
  const navigate = useNavigate();
  const { login, submitting, error } = useAuth();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await login(uid, token);
      navigate("/", { replace: true });
    } catch {
      // ApiError surfaces via the `error` banner from useAuth.
    }
  }

  return (
    <div className="grid h-full lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <main className="relative flex items-center justify-center px-5 py-10 sm:px-8">
        <button
          type="button"
          title="Toggle theme"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="absolute right-5 top-5 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div className="w-full max-w-sm">
          {/* mobile brand */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <AntMark size={24} />
            </span>
            <span className="text-lg font-bold tracking-tight text-primary">AI Connect</span>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Connect to Gateway</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Authenticate with your credentials to access the dashboard.
            </p>
          </div>

          {error && (
            <div className="mt-6 flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error.message || "Invalid credentials. Check the values and try again."}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="uid" className="text-sm font-medium">Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="uid" name="uid" type="text" autoComplete="username"
                  value={uid} onChange={(e) => setUid(e.target.value)} placeholder="username"
                  className="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                />
              </div>
              <p className="text-xs text-muted-foreground">Used to scope your sessions and context files.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="tok" className="text-sm font-medium">Password</label>
                <a href="#" className="text-xs font-medium text-primary underline-offset-4 hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="tok" name="tok" type={showToken ? "text" : "password"}
                  autoComplete="current-password" placeholder="••••••••••••••••"
                  value={token} onChange={(e) => setToken(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-10 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50"
                />
                <button
                  type="button"
                  title={showToken ? "Hide password" : "Show password"}
                  onClick={() => setShowToken((s) => !s)}
                  className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <RememberCheckbox />

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              <span>{submitting ? "Connecting…" : "Connect"}</span>
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Smartphone className="h-4 w-4" />
            Pair this device
          </button>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Connecting to <span className="font-mono text-foreground">gateway.acme.internal</span> · Need access?{" "}
            <a href="#" className="font-medium text-primary underline-offset-4 hover:underline">Contact your admin</a>
          </p>
        </div>
      </main>
    </div>
  );
}

function RememberCheckbox() {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm">
      <input
        type="checkbox" className="peer sr-only"
        checked={checked} onChange={(e) => setChecked(e.target.checked)}
      />
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[5px] border border-input bg-transparent shadow-xs transition-colors",
          "peer-focus-visible:ring-1 peer-focus-visible:ring-ring/50",
          checked && "border-primary bg-primary",
        )}
      >
        <Check className={cn("h-3 w-3 text-primary-foreground", checked ? "opacity-100" : "opacity-0")} />
      </span>
      <span className="text-muted-foreground">Keep me connected on this device</span>
    </label>
  );
}

function BrandPanel() {
  return (
    <aside
      className="brand-grid relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14"
      style={{ background: "oklch(0.30 0.09 38)" }}
    >
      <div className="relative z-10 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
          <AntMark size={30} withLegs />
        </span>
        <span className="text-lg font-bold tracking-tight">AI Connect</span>
      </div>

      <div className="relative z-10 max-w-md">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/55">
          Multi-tenant AI agent gateway
        </p>
        <h2 className="mt-4 text-3xl font-bold leading-[1.15] tracking-tight xl:text-4xl">
          Deploy AI agent teams at&nbsp;scale, without compromising on&nbsp;safety.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-white/65">
          Single binary. Production-tested. Agents that orchestrate for you.
        </p>

        <ul className="mt-9 space-y-3.5">
          <BrandBullet icon={<Building2 className="h-4 w-4" style={{ color: "#F6A93B" }} />}>
            Multi-tenant isolation with per-workspace data
          </BrandBullet>
          <BrandBullet icon={<ShieldCheck className="h-4 w-4" style={{ color: "#F6A93B" }} />}>
            5-layer security &amp; AES-256-GCM encrypted keys
          </BrandBullet>
          <BrandBullet icon={<Cpu className="h-4 w-4" style={{ color: "#F6A93B" }} />}>
            Native concurrency · 20+ providers · 7 channels
          </BrandBullet>
        </ul>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/55">
        <div className="flex items-center gap-2">
          <span className="live-dot h-2 w-2 rounded-full bg-success" />
          <span className="font-mono">gateway.acme.internal:8080</span>
        </div>
        <span className="font-mono">v3.13.2</span>
      </div>
    </aside>
  );
}

function BrandBullet({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 text-sm text-white/80">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
        {icon}
      </span>
      {children}
    </li>
  );
}
