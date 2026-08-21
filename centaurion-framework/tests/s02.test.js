'use strict';

const {
  SUPPORTED_PROVIDERS,
  TerraSandboxError,
  isSupportedProvider,
  listSupportedProviders,
  createSandboxClient,
  validateWebhookPayload,
  normalizeActivityRecord,
  parseWebhookPayload,
} = require('../src/s02/index.js');

describe('s02 Terra wearable sandbox client', () => {
  describe('provider support', () => {
    test('lists supported providers as a copy', () => {
      const providers = listSupportedProviders();
      expect(providers).toEqual(Array.from(SUPPORTED_PROVIDERS));
      providers.push('HACKED');
      expect(listSupportedProviders()).not.toContain('HACKED');
    });

    test('isSupportedProvider matches case-insensitively', () => {
      expect(isSupportedProvider('garmin')).toBe(true);
      expect(isSupportedProvider('GARMIN')).toBe(true);
      expect(isSupportedProvider('Fitbit')).toBe(true);
    });

    test('isSupportedProvider rejects unknown or invalid input', () => {
      expect(isSupportedProvider('strava')).toBe(false);
      expect(isSupportedProvider('')).toBe(false);
      expect(isSupportedProvider(null)).toBe(false);
      expect(isSupportedProvider(42)).toBe(false);
    });
  });

  describe('createSandboxClient', () => {
    test('defaults to a sandbox api key when none provided', () => {
      const client = createSandboxClient();
      expect(client.apiKey).toBe('sandbox-dev-key');
    });

    test('uses provided api key', () => {
      const client = createSandboxClient({ apiKey: 'my-key' });
      expect(client.apiKey).toBe('my-key');
    });

    test('connectUser creates a connection record', () => {
      const client = createSandboxClient();
      const connection = client.connectUser('user-1', 'garmin');
      expect(connection.userId).toBe('user-1');
      expect(connection.provider).toBe('GARMIN');
      expect(connection.status).toBe('connected');
      expect(connection.referenceId).toBe('sandbox-user-1-GARMIN');
      expect(typeof connection.connectedAt).toBe('string');
    });

    test('connectUser throws for missing userId', () => {
      const client = createSandboxClient();
      expect(() => client.connectUser(undefined, 'garmin')).toThrow(TerraSandboxError);
      expect(() => client.connectUser('', 'garmin')).toThrow(/userId is required/);
    });

    test('connectUser throws for unsupported provider', () => {
      const client = createSandboxClient();
      expect(() => client.connectUser('user-1', 'strava')).toThrow(TerraSandboxError);
      expect(() => client.connectUser('user-1', 'strava')).toThrow(/Unsupported provider/);
    });

    test('getConnection returns the stored connection or null', () => {
      const client = createSandboxClient();
      expect(client.getConnection('missing')).toBeNull();
      client.connectUser('user-2', 'oura');
      const found = client.getConnection('user-2');
      expect(found.provider).toBe('OURA');
    });

    test('disconnectUser removes a connection and reports success', () => {
      const client = createSandboxClient();
      client.connectUser('user-3', 'whoop');
      expect(client.disconnectUser('user-3')).toBe(true);
      expect(client.getConnection('user-3')).toBeNull();
      expect(client.disconnectUser('user-3')).toBe(false);
    });

    test('listConnections returns all currently connected users', () => {
      const client = createSandboxClient();
      client.connectUser('user-4', 'apple');
      client.connectUser('user-5', 'google');
      const list = client.listConnections();
      expect(list).toHaveLength(2);
      const userIds = list.map((c) => c.userId).sort();
      expect(userIds).toEqual(['user-4', 'user-5']);
    });

    test('multiple clients maintain independent connection state', () => {
      const clientA = createSandboxClient();
      const clientB = createSandboxClient();
      clientA.connectUser('shared-id', 'garmin');
      expect(clientB.getConnection('shared-id')).toBeNull();
    });
  });

  describe('validateWebhookPayload', () => {
    test('accepts a well-formed payload', () => {
      const result = validateWebhookPayload({
        user: { user_id: 'abc123' },
        type: 'activity',
        data: [],
      });
      expect(result).toEqual({ valid: true, errors: [] });
    });

    test('rejects a non-object payload', () => {
      const result = validateWebhookPayload(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('payload must be an object');
    });

    test('collects multiple missing-field errors', () => {
      const result = validateWebhookPayload({});
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'user.user_id is required',
          'type is required',
          'data must be an array',
        ])
      );
    });
  });

  describe('normalizeActivityRecord', () => {
    test('extracts provider, timing, calories and heart rate fields', () => {
      const record = {
        metadata: { provider: 'garmin', start_time: '2024-01-01T00:00:00Z', end_time: '2024-01-01T01:00:00Z' },
        calories_data: { total_burned_calories: 512.5 },
        heart_rate_data: { summary: { avg_hr_bpm: 128 } },
      };
      expect(normalizeActivityRecord(record)).toEqual({
        provider: 'GARMIN',
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-01T01:00:00Z',
        caloriesBurned: 512.5,
        avgHeartRate: 128,
      });
    });

    test('fills in defaults for missing nested fields', () => {
      expect(normalizeActivityRecord({})).toEqual({
        provider: 'UNKNOWN',
        startTime: null,
        endTime: null,
        caloriesBurned: null,
        avgHeartRate: null,
      });
    });

    test('throws TerraSandboxError for non-object records', () => {
      expect(() => normalizeActivityRecord(null)).toThrow(TerraSandboxError);
      expect(() => normalizeActivityRecord(5)).toThrow(/record must be an object/);
    });
  });

  describe('parseWebhookPayload', () => {
    test('parses a valid payload into userId/type/records', () => {
      const payload = {
        user: { user_id: 'user-9' },
        type: 'daily',
        data: [
          {
            metadata: { provider: 'fitbit', start_time: 't0', end_time: 't1' },
            calories_data: { total_burned_calories: 200 },
            heart_rate_data: { summary: { avg_hr_bpm: 70 } },
          },
        ],
      };
      const parsed = parseWebhookPayload(payload);
      expect(parsed.userId).toBe('user-9');
      expect(parsed.type).toBe('daily');
      expect(parsed.records).toHaveLength(1);
      expect(parsed.records[0]).toEqual({
        provider: 'FITBIT',
        startTime: 't0',
        endTime: 't1',
        caloriesBurned: 200,
        avgHeartRate: 70,
      });
    });

    test('throws TerraSandboxError with combined messages for invalid payload', () => {
      expect(() => parseWebhookPayload({})).toThrow(TerraSandboxError);
      expect(() => parseWebhookPayload({})).toThrow(/Invalid webhook payload/);
    });
  });
});

