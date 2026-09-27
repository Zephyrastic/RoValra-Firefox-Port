import { createCommunitySidebarLink } from './sidebarLink.js';

const TRANSACTIONS_PATH = '/transactions';
const STORAGE_KEY = 'transactionsSidebarLinkEnabled';

function createTransactionsIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.style.width = '20px';
    svg.style.height = '20px';
    svg.style.display = 'block';

    const receipt = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
    );
    receipt.setAttribute(
        'd',
        'M6 3h12v18l-2-1.25L14 21l-2-1.25L10 21l-2-1.25L6 21z',
    );

    const lineOne = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
    );
    lineOne.setAttribute('d', 'M9 8h6');

    const lineTwo = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
    );
    lineTwo.setAttribute('d', 'M9 12h6');

    const lineThree = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path',
    );
    lineThree.setAttribute('d', 'M9 16h4');

    svg.append(receipt, lineOne, lineTwo, lineThree);
    return svg;
}

const { init } = createCommunitySidebarLink({
    path: TRANSACTIONS_PATH,
    linkAttr: 'data-rovalra-transactions-link',
    itemAttr: 'data-rovalra-transactions-item',
    syncKey: 'rovalraTransactionsStateSync',
    labelKey: 'navigation.transactions',
    storageKey: STORAGE_KEY,
    createIcon: createTransactionsIcon,
});

export { init };
