'use strict';

const {
  VALID_PROVIDERS,
  VALID_WEBHOOK_TYPES,
  TerraSandboxClient,
  validateWebhookPayload,
  normalizeWebhookPayload,
  EventLog,
  FIXTURES,
} = require('../src/s02');

describe('s02 constants', () => {
  test('exposes valid providers', () => {
    expect(VALID_PROVIDERS).toEqual(
      expect.arrayContaining(['FITBIT', 'GARMIN', 'OURA', 'WHOOP', 'APPLE', 'GOOGLE'])
    );
  });

  test('exposes valid webhook types', () => {
    expect(VALID_WEBHOOK_TYPES).toEqual(expect.arrayContaining(['auth', 'deauth', 'activity', 'sleep']));
  });
});

describe('TerraSandboxClient - connect/disconnect', () => {
  function makeClient() {
    let tick = 0;
    return new TerraSandboxClient({ clock: () => `2024-01-01T00:00:0${tick++}Z` });
  }

  test('connectUser returns a connection record', () => {
    const client = makeClient();
    const conn = client.connectUser('alice', 'FITBIT');
    expect(conn.userId).toBe('alice');
    expect(conn.provider).toBe('FITBIT');
    expect(conn.active).toBe(true);
    expect(typeof conn.referenceId).toBe('string');
    expect(conn.referenceId.length).toBeGreaterThan(0);
  });

  test('connectUser generates deterministic referenceId for same inputs', () => {
    const client1 = makeClient();
    const client2 = makeClient();
    const c1 = client1.connectUser('bob', 'GARMIN');
    const c2 = client2.connectUser('bob', 'GARMIN');
    expect(c1.referenceId).toBe(c2.referenceId);
  });

  test('connectUser rejects empty userId', () => {
    const client = makeClient();
    expect(() => client.connectUser('', 'FITBIT')).toThrow(TypeError);
  });

  test('connectUser rejects non-string userId', () => {
    const client = makeClient();
    expect(() => client.connectUser(123, 'FITBIT')).toThrow(TypeError);
  });

  test('connectUser rejects unsupported provider', () => {
    const client = makeClient();
    expect(() => client.connectUser('alice', 'NOT_A_PROVIDER')).toThrow(RangeError);
  });

  test('isConnected reflects connection state', () => {
    const client = makeClient();
    expect(client.isConnected('alice')).toBe(false);
    client.connectUser('alice', 'OURA');
    expect(client.isConnected('alice')).toBe(true);
  });

  test('disconnectUser marks connection inactive and returns true', () => {
    const client = makeClient();
    client.connectUser('alice', 'OURA');
    const result = client.disconnectUser('alice');
    expect(result).toBe(true);
    expect(client.isConnected('alice')).toBe(false);
  });

  test('disconnectUser sets disconnectedAt timestamp', () => {
    const client = makeClient();
    client.connectUser('alice', 'OURA');
    client.disconnectUser('alice');
    const conn = client.getConnection('alice');
    expect(conn.disconnectedAt).toBeDefined();
  });

  test('disconnectUser returns false for unknown user', () => {
    const client = makeClient();
    expect(client.disconnectUser('nobody')).toBe(false);
  });

  test('getConnection returns null for unknown user', () => {
    const client = makeClient();
    expect(client.getConnection('nobody')).toBeNull();
  });

  test('getConnection returns a copy, not a live reference', () => {
    const client = makeClient();
    client.connectUser('alice', 'WHOOP');
    const conn = client.getConnection('alice');
    conn.active = false;
    expect(client.isConnected('alice')).toBe(true);
  });

  test('listConnections returns all connected users', () => {
    const client = makeClient();
    client.connectUser('alice', 'FITBIT');
    client.connectUser('bob', 'GARMIN');
    const list = client.listConnections();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.userId).sort()).toEqual(['alice', 'bob']);
  });

  test('reconnecting a user overwrites the previous connection', () => {
    const client = makeClient();
    client.connectUser('alice', 'FITBIT');
    client.disconnectUser('alice');
    const conn = client.connectUser('alice', 'GARMIN');
    expect(conn.active).toBe(true);
    expect(conn.provider).toBe('GARMIN');
    expect(client.isConnected('alice')).toBe(true);
  });
});

