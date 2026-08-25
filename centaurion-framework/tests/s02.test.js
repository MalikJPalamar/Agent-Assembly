'use strict';

const {
  SUPPORTED_PROVIDERS,
  SUPPORTED_TYPES,
  SandboxClient,
  validateWebhookPayload,
  normalizeWebhookPayload,
  EventLog,
  ingestWebhookBatch,
  getTerraWebhookSchema,
} = require('../src/s02/index.js');

describe('module constants', () => {
  test('SUPPORTED_PROVIDERS is a non-empty array of strings', () => {
    expect(Array.isArray(SUPPORTED_PROVIDERS)).toBe(true);
    expect(SUPPORTED_PROVIDERS.length).toBeGreaterThan(0);
  });

  test('SUPPORTED_TYPES is a non-empty array of strings', () => {
    expect(Array.isArray(SUPPORTED_TYPES)).toBe(true);
    expect(SUPPORTED_TYPES.length).toBeGreaterThan(0);
  });
});

describe('SandboxClient.connectUser', () => {
  test('connects a valid user with a valid provider', () => {
    const client = new SandboxClient();
    const conn = client.connectUser('user-1', 'garmin');
    expect(conn.userId).toBe('user-1');
    expect(conn.provider).toBe('garmin');
  });

  test('returns a connection object with connectedAt timestamp', () => {
    const client = new SandboxClient();
    const conn = client.connectUser('user-1', 'fitbit');
    expect(typeof conn.connectedAt).toBe('string');
    expect(Number.isNaN(new Date(conn.connectedAt).getTime())).toBe(false);
  });

  test('throws when userId is missing', () => {
    const client = new SandboxClient();
    expect(() => client.connectUser(undefined, 'garmin')).toThrow();
  });

  test('throws when userId is an empty string', () => {
    const client = new SandboxClient();
    expect(() => client.connectUser('   ', 'garmin')).toThrow();
  });

  test('throws on unsupported provider', () => {
    const client = new SandboxClient();
    expect(() => client.connectUser('user-1', 'notreal')).toThrow(/unsupported provider/);
  });

  test('reconnecting the same user updates the provider', () => {
    const client = new SandboxClient();
    client.connectUser('user-1', 'garmin');
    client.connectUser('user-1', 'oura');
    expect(client.getConnection('user-1').provider).toBe('oura');
  });
});

describe('SandboxClient.disconnectUser', () => {
  test('returns true when disconnecting an existing user', () => {
    const client = new SandboxClient();
    client.connectUser('user-1', 'garmin');
    expect(client.disconnectUser('user-1')).toBe(true);
  });

  test('returns false when disconnecting a non-existing user', () => {
    const client = new SandboxClient();
    expect(client.disconnectUser('ghost')).toBe(false);
  });

  test('isConnected returns false after disconnect', () => {
    const client = new SandboxClient();
    client.connectUser('user-1', 'garmin');
    client.disconnectUser('user-1');
    expect(client.isConnected('user-1')).toBe(false);
  });
});

describe('SandboxClient.isConnected', () => {
  test('returns true for a connected user', () => {
    const client = new SandboxClient();
    client.connectUser('user-1', 'garmin');
    expect(client.isConnected('user-1')).toBe(true);
  });

  test('returns false for an unknown user', () => {
    const client = new SandboxClient();
    expect(client.isConnected('unknown')).toBe(false);
  });
});

describe('SandboxClient.getConnection', () => {
  test('returns a copy of the connection data', () => {
    const client = new SandboxClient();
    client.connectUser('user-1', 'garmin');
    const a = client.getConnection('user-1');
    a.provider = 'mutated';
    expect(client.getConnection('user-1').provider).toBe('garmin');
  });

  test('returns undefined for an unknown user', () => {
    const client = new SandboxClient();
    expect(client.getConnection('unknown')).toBeUndefined();
  });
});

describe('SandboxClient.listConnections', () => {
  test('returns an empty array initially', () => {
    const client = new SandboxClient();
    expect(client.listConnections()).toEqual([]);
  });

  test('returns all connected users', () => {
    const client = new SandboxClient();
    client.connectUser('user-1', 'garmin');
    client.connectUser('user-2', 'fitbit');
    const list = client.listConnections();
    expect(list.length).toBe(2);
    expect(list.map((c) => c.userId).sort()).toEqual(['user-1', 'user-2']);
  });

  test('returned entries are independent copies', () => {
    const client = new SandboxClient();
    client.connectUser('user-1', 'garmin');
    const list = client.listConnections();
    list[0].provider = 'mutated';
    expect(client.getConnection('user-1').provider).toBe('garmin');
  });
});

