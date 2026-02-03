<?php

namespace CRM360\Tracker\Laravel;

use Closure;
use Illuminate\Http\Request;
use CRM360\Tracker\CRM360Tracker;

class TrackingMiddleware
{
    private CRM360Tracker $tracker;

    public function __construct(CRM360Tracker $tracker)
    {
        $this->tracker = $tracker;
    }

    public function handle(Request $request, Closure $next)
    {
        $visitorId = $request->cookie('crm360_vid');
        $sessionId = $request->cookie('crm360_sid');
        $isNewSession = false;

        if (!$visitorId) {
            $visitorId = $this->tracker->generateVisitorId(
                $request->userAgent(),
                $request->ip()
            );
        }

        if (!$sessionId) {
            $sessionId = $this->tracker->generateSessionId();
            $isNewSession = true;
        }

        // Store in request for later use
        $request->attributes->set('crm360_visitor_id', $visitorId);
        $request->attributes->set('crm360_session_id', $sessionId);

        // Start session if new
        if ($isNewSession) {
            $this->tracker->startSession(
                $visitorId,
                $sessionId,
                $request->userAgent(),
                $request->ip(),
                $request->header('Referer'),
                $request->fullUrl(),
                $request->query('utm_source'),
                $request->query('utm_medium'),
                $request->query('utm_campaign'),
                $request->query('utm_term'),
                $request->query('utm_content')
            );
        }

        // Track page view
        $this->tracker->trackPageView(
            $visitorId,
            $sessionId,
            $request->fullUrl(),
            null,
            $request->header('Referer')
        );

        $response = $next($request);

        // Set cookies
        $response->cookie('crm360_vid', $visitorId, 525600); // 1 year
        $response->cookie('crm360_sid', $sessionId, 30); // 30 minutes

        return $response;
    }
}
