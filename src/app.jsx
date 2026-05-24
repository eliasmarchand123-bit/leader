import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function App() {
  const [runs, setRuns] = useState([]);
  const [lang, setLang] = useState("en");

  const t = {
    en: {
      title: "Subway Surfers FR",
      subtitle: "No Coins Leaderboard",
      place: "Place",
      player: "Player",
      time: "Time"
    },
    fr: {
      title: "Subway Surfers FR",
      subtitle: "Classement No Coins",
      place: "Place",
      player: "Joueur",
      time: "Temps"
    }
  };

  const text = t[lang];

  const fetchRuns = async () => {
    const { data } = await supabase
      .from("runs")
      .select("*")
      .order("place", { ascending: true });

    setRuns(data || []);
  };

  useEffect(() => {
    fetchRuns();

    const channel = supabase
      .channel("runs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "runs" },
        () => fetchRuns()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">

      {/* HEADER */}
      <div className="flex justify-between mb-10">
        <div>
          <h1 className="text-4xl font-bold">{text.title}</h1>
          <p className="text-gray-400">{text.subtitle}</p>
        </div>

        <button
          onClick={() => setLang(lang === "en" ? "fr" : "en")}
          className="px-4 py-2 bg-zinc-800 rounded"
        >
          {lang.toUpperCase()}
        </button>
      </div>

      {/* TABLE */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">

        <div className="grid grid-cols-3 p-4 text-gray-400 border-b border-zinc-800">
          <div>{text.place}</div>
          <div>{text.player}</div>
          <div className="text-right">{text.time}</div>
        </div>

        {runs.map((r) => (
          <details key={r.id} className="border-b border-zinc-800">
            <summary className="grid grid-cols-3 p-4 cursor-pointer">
              <div>#{r.place}</div>
              <div>{r.player}</div>
              <div className="text-right">{r.time}</div>
            </summary>

            <div className="p-4 bg-zinc-950 space-y-2 text-sm">

              <iframe
                className="w-full h-60 rounded"
                src={r.video}
              />

              <div>🎮 Player: {r.player}</div>
              <div>📅 Date: {r.date}</div>
              <div>⏱ Time precise: {r.time_precise}</div>
              <div>🌐 Browser: {r.browser}</div>
              <div>🧪 Verified by: {r.verified_by}</div>

            </div>
          </details>
        ))}

      </div>
    </div>
  );
}