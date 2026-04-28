export interface TrackItem {
  id: string;
  title: string;
  rutubeUrl?: string;
  yandexUrl?: string;
  localUrl?: string;
  text?: string;
  status: "pending" | "ready" | "error";
  error?: string;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  episodes: number;
  roles?: Record<string, string>;
}
