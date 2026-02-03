# CRM360 Tracker - Python SDK

Server-side visitor tracking SDK for Python applications.

## Installation

```bash
pip install crm360-tracker
```

## Quick Start

```python
from crm360_tracker import CRM360Tracker

tracker = CRM360Tracker(
    api_key='YOUR_API_KEY',
    endpoint='https://your-crm360.com/api/v1/tracking/collect'
)

# Start session
session = tracker.start_session(
    visitor_id='visitor-123',
    user_agent='Mozilla/5.0...',
    ip_address='192.168.1.1'
)

# Track page view
tracker.track_page_view(
    visitor_id=session['visitor_id'],
    session_id=session['session_id'],
    url='https://example.com/products',
    title='Products'
)

# Identify user
tracker.identify(
    visitor_id=session['visitor_id'],
    session_id=session['session_id'],
    email='user@example.com',
    name='John Doe'
)
```

## Framework Integrations

- Flask: `FlaskTracker`
- Django: `DjangoTrackerMiddleware`
- FastAPI: Use standard middleware pattern

See [full documentation](../../docs/TRACKING_SDK.md) for details.

## License

MIT
