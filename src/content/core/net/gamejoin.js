// Game-join request protocol helpers: endpoint normalization, join timeouts,
// and Server-Sent-Events response decoding. Pure functions with no extension
// dependencies, kept separate from the main request pipeline.

export function normalizeGameJoinEndpoint(endpoint) {
    if (typeof endpoint !== 'string') return endpoint;
    return endpoint.replace(/^\/v[12]\//, '/v1/');
}

export function isGameJoinTimeoutEnabled(endpoint) {
    if (typeof endpoint !== 'string') return true;
    return endpoint.split('?')[0].replace(/^\/v[12]\//, '/') !== '/join-game';
}

export function createGameJoinFullResponse() {
    return new Response(
        JSON.stringify({
            status: 22,
            message: 'Server full',
            rovalraTimedOut: true,
        }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        },
    );
}

export function parseServerSentEvents(text) {
    const events = [];
    const blocks = String(text || '').split(/\r?\n\r?\n/);

    for (const block of blocks) {
        if (!block.trim()) continue;

        const event = { event: 'message', data: '' };
        const dataLines = [];

        for (const rawLine of block.split(/\r?\n/)) {
            if (!rawLine || rawLine.startsWith(':')) continue;

            const separatorIndex = rawLine.indexOf(':');
            let field = rawLine;
            let value = '';

            if (separatorIndex !== -1) {
                field = rawLine.slice(0, separatorIndex);
                value = rawLine.slice(separatorIndex + 1);
                if (value.charCodeAt(0) === 32) value = value.slice(1);
            }

            if (field === 'event') event.event = value;
            else if (field === 'id') event.id = value;
            else if (field === 'retry') event.retry = value;
            else if (field === 'data') dataLines.push(value);
        }

        event.data = dataLines.join('\n');
        events.push(event);
    }

    return events;
}

export async function normalizeGameJoinResponse(response) {
    const contentType = (
        response.headers.get('Content-Type') || ''
    ).toLowerCase();
    if (!contentType.includes('text/event-stream')) return response;

    const text = await response.text();
    const events = parseServerSentEvents(text);
    const readyEvent =
        events.find((event) => event.event === 'ResponseReady') ||
        events.find((event) => event.data?.trim());

    if (!readyEvent?.data) {
        return new Response(JSON.stringify({ status: 0 }), {
            status: response.status,
            statusText: response.statusText,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        JSON.parse(readyEvent.data);
    } catch (e) {
        return new Response(JSON.stringify({ status: 0 }), {
            status: response.status,
            statusText: response.statusText,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(readyEvent.data, {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json' },
    });
}
