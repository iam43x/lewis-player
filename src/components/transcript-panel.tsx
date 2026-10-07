"use client";

import { useEffect, useMemo, useRef } from "react";
import { useColors } from "@/lib/colors";
import type { Replic } from "@/lib/types";

interface TranscriptPanelProps {
  text?: Replic[];
  roles?: Record<string, string | undefined>;
  curTime: number;
  dur: number;
  onSeekMs: (ms: number) => void;
}

export function TranscriptPanel({ text, roles, curTime, dur, onSeekMs }: TranscriptPanelProps) {
  const c = useColors();
  const activeRef = useRef<HTMLDivElement | null>(null);

  const curMs = curTime * 1000;
  const replics = text || [];

  const activeIdx = useMemo(() => {
    if (!replics.length) return -1;
    for (let i = 0; i < replics.length; i++) {
      if (curMs >= replics[i].start && curMs < replics[i].end) return i;
    }
    let last = -1;
    for (let i = 0; i < replics.length; i++) {
      if (curMs >= replics[i].start) last = i;
    }
    return last;
  }, [replics, curMs]);

  useEffect(() => {
    if (activeIdx < 0 || !activeRef.current) return;
    activeRef.current.scrollIntoView({ block: "center" });
  }, [activeIdx]);

  if (!replics.length) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {replics.map((r, ri) => {
        const isActive = ri === activeIdx;
        const isNarration = !r.speaker;
        return (
          <div
            key={ri}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSeekMs(r.start)}
            className="w-full text-left px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
            style={{
              backgroundColor: isActive ? c.accentSoft : "transparent",
            }}
          >
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: c.textMuted }}>
              {r.speaker && (
                <span className="font-semibold" style={{ color: roles?.[r.speaker] || c.accent }}>
                  {r.speaker}:
                </span>
              )}
              {r.speaker && r.words.length > 0 && " "}
              {r.words.map((w, wi) => {
                // Karaoke fill: words before the current one are fully lit, the
                // current word lights up char-by-char, later words stay dim.
                let litChars = 0;
                if (isActive) {
                  if (w.end <= curMs) litChars = w.value.length;
                  else if (curMs > w.start) {
                    const span = w.end - w.start;
                    litChars =
                      span > 0
                        ? Math.min(
                            w.value.length,
                            Math.round((w.value.length * (curMs - w.start)) / span)
                          )
                        : w.value.length;
                  }
                }

                const lit = litChars > 0;

                return (
                  <span
                    key={wi}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeekMs(w.start);
                    }}
                    className="cursor-pointer"
                    style={isNarration ? { fontStyle: "italic" } : undefined}
                  >
                    <span
                      style={
                        lit
                          ? { color: c.accent }
                          : isNarration
                            ? { color: c.textSoft }
                            : undefined
                      }
                    >
                      {w.value.slice(0, litChars)}
                    </span>
                    {litChars < w.value.length && (
                      <span style={isNarration ? { color: c.textSoft } : undefined}>
                        {w.value.slice(litChars)}
                      </span>
                    )}
                    {" "}
                  </span>
                );
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}