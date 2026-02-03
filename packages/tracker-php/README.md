# CRM360 Tracker - PHP SDK

Server-side visitor tracking SDK for PHP applications.

## Installation

```bash
composer require crm360/tracker
```

## Quick Start

```php
<?php

use CRM360\Tracker\CRM360Tracker;

$tracker = new CRM360Tracker(
    apiKey: 'YOUR_API_KEY',
    endpoint: 'https://your-crm360.com/api/v1/tracking/collect'
);

// Auto-track (recommended)
$tracking = $tracker->autoTrack();

// Or manual tracking
$session = $tracker->startSession(
    visitorId: 'visitor-123',
    userAgent: $_SERVER['HTTP_USER_AGENT'],
    ipAddress: $_SERVER['REMOTE_ADDR']
);

$tracker->trackPageView(
    visitorId: $session['visitor_id'],
    sessionId: $session['session_id'],
    url: 'https://example.com/products',
    title: 'Products'
);

$tracker->identify(
    visitorId: $session['visitor_id'],
    sessionId: $session['session_id'],
    email: 'user@example.com',
    name: 'John Doe'
);
```

## Laravel Integration

1. Publish config: `php artisan vendor:publish --tag=crm360-config`
2. Add `.env` variables:
   ```
   CRM360_API_KEY=your-api-key
   CRM360_ENDPOINT=https://your-crm360.com/api/v1/tracking/collect
   ```
3. Add middleware to `app/Http/Kernel.php`

See [full documentation](../../docs/TRACKING_SDK.md) for details.

## License

MIT
