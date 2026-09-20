'use strict';

const { paginate, mergeProviderPayloads } = require('../src/s02/pagination');

describe('s02 pagination helper', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  test('defaults to page 1 with pageSize 10', () => {
    const result = paginate(items);
    expect(result.data).toEqual(items.slice(0, 10));
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
  });

  test('returns correct slice for a middle page', () => {
    const result = paginate(items, { page: 2, pageSize: 10 });
    expect(result.data).toEqual(items.slice(10, 20));
  });

  test('returns the final partial page', () => {
    const result = paginate(items, { page: 3, pageSize: 10 });
    expect(result.data).toEqual(items.slice(20, 25));
    expect(result.data).toHaveLength(5);
  });

  test('computes totalItems and totalPages correctly', () => {
    const result = paginate(items, { page: 1, pageSize: 10 });
    expect(result.totalItems).toBe(25);
    expect(result.totalPages).toBe(3);
  });

  test('clamps page beyond totalPages to the last page', () => {
    const result = paginate(items, { page: 99, pageSize: 10 });
    expect(result.page).toBe(3);
    expect(result.data).toEqual(items.slice(20, 25));
  });

  test('handles pageSize larger than the whole array', () => {
    const result = paginate(items, { page: 1, pageSize: 100 });
    expect(result.data).toEqual(items);
    expect(result.totalPages).toBe(1);
  });

  test('handles an empty array', () => {
    const result = paginate([], { page: 1, pageSize: 10 });
    expect(result.data).toEqual([]);
    expect(result.totalItems).toBe(0);
    expect(result.totalPages).toBe(1);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(false);
  });

  test('hasNext is true when more pages remain', () => {
    const result = paginate(items, { page: 1, pageSize: 10 });
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(false);
  });

  test('hasPrev is true and hasNext is false on the final page', () => {
    const result = paginate(items, { page: 3, pageSize: 10 });
    expect(result.hasPrev).toBe(true);
    expect(result.hasNext).toBe(false);
  });

  test('throws TypeError when items is not an array', () => {
    expect(() => paginate('not-an-array')).toThrow(TypeError);
  });

  test('throws RangeError when page < 1', () => {
    expect(() => paginate(items, { page: 0 })).toThrow(RangeError);
  });

  test('throws RangeError when pageSize < 1', () => {
    expect(() => paginate(items, { pageSize: 0 })).toThrow(RangeError);
  });

  test('throws RangeError when page is not an integer', () => {
    expect(() => paginate(items, { page: 1.5 })).toThrow(RangeError);
  });
});

describe('s02 mergeProviderPayloads helper', () => {
  test('groups events by userId', () => {
    const payloads = [
      { userId: 'u1', provider: 'fitbit', type: 'sleep', timestamp: '2024-01-01T00:00:00Z' },
      { userId: 'u2', provider: 'oura', type: 'sleep', timestamp: '2024-01-01T01:00:00Z' },
    ];
    const result = mergeProviderPayloads(payloads);
    expect(Object.keys(result).sort()).toEqual(['u1', 'u2']);
  });

  test('counts events per provider for a user', () => {
    const payloads = [
      { userId: 'u1', provider: 'fitbit', type: 'sleep', timestamp: '2024-01-01T00:00:00Z' },
      { userId: 'u1', provider: 'fitbit', type: 'activity', timestamp: '2024-01-01T02:00:00Z' },
      { userId: 'u1', provider: 'garmin', type: 'sleep', timestamp: '2024-01-01T03:00:00Z' },
    ];
    const result = mergeProviderPayloads(payloads);
    expect(result.u1.providers).toEqual({ fitbit: 2, garmin: 1 });
  });

  test('sorts events chronologically regardless of input order', () => {
    const payloads = [
      { userId: 'u1', provider: 'fitbit', type: 'sleep', timestamp: '2024-01-02T00:00:00Z' },
      { userId: 'u1', provider: 'garmin', type: 'activity', timestamp: '2024-01-01T00:00:00Z' },
    ];
    const result = mergeProviderPayloads(payloads);
    expect(result.u1.events[0].provider).toBe('garmin');
    expect(result.u1.events[1].provider).toBe('fitbit');
  });

  test('defaults data field to null when omitted', () => {
    const payloads = [
      { userId: 'u1', provider: 'fitbit', type: 'sleep', timestamp: '2024-01-01T00:00:00Z' },
    ];
    const result = mergeProviderPayloads(payloads);
    expect(result.u1.events[0].data).toBeNull();
  });

  test('preserves data field when provided', () => {
    const payloads = [
      { userId: 'u1', provider: 'fitbit', type: 'sleep', timestamp: '2024-01-01T00:00:00Z', data: { hours: 7 } },
    ];
    const result = mergeProviderPayloads(payloads);
    expect(result.u1.events[0].data).toEqual({ hours: 7 });
  });

  test('handles multiple independent users', () => {
    const payloads = [
      { userId: 'u1', provider: 'fitbit', type: 'sleep', timestamp: '2024-01-01T00:00:00Z' },
      { userId: 'u2', provider: 'fitbit', type: 'sleep', timestamp: '2024-01-01T00:00:00Z' },
    ];
    const result = mergeProviderPayloads(payloads);
    expect(result.u1.providers.fitbit).toBe(1);
    expect(result.u2.providers.fitbit).toBe(1);
  });

  test('throws TypeError when payloads is not an array', () => {
    expect(() => mergeProviderPayloads({})).toThrow(TypeError);
  });

  test('throws TypeError when a payload is missing userId', () => {
    const payloads = [{ provider: 'fitbit', type: 'sleep', timestamp: '2024-01-01T00:00:00Z' }];
    expect(() => mergeProviderPayloads(payloads)).toThrow(TypeError);
  });

  test('throws TypeError when a payload is missing provider', () => {
    const payloads = [{ userId: 'u1', type: 'sleep', timestamp: '2024-01-01T00:00:00Z' }];
    expect(() => mergeProviderPayloads(payloads)).toThrow(TypeError);
  });

  test('throws TypeError when a payload is missing type', () => {
    const payloads = [{ userId: 'u1', provider: 'fitbit', timestamp: '2024-01-01T00:00:00Z' }];
    expect(() => mergeProviderPayloads(payloads)).toThrow(TypeError);
  });

  test('throws TypeError when a payload is missing timestamp', () => {
    const payloads = [{ userId: 'u1', provider: 'fitbit', type: 'sleep' }];
    expect(() => mergeProviderPayloads(payloads)).toThrow(TypeError);
  });

  test('throws TypeError when a payload has an invalid timestamp', () => {
    const payloads = [{ userId: 'u1', provider: 'fitbit', type: 'sleep', timestamp: 'not-a-date' }];
    expect(() => mergeProviderPayloads(payloads)).toThrow(TypeError);
  });

  test('throws TypeError when a payload entry is not an object', () => {
    const payloads = ['not-an-object'];
    expect(() => mergeProviderPayloads(payloads)).toThrow(TypeError);
  });

  test('returns empty object for empty payload list', () => {
    expect(mergeProviderPayloads([])).toEqual({});
  });
});

