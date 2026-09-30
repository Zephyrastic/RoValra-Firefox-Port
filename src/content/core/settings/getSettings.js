import { loadSettings } from './handlesettings.js';
import {
    REMOTE_SETTING_LOCKS_KEY,
    REMOTE_SETTING_OVERRIDE_KEY,
} from './remoteSettingLocks.js';
import { isKnownSettingName } from './settingsIndex.js';
import { PROFILE_PRONOUNS_BY_USER_STORAGE_KEY } from '../profile/pronouns.js';

let settingsPromise = null;

function invalidateSettings() {
    settingsPromise = null;
}

if (typeof document !== 'undefined') {
    document.addEventListener('rovalra:settingSaved', invalidateSettings);
}

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || settingsPromise === null) return;

        const affectsSettings = Object.keys(changes).some(
            (name) =>
                name === REMOTE_SETTING_LOCKS_KEY ||
                name === REMOTE_SETTING_OVERRIDE_KEY ||
                name === PROFILE_PRONOUNS_BY_USER_STORAGE_KEY ||
                isKnownSettingName(name),
        );
        if (affectsSettings) invalidateSettings();
    });
}

// Loads settings once per content-script runtime and reuses the same result for
// every `await settings.someSetting` call. This avoids asking chrome.storage for
// the full settings object every time a feature needs one value. The cache is
// only ever dropped and recomputed by loadSettings, never patched key by key, so
// it cannot drift from what loadSettings derives (defaults, forced-off settings).
function getCachedSettings() {
    if (settingsPromise === null) {
        const pending = loadSettings().catch((error) => {
            if (settingsPromise === pending) settingsPromise = null;
            throw error;
        });
        settingsPromise = pending;
    }
    return settingsPromise;
}
// bunch of dark magic  - Bogdan

// Comments so I remember how to use it - Valra cuz i totally wrote all of this manually by hand believe me bro
// `settings` is a tiny async settings reader built with a Proxy.
//
// How to use it in another script:
//   import { settings } from "../../core/settings/getSettings";
//
// Then await the setting name you want:
//   if (await settings.reducePlusAds) {
//       // run feature code when the setting is enabled
//   }
//
// Nested values also work because each property access adds to the path:
//   const value = await settings.someParentSetting.someChildSetting;
//
// Important: always use `await`. Without it, `settings.reducePlusAds` is just
// another Proxy object, not the real boolean/string/number stored in settings.
//
// Use `loadSettings()` from handlesettings.js instead when you need the entire
// settings object at once or you need the freshest value after saving changes.
function proxify(path = []) {
    return new Proxy(
        {},
        {
            get(target, prop) {
                // Promise/await looks for a `.then` method. When code awaits any
                // proxy path, this branch resolves the cached settings object and
                // walks the recorded path to return the requested value.
                if (prop === 'then') {
                    return (r, f) => {
                        getCachedSettings()
                            .then((value) => {
                                for (const p of path) {
                                    if (value === undefined) break;
                                    value = value[p];
                                }

                                r(value);
                            })
                            .catch((...args) => f(...args));
                    };
                }

                // Every normal property access, like `.reducePlusAds`, records the
                // requested key and returns another Proxy until the chain is awaited.
                return proxify([...path, prop]);
            },
        },
    );
}

/**
 * @typedef {Record<string, Settings | string>} Settings
 */

/**
 * @type {Settings}
 */
export const settings = proxify();
