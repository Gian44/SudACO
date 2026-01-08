#!/usr/bin/env node
/**
 * Quick script to set Vercel environment variables
 * Usage: node scripts/set-env-vars.js
 */

import { execSync } from 'child_process';

const envVars = {
  KV_REST_API_URL: 'https://charmed-javelin-7636.upstash.io',
  KV_REST_API_TOKEN: 'AR3UAAImcDIxNGU3NDQwMDQwMjc0N2RkYjZlM2IxOWIzZDQzZThhZnAyNzYzNg'
};

function setEnvVar(key, value, environment = 'production') {
  try {
    console.log(`Setting ${key} for ${environment}...`);
    
    // Use echo to pipe the value to vercel env add
    const command = `echo "${value}" | vercel env add ${key} ${environment === 'all' ? '--all' : `--env=${environment}`}`;
    
    execSync(command, {
      stdio: 'inherit',
      shell: true
    });
    
    console.log(`✅ Set ${key} for ${environment}\n`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set ${key} for ${environment}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Setting Vercel Environment Variables\n');
  console.log('Make sure you are:');
  console.log('1. Logged in to Vercel (vercel login)');
  console.log('2. In the client directory');
  console.log('3. Project is linked (vercel link)\n');

  // Check if vercel CLI is available
  try {
    execSync('vercel --version', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ Vercel CLI not found. Install it with: npm i -g vercel');
    process.exit(1);
  }

  // Check if authenticated
  try {
    execSync('vercel whoami', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ Not logged in to Vercel. Run: vercel login');
    process.exit(1);
  }

  console.log('Setting environment variables for production...\n');

  // Set variables for production
  for (const [key, value] of Object.entries(envVars)) {
    setEnvVar(key, value, 'production');
  }

  console.log('✅ All environment variables set!\n');
  console.log('⚠️  Important: Redeploy your project for changes to take effect:');
  console.log('   vercel --prod');
  console.log('   or push a new commit to trigger automatic deployment\n');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
