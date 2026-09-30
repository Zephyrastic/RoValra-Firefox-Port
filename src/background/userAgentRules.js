// DeclarativeNetRequest User-Agent rules for background-originated traffic.
// The suffix string itself is built in shared/userAgent.js so the background
// and the content script always report the identical value.
import { buildRovalraUserAgent } from '../shared/userAgent.js';

export function updateUserAgentRule() {
    const originalUA = self.navigator.userAgent;
    const manifest = chrome.runtime.getManifest();
    // Ports must keep the unofficial suffix. It tells Roblox that upstream
    // does not control requests coming from this port.
    const rovalraSuffix = buildRovalraUserAgent({
        userAgent: originalUA,
        version: manifest.version,
        updateUrlPresent: 'update_url' in manifest,
    });

    const rules = [
        {
            id: 999,
            priority: 5,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    {
                        header: 'User-Agent',
                        operation: 'set',
                        value: `${originalUA} ${rovalraSuffix}`,
                    },
                ],
            },
            condition: {
                regexFilter: '.*_RoValraRequest=',
                resourceTypes: ['xmlhttprequest'],
            },
        },
        {
            id: 1000,
            priority: 10,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [
                    {
                        header: 'User-Agent',
                        operation: 'set',
                        value: `Roblox/WinInet ${rovalraSuffix}`,
                    },
                ],
            },
            condition: {
                regexFilter:
                    '^https://gamejoin\\.roblox\\.com/.*_RoValraRequest=|^https://apis\\.roblox\\.com/player-hydration-service/v1/players/signed',
                resourceTypes: ['xmlhttprequest'],
            },
        },
    ];

    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [999, 1000],
        addRules: rules,
    });
}
