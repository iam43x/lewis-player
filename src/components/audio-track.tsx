"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";
import Hls from "hls.js";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

interface AudioTrackProps {
  src: string;
  title: string;
  isHls?: boolean;
  text?: string;
  activeTrackId: string;
  onPlay: (id: string) => void;
  onStop: () => void;
}

const NUM_BARS = 150;
const SPEED_OPTIONS = [0.5, 0.75, 1];
const SPEED_LABELS: Record<number, string> = { 0.5: "0.5x", 0.75: "0.75x", 1: "1x" };

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + s.toString().padStart(2, "0");
}

// Shared theme state via module-level store + useSyncExternalStore
const THEME_EVENT = "theme-change";

function getThemeSnapshot(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as "dark" | "light") || "dark";
}

function getServerSnapshot(): "dark" | "light" {
  return "dark";
}

function subscribeToTheme(callback: () => void): () => void {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

// Theme-dependent color tokens
function useColors() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    document.body.style.backgroundColor = theme === "dark" ? "#0a0a12" : "#f8fafc";
  }, [theme]);

  const toggle = useCallback(() => {
    const current = getThemeSnapshot();
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("theme", next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const isDark = theme === "dark";

  return {
    theme,
    toggle,
    isDark,
    accent: "#818cf8",
    accentDim: isDark ? "rgba(129,140,248,0.15)" : "rgba(129,140,248,0.1)",
    accentGlow: "rgba(129,140,248,0.3)",
    textPrimary: isDark ? "#e2e8f0" : "#1e293b",
    textSecondary: isDark ? "rgba(226,232,240,0.4)" : "rgba(30,41,59,0.4)",
    textMuted: isDark ? "rgba(226,232,240,0.55)" : "rgba(30,41,59,0.5)",
    textBody: isDark ? "rgba(226,232,240,0.75)" : "rgba(30,41,59,0.7)",
    bgBody: isDark ? "#0a0a12" : "#f8fafc",
    bgCard: isDark ? "rgba(22,22,35,0.92)" : "rgba(255,255,255,0.85)",
    bgCardBorder: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
    bgCardHover: isDark ? "rgba(129,140,248,0.03)" : "rgba(129,140,248,0.04)",
    bgHeader: isDark ? "rgba(10,10,18,0.88)" : "rgba(248,250,252,0.88)",
    bgInner: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
    bgInnerBorder: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)",
    bgSpeed: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    bgSpeedText: isDark ? "rgba(226,232,240,0.4)" : "rgba(30,41,59,0.4)",
    toggleTrack: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)",
  };
}

// Singleton — only one track can play at a time
let currentPlayingId: string | null = null;
let onStopCallback: (() => void) | null = null;

export function stopCurrentTrack() {
  if (onStopCallback) onStopCallback();
}

