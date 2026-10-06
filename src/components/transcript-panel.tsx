"use client";

import { useEffect, useMemo, useRef } from "react";
import { useColors } from "@/lib/colors";

interface TranscriptPanelProps {
  lines: string[];
  roles?: Record<string, string | undefined>;
  curTime: number;
  dur: number;
  onSeekLine: (index: number, total: number) => void;
}

export function parseLine(line: string): { name: string | null; body: string; isDlg: boolean } {
  const ci = line.indexOf(":");
  const isDlg = ci > 0 && ci < 30;
  const name = isDlg ? line.slice(0, ci).trim() : null;
  const body = isDlg ? line.slice(ci + 1).trim() : line.trim();
  return { name, body, isDlg };
}

export function TranscriptPanel({ lines, roles, curTime, dur, onSeekLine }: TranscriptPanelProps) {
  const c = useColors();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const activeIndex = useMemo(() => {
    if (!lines.length || dur <= 0) return -1;
    const idx = Math.floor((curTime / dur) * lines.length);
    return Math.max(0, Math.min(lines.length - 1, idx));
  }, [curTime, dur, lines.length]);

  useEffect(() => {
    if (activeIndex < 0 || !activeRef.current) return;
    activeRef.current.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div className="flex flex-col gap-0.5">
      {lines.map((line, i) => {
        const { name, body, isDlg } = parseLine(line);
        const isActive = i === activeIndex;
        return (
          <button
            key={i}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSeekLine(i, lines.length)}
            className="w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer"
            style={{ backgroundColor: isActive ? c.accentSoft : "transparent" }}
          >
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: c.textMuted }}>
              {isDlg ? (
                <>
                  <span className="font-semibold" style={{ color: (name && roles?.[name]) || c.accent }}>
                    {name}:
                  </span>{" "}
                  <span>{body}</span>
                </>
              ) : (
                <span className="italic" style={{ color: c.textSoft }}>
                  {body}
                </span>
              )}
            </p>
          </button>
        );
      })}
    </div>
  );
}
