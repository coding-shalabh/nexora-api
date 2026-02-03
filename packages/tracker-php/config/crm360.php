<?php

return [
    /*
    |--------------------------------------------------------------------------
    | CRM360 API Key
    |--------------------------------------------------------------------------
    |
    | Your CRM360 tracking API key. You can find this in the CRM360 dashboard
    | under Settings > Tracking Scripts.
    |
    */
    'api_key' => env('CRM360_API_KEY', ''),

    /*
    |--------------------------------------------------------------------------
    | CRM360 Endpoint
    |--------------------------------------------------------------------------
    |
    | The URL of your CRM360 tracking API endpoint.
    |
    */
    'endpoint' => env('CRM360_ENDPOINT', 'http://localhost:4000/api/v1/tracking/collect'),

    /*
    |--------------------------------------------------------------------------
    | Request Timeout
    |--------------------------------------------------------------------------
    |
    | The timeout in seconds for tracking API requests.
    |
    */
    'timeout' => env('CRM360_TIMEOUT', 5),

    /*
    |--------------------------------------------------------------------------
    | Debug Mode
    |--------------------------------------------------------------------------
    |
    | Enable debug logging for tracking events.
    |
    */
    'debug' => env('CRM360_DEBUG', false),
];
