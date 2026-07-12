import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeList } from "./normalize";
import { qk } from "./queryKeys";

export interface NotifierOffset {
  key: string;
  minutesBefore: number;
}

export interface NotifierDigest {
  enabled: boolean;
  time: string;
  tz: string;
}

/** Shape returned by the notifier's read-only GET /config endpoint. */
export interface NotifierConfig {
  offsets: NotifierOffset[];
  digest: NotifierDigest;
  minCatchupMinutes?: number;
}

/**
 * Read-only fetch of the notifier's reminder configuration. Only enabled when a
 * notifier base URL is configured; the Settings screen hides the section
 * otherwise. We do NOT support editing offsets/digest from the app.
 */
export function useNotifierConfig(
  baseUrl: string | undefined,
): UseQueryResult<NotifierConfig> {
  return useQuery({
    queryKey: qk.notifierConfig(baseUrl ?? ""),
    enabled: !!baseUrl,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`${trimSlashes(baseUrl!)}/config`);
      if (!res.ok) {
        throw new Error(`Notifier responded ${res.status}`);
      }
      const raw = (await res.json()) as Partial<NotifierConfig> | null;
      // Normalize so Settings can map offsets without guarding shapes.
      return {
        offsets: normalizeList<NotifierOffset>(raw?.offsets),
        digest: raw?.digest ?? { enabled: false, time: "", tz: "" },
        minCatchupMinutes: raw?.minCatchupMinutes,
      } satisfies NotifierConfig;
    },
  });
}

function trimSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}
