(() => {
  "use strict";

  const DAY = 86400000;
  const numberFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const svgNS = "http://www.w3.org/2000/svg";

  // UTC arithmetic represents calendar dates only; published days are Berlin days.
  // This keeps the selected interval stable across daylight-saving transitions.
  const stamp = (value) => Date.parse(`${value}T00:00:00Z`);
  const iso = (value) => new Date(value).toISOString().slice(0, 10);
  const formatDate = (value) => longDate.format(new Date(stamp(value)));
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(stamp(value)) && iso(stamp(value)) === value;

  function shiftMonths(value, months) {
    const date = new Date(stamp(value));
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
    return iso(date.getTime());
  }

  function presetRange(preset, first, last) {
    const monthCounts = { "1M": 1, "6M": 6, "1Y": 12, "5Y": 60 };
    let from = first;
    if (preset === "1W") from = iso(stamp(last) - 6 * DAY);
    if (monthCounts[preset]) from = iso(stamp(shiftMonths(last, -monthCounts[preset])) + DAY);
    return { from: from < first ? first : from, to: last };
  }

  function rangeData(data, from, to) {
    const byDate = new Map(data.daily.map((day) => [day.date, day.visits]));
    const partialDates = new Set(data.partial_dates);
    const days = [];
    for (let current = stamp(from); current <= stamp(to); current += DAY) {
      const date = iso(current);
      days.push({ date, visits: byDate.has(date) ? byDate.get(date) : null, partial: partialDates.has(date) });
    }
    const recorded = days.filter((day) => day.visits !== null);
    return { from, to, days, recorded: recorded.length, missing: days.length - recorded.length,
      total: recorded.length ? recorded.reduce((sum, day) => sum + day.visits, 0) : null };
  }

  // Exposed as pure helpers for the small offline browser fixture.
  window.WvwVisitsModel = Object.freeze({ validDate, shiftMonths, presetRange, rangeData });

  const root = document.getElementById("visits-explorer");
  if (!root) return;
  const find = (id) => document.getElementById(id);
  const controls = root.querySelector("fieldset");
  const fromInput = find("visits-from");
  const toInput = find("visits-to");
  const chart = find("visits-chart");
  const chartWrap = find("visits-chart-wrap");
  const rangeError = find("visits-range-error");
  const status = find("visits-status");
  let archive = null;
  let currentRange = null;
  let activeDay = null;
  let chartGeometry = null;
  let resizeFrame = null;

  function svgElement(tag, attrs = {}, text = null) {
    const element = document.createElementNS(svgNS, tag);
    Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
    if (text !== null) element.textContent = text;
    return element;
  }

  function dayDescription(day) {
    if (day.visits === null) return `${formatDate(day.date)}: no archived record.`;
    const count = numberFormat.format(day.visits);
    return `${formatDate(day.date)}: ${count} ${archive.estimated ? "estimated " : ""}visit${day.visits === 1 ? "" : "s"}${day.partial ? "; partial tracking day" : ""}.`;
  }

  function highlightDay(index) {
    if (!currentRange || !chartGeometry) return;
    activeDay = Math.max(0, Math.min(currentRange.days.length - 1, index));
    const day = currentRange.days[activeDay];
    find("visits-point-info").textContent = dayDescription(day);
    chart.querySelectorAll(".visits-active-line, .visits-active-dot").forEach((element) => element.remove());
    const { x, y, top, bottom } = chartGeometry;
    chart.append(svgElement("line", { x1: x(activeDay), x2: x(activeDay), y1: top, y2: bottom, class: "visits-active-line", "aria-hidden": "true" }));
    if (day.visits !== null) chart.append(svgElement("circle", { cx: x(activeDay), cy: y(day.visits), r: 4.5, class: "visits-active-dot", "aria-hidden": "true" }));
  }

  function renderChart() {
    if (!currentRange) return;
    const width = Math.max(240, chartWrap.clientWidth);
    const height = 290;
    const left = 48;
    const right = width - 12;
    const top = 24;
    const bottom = height - 42;
    const values = currentRange.days.filter((day) => day.visits !== null).map((day) => day.visits);
    const peak = values.reduce((max, value) => Math.max(max, value), 0);
    const rawStep = Math.max(1, peak / 4);
    const order = 10 ** Math.floor(Math.log10(rawStep));
    const step = Math.ceil(rawStep / order) * order;
    const ceiling = step * 4;
    const x = (index) => currentRange.days.length === 1 ? (left + right) / 2 : left + index / (currentRange.days.length - 1) * (right - left);
    const y = (value) => bottom - value / ceiling * (bottom - top);
    chartGeometry = { x, y, left, right, top, bottom, width };
    chart.replaceChildren();
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    chart.append(svgElement("title", { id: "visits-chart-title" }, "Daily homepage visits"));
    chart.append(svgElement("desc", { id: "visits-chart-desc" }, `${formatDate(currentRange.from)} to ${formatDate(currentRange.to)}. ${currentRange.recorded} of ${currentRange.days.length} days recorded. Missing records are gaps; recorded zeros remain zero.`));
    const drawing = svgElement("g", { "aria-hidden": "true" });
    for (let tick = 0; tick <= 4; tick += 1) {
      const value = step * tick;
      drawing.append(svgElement("line", { x1: left, x2: right, y1: y(value), y2: y(value), class: "visits-grid-line" }));
      const label = new Intl.NumberFormat("en-GB", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
      drawing.append(svgElement("text", { x: left - 9, y: y(value) + 4, "text-anchor": "end" }, label));
    }
    drawing.append(svgElement("text", { x: left, y: 12 }, "Visits"));
    const lastIndex = currentRange.days.length - 1;
    const tickIndices = lastIndex === 0 ? [0] : width < 480 ? [0, lastIndex] : [0, Math.floor(lastIndex / 2), lastIndex];
    [...new Set(tickIndices)].forEach((index) => {
      const anchor = lastIndex === 0 ? "middle" : index === 0 ? "start" : index === lastIndex ? "end" : "middle";
      const date = new Date(stamp(currentRange.days[index].date));
      const label = currentRange.days.length > 300 ? new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date) : shortDate.format(date);
      drawing.append(svgElement("text", { x: x(index), y: height - 13, "text-anchor": anchor }, label));
    });
    let path = "";
    let connected = false;
    currentRange.days.forEach((day, index) => {
      if (day.visits === null) {
        connected = false;
        drawing.append(svgElement("line", { x1: x(index), x2: x(index), y1: bottom + 5, y2: bottom + 11, class: "visits-missing-mark" }));
        return;
      }
      path += `${connected ? "L" : "M"}${x(index).toFixed(2)},${y(day.visits).toFixed(2)} `;
      connected = true;
      // Keep isolated records and actual zeros visible, even without a line segment.
      const isolated = !index || currentRange.days[index - 1].visits === null || index === lastIndex || currentRange.days[index + 1].visits === null;
      if (currentRange.days.length <= 62 || isolated) drawing.append(svgElement("circle", { cx: x(index), cy: y(day.visits), r: day.partial ? 3.5 : 2.8, class: "visits-dot" }));
    });
    drawing.append(svgElement("path", { d: path, class: "visits-line" }));
    chart.append(drawing);
    chart.append(svgElement("rect", { x: left, y: top, width: right - left, height: bottom - top + 14, class: "visits-hit-area", "aria-hidden": "true" }));
    if (activeDay !== null) highlightDay(activeDay);
  }

  function renderTable() {
    const tbody = find("visits-table-body");
    tbody.replaceChildren();
    if (!currentRange || !find("visits-table-details").open) return;
    const fragment = document.createDocumentFragment();
    currentRange.days.forEach((day) => {
      const row = document.createElement("tr");
      const date = document.createElement("th");
      date.scope = "row";
      date.textContent = formatDate(day.date);
      const visits = document.createElement("td");
      visits.textContent = day.visits === null ? "—" : numberFormat.format(day.visits);
      const coverage = document.createElement("td");
      coverage.textContent = day.visits === null ? "Not recorded" : day.partial ? "Partial day" : "Recorded";
      row.append(date, visits, coverage);
      fragment.append(row);
    });
    tbody.append(fragment);
  }

  function selectRange(from, to, preset = null) {
    currentRange = rangeData(archive, from, to);
    activeDay = null;
    fromInput.value = from;
    toInput.value = to;
    rangeError.hidden = true;
    fromInput.removeAttribute("aria-invalid");
    toInput.removeAttribute("aria-invalid");
    root.querySelectorAll("[data-visits-range]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.visitsRange === preset)));
    find("visits-results").hidden = false;
    find("visits-range-total").textContent = currentRange.total === null ? "Unavailable" : numberFormat.format(currentRange.total);
    find("visits-total-label").textContent = currentRange.total === null ? "" : archive.estimated ? "estimated visits" : "recorded visits";
    find("visits-range-label").textContent = `${formatDate(from)} – ${formatDate(to)}`;
    find("visits-coverage").textContent = `${currentRange.recorded} of ${currentRange.days.length} calendar days recorded${currentRange.missing ? ` · ${currentRange.missing} missing` : ""}`;
    status.hidden = currentRange.recorded > 0;
    status.textContent = currentRange.recorded ? "" : "No daily counts were archived for this interval. Missing data is not zero visits.";
    find("visits-point-info").textContent = "Select a day to see its recorded count.";
    find("visits-table-caption").textContent = `Daily counts: ${formatDate(from)} – ${formatDate(to)} (Europe/Berlin)`;
    renderChart();
    renderTable();
  }

  root.querySelectorAll("[data-visits-range]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!archive) return;
      const preset = button.dataset.visitsRange;
      const range = presetRange(preset, archive.start_date, archive.as_of);
      selectRange(range.from, range.to, preset);
    });
  });

  find("visits-range-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!archive) return;
    const from = fromInput.value;
    const to = toInput.value;
    let message = "";
    if (!validDate(from) || !validDate(to)) message = "Choose a valid start and end date.";
    else if (from > to) message = "The start date must be on or before the end date.";
    else if (from < archive.start_date || to > archive.as_of) message = `Choose dates between ${formatDate(archive.start_date)} and ${formatDate(archive.as_of)}.`;
    if (message) {
      rangeError.textContent = message;
      rangeError.hidden = false;
      fromInput.setAttribute("aria-invalid", "true");
      toInput.setAttribute("aria-invalid", "true");
      return;
    }
    selectRange(from, to);
  });

  function inspectPointer(event) {
    if (!currentRange || !chartGeometry) return;
    const rect = chart.getBoundingClientRect();
    const localX = (event.clientX - rect.left) / rect.width * chartGeometry.width;
    const ratio = (localX - chartGeometry.left) / (chartGeometry.right - chartGeometry.left);
    highlightDay(Math.round(ratio * (currentRange.days.length - 1)));
  }
  chart.addEventListener("pointermove", inspectPointer);
  chart.addEventListener("click", (event) => { inspectPointer(event); chart.focus({ preventScroll: true }); });
  chart.addEventListener("focus", () => { if (activeDay === null) highlightDay(0); });
  chart.addEventListener("keydown", (event) => {
    if (!currentRange) return;
    const last = currentRange.days.length - 1;
    const targets = { ArrowLeft: (activeDay ?? 0) - 1, ArrowRight: (activeDay ?? -1) + 1, Home: 0, End: last };
    if (Object.hasOwn(targets, event.key)) {
      event.preventDefault();
      highlightDay(targets[event.key]);
    }
  });
  find("visits-table-details").addEventListener("toggle", renderTable);
  if (window.ResizeObserver) new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(renderChart);
  }).observe(chartWrap);
  else window.addEventListener("resize", renderChart);

  async function initialize() {
    try {
      if (!window.WvwVisitsData?.load) throw new Error("Visit data loader unavailable");
      archive = await window.WvwVisitsData.load();
      if (!archive || !Array.isArray(archive.daily)) throw new Error("Visit archive unavailable");
      if (!archive.daily.length || !archive.start_date || !archive.as_of) {
        find("visits-freshness").textContent = "No completed days have been published yet.";
        status.textContent = "Visit counts are not available yet. No count is being assumed.";
        return;
      }
      find("visits-freshness").textContent = `${window.WvwVisitsData.isLocalPreview ? "Local preview snapshot" : "Completed days"} through ${formatDate(archive.as_of)} · Europe/Berlin`;
      find("visits-estimates-note").textContent = `${archive.estimated ? "These archived counts include estimates from sampled analytics." : "Archived visit counts reflect the analytics records available when collected."} Only completed calendar days in Europe/Berlin are included; missing days are left as gaps.`;
      if (archive.partial_dates.length) {
        const note = find("visits-partial-note");
        note.hidden = false;
        note.textContent = `Tracking-day caveats: ${archive.partial_dates.map(formatDate).join("; ")}. Tracking may cover only part of an initial day. On a beacon handover day, the separately recorded old and new counts are added; people are not deduplicated across those sources.`;
      }
      fromInput.min = toInput.min = archive.start_date;
      fromInput.max = toInput.max = archive.as_of;
      controls.disabled = false;
      const range = presetRange("1M", archive.start_date, archive.as_of);
      selectRange(range.from, range.to, "1M");
    } catch {
      archive = null;
      find("visits-freshness").textContent = "The visit archive could not be loaded.";
      status.hidden = false;
      status.textContent = "Visit counts are temporarily unavailable. Please try again later; this does not mean there have been no visits.";
    } finally {
      root.setAttribute("aria-busy", "false");
    }
  }
  initialize();
})();
