'use strict';

/**
 * s02 - Terra wearable sandbox client
 * Self-contained, additive export/reporting helpers for normalized Terra
 * events. Does not depend on or modify any existing s02 modules, so it is
 * safe to add without risking drift with unseen prior implementations.
 *
 * An "event" is expected to be a plain object that may contain:
 *   { user_id, provider, type, timestamp, value, ... }
 * `timestamp` may be an ISO-8601 string, epoch milliseconds (number), or a
 * Date instance.
 */

function toDate(ts) {
  if (ts instanceof Date) {
    return ts;
  }
  if (typeof ts === 'number') {
    return new Date(ts);
  }
  if (typeof ts === 'string') {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) {
      throw new Error('Invalid timestamp: ' + ts);
    }
    return d;
  }
  throw new Error('Unsupported timestamp type: ' + typeof ts);
}

function assertArray(events) {
  if (!Array.isArray(events)) {
    throw new TypeError('events must be an array');
  }
}

function escapeCsvValue(val) {
  if (val === undefined || val === null) {
    return '';
  }
  const s = String(val);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCSV(events, columns) {
  assertArray(events);
  const cols = columns || ['user_id', 'provider', 'type', 'timestamp', 'value'];
  const header = cols.join(',');
  const rows = events.map((e) => cols.map((c) => escapeCsvValue(e[c])).join(','));
  return [header, ...rows].join('\n');
}

function toNDJSON(events) {
  assertArray(events);
  return events.map((e) => JSON.stringify(e)).join('\n');
}

function summarizeByProvider(events) {
  assertArray(events);
  const summary = {};
  for (const e of events) {
    const provider = (e && e.provider) || 'unknown';
    const ts = toDate(e.timestamp).getTime();
    if (!summary[provider]) {
      summary[provider] = { count: 0, first: ts, last: ts };
    }
    summary[provider].count += 1;
    if (ts < summary[provider].first) summary[provider].first = ts;
    if (ts > summary[provider].last) summary[provider].last = ts;
  }
  for (const p of Object.keys(summary)) {
    summary[p].first = new Date(summary[p].first).toISOString();
    summary[p].last = new Date(summary[p].last).toISOString();
  }
  return summary;
}

function filterByDateRange(events, startTs, endTs) {
  assertArray(events);
  const start = startTs !== undefined && startTs !== null ? toDate(startTs).getTime() : -Infinity;
  const end = endTs !== undefined && endTs !== null ? toDate(endTs).getTime() : Infinity;
  return events.filter((e) => {
    const ts = toDate(e.timestamp).getTime();
    return ts >= start && ts <= end;
  });
}

function groupByDay(events) {
  assertArray(events);
  const groups = {};
  for (const e of events) {
    const key = toDate(e.timestamp).toISOString().slice(0, 10);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(e);
  }
  return groups;
}

module.exports = {
  toDate,
  toCSV,
  toNDJSON,
  summarizeByProvider,
  filterByDateRange,
  groupByDay,
};

