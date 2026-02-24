# Nexora CRM360 — Postman Mock API Setup

## Quick Start

1. **Import Collection** into Postman:
   - Open Postman → Import → Upload `nexora-mock-apis.postman_collection.json`

2. **Create Mock Server**:
   - Right-click the imported collection → "Mock Collection"
   - Name: `Nexora CRM360 Mock`
   - Copy the generated URL (e.g., `https://abc123.mock.pstmn.io`)

3. **Import Environment**:
   - Import `nexora-mock-env.postman_environment.json`
   - Update the `url` variable with your mock server URL

4. **Connect in Nexora**:
   - Go to **Settings → Integrations**
   - Click **Postman (Mock Data)**
   - Paste your mock server URL
   - Click **Test Connection** → should show green success

## What's Mocked

| Folder         | Endpoints | Format       |
| -------------- | --------- | ------------ |
| MSG91 WhatsApp | 10        | MSG91 API v5 |
| MSG91 SMS      | 3         | MSG91 API v5 |
| Fast2SMS       | 4         | Fast2SMS API |
| TeleCMI Voice  | 3         | TeleCMI v2   |
| Resend Email   | 4         | Resend API   |
| AI Services    | 4         | Custom       |

**Total: 28 mock endpoints**

## How It Works

- Postman mock servers match incoming requests to saved examples (responses)
- Request matching is based on method + path
- All responses return realistic Indian SMB data
- PostgreSQL data stays real — only third-party HTTP calls are mocked

## Environment Variables

For env-var level routing (applies to all channels at once):

```env
MOCK_API_ENABLED=true
MOCK_SERVER_URL=https://abc123.mock.pstmn.io
```

For per-account routing, configure the mock URL through the Settings UI instead.
