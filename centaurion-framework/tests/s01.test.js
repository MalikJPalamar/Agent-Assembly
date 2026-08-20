'use strict';

const { TABLES, validateReading, loadSchemaSql } = require('../src/s01/index.js');

describe('s01: Supabase schema module', () => {
  describe('TABLES', () => {
    it('exports the three expected table names', () => {
      expect(TABLES).toEqual(
        expect.arrayContaining(['users', 'sessions', 'biomarker_readings'])
      );
      expect(TABLES).toHaveLength(3);
    });
  });

  describe('loadSchemaSql', () => {
    const sql = loadSchemaSql();

    it('returns a non-empty string', () => {
      expect(typeof sql).toBe('string');
      expect(sql.length).toBeGreaterThan(0);
    });

    it.each(TABLES)('contains a CREATE TABLE statement for %s', (table) => {
      const re = new RegExp(`CREATE TABLE[^;]*\\b${table}\\b`, 'i');
      expect(sql).toMatch(re);
    });

    it('defines a foreign key from sessions to users', () => {
      expect(sql).toMatch(/sessions[\s\S]*REFERENCES\s+users/i);
    });

    it('defines foreign keys from biomarker_readings to users and sessions', () => {
      expect(sql).toMatch(/biomarker_readings[\s\S]*REFERENCES\s+users/i);
      expect(sql).toMatch(/biomarker_readings[\s\S]*REFERENCES\s+sessions/i);
    });

    it('creates an index on (user_id, recorded_at)', () => {
      expect(sql).toMatch(/CREATE INDEX[^;]*\(\s*user_id\s*,\s*recorded_at\s*\)/i);
    });
  });

  describe('validateReading', () => {
    const validReading = {
      user_id: 'user-123',
      session_id: 'session-456',
      metric: 'heart_rate',
      value: 72,
      unit: 'bpm',
      recorded_at: '2026-01-01T00:00:00Z',
      source: 'terra',
    };

    it('accepts a fully valid reading', () => {
      const result = validateReading(validReading);
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts a Date instance for recorded_at', () => {
      const result = validateReading({ ...validReading, recorded_at: new Date() });
      expect(result.ok).toBe(true);
    });

    it('rejects a reading missing required fields', () => {
      const { user_id, ...rest } = validReading;
      const result = validateReading(rest);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('user_id'))).toBe(true);
    });

    it('rejects a reading with multiple missing fields and reports each', () => {
      const result = validateReading({ metric: 'hrv' });
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    });

    it('rejects a non-numeric value', () => {
      const result = validateReading({ ...validReading, value: 'seventy-two' });
      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining(['value must be numeric']));
    });

    it('rejects NaN as a value', () => {
      const result = validateReading({ ...validReading, value: NaN });
      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining(['value must be numeric']));
    });

    it('rejects an invalid recorded_at string', () => {
      const result = validateReading({ ...validReading, recorded_at: 'not-a-date' });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('recorded_at'))).toBe(true);
    });

    it('rejects an empty string for metric', () => {
      const result = validateReading({ ...validReading, metric: '   ' });
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('metric'))).toBe(true);
    });

    it('rejects null and non-object inputs', () => {
      expect(validateReading(null).ok).toBe(false);
      expect(validateReading('reading').ok).toBe(false);
      expect(validateReading(42).ok).toBe(false);
      expect(validateReading([]).ok).toBe(false);
    });
  });
});

