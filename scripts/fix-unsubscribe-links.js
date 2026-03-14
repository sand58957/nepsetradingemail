#!/usr/bin/env node
/**
 * Fix unsubscribe links in all gallery templates.
 * Replaces href="#" placeholder links with Listmonk template variables:
 *   - Unsubscribe → {{ UnsubscribeURL }}
 *   - View in Browser → {{ MessageURL }}
 *
 * Usage:
 *   node scripts/fix-unsubscribe-links.js
 */

const https = require('https');

const BACKEND_URL = process.env.BACKEND_URL || 'https://nepalfillings.com';
const BACKEND_EMAIL = process.env.BACKEND_EMAIL || '008snk@gmail.com';
const BACKEND_PASSWORD = process.env.BACKEND_PASSWORD || 'admin123';

let JWT_TOKEN = '';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api${path.replace('/api', '')}`, BACKEND_URL);
    const payload = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function loginBackend() {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/auth/login', BACKEND_URL);
    const payload = JSON.stringify({ email: BACKEND_EMAIL, password: BACKEND_PASSWORD });

    const opts = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.data?.access_token || '');
        } catch {
          resolve('');
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('Connecting to backend at', BACKEND_URL);
  JWT_TOKEN = await loginBackend();
  if (!JWT_TOKEN) {
    console.error('Failed to get JWT token.');
    process.exit(1);
  }
  console.log('Authenticated.\n');

  // Fetch all templates
  const res = await apiRequest('GET', '/templates');
  if (res.status !== 200) {
    console.error('Cannot fetch templates:', res.status);
    process.exit(1);
  }

  const templates = res.data?.data || [];
  // Filter to gallery templates (those with [Category] prefix)
  const galleryTemplates = templates.filter(t => /^\[.+\]/.test(t.name));
  console.log(`Found ${galleryTemplates.length} gallery templates to check.\n`);

  let updated = 0;
  let alreadyOk = 0;
  let failed = 0;

  for (const tpl of galleryTemplates) {
    const body = tpl.body || '';

    // Check if it has placeholder unsubscribe links
    const hasPlaceholderUnsub = body.includes('>Unsubscribe</a>') && !body.includes('{{ UnsubscribeURL }}');
    const hasPlaceholderBrowser = body.includes('>View in Browser</a>') && !body.includes('{{ MessageURL }}');

    if (!hasPlaceholderUnsub && !hasPlaceholderBrowser) {
      alreadyOk++;
      continue;
    }

    // Replace placeholder links with Listmonk variables
    let newBody = body;

    // Replace unsubscribe link: find <a href="#" ...>Unsubscribe</a> pattern
    newBody = newBody.replace(
      /<a\s+href="#"([^>]*?)>Unsubscribe<\/a>/g,
      '<a href="{{ UnsubscribeURL }}"$1>Unsubscribe</a>'
    );

    // Replace view in browser link
    newBody = newBody.replace(
      /<a\s+href="#"([^>]*?)>View in Browser<\/a>/g,
      '<a href="{{ MessageURL }}"$1>View in Browser</a>'
    );

    // Update the template — Listmonk requires id (int) in body
    try {
      const updateRes = await apiRequest('PUT', `/templates/${tpl.id}`, {
        id: tpl.id,
        name: tpl.name,
        body: newBody,
        type: tpl.type || 'campaign',
      });

      if (updateRes.status === 200) {
        console.log(`  Updated: ${tpl.name}`);
        updated++;
      } else {
        console.log(`  Failed (${updateRes.status}): ${tpl.name} - ${JSON.stringify(updateRes.data)}`);
        failed++;
      }
    } catch (err) {
      console.log(`  Error: ${tpl.name} - ${err.message}`);
      failed++;
    }

    // Small delay
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n---');
  console.log(`Summary: ${galleryTemplates.length} checked, ${updated} updated, ${alreadyOk} already ok, ${failed} failed`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
