export interface TimedWord {
  /** Word highlight start, milliseconds from track start */
  start: number;
  /** Word highlight end, milliseconds from track start */
  end: number;
  value: string;
}

/** One line of dialogue/narration. */
export interface Replic {
  /** Line start (includes the speaker label timing) — drives line highlight */
  start: number;
  /** Line end — drives line highlight */
  end: number;
  /** Speaker name without colon; static, colored via `roles`, never karaoke-highlighted */
  speaker?: string;
  words: TimedWord[];
}

export interface TrackItem {
  id: string;
  title: string;
  rutubeUrl?: string;
  localUrl?: string;
  /** Timed text (karaoke): array of replics with word-level timings. */
  text?: Replic[];
  status: "pending" | "ready" | "error";
  error?: string;
  /** Skip intro: playback starts here (milliseconds). Seek back to 0 is still allowed. */
  start?: number;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  episodes: number;
  roles?: Record<string, string | undefined>;
}
