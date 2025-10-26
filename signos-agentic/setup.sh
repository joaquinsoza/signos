#!/bin/bash

# 🚀 SIGNOS Agentic - Setup Script
# Automated setup for local development

set -e  # Exit on error

echo "🤟 SIGNOS Agentic - Setup Script"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi
echo "✅ Node.js: $(node --version)"

if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm not found. Installing..."
    npm install -g pnpm
fi
echo "✅ pnpm: $(pnpm --version)"

if ! command -v wrangler &> /dev/null; then
    echo "⚠️  wrangler not found. Installing..."
    npm install -g wrangler
fi
echo "✅ wrangler: $(wrangler --version)"

echo ""
echo "${BLUE}Step 1/5:${NC} Installing Worker dependencies..."
cd worker
pnpm install
echo "✅ Worker dependencies installed"

echo ""
echo "${BLUE}Step 2/5:${NC} Creating D1 database..."
echo "Run this command manually and update wrangler.toml:"
echo "${YELLOW}wrangler d1 create signos-agentic-db${NC}"
echo ""
read -p "Press enter after you've updated wrangler.toml with the database_id..."

echo ""
echo "${BLUE}Step 3/5:${NC} Initializing database..."
pnpm run db:init-local
echo "✅ Database initialized"

echo ""
echo "${BLUE}Step 4/5:${NC} Creating KV namespace..."
echo "Run this command manually and update wrangler.toml:"
echo "${YELLOW}wrangler kv:namespace create SESSIONS${NC}"
echo ""
read -p "Press enter after you've updated wrangler.toml with the KV id..."

echo ""
echo "${BLUE}Step 5/5:${NC} Installing Frontend dependencies..."
cd ../frontend
pnpm install
echo "✅ Frontend dependencies installed"

# Create .env file
echo ""
echo "Creating .env file..."
cat > .env << EOF
VITE_WORKER_URL=http://localhost:8787
EOF
echo "✅ .env file created"

echo ""
echo "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "To start developing:"
echo ""
echo "Terminal 1 (Worker):"
echo "  ${YELLOW}cd worker && pnpm dev${NC}"
echo ""
echo "Terminal 2 (Frontend):"
echo "  ${YELLOW}cd frontend && pnpm dev${NC}"
echo ""
echo "Then open: ${BLUE}http://localhost:3000${NC}"
echo ""
echo "Happy coding! 🤟"

