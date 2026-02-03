# CRM360 Tracker - JavaScript SDK

Browser-side visitor tracking SDK with automatic page views, click tracking, form capture, and session recording.

## Installation

### Script Tag (Recommended)

```html
<script
  src="https://your-crm360.com/tracker.min.js"
  data-api-key="YOUR_API_KEY"
  data-endpoint="https://your-crm360.com/api/v1/tracking/collect"
  async
></script>
```

### NPM

```bash
npm install @crm360/tracker
```

```javascript
import CRM360Tracker from '@crm360/tracker';

const tracker = new CRM360Tracker({
  apiKey: 'YOUR_API_KEY',
  endpoint: 'https://your-crm360.com/api/v1/tracking/collect',
  sessionRecording: true
});
```

## Features

- **Auto Page Views**: Tracks all page views including SPA navigation
- **Click Tracking**: Records click events with element details
- **Scroll Depth**: Tracks how far users scroll
- **Form Tracking**: Captures form submissions (sensitive fields masked)
- **Session Recording**: Full session replay using rrweb
- **User Identification**: Link visitors to CRM contacts

## Usage

```javascript
// Identify user after login
window.crm360?.identify({
  email: 'user@example.com',
  name: 'John Doe',
  company: 'Acme Inc'
});

// Track custom event
window.crm360?.track('button_click', {
  button: 'signup',
  page: '/pricing'
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | Your tracking API key |
| `endpoint` | string | required | Tracking API URL |
| `sessionRecording` | boolean | false | Enable session replay |
| `trackClicks` | boolean | true | Track click events |
| `trackScrollDepth` | boolean | true | Track scroll depth |
| `trackForms` | boolean | true | Track form submissions |

See [full documentation](../../docs/TRACKING_SDK.md) for details.

## License

MIT
