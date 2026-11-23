const berlinDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today's calendar date in Germany as an ISO date. Rules compare dates of
 * birth and notarisation with it. The server computes it once per request and
 * passes it on, so server and browser check a draft against the same day.
 */
export function todayInGermany(now: Date = new Date()): string {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return berlinDate.format(now);
}
