#!/usr/bin/env node
/**
 * Setup script for Vercel KV environment variables
 * 
 * This script helps you set up KV_REST_API_URL and KV_REST_API_TOKEN
 * in your Vercel project using the Vercel CLI.
 * 
 * Prerequisites:
 * 1. Install Vercel CLI: npm i -g vercel
 * 2. Login to Vercel: vercel login
 * 3. Link your project: vercel link (from client directory)
 * 4. Create KV database in Vercel Dashboard and get credentials
 * 
 * Usage:
 *   node scripts/setup-vercel-kv.js
 *   # or
 *   npm run setup:kv
 */

import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkVercelCLI() {
  try {
    execSync('vercel --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

async function checkVercelAuth() {
  try {
    execSync('vercel whoami', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

async function checkProjectLinked() {
  try {
    execSync('vercel project ls', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

async function setEnvVar(key, value, environment = 'production') {
  try {
    const envFlag = environment === 'all' ? '--all' : `--env=${environment}`;
    execSync(`vercel env add ${key} ${envFlag}`, {
      input: value + '\n',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return true;
  } catch (e) {
    console.error(`Failed to set ${key}:`, e.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Vercel KV Environment Variables Setup\n');
  console.log('This script will help you set up KV_REST_API_URL and KV_REST_API_TOKEN.\n');
  console.log('Prerequisites:');
  console.log('1. Create a KV database in Vercel Dashboard');
  console.log('2. Get REST API URL and Token from KV Settings\n');

  // Check Vercel CLI
  console.log('Checking Vercel CLI...');
  if (!await checkVercelCLI()) {
    console.error('❌ Vercel CLI not found. Install it with: npm i -g vercel');
    process.exit(1);
  }
  console.log('✅ Vercel CLI found\n');

  // Check authentication
  console.log('Checking Vercel authentication...');
  if (!await checkVercelAuth()) {
    console.log('⚠️  Not logged in to Vercel. Please run: vercel login');
    const shouldLogin = await question('Do you want to login now? (y/n): ');
    if (shouldLogin.toLowerCase() === 'y') {
      execSync('vercel login', { stdio: 'inherit' });
    } else {
      console.log('Please login and run this script again.');
      process.exit(1);
    }
  }
  console.log('✅ Authenticated with Vercel\n');

  // Check project link
  console.log('Checking project link...');
  if (!await checkProjectLinked()) {
    console.log('⚠️  Project not linked. Please run: vercel link');
    const shouldLink = await question('Do you want to link now? (y/n): ');
    if (shouldLink.toLowerCase() === 'y') {
      execSync('vercel link', { stdio: 'inherit' });
    } else {
      console.log('Please link your project and run this script again.');
      process.exit(1);
    }
  }
  console.log('✅ Project linked\n');

  // Get credentials
  console.log('Please provide your Vercel KV credentials:');
  console.log('(Get them from: Vercel Dashboard → Storage → Your KV → Settings → REST API)\n');

  const kvUrl = await question('KV_REST_API_URL: ');
  if (!kvUrl || !kvUrl.trim()) {
    console.error('❌ KV_REST_API_URL is required');
    process.exit(1);
  }

  const kvToken = await question('KV_REST_API_TOKEN: ');
  if (!kvToken || !kvToken.trim()) {
    console.error('❌ KV_REST_API_TOKEN is required');
    process.exit(1);
  }

  // Ask for environments
  console.log('\nWhich environments should these variables be set for?');
  const envChoice = await question('(1) Production only, (2) All environments, (3) Custom: ');
  
  let environments = ['production'];
  if (envChoice === '2') {
    environments = ['production', 'preview', 'development'];
  } else if (envChoice === '3') {
    const customEnv = await question('Enter environments (comma-separated, e.g., production,preview): ');
    environments = customEnv.split(',').map(e => e.trim());
  }

  // Optional CRON_SECRET
  console.log('\nOptional: Set CRON_SECRET for securing the cron endpoint?');
  const setCronSecret = await question('(y/n): ');
  let cronSecret = null;
  if (setCronSecret.toLowerCase() === 'y') {
    cronSecret = await question('CRON_SECRET (or press Enter to generate): ');
    if (!cronSecret || !cronSecret.trim()) {
      // Generate random secret
      const crypto = await import('crypto');
      cronSecret = crypto.randomBytes(32).toString('hex');
      console.log(`Generated CRON_SECRET: ${cronSecret}`);
    }
  }

  // Set environment variables
  console.log('\n📝 Setting environment variables...\n');

  for (const env of environments) {
    console.log(`Setting variables for ${env} environment...`);
    
    const urlSuccess = await setEnvVar('KV_REST_API_URL', kvUrl.trim(), env);
    const tokenSuccess = await setEnvVar('KV_REST_API_TOKEN', kvToken.trim(), env);
    
    if (urlSuccess && tokenSuccess) {
      console.log(`✅ Set KV variables for ${env}\n`);
    } else {
      console.error(`❌ Failed to set variables for ${env}\n`);
    }

    if (cronSecret) {
      const cronSuccess = await setEnvVar('CRON_SECRET', cronSecret.trim(), env);
      if (cronSuccess) {
        console.log(`✅ Set CRON_SECRET for ${env}\n`);
      }
    }
  }

  console.log('✅ Setup complete!\n');
  console.log('⚠️  Important: Redeploy your project for changes to take effect:');
  console.log('   vercel --prod');
  console.log('   or push a new commit to trigger automatic deployment\n');

  rl.close();
}

main().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
