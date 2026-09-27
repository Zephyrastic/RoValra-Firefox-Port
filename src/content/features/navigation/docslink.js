import { createCommunitySidebarLink } from './sidebarLink.js';
import { Icon } from '../../core/ui/buildericon.js';

const DOCS_PATH = '/docs';
const STORAGE_KEY = 'apiDocsSidebarLinkEnabled';
const OLD_API_DOCS_STORAGE_KEY = 'EnableRobloxApiDocs';

function cleanupOldApiDocsStorage() {
    chrome.storage.local.get(
        [OLD_API_DOCS_STORAGE_KEY, 'rovalra_settings'],
        (result) => {
            if (
                Object.prototype.hasOwnProperty.call(
                    result,
                    OLD_API_DOCS_STORAGE_KEY,
                )
            ) {
                chrome.storage.local.remove(OLD_API_DOCS_STORAGE_KEY);
            }

            const settingsData = result.rovalra_settings;
            if (
                !settingsData ||
                !Object.prototype.hasOwnProperty.call(
                    settingsData,
                    OLD_API_DOCS_STORAGE_KEY,
                )
            ) {
                return;
            }

            const nextSettingsData = { ...settingsData };
            delete nextSettingsData[OLD_API_DOCS_STORAGE_KEY];
            chrome.storage.local.set({ rovalra_settings: nextSettingsData });
        },
    );
}

function createDocsIcon() {
    return Icon({
        material: true,
        size: 'medium',
        icon: 'description',
        filled: true,
    });
}

const { init } = createCommunitySidebarLink({
    path: DOCS_PATH,
    linkAttr: 'data-rovalra-docs-link',
    itemAttr: 'data-rovalra-docs-item',
    syncKey: 'rovalraDocsStateSync',
    labelKey: 'navigation.apiDocs',
    storageKey: STORAGE_KEY,
    createIcon: createDocsIcon,
    migrate: cleanupOldApiDocsStorage,
});

export { init };
