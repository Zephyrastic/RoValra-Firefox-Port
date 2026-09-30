/// <reference types="chrome" />

const settingDeprecations: Record<string, ((value: any, gets: (key: string) => Promise<any>, sets: (key: string, value: any) => void) => void) | undefined> = {
    "EnableGameTrailer": undefined,
    "trustedConnectionsEnabled": undefined,
    "currencyTransferEnabled": undefined,
};


import { findSettingConfig, getSettingsIndex } from "../content/core/settings/settingsIndex.js";
import { debugVerbose, flush } from "../content/core/debug.js";

type CompatResults = { replaced: string[]; deleted: string[] };

let compatResults: CompatResults | null = null;
let compatRun: Promise<void> | null = null;

const getStoredSettingValue: (s: string) => Promise<any | undefined> = async (setting: string) => {
    const stored = await chrome.storage.local.get({
        [setting]: undefined,
    });
    return stored[setting];
};

const cleanup = (async () => {
    // Removed for data safety purposes
    //
    //const settings = await chrome.storage.local.get(null);
    //for (const [key, value] of Object.entries(settings)) {
    //    const data = FLAT_SETTINGS_CONFIG[key];
    //    if (!data)
    //        continue;  // not a setting
    //    if (data.default === value) {
    //        await chrome.storage.local.remove(key);
    //        debugVerbose(`Cleaning up setting ${key}.`, {value: value, default: data.default});
    //    }
    //}
});

const runCompat = (async () => {
    console.debug("RoValra: Verifying settings compat.");

    let deleted = [];
    let replaced = [];
    for (const [setting, replaceFn] of Object.entries(settingDeprecations)) {
        try {
            let v: any = undefined;
            if ((v = await getStoredSettingValue(setting)) === true) {
                debugVerbose(`Replaced setting ${setting}.`, {replacement: String(replaceFn)});
                if (replaceFn === undefined) {
                    const label = findSettingConfig(setting)?.label;
                    if (label !== undefined) deleted.push(label);
                    
                    // // Removed for data safety purposes
                    //if (FLAT_SETTINGS_CONFIG[setting].default === true)
                    //    await chrome.storage.local.set({[setting]: false});
                    //else
                    //    await chrome.storage.local.remove(setting);
                } else {
                    try {
                        const replacements: Record<string, any> = {};
                        await replaceFn(
                            v,
                            async (key) => (await chrome.storage.local.get({[key]: undefined}))[key],
                            (key, newValue) => {replacements[key] = newValue;}
                        );
                        await chrome.storage.local.set(replacements);
                        replaced.push(setting);
                    } catch (e) {
                        console.error(`Failed to update setting ${setting} — unexpected error: `, e);
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to retrieve setting ${setting} for compat checks — unexpected error: `, e);
        }
    }
    const forEachLockedSetting = (key: string, data: Record<string, any>) => {
        const name = data.label;
        deleted.push(name);
    };
    for (const [setting, { config: data, parentName }] of getSettingsIndex().definitions) {
        if (parentName !== null) continue;
        if (data['locked'] === undefined && data['deprecated'] === undefined) continue;

        let value = await getStoredSettingValue(setting);
        if (value !== undefined && value !== false) {
            debugVerbose(`Locked/deprecated setting: ${setting}`, data);
            forEachLockedSetting(setting, data);

            // // Removed for data safety purposes
            //if (data.default === false)
            //    await chrome.storage.local.remove(setting);
            //else
            //    await chrome.storage.local.set({[setting]: false});

            await chrome.storage.local.set({[setting]: false});
        }
    }

    compatResults = { replaced: replaced, deleted: deleted };

    await cleanup();
    flush();

    console.debug("Setting compat checks finished.");
});

chrome.runtime.onMessage.addListener((message: any, sender: unknown, sendResponse: (...args: any[]) => void) => {
    if (message?.type !== "settingsCompatGetRes") return false;

    (compatRun ?? Promise.resolve()).catch(() => {}).then(() => {
        debugVerbose("Recieved signal settingsCompatGetRes.", {message: message, data: compatResults});
        sendResponse(compatResults ?? { replaced: [], deleted: [] });
        compatResults = { replaced: [], deleted: [] };
    });
    return true;
});

const init = () => (compatRun = runCompat());

export default init;
