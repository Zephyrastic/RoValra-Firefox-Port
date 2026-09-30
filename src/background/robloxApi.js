// Background transport for Roblox API calls.
//
// Content scripts cannot always call Roblox directly (page CSP, CORS), so the
// background page performs these fetches on their behalf. Rate-limit and
// CSRF state is owned here; scanners and message handlers share it through
// this module's exports.

const rateLimitCooldowns = new Map();
let csrfTokenCache = null;

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRateLimitDelay(response) {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
        const retryAfterSeconds = Number(retryAfter);
        if (Number.isFinite(retryAfterSeconds)) {
            return Math.max(0, retryAfterSeconds * 1000) + 1000;
        }

        const retryAt = Date.parse(retryAfter);
        if (Number.isFinite(retryAt)) {
            return Math.max(0, retryAt - Date.now()) + 1000;
        }
    }

    const remaining = Number(response.headers.get('x-ratelimit-remaining'));
    const resetValue = Number(response.headers.get('x-ratelimit-reset'));

    if (
        Number.isFinite(remaining) &&
        remaining <= 1 &&
        Number.isFinite(resetValue) &&
        resetValue > 0
    ) {
        return (
            (resetValue > 1e9
                ? Math.max(0, resetValue * 1000 - Date.now())
                : resetValue * 1000) + 1000
        );
    }

    return 0;
}

export async function callRobloxApiBackground(options) {
    const {
        subdomain = 'api',
        endpoint,
        method = 'GET',
        body = null,
        headers = {},
        fullUrl = null,
        credentials,
    } = options;

    let url;
    if (fullUrl) {
        const parsedUrl = new URL(fullUrl);
        if (parsedUrl.hostname !== 'setup.rbxcdn.com') {
            throw new Error('Unsupported fullUrl host for background fetch');
        }
        url = parsedUrl.toString();
    } else {
        url = `https://${subdomain}.roblox.com${endpoint}`;
    }

    const separator = url.includes('?') ? '&' : '?';

    if (!endpoint?.includes('/player-hydration-service/v1/players/signed')) {
        url += `${separator}_RoValraRequest=`;
    }

    const fetchOptions = { method, headers: { ...headers } };

    // Extension-origin fetches omit Roblox cookies by default, which makes
    // authenticated endpoints (e.g. assetdelivery place downloads used by the
    // Explorer access check) see an anonymous user. Callers that need the
    // logged-in session opt in explicitly; everything else keeps the old
    // cookie-less behavior.
    if (credentials) {
        fetchOptions.credentials = credentials;
    }

    if (body) {
        if (typeof body === 'object') {
            fetchOptions.headers['Content-Type'] = 'application/json';
            fetchOptions.body = JSON.stringify(body);
        } else {
            fetchOptions.body = body;
        }
    }

    if (method !== 'GET' && method !== 'HEAD' && csrfTokenCache) {
        fetchOptions.headers['X-CSRF-TOKEN'] = csrfTokenCache;
    }

    const rateLimitKey = new URL(url).origin;
    const cooldownUntil = rateLimitCooldowns.get(rateLimitKey) || 0;
    if (cooldownUntil > Date.now()) {
        await sleep(cooldownUntil - Date.now());
    } else {
        rateLimitCooldowns.delete(rateLimitKey);
    }

    let response = await fetch(url, fetchOptions); //Verified

    if (response.status === 429) {
        const cooldown = getRateLimitDelay(response);
        if (cooldown > 0) {
            rateLimitCooldowns.set(
                rateLimitKey,
                Math.max(
                    rateLimitCooldowns.get(rateLimitKey) || 0,
                    Date.now() + cooldown,
                ),
            );
        }
    }

    if (response.status === 403 && method !== 'GET' && method !== 'HEAD') {
        const newCsrf = response.headers.get('x-csrf-token');
        if (newCsrf) {
            csrfTokenCache = newCsrf;
            fetchOptions.headers['X-CSRF-TOKEN'] = newCsrf;
            response = await fetch(url, fetchOptions); //Verified
        }
    }

    return response;
}
