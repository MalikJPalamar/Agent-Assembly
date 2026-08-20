'use strict';

const fs = require('fs');
const path = require('path');

const TABLES = ['users', 'sessions', 'biomarker_readings'];

const REQUIRED_FIELDS = [
  'user_id',
  'session_id',
  'metric',
  'value',
  'unit',
  'recorded_at',
  'source',
];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateReading(reading) {
  const errors = [];

  if (reading === null || typeof reading !== 'object' || Array.isArray(reading)) {
    return { ok: false, errors: ['reading must be a non-null object'] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in reading) || reading[field] === undefined || reading[field] === null) {
      errors.push(`missing field: ${field}`);
    }
  }

  if ('user_id' in reading && reading.user_id !== undefined && reading.user_id !== null && !isNonEmptyString(reading.user_id)) {
    errors.push('user_id must be a non-empty string');
  }

  if ('session_id' in reading && reading.session_id !== undefined && reading.session_id !== null && !isNonEmptyString(reading.session_id)) {
    errors.push('session_id must be a non-empty string');
  }

  if ('metric' in reading && reading.metric !== undefined && reading.metric !== null && !isNonEmptyString(reading.metric)) {
    errors.push('metric must be a non-empty string');
  }

  if ('unit' in reading && reading.unit !== undefined && reading.unit !== null && !isNonEmptyString(reading.unit)) {
    errors.push('unit must be a non-empty string');
  }

  if ('source' in reading && reading.source !== undefined && reading.source !== null && !isNonEmptyString(reading.source)) {
    errors.push('source must be a non-empty string');
  }

  if ('value' in reading && reading.value !== undefined && reading.value !== null) {
    if (typeof reading.value !== 'number' || Number.isNaN(reading.value)) {
      errors.push('value must be numeric');
    }
  }

  if ('recorded_at' in reading && reading.recorded_at !== undefined && reading.recorded_at !== null) {
    const rec = reading.recorded_at;
    const isValidDateString = isNonEmptyString(rec) && !Number.isNaN(Date.parse(rec));
    const isValidDateObj = rec instanceof Date && !Number.isNaN(rec.getTime());
    if (!isValidDateString && !isValidDateObj) {
      errors.push('recorded_at must be a valid date string or Date instance');
    }
  }

  return { ok: errors.length === 0, errors };
}

function loadSchemaSql() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  return fs.readFileSync(schemaPath, 'utf8');
}

module.exports = {
  TABLES,
  validateReading,
  loadSchemaSql,
};

