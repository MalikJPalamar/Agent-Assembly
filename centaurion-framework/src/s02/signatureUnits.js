'use strict';

/**
 * Terra webhook signature verification + wearable unit normalization helpers.
 * Purely additive, self-contained module (no dependency on other s02 files).
 * Uses only Node built-ins (crypto).
 */

const crypto = require('crypto');

function round2(n) {
  return Math.round(n * 100) / 100;
}

function computeWebhookSignature(secret, rawBody) {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new TypeError('secret must be a non-empty string');
  }
  if (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody)) {
    throw new TypeError('rawBody must be a string or Buffer');
  }
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function stripPrefix(signature) {
  if (typeof signature !== 'string') return '';
  const idx = signature.indexOf('=');
  if (signature.slice(0, 7) === 'sha256=') {
    return signature.slice(7);
  }
  return signature;
}

function verifyWebhookSignature(secret, rawBody, providedSignature) {
  if (typeof providedSignature !== 'string' || providedSignature.length === 0) {
    return false;
  }
  let expectedHex;
  try {
    expectedHex = computeWebhookSignature(secret, rawBody);
  } catch (err) {
    return false;
  }
  const cleaned = stripPrefix(providedSignature);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  let providedBuf;
  try {
    providedBuf = Buffer.from(cleaned, 'hex');
  } catch (err) {
    return false;
  }
  if (expectedBuf.length !== providedBuf.length || expectedBuf.length === 0) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// ---- Unit conversion primitives ----

const LBS_PER_KG = 0.45359237;
const MILES_PER_KM = 1.609344;

function lbsToKg(lbs) {
  if (typeof lbs !== 'number' || Number.isNaN(lbs)) throw new TypeError('lbs must be a number');
  return round2(lbs * LBS_PER_KG);
}

function kgToLbs(kg) {
  if (typeof kg !== 'number' || Number.isNaN(kg)) throw new TypeError('kg must be a number');
  return round2(kg / LBS_PER_KG);
}

function milesToKm(mi) {
  if (typeof mi !== 'number' || Number.isNaN(mi)) throw new TypeError('mi must be a number');
  return round2(mi * MILES_PER_KM);
}

function kmToMiles(km) {
  if (typeof km !== 'number' || Number.isNaN(km)) throw new TypeError('km must be a number');
  return round2(km / MILES_PER_KM);
}

function fToC(f) {
  if (typeof f !== 'number' || Number.isNaN(f)) throw new TypeError('f must be a number');
  return round2(((f - 32) * 5) / 9);
}

function cToF(c) {
  if (typeof c !== 'number' || Number.isNaN(c)) throw new TypeError('c must be a number');
  return round2((c * 9) / 5 + 32);
}

function minutesToSeconds(m) {
  if (typeof m !== 'number' || Number.isNaN(m)) throw new TypeError('m must be a number');
  return round2(m * 60);
}

function secondsToMinutes(s) {
  if (typeof s !== 'number' || Number.isNaN(s)) throw new TypeError('s must be a number');
  return round2(s / 60);
}

const CANONICAL_UNIT = {
  lbs: 'kg',
  kg: 'kg',
  miles: 'km',
  km: 'km',
  f: 'c',
  c: 'c',
  min: 'sec',
  sec: 'sec',
};

function normalizeReading(reading) {
  if (!reading || typeof reading !== 'object') {
    throw new TypeError('reading must be an object with { value, unit }');
  }
  const { value, unit } = reading;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError('reading.value must be a number');
  }
  if (typeof unit !== 'string' || !(unit in CANONICAL_UNIT)) {
    throw new RangeError(`unsupported unit: ${unit}`);
  }

  let normalizedValue;
  switch (unit) {
    case 'lbs':
      normalizedValue = lbsToKg(value);
      break;
    case 'kg':
      normalizedValue = round2(value);
      break;
    case 'miles':
      normalizedValue = milesToKm(value);
      break;
    case 'km':
      normalizedValue = round2(value);
      break;
    case 'f':
      normalizedValue = fToC(value);
      break;
    case 'c':
      normalizedValue = round2(value);
      break;
    case 'min':
      normalizedValue = minutesToSeconds(value);
      break;
    case 'sec':
      normalizedValue = round2(value);
      break;
    default:
      throw new RangeError(`unsupported unit: ${unit}`);
  }

  return { value: normalizedValue, unit: CANONICAL_UNIT[unit] };
}

module.exports = {
  computeWebhookSignature,
  verifyWebhookSignature,
  lbsToKg,
  kgToLbs,
  milesToKm,
  kmToMiles,
  fToC,
  cToF,
  minutesToSeconds,
  secondsToMinutes,
  normalizeReading,
};

