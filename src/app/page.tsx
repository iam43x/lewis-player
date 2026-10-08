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

// Keep a visible strip of backdrop above the mobile sheet so the close
// button and tap-to-dismiss always stay on screen. Mobile browsers (iOS
// Safari and all WebKit wrappers) report `vh` from the *large* viewport,
// which is taller than the visible area while the URL bar is expanded.
const SHEET_TOP_GAP = 56;

function sheetMaxHeight(): string {
  if (typeof window === "undefined") return `calc(100svh - ${SHEET_TOP_GAP}px)`;
  const vv = window.visualViewport;
  const h = vv ? vv.height : window.innerHeight;
  return `${Math.max(240, Math.round(h - SHEET_TOP_GAP))}px`;
}

// Sheet drag-to-close: movement past DRAG_CAPTURE_PX starts a drag, and a
// release past DRAG_CLOSE_PX (or a quick downward flick) closes the sheet.
const DRAG_CAPTURE_PX = 8;
const DRAG_CLOSE_PX = 80;
const DRAG_FLICK_PX = 30;
const DRAG_FLICK_VEL = 0.4; // px per ms

function ThemeToggle() {
  const c = useColors();
  return (
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
}

export default function Home() {
  const [view, setView] = useState<"library" | "work">("library");
  const [activeWork, setActiveWork] = useState<string>("");
  const [worksList, setWorksList] = useState<WorkItem[]>([]);
  const [workMeta, setWorkMeta] = useState<WorkItem | null>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string>("");
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [closingTranscript, setClosingTranscript] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);
  const [stickyH, setStickyH] = useState(0);
  const [sheetMaxH, setSheetMaxH] = useState<string>(sheetMaxHeight);

  const playerHandleRef = useRef<TrackPlayerHandle | null>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    captured: false,
    startY: 0,
    startDy: 0,
    delta: 0,
    lastY: 0,
    lastT: 0,
    vel: 0,
  });
  const springTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragListenersRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);
  const durRef = useRef(0);
  durRef.current = dur;

  const cancelTranscriptClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setClosingTranscript(false);
  }, []);

  const startSheetClose = useCallback(
    (animateSheet: boolean) => {
      if (closeTimerRef.current || !showTranscript) return;
      const el = sheetRef.current;
      if (el && animateSheet) {
        el.style.animation = "sheet-down 0.28s cubic-bezier(0.4, 0, 1, 1) forwards";
      }
      setClosingTranscript(true);
      closeTimerRef.current = setTimeout(() => {
        setShowTranscript(false);
        setClosingTranscript(false);
        closeTimerRef.current = null;
      }, 250);
    },
    [showTranscript]
  );

  const closeTranscript = useCallback(() => startSheetClose(true), [startSheetClose]);

  const onSheetPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (closeTimerRef.current || dragRef.current.active) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = sheetRef.current;
      if (!el) return;

      const startY = e.clientY;
      const d = dragRef.current;
      d.active = true;
      d.captured = false;
      d.startY = startY;
      d.startDy = 0;
      d.delta = 0;
      d.lastY = startY;
      d.lastT = performance.now();
      d.vel = 0;
      suppressClickRef.current = false;

      if (springTimerRef.current) {
        clearTimeout(springTimerRef.current);
        springTimerRef.current = null;
      }

      // Styles are only touched once the pointer actually moves past the
      // capture distance, so a plain tap on the close button still clicks.
      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current.active) return;
        const rawDelta = ev.clientY - d.startY;
        if (!d.captured) {
          if (Math.abs(rawDelta) <= DRAG_CAPTURE_PX) return;
          // Rebase on the live position in case a spring-back was running.
          const cs = window.getComputedStyle(el);
          let baseDy = 0;
          if (cs.transform && cs.transform !== "none") {
            try {
              baseDy = new DOMMatrixReadOnly(cs.transform).m42;
            } catch {
              baseDy = 0;
            }
          }
          el.style.transition = "none";
          el.style.animation = "none";
          el.style.transform = `translateY(${baseDy}px)`;
          el.style.opacity = cs.opacity;
          el.style.willChange = "transform";
          d.captured = true;
          d.startDy = baseDy;
          d.startY = ev.clientY;
          d.delta = 0;
          d.lastY = ev.clientY;
          d.lastT = performance.now();
          d.vel = 0;
          return;
        }
        let dy = d.startDy + (ev.clientY - d.startY);
        if (dy < 0) dy = Math.max(dy * 0.2, -40);
        d.delta = ev.clientY - d.startY;
        const now = performance.now();
        const dt = now - d.lastT;
        if (dt >= 16) {
          d.vel = (ev.clientY - d.lastY) / dt;
          d.lastY = ev.clientY;
          d.lastT = now;
        }
        el.style.transform = `translateY(${dy}px)`;
        el.style.opacity = String(Math.min(1, Math.max(0.5, 1 - dy / 300)));
      };

      const finish = () => {
        if (dragListenersRef.current) {
          dragListenersRef.current();
          dragListenersRef.current = null;
        }
        if (!dragRef.current.active) return;
        dragRef.current.active = false;
        if (!d.captured || sheetRef.current !== el) return;

        // Swallow the click that browsers still fire after a small drag that
        // started on a button (e.g. the close X).
        suppressClickRef.current = true;

        const delta = d.delta;
        const vel = d.vel;
        if (delta > DRAG_CLOSE_PX || (delta > DRAG_FLICK_PX && vel > DRAG_FLICK_VEL)) {
          el.style.transition = "transform 220ms cubic-bezier(0.4, 0, 1, 1), opacity 220ms linear";
          el.style.transform = "translateY(100%)";
          el.style.opacity = "0.5";
          startSheetClose(false);
        } else {
          el.style.transition = "transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms";
          el.style.transform = "translateY(0)";
          el.style.opacity = "1";
          springTimerRef.current = setTimeout(() => {
            springTimerRef.current = null;
            if (sheetRef.current !== el || dragRef.current.active || closeTimerRef.current) return;
            el.style.transition = "";
            el.style.transform = "";
            el.style.opacity = "";
            // Keep animation suppressed: re-enabling the mount class would
            // replay sheet-up from the top.
            el.style.animation = "none";
            el.style.willChange = "";
          }, 300);
        }
      };

      const detach = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };
      dragListenersRef.current = detach;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [startSheetClose]
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (springTimerRef.current) clearTimeout(springTimerRef.current);
      if (dragListenersRef.current) dragListenersRef.current();
    };
  }, []);

  // Reset drag machinery when the sheet unmounts (e.g. via goBack)
  useEffect(() => {
    if (showTranscript) return;
    if (springTimerRef.current) {
      clearTimeout(springTimerRef.current);
      springTimerRef.current = null;
    }
    if (dragListenersRef.current) {
      dragListenersRef.current();
      dragListenersRef.current = null;
    }
    dragRef.current.active = false;
  }, [showTranscript]);

  const c = useColors();

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.id === selectedId) || null,
    [tracks, selectedId]
  );

  const hasText = useMemo(() => {
    const t = selectedTrack?.text;
    return Array.isArray(t) && t.length > 0;
  }, [selectedTrack?.text]);

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

  // Keep the mobile sheet inside the *visible* viewport: browser chrome
  // (URL bar) shrinks the visual viewport, so re-measure while it's open.
  useEffect(() => {
    if (!showTranscript) return;
    const upd = () => setSheetMaxH(sheetMaxHeight());
    upd();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", upd);
    vv?.addEventListener("scroll", upd);
    window.addEventListener("resize", upd);
    return () => {
      vv?.removeEventListener("resize", upd);
      vv?.removeEventListener("scroll", upd);
      window.removeEventListener("resize", upd);
    };
  }, [showTranscript]);

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
      setCurTime(0);
      setDur(0);
      cancelTranscriptClose();
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
    [worksList, cancelTranscriptClose]
  );

  const goBack = useCallback(() => {
    playerHandleRef.current = null;
    setView("library");
    setActiveWork("");
    setTracks([]);
    setWorkMeta(null);
    setSelectedId("");
    setCurTime(0);
    setDur(0);
    cancelTranscriptClose();
    setShowTranscript(false);
    setPlayNonce(0);
    window.location.hash = "";
    window.scrollTo(0, 0);
  }, [cancelTranscriptClose]);

  // Auto-select first track when the list loads
  useEffect(() => {
    if (!loading && tracks.length > 0 && !selectedId) {
      setSelectedId(tracks[0].id);
    }
  }, [loading, tracks, selectedId]);

  const selectTrack = useCallback((track: TrackItem) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    setSelectedId(track.id);
    setPlayNonce((n) => n + 1);
  }, []);

  const handleProgress = useCallback((cur: number, d: number) => {
    setCurTime(cur);
    setDur(d);
  }, []);

  const toggleTranscript = useCallback(() => {
    if (closeTimerRef.current) {
      cancelTranscriptClose();
      return;
    }
    if (showTranscript) closeTranscript();
    else {
      setSheetMaxH(sheetMaxHeight());
      setShowTranscript(true);
    }
  }, [showTranscript, closeTranscript, cancelTranscriptClose]);

  const handleSeekMs = useCallback((ms: number) => {
    playerHandleRef.current?.seek(Math.max(0, ms) / 1000);
    playerHandleRef.current?.play();
  }, []);

  // Auto-advance to the next track when the current one finishes
  const handleTrackFinish = useCallback(() => {
    const idx = tracks.findIndex((t) => t.id === selectedId);
    if (idx === -1 || idx >= tracks.length - 1) return;
    const next = tracks[idx + 1];
    setSelectedId(next.id);
    setPlayNonce((n) => n + 1);
  }, [tracks, selectedId]);

  // Space — play/pause; ←/→ — seek ±5s
  useEffect(() => {
    if (view !== "work") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);

      if (e.code === "Space") {
        if (typing || t?.closest("button, [role='button']")) return;
        e.preventDefault();
        playerHandleRef.current?.toggle();
        return;
      }

      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        if (typing) return;
        e.preventDefault();
        playerHandleRef.current?.skip(e.code === "ArrowLeft" ? -5 : 5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  // Work player view
  if (view === "work") {
    return (
      <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: c.bg }}>
        <div ref={stickyRef} className="sticky top-0 z-20" style={{ backgroundColor: c.bg }}>
          <header>
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
            <div className="max-w-6xl mx-auto px-3 sm:px-6 pb-3">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: c.surface,
                  border: "1px solid " + c.border,
                }}
              >
                <TrackPlayer
                  src={selectedTrack.localUrl || `audio/${selectedTrack.id}.mp3`}
                  title={selectedTrack.title}
                  startMs={selectedTrack.start}
                  hasText={hasText}
                  textOpen={showTranscript}
                  onToggleText={toggleTranscript}
                  onProgress={handleProgress}
                  onFinish={handleTrackFinish}
                  handleRef={playerHandleRef}
                  playNonce={playNonce}
                />
              </div>
            </div>
          )}
        </div>

        <main className="max-w-6xl mx-auto px-0 sm:px-6 py-4 sm:py-6">
          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0">
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
                    onSelect={selectTrack}
                  />
                )}
              </div>
            </div>

            {/* Desktop transcript sidebar — appears when Text is pressed, list shifts left */}
            {showTranscript && selectedTrack && (
              <aside
                className={
                  "hidden lg:block w-[640px] xl:w-[760px] shrink-0 sticky " +
                  (closingTranscript ? "animate-sidebar-out" : "animate-sidebar-in")
                }
                style={{
                  top: stickyH + 16,
                  maxHeight: `calc(100vh - ${stickyH + 32}px)`,
                }}
              >
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
                      onClick={closeTranscript}
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
                      text={selectedTrack?.text}
                      roles={workMeta?.roles}
                      curTime={curTime}
                      dur={dur}
                      onSeekMs={handleSeekMs}
                    />
                  </div>
                </div>
              </aside>
            )}
          </div>
        </main>

        {/* Mobile transcript sheet */}
        {showTranscript && selectedTrack && (
          <>
            <div
              className="fixed inset-0 z-40 lg:hidden"
              style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
              onClick={closeTranscript}
              aria-hidden
            />
            <div
              ref={sheetRef}
              className={
                "fixed inset-x-0 bottom-0 z-50 lg:hidden flex flex-col rounded-t-2xl " +
                (closingTranscript ? "animate-sheet-out" : "animate-sheet")
              }
              style={{
                backgroundColor: c.surface,
                maxHeight: sheetMaxH,
                borderTop: "1px solid " + c.border,
              }}
              role="dialog"
              aria-label="Track text"
            >
              <div
                onPointerDown={onSheetPointerDown}
                onClickCapture={(e) => {
                  if (suppressClickRef.current) e.stopPropagation();
                }}
                className="relative flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                style={{
                  borderColor: c.border,
                  paddingLeft: "max(1rem, env(safe-area-inset-left))",
                  paddingRight: "max(1rem, env(safe-area-inset-right))",
                }}
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
                  onClick={closeTranscript}
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
                  text={selectedTrack?.text}
                  roles={workMeta?.roles}
                  curTime={curTime}
                  dur={dur}
                  onSeekMs={handleSeekMs}
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
