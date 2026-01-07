/**
 * Chrome API Polyfill for Firefox
 * InboxSDK expects window.chrome to exist
 * This polyfill maps browser API to chrome API
 */

if (typeof window.chrome === 'undefined' && typeof browser !== 'undefined') {
    console.log('[ClickUp Task Tracker] Applying Chrome polyfill for Firefox');
    window.chrome = browser;
}
