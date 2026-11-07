# Subscription-only Centaurion builder

The nightly workflow uses the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`),
authenticated with Malik's Claude subscription. This is not the Anthropic API client
SDK (`@anthropic-ai/sdk`), and it does not use an API key or fall back to paid API
billing. The Agent SDK runs Anthropic's unmodified Claude Code runtime. Its transitive
dependencies can include the API client SDK; the credential and billing route are what
matter, not the absence of the word "SDK" or an HTTP connection.

## Activation requires the account owner's authorization

1. In Claude **Settings > Usage**, disable **Usage credits / extra usage** for the
   account that will run this workflow. OAuth alone does not prevent extra charges if
   paid overage is enabled. This workflow cannot inspect or change that account setting.
2. Check whether a suitable `CLAUDE_CODE_OAUTH_TOKEN` already exists; do not create a
   duplicate. If needed, authorize creating a long-lived, inference-only subscription
   token and storing it in this repository's GitHub Actions secrets. On a trusted computer with Claude Code,
   run `claude setup-token`, select the correct subscription account, and complete its
   browser authorization. Do not paste the token into chat, code, logs, or a public PR.
3. Store it as the repository secret `CLAUDE_CODE_OAUTH_TOKEN` in
   [Agent-Assembly Actions secrets](https://github.com/MalikJPalamar/Agent-Assembly/settings/secrets/actions).
   An existing `ANTHROPIC_API_KEY` secret is not read by this workflow. Removing it is
   optional and is a separate account/security change.
4. Only after step 1 has been verified, set the repository **variable**
   `CLAUDE_USAGE_CREDITS_DISABLED` to `true`. This is an owner's attestation, not an
   automatic billing check. Unset it before re-enabling paid usage credits.
5. Review and approve publication/activation of the workflow. A live build pushes a
   branch and can automatically merge passing improvements into public `main`, just as
   the existing workflow did. Do not trigger a live run merely to test authentication.

Runs consume the account's included subscription allowance and can reduce what is
available for interactive Claude use. With paid usage credits disabled, exhausted
allowance should stop the run; it must not prompt for a purchase or switch providers.
No new subscription, credits purchase, or auto-reload is needed. Existing plan charges
continue. GitHub runner billing is separate from Anthropic billing.

## Technical behavior

- Pin the SDK and its dependency tree with `package-lock.json`; install without lifecycle
  scripts. The native Claude Code binary comes from Anthropic's platform package.
- The billing-confirmation gate runs before spec selection. The credential preflight
  requires an OAuth secret before the SDK is installed or inference is attempted.
- Supply an isolated temporary home and a minimal subprocess environment, excluding API
  keys, provider switches, gateways, profiles, helper scripts and GitHub credentials.
- Disable filesystem settings, custom MCP servers and hooks. Use `forceLoginMethod:
  "claudeai"`, no filesystem/shell tools, a three-turn cap and a 15-minute timeout.
- Request schema-validated output, reject missing/failed/incomplete results and unsafe
  paths, then pass the JSON to the existing file applier. The SDK cannot commit or push.
- Keep the existing spec selection, prompt, Jest scoring, keep/discard and reporting
  steps. Authentication/limit failures stop generation rather than triggering paid
  fallback. The existing Reporter may still record a DISCARD for a failed build.
- These controls assume the current `ubuntu-latest` GitHub-hosted runner. Moving this
  workflow to a managed or self-hosted machine requires reviewing its machine policies
  and authentication sources before use.

No SDK setting is claimed to be a universal zero-dollar spending cap. The account's
disabled paid-overage setting is essential; `maxTurns` and timeouts only bound work.

## Validation without model usage

```sh
npm ci --prefix .github/builder --ignore-scripts --no-audit --no-fund
npm test --prefix .github/builder
npm install --prefix centaurion-framework --ignore-scripts --no-audit --no-fund
npm test --prefix centaurion-framework -- --runInBand
```

The adapter tests use a fake SDK query, never a real credential or model call. They cover
the billing/credential gate, environment isolation, failed and incomplete responses,
timeouts, output validation and the workflow's lack of any API-key route.

## Current separate limitation

`s02` (Terra wearable sandbox client) is the first `todo`, but `specs/s02.md` is absent.
The existing workflow falls back to its queue title and generic instructions. This
migration deliberately does not invent acceptance criteria or mark the spec complete.
The prompt also lists existing source/test filenames rather than supplying their
contents. Those are quality/requirements gaps, separate from the authentication fix.

## Official references checked November 7, 2026

- [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan): signed-in SDK use still draws from subscription limits.
- [Claude Code authentication](https://code.claude.com/docs/en/authentication): `claude setup-token`, subscription OAuth and credential precedence.
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions): subscription-token authentication in CI.
- [Manage usage credits](https://support.claude.com/en/articles/12429409-manage-usage-credits-for-paid-claude-plans): disable paid credits in Settings > Usage.
- [Agent SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript) and [structured output](https://code.claude.com/docs/en/agent-sdk/structured-outputs).
- [SDK v0.3.319](https://github.com/anthropics/claude-agent-sdk-typescript/releases/tag/v0.3.319).

This is personal development automation using the subscription owner's own credential.
It does not resell access or offer the owner's subscription to end users. Anthropic's
current terms and subscription limits continue to apply.
