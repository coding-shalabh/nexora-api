<?php

namespace CRM360\Tracker\Laravel;

use Illuminate\Support\ServiceProvider;
use CRM360\Tracker\CRM360Tracker;

class CRM360ServiceProvider extends ServiceProvider
{
    public function register()
    {
        $this->mergeConfigFrom(__DIR__ . '/../../config/crm360.php', 'crm360');

        $this->app->singleton(CRM360Tracker::class, function ($app) {
            return new CRM360Tracker(
                config('crm360.api_key'),
                config('crm360.endpoint'),
                config('crm360.timeout', 5),
                config('crm360.debug', false)
            );
        });

        $this->app->alias(CRM360Tracker::class, 'crm360-tracker');
    }

    public function boot()
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../../config/crm360.php' => config_path('crm360.php'),
            ], 'crm360-config');
        }
    }
}
