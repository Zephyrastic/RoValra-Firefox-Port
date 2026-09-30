// Developer simulation flags (forced API errors / latency for testing).
// Each flag is a top-level storage key; all four checks share one reader.

function checkSimulationFlag(key) {
    return new Promise((resolve) => {
        if (
            typeof chrome === 'undefined' ||
            !chrome.storage ||
            !chrome.storage.local
        ) {
            resolve(false);
            return;
        }
        chrome.storage.local.get([key], (result) => {
            resolve(!!result[key]);
        });
    });
}

export function checkSimulatedDowntime() {
    return checkSimulationFlag('simulateRoValraServerErrors');
}

export function checkSimulatedLatency() {
    return checkSimulationFlag('simulateRoValraServerLatency');
}

export function checkSimulatedJoinError() {
    return checkSimulationFlag('simulateRobloxJoinErrors');
}

export function checkSimulatedJoinHttpError() {
    return checkSimulationFlag('simulateRobloxJoinHttpErrors');
}
