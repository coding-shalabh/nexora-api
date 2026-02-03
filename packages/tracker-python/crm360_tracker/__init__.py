"""
CRM360 Visitor Tracking SDK for Python
Server-side tracking for Python applications (Django, Flask, FastAPI)
"""

import requests
import json
import time
import uuid
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime


class CRM360Tracker:
    """
    CRM360 Server-side Tracking SDK

    Usage:
        tracker = CRM360Tracker(
            api_key="your-api-key",
            endpoint="https://your-crm360-instance.com/api/v1/tracking/collect"
        )

        # Track a page view
        tracker.track_page_view(
            visitor_id="visitor-123",
            session_id="session-456",
            url="https://example.com/products",
            title="Products Page"
        )

        # Identify a user
        tracker.identify(
            visitor_id="visitor-123",
            session_id="session-456",
            email="user@example.com",
            name="John Doe"
        )
    """

    def __init__(
        self,
        api_key: str,
        endpoint: str = "http://localhost:4000/api/v1/tracking/collect",
        timeout: int = 5,
        debug: bool = False
    ):
        """
        Initialize the CRM360 Tracker

        Args:
            api_key: Your CRM360 tracking API key
            endpoint: The tracking API endpoint URL
            timeout: Request timeout in seconds
            debug: Enable debug logging
        """
        self.api_key = api_key
        self.endpoint = endpoint
        self.timeout = timeout
        self.debug = debug
        self._queue: List[Dict] = []

    def _send(self, event_type: str, data: Dict[str, Any]) -> bool:
        """Send event to tracking API"""
        try:
            payload = {
                "apiKey": self.api_key,
                "type": event_type,
                "data": data
            }

            if self.debug:
                print(f"[CRM360] Sending {event_type}: {json.dumps(payload, indent=2)}")

            response = requests.post(
                self.endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=self.timeout
            )

            if self.debug:
                print(f"[CRM360] Response: {response.status_code} - {response.text}")

            return response.status_code == 200
        except Exception as e:
            if self.debug:
                print(f"[CRM360] Error: {str(e)}")
            return False

    def generate_visitor_id(self, user_agent: str, ip_address: str) -> str:
        """Generate a consistent visitor ID based on fingerprint"""
        fingerprint = f"{user_agent}:{ip_address}"
        return hashlib.sha256(fingerprint.encode()).hexdigest()[:16]

    def generate_session_id(self) -> str:
        """Generate a unique session ID"""
        return str(uuid.uuid4())

    def start_session(
        self,
        visitor_id: str,
        session_id: Optional[str] = None,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        referrer: Optional[str] = None,
        entry_page: Optional[str] = None,
        utm_source: Optional[str] = None,
        utm_medium: Optional[str] = None,
        utm_campaign: Optional[str] = None,
        utm_term: Optional[str] = None,
        utm_content: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Start a new tracking session

        Returns:
            Dict containing session data with generated session_id
        """
        session_id = session_id or self.generate_session_id()

        data = {
            "visitorId": visitor_id,
            "sessionId": session_id,
            "timestamp": int(time.time() * 1000),
            "referrer": referrer,
            "entryPage": entry_page,
            "device": {
                "userAgent": user_agent
            },
            "utm": {
                "utmSource": utm_source,
                "utmMedium": utm_medium,
                "utmCampaign": utm_campaign,
                "utmTerm": utm_term,
                "utmContent": utm_content,
            }
        }

        self._send("session.start", data)
        return {"session_id": session_id, "visitor_id": visitor_id}

    def track_page_view(
        self,
        visitor_id: str,
        session_id: str,
        url: str,
        title: Optional[str] = None,
        referrer: Optional[str] = None,
        load_time: Optional[int] = None,
    ) -> bool:
        """
        Track a page view

        Args:
            visitor_id: The visitor's unique ID
            session_id: The current session ID
            url: The full page URL
            title: The page title
            referrer: The referring URL
            load_time: Page load time in milliseconds
        """
        # Extract path from URL
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path or "/"

        data = {
            "sessionId": session_id,
            "visitorId": visitor_id,
            "url": url,
            "path": path,
            "title": title,
            "referrer": referrer,
            "timestamp": int(time.time() * 1000),
            "loadTime": load_time,
        }

        return self._send("page.view", data)

    def track_event(
        self,
        visitor_id: str,
        session_id: str,
        event_name: str,
        event_type: str = "custom",
        category: Optional[str] = None,
        value: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> bool:
        """
        Track a custom event

        Args:
            visitor_id: The visitor's unique ID
            session_id: The current session ID
            event_name: Name of the event (e.g., "button_click", "form_submit")
            event_type: Type of event (e.g., "click", "form", "custom")
            category: Event category for grouping
            value: Optional value associated with the event
            metadata: Additional event metadata
        """
        data = {
            "sessionId": session_id,
            "events": [{
                "type": event_type,
                "name": event_name,
                "category": category,
                "value": value,
                "metadata": metadata or {},
                "timestamp": int(time.time() * 1000),
            }]
        }

        return self._send("events.batch", data)

    def track_form_submission(
        self,
        visitor_id: str,
        session_id: str,
        form_id: str,
        form_action: Optional[str] = None,
        fields: Optional[Dict[str, str]] = None,
    ) -> bool:
        """
        Track a form submission

        Args:
            visitor_id: The visitor's unique ID
            session_id: The current session ID
            form_id: Unique identifier for the form
            form_action: The form's action URL
            fields: Dictionary of form field names and values (sensitive data will be masked)
        """
        # Mask sensitive fields
        safe_fields = {}
        sensitive_keywords = ["password", "secret", "token", "credit", "card", "cvv", "ssn"]

        if fields:
            for key, value in fields.items():
                is_sensitive = any(kw in key.lower() for kw in sensitive_keywords)
                safe_fields[key] = "***" if is_sensitive else value

        data = {
            "sessionId": session_id,
            "formId": form_id,
            "formAction": form_action,
            "fields": safe_fields,
            "timestamp": int(time.time() * 1000),
        }

        return self._send("form.submit", data)

    def identify(
        self,
        visitor_id: str,
        session_id: str,
        email: Optional[str] = None,
        user_id: Optional[str] = None,
        name: Optional[str] = None,
        phone: Optional[str] = None,
        company: Optional[str] = None,
        **traits
    ) -> bool:
        """
        Identify a visitor and link to CRM contact

        Args:
            visitor_id: The visitor's unique ID
            session_id: The current session ID
            email: User's email address (primary identifier)
            user_id: Your internal user ID
            name: User's full name
            phone: User's phone number
            company: User's company name
            **traits: Additional user traits
        """
        all_traits = {
            "email": email,
            "userId": user_id,
            "name": name,
            "phone": phone,
            "company": company,
            **traits
        }

        # Remove None values
        all_traits = {k: v for k, v in all_traits.items() if v is not None}

        data = {
            "sessionId": session_id,
            "visitorId": visitor_id,
            "userId": user_id,
            "traits": all_traits,
            "timestamp": int(time.time() * 1000),
        }

        return self._send("user.identify", data)

    def end_session(
        self,
        visitor_id: str,
        session_id: str,
        exit_page: Optional[str] = None,
    ) -> bool:
        """
        End a tracking session

        Args:
            visitor_id: The visitor's unique ID
            session_id: The session ID to end
            exit_page: The last page URL before leaving
        """
        data = {
            "sessionId": session_id,
            "url": exit_page,
            "path": exit_page,
            "timestamp": int(time.time() * 1000),
        }

        return self._send("page.leave", data)


# Flask integration helper
class FlaskTracker:
    """
    Flask integration for CRM360 Tracker

    Usage:
        from flask import Flask
        from crm360_tracker import FlaskTracker

        app = Flask(__name__)
        tracker = FlaskTracker(app, api_key="your-api-key")

        @app.route("/products")
        @tracker.track_page
        def products():
            return render_template("products.html")
    """

    def __init__(self, app=None, api_key: str = None, endpoint: str = None):
        self.tracker = None
        if app:
            self.init_app(app, api_key, endpoint)

    def init_app(self, app, api_key: str, endpoint: str = None):
        from flask import request, g

        self.tracker = CRM360Tracker(
            api_key=api_key,
            endpoint=endpoint or app.config.get("CRM360_ENDPOINT", "http://localhost:4000/api/v1/tracking/collect"),
            debug=app.debug
        )

        @app.before_request
        def before_request():
            visitor_id = request.cookies.get("crm360_vid")
            session_id = request.cookies.get("crm360_sid")

            if not visitor_id:
                visitor_id = self.tracker.generate_visitor_id(
                    request.headers.get("User-Agent", ""),
                    request.remote_addr
                )

            if not session_id:
                session_id = self.tracker.generate_session_id()
                self.tracker.start_session(
                    visitor_id=visitor_id,
                    session_id=session_id,
                    user_agent=request.headers.get("User-Agent"),
                    ip_address=request.remote_addr,
                    referrer=request.referrer,
                    entry_page=request.url,
                    utm_source=request.args.get("utm_source"),
                    utm_medium=request.args.get("utm_medium"),
                    utm_campaign=request.args.get("utm_campaign"),
                )

            g.crm360_visitor_id = visitor_id
            g.crm360_session_id = session_id

        @app.after_request
        def after_request(response):
            if hasattr(g, "crm360_visitor_id"):
                response.set_cookie("crm360_vid", g.crm360_visitor_id, max_age=365*24*60*60)
                response.set_cookie("crm360_sid", g.crm360_session_id, max_age=30*60)
            return response

    def track_page(self, f):
        """Decorator to track page views"""
        from functools import wraps
        from flask import request, g

        @wraps(f)
        def decorated(*args, **kwargs):
            if hasattr(g, "crm360_session_id"):
                self.tracker.track_page_view(
                    visitor_id=g.crm360_visitor_id,
                    session_id=g.crm360_session_id,
                    url=request.url,
                    title=f.__name__,
                    referrer=request.referrer,
                )
            return f(*args, **kwargs)
        return decorated

    def identify(self, email: str = None, **traits):
        """Identify the current visitor"""
        from flask import g
        if hasattr(g, "crm360_session_id"):
            self.tracker.identify(
                visitor_id=g.crm360_visitor_id,
                session_id=g.crm360_session_id,
                email=email,
                **traits
            )


# Django integration helper
class DjangoTracker:
    """
    Django middleware for CRM360 Tracker

    Usage in settings.py:
        MIDDLEWARE = [
            ...
            'crm360_tracker.DjangoTrackerMiddleware',
        ]

        CRM360_API_KEY = "your-api-key"
        CRM360_ENDPOINT = "https://your-instance.com/api/v1/tracking/collect"
    """
    pass


class DjangoTrackerMiddleware:
    def __init__(self, get_response):
        from django.conf import settings
        self.get_response = get_response
        self.tracker = CRM360Tracker(
            api_key=getattr(settings, "CRM360_API_KEY", ""),
            endpoint=getattr(settings, "CRM360_ENDPOINT", "http://localhost:4000/api/v1/tracking/collect"),
            debug=getattr(settings, "DEBUG", False)
        )

    def __call__(self, request):
        # Get or create visitor/session IDs
        visitor_id = request.COOKIES.get("crm360_vid")
        session_id = request.COOKIES.get("crm360_sid")

        if not visitor_id:
            visitor_id = self.tracker.generate_visitor_id(
                request.META.get("HTTP_USER_AGENT", ""),
                request.META.get("REMOTE_ADDR", "")
            )

        is_new_session = False
        if not session_id:
            session_id = self.tracker.generate_session_id()
            is_new_session = True

        request.crm360_visitor_id = visitor_id
        request.crm360_session_id = session_id

        # Start session if new
        if is_new_session:
            self.tracker.start_session(
                visitor_id=visitor_id,
                session_id=session_id,
                user_agent=request.META.get("HTTP_USER_AGENT"),
                ip_address=request.META.get("REMOTE_ADDR"),
                referrer=request.META.get("HTTP_REFERER"),
                entry_page=request.build_absolute_uri(),
                utm_source=request.GET.get("utm_source"),
                utm_medium=request.GET.get("utm_medium"),
                utm_campaign=request.GET.get("utm_campaign"),
            )

        # Track page view
        self.tracker.track_page_view(
            visitor_id=visitor_id,
            session_id=session_id,
            url=request.build_absolute_uri(),
            referrer=request.META.get("HTTP_REFERER"),
        )

        response = self.get_response(request)

        # Set cookies
        response.set_cookie("crm360_vid", visitor_id, max_age=365*24*60*60)
        response.set_cookie("crm360_sid", session_id, max_age=30*60)

        return response


# Export main classes
__all__ = [
    "CRM360Tracker",
    "FlaskTracker",
    "DjangoTracker",
    "DjangoTrackerMiddleware"
]
