/**
 * Sync Postman Collection → API Dog
 *
 * Converts nexora-mock-apis.postman_collection.json to OpenAPI 3.0
 * with enum constraints on critical fields (so Faker.js returns valid values)
 * and imports into API Dog project 1204909 with overwrite mode.
 */

const fs = require('fs');
const https = require('https');

const API_KEY = 'adgp_6897470e7kcqtU01CFA9JE9YP89Ygm0GUoX4';
const PROJECT_ID = '1204909';
const MOCK_URL = 'https://mock.apidog.com/m1/1204909-1200223-default';
const MOCK_TOKEN = '4BwI4HdkyYbT3O2YbbJaE';

function apidogRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.apidog.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'X-Apidog-Api-Version': '2024-03-28',
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
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
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Build OpenAPI schema from a JSON example value.
 * Uses enum constraints for critical fields to prevent Faker.js from generating invalid values.
 */
function buildSchemaFromExample(obj, parentKey = '') {
  if (obj === null || obj === undefined) return {};
  const props = {};

  // Critical fields that MUST return exact values (not faker random)
  const ENUM_FIELDS = {
    type: null, // will use the actual value as enum
    status: null,
    success: null,
    currency: null,
    plan: null,
    sentiment: null,
    intent: null,
    category: null,
    resolution_status: null,
    urgency: null,
    format: null,
  };

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        const first = value[0];
        if (typeof first === 'object' && first !== null) {
          props[key] = {
            type: 'array',
            items: { type: 'object', properties: buildSchemaFromExample(first, key) },
          };
        } else if (typeof first === 'number') {
          props[key] = { type: 'array', items: { type: 'number', example: first } };
        } else {
          // For string arrays, use enum with exact values
          props[key] = { type: 'array', items: { type: 'string', enum: value } };
        }
      } else {
        props[key] = { type: 'array', items: { type: 'string' } };
      }
    } else if (typeof value === 'object' && value !== null) {
      props[key] = {
        type: 'object',
        properties: buildSchemaFromExample(value, key),
      };
    } else if (typeof value === 'number') {
      props[key] = {
        type: Number.isInteger(value) ? 'integer' : 'number',
        example: value,
        // For critical numeric fields, lock the value
        ...(key === 'balance' || key === 'score' || key === 'confidence'
          ? { enum: [value] }
          : {}),
      };
    } else if (typeof value === 'boolean') {
      props[key] = {
        type: 'boolean',
        example: value,
        // Lock boolean values for success/enabled fields
        ...(key in ENUM_FIELDS ? { enum: [value] } : {}),
      };
    } else {
      // String fields
      const isEnumField = key in ENUM_FIELDS;
      props[key] = {
        type: 'string',
        example: String(value),
        // Lock critical string fields to their exact values
        ...(isEnumField ? { enum: [String(value)] } : {}),
      };
    }
  }

  return props;
}

