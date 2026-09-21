'use strict';

const {
  toDate,
  toCSV,
  toNDJSON,
  summarizeByProvider,
  filterByDateRange,
  groupByDay,
} = require('../src/s02/exportFormat');

describe('s02 exportFormat (additive reporting helpers)', () => {
  const sampleEvents = [
    { user_id: 'u1', provider: 'fitbit', type: 'sleep', timestamp: '2024-01-01T10:00:00.000Z', value: 7.5 },
    { user_id: 'u2', provider: 'garmin', type: 'steps', timestamp: '2024-01-01T15:30:00.000Z', value: 10000 },
    { user_id: 'u1', provider: 'fitbit', type: 'heart_rate', timestamp: '2024-01-02T08:00:00.000Z', value: 62 },
  ];

  describe('toDate', () => {
    test('parses an ISO string into a Date', () => {
      const d = toDate('2024-01-01T10:00:00.000Z');
      expect(d).toBeInstanceOf(Date);
      expect(d.toISOString()).toBe('2024-01-01T10:00:00.000Z');
    });

    test('parses epoch milliseconds into a Date', () => {
      const d = toDate(0);
      expect(d.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    });

    test('returns Date instances unchanged', () => {
      const original = new Date('2024-06-01T00:00:00.000Z');
      expect(toDate(original)).toBe(original);
    });

    test('throws on an unparsable string', () => {
      expect(() => toDate('not-a-date')).toThrow();
    });

    test('throws on an unsupported type', () => {
      expect(() => toDate({})).toThrow();
      expect(() => toDate(undefined)).toThrow();
    });
  });

  describe('toCSV', () => {
    test('throws a TypeError when events is not an array', () => {
      expect(() => toCSV(null)).toThrow(TypeError);
      expect(() => toCSV('nope')).toThrow(TypeError);
    });

    test('produces a header row and one row per event with default columns', () => {
      const csv = toCSV(sampleEvents);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('user_id,provider,type,timestamp,value');
      expect(lines.length).toBe(4);
      expect(lines[1]).toBe('u1,fitbit,sleep,2024-01-01T10:00:00.000Z,7.5');
    });

    test('supports custom column selection and ordering', () => {
      const csv = toCSV(sampleEvents, ['value', 'user_id']);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('value,user_id');
      expect(lines[1]).toBe('7.5,u1');
    });

    test('escapes commas and embedded quotes per CSV rules', () => {
      const note = 'hello, "world"';
      const events = [{ user_id: 'u1', note }];
      const csv = toCSV(events, ['user_id', 'note']);
      const expectedNote = '"' + note.replace(/"/g, '""') + '"';
      expect(csv.split('\n')[1]).toBe(`u1,${expectedNote}`);
    });

    test('returns only a header line for an empty events array', () => {
      const csv = toCSV([]);
      expect(csv).toBe('user_id,provider,type,timestamp,value');
    });

    test('renders missing fields as empty CSV cells', () => {
      const csv = toCSV([{ user_id: 'u1' }]);
      expect(csv.split('\n')[1]).toBe('u1,,,,');
    });
  });

  describe('toNDJSON', () => {
    test('throws a TypeError when events is not an array', () => {
      expect(() => toNDJSON({})).toThrow(TypeError);
    });

    test('produces one JSON line per event, preserving data', () => {
      const nd = toNDJSON(sampleEvents);
      const lines = nd.split('\n');
      expect(lines.length).toBe(3);
      expect(JSON.parse(lines[0])).toEqual(sampleEvents[0]);
      expect(JSON.parse(lines[2])).toEqual(sampleEvents[2]);
    });

    test('returns an empty string for an empty array', () => {
      expect(toNDJSON([])).toBe('');
    });
  });

  describe('summarizeByProvider', () => {
    test('throws a TypeError when events is not an array', () => {
      expect(() => summarizeByProvider(undefined)).toThrow(TypeError);
    });

    test('counts events grouped by provider', () => {
      const summary = summarizeByProvider(sampleEvents);
      expect(summary.fitbit.count).toBe(2);
      expect(summary.garmin.count).toBe(1);
    });

    test('computes first and last timestamps per provider', () => {
      const summary = summarizeByProvider(sampleEvents);
      expect(summary.fitbit.first).toBe('2024-01-01T10:00:00.000Z');
      expect(summary.fitbit.last).toBe('2024-01-02T08:00:00.000Z');
      expect(summary.garmin.first).toBe('2024-01-01T15:30:00.000Z');
      expect(summary.garmin.last).toBe('2024-01-01T15:30:00.000Z');
    });

    test('defaults events with no provider to "unknown"', () => {
      const summary = summarizeByProvider([{ timestamp: '2024-01-01T00:00:00.000Z' }]);
      expect(summary.unknown.count).toBe(1);
    });

    test('returns an empty object for an empty array', () => {
      expect(summarizeByProvider([])).toEqual({});
    });
  });

  describe('filterByDateRange', () => {
    test('throws a TypeError when events is not an array', () => {
      expect(() => filterByDateRange(null)).toThrow(TypeError);
    });

    test('filters events within an inclusive date range', () => {
      const filtered = filterByDateRange(
        sampleEvents,
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T23:59:59.999Z',
      );
      expect(filtered.length).toBe(2);
      expect(filtered.every((e) => e.timestamp.startsWith('2024-01-01'))).toBe(true);
    });

    test('returns all events when no bounds are given', () => {
      expect(filterByDateRange(sampleEvents).length).toBe(3);
    });

    test('returns an empty array when no events match the range', () => {
      const filtered = filterByDateRange(
        sampleEvents,
        '2025-01-01T00:00:00.000Z',
        '2025-01-02T00:00:00.000Z',
      );
      expect(filtered).toEqual([]);
    });
  });

  describe('groupByDay', () => {
    test('throws a TypeError when events is not an array', () => {
      expect(() => groupByDay(42)).toThrow(TypeError);
    });

    test('groups events by their ISO calendar day', () => {
      const groups = groupByDay(sampleEvents);
      expect(Object.keys(groups).sort()).toEqual(['2024-01-01', '2024-01-02']);
      expect(groups['2024-01-01'].length).toBe(2);
      expect(groups['2024-01-02'].length).toBe(1);
    });

    test('returns an empty object for an empty array', () => {
      expect(groupByDay([])).toEqual({});
    });
  });
});