function basePayload(overrides = {}) {
  return {
    user_id: 'user-1',
    type: 'activity',
    provider: 'garmin',
    timestamp: '2024-01-01T00:00:00.000Z',
    data: { steps: 1000 },
    ...overrides,
  };
}

describe('validateWebhookPayload', () => {
  test('valid for activity type', () => {
    expect(validateWebhookPayload(basePayload({ type: 'activity' })).valid).toBe(true);
  });

  test('valid for sleep type', () => {
    expect(validateWebhookPayload(basePayload({ type: 'sleep' })).valid).toBe(true);
  });

  test('valid for body type', () => {
    expect(validateWebhookPayload(basePayload({ type: 'body' })).valid).toBe(true);
  });

  test('valid for daily type', () => {
    expect(validateWebhookPayload(basePayload({ type: 'daily' })).valid).toBe(true);
  });

  test('invalid when payload is null', () => {
    const res = validateWebhookPayload(null);
    expect(res.valid).toBe(false);
  });

  test('invalid when payload is not an object', () => {
    const res = validateWebhookPayload('nope');
    expect(res.valid).toBe(false);
  });

  test('invalid when user_id is missing', () => {
    const res = validateWebhookPayload(basePayload({ user_id: undefined }));
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/user_id/);
  });

  test('invalid when user_id is an empty string', () => {
    const res = validateWebhookPayload(basePayload({ user_id: '   ' }));
    expect(res.valid).toBe(false);
  });

  test('invalid when type is missing', () => {
    const res = validateWebhookPayload(basePayload({ type: undefined }));
    expect(res.valid).toBe(false);
  });

  test('invalid when type is unsupported', () => {
    const res = validateWebhookPayload(basePayload({ type: 'bogus' }));
    expect(res.valid).toBe(false);
    expect(res.errors.join(' ')).toMatch(/type must be one of/);
  });

  test('invalid when timestamp is missing', () => {
    const res = validateWebhookPayload(basePayload({ timestamp: undefined }));
    expect(res.valid).toBe(false);
  });

  test('invalid when timestamp is not a valid date string', () => {
    const res = validateWebhookPayload(basePayload({ timestamp: 'not-a-date' }));
    expect(res.valid).toBe(false);
  });

  test('invalid when data is missing', () => {
    const res = validateWebhookPayload(basePayload({ data: undefined }));
    expect(res.valid).toBe(false);
  });

  test('invalid when data is an array', () => {
    const res = validateWebhookPayload(basePayload({ data: [1, 2, 3] }));
    expect(res.valid).toBe(false);
  });

  test('accumulates multiple errors', () => {
    const res = validateWebhookPayload({});
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('normalizeWebhookPayload', () => {
  test('normalizes a valid activity payload', () => {
    const normalized = normalizeWebhookPayload(basePayload());
    expect(normalized.userId).toBe('user-1');
    expect(normalized.type).toBe('activity');
    expect(normalized.provider).toBe('garmin');
    expect(normalized.data).toEqual({ steps: 1000 });
  });

  test('trims whitespace from user_id', () => {
    const normalized = normalizeWebhookPayload(basePayload({ user_id: '  user-1  ' }));
    expect(normalized.userId).toBe('user-1');
  });

  test('defaults provider to unknown when missing', () => {
    const normalized = normalizeWebhookPayload(basePayload({ provider: undefined }));
    expect(normalized.provider).toBe('unknown');
  });

  test('preserves provider when present', () => {
    const normalized = normalizeWebhookPayload(basePayload({ provider: 'oura' }));
    expect(normalized.provider).toBe('oura');
  });

  test('converts timestamp to an ISO string', () => {
    const normalized = normalizeWebhookPayload(basePayload({ timestamp: '2024-06-01T12:00:00Z' }));
    expect(normalized.timestamp).toBe(new Date('2024-06-01T12:00:00Z').toISOString());
  });

  test('throws for an invalid payload', () => {
    expect(() => normalizeWebhookPayload(basePayload({ type: 'bogus' }))).toThrow(/Invalid webhook payload/);
  });

  test('does not mutate the original data object', () => {
    const payload = basePayload();
    const normalized = normalizeWebhookPayload(payload);
    normalized.data.steps = 9999;
    expect(payload.data.steps).toBe(1000);
  });
});

describe('EventLog', () => {
  test('starts empty', () => {
    const log = new EventLog();
    expect(log.size()).toBe(0);
    expect(log.getAll()).toEqual([]);
  });

  test('append adds an event and stamps loggedAt', () => {
    const log = new EventLog();
    const stored = log.append({ userId: 'user-1', type: 'activity' });
    expect(stored.userId).toBe('user-1');
    expect(typeof stored.loggedAt).toBe('string');
  });

  test('getAll returns all appended events', () => {
    const log = new EventLog();
    log.append({ userId: 'user-1', type: 'activity' });
    log.append({ userId: 'user-2', type: 'sleep' });
    expect(log.getAll().length).toBe(2);
  });

  test('size returns the number of events', () => {
    const log = new EventLog();
    log.append({ userId: 'user-1', type: 'activity' });
    log.append({ userId: 'user-1', type: 'sleep' });
    expect(log.size()).toBe(2);
  });

  test('filterByUser returns only matching events', () => {
    const log = new EventLog();
    log.append({ userId: 'user-1', type: 'activity' });
    log.append({ userId: 'user-2', type: 'activity' });
    expect(log.filterByUser('user-1').length).toBe(1);
  });

  test('filterByType returns only matching events', () => {
    const log = new EventLog();
    log.append({ userId: 'user-1', type: 'activity' });
    log.append({ userId: 'user-1', type: 'sleep' });
    expect(log.filterByType('sleep').length).toBe(1);
  });

  test('replay invokes callback for each event in order', () => {
    const log = new EventLog();
    log.append({ userId: 'user-1', type: 'activity' });
    log.append({ userId: 'user-2', type: 'sleep' });
    const seen = [];
    log.replay((event, index) => seen.push([index, event.userId]));
    expect(seen).toEqual([[0, 'user-1'], [1, 'user-2']]);
  });

  test('clear empties the log', () => {
    const log = new EventLog();
    log.append({ userId: 'user-1', type: 'activity' });
    log.clear();
    expect(log.size()).toBe(0);
  });

  test('getAll returns independent copies safe from mutation', () => {
    const log = new EventLog();
    log.append({ userId: 'user-1', type: 'activity' });
    const all = log.getAll();
    all[0].userId = 'mutated';
    expect(log.getAll()[0].userId).toBe('user-1');
  });
});

describe('ingestWebhookBatch', () => {
  test('throws when payloads is not an array', () => {
    const client = new SandboxClient();
    const log = new EventLog();
    expect(() => ingestWebhookBatch(client, log, 'nope')).toThrow(/payloads must be an array/);
  });

  test('accepts valid payloads for connected users', () => {
    const client = new SandboxClient();
    const log = new EventLog();
    client.connectUser('user-1', 'garmin');
    const result = ingestWebhookBatch(client, log, [basePayload()]);
    expect(result.accepted.length).toBe(1);
    expect(result.rejected.length).toBe(0);
  });

  test('rejects payloads that fail schema validation', () => {
    const client = new SandboxClient();
    const log = new EventLog();
    client.connectUser('user-1', 'garmin');
    const result = ingestWebhookBatch(client, log, [basePayload({ type: 'bogus' })]);
    expect(result.rejected.length).toBe(1);
    expect(result.accepted.length).toBe(0);
  });

  test('rejects payloads for unconnected users', () => {
    const client = new SandboxClient();
    const log = new EventLog();
    const result = ingestWebhookBatch(client, log, [basePayload({ user_id: 'ghost' })]);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].reason).toMatch(/not connected/);
  });

  test('handles a mixed batch of accepted and rejected payloads', () => {
    const client = new SandboxClient();
    const log = new EventLog();
    client.connectUser('user-1', 'garmin');
    const result = ingestWebhookBatch(client, log, [
      basePayload({ user_id: 'user-1' }),
      basePayload({ user_id: 'ghost' }),
      basePayload({ type: 'invalid-type' }),
    ]);
    expect(result.accepted.length).toBe(1);
    expect(result.rejected.length).toBe(2);
  });

  test('appends accepted events to the log', () => {
    const client = new SandboxClient();
    const log = new EventLog();
    client.connectUser('user-1', 'garmin');
    ingestWebhookBatch(client, log, [basePayload()]);
    expect(log.size()).toBe(1);
  });

  test('does not append rejected events to the log', () => {
    const client = new SandboxClient();
    const log = new EventLog();
    ingestWebhookBatch(client, log, [basePayload({ user_id: 'ghost' })]);
    expect(log.size()).toBe(0);
  });
});

describe('getTerraWebhookSchema', () => {
  test('returns an object with the expected required fields', () => {
    const schema = getTerraWebhookSchema();
    expect(schema.required).toEqual(['user_id', 'type', 'timestamp', 'data']);
  });

  test('type property enum matches SUPPORTED_TYPES', () => {
    const schema = getTerraWebhookSchema();
    expect(schema.properties.type.enum).toEqual([...SUPPORTED_TYPES]);
  });

  test('provider property enum matches SUPPORTED_PROVIDERS', () => {
    const schema = getTerraWebhookSchema();
    expect(schema.properties.provider.enum).toEqual([...SUPPORTED_PROVIDERS]);
  });

  test('data property is described as an object', () => {
    const schema = getTerraWebhookSchema();
    expect(schema.properties.data.type).toBe('object');
  });
});

