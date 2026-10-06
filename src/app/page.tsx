"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Music, Headphones, ChevronRight, ArrowLeft, Sun, Moon, X } from "lucide-react";
import { TrackPlayer } from "@/components/track-player";
import type { TrackPlayerHandle } from "@/components/track-player";
import { TrackList } from "@/components/track-list";
import { TranscriptPanel } from "@/components/transcript-panel";
import { useColors } from "@/lib/colors";
import worksData from "../../public/data/index.json";
import type { TrackItem, WorkItem } from "@/lib/types";

export default function Home() {
  const [view, setView] = useState<"library" | "work">("library");
  const [activeWork, setActiveWork] = useState<string>("");
  const [worksList, setWorksList] = useState<WorkItem[]>([]);
  const [workMeta, setWorkMeta] = useState<WorkItem | null>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string>("");
  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);
  const [stickyH, setStickyH] = useState(0);

  const playerHandleRef = useRef<TrackPlayerHandle | null>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const durRef = useRef(0);
  durRef.current = dur;

  const c = useColors();

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedId) || null,
    [tracks, selectedId]
  );

  const lines = useMemo(() => {
    const t = selectedTrack?.text;
    if (!t) return [];
    return t.split("\n").filter((l) => l.trim().length > 0);
  }, [selectedTrack?.text]);

  const hasText = lines.length > 0;

  useEffect(() => {
    const wl = worksData as WorkItem[];
    setWorksList(wl);

    const hash = window.location.hash;
    if (hash.startsWith("#/")) {
      const id = hash.slice(2).replace(/\/$/, "");
      if (id) openWork(id, wl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep sticky header+player height measured for the sidebar offset
  useEffect(() => {
    const el = stickyRef.current;
    if (!el || view !== "work") return;
    const upd = () => setStickyH(el.offsetHeight);
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, loading, hasText, showTranscript]);

  // Lock body scroll when mobile transcript sheet is open
  useEffect(() => {
    if (!showTranscript || view !== "work") return;
    if (window.innerWidth >= 1024) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showTranscript, view]);

  const openWork = useCallback(
    (id: string, wl?: WorkItem[]) => {
      const list = wl || worksList;
      const meta = list.find((w) => w.id === id);
      if (!meta) return;

      setView("work");
      setActiveWork(id);
      setWorkMeta(meta);
      setLoading(true);
      setSelectedId("");
      setPlaying(false);
      setCurTime(0);
      setDur(0);
      setShowTranscript(false);
      setPlayNonce(0);
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
    },
    [worksList]
  );

  const goBack = useCallback(() => {
    playerHandleRef.current = null;
    setView("library");
    setActiveWork("");
    setTracks([]);
    setWorkMeta(null);
    setSelectedId("");
    setPlaying(false);
    setCurTime(0);
    setDur(0);
    setShowTranscript(false);
    setPlayNonce(0);
    window.location.hash = "";
    window.scrollTo(0, 0);
  }, []);

  // Auto-select first track when the list loads
  useEffect(() => {
    if (!loading && tracks.length > 0 && !selectedId) {
      setSelectedId(tracks[0].id);
    }
  }, [loading, tracks, selectedId]);

  const selectTrack = useCallback((track: TrackItem) => {
    setSelectedId(track.id);
    setPlayNonce((n) => n + 1);
  }, []);

  const handlePlayingChange = useCallback((p: boolean) => {
    setPlaying(p);
  }, []);

  const handleProgress = useCallback((cur: number, d: number) => {
    setCurTime(cur);
    setDur(d);
  }, []);

  const toggleTranscript = useCallback(() => {
    setShowTranscript((s) => !s);
  }, []);

  const handleSeekLine = useCallback((index: number, total: number) => {
    const d = durRef.current;
    if (!d || total <= 0) return;
    playerHandleRef.current?.seek((index / total) * d);
    playerHandleRef.current?.play();
  }, []);

  // Space — play/pause current track
  useEffect(() => {
    if (view !== "work") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest("button, input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      playerHandleRef.current?.toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  const ThemeToggle = () => (
    <button
      onClick={c.toggle}
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:opacity-80"
      style={{ backgroundColor: c.chrome }}
      aria-label="Toggle theme"
    >
      {c.isDark ? (
        <Sun className="w-4 h-4" style={{ color: c.text }} />
      ) : (
        <Moon className="w-4 h-4" style={{ color: c.text }} />
      )}
    </button>
  );

  // Work player view
  if (view === "work") {
    return (
      <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: c.bg }}>
        <div ref={stickyRef} className="sticky top-0 z-20" style={{ backgroundColor: c.surface }}>
          <header className="border-b" style={{ borderColor: c.border }}>
            <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex items-center gap-2">
              <button
                onClick={goBack}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:opacity-80"
                style={{ backgroundColor: c.chrome }}
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" style={{ color: c.text }} />
              </button>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: c.accent }}
              >
                <Music className="w-4 h-4" style={{ color: c.icon }} />
              </div>
              <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: c.text }}>
                {workMeta?.title || activeWork}
              </h1>
              <span className="text-xs ml-auto mr-2 shrink-0" style={{ color: c.textSoft }}>
                {tracks.length} episodes
              </span>
              <ThemeToggle />
            </div>
          </header>

          {selectedTrack && (
            <div style={{ borderBottom: "1px solid " + c.border }}>
              <TrackPlayer
                src={selectedTrack.yandexUrl || selectedTrack.localUrl || `audio/${selectedTrack.id}.mp3`}
                title={selectedTrack.title}
                hasText={hasText}
                textOpen={showTranscript}
                onToggleText={toggleTranscript}
                onPlayingChange={handlePlayingChange}
                onProgress={handleProgress}
                handleRef={playerHandleRef}
                playNonce={playNonce}
              />
            </div>
          )}
        </div>

        <main className="max-w-6xl mx-auto px-0 sm:px-6 py-4 sm:py-6">
          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0">
              <div className="px-3 sm:px-4 mb-2 flex items-baseline justify-between">
                <h3
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: c.textSoft }}
                >
                  Tracks
                </h3>
                <span className="text-xs" style={{ color: c.textSoft }}>
                  {tracks.length}
                </span>
              </div>

              <div
                className="overflow-hidden sm:rounded-2xl"
                style={{ backgroundColor: c.surface, border: "1px solid " + c.border }}
              >
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div
                      className="w-6 h-6 border-2 rounded-full animate-spin"
                      style={{ borderColor: c.chrome, borderTopColor: c.accent }}
                    />
                  </div>
                ) : tracks.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <p className="text-sm" style={{ color: c.textSoft }}>
                      No tracks found
                    </p>
                  </div>
                ) : (
                  <TrackList
                    tracks={tracks}
                    selectedId={selectedId}
                    playing={playing}
                    loading={loading}
                    onSelect={selectTrack}
                  />
                )}
              </div>
            </div>

            {/* Desktop transcript sidebar */}
            <aside
              className="hidden lg:block w-[340px] xl:w-[380px] shrink-0 sticky"
              style={{
                top: stickyH + 16,
                maxHeight: `calc(100vh - ${stickyH + 32}px)`,
              }}
            >
              {showTranscript && selectedTrack ? (
                <div
                  className="flex flex-col rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: c.surface,
                    border: "1px solid " + c.border,
                    maxHeight: `calc(100vh - ${stickyH + 32}px)`,
                  }}
                >
                  <div
                    className="flex items-center justify-between gap-2 px-4 py-3 border-b shrink-0"
                    style={{ borderColor: c.border }}
                  >
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate" style={{ color: c.text }}>
                        Text
                      </h3>
                      <p className="text-xs truncate" style={{ color: c.textSoft }}>
                        {selectedTrack.title}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowTranscript(false)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:opacity-80"
                      style={{ backgroundColor: c.chrome }}
                      aria-label="Close text panel"
                    >
                      <X className="w-4 h-4" style={{ color: c.text }} />
                    </button>
                  </div>
                  <div
                    className="flex-1 overflow-y-auto p-3"
                    style={{ minHeight: "200px", scrollbarWidth: "thin" }}
                  >
                    <TranscriptPanel
                      lines={lines}
                      roles={workMeta?.roles}
                      curTime={curTime}
                      dur={dur}
                      onSeekLine={handleSeekLine}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowTranscript(true)}
                  disabled={!hasText}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: c.surface,
                    border: "1px solid " + c.border,
                    color: c.textSoft,
                  }}
                >
                  Open text
                </button>
              )}
            </aside>
          </div>
        </main>

        {/* Mobile transcript sheet */}
        {showTranscript && selectedTrack && (
          <>
            <div
              className="fixed inset-0 z-40 lg:hidden"
              style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
              onClick={() => setShowTranscript(false)}
              aria-hidden
            />
            <div
              className="fixed inset-x-0 bottom-0 z-50 lg:hidden flex flex-col rounded-t-2xl animate-sheet"
              style={{
                backgroundColor: c.surface,
                maxHeight: "75vh",
                borderTop: "1px solid " + c.border,
              }}
              role="dialog"
              aria-label="Track text"
            >
              <div
                className="relative flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b shrink-0"
                style={{ borderColor: c.border }}
              >
                <div
                  className="absolute left-1/2 -translate-x-1/2 top-1.5 w-8 h-1 rounded-full"
                  style={{ backgroundColor: c.chrome }}
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate" style={{ color: c.text }}>
                    Text
                  </h3>
                  <p className="text-xs truncate" style={{ color: c.textSoft }}>
                    {selectedTrack.title}
                  </p>
                </div>
                <button
                  onClick={() => setShowTranscript(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: c.chrome }}
                  aria-label="Close text panel"
                >
                  <X className="w-4 h-4" style={{ color: c.text }} />
                </button>
              </div>
              <div
                className="flex-1 overflow-y-auto p-3"
                style={{ overscrollBehavior: "contain", scrollbarWidth: "thin" }}
              >
                <TranscriptPanel
                  lines={lines}
                  roles={workMeta?.roles}
                  curTime={curTime}
                  dur={dur}
                  onSeekLine={handleSeekLine}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Library view
  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: c.bg }}>
      <header
        className="sticky top-0 z-10 backdrop-blur-xl border-b"
        style={{ backgroundColor: c.surface, borderColor: c.border }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-3 flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: c.accent }}
          >
            <Headphones className="w-4 h-4" style={{ color: c.icon }} />
          </div>
          <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: c.text }}>
            Audio Library
          </h1>
          <span className="text-xs ml-auto mr-2" style={{ color: c.textSoft }}>
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
                backgroundColor: c.surface,
                border: "1px solid " + c.border,
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: c.accentSoft }}
              >
                <Music className="w-5 h-5" style={{ color: c.accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  className="font-bold text-base sm:text-lg leading-tight mb-1"
                  style={{ color: c.text }}
                >
                  {w.title}
                </h2>
                <p
                  className="text-xs sm:text-sm leading-relaxed"
                  style={{
                    color: c.textSoft,
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
                    backgroundColor: c.accentSoft,
                    color: c.accent,
                  }}
                >
                  {w.episodes} episodes
                </span>
              </div>
              <ChevronRight
                className="w-5 h-5 shrink-0 mt-1 transition-transform duration-200 group-hover:translate-x-1"
                style={{ color: c.textSoft }}
              />
            </button>
          ))}
        </div>

        {worksList.length === 0 && (
          <div className="text-center py-20">
            <p style={{ color: c.textSoft }}>
              No works yet. Add a JSON file to public/data/works
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
