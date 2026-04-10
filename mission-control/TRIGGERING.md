# Triggering the Centaurion Builder

## Automatic (Daily)
Runs Mon-Fri at 09:00 CET automatically via GitHub Actions cron.

## Manual Trigger
Go to [Actions tab](https://github.com/MalikJPalamar/Agent-Assembly/actions) > "Centaurion Daily Builder" > "Run workflow"

Options:
- **spec_override:** Leave empty for auto-selection, or enter a spec ID (e.g. `s01`)
- **mode:** `build` (default), `review` (tests only), `report` (status update only)

## Via CLI (GitHub CLI)
```bash
# Run default build cycle
gh workflow run centaurion-daily-builder.yml

# Override to specific spec
gh workflow run centaurion-daily-builder.yml -f spec_override=s03

# Report only
gh workflow run centaurion-daily-builder.yml -f mode=report
```

## Via API
```bash
curl -X POST \
  -H "Authorization: token YOUR_PAT" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/MalikJPalamar/Agent-Assembly/actions/workflows/centaurion-daily-builder.yml/dispatches \
  -d '{"ref":"main","inputs":{"spec_override":"s01","mode":"build"}}'
```

## Required Secrets
Set these in repo Settings > Secrets and variables > Actions:
- `ANTHROPIC_API_KEY` — Your Claude API key
- `SUPABASE_URL` — Your Supabase project URL (cbguyrcrsuiqiummbdua)
- `SUPABASE_KEY` — Your Supabase service role key
