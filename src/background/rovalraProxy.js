// Background proxy for rovalra.com API calls.
//
// Firefox applies the page's Content-Security-Policy (connect-src) to
// requests made by content scripts, and Roblox's policy does not list
// rovalra.com. The background page is not subject to the page's CSP, so
// content scripts route these calls through here.

function parseRawResponseHeaders(rawHeaders) {
    const headers = new Headers();
    String(rawHeaders || '')
        .trim()
        .split(/[\r\n]+/)
        .forEach((line) => {
            const separatorIndex = line.indexOf(':');
            if (separatorIndex <= 0) return;
            try {
                headers.append(
                    line.slice(0, separatorIndex).trim(),
                    line.slice(separatorIndex + 1).trim(),
                );
            } catch (e) {}
        });
    return headers;
}

// Firefox can refuse a cross-origin `fetch()` from the background page with a
// bare "NetworkError when attempting to fetch resource." (CORS/preflight
// handling, proxy setups, or content blockers all land there). XHR takes the
// privileged extension path, so it is kept as a fallback transport and shaped
// like a fetch Response for the message handler below.
function fetchRovalraTextViaXhr(url, { method = 'GET', headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        Object.entries(headers || {}).forEach(([key, value]) => {
            try {
                xhr.setRequestHeader(key, value);
            } catch (e) {}
        });
        xhr.onload = () =>
            resolve({
                ok: xhr.status >= 200 && xhr.status < 300,
                status: xhr.status,
                statusText: xhr.statusText,
                headers: parseRawResponseHeaders(xhr.getAllResponseHeaders()),
                text: () => Promise.resolve(xhr.responseText),
            });
        xhr.onerror = () =>
            reject(
                new TypeError(
                    'NetworkError when attempting to fetch resource (xhr).',
                ),
            );
        xhr.onabort = () =>
            reject(new DOMException('The operation was aborted.', 'AbortError'));

        try {
            xhr.send(body || null);
        } catch (error) {
            reject(error);
        }
    });
}

export async function fetchRovalraViaBackground(options = {}) {
    const {
        url,
        method = 'GET',
        headers = {},
        body = null,
        cache = 'default',
    } = options;

    const parsedUrl = new URL(url);
    const isRovalraHost =
        parsedUrl.protocol === 'https:' &&
        (parsedUrl.hostname === 'rovalra.com' ||
            parsedUrl.hostname.endsWith('.rovalra.com'));
    if (!isRovalraHost) {
        throw new Error('Unsupported rovalraFetch host');
    }

    const target = parsedUrl.toString();
    const fetchOptions = {
        method,
        headers: { ...headers },
        cache,
    };
    if (body && method !== 'GET' && method !== 'HEAD') {
        fetchOptions.body = body;
    }

    // Attempt 2 drops every non-safelisted request header, which turns the
    // call into a simple request that can never fail on a CORS preflight.
    const simpleHeaders = {};
    Object.entries(headers || {}).forEach(([key, value]) => {
        if (['accept', 'content-type'].includes(key.toLowerCase())) {
            simpleHeaders[key] = value;
        }
    });
    if (!Object.keys(simpleHeaders).length) {
        simpleHeaders.Accept = 'application/json';
    }

    const attempts = [
        { label: 'fetch', run: () => fetch(target, fetchOptions) },
        {
            label: 'fetch-simple',
            run: () =>
                fetch(target, {
                    ...fetchOptions,
                    headers: simpleHeaders,
                    cache: 'no-store',
                }),
        },
        {
            label: 'xhr',
            run: () =>
                fetchRovalraTextViaXhr(target, { method, headers, body }),
        },
    ];

    const failures = [];
    for (const attempt of attempts) {
        try {
            const response = await attempt.run();
            if (response) return response;
            failures.push(`${attempt.label}: empty response`);
        } catch (error) {
            const reason = error?.message || String(error);
            failures.push(`${attempt.label}: ${reason}`);
            console.warn(
                `RoValra: rovalraFetch via ${attempt.label} failed:`,
                error,
            );
        }
    }

    // Surface every transport that failed so the content script (and the user)
    // can tell exactly which paths were blocked.
    throw new TypeError(failures.join(' | '));
}
