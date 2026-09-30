// Shared binary-to-base64 helper (chunked to avoid call-stack overflow on
// large buffers). Used by the background (font/image proxying) and the
// Explorer (font previews).

export function uint8ToBase64(u8) {
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < u8.length; i += chunk) {
        binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(binary);
}
