#!/usr/bin/env bash
# Apply all supabase/migrations to your linked personal project.
# Prerequisites: npx supabase login (once), then this script prompts for DB password.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="${VITE_SUPABASE_PROJECT_ID:-jhamklxdmxvlphimolbs}"

echo "→ Linking project ${PROJECT_REF} (skip if already linked)..."
npx supabase@latest link --project-ref "$PROJECT_REF" || true

echo "→ Pushing migrations..."
npx supabase@latest db push --yes

echo "→ Deploying analyze-document + analyze-client-documents edge functions..."
npx supabase@latest functions deploy analyze-document --no-verify-jwt
npx supabase@latest functions deploy analyze-client-documents --no-verify-jwt
npx supabase@latest functions deploy seed-demo-users --no-verify-jwt

echo "→ Seeding demo auth users..."
SUPABASE_URL="${VITE_SUPABASE_URL:-https://jhamklxdmxvlphimolbs.supabase.co}"
SUPABASE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY:-}"
if [[ -z "$SUPABASE_KEY" && -f .env ]]; then
  SUPABASE_KEY="$(grep '^VITE_SUPABASE_PUBLISHABLE_KEY=' .env | cut -d= -f2- | tr -d '"')"
fi
curl -sf -X POST "${SUPABASE_URL}/functions/v1/seed-demo-users" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}' >/dev/null

echo ""
echo "Optional — real PDF analysis with Google Gemini (free tier):"
echo "  1. Get a key: https://aistudio.google.com/apikey"
echo "  2. npx supabase secrets set GEMINI_API_KEY=your_key"
echo ""
echo "Done. Next steps:"
echo "  1. npm run dev → login as admin@tax-checker.demo / TaxChecker-Demo-2026!"
echo "  2. Dashboard → Load Demo Data"
