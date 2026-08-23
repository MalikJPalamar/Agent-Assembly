'use strict';

const crypto = require('crypto');

const VALID_PROVIDERS = ['FITBIT', 'GARMIN', 'OURA', 'WHOOP', 'APPLE', 'GOOGLE'];
const VALID_WEBHOOK_TYPES = [
  'auth',
  'user_reauth',
  'deauth',
  'activity',
  'body',
  'daily',
  'sleep',
  'menstruation',
  'nutrition',
];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

class TerraSandboxClient {
  constructor({ clock } = {}) {
    this._clock = typeof clock === 'function' ? clock : () => new Date().toISOString();
    this._connections = new Map();
  }

  connectUser(userId, provider) {
    if (!isNonEmptyString(userId)) {
      throw new TypeError('userId must be a non-empty string');
    }
    if (!VALID_PROVIDERS.includes(provider)) {
      throw new RangeError(`unsupported provider: ${provider}`);
    }
    const referenceId = crypto
      .createHash('sha256')
      .update(`${userId}:${provider}`)
      .digest('hex')
      .slice(0, 16);
    const connection = {
      userId,
      provider,
      referenceId,
      connectedAt: this._clock(),
      active: true,
    };
    this._connections.set(userId, connection);
    return { ...connection };
  }

  disconnectUser(userId) {
    const conn = this._connections.get(userId);
    if (!conn) return false;
    conn.active = false;
    conn.disconnectedAt = this._clock();
    return true;
  }

  isConnected(userId) {
    const conn = this._connections.get(userId);
    return Boolean(conn && conn.active);
  }

  getConnection(userId) {
    const conn = this._connections.get(userId);
    return conn ? { ...conn } : null;
  }

  listConnections() {
    return Array.from(this._connections.values()).map((c) => ({ ...c }));
  }
}

function validateWebhookPayload(payload) {
  const errors = [];
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!isNonEmptyString(payload.type)) {
    errors.push('type is required');
  } else if (!VALID_WEBHOOK_TYPES.includes(payload.type)) {
    errors.push(`unsupported type: ${payload.type}`);
  }
  if (!payload.user || typeof payload.user !== 'object' || Array.isArray(payload.user)) {
    errors.push('user object is required');
  } else {
    if (!isNonEmptyString(payload.user.user_id)) errors.push('user.user_id is required');
    if (!isNonEmptyString(payload.user.provider)) errors.push('user.provider is required');
  }
  const isLifecycleType = payload.type === 'auth' || payload.type === 'deauth' || payload.type === 'user_reauth';
  if (payload.type && !isLifecycleType && VALID_WEBHOOK_TYPES.includes(payload.type)) {
    if (!Array.isArray(payload.data)) {
      errors.push('data must be an array for data webhooks');
    }
  }
  return { valid: errors.length === 0, errors };
}

function normalizeWebhookPayload(payload) {
  const { valid, errors } = validateWebhookPayload(payload);
  if (!valid) {
    throw new Error(`invalid webhook payload: ${errors.join(', ')}`);
  }
  const normalized = {
    type: payload.type,
    userId: payload.user.user_id,
    provider: payload.user.provider.toUpperCase(),
    receivedAt: payload.received_at || new Date(0).toISOString(),
    records: [],
  };
  if (Array.isArray(payload.data)) {
    normalized.records = payload.data.map((entry, idx) => ({
      index: idx,
      metadata: (entry && entry.metadata) || {},
      summary: (entry && entry.summary) || {},
    }));
  }
  return normalized;
}

class EventLog {
  constructor() {
    this._events = [];
  }

  log(event) {
    if (event === null || typeof event !== 'object') {
      throw new TypeError('event must be an object');
    }
    const entry = {
      ...event,
      loggedAt: event.loggedAt || new Date(0).toISOString(),
      seq: this._events.length,
    };
    this._events.push(entry);
    return { ...entry };
  }

  getAll() {
    return this._events.map((e) => ({ ...e }));
  }

  size() {
    return this._events.length;
  }

  clear() {
    this._events = [];
  }

  replay(filter = {}) {
    const keys = Object.keys(filter);
    return this._events
      .filter((e) => keys.every((key) => e[key] === filter[key]))
      .map((e) => ({ ...e }));
  }
}

const FIXTURES = {
  auth: {
    type: 'auth',
    user: { user_id: 'user-1', provider: 'FITBIT' },
  },
  deauth: {
    type: 'deauth',
    user: { user_id: 'user-1', provider: 'FITBIT' },
  },
  activity: {
    type: 'activity',
    user: { user_id: 'user-1', provider: 'GARMIN' },
    data: [{ metadata: { start_time: '2024-01-01T00:00:00Z' }, summary: { steps: 1000 } }],
  },
  sleep: {
    type: 'sleep',
    user: { user_id: 'user-2', provider: 'OURA' },
    data: [
      { metadata: { start_time: '2024-01-01T22:00:00Z' }, summary: { duration_seconds: 28800 } },
    ],
  },
};

module.exports = {
  VALID_PROVIDERS,
  VALID_WEBHOOK_TYPES,
  TerraSandboxClient,
  validateWebhookPayload,
  normalizeWebhookPayload,
  EventLog,
  FIXTURES,
};