describe('validateWebhookPayload', () => {
  test('rejects non-object payloads', () => {
    expect(validateWebhookPayload(null).valid).toBe(false);
    expect(validateWebhookPayload('string').valid).toBe(false);
    expect(validateWebhookPayload([]).valid).toBe(false);
  });

  test('rejects payload missing type', () => {
    const { valid, errors } = validateWebhookPayload({ user: { user_id: 'u1', provider: 'FITBIT' } });
    expect(valid).toBe(false);
    expect(errors).toContain('type is required');
  });

  test('rejects unsupported type', () => {
    const { valid, errors } = validateWebhookPayload({
      type: 'bogus',
      user: { user_id: 'u1', provider: 'FITBIT' },
      data: [],
    });
    expect(valid).toBe(false);
    expect(errors.some((e) => e.includes('unsupported type'))).toBe(true);
  });

  test('rejects payload missing user', () => {
    const { valid, errors } = validateWebhookPayload({ type: 'auth' });
    expect(valid).toBe(false);
    expect(errors).toContain('user object is required');
  });

  test('rejects user missing user_id', () => {
    const { valid, errors } = validateWebhookPayload({ type: 'auth', user: { provider: 'FITBIT' } });
    expect(valid).toBe(false);
    expect(errors).toContain('user.user_id is required');
  });

  test('rejects user missing provider', () => {
    const { valid, errors } = validateWebhookPayload({ type: 'auth', user: { user_id: 'u1' } });
    expect(valid).toBe(false);
    expect(errors).toContain('user.provider is required');
  });

  test('accepts a valid auth payload without data', () => {
    const { valid, errors } = validateWebhookPayload(FIXTURES.auth);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test('accepts a valid deauth payload without data', () => {
    const { valid } = validateWebhookPayload(FIXTURES.deauth);
    expect(valid).toBe(true);
  });

  test('requires data array for data webhook types', () => {
    const { valid, errors } = validateWebhookPayload({
      type: 'activity',
      user: { user_id: 'u1', provider: 'GARMIN' },
    });
    expect(valid).toBe(false);
    expect(errors).toContain('data must be an array for data webhooks');
  });

  test('accepts a valid activity payload with data', () => {
    const { valid } = validateWebhookPayload(FIXTURES.activity);
    expect(valid).toBe(true);
  });

  test('accepts a valid sleep payload with data', () => {
    const { valid } = validateWebhookPayload(FIXTURES.sleep);
    expect(valid).toBe(true);
  });
});

describe('normalizeWebhookPayload', () => {
  test('throws for invalid payload', () => {
    expect(() => normalizeWebhookPayload({ type: 'bogus' })).toThrow(/invalid webhook payload/);
  });

  test('normalizes an auth payload with no records', () => {
    const normalized = normalizeWebhookPayload(FIXTURES.auth);
    expect(normalized.type).toBe('auth');
    expect(normalized.userId).toBe('user-1');
    expect(normalized.provider).toBe('FITBIT');
    expect(normalized.records).toEqual([]);
  });

  test('uppercases the provider', () => {
    const normalized = normalizeWebhookPayload({
      type: 'auth',
      user: { user_id: 'u1', provider: 'fitbit' },
    });
    expect(normalized.provider).toBe('FITBIT');
  });

  test('normalizes activity payload records with metadata and summary', () => {
    const normalized = normalizeWebhookPayload(FIXTURES.activity);
    expect(normalized.records).toHaveLength(1);
    expect(normalized.records[0]).toEqual({
      index: 0,
      metadata: { start_time: '2024-01-01T00:00:00Z' },
      summary: { steps: 1000 },
    });
  });

  test('defaults missing metadata/summary to empty objects', () => {
    const normalized = normalizeWebhookPayload({
      type: 'daily',
      user: { user_id: 'u1', provider: 'OURA' },
      data: [{}],
    });
    expect(normalized.records[0]).toEqual({ index: 0, metadata: {}, summary: {} });
  });

  test('uses received_at when provided', () => {
    const normalized = normalizeWebhookPayload({
      type: 'auth',
      user: { user_id: 'u1', provider: 'FITBIT' },
      received_at: '2024-05-01T00:00:00Z',
    });
    expect(normalized.receivedAt).toBe('2024-05-01T00:00:00Z');
  });
});

describe('EventLog', () => {
  test('starts empty', () => {
    const log = new EventLog();
    expect(log.getAll()).toEqual([]);
    expect(log.size()).toBe(0);
  });

  test('log appends an event with a sequence number', () => {
    const log = new EventLog();
    const entry = log.log({ type: 'auth', userId: 'u1' });
    expect(entry.seq).toBe(0);
    expect(entry.type).toBe('auth');
    expect(log.size()).toBe(1);
  });

  test('log throws for non-object events', () => {
    const log = new EventLog();
    expect(() => log.log(null)).toThrow(TypeError);
    expect(() => log.log('bad')).toThrow(TypeError);
  });

  test('sequence numbers increment across multiple logs', () => {
    const log = new EventLog();
    log.log({ type: 'auth' });
    log.log({ type: 'activity' });
    const entries = log.getAll();
    expect(entries.map((e) => e.seq)).toEqual([0, 1]);
  });

  test('getAll returns copies, not live references', () => {
    const log = new EventLog();
    log.log({ type: 'auth' });
    const entries = log.getAll();
    entries[0].type = 'mutated';
    expect(log.getAll()[0].type).toBe('auth');
  });

  test('clear empties the log', () => {
    const log = new EventLog();
    log.log({ type: 'auth' });
    log.clear();
    expect(log.size()).toBe(0);
    expect(log.getAll()).toEqual([]);
  });

  test('replay filters events by matching fields', () => {
    const log = new EventLog();
    log.log({ type: 'auth', userId: 'u1' });
    log.log({ type: 'activity', userId: 'u1' });
    log.log({ type: 'activity', userId: 'u2' });
    const results = log.replay({ type: 'activity', userId: 'u1' });
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe('u1');
  });

  test('replay with no filter returns all events', () => {
    const log = new EventLog();
    log.log({ type: 'auth' });
    log.log({ type: 'deauth' });
    expect(log.replay()).toHaveLength(2);
  });

  test('replay returns empty array when nothing matches', () => {
    const log = new EventLog();
    log.log({ type: 'auth' });
    expect(log.replay({ type: 'nonexistent' })).toEqual([]);
  });

  test('default loggedAt is applied when not provided', () => {
    const log = new EventLog();
    const entry = log.log({ type: 'auth' });
    expect(entry.loggedAt).toBeDefined();
  });

  test('explicit loggedAt is preserved', () => {
    const log = new EventLog();
    const entry = log.log({ type: 'auth', loggedAt: '2024-02-02T00:00:00Z' });
    expect(entry.loggedAt).toBe('2024-02-02T00:00:00Z');
  });
});

describe('integration: sandbox client + webhook pipeline', () => {
  test('connect a user then process and log a normalized webhook event', () => {
    const client = new TerraSandboxClient({ clock: () => '2024-01-01T00:00:00Z' });
    const log = new EventLog();

    client.connectUser('user-1', 'GARMIN');
    expect(client.isConnected('user-1')).toBe(true);

    const normalized = normalizeWebhookPayload(FIXTURES.activity);
    log.log(normalized);

    const replayed = log.replay({ userId: 'user-1', type: 'activity' });
    expect(replayed).toHaveLength(1);
    expect(replayed[0].provider).toBe('GARMIN');
  });

  test('deauth webhook can trigger disconnect logic', () => {
    const client = new TerraSandboxClient({ clock: () => '2024-01-01T00:00:00Z' });
    client.connectUser('user-1', 'FITBIT');

    const normalized = normalizeWebhookPayload(FIXTURES.deauth);
    if (normalized.type === 'deauth') {
      client.disconnectUser(normalized.userId);
    }

    expect(client.isConnected('user-1')).toBe(false);
  });
});

