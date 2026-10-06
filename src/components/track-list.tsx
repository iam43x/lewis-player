"use client";

import { memo } from "react";
import { Play, Pause } from "lucide-react";
import { useColors } from "@/lib/colors";
import type { TrackItem } from "@/lib/types";

interface TrackListProps {
  tracks: TrackItem[];
  selectedId: string;
  playing: boolean;
  loading: boolean;
  onSelect: (track: TrackItem) => void;
}

export const TrackList = memo(function TrackList({
  tracks,
  selectedId,
  playing,
  loading,
  onSelect,
}: TrackListProps) {
  const c = useColors();

  return (
    <div className="flex flex-col" role="list">
      {tracks.map((track, i) => {
        const isActive = track.id === selectedId;
        const isPlayingActive = isActive && playing && !loading;
        return (
          <button
            key={track.id}
            role="listitem"
            onClick={() => onSelect(track)}
            className="group flex items-center gap-3 w-full text-left px-3 sm:px-4 py-3 transition-colors"
            style={{
              backgroundColor: isActive ? c.accentSoft : "transparent",
              borderBottom: i < tracks.length - 1 ? "1px solid " + c.border : undefined,
            }}
            aria-current={isActive ? "true" : undefined}
          >
            <span
              className="flex-1 min-w-0 text-sm font-medium truncate"
              style={{ color: isActive ? c.accent : c.text }}
            >
              {track.title}
            </span>
            <span
              className="shrink-0 w-5 h-5 flex items-center justify-center"
              style={{ color: isActive ? c.accent : c.textSoft }}
            >
              {isPlayingActive ? (
                <Pause className="w-4 h-4" fill="currentColor" />
              ) : (
                <Play
                  className={
                    "w-4 h-4 transition-opacity " +
                    (isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100")
                  }
                  fill="currentColor"
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
});
