'use strict';

/**
 * paginate - slices an array of items into a page, clamping the requested
 * page number to a valid range and returning metadata useful for
 * downstream EventLog query consumers.
 *
 * @param {Array} items
 * @param {{page?: number, pageSize?: number}} [opts]
 * @returns {{data: Array, page: number, pageSize: number, totalItems: number, totalPages: number, hasNext: boolean, hasPrev: boolean}}
 */
function paginate(items, opts) {
  if (!Array.isArray(items)) {
    throw new TypeError('items must be an array');
  }
  const { page = 1, pageSize = 10 } = opts || {};
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError('page must be an integer >= 1');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('pageSize must be an integer >= 1');
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * pageSize;
  const data = items.slice(start, start + pageSize);

  return {
    data,
    page: clampedPage,
    pageSize,
    totalItems,
    totalPages,
    hasNext: clampedPage < totalPages,
    hasPrev: clampedPage > 1,
  };
}

/**
 * mergeProviderPayloads - groups a flat list of Terra-style webhook
 * payloads (each carrying userId/provider/type/timestamp/data) into a
 * per-user aggregate: a count of events by provider plus a chronologically
 * sorted event list. Useful for multi-provider aggregation once several
 * wearable vendors report through the sandbox client.
 *
 * @param {Array<{userId: string, provider: string, type: string, timestamp: string|number|Date, data?: any}>} payloads
 * @returns {Object<string, {userId: string, providers: Object<string, number>, events: Array}>}
 */
function mergeProviderPayloads(payloads) {
  if (!Array.isArray(payloads)) {
    throw new TypeError('payloads must be an array');
  }

  const byUser = {};

  for (const payload of payloads) {
    if (!payload || typeof payload !== 'object') {
      throw new TypeError('each payload must be an object');
    }
    const { userId, provider, type, data, timestamp } = payload;

    if (!userId || typeof userId !== 'string') {
      throw new TypeError('payload missing userId');
    }
    if (!provider || typeof provider !== 'string') {
      throw new TypeError('payload missing provider');
    }
    if (!type || typeof type !== 'string') {
      throw new TypeError('payload missing type');
    }
    if (timestamp === undefined || timestamp === null) {
      throw new TypeError('payload missing timestamp');
    }

    const ts = new Date(timestamp);
    if (Number.isNaN(ts.getTime())) {
      throw new TypeError('payload has invalid timestamp');
    }

    if (!byUser[userId]) {
      byUser[userId] = { userId, providers: {}, events: [] };
    }
    const bucket = byUser[userId];
    bucket.providers[provider] = (bucket.providers[provider] || 0) + 1;
    bucket.events.push({
      provider,
      type,
      data: data === undefined ? null : data,
      timestamp: ts.toISOString(),
    });
  }

  for (const userId of Object.keys(byUser)) {
    byUser[userId].events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  return byUser;
}

module.exports = { paginate, mergeProviderPayloads };

