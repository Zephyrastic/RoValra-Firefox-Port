// Shared factory for RoValra sidebar links that clone the Communities nav
// entry (Transactions, API Docs). Both links were near-identical copies —
// including two redundant 1-second location-polling timers — so the DOM
// cloning, active-state syncing, and enablement wiring live here once.
import { observeElement } from '../../core/observer.js';
import { ts } from '../../core/locale/i18n.js';

const COMMUNITY_PATH = '/communities';
const STATE_SYNC_DELAYS = [0, 50, 150, 350, 750, 1200];
const SIDEBAR_COMMUNITY_SELECTOR = [
    '#left-navigation-container a[href*="/communities"]',
    '#navigation a[href*="/communities"]',
    '.navigation a[href*="/communities"]',
].join(', ');

// The exact class set every Roblox sidebar nav link uses, so injected links
// get identical padding, gap, radius, and text treatment.
const NAV_LINK_CLASSES =
    'content-emphasis text-title-large flex items-center gap-small padding-left-xsmall padding-right-xxsmall radius-medium relative clip group/interactable focus-visible:outline-focus disabled:outline-none';

function normalizePath(href) {
    if (!href) return '';

    try {
        return new URL(href, window.location.origin).pathname;
    } catch {
        return '';
    }
}

function stripLocalePrefix(path) {
    return path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/)/i, '');
}

function matchesRoute(pathname, route) {
    const normalizedPath = stripLocalePrefix(pathname);
    return normalizedPath === route || normalizedPath.startsWith(`${route}/`);
}

function isCommunityIndexLink(communityLink) {
    const path = stripLocalePrefix(
        normalizePath(communityLink.href),
    ).replace(/\/+$/, '');
    return path === COMMUNITY_PATH;
}

function getSidebarContainer(anchor) {
    return anchor.closest('ul, ol, nav, [role="navigation"]');
}

function getSidebarRegion(anchor) {
    return (
        anchor.closest(
            '#left-navigation-container, #navigation, .navigation',
        ) || getSidebarContainer(anchor)
    );
}

function getSidebarItem(sidebar, link) {
    const item = link.closest(
        'li, [role="menuitem"], [role="listitem"], .roseal-left-nav-item',
    );
    if (!item || item === sidebar || !sidebar.contains(item)) return null;
    return item;
}

function stripClonedState(item) {
    [item, ...item.querySelectorAll('*')].forEach((element) => {
        element.removeAttribute('id');
        element.removeAttribute('aria-current');
        element.removeAttribute('aria-selected');

        [...element.attributes].forEach((attribute) => {
            if (attribute.name.startsWith('data-')) {
                element.removeAttribute(attribute.name);
            }
        });

        element.classList.remove(
            'active',
            'selected',
            'active-menu-item',
            'selected-menu-item',
            'router-link-active',
            'router-link-exact-active',
        );
    });
}

function findIconHost(link) {
    const directChildren = [...link.children];
    return (
        directChildren.find((child) =>
            child.querySelector('svg, [class*="icon"], [class*="Icon"]'),
        ) ||
        directChildren.find((child) =>
            child.className?.toString().toLowerCase().includes('icon'),
        ) ||
        directChildren.find((child) => !child.textContent.trim())
    );
}

function setLinkLabel(link, label) {
    const labelTarget = [...link.querySelectorAll('*')]
        .filter(
            (element) =>
                element.children.length === 0 && element.textContent.trim(),
        )
        .at(-1);

    if (labelTarget) {
        labelTarget.textContent = label;
        return;
    }

    const span = document.createElement('span');
    span.textContent = label;
    link.appendChild(span);
}

function clearInlineActiveStyles(item) {
    [item, ...item.querySelectorAll('*')].forEach((element) => {
        element.style.removeProperty('background');
        element.style.removeProperty('background-color');
        element.style.removeProperty('border-radius');
        element.style.removeProperty('color');
    });
}

// One shared location watcher for every sidebar link (previously each link
// ran its own identical 1-second polling timer).
let locationWatcherStarted = false;
let lastObservedPath = null;

function ensureLocationWatcher() {
    if (locationWatcherStarted) return;
    locationWatcherStarted = true;
    lastObservedPath = window.location.pathname;

    setInterval(() => {
        if (window.location.pathname === lastObservedPath) return;

        lastObservedPath = window.location.pathname;
        window.dispatchEvent(new Event('rovalra:locationchange'));
    }, 1000);
}

/**
 * Creates a Communities-cloned sidebar link.
 *
 * @param {object} config
 * @param {string} config.path Link target, e.g. '/transactions'.
 * @param {string} config.linkAttr Data attribute marking the link,
 *   e.g. 'data-rovalra-transactions-link'.
 * @param {string} config.itemAttr Data attribute marking the item,
 *   e.g. 'data-rovalra-transactions-item'.
 * @param {string} config.syncKey Dataset flag for state sync,
 *   e.g. 'rovalraTransactionsStateSync'.
 * @param {string} config.labelKey Locale key for the link label.
 * @param {string} config.storageKey Top-level storage toggle.
 * @param {() => Element} config.createIcon Builds the link icon.
 * @param {() => void} [config.migrate] One-off legacy storage cleanup.
 * @returns {{ init: () => void }} Feature init, safe to call once.
 */