function postmanToOpenAPI(collection) {
  const spec = {
    openapi: '3.0.1',
    info: {
      title: collection.info.name,
      description: collection.info.description,
      version: '2.0.0', // Bump version to force update
    },
    paths: {},
    components: { schemas: {} },
  };

  collection.item.forEach((folder) => {
    folder.item.forEach((item) => {
      const req = item.request;
      const method = req.method.toLowerCase();

      // Build path from the raw URL parts
      const parts = (req.url.path || []).slice(); // copy
      let pathStr = '/' + parts.join('/');

      // Remove Postman variable parts like {{mockBaseUrl}}
      pathStr = pathStr.replace(/\{\{[^}]+\}\}/g, '');

      // Replace :param with {param} for path parameters
      pathStr = pathStr.replace(/:(\w+)/g, '{$1}');

      // Preserve trailing slashes (MSG91 requires them)
      // pathStr is already correct from the collection

      const operation = {
        summary: item.name,
        description: folder.name + ' — ' + item.name,
        operationId: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, ''),
        tags: [folder.name],
        responses: {},
      };

      // Extract path parameters
      const pathParams = [...pathStr.matchAll(/\{(\w+)\}/g)].map((m) => ({
        name: m[1],
        in: 'path',
        required: true,
        schema: { type: 'string' },
        example: 'mock-value',
      }));
      if (pathParams.length > 0) {
        operation.parameters = pathParams;
      }

      // Request body
      if (['post', 'put', 'patch'].includes(method) && req.body) {
        let bodyContent = {};
        try {
          const rawBody = req.body.raw || '{}';
          const cleanBody = rawBody.replace(/\{\{[^}]+\}\}/g, '"mock-value"');
          bodyContent = JSON.parse(cleanBody);
        } catch {
          bodyContent = {};
        }
        operation.requestBody = {
          content: {
            'application/json': {
              schema: { type: 'object', properties: buildSchemaFromExample(bodyContent) },
              example: bodyContent,
            },
          },
        };
      }

      // Response examples — this is the key part
      if (item.response && item.response.length > 0) {
        item.response.forEach((resp) => {
          const statusCode = String(resp.code || 200);
          let responseBody = {};
          try {
            responseBody = JSON.parse(resp.body || '{}');
          } catch {
            responseBody = {};
          }

          operation.responses[statusCode] = {
            description: resp.name || 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: buildSchemaFromExample(responseBody),
                },
                example: responseBody,
              },
            },
          };
        });
      } else {
        operation.responses['200'] = {
          description: 'Success',
          content: {
            'application/json': {
              schema: { type: 'object' },
              example: { success: true },
            },
          },
        };
      }

      if (!spec.paths[pathStr]) {
        spec.paths[pathStr] = {};
      }
      spec.paths[pathStr][method] = operation;
    });
  });

  return spec;
}

