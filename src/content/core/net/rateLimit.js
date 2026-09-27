// Shared Retry-After / rate-limit cooldown tracking for content-script API
// traffic. One map per origin; callers wait before starting a request and
// record new cooldowns from 429 responses.
const RETRY_AFTER_BUFFER_MS = 1000;

const rateLimitCooldowns = new Map();

export function getRetryAfterDelay(response) {
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds)) {
            return Math.max(0, seconds * 1000) + RETRY_AFTER_BUFFER_MS;
        }

        const retryAt = Date.parse(retryAfter);
        if (Number.isFinite(retryAt)) {
            return Math.max(0, retryAt - Date.now()) + RETRY_AFTER_BUFFER_MS;
        }
    }

    return 0;
}

export function getRateLimitKey(url) {
    try {
        return new URL(url).origin;
    } catch {
        return url;
    }
}

export async function waitForRateLimitCooldown(key, signal) {
    const cooldownUntil = rateLimitCooldowns.get(key) || 0;
    const delay = cooldownUntil - Date.now();
    if (delay <= 0) {
        rateLimitCooldowns.delete(key);
        return;
    }

    await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, delay);
        if (!signal) return;

        const onAbort = () => {
            clearTimeout(timeoutId);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        if (signal.aborted) {
            onAbort();
            return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

export function recordRateLimitCooldown(key, response) {
    const delay = getRetryAfterDelay(response);
    if (delay <= 0) return;

    const cooldownUntil = Date.now() + delay;
    rateLimitCooldowns.set(
        key,
        Math.max(rateLimitCooldowns.get(key) || 0, cooldownUntil),
    );
}
