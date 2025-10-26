#!/bin/bash

# signos-tok Setup Script
# Automated setup for the text-to-sign-language video generator

set -e

echo "═══════════════════════════════════════════════════════════"
echo "🤟 signos-tok Setup"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not installed"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm not found. Installing..."
    npm install -g pnpm
fi

echo "✅ pnpm $(pnpm --version)"

# Navigate to worker directory
cd "$(dirname "$0")/worker"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Check for .dev.vars
if [ ! -f ".dev.vars" ]; then
    echo ""
    echo "⚠️  .dev.vars not found"
    echo ""
    echo "Creating .dev.vars from template..."
    cp .dev.vars.example .dev.vars
    
    echo ""
    echo "⚠️  IMPORTANT: Edit .dev.vars with your Cloudflare credentials!"
    echo ""
    echo "   1. Get your account ID: https://dash.cloudflare.com/"
    echo "   2. Create an API token: https://dash.cloudflare.com/profile/api-tokens"
    echo "   3. Edit .dev.vars and add:"
    echo "      CF_ACCOUNT=your_account_id"
    echo "      CF_API_TOKEN=your_api_token"
    echo ""
    read -p "Press Enter after you've updated .dev.vars..."
fi

# Check if credentials are set
if grep -q "your_cloudflare_account_id" .dev.vars; then
    echo ""
    echo "❌ Error: .dev.vars still contains placeholder values"
    echo "   Please update CF_ACCOUNT and CF_API_TOKEN"
    exit 1
fi

echo "✅ .dev.vars configured"

# Create R2 bucket
echo ""
echo "🪣 Creating R2 bucket..."
if npx wrangler r2 bucket create signos-tok-videos 2>/dev/null; then
    echo "✅ R2 bucket created: signos-tok-videos"
else
    echo "⚠️  Bucket may already exist (this is fine)"
fi

# Verify Vectorize index
echo ""
echo "🔍 Checking Vectorize index..."
if npx wrangler vectorize list 2>/dev/null | grep -q "signos-lsch-index"; then
    echo "✅ Vectorize index found: signos-lsch-index"
else
    echo "⚠️  Vectorize index not found"
    echo "   You need to create it from signsToJson project"
    echo "   See: ../signsToJson/README_PIPELINE.md"
fi

# Success
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Setup complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the worker:"
echo "     cd worker && pnpm dev"
echo ""
echo "  2. Test it:"
echo "     cd cli && node generate-video.mjs \"hola\""
echo ""
echo "  3. Or run the test suite:"
echo "     cd worker && pnpm test"
echo ""
echo "📖 Documentation:"
echo "   - README.md - Full documentation"
echo "   - QUICKSTART.md - Quick start guide"
echo "   - EXAMPLES.md - Usage examples"
echo ""
echo "🚀 Happy generating!"
echo ""

