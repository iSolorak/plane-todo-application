/**
 * Timezone helpers. We deliberately do NOT hand-roll DST rules — the offset for
 * any instant is read back from the platform's IANA database via Intl, and the
 * wall-clock→UTC conversion refines once to land on the correct side of a DST
 * transition (the same two-pass approach date-fns-tz uses).
 */

/**
 * Offset of `tz` from UTC at a given instant, in milliseconds (local − UTC).
 * e.g. Europe/Athens returns +7_200_000 in winter (EET) and +10_800_000 in
 * summer (EEST).
 */
export function tzOffsetMs(instantMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(instantMs));
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wallAsUtc - instantMs;
}

/**
 * The UTC epoch-ms for a wall-clock time expressed in `tz`. Two-pass: guess
 * using the offset at the naive-UTC instant, then re-read the offset at the
 * candidate and correct if a DST boundary moved it.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string,
): number {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const off1 = tzOffsetMs(naiveUtc, tz);
  let utc = naiveUtc - off1;
  const off2 = tzOffsetMs(utc, tz);
  if (off2 !== off1) utc = naiveUtc - off2;
  return utc;
}

/**
 * Resolve a Plane `target_date` to a UTC instant (epoch ms), or null if
 * unparseable.
 *
 * - A date-only value ("YYYY-MM-DD") is anchored to **23:59:59 local time** in
 *   `tz` — the end of that day for the user, NOT UTC midnight.
 * - A full ISO timestamp is parsed as-is.
 */
export function resolveTargetInstant(
  targetDate: string | null,
  tz: string,
): number | null {
  if (!targetDate) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate);
  if (dateOnly) {
    return zonedWallTimeToUtc(
      Number(dateOnly[1]),
      Number(dateOnly[2]),
      Number(dateOnly[3]),
      23,
      59,
      59,
      tz,
    );
  }
  const parsed = Date.parse(targetDate);
  return Number.isNaN(parsed) ? null : parsed;
}