export function AudioTrack({ src, title, isHls = false, text, activeTrackId, onPlay, onStop }: AudioTrackProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Web Audio API
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // Smoothed bar heights for animation
  const smoothBarsRef = useRef<Float32Array>(new Float32Array(NUM_BARS));
  // Random offsets for floating look (seeded by title)
  const floatOffsetsRef = useRef<Float32Array>(new Float32Array(0));
  if (floatOffsetsRef.current.length == 0) {
    const off = new Float32Array(NUM_BARS);
    let seed = 0;
    for (let i = 0; i < title.length; i++) seed = ((seed << 5) - seed + title.charCodeAt(i)) | 0;
    for (let i = 0; i < NUM_BARS; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      off[i] = (seed % 100) / 100; // 0..1
    }
    floatOffsetsRef.current = off;
  }

  const [playing, setPlaying] = useState(false);
  const [curTime, setCurTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showText, setShowText] = useState(false);
  const [textMaxH, setTextMaxH] = useState(400);
  // Force re-render for bars animation
  const [barFrame, setBarFrame] = useState(0);

  const isActive = activeTrackId === title;
  const c = useColors();

  // Init or reconnect Web Audio API
  const initAudioContext = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;

    // Create AudioContext if not exists
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
      analyserRef.current = ctxRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.75;
      analyserRef.current.connect(ctxRef.current.destination);
      freqDataRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      // Create source only once per audio element
      if (!sourceRef.current) {
        sourceRef.current = ctxRef.current.createMediaElementSource(a);
      }
      sourceRef.current.connect(analyserRef.current);
    }

    // Resume context if suspended (autoplay policy)
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
  }, []);

  // Cleanup Web Audio on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch (_) {}
        sourceRef.current = null;
      }
      if (ctxRef.current) {
        try { ctxRef.current.close(); } catch (_) {}
        ctxRef.current = null;
        analyserRef.current = null;
        freqDataRef.current = null;
      }
    };
  }, []);

  // Register stop callback
  useEffect(() => {
    if (playing) {
      currentPlayingId = title;
      onStopCallback = () => {
        const a = audioRef.current;
        if (a) a.pause();
        setPlaying(false);
        onStop();
      };
    }
    return () => {
      if (currentPlayingId === title) {
        currentPlayingId = null;
        onStopCallback = null;
      }
    };
  }, [playing, title, onStop]);

  useEffect(() => {
    if (!isHls || !src) return;
    const a = audioRef.current;
    if (!a) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (Hls.isSupported()) {
      const h = new Hls({ enableWorker: true, lowLatencyMode: false });
      hlsRef.current = h;
      h.loadSource(src);
      h.attachMedia(a);
      h.on(Hls.Events.MANIFEST_PARSED, () => setLoading(false));
      h.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { setLoading(false); setError(true); } });
    } else if (a.canPlayType("application/vnd.apple.mpegurl")) {
      a.src = src;
    }
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [isHls, src]);

  // Animation loop: read frequency data + update time
  useEffect(() => {
    if (!playing) return;
    const smooth = smoothBarsRef.current;

    const tick = () => {
      if (audioRef.current) setCurTime(audioRef.current.currentTime);

      // Read frequency data from analyser
      if (analyserRef.current && freqDataRef.current) {
        analyserRef.current.getByteFrequencyData(freqDataRef.current);
        const freq = freqDataRef.current;
        const binCount = freq.length;

        for (let i = 0; i < NUM_BARS; i++) {
          // Map bar index to frequency bin (logarithmic mapping for more natural look)
          const ratio = i / NUM_BARS;
          const freqIdx = Math.floor(Math.pow(ratio, 1.5) * binCount);
          const raw = freqIdx < binCount ? freq[freqIdx] / 255 : 0;

          // Smooth towards target (ease up fast, ease down slow)
          const target = Math.max(0.04, raw);
          if (target > smooth[i]) {
            smooth[i] += (target - smooth[i]) * 0.6;
          } else {
            smooth[i] += (target - smooth[i]) * 0.25;
          }
          smooth[i] = Math.max(0.04, Math.min(1, smooth[i]));
        }
      }

      setBarFrame((f) => f + 1);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing]);

  // When not playing, decay bars to minimum
  useEffect(() => {
    if (playing) return;
    const smooth = smoothBarsRef.current;
    let raf: number;
    const decay = () => {
      let allMin = true;
      for (let i = 0; i < NUM_BARS; i++) {
        if (smooth[i] > 0.05) {
          smooth[i] *= 0.85;
          allMin = false;
        } else {
          smooth[i] = 0.04;
        }
      }
      if (!allMin) {
        setBarFrame((f) => f + 1);
        raf = requestAnimationFrame(decay);
      }
    };
    raf = requestAnimationFrame(decay);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

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

  // Stop other tracks when this one plays
  useEffect(() => {
    if (activeTrackId && activeTrackId !== title && playing) {
      const a = audioRef.current;
      if (a) a.pause();
      setPlaying(false);
    }
  }, [activeTrackId, title, playing]);

  const handlePlayToggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || loading || error) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      onStop();
    } else {
      initAudioContext();
      onPlay(title);
      a.play().catch(() => setError(true));
      setPlaying(true);
    }
  }, [playing, loading, error, title, onPlay, onStop, initAudioContext]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bars = barsRef.current, a = audioRef.current;
    if (!bars || !a || dur === 0) return;
    const r = bars.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    a.currentTime = p * dur;
    setCurTime(p * dur);
  }, [dur]);

  const chSpeed = useCallback((s: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = s;
    setSpeed(s);
  }, []);

  const prog = dur > 0 ? curTime / dur : 0;
  const playedExact = prog * NUM_BARS;
  const playedFull = Math.floor(playedExact);
  const curFrac = playedExact - playedFull;

  const lines = useMemo(() => {
    if (!text) return [];
    return text.split("\n").filter((l) => l.trim().length > 0);
  }, [text]);

  const hasText = lines.length > 0;

  // Read smoothed bar data
  const barHeights = smoothBarsRef.current;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        backgroundColor: isActive ? c.bgCardHover : c.bgCard,
        border: "1px solid " + c.bgCardBorder,
        boxShadow: isActive ? "0 0 0 1px " + c.accent + "15, 0 4px 20px " + c.accent + "10" : undefined,
      }}
    >
      {/* Title row */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-1.5">
        {/* Play/Pause button */}
        <button
          onClick={handlePlayToggle}
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            backgroundColor: playing ? c.accent : c.toggleTrack,
          }}
          aria-label={playing ? "Pause" : "Play"}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: playing ? "rgba(255,255,255,0.3)" : c.textMuted, borderTopColor: playing ? "#fff" : c.accent }} />
          ) : playing ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="2" width="5" height="16" rx="1.5" fill="white" />
              <rect x="12" y="2" width="5" height="16" rx="1.5" fill="white" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M5 2.5L19 11L5 19.5V2.5Z" fill={c.isDark ? c.textPrimary : c.accent} />
            </svg>
          )}
        </button>
        <h3 className="flex-1 font-semibold text-sm sm:text-base truncate leading-tight" style={{ color: c.textPrimary }}>
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
                    ? { backgroundColor: c.accent, color: "#fff", boxShadow: "0 1px 6px " + c.accentGlow }
                    : { backgroundColor: c.bgSpeed, color: c.bgSpeedText }
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
              style={{ backgroundColor: c.accent, color: "#fff" }}
            >
              {SPEED_LABELS[speed]}
            </span>
          </div>
        </div>

      {/* Bars — reactive to audio via Web Audio API, floating heights */}
      <div
        ref={barsRef}
        onClick={seek}
        className="relative mx-4 my-1.5 overflow-hidden cursor-pointer"
        style={{ height: "36px" }}
      >
        <div className="flex items-end h-full" style={{ gap: "1px" }}>
          {Array.from({ length: NUM_BARS }, (_, i) => {
            const h = barHeights[i] || 0.04;
            const floatBase = 0.15 + floatOffsetsRef.current[i] * 0.35; // 15-50%
            const isPlayed = i < playedFull;
            const isCurrent = i === playedFull && playing;
            let bg: string;
            let op: number;
            let displayH: number;

            if (playing) {
              // When playing — audio-reactive, floating
              displayH = floatBase + h * (1 - floatBase);
              if (isPlayed) {
                bg = c.accent;
                op = 0.9;
              } else if (isCurrent) {
                bg = c.accent;
                op = 0.5 + curFrac * 0.4;
              } else {
                bg = c.accent;
                op = 0.25 + h * 0.65;
              }
            } else {
              // When paused — floating idle + progress
              displayH = floatBase;
              if (isPlayed) {
                bg = c.accent;
                op = 0.8;
              } else if (isCurrent) {
                bg = c.accent;
                op = 0.2 + curFrac * 0.6;
              } else {
                bg = c.isDark ? "#e2e8f0" : "#475569";
                op = 0.1 + floatOffsetsRef.current[i] * 0.12;
              }
            }

            return (
              <div
                key={i}
                className="rounded-full"
                style={{
                  flex: "1 1 0%",
                  height: displayH * 100 + "%",
                  backgroundColor: bg,
                  opacity: op,
                  transition: "opacity 0.15s ease",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Time */}
      <div className="flex items-center justify-between px-4 pb-2">
        <span className="text-xs tabular-nums font-medium" style={{ color: c.textSecondary }}>
          {formatTime(curTime)}
        </span>
        <span className="text-xs tabular-nums font-medium" style={{ color: c.textSecondary }}>
          {formatTime(dur)}
        </span>
      </div>

      {error && (
        <div className="px-4 pb-2.5">
          <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#fb7185", backgroundColor: "rgba(251,113,133,0.08)" }}>
            Not able to load audio
          </p>
        </div>
      )}

      {/* Transcript */}
      {hasText && (
        <div style={{ borderTop: "1px solid " + c.bgCardBorder }}>
          <button
            ref={toggleRef}
            onClick={() => setShowText(!showText)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors"
            style={{ color: showText ? c.accent : c.textSecondary, backgroundColor: showText ? c.accentDim : "transparent" }}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{showText ? "Hide text" : "Show text"}</span>
            {showText ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showText && (
            <div
              className="px-4 pt-4 pb-4 overflow-y-auto"
              style={{ maxHeight: textMaxH + "px", scrollbarWidth: "thin", scrollbarColor: c.accentGlow + " transparent" }}
            >
              <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: c.bgInner, border: "1px solid " + c.bgInnerBorder }}>
                {lines.map((line, i) => {
                  const ci = line.indexOf(":");
                  const isDlg = ci > 0 && ci < 30;
                  const cn = isDlg ? line.slice(0, ci).trim() : null;
                  const dt = isDlg ? line.slice(ci + 1).trim() : line.trim();
                  let cc = c.textMuted;
                  if (cn === "Kara") cc = "#818cf8";
                  else if (cn === "Martin") cc = "#38bdf8";
                  else if (cn === "Mum" || cn === "Janet") cc = "#fb923c";
                  else if (cn === "Howard") cc = "#c084fc";
                  else if (cn === "John" || cn === "Boy") cc = "#f87171";
                  else if (cn && (cn.includes("voice") || cn.includes("Ghost"))) cc = c.isDark ? "rgba(226,232,240,0.35)" : "rgba(30,41,59,0.35)";
                  return (
                    <p key={i} className="text-xs sm:text-sm leading-relaxed" style={{ marginBottom: i < lines.length - 1 ? "8px" : "0", color: c.textBody }}>
                      {isDlg ? (
                        <>
                          <span className="font-semibold" style={{ color: cc }}>{cn}:</span>
                          {" "}
                          <span style={{ color: c.isDark ? "rgba(226,232,240,0.7)" : "rgba(30,41,59,0.65)" }}>{dt}</span>
                        </>
                      ) : (
                        <span className="italic" style={{ color: c.textMuted }}>{dt}</span>
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <audio
        ref={audioRef}
        src={isHls ? undefined : src}
        crossOrigin="anonymous"
        preload="metadata"
        onLoadedMetadata={() => { setLoading(false); if (audioRef.current) setDur(audioRef.current.duration); }}
        onTimeUpdate={() => { if (audioRef.current && !playing) setCurTime(audioRef.current.currentTime); }}
        onDurationChange={() => { if (audioRef.current) setDur(audioRef.current.duration); }}
        onEnded={() => { setPlaying(false); setCurTime(0); onStop(); }}
        onError={() => { setLoading(false); setError(true); }}
        onCanPlay={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onCanPlayThrough={() => setLoading(false)}
      />
    </div>
  );
}

// Re-export useColors for the page
export { useColors };
