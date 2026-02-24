/**
 * Postman Mock Server Setup Script
 *
 * Fixes the collection with originalRequest in all response examples,
 * then updates the Postman collection so mock matching works.
 */

const fs = require('fs');
const https = require('https');

const API_KEY =
  process.env.POSTMAN_API_KEY ||
  fs
    .readFileSync('../../.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith('POSTMAN_API_KEY='))
    ?.split('=')[1]
    ?.trim();

const COLLECTION_UID = '52055659-fb48f8e0-8960-45b5-a7c3-f6bee0941999';
const MOCK_URL = 'https://ce4ff798-9317-421c-84b3-b3a527cda842.mock.pstmn.io';

function postmanRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.getpostman.com',
      path,
      method,
      headers: {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  console.log('Reading local collection...');
  const col = JSON.parse(fs.readFileSync('nexora-mock-apis.postman_collection.json', 'utf8'));

  // Add originalRequest to all response examples (required for mock matching)
  let fixedCount = 0;
  col.item.forEach((folder) => {
    folder.item.forEach((item) => {
      if (item.response && item.response.length > 0) {
        item.response.forEach((resp) => {
          if (!resp.originalRequest) {
            resp.originalRequest = {
              method: item.request.method,
              url: item.request.url,
              header: item.request.header || [],
              body: item.request.body || undefined,
            };
            fixedCount++;
          }
          if (!resp._postmanPreviewlanguage) {
            resp._postmanPreviewlanguage = 'json';
          }
        });
      }
    });
  });
  console.log(`  Fixed ${fixedCount} response examples with originalRequest`);

  // Save fixed collection locally
  fs.writeFileSync('nexora-mock-apis.postman_collection.json', JSON.stringify(col, null, 2));
  console.log('  Saved fixed collection locally');

  // Update collection on Postman
  console.log('\nUpdating collection on Postman...');
  delete col.info._postman_id;
  const updateResult = await postmanRequest('PUT', `/collections/${COLLECTION_UID}`, {
    collection: col,
  });

  if (updateResult.collection) {
    console.log(
      `  ✅ Collection updated: ${updateResult.collection.name} (${updateResult.collection.uid})`
    );
  } else {
    console.log('  ❌ Update failed:', JSON.stringify(updateResult));
    return;
  }

  // Test mock server
  console.log('\nTesting mock server...');
  const tests = [
    { method: 'GET', path: '/api/v5/user/balance/' },
    { method: 'POST', path: '/api/v5/whatsapp/whatsapp-outbound-message/' },
    { method: 'POST', path: '/emails' },
    { method: 'POST', path: '/ai/summarize' },
  ];

  for (const test of tests) {
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'ce4ff798-9317-421c-84b3-b3a527cda842.mock.pstmn.io',
        path: test.path,
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
          'x-mock-match-request-body': 'false',
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      if (test.method === 'POST') req.write('{}');
      req.end();
    });

    const ok = result.status === 200 ? '✅' : '❌';
    console.log(`  ${ok} ${test.method} ${test.path} → ${result.status}`);
    if (result.status === 200) {
      const preview = JSON.stringify(result.body).substring(0, 80);
      console.log(`     ${preview}...`);
    }
  }

  console.log(`\n✅ Mock Server URL: ${MOCK_URL}`);
}

main().catch(console.error);
