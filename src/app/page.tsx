"use client";

import { useEffect, useState, useCallback } from "react";
import { Music, Headphones, ChevronRight, ArrowLeft, Sun, Moon } from "lucide-react";
import { AudioTrack, useColors } from "@/components/audio-track";
import worksData from "../../public/data/index.json";
import type { TrackItem, WorkItem } from "@/lib/types";

export default function Home() {
  const [view, setView] = useState<"library" | "work">("library");
  const [activeWork, setActiveWork] = useState<string>("");
  const [worksList, setWorksList] = useState<WorkItem[]>([]);
  const [workMeta, setWorkMeta] = useState<WorkItem | null>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<string>("");
  const c = useColors();

  useEffect(() => {
    const wl = worksData as WorkItem[];
    setWorksList(wl);

    const hash = window.location.hash;
    if (hash.startsWith("#/")) {
      const id = hash.slice(2).replace(/\/$/, "");
      if (id) openWork(id, wl);
    }
  }, []);

  const openWork = useCallback((id: string, wl?: WorkItem[]) => {
    const list = wl || worksList;
    const meta = list.find((w) => w.id === id);
    if (!meta) return;

    setView("work");
    setActiveWork(id);
    setWorkMeta(meta);
    setLoading(true);
    setActiveTrackId("");
    window.location.hash = `#/${id}`;

    fetch(`data/works/${id}.json`)
      .then((r) => r.json())
      .then((data: TrackItem[]) => {
        setTracks(data);
        setLoading(false);
      })
      .catch(() => {
        setTracks([]);
        setLoading(false);
      });
  }, [worksList]);

  const goBack = useCallback(() => {
    setView("library");
    setActiveWork("");
    setTracks([]);
    setWorkMeta(null);
    setActiveTrackId("");
    window.location.hash = "";
    window.scrollTo(0, 0);
  }, []);

  const handlePlay = useCallback((id: string) => {
    setActiveTrackId(id);
  }, []);

  const handleStop = useCallback(() => {
    setActiveTrackId("");
  }, []);

  // Theme toggle button
  const ThemeToggle = () => (
    <button
      onClick={c.toggle}
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:opacity-80"
      style={{ backgroundColor: c.toggleTrack }}
      aria-label="Toggle theme"
    >
      {c.isDark ? <Sun className="w-4 h-4" style={{ color: c.textPrimary }} /> : <Moon className="w-4 h-4" style={{ color: c.textPrimary }} />}
    </button>
  );

  // Work player view
  if (view === "work") {
    return (
      <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: c.bgBody }}>
        <header
          className="sticky top-0 z-10 backdrop-blur-xl border-b"
          style={{ backgroundColor: c.bgHeader, borderColor: c.bgCardBorder }}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-2">
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:opacity-80"
              style={{ backgroundColor: c.toggleTrack }}
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" style={{ color: c.textPrimary }} />
            </button>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#818cf8" }}
            >
              <Music className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: c.textPrimary }}>
              {workMeta?.title || activeWork}
            </h1>
            <span className="text-xs ml-auto mr-2" style={{ color: c.textSecondary }}>
              {tracks.length} episodes
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: c.toggleTrack, borderTopColor: c.accent }} />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {tracks.map((track) => (
                <AudioTrack
                  key={track.id}
                  src={track.yandexUrl || track.localUrl || `audio/${track.id}.mp3`}
                  title={track.title}
                  text={track.text}
                  activeTrackId={activeTrackId}
                  onPlay={handlePlay}
                  onStop={handleStop}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Library view
  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: c.bgBody }}>
      <header
        className="sticky top-0 z-10 backdrop-blur-xl border-b"
        style={{ backgroundColor: c.bgHeader, borderColor: c.bgCardBorder }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "#818cf8" }}
          >
            <Headphones className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: c.textPrimary }}>
            Audio Library
          </h1>
          <span className="text-xs ml-auto mr-2" style={{ color: c.textSecondary }}>
            {worksList.length} works
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
        <div className="flex flex-col gap-3">
          {worksList.map((w) => (
            <button
              key={w.id}
              onClick={() => openWork(w.id)}
              className="group rounded-2xl p-5 sm:p-6 flex items-start gap-4 transition-all duration-300 hover:scale-[1.01] text-left w-full"
              style={{
                backgroundColor: c.bgCard,
                border: "1px solid " + c.bgCardBorder,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: c.accentDim }}
              >
                <Music className="w-5 h-5" style={{ color: "#818cf8" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  className="font-bold text-base sm:text-lg leading-tight mb-1"
                  style={{ color: c.textPrimary }}
                >
                  {w.title}
                </h2>
                <p
                  className="text-xs sm:text-sm leading-relaxed"
                  style={{
                    color: c.textSecondary,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {w.description}
                </p>
                <span
                  className="inline-block mt-2 text-xs font-medium px-2.5 py-1 rounded-lg"
                  style={{
                    backgroundColor: c.accentDim,
                    color: "#818cf8",
                  }}
                >
                  {w.episodes} episodes
                </span>
              </div>
              <ChevronRight
                className="w-5 h-5 shrink-0 mt-1 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: c.textSecondary }}
              />
            </button>
          ))}
        </div>

        {worksList.length === 0 && (
          <div className="text-center py-20">
            <p style={{ color: c.textSecondary }}>
              No works yet. Add a JSON file to public/data/works
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
