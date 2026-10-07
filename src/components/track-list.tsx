"use client";

import { memo } from "react";
import { useColors } from "@/lib/colors";
import type { TrackItem } from "@/lib/types";

interface TrackListProps {
  tracks: TrackItem[];
  selectedId: string;
  onSelect: (track: TrackItem) => void;
}

export const TrackList = memo(function TrackList({
  tracks,
  selectedId,
  onSelect,
}: TrackListProps) {
  const c = useColors();

  return (
    <div className="flex flex-col" role="list">
      {tracks.map((track, i) => {
        const isActive = track.id === selectedId;
        return (
          <button
            key={track.id}
            role="listitem"
            onClick={() => onSelect(track)}
            className="group flex items-center gap-3 w-full text-left px-3 sm:px-4 py-3 transition-all duration-300 hover:scale-[1.01]"
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
          </button>
        );
      })}
    </div>
  );
});
