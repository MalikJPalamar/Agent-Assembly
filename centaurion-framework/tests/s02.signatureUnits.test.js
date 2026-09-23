'use strict';

const {
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
} = require('../src/s02/signatureUnits');

describe('s02 webhook signature verification', () => {
  const secret = 'terra-sandbox-secret';
  const body = JSON.stringify({ type: 'heart_rate', value: 72 });

  test('computeWebhookSignature returns a deterministic hex digest', () => {
    const sig1 = computeWebhookSignature(secret, body);
    const sig2 = computeWebhookSignature(secret, body);
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]{64}$/);
  });

  test('different bodies produce different signatures', () => {
    const sig1 = computeWebhookSignature(secret, body);
    const sig2 = computeWebhookSignature(secret, body + 'x');
    expect(sig1).not.toBe(sig2);
  });

  test('different secrets produce different signatures', () => {
    const sig1 = computeWebhookSignature(secret, body);
    const sig2 = computeWebhookSignature('other-secret', body);
    expect(sig1).not.toBe(sig2);
  });

  test('computeWebhookSignature throws on empty secret', () => {
    expect(() => computeWebhookSignature('', body)).toThrow(TypeError);
  });

  test('computeWebhookSignature throws on non-string/buffer body', () => {
    expect(() => computeWebhookSignature(secret, 123)).toThrow(TypeError);
  });

  test('verifyWebhookSignature accepts a correct raw hex signature', () => {
    const sig = computeWebhookSignature(secret, body);
    expect(verifyWebhookSignature(secret, body, sig)).toBe(true);
  });

  test('verifyWebhookSignature accepts a correct sha256= prefixed signature', () => {
    const sig = computeWebhookSignature(secret, body);
    expect(verifyWebhookSignature(secret, body, `sha256=${sig}`)).toBe(true);
  });

  test('verifyWebhookSignature rejects a tampered body', () => {
    const sig = computeWebhookSignature(secret, body);
    expect(verifyWebhookSignature(secret, body + 'tampered', sig)).toBe(false);
  });

  test('verifyWebhookSignature rejects a wrong secret', () => {
    const sig = computeWebhookSignature(secret, body);
    expect(verifyWebhookSignature('wrong-secret', body, sig)).toBe(false);
  });

  test('verifyWebhookSignature rejects malformed signature strings', () => {
    expect(verifyWebhookSignature(secret, body, 'not-hex-!!')).toBe(false);
  });

  test('verifyWebhookSignature rejects empty signature', () => {
    expect(verifyWebhookSignature(secret, body, '')).toBe(false);
  });

  test('verifyWebhookSignature rejects non-string signature', () => {
    expect(verifyWebhookSignature(secret, body, null)).toBe(false);
  });

  test('verifyWebhookSignature rejects when secret is invalid', () => {
    expect(verifyWebhookSignature('', body, computeWebhookSignature(secret, body))).toBe(false);
  });
});

describe('s02 unit conversion primitives', () => {
  test('lbsToKg converts pounds to kilograms', () => {
    expect(lbsToKg(150)).toBeCloseTo(68.04, 1);
  });

  test('kgToLbs converts kilograms to pounds', () => {
    expect(kgToLbs(68.04)).toBeCloseTo(150, 0);
  });

  test('lbsToKg and kgToLbs round-trip approximately', () => {
    const kg = lbsToKg(200);
    const lbs = kgToLbs(kg);
    expect(lbs).toBeCloseTo(200, 0);
  });

  test('milesToKm converts miles to kilometers', () => {
    expect(milesToKm(1)).toBeCloseTo(1.61, 1);
  });

  test('kmToMiles converts kilometers to miles', () => {
    expect(kmToMiles(1.609344)).toBeCloseTo(1, 1);
  });

  test('fToC converts fahrenheit to celsius', () => {
    expect(fToC(98.6)).toBeCloseTo(37, 0);
  });

  test('cToF converts celsius to fahrenheit', () => {
    expect(cToF(37)).toBeCloseTo(98.6, 0);
  });

  test('fToC and cToF round-trip approximately', () => {
    const c = fToC(100);
    const f = cToF(c);
    expect(f).toBeCloseTo(100, 0);
  });

  test('minutesToSeconds converts minutes to seconds', () => {
    expect(minutesToSeconds(5)).toBe(300);
  });

  test('secondsToMinutes converts seconds to minutes', () => {
    expect(secondsToMinutes(300)).toBe(5);
  });

  test('conversion functions throw on non-number input', () => {
    expect(() => lbsToKg('abc')).toThrow(TypeError);
    expect(() => kgToLbs(NaN)).toThrow(TypeError);
    expect(() => milesToKm(undefined)).toThrow(TypeError);
    expect(() => kmToMiles(null)).toThrow(TypeError);
    expect(() => fToC('98')).toThrow(TypeError);
    expect(() => cToF({})).toThrow(TypeError);
    expect(() => minutesToSeconds([])).toThrow(TypeError);
    expect(() => secondsToMinutes('x')).toThrow(TypeError);
  });
});

describe('s02 normalizeReading canonicalization', () => {
  test('normalizes lbs weight readings to kg', () => {
    const result = normalizeReading({ value: 150, unit: 'lbs' });
    expect(result.unit).toBe('kg');
    expect(result.value).toBeCloseTo(68.04, 1);
  });

  test('normalizes kg weight readings unchanged in unit', () => {
    const result = normalizeReading({ value: 70, unit: 'kg' });
    expect(result).toEqual({ value: 70, unit: 'kg' });
  });

  test('normalizes miles distance readings to km', () => {
    const result = normalizeReading({ value: 3, unit: 'miles' });
    expect(result.unit).toBe('km');
    expect(result.value).toBeCloseTo(4.83, 1);
  });

  test('normalizes km distance readings unchanged in unit', () => {
    const result = normalizeReading({ value: 5, unit: 'km' });
    expect(result).toEqual({ value: 5, unit: 'km' });
  });

  test('normalizes fahrenheit temperature readings to celsius', () => {
    const result = normalizeReading({ value: 98.6, unit: 'f' });
    expect(result.unit).toBe('c');
    expect(result.value).toBeCloseTo(37, 0);
  });

  test('normalizes celsius temperature readings unchanged in unit', () => {
    const result = normalizeReading({ value: 36.5, unit: 'c' });
    expect(result).toEqual({ value: 36.5, unit: 'c' });
  });

  test('normalizes minute duration readings to seconds', () => {
    const result = normalizeReading({ value: 10, unit: 'min' });
    expect(result).toEqual({ value: 600, unit: 'sec' });
  });

  test('normalizes second duration readings unchanged in unit', () => {
    const result = normalizeReading({ value: 45, unit: 'sec' });
    expect(result).toEqual({ value: 45, unit: 'sec' });
  });

  test('throws RangeError for unsupported unit', () => {
    expect(() => normalizeReading({ value: 10, unit: 'furlongs' })).toThrow(RangeError);
  });

  test('throws TypeError for missing or invalid value', () => {
    expect(() => normalizeReading({ value: 'ten', unit: 'kg' })).toThrow(TypeError);
    expect(() => normalizeReading(null)).toThrow(TypeError);
    expect(() => normalizeReading({ unit: 'kg' })).toThrow(TypeError);
  });
});

