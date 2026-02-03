<?php

namespace CRM360\Tracker;

/**
 * CRM360 Visitor Tracking SDK for PHP
 * Server-side tracking for PHP applications (Laravel, Symfony, WordPress)
 *
 * @package CRM360\Tracker
 * @version 1.0.0
 */
class CRM360Tracker
{
    private string $apiKey;
    private string $endpoint;
    private int $timeout;
    private bool $debug;

    /**
     * Create a new tracker instance
     *
     * @param string $apiKey Your CRM360 tracking API key
     * @param string $endpoint The tracking API endpoint URL
     * @param int $timeout Request timeout in seconds
     * @param bool $debug Enable debug logging
     */
    public function __construct(
        string $apiKey,
        string $endpoint = 'http://localhost:4000/api/v1/tracking/collect',
        int $timeout = 5,
        bool $debug = false
    ) {
        $this->apiKey = $apiKey;
        $this->endpoint = $endpoint;
        $this->timeout = $timeout;
        $this->debug = $debug;
    }

    /**
     * Send event to tracking API
     */
    private function send(string $eventType, array $data): bool
    {
        $payload = [
            'apiKey' => $this->apiKey,
            'type' => $eventType,
            'data' => $data
        ];

        if ($this->debug) {
            error_log("[CRM360] Sending {$eventType}: " . json_encode($payload));
        }

        $ch = curl_init($this->endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($this->debug) {
            error_log("[CRM360] Response: {$httpCode} - {$response}");
            if ($error) {
                error_log("[CRM360] Error: {$error}");
            }
        }

        return $httpCode === 200;
    }

    /**
     * Generate a consistent visitor ID based on fingerprint
     */
    public function generateVisitorId(?string $userAgent = null, ?string $ipAddress = null): string
    {
        $userAgent = $userAgent ?? ($_SERVER['HTTP_USER_AGENT'] ?? '');
        $ipAddress = $ipAddress ?? $this->getClientIp();
        $fingerprint = "{$userAgent}:{$ipAddress}";
        return substr(hash('sha256', $fingerprint), 0, 16);
    }

    /**
     * Generate a unique session ID
     */
    public function generateSessionId(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }

    /**
     * Get the client's IP address
     */
    private function getClientIp(): string
    {
        $headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR'
        ];

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ips = explode(',', $_SERVER[$header]);
                return trim($ips[0]);
            }
        }

        return '0.0.0.0';
    }

    /**
     * Start a new tracking session
     *
     * @return array Session data with generated IDs
     */
    public function startSession(
        string $visitorId,
        ?string $sessionId = null,
        ?string $userAgent = null,
        ?string $ipAddress = null,
        ?string $referrer = null,
        ?string $entryPage = null,
        ?string $utmSource = null,
        ?string $utmMedium = null,
        ?string $utmCampaign = null,
        ?string $utmTerm = null,
        ?string $utmContent = null
    ): array {
        $sessionId = $sessionId ?? $this->generateSessionId();

        $data = [
            'visitorId' => $visitorId,
            'sessionId' => $sessionId,
            'timestamp' => (int)(microtime(true) * 1000),
            'referrer' => $referrer,
            'entryPage' => $entryPage,
            'device' => [
                'userAgent' => $userAgent ?? ($_SERVER['HTTP_USER_AGENT'] ?? null)
            ],
            'utm' => [
                'utmSource' => $utmSource ?? ($_GET['utm_source'] ?? null),
                'utmMedium' => $utmMedium ?? ($_GET['utm_medium'] ?? null),
                'utmCampaign' => $utmCampaign ?? ($_GET['utm_campaign'] ?? null),
                'utmTerm' => $utmTerm ?? ($_GET['utm_term'] ?? null),
                'utmContent' => $utmContent ?? ($_GET['utm_content'] ?? null),
            ]
        ];

        $this->send('session.start', $data);

        return [
            'session_id' => $sessionId,
            'visitor_id' => $visitorId
        ];
    }

    /**
     * Track a page view
     */
    public function trackPageView(
        string $visitorId,
        string $sessionId,
        string $url,
        ?string $title = null,
        ?string $referrer = null,
        ?int $loadTime = null
    ): bool {
        $parsedUrl = parse_url($url);
        $path = $parsedUrl['path'] ?? '/';

        $data = [
            'sessionId' => $sessionId,
            'visitorId' => $visitorId,
            'url' => $url,
            'path' => $path,
            'title' => $title,
            'referrer' => $referrer,
            'timestamp' => (int)(microtime(true) * 1000),
            'loadTime' => $loadTime,
        ];

        return $this->send('page.view', $data);
    }

    /**
     * Track a custom event
     */
    public function trackEvent(
        string $visitorId,
        string $sessionId,
        string $eventName,
        string $eventType = 'custom',
        ?string $category = null,
        ?string $value = null,
        ?array $metadata = null
    ): bool {
        $data = [
            'sessionId' => $sessionId,
            'events' => [[
                'type' => $eventType,
                'name' => $eventName,
                'category' => $category,
                'value' => $value,
                'metadata' => $metadata ?? [],
                'timestamp' => (int)(microtime(true) * 1000),
            ]]
        ];

        return $this->send('events.batch', $data);
    }

    /**
     * Track a form submission
     */
    public function trackFormSubmission(
        string $visitorId,
        string $sessionId,
        string $formId,
        ?string $formAction = null,
        ?array $fields = null
    ): bool {
        // Mask sensitive fields
        $safeFields = [];
        $sensitiveKeywords = ['password', 'secret', 'token', 'credit', 'card', 'cvv', 'ssn'];

        if ($fields) {
            foreach ($fields as $key => $value) {
                $isSensitive = false;
                foreach ($sensitiveKeywords as $keyword) {
                    if (stripos($key, $keyword) !== false) {
                        $isSensitive = true;
                        break;
                    }
                }
                $safeFields[$key] = $isSensitive ? '***' : $value;
            }
        }

        $data = [
            'sessionId' => $sessionId,
            'formId' => $formId,
            'formAction' => $formAction,
            'fields' => $safeFields,
            'timestamp' => (int)(microtime(true) * 1000),
        ];

        return $this->send('form.submit', $data);
    }

    /**
     * Identify a visitor and link to CRM contact
     */
    public function identify(
        string $visitorId,
        string $sessionId,
        ?string $email = null,
        ?string $userId = null,
        ?string $name = null,
        ?string $phone = null,
        ?string $company = null,
        array $traits = []
    ): bool {
        $allTraits = array_merge([
            'email' => $email,
            'userId' => $userId,
            'name' => $name,
            'phone' => $phone,
            'company' => $company,
        ], $traits);

        // Remove null values
        $allTraits = array_filter($allTraits, fn($v) => $v !== null);

        $data = [
            'sessionId' => $sessionId,
            'visitorId' => $visitorId,
            'userId' => $userId,
            'traits' => $allTraits,
            'timestamp' => (int)(microtime(true) * 1000),
        ];

        return $this->send('user.identify', $data);
    }

    /**
     * End a tracking session
     */
    public function endSession(
        string $visitorId,
        string $sessionId,
        ?string $exitPage = null
    ): bool {
        $data = [
            'sessionId' => $sessionId,
            'url' => $exitPage,
            'path' => $exitPage,
            'timestamp' => (int)(microtime(true) * 1000),
        ];

        return $this->send('page.leave', $data);
    }

    /**
     * Get or create tracking cookies and auto-track
     * Call this at the beginning of your page
     */
    public function autoTrack(): array
    {
        $visitorId = $_COOKIE['crm360_vid'] ?? null;
        $sessionId = $_COOKIE['crm360_sid'] ?? null;
        $isNewSession = false;

        if (!$visitorId) {
            $visitorId = $this->generateVisitorId();
            setcookie('crm360_vid', $visitorId, time() + 365 * 24 * 60 * 60, '/', '', true, true);
        }

        if (!$sessionId) {
            $sessionId = $this->generateSessionId();
            $isNewSession = true;
            setcookie('crm360_sid', $sessionId, time() + 30 * 60, '/', '', true, true);
        }

        if ($isNewSession) {
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $currentUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];

            $this->startSession(
                $visitorId,
                $sessionId,
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                $this->getClientIp(),
                $_SERVER['HTTP_REFERER'] ?? null,
                $currentUrl
            );
        }

        // Track page view
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $currentUrl = $protocol . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        $this->trackPageView($visitorId, $sessionId, $currentUrl);

        return [
            'visitor_id' => $visitorId,
            'session_id' => $sessionId,
            'is_new_session' => $isNewSession
        ];
    }
}
