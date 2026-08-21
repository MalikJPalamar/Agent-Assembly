'use strict';

const SUPPORTED_PROVIDERS = Object.freeze([
  'GARMIN',
  'FITBIT',
  'OURA',
  'WHOOP',
  'APPLE',
  'GOOGLE',
]);

class TerraSandboxError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TerraSandboxError';
    this.code = code || 'TERRA_SANDBOX_ERROR';
  }
}

function isSupportedProvider(provider) {
  return typeof provider === 'string' && SUPPORTED_PROVIDERS.includes(provider.toUpperCase());
}

function listSupportedProviders() {
  return [...SUPPORTED_PROVIDERS];
}

function createSandboxClient(config = {}) {
  const apiKey = config.apiKey || 'sandbox-dev-key';
  const connections = new Map();

  function connectUser(userId, provider) {
    if (!userId || typeof userId !== 'string') {
      throw new TerraSandboxError('userId is required', 'INVALID_USER_ID');
    }
    if (!isSupportedProvider(provider)) {
      throw new TerraSandboxError(`Unsupported provider: ${provider}`, 'UNSUPPORTED_PROVIDER');
    }
    const connection = {
      userId,
      provider: provider.toUpperCase(),
      referenceId: `sandbox-${userId}-${provider.toUpperCase()}`,
      status: 'connected',
      connectedAt: new Date().toISOString(),
    };
    connections.set(userId, connection);
    return connection;
  }

  function getConnection(userId) {
    return connections.get(userId) || null;
  }

  function disconnectUser(userId) {
    if (!connections.has(userId)) {
      return false;
    }
    connections.delete(userId);
    return true;
  }

  function listConnections() {
    return Array.from(connections.values());
  }

  return {
    apiKey,
    connectUser,
    getConnection,
    disconnectUser,
    listConnections,
  };
}

function validateWebhookPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['payload must be an object'] };
  }
  if (!payload.user || typeof payload.user.user_id !== 'string' || payload.user.user_id.length === 0) {
    errors.push('user.user_id is required');
  }
  if (!payload.type || typeof payload.type !== 'string') {
    errors.push('type is required');
  }
  if (!Array.isArray(payload.data)) {
    errors.push('data must be an array');
  }
  return { valid: errors.length === 0, errors };
}

function normalizeActivityRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new TerraSandboxError('record must be an object', 'INVALID_RECORD');
  }
  const metadata = record.metadata || {};
  const summary = record.calories_data || {};
  const heartRateSummary = (record.heart_rate_data && record.heart_rate_data.summary) || {};

  return {
    provider: metadata.provider ? String(metadata.provider).toUpperCase() : 'UNKNOWN',
    startTime: metadata.start_time || null,
    endTime: metadata.end_time || null,
    caloriesBurned: typeof summary.total_burned_calories === 'number' ? summary.total_burned_calories : null,
    avgHeartRate: typeof heartRateSummary.avg_hr_bpm === 'number' ? heartRateSummary.avg_hr_bpm : null,
  };
}

function parseWebhookPayload(payload) {
  const validation = validateWebhookPayload(payload);
  if (!validation.valid) {
    throw new TerraSandboxError(`Invalid webhook payload: ${validation.errors.join(', ')}`, 'INVALID_PAYLOAD');
  }
  return {
    userId: payload.user.user_id,
    type: payload.type,
    records: payload.data.map(normalizeActivityRecord),
  };
}

module.exports = {
  SUPPORTED_PROVIDERS,
  TerraSandboxError,
  isSupportedProvider,
  listSupportedProviders,
  createSandboxClient,
  validateWebhookPayload,
  normalizeActivityRecord,
  parseWebhookPayload,
};