export function createCommunitySidebarLink(config) {
    const {
        path,
        linkAttr,
        itemAttr,
        syncKey,
        labelKey,
        storageKey,
        createIcon,
        migrate,
    } = config;
    const linkSelector = `a[${linkAttr}="true"]`;
    const itemSelector = `[${itemAttr}="true"]`;
    let sidebarLinkEnabled = false;

    function createLinkItem(sidebar, communityLink, label) {
        const templateItem = getSidebarItem(sidebar, communityLink);
        if (!templateItem) return null;

        const item = templateItem.cloneNode(true);
        const link = item.querySelector('a[href]');
        if (!link) return null;

        stripClonedState(item);

        link.className = NAV_LINK_CLASSES;

        const iconHost = findIconHost(link);
        if (iconHost) {
            iconHost.replaceChildren(createIcon());
        } else {
            link.prepend(createIcon());
        }

        setLinkLabel(link, label);
        link.setAttribute('href', path);
        link.setAttribute(linkAttr, 'true');
        item.setAttribute(itemAttr, 'true');

        return item;
    }

    function updateActiveState(sidebar) {
        const item = sidebar.querySelector(itemSelector);
        const link = sidebar.querySelector(linkSelector);
        if (!item || !link) return;

        stripClonedState(item);
        item.setAttribute(itemAttr, 'true');
        link.setAttribute(linkAttr, 'true');

        link.className = NAV_LINK_CLASSES;

        if (matchesRoute(window.location.pathname, path)) {
            link.setAttribute('aria-current', 'page');
            link.classList.add('bg-surface-300');
        } else {
            clearInlineActiveStyles(item);
        }
    }

    function attachSidebarStateSync(sidebar) {
        if (sidebar.dataset[syncKey] === 'true') return;
        sidebar.dataset[syncKey] = 'true';

        const syncSoon = () => {
            STATE_SYNC_DELAYS.forEach((delay) => {
                if (delay === 0) {
                    requestAnimationFrame(() => updateActiveState(sidebar));
                    return;
                }

                setTimeout(() => updateActiveState(sidebar), delay);
            });
        };

        sidebar.addEventListener('click', syncSoon, true);
        window.addEventListener('popstate', syncSoon);
        window.addEventListener('rovalra:locationchange', syncSoon);
    }

    function insertLink(communityLink, label) {
        if (!sidebarLinkEnabled) return;

        // Only the bare Communities nav entry may spawn the item. Group links
        // (/communities/123) must never trigger insertion into whatever list
        // happens to contain them.
        if (!isCommunityIndexLink(communityLink)) return;

        const sidebar = getSidebarContainer(communityLink);
        if (!sidebar) return;

        // Guard the whole sidebar region, not just the immediate list:
        // sibling lists in the same nav must not each mint their own copy.
        const region = getSidebarRegion(communityLink);
        const existing = (region || sidebar).querySelector(
            `${linkSelector}, a[href="${path}"]`,
        );
        if (existing) {
            updateActiveState(sidebar);
            attachSidebarStateSync(sidebar);
            return;
        }

        const communityItem = getSidebarItem(sidebar, communityLink);
        const linkItem = createLinkItem(sidebar, communityLink, label);
        if (!communityItem || !linkItem) return;

        communityItem.insertAdjacentElement('afterend', linkItem);
        updateActiveState(sidebar);
        attachSidebarStateSync(sidebar);
    }

    function removeLinks() {
        document.querySelectorAll(itemSelector).forEach((item) => item.remove());
    }

    function addLinks(label) {
        document
            .querySelectorAll(SIDEBAR_COMMUNITY_SELECTOR)
            .forEach((communityLink) => insertLink(communityLink, label));
    }

    function init() {
        if (init._run) return;
        init._run = true;

        migrate?.();

        const label = ts(labelKey);
        ensureLocationWatcher();

        chrome.storage.local.get({ [storageKey]: false }, (stored) => {
            sidebarLinkEnabled = stored[storageKey];

            observeElement(
                SIDEBAR_COMMUNITY_SELECTOR,
                (communityLink) => {
                    insertLink(communityLink, label);
                },
                { multiple: true },
            );

            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName !== 'local' || !changes[storageKey]) {
                    return;
                }

                sidebarLinkEnabled = changes[storageKey].newValue;

                if (sidebarLinkEnabled) {
                    addLinks(label);
                } else {
                    removeLinks();
                }
            });
        });
    }

    return { init };
}
