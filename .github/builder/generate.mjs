import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    files: {
      type: 'array',
      minItems: 1,
      maxItems: 25,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
    summary: { type: 'string' },
    learned: { type: 'string' },
    next: { type: 'string' },
    spec_complete: { type: 'boolean' },
  },
  required: ['files', 'summary', 'learned', 'next', 'spec_complete'],
};

export function checkSubscription(env) {
  if (env.CLAUDE_USAGE_CREDITS_DISABLED !== 'true') {
    throw new Error('Confirm paid usage credits / extra usage are disabled in Claude Settings > Usage, then set the repository variable CLAUDE_USAGE_CREDITS_DISABLED=true. No model request was made.');
  }
  if (!env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is missing. Authorize a Claude subscription token and save it as a repository secret. There is no API-key fallback.');
  }
}

// Replace, rather than inherit, the CLI environment. In particular, do not pass
// API keys, gateways, cloud providers, profiles, helper scripts or GitHub tokens.
export function subscriptionEnvironment(env, home) {
  checkSubscription(env);
  return {
    PATH: env.PATH,
    LANG: env.LANG || 'C.UTF-8',
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: '16000',
    CLAUDE_CODE_MAX_RETRIES: '0',
  };
}

export function validateOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !Array.isArray(value.files) || value.files.length < 1 || value.files.length > 25 ||
      !['summary', 'learned', 'next'].every(key => typeof value[key] === 'string') ||
      typeof value.spec_complete !== 'boolean') {
    throw new Error('Builder did not return the required structured output. No files were applied.');
  }
  const seen = new Set();
  for (const file of value.files) {
    const p = file?.path;
    if (typeof p !== 'string' || typeof file.content !== 'string' ||
        !p || path.posix.isAbsolute(p) || /[\\\x00-\x1f\x7f]/.test(p) ||
        p.split('/').some(part => !part || ['.', '..', '.git', '.github'].includes(part)) || seen.has(p)) {
      throw new Error('Builder returned an unsafe or duplicate file path. No files were applied.');
    }
    seen.add(p);
  }
  return value;
}

export async function generate({ prompt, env = process.env, query, timeoutMs = 900_000 }) {
  checkSubscription(env);
  const home = await mkdtemp(path.join(tmpdir(), 'centaurion-claude-'));
  const cwd = path.join(home, 'work');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await mkdir(cwd);
    const messages = query({
      prompt,
      options: {
        cwd,
        env: subscriptionEnvironment(env, home),
        model: env.BUILDER_MODEL || 'sonnet',
        systemPrompt: 'Return the requested code change as structured JSON. You cannot read or modify files or run commands. Use only the supplied context.',
        tools: [],
        mcpServers: {},
        strictMcpConfig: true,
        settingSources: [],
        settings: { forceLoginMethod: 'claudeai', disableAllHooks: true },
        permissionMode: 'dontAsk',
        persistSession: false,
        maxTurns: 3,
        abortController: controller,
        outputFormat: { type: 'json_schema', schema: outputSchema },
        // Never write raw stderr, credentials, prompts or returned source to CI logs.
        stderr: () => {},
      },
    });
    let output;
    for await (const message of messages) {
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success' || message.is_error || !message.structured_output) {
        throw new Error('The subscription request failed or returned incomplete output. Check subscription limits, token validity and model access; no paid fallback was attempted.');
      }
      output = validateOutput(message.structured_output);
    }
    if (!output) throw new Error('The subscription request ended without a result. No files were applied.');
    return output;
  } finally {
    clearTimeout(timeout);
    await rm(home, { recursive: true, force: true });
  }
}

async function main() {
  const [promptFile, outputFile] = process.argv.slice(2);
  checkSubscription(process.env);
  if (!promptFile || !outputFile) throw new Error('Usage: node generate.mjs <prompt.txt> <output.json>');
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
  const output = await generate({ prompt: await readFile(promptFile, 'utf8'), query });
  await writeFile(outputFile, JSON.stringify(output) + '\n', { mode: 0o600 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    // SDK exceptions can contain external response data. Keep the public error generic.
    console.error('::error::Subscription-only builder stopped. Check the setup gate, OAuth secret, subscription limits and SDK installation. No API-key fallback was attempted.');
    process.exitCode = 1;
  });
}
