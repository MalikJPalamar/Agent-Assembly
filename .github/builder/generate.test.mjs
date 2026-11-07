import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { checkSubscription, generate, subscriptionEnvironment, validateOutput } from './generate.mjs';

const env = {
  PATH: process.env.PATH,
  CLAUDE_USAGE_CREDITS_DISABLED: 'true',
  CLAUDE_CODE_OAUTH_TOKEN: 'test-only-not-a-credential',
};
const output = {
  files: [{ path: 'src/s02/example.js', content: 'module.exports = 1;' }],
  summary: 'Example', learned: 'Example', next: 'Example', spec_complete: false,
};
const success = { type: 'result', subtype: 'success', is_error: false, structured_output: output };
const stream = (...messages) => async function* () { yield* messages; };

test('requires explicit confirmation of disabled paid usage credits', () => {
  for (const value of [undefined, '', 'false', 'TRUE']) {
    assert.throws(() => checkSubscription({ ...env, CLAUDE_USAGE_CREDITS_DISABLED: value }), /Confirm paid usage/);
  }
});

test('requires an OAuth token even when an API key exists', () => {
  for (const value of [undefined, '', ' ']) {
    assert.throws(() => checkSubscription({ ...env, CLAUDE_CODE_OAUTH_TOKEN: value, ANTHROPIC_API_KEY: 'test' }), /OAUTH_TOKEN is missing/);
  }
});

test('does not forward API, gateway, cloud, GitHub, helper or profile settings', () => {
  const hostile = Object.fromEntries([
    'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
    'ANTHROPIC_PROFILE', 'ANTHROPIC_FEDERATION_RULE_ID', 'ANTHROPIC_ORGANIZATION_ID',
    'ANTHROPIC_IDENTITY_TOKEN_FILE', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX',
    'CLAUDE_CODE_USE_FOUNDRY', 'AWS_ACCESS_KEY_ID', 'GOOGLE_APPLICATION_CREDENTIALS',
    'GH_TOKEN', 'GITHUB_TOKEN', 'NODE_OPTIONS', 'CLAUDE_CODE_API_KEY_HELPER', 'HTTPS_PROXY',
  ].map(key => [key, 'do-not-forward']));
  const actual = subscriptionEnvironment({ ...env, ...hostile }, '/tmp/isolated-home');
  for (const key of Object.keys(hostile)) assert.equal(actual[key], undefined, key);
  assert.equal(actual.CLAUDE_CODE_OAUTH_TOKEN, env.CLAUDE_CODE_OAUTH_TOKEN);
  assert.equal(actual.HOME, '/tmp/isolated-home');
  assert.equal(actual.CLAUDE_CONFIG_DIR, '/tmp/isolated-home/.claude');
  assert.equal(actual.CLAUDE_CODE_MAX_RETRIES, '0');
});

test('missing confirmation stops before querying Claude', async () => {
  let calls = 0;
  await assert.rejects(generate({ prompt: 'test', env: {}, query: () => { calls++; } }), /Confirm paid usage/);
  assert.equal(calls, 0);
});

test('uses a bounded SDK session and cleans up isolated configuration', async () => {
  let options;
  const query = async function* (request) {
    assert.equal(request.prompt, 'test prompt');
    options = request.options;
    await access(options.cwd);
    yield { type: 'system' };
    yield success;
  };
  assert.deepEqual(await generate({ prompt: 'test prompt', env, query }), output);
  assert.deepEqual(options.tools, []);
  assert.deepEqual(options.mcpServers, {});
  assert.equal(options.strictMcpConfig, true);
  assert.deepEqual(options.settingSources, []);
  assert.equal(options.settings.forceLoginMethod, 'claudeai');
  assert.equal(options.settings.disableAllHooks, true);
  assert.equal(options.permissionMode, 'dontAsk');
  assert.equal(options.persistSession, false);
  assert.equal(options.maxTurns, 3);
  assert.equal(options.model, 'sonnet');
  assert.equal(options.outputFormat.type, 'json_schema');
  await assert.rejects(access(options.env.HOME), { code: 'ENOENT' });
});

for (const result of [
  { type: 'result', subtype: 'error_during_execution' },
  { type: 'result', subtype: 'error_max_turns' },
  { type: 'result', subtype: 'error_max_structured_output_retries' },
  { type: 'result', subtype: 'success' },
  { ...success, is_error: true },
]) {
  test(`rejects failed or incomplete SDK result: ${result.subtype}/${result.is_error}`, async () => {
    await assert.rejects(generate({ prompt: 'test', env, query: stream(result) }), /subscription request failed/);
  });
}

test('rejects streams ending without a result', async () => {
  await assert.rejects(generate({ prompt: 'test', env, query: stream({ type: 'assistant' }) }), /without a result/);
});

test('propagates stream failures without retrying or using another provider', async () => {
  let calls = 0;
  let home;
  const query = async function* (request) {
    calls++;
    home = request.options.env.HOME;
    throw new Error('mock authentication failure');
  };
  await assert.rejects(generate({ prompt: 'test', env, query }), /mock authentication failure/);
  assert.equal(calls, 1);
  await assert.rejects(access(home), { code: 'ENOENT' });
});

test('aborts a stalled request and cleans up', async () => {
  let home;
  const query = async function* ({ options }) {
    home = options.env.HOME;
    await new Promise((resolve, reject) => {
      options.abortController.signal.addEventListener('abort', () => reject(new Error('mock timeout')), { once: true });
    });
  };
  await assert.rejects(generate({ prompt: 'test', env, query, timeoutMs: 30 }), /mock timeout/);
  await assert.rejects(access(home), { code: 'ENOENT' });
});

test('rejects incomplete, excessive, or unsafe output', () => {
  for (const value of [null, {}, { ...output, files: [] }, { ...output, spec_complete: 'yes' },
    { ...output, files: Array(26).fill(output.files[0]) }]) {
    assert.throws(() => validateOutput(value));
  }
  for (const p of ['/tmp/file', '../file', 'src/../file', '.github/config', 'src/.git/config',
    'src/.github/workflows/file', 'src\\file', 'src//file', 'src/./file', 'src/file\n']) {
    assert.throws(() => validateOutput({ ...output, files: [{ path: p, content: '' }] }), /unsafe/);
  }
  assert.throws(() => validateOutput({ ...output, files: [output.files[0], output.files[0]] }), /duplicate/);
});

test('workflow only references the subscription secret, not the paid API', async () => {
  const workflow = await readFile(new URL('../workflows/centaurion-daily-builder.yml', import.meta.url), 'utf8');
  assert.match(workflow, /secrets\.CLAUDE_CODE_OAUTH_TOKEN/);
  assert.match(workflow, /vars\.CLAUDE_USAGE_CREDITS_DISABLED/);
  assert.match(workflow, /npm ci --prefix \.github\/builder --ignore-scripts/);
  assert.doesNotMatch(workflow, /ANTHROPIC_API_KEY|api\.anthropic\.com|x-api-key/);
});
