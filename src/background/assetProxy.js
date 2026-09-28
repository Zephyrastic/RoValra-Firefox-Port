// Background proxy for RoValra-hosted static assets (images / Google Fonts
// CSS). Roblox's page CSP (img-src) does not allow rovalra.com, and some
// Firefox environments never fetch fonts.googleapis.com stylesheets, so these
// requests are proxied through the background script (not subject to page
// CSP) and returned as self-contained data: URIs.
import { uint8ToBase64 } from '../shared/base64.js';

const rovalraImageCache = new Map();
const googleFontCssCache = new Map();

const PROXIED_IMAGE_HOSTS = new Set(['rovalra.com', 'flagcdn.com']);

function isProxiedImageHost(hostname) {
    if (PROXIED_IMAGE_HOSTS.has(hostname)) return true;
    return (
        hostname.endsWith('.rovalra.com') || hostname.endsWith('.flagcdn.com')
    );
}

export async function loadRovalraImage(url) {
    const parsedUrl = new URL(url);
    // RoValra assets plus flagcdn country flags: Roblox's page CSP img-src
    // blocks both, so they are proxied to data: URIs instead.
    if (
        parsedUrl.protocol !== 'https:' ||
        !isProxiedImageHost(parsedUrl.hostname)
    ) {
        throw new Error('Unsupported rovalraImage host');
    }

    if (rovalraImageCache.has(url)) {
        return rovalraImageCache.get(url);
    }

    const promise = (async () => {
        const response = await fetch(parsedUrl.toString(), {
            cache: 'default',
        });
        if (!response.ok) {
            throw new Error(
                `rovalraImage request failed with ${response.status}`,
            );
        }
        const contentType = (
            response.headers.get('Content-Type') || 'application/octet-stream'
        ).split(';')[0];
        const bytes = new Uint8Array(await response.arrayBuffer());
        return `data:${contentType};base64,${uint8ToBase64(bytes)}`;
    })();

    rovalraImageCache.set(url, promise);
    promise.catch(() => rovalraImageCache.delete(url));
    return promise;
}

export async function buildInlinedGoogleFontCss(url) {
    const parsedUrl = new URL(url);
    const isGoogleFontsHost =
        parsedUrl.protocol === 'https:' &&
        parsedUrl.hostname === 'fonts.googleapis.com';
    if (!isGoogleFontsHost) {
        throw new Error('Unsupported rovalraGoogleFontCss host');
    }

    if (googleFontCssCache.has(url)) {
        return googleFontCssCache.get(url);
    }

    const promise = (async () => {
        const cssResponse = await fetch(parsedUrl.toString(), {
            cache: 'default',
        });
        if (!cssResponse.ok) {
            throw new Error(
                `Font CSS request failed with ${cssResponse.status}`,
            );
        }
        let css = await cssResponse.text();

        // Inline every fonts.gstatic.com binary referenced by the stylesheet
        // so the page itself only ever loads data: URIs.
        const fontUrlPattern =
            /url\((['"]?)(https:\/\/fonts\.gstatic\.com\/[^)'"]+)\1\)/g;
        const referenced = new Set();
        let match;
        while ((match = fontUrlPattern.exec(css)) !== null) {
            referenced.add(match[2]);
        }

        const dataUris = new Map();
        for (const fontUrl of referenced) {
            const parsedFontUrl = new URL(fontUrl);
            if (
                parsedFontUrl.protocol !== 'https:' ||
                parsedFontUrl.hostname !== 'fonts.gstatic.com'
            ) {
                continue;
            }
            const fontResponse = await fetch(parsedFontUrl.toString(), {
                cache: 'default',
            });
            if (!fontResponse.ok) continue;
            const fontBytes = new Uint8Array(await fontResponse.arrayBuffer());
            const fontMime = (
                fontResponse.headers.get('Content-Type') || 'font/woff2'
            ).split(';')[0];
            dataUris.set(
                fontUrl,
                `data:${fontMime};base64,${uint8ToBase64(fontBytes)}`,
            );
        }

        css = css.replace(fontUrlPattern, (full, quote, fontUrl) => {
            const dataUri = dataUris.get(fontUrl);
            return dataUri ? `url(${dataUri})` : full;
        });
        return css;
    })();

    googleFontCssCache.set(url, promise);
    promise.catch(() => googleFontCssCache.delete(url));
    return promise;
}
