// Shared browser/engine detection and RoValra User-Agent construction.
//
// The content script (x-rovalra-user-agent header) and the background script
// (declarativeNetRequest User-Agent rules) must report the identical string,
// so both build it here instead of duplicating the sniffing logic.

export function detectBrowserEngine(userAgent = '') {
    if (userAgent.includes('Firefox/')) {
        return { browser: 'Firefox', engine: 'Gecko' };
    }
    if (userAgent.includes('Edg/')) {
        return { browser: 'Edge', engine: 'Chromium' };
    }
    if (userAgent.includes('OPR/') || userAgent.includes('Opera/')) {
        return { browser: 'Opera', engine: 'Chromium' };
    }
    if (userAgent.includes('Chrome/')) {
        return { browser: 'Chrome', engine: 'Chromium' };
    }
    if (userAgent.includes('Safari/')) {
        return { browser: 'Safari', engine: 'WebKit' };
    }
    return { browser: 'Unknown', engine: 'Unknown' };
}

export function isFirefoxUserAgent(userAgent = '') {
    return userAgent.includes('Firefox/');
}

// Gecko/WebKit builds are community ports, not upstream releases. The flag
// tells the RoValra backend not to attribute their traffic to upstream.
// Ports must keep this suffix.
export function isUnofficialEngine(engine) {
    return engine === 'Gecko' || engine === 'WebKit';
}

export function buildRovalraUserAgent({
    userAgent = '',
    version = 'Unknown',
    updateUrlPresent = false,
} = {}) {
    const { browser, engine } = detectBrowserEngine(userAgent);
    const environment = updateUrlPresent ? 'Production' : 'Development';
    let suffix = `RoValraExtension(RoValra/${browser}/${engine}/${version}/${environment})`;
    if (isUnofficialEngine(engine)) {
        suffix += ' UnofficialRoValraVersion';
    }
    return suffix;
}

// Convenience wrapper for extension contexts (content script + background),
// where the UA string and manifest are available globally.
export function getExtensionRovalraUserAgent() {
    const manifest = chrome.runtime.getManifest();
    return buildRovalraUserAgent({
        userAgent: navigator.userAgent,
        version: manifest.version,
        updateUrlPresent: 'update_url' in manifest,
    });
}
