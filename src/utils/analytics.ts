import { ApplicationInsights } from '@microsoft/applicationinsights-web'

// ── Lightweight Application Insights wrapper ────────────────────────────
//
// The SDK is initialised lazily once `/api/config` returns a connection
// string. `trackEvent` is safe to call at any time:
//   - before init: events are buffered (up to a cap)
//   - after init succeeds: events are sent
//   - after init decides telemetry is off (no string / fetch failed):
//     events are dropped silently
//
// In local dev `/api/config` returns an empty connection string, so all
// calls become no-ops — no telemetry pollution from developer machines.

type PendingEvent = { name: string; properties?: Record<string, unknown> }

const MAX_BUFFERED = 100

let appInsights: ApplicationInsights | null = null
let state: 'pending' | 'enabled' | 'disabled' = 'pending'
const buffered: PendingEvent[] = []

export async function initAnalytics(): Promise<void> {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' })
    if (!res.ok) {
      state = 'disabled'
      buffered.length = 0
      return
    }
    const { appInsightsConnectionString } = (await res.json()) as {
      appInsightsConnectionString?: string
    }
    if (!appInsightsConnectionString) {
      state = 'disabled'
      buffered.length = 0
      return
    }

    appInsights = new ApplicationInsights({
      config: {
        connectionString: appInsightsConnectionString,
        // Track SPA navigations as pageviews automatically.
        enableAutoRouteTracking: true,
        // Stamp the same browser session across short tab reloads.
        enableCorsCorrelation: true,
      },
    })
    appInsights.loadAppInsights()
    appInsights.trackPageView()
    state = 'enabled'

    for (const evt of buffered) {
      appInsights.trackEvent({ name: evt.name }, evt.properties)
    }
    buffered.length = 0
  } catch (err) {
    // Best-effort — telemetry must never break the app.
    state = 'disabled'
    buffered.length = 0
    if (typeof console !== 'undefined') {
      console.warn('analytics init failed', err)
    }
  }
}

export function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (state === 'enabled' && appInsights) {
    appInsights.trackEvent({ name }, properties)
    return
  }
  if (state === 'pending' && buffered.length < MAX_BUFFERED) {
    buffered.push({ name, properties })
  }
  // state === 'disabled' → drop silently
}
