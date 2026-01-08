#!/bin/bash
# Bash script to set Vercel environment variables
# Prerequisites: Install Vercel CLI first: npm i -g vercel

echo "Setting Vercel Environment Variables..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "✗ Vercel CLI not found. Please install it first:"
    echo "  npm i -g vercel"
    echo "  vercel login"
    echo "  vercel link"
    exit 1
fi

echo "✓ Vercel CLI found"
echo ""

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "✗ Not logged in. Please run: vercel login"
    exit 1
fi

echo "✓ Logged in to Vercel"
echo ""

echo "Setting KV_REST_API_URL..."
echo "https://charmed-javelin-7636.upstash.io" | vercel env add KV_REST_API_URL production

echo ""
echo "Setting KV_REST_API_TOKEN..."
echo "AR3UAAImcDIxNGU3NDQwMDQwMjc0N2RkYjZlM2IxOWIzZDQzZThhZnAyNzYzNg" | vercel env add KV_REST_API_TOKEN production

echo ""
echo "✅ Environment variables set!"
echo ""
echo "⚠️  Important: Redeploy your project for changes to take effect:"
echo "   vercel --prod"
echo "   or push a new commit to trigger automatic deployment"
