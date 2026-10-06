"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import { BookOpen } from "lucide-react";
import { useColors } from "@/lib/colors";

const SPEED_OPTIONS = [0.5, 0.75, 1];
const SPEED_LABELS: Record<number, string> = { 0.5: "0.5x", 0.75: "0.75x", 1: "1x" };

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + s.toString().padStart(2, "0");
}

export interface TrackPlayerHandle {
  toggle: () => void;
  play: () => void;
  seek: (seconds: number) => void;
}

interface TrackPlayerProps {
  src: string;
  title: string;
  hasText: boolean;
  textOpen: boolean;
  onToggleText: () => void;
  onPlayingChange: (playing: boolean) => void;
  onProgress: (cur: number, dur: number) => void;
  handleRef: React.RefObject<TrackPlayerHandle | null>;
  playNonce: number;
}

export function TrackPlayer({
  src,
  title,
  hasText,
  textOpen,
  onToggleText,
  onPlayingChange,
  onProgress,
  handleRef,
  playNonce,
}: TrackPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const wantPlayRef = useRef(false);
  const readyRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [speed, setSpeed] = useState(1);

  const c = useColors();

  const onPlayingChangeRef = useRef(onPlayingChange);
  onPlayingChangeRef.current = onPlayingChange;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    if (!containerRef.current || !src) return;

    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }
    readyRef.current = false;
    setLoading(true);
    setError(false);
    setCurTime(0);
    setDur(0);
    setPlaying(false);
    onPlayingChangeRef.current(false);
    onProgressRef.current(0, 0);

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 48,
      waveColor: c.textSoft,
      progressColor: c.accent,
      cursorWidth: 0,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      barAlign: "bottom",
      normalize: true,
      fillParent: true,
      hideScrollbar: true,
    });

    ws.on("loading", () => setLoading(true));
    ws.on("ready", () => {
      setLoading(false);
      readyRef.current = true;
      const d = ws.getDuration();
      setDur(d);
      onProgressRef.current(ws.getCurrentTime(), d);
      if (wantPlayRef.current) {
        wantPlayRef.current = false;
        ws.play().catch(() => {});
      }
    });
    ws.on("timeupdate", (t) => {
      setCurTime(t);
      onProgressRef.current(t, ws.getDuration());
    });
    ws.on("play", () => {
      setPlaying(true);
      onPlayingChangeRef.current(true);
    });
    ws.on("pause", () => {
      setPlaying(false);
      onPlayingChangeRef.current(false);
    });
    ws.on("finish", () => {
      setPlaying(false);
      setCurTime(0);
      onPlayingChangeRef.current(false);
      onProgressRef.current(0, ws.getDuration());
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
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    if (!wsRef.current) return;
    wsRef.current.setOptions({
      waveColor: c.textSoft,
      progressColor: c.accent,
    });
  }, [c.textSoft, c.accent]);

  useEffect(() => {
    if (playNonce === 0) return;
    wantPlayRef.current = true;
    if (readyRef.current && wsRef.current && !wsRef.current.isPlaying()) {
      wantPlayRef.current = false;
      wsRef.current.play().catch(() => {});
    }
  }, [playNonce]);

  const toggle = useCallback(() => {
    if (!wsRef.current || loading || error) return;
    if (wsRef.current.isPlaying()) {
      wsRef.current.pause();
    } else {
      wantPlayRef.current = false;
      wsRef.current.play().catch(() => {});
    }
  }, [loading, error]);

  const play = useCallback(() => {
    if (!wsRef.current || loading || error) return;
    if (!wsRef.current.isPlaying()) {
      wantPlayRef.current = false;
      wsRef.current.play().catch(() => {});
    }
  }, [loading, error]);

  const seek = useCallback((t: number) => {
    if (!wsRef.current || !readyRef.current) return;
    wsRef.current.setTime(Math.max(0, t));
  }, []);

  useEffect(() => {
    handleRef.current = { toggle, play, seek };
    return () => {
      handleRef.current = null;
    };
  }, [toggle, play, seek, handleRef]);

  const chSpeed = useCallback((s: number) => {
    if (!wsRef.current) return;
    wsRef.current.setPlaybackRate(s);
    setSpeed(s);
  }, []);

  return (
    <div className="p-3.5 sm:p-4">
      <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ backgroundColor: playing ? c.accent : c.chrome }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {loading ? (
              <div
                className="w-5 h-5 border-2 rounded-full animate-spin"
                style={{ borderColor: playing ? c.chrome : c.textMuted, borderTopColor: c.accent }}
              />
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

          <h2
            className="flex-1 min-w-0 font-semibold text-sm sm:text-base truncate leading-tight"
            style={{ color: c.text }}
          >
            {title}
          </h2>

          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {SPEED_OPTIONS.map((sp) => (
              <span
                key={sp}
                onClick={() => chSpeed(sp)}
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

          {hasText && (
            <button
              onClick={onToggleText}
              className="h-8 px-2.5 rounded-lg flex items-center justify-center gap-1.5 shrink-0 transition-colors"
              style={{
                backgroundColor: textOpen ? c.accent : c.bg,
                color: textOpen ? c.icon : c.textSoft,
              }}
              aria-label={textOpen ? "Hide text" : "Show text"}
              aria-pressed={textOpen}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-xs font-semibold">Text</span>
            </button>
          )}
        </div>

        <div
          ref={containerRef}
          className="mt-2 overflow-hidden cursor-pointer rounded-lg"
          style={{ height: "48px" }}
        />

        <div className="flex items-center justify-between mt-1">
          <span className="text-xs tabular-nums font-medium" style={{ color: c.textSoft }}>
            {formatTime(curTime)}
          </span>
          <span className="text-xs tabular-nums font-medium" style={{ color: c.textSoft }}>
            {formatTime(dur)}
          </span>
        </div>

        {error && (
          <p className="mt-2 text-xs rounded-lg px-3 py-2" style={{ color: c.error, backgroundColor: c.errorSoft }}>
            Not able to load audio
          </p>
        )}
    </div>
  );
}
