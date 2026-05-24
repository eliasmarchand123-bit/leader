import { useEffect, useMemo, useState } from "react";
import supabase from "./supabase";

const t = {
  en: {
    title: "Subway Surfers FR",
    subtitle: "No Coins Web Leaderboard",
    rules: "Rules",
    submit: "Submit Run",
    place: "Place",
    player: "Player",
    time: "Time",
    discord: "Discord",
    tos: "Terms of Service",
    privacy: "Privacy Policy",
    rulesList: [
      "WEB runs only.",
      "Runs must be played on YellowSuit.",
      "Fullscreen is forbidden.",
      "Windowed mode required.",
      "Browser window + URL must stay visible.",
      "Browser extensions are forbidden.",
      "Extension icon must not appear.",
      "Full run must be recorded from start to score screen.",
      "No edited or cut videos.",
      "No stopping video after collecting coins.",
      "Player must die normally and show final score screen.",
      "Cheats, macros, scripts are forbidden.",
      "Suspicious runs may require proof (history/date/time).",
      "Runs are submitted via Discord only."
    ],
    tosText:
      "By submitting a run, you agree it may be reviewed, rejected, or removed if suspicious or invalid.",
    privacyText:
      "Submitted runs (username + video) may be publicly displayed on the leaderboard."
  },
  fr: {
    title: "Subway Surfers FR",
    subtitle: "Classement Web No Coins",
    rules: "Règles",
    submit: "Envoyer un Run",
    place: "Place",
    player: "Joueur",
    time: "Temps",
    discord: "Discord",
    tos: "Conditions d'utilisation",
    privacy: "Confidentialité",
    rulesList: [
      "RUNS WEB uniquement.",
      "Runs sur YellowSuit obligatoire.",
      "Plein écran interdit.",
      "Mode fenêtré obligatoire.",
      "Fenêtre + URL visibles.",
      "Extensions interdites.",
      "Icône extension invisible.",

      "Run complète du début au score final.",
      "Vidéos non coupées.",
      "Interdit de couper après une pièce.",
      "Mort normale obligatoire.",
      "Cheats interdits.",
      "Runs suspectes = preuve demandée.",
      "Discord obligatoire pour submit."
    ],
    tosText:
      "En envoyant une run, vous acceptez que votre run puisse être vérifiée, refusée ou supprimée en cas de suspicion.",
    privacyText:
      "Les runs (pseudo + vidéo) peuvent être affichées publiquement sur le classement."
  }
};

const parseTimeToMs = (time = "") => {
  const raw = String(time).trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return 0;

  const colonFormat = /^\d{1,2}(:\d{1,2}){0,2}(\.\d{1,3})?$/;
  if (colonFormat.test(raw)) {
    const parts = raw.split(":");
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    let millis = 0;

    if (parts.length === 3) {
      hours = Number(parts[0]) || 0;
      minutes = Number(parts[1]) || 0;
      seconds = parts[2];
    } else if (parts.length === 2) {
      minutes = Number(parts[0]) || 0;
      seconds = parts[1];
    } else {
      seconds = parts[0];
    }

    if (typeof seconds === "string" && seconds.includes(".")) {
      const [secs, fraction] = seconds.split(".");
      seconds = Number(secs) || 0;
      millis = Number(fraction.padEnd(3, "0").slice(0, 3)) || 0;
    } else {
      seconds = Number(seconds) || 0;
    }

    return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
  }

  const tokenRegex = /(\d+)(h|hr|hours|heure|heures|ms|msec|milliseconds|millisecondes|m|min|minute|minutes|s|sec|seconds|secondes)?/g;
  let match;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let millis = 0;
  let lastUnit = "";

  while ((match = tokenRegex.exec(raw)) !== null) {
    const value = Number(match[1] || 0);
    const unit = match[2] || "";

    if (!unit) {
      if (lastUnit === "m" || lastUnit === "min" || lastUnit === "minute" || lastUnit === "minutes") {
        seconds = seconds || value;
      } else if (lastUnit === "s" || lastUnit === "sec" || lastUnit === "seconds" || lastUnit === "secondes") {
        millis = millis || value;
      } else if (!seconds) {
        seconds = value;
      } else if (!millis) {
        millis = value;
      }
      continue;
    }

    if (["h", "hr", "hours", "heure", "heures"].includes(unit)) {
      hours = value;
      lastUnit = "h";
    } else if (["m", "min", "minute", "minutes"].includes(unit)) {
      minutes = value;
      lastUnit = "m";
    } else if (["s", "sec", "seconds", "secondes"].includes(unit)) {
      seconds = value;
      lastUnit = "s";
    } else if (["ms", "msec", "milliseconds", "millisecondes"].includes(unit)) {
      millis = value;
      lastUnit = "ms";
    }
  }

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
};

const getEmbedUrl = (video) => {
  if (!video) return "";
  const trimmed = String(video).trim();
  if (trimmed.includes("youtube.com/watch")) {
    try {
      const url = new URL(trimmed);
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    } catch {
      return "";
    }
  }
  if (trimmed.includes("youtu.be/")) {
    const parts = trimmed.split("youtu.be/");
    return `https://www.youtube.com/embed/${parts[1]}`;
  }
  if (trimmed.includes("youtube.com/shorts/")) {
    const parts = trimmed.split("youtube.com/shorts/");
    return `https://www.youtube.com/embed/${parts[1].split(/[?&]/)[0]}`;
  }
  return "";
};

const statusLabel = (status) => {
  if (status === "approved") return { label: "Approved", color: "bg-emerald-500/15 text-emerald-300" };
  if (status === "pending") return { label: "Pending", color: "bg-amber-500/15 text-amber-300" };
  return { label: status ?? "Unknown", color: "bg-slate-500/15 text-slate-300" };
};

export default function LeaderboardSite() {
  const [language, setLanguage] = useState("en");
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const lang = t[language];

  const fetchRuns = async () => {
    setLoading(true);
    if (!supabase) {
      setError("Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in leaderboard-site/.env");
      setRuns([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase.from("runs").select("*");
      if (fetchError) {
        setError(fetchError.message);
        setRuns([]);
        setLoading(false);
        return;
      }
      setRuns(
        Array.isArray(data)
          ? data.map((run) => ({
              ...run,
              // Always compute time_ms from the stored time strings to avoid
              // inconsistent units (some DB values may be seconds or malformed).
              time_ms: parseTimeToMs(run.time_precise || run.time || "")
            }))
          : []
      );
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to fetch runs");
      setRuns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    if (!supabase) return;

    const channel = supabase
      .channel("public:runs")
      .on("postgres_changes", { event: "*", schema: "public", table: "runs" }, () => fetchRuns())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sortedRuns = useMemo(() => {
    const safeRuns = Array.isArray(runs) ? runs : [];
    return [...safeRuns].sort((a = {}, b = {}) => {
      const timeA = Number(parseTimeToMs(a.time_precise || a.time || ""));
      const timeB = Number(parseTimeToMs(b.time_precise || b.time || ""));
      // Sort descending so largest times appear first (decroissant)
      if (timeA !== timeB) return timeB - timeA;
      if (a.status !== b.status) {
        return a.status === "approved" ? -1 : 1;
      }
      return 0;
    });
  }, [runs]);

  // Only show approved runs in the main leaderboard
  const visibleRuns = sortedRuns.filter((run = {}) => {
    const status = run.status ?? (run.verified_by ? "approved" : "pending");
    return status === "approved";
  });
  const approvedRunsCount = visibleRuns.length;
  const totalRuns = visibleRuns.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-10 rounded-[2rem] border border-zinc-800 bg-zinc-900/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-[0.35em] text-violet-400/80">Realtime Leaderboard</span>
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">{lang.title}</h1>
              <p className="max-w-2xl text-sm text-zinc-400 sm:text-base">{lang.subtitle}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => setLanguage(language === "en" ? "fr" : "en")}
                className="inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:border-violet-500"
              >
                {language.toUpperCase()}
              </button>
              <a
                href="https://discord.gg/example"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-yellow-300"
              >
                {lang.submit}
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-zinc-950/90 p-5 text-sm text-zinc-300 shadow-inner">
              <p className="text-zinc-500">Approved runs</p>
              <p className="mt-3 text-3xl font-semibold text-white">{approvedRunsCount}</p>
            </div>
            <div className="rounded-3xl bg-zinc-950/90 p-5 text-sm text-zinc-300 shadow-inner">
              <p className="text-zinc-500">Total runs</p>
              <p className="mt-3 text-3xl font-semibold text-white">{totalRuns}</p>
            </div>
            <div className="rounded-3xl bg-zinc-950/90 p-5 text-sm text-zinc-300 shadow-inner">
              <p className="text-zinc-500">Auto rank</p>
              <p className="mt-3 text-3xl font-semibold text-violet-300">By precise time</p>
            </div>
          </div>
        </div>

        <details className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5 transition hover:border-violet-500/40">
          <summary className="cursor-pointer text-lg font-semibold text-white">{lang.rules}</summary>
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            {lang.rulesList.map((rule, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-violet-400" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </details>

        {error ? (
          <div className="mb-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">{error}</div>
        ) : null}

        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/95 p-4 shadow-glow">
          <div className="grid grid-cols-3 gap-4 rounded-t-[1.75rem] border-b border-zinc-800 bg-zinc-950/90 px-6 py-4 text-sm uppercase tracking-[0.2em] text-zinc-500">
            <span>{lang.place}</span>
            <span>{lang.player}</span>
            <span className="text-right">{lang.time}</span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-zinc-400">Loading leaderboard...</div>
          ) : visibleRuns.length === 0 ? (
            <div className="p-10 text-center text-zinc-400">No runs available yet.</div>
          ) : (
            visibleRuns.map((run, index) => {
              const selected = selectedId === run.id;
              const embed = getEmbedUrl(run.video);
              const status = statusLabel(run.status ?? (run.verified_by ? "approved" : "pending"));
              const place = index + 1;

              return (
                <details key={run.id} className="border-t border-zinc-800">
                  <summary className="grid grid-cols-3 gap-4 px-6 py-5 cursor-pointer text-sm text-white transition hover:bg-zinc-950/80">
                    <span className="font-semibold text-violet-300">#{place}</span>
                    <span>{run.player}</span>
                    <span className="text-right text-zinc-300">{run.time || "--"}</span>
                  </summary>
                  <div className="bg-zinc-950/90 px-6 py-5 text-sm text-zinc-300">
                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang.player}</p>
                            <p className="mt-1 text-white font-semibold">{run.player}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang.place}</p>
                          <p className="mt-1 text-white font-semibold">#{place}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{lang.time}</p>
                            <p className="mt-1 text-white">{run.time_precise || run.time || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Browser</p>
                            <p className="mt-1 text-white">{run.browser || "Unknown"}</p>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Version</p>
                            <p className="mt-1 text-white">{run.version || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Date</p>
                            <p className="mt-1 text-white">{run.date || "—"}</p>
                          </div>
                        </div>
                        <div className="rounded-3xl bg-zinc-900/90 p-4 text-xs uppercase tracking-[0.2em] text-zinc-400">
                          Verified by: <span className="text-white">{run.verified_by || "Pending"}</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="rounded-3xl border border-zinc-800 bg-black/40 p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{status.label}</p>
                          <p className="mt-2 text-lg font-semibold text-white">{status.label}</p>
                        </div>
                        <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 relative">
                          {embed ? (
                            <>
                              <iframe
                                className="h-56 w-full pointer-events-none"
                                src={embed}
                                title={`Run ${run.id}`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                              <a
                                href={run.video}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute inset-0"
                                aria-label="Open run video"
                              />
                            </>
                          ) : run.video ? (
                            <a
                              href={run.video}
                              target="_blank"
                              rel="noreferrer"
                              className="flex h-56 items-center justify-center bg-zinc-950 text-zinc-500 text-center px-4"
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">Open run video</p>
                                <p className="mt-2 text-xs text-zinc-400">Click to open the full run link</p>
                              </div>
                            </a>
                          ) : (
                            <div className="flex h-56 items-center justify-center bg-zinc-950 text-zinc-500">No video preview</div>
                          )}
                        </div>
                        {run.video ? (
                          <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 text-xs text-zinc-300">
                            <p className="text-zinc-500 mb-1">Lien de la vidéo soumise</p>
                            <a
                              href={run.video}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-sm font-medium text-white underline"
                            >
                              {run.video}
                            </a>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mt-10">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 text-sm text-zinc-300">
            <h3 className="text-xl font-semibold text-white mb-3">{lang.tos}</h3>
            <p>{lang.tosText}</p>
          </div>
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 text-sm text-zinc-300">
            <h3 className="text-xl font-semibold text-white mb-3">{lang.privacy}</h3>
            <p>{lang.privacyText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
