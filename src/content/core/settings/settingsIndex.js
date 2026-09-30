import { SETTINGS_CONFIG } from './settingConfig.js';

let cachedIndex = null;
let cachedCategoryCount = -1;

function buildIndex() {
    const definitions = new Map();

    for (const category of Object.values(SETTINGS_CONFIG)) {
        for (const [name, config] of Object.entries(category.settings)) {
            definitions.set(name, { config, parentName: null });
            if (!config.childSettings) continue;

            for (const [childName, childConfig] of Object.entries(
                config.childSettings,
            )) {
                definitions.set(childName, {
                    config: childConfig,
                    parentName: name,
                });
            }
        }
    }

    const defaults = {};
    for (const [name, { config }] of definitions) {
        if (config.default !== undefined) defaults[name] = config.default;
    }

    return { definitions, names: [...definitions.keys()], defaults };
}

// SETTINGS_CONFIG gains its `Developer` category at runtime in
// ui/settingui.js, so the index is rebuilt whenever the category count moves.
export function getSettingsIndex() {
    const categoryCount = Object.keys(SETTINGS_CONFIG).length;
    if (cachedIndex === null || categoryCount !== cachedCategoryCount) {
        cachedIndex = buildIndex();
        cachedCategoryCount = categoryCount;
    }
    return cachedIndex;
}

export const getAllSettingNames = () => getSettingsIndex().names;

export const getDefaultSettings = () => ({ ...getSettingsIndex().defaults });

export const findSettingConfig = (settingName) =>
    getSettingsIndex().definitions.get(settingName)?.config ?? null;

export const isKnownSettingName = (name) =>
    getSettingsIndex().definitions.has(name);
