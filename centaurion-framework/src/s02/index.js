'use strict';

const SUPPORTED_PROVIDERS = Object.freeze(['garmin', 'fitbit', 'oura', 'apple', 'whoop']);
const SUPPORTED_TYPES = Object.freeze(['activity', 'sleep', 'body', 'daily']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidTimestamp(v) {
  if (!isNonEmptyString(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

class SandboxClient {
  constructor() {
    this._connections = new Map();
  }

  connectUser(userId, provider) {
    if (!isNonEmptyString(userId)) {
      throw new Error('connectUser: userId is required');
    }
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(`connectUser: unsupported provider "${provider}"`);
    }
    const connection = {
      userId,
      provider,
      connectedAt: new Date().toISOString(),
    };
    this._connections.set(userId, connection);
    return { ...connection };
  }

  disconnectUser(userId) {
    return this._connections.delete(userId);
  }

  isConnected(userId) {
    return this._connections.has(userId);
  }

  getConnection(userId) {
    const conn = this._connections.get(userId);
    return conn ? { ...conn } : undefined;
  }

  listConnections() {
    return Array.from(this._connections.values()).map((c) => ({ ...c }));
  }
}

function validateWebhookPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!isNonEmptyString(payload.user_id)) {
    errors.push('user_id is required');
  }
  if (!isNonEmptyString(payload.type) || !SUPPORTED_TYPES.includes(payload.type)) {
    errors.push(`type must be one of: ${SUPPORTED_TYPES.join(', ')}`);
  }
  if (!isValidTimestamp(payload.timestamp)) {
    errors.push('timestamp must be a valid date string');
  }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    errors.push('data must be an object');
  }
  return { valid: errors.length === 0, errors };
}

function normalizeWebhookPayload(payload) {
  const { valid, errors } = validateWebhookPayload(payload);
  if (!valid) {
    throw new Error(`Invalid webhook payload: ${errors.join('; ')}`);
  }
  return {
    userId: payload.user_id.trim(),
    type: payload.type,
    provider: isNonEmptyString(payload.provider) ? payload.provider.trim() : 'unknown',
    timestamp: new Date(payload.timestamp).toISOString(),
    data: { ...payload.data },
  };
}

class EventLog {
  constructor() {
    this._events = [];
  }

  append(event) {
    const stored = { ...event, loggedAt: new Date().toISOString() };
    this._events.push(stored);
    return { ...stored };
  }

  getAll() {
    return this._events.map((e) => ({ ...e }));
  }

  size() {
    return this._events.length;
  }

  filterByUser(userId) {
    return this._events.filter((e) => e.userId === userId).map((e) => ({ ...e }));
  }

  filterByType(type) {
    return this._events.filter((e) => e.type === type).map((e) => ({ ...e }));
  }

  replay(fn) {
    this._events.forEach((e, i) => fn({ ...e }, i));
  }

  clear() {
    this._events = [];
  }
}

function ingestWebhookBatch(client, log, payloads) {
  const result = { accepted: [], rejected: [] };
  if (!Array.isArray(payloads)) {
    throw new Error('ingestWebhookBatch: payloads must be an array');
  }
  for (const payload of payloads) {
    const { valid, errors } = validateWebhookPayload(payload);
    if (!valid) {
      result.rejected.push({ payload, reason: errors.join('; ') });
      continue;
    }
    if (!client.isConnected(payload.user_id)) {
      result.rejected.push({ payload, reason: `user ${payload.user_id} is not connected` });
      continue;
    }
    const normalized = normalizeWebhookPayload(payload);
    const stored = log.append(normalized);
    result.accepted.push(stored);
  }
  return result;
}

function getTerraWebhookSchema() {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'TerraWebhookPayload',
    type: 'object',
    required: ['user_id', 'type', 'timestamp', 'data'],
    properties: {
      user_id: { type: 'string', minLength: 1 },
      type: { type: 'string', enum: [...SUPPORTED_TYPES] },
      provider: { type: 'string', enum: [...SUPPORTED_PROVIDERS] },
      timestamp: { type: 'string', format: 'date-time' },
      data: { type: 'object' },
    },
  };
}

module.exports = {
  SUPPORTED_PROVIDERS,
  SUPPORTED_TYPES,
  SandboxClient,
  validateWebhookPayload,
  normalizeWebhookPayload,
  EventLog,
  ingestWebhookBatch,
  getTerraWebhookSchema,
};

