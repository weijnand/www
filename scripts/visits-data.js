(() => {
  "use strict";

  const dayMilliseconds = 86400000;
  const fields = ["version", "timezone", "scope", "exclude_bots", "start_date", "as_of", "total_visits", "coverage", "partial_dates", "estimated", "daily"];
  const isLocalPreview = location.protocol === "file:";
  const numberFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  const dateFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  let request;

  const exactFields = (value, keys) => value !== null && typeof value === "object"
    && !Array.isArray(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

  const dateValue = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value ? parsed : NaN;
  };

  const count = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

  const validate = (data) => {
    const fail = () => { throw new Error("Invalid public visits data."); };
    if (!exactFields(data, fields) || data.version !== 1 || data.timezone !== "Europe/Berlin"
      || data.scope !== "homepage" || data.exclude_bots !== true || typeof data.estimated !== "boolean"
      || !Array.isArray(data.daily) || !Array.isArray(data.partial_dates)
      || !exactFields(data.coverage, ["recorded_days", "expected_days", "missing_days"])) fail();

    let previous = -Infinity;
    let total = 0;
    const dates = new Set();
    for (const day of data.daily) {
      if (!exactFields(day, ["date", "visits"]) || !count(day.visits)) fail();
      const stamp = dateValue(day.date);
      if (!Number.isFinite(stamp) || stamp <= previous) fail();
      previous = stamp;
      total += day.visits;
      dates.add(day.date);
    }
    if (!Number.isFinite(total)) fail();
    if (new Set(data.partial_dates).size !== data.partial_dates.length
      || data.partial_dates.some((day) => !dates.has(day))) fail();

    const recorded = data.daily.length;
    const expected = recorded ? Math.round((previous - dateValue(data.daily[0].date)) / dayMilliseconds) + 1 : 0;
    if (data.coverage.recorded_days !== recorded || data.coverage.expected_days !== expected
      || data.coverage.missing_days !== expected - recorded) fail();

    if (recorded) {
      if (data.start_date !== data.daily[0].date || data.as_of !== data.daily[recorded - 1].date
        || !count(data.total_visits) || Math.abs(data.total_visits - total) > Math.max(1e-6, total * 1e-12)) fail();
      // Never publish an unfinished Berlin calendar day as a completed one.
      const berlinToday = new Intl.DateTimeFormat("en-CA", {
        timeZone: data.timezone, year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(new Date());
      const parts = Object.fromEntries(berlinToday.map(({ type, value }) => [type, value]));
      if (data.as_of >= `${parts.year}-${parts.month}-${parts.day}`) fail();
    } else if (data.start_date !== null || data.as_of !== null || data.total_visits !== null
      || data.partial_dates.length || data.estimated) fail();

    return data;
  };

  const loadLocalPreview = () => new Promise((resolve, reject) => {
    // Local file URLs cannot reliably fetch JSON. This dated, sanitized snapshot
    // is used only for file:// previews, never as a fallback on the live site.
    if (window.WvwVisitsPreview) {
      resolve(window.WvwVisitsPreview);
      return;
    }
    const script = document.createElement("script");
    script.src = new URL("data/visits-preview.js", document.baseURI).href;
    const timer = setTimeout(() => reject(new Error("Local visits preview unavailable.")), 5000);
    script.onload = () => {
      clearTimeout(timer);
      if (window.WvwVisitsPreview) resolve(window.WvwVisitsPreview);
      else reject(new Error("Local visits preview unavailable."));
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Local visits preview unavailable."));
    };
    document.head.append(script);
  });

  const load = () => {
    if (!request) {
      request = (async () => {
        if (isLocalPreview) return validate(await loadLocalPreview());
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch(new URL("data/visits.json", document.baseURI), {
            cache: "no-cache", credentials: "omit", signal: controller.signal,
          });
          if (!response.ok) throw new Error("Visits data unavailable.");
          const content = await response.text();
          if (content.length > 2000000) throw new Error("Visits data too large.");
          return validate(JSON.parse(content));
        } finally {
          clearTimeout(timer);
        }
      })();
    }
    return request;
  };

  window.WvwVisitsData = Object.freeze({ load, validate, isLocalPreview, dateValue });

  const updateFooter = async () => {
    const counters = document.querySelectorAll("[data-visits-count]");
    if (!counters.length) return;
    try {
      const data = await load();
      counters.forEach((counter) => {
        counter.textContent = data.total_visits === null ? "unavailable" : numberFormat.format(data.total_visits);
        const link = counter.closest("a");
        if (link && data.as_of) {
          link.title = `Recorded homepage visits through ${dateFormat.format(dateValue(data.as_of))}${isLocalPreview ? " (local preview snapshot)" : ""}. Not unique people.`;
        }
      });
    } catch {
      counters.forEach((counter) => { counter.textContent = "unavailable"; });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", updateFooter);
  else updateFooter();
})();