async function main() {
  console.log('📦 Reading Postman collection...');
  const col = JSON.parse(fs.readFileSync('nexora-mock-apis.postman_collection.json', 'utf8'));

  let endpointCount = 0;
  col.item.forEach((folder) => {
    endpointCount += folder.item.length;
  });
  console.log(`   ${endpointCount} endpoints in ${col.item.length} folders\n`);

  console.log('🔄 Converting to OpenAPI 3.0 with enum constraints...');
  const openApiSpec = postmanToOpenAPI(col);
  const pathCount = Object.keys(openApiSpec.paths).length;
  console.log(`   ${pathCount} paths generated`);

  // Show paths for verification
  Object.keys(openApiSpec.paths).forEach((p) => {
    const methods = Object.keys(openApiSpec.paths[p]);
    console.log(`   ${methods.map((m) => m.toUpperCase()).join(', ')}  ${p}`);
  });

  // Save locally
  fs.writeFileSync('tmp/openapi-mock-spec-v2.json', JSON.stringify(openApiSpec, null, 2));
  console.log('\n   Saved to tmp/openapi-mock-spec-v2.json');

  // Import into API Dog with OVERWRITE
  console.log('\n📤 Importing into API Dog project ' + PROJECT_ID + '...');
  const importResult = await apidogRequest(
    'POST',
    `/v1/projects/${PROJECT_ID}/import-openapi?locale=en-US`,
    {
      input: JSON.stringify(openApiSpec),
      options: {
        endpointOverwriteBehavior: 'OVERWRITE_EXISTING',
        schemaOverwriteBehavior: 'OVERWRITE_EXISTING',
        updateFolderOfChangedEndpoint: true,
        prependBasePath: false,
      },
    }
  );

  if (importResult.status === 200 || importResult.status === 201) {
    const d = importResult.body?.data || importResult.body;
    console.log('   ✅ Import result:');
    console.log(`   Endpoints: created=${d.endpointCreatedCount || 0}, updated=${d.endpointUpdatedCount || 0}, failed=${d.endpointFailedCount || 0}, ignored=${d.endpointIgnoredCount || 0}`);
    console.log(`   Schemas: created=${d.schemaCreatedCount || 0}, updated=${d.schemaUpdatedCount || 0}`);
    if (d.errors && d.errors.length > 0) {
      console.log('   Errors:');
      d.errors.slice(0, 5).forEach((e) => console.log('    -', e.message || JSON.stringify(e)));
    }
  } else {
    console.log('   ❌ Import failed:', importResult.status);
    console.log('   ', JSON.stringify(importResult.body).substring(0, 500));
    return;
  }

  // Test endpoints
  console.log('\n🧪 Testing mock endpoints (waiting 5s for propagation)...');
  await new Promise((r) => setTimeout(r, 5000));

  const tests = [
    { method: 'GET', path: '/api/v5/user/balance/', expect: 'balance' },
    { method: 'POST', path: '/api/v5/whatsapp/whatsapp-outbound-message/', expect: 'type' },
    { method: 'GET', path: '/api/v5/whatsapp/whatsapp-activation/', expect: 'data' },
    { method: 'POST', path: '/api/v5/flow/', expect: 'type' },
    { method: 'POST', path: '/api/v5/otp/send', expect: 'type' },
    { method: 'POST', path: '/v2/calls', expect: 'success' },
    { method: 'GET', path: '/v2/calls/mock-call-z1a2b3c4', expect: 'call_id' },
    { method: 'POST', path: '/emails', expect: 'id' },
    { method: 'GET', path: '/domains', expect: 'data' },
    { method: 'POST', path: '/ai/summarize', expect: 'summary' },
    { method: 'POST', path: '/ai/suggest-reply', expect: 'suggestions' },
    { method: 'POST', path: '/ai/sentiment', expect: 'sentiment' },
    { method: 'POST', path: '/ai/classify-intent', expect: 'intent' },
  ];

  let passed = 0;
  let enumCorrect = 0;
  for (const test of tests) {
    const result = await new Promise((resolve, reject) => {
      const url = new URL(MOCK_URL + test.path);
      const options = {
        hostname: url.hostname,
        path: url.pathname + '?apidogToken=' + MOCK_TOKEN,
        method: test.method,
        headers: { 'Content-Type': 'application/json' },
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

    const ok = result.status === 200;
    if (ok) passed++;

    // Check if enum field returned correct value
    const body = result.body;
    let enumOk = '';
    if (ok && body) {
      if (test.expect === 'type' && body.type === 'success') {
        enumOk = ' ✓ type=success';
        enumCorrect++;
      } else if (test.expect === 'success' && body.success === true) {
        enumOk = ' ✓ success=true';
        enumCorrect++;
      } else if (test.expect === 'balance' && typeof body.balance === 'number') {
        enumOk = ` ✓ balance=${body.balance}`;
        if (body.currency === 'INR') enumCorrect++;
      } else if (test.expect === 'sentiment' && body.sentiment) {
        enumOk = ` ✓ sentiment=${body.sentiment}`;
        if (body.sentiment === 'positive') enumCorrect++;
      } else if (test.expect === 'intent' && body.intent) {
        enumOk = ` ✓ intent=${body.intent}`;
        enumCorrect++;
      }
    }

    const icon = ok ? '✅' : '❌';
    const preview = JSON.stringify(result.body).substring(0, 70);
    console.log(`   ${icon} ${test.method} ${test.path} → ${result.status}${enumOk}`);
    console.log(`      ${preview}...`);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`✅ ${passed}/${tests.length} endpoints responding`);
  console.log(`🎯 ${enumCorrect}/${tests.length} returning correct enum values`);
  console.log(`📡 Mock URL: ${MOCK_URL}`);
  console.log(`🔑 Token: ${MOCK_TOKEN}`);
  console.log(`═══════════════════════════════════════`);
}

main().catch(console.error);
