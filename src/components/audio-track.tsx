"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import WaveSurfer from "wavesurfer.js";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useColors } from "@/lib/colors";

interface AudioTrackProps {
  src: string;
  title: string;
  text?: string;
  activeTrackId: string;
  onPlay: (id: string) => void;
  onStop: () => void;
  roles?: Record<string, string | undefined>;
}

const SPEED_OPTIONS = [0.5, 0.75, 1];
const SPEED_LABELS: Record<number, string> = { 0.5: "0.5x", 0.75: "0.75x", 1: "1x" };

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + s.toString().padStart(2, "0");
}

// Singleton — only one track can play at a time
let currentPlayingId: string | null = null;
let onStopCallback: (() => void) | null = null;

export function stopCurrentTrack() {
  if (onStopCallback) onStopCallback();
}

export function AudioTrack({ src, title, text, activeTrackId, onPlay, onStop, roles }: AudioTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showText, setShowText] = useState(false);
  const [textMaxH, setTextMaxH] = useState(400);

  const isActive = activeTrackId === title;
  const c = useColors();

  // Create WaveSurfer instance
  useEffect(() => {
    if (!containerRef.current || !src) return;

    if (wsRef.current) { wsRef.current.destroy(); wsRef.current = null; }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 36,
      waveColor: c.textSoft,
      progressColor: c.accent,
      cursorWidth: 0,
      barWidth: 4,
      barGap: 1,
      barRadius: 4,
      normalize: true,
      fillParent: true,
      hideScrollbar: true,
    });

    ws.on("loading", () => setLoading(true));
    ws.on("ready", () => {
      setLoading(false);
      setDur(ws.getDuration());
    });
    ws.on("timeupdate", (t) => setCurTime(t));
    ws.on("play", () => setPlaying(true));
    ws.on("pause", () => setPlaying(false));
    ws.on("finish", () => {
      setPlaying(false);
      setCurTime(0);
      onStop();
    });
    ws.on("error", () => {
      setLoading(false);
      setError(true);
    });

    ws.load(src);

    wsRef.current = ws;

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Update waveform colors on theme change
  useEffect(() => {
    if (!wsRef.current) return;
    wsRef.current.setOptions({
      waveColor: c.textSoft,
    });
  }, [c.textSoft]);

  // Register stop callback (singleton)
  useEffect(() => {
    if (playing) {
      currentPlayingId = title;
      onStopCallback = () => { wsRef.current?.pause(); };
    }
    return () => {
      if (currentPlayingId === title) {
        currentPlayingId = null;
        onStopCallback = null;
      }
    };
  }, [playing, title]);

  // Stop when another track plays
  useEffect(() => {
    if (activeTrackId && activeTrackId !== title && playing && wsRef.current) {
      wsRef.current.pause();
    }
  }, [activeTrackId, title, playing]);

  const handlePlayToggle = useCallback(() => {
    if (!wsRef.current || loading || error) return;
    if (playing) {
      wsRef.current.pause();
      onStop();
    } else {
      onPlay(title);
      wsRef.current.play();
    }
  }, [playing, loading, error, title, onPlay, onStop]);

  const chSpeed = useCallback((s: number) => {
    if (!wsRef.current) return;
    wsRef.current.setPlaybackRate(s);
    setSpeed(s);
  }, []);

  useEffect(() => {
    if (!showText || !toggleRef.current) { return; }
    const upd = () => {
      if (!toggleRef.current) return;
      const r = toggleRef.current.getBoundingClientRect();
      const avail = window.innerHeight - r.top - 12;
      setTextMaxH(Math.max(200, avail));
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, [showText]);

  const lines = useMemo(() => {
    if (!text) return [];
    return text.split("\n").filter((l) => l.trim().length > 0);
  }, [text]);

  const hasText = lines.length > 0;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: isActive ? c.bg : c.surface,
        border: "1px solid " + c.border,
        boxShadow: isActive ? "0 0 0 1px " + c.accentMuted + "15, 0 4px 20px " + c.accentMuted + "10" : undefined,
      }}
    >
      {/* Title row */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-1.5">
        {/* Play/Pause button */}
        <button
          onClick={handlePlayToggle}
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: playing ? c.accent : c.chrome,
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: playing ? c.chrome : c.textMuted, borderTopColor: c.accent }} />
          ) : playing ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="2" width="5" height="16" rx="1.5" fill={c.icon} />
              <rect x="12" y="2" width="5" height="16" rx="1.5" fill={c.icon} />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M5 2.5L19 11L5 19.5V2.5Z" fill={c.isDark ? c.text : c.accent} />
            </svg>
          )}
        </button>
        <h3 className="flex-1 font-semibold text-sm sm:text-base truncate leading-tight" style={{ color: c.text }}>
          {title}
        </h3>
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {SPEED_OPTIONS.map((sp) => (
              <span
                key={sp}
                onClick={() => { chSpeed(sp); }}
                className="px-2 py-0.5 text-[10px] font-semibold rounded-md cursor-pointer transition-all duration-150"
                style={
                  speed === sp
                    ? { backgroundColor: c.accent, color: c.icon, boxShadow: "0 1px 6px " + c.accentMuted }
                    : { backgroundColor: c.bg, color: c.textSoft }
                }
              >
                {SPEED_LABELS[sp]}
              </span>
            ))}
          </div>
          <div className="sm:hidden shrink-0">
            <span
              onClick={() => {
                const idx = SPEED_OPTIONS.indexOf(speed);
                chSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length]);
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer"
              style={{ backgroundColor: c.accent, color: c.icon }}
            >
              {SPEED_LABELS[speed]}
            </span>
          </div>
        </div>

      {/* Waveform — rendered on canvas by wavesurfer.js */}
      <div
        ref={containerRef}
        className="mx-4 my-1.5 overflow-hidden cursor-pointer rounded-lg"
        style={{ height: "36px" }}
      />

      {/* Time */}
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-xs tabular-nums font-medium" style={{ color: c.textSoft }}>
          {formatTime(curTime)}
        </span>
        <span className="text-xs tabular-nums font-medium" style={{ color: c.textSoft }}>
          {formatTime(dur)}
        </span>
      </div>

      {error && (
        <div className="px-4 pb-2.5">
          <p className="text-xs rounded-lg px-3 py-2" style={{ color: c.error, backgroundColor: c.errorSoft }}>
            Not able to load audio
          </p>
        </div>
      )}

      {/* Transcript */}
      {hasText && (
        <div style={{ borderTop: "1px solid " + c.border }}>
          <button
            ref={toggleRef}
            onClick={() => setShowText(!showText)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: showText ? c.accent : c.textSoft, backgroundColor: showText ? c.accentSoft : c.bg }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{showText ? "Hide text" : "Show text"}</span>
            {showText ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showText && (
            <div
              className="px-4 pt-4 pb-4 overflow-y-auto"
              style={{ maxHeight: textMaxH + "px", scrollbarWidth: "thin", scrollbarColor: c.accentMuted + " " + c.bg }}
            >
              <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.bg, border: "1px solid " + c.border }}>
                {lines.map((line, i) => {
                  const ci = line.indexOf(":");
                  const isDlg = ci > 0 && ci < 30;
                  const cn = isDlg ? line.slice(0, ci).trim() : null;
                  const dt = isDlg ? line.slice(ci + 1).trim() : line.trim();
                  let cc = c.textSoft;
                  if (cn && roles) {
                    cc = roles[cn] ?? c.textSoft;
                  }
                  return (
                    <p key={i} className="text-xs sm:text-sm leading-relaxed" style={{ marginBottom: i < lines.length - 1 ? "8px" : "0", color: c.textMuted }}>
                      {isDlg ? (
                        <>
                          <span className="font-semibold" style={{ color: cc }}>{cn}:</span>
                          {" "}
                          <span>{dt}</span>
                        </>
                      ) : (
                        <span className="italic" style={{ color: c.textSoft }}>{dt}</span>
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}