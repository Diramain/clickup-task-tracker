/**
 * Gmail Content Script - Native Implementation
 * Inspired by InboxSDK (credited in README)
 * 
 * SECURITY: ISO 27001 compliant - CSP-safe
 */

console.log('[ClickUp Task Tracker] Loading...');

// State
const processedMessages = new WeakSet();
let linkedTasks = {};
let hasValidatedTasks = false; // Flag to run validation only once per page load

// Debounce utility to prevent excessive DOM scans
let scanDebounceTimer = null;
function debouncedScan() {
    if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
    scanDebounceTimer = setTimeout(() => {
        scanEmails();
        scanInbox();
    }, 100); // 100ms debounce
}

/**
 * Initialize
 */
function initialize() {
    console.log('[ClickUp Task Tracker] Initializing immediately...');

    // Start observing DOM changes immediately - no need to wait for specific element
    // The observer handles dynamic loading
    startObserver();

    // Load tasks
    loadLinkedTasks();

    // Listen for task creation events from modal
    window.addEventListener('cu-task-created', (e) => {
        const { task, threadId } = e.detail;
        updateLinkedTasksDisplay(threadId, task);
    });
}

// waitForGmail removed as it was blocking execution


/**
 * Load linked tasks from storage and validate they still exist
 */
async function loadLinkedTasks() {
    try {
        const result = await browser.storage.local.get('emailTaskMapping');
        const allTasks = result.emailTaskMapping || {};

        // Debug: show what keys we have
        const keys = Object.keys(allTasks);
        if (keys.length > 0) {
            console.log('[ClickUp] Loaded linked tasks:', keys);
        }

        // Validate tasks exist ONLY ONCE per page load
        if (!hasValidatedTasks) {
            hasValidatedTasks = true;
            validateAndCleanTasks(allTasks);
        }

        linkedTasks = allTasks;

        // Rescan inbox when tasks are loaded
        scanInbox();
    } catch (e) {
        linkedTasks = {};
    }
}

/**
 * Validate tasks still exist and clean up deleted ones
 * This only runs ONCE per page load to avoid API rate limits
 */
async function validateAndCleanTasks(allTasks) {
    console.log('[ClickUp] Validating tasks (one-time check)...');
    let hasChanges = false;

    for (const threadId of Object.keys(allTasks)) {
        const tasks = allTasks[threadId];
        if (!Array.isArray(tasks)) continue;

        const validTasks = [];
        for (const task of tasks) {
            try {
                const response = await browser.runtime.sendMessage({
                    action: 'validateTask',
                    taskId: task.id
                });

                if (response && response.exists) {
                    validTasks.push(task);
                } else {
                    hasChanges = true;
                    console.log('[ClickUp] Removed deleted task:', task.id);
                }
            } catch (e) {
                // If validation fails, keep the task
                validTasks.push(task);
            }
        }

        if (validTasks.length !== tasks.length) {
            allTasks[threadId] = validTasks;
        }
    }

    if (hasChanges) {
        // Update storage with cleaned data
        await browser.storage.local.set({ emailTaskMapping: allTasks });
        linkedTasks = allTasks;

        // Refresh UI
        refreshAllBars();
    }
}

/**
 * Refresh all task bars in the UI
 */
function refreshAllBars() {
    document.querySelectorAll('.cu-email-bar').forEach(bar => {
        const threadId = bar.dataset.threadId;
        const tasks = linkedTasks[threadId] || [];
        const container = bar.querySelector('.cu-linked-tasks');

        if (container) {
            container.innerHTML = tasks.map(t => `
                <a href="${t.url}" target="_blank" class="cu-task-link">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#7B68EE">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    ${escapeHtml(t.name)}
                </a>
            `).join('');
        }
    });
}

/**
 * Start observer
 */
function startObserver() {
    console.log('[ClickUp] Starting MutationObserver...');
    const observer = new MutationObserver((mutations) => {
        // Use debounced scan to prevent excessive calls
        requestAnimationFrame(debouncedScan);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial scan
    scanEmails();
    scanInbox();
}

/**
 * Scan for email messages (detail view)
 */
function scanEmails() {
    // Find email body containers
    const emailBodies = document.querySelectorAll('.a3s.aiL, .ii.gt');
    // Reduced logging - only log when bodies found
    if (emailBodies.length > 0) {
        console.log('[ClickUp] ScanEmails: found', emailBodies.length, 'email bodies');
    }

    emailBodies.forEach(body => {
        const messageContainer = body.closest('.gs') || body.closest('.h7') || body.parentElement;
        if (!messageContainer) return;

        // Use a direct check for our bar instead of WeakSet
        const existingBar = messageContainer.querySelector('.cu-email-bar');

        // Fix for SPA persistence: 
        // If bar exists, it might be from a cached view or hidden by Gmail's re-render.
        // We remove it and force re-injection to ensure it's in the correct DOM state/layer.
        if (existingBar) {
            const createdAt = parseInt(existingBar.dataset.createdAt) || 0;
            const age = Date.now() - createdAt;

            // BREAK THE LOOP: If created < 30s ago, assume it's still valid.
            // Only force re-inject after 30 seconds or on page refresh.
            if (age < 30000) {
                return;
            }

            console.log('[ClickUp] Refreshing stale bar. Age:', Math.round(age / 1000), 's');
            existingBar.remove();
        }

        const threadId = getThreadId();
        console.log('[ClickUp] Injecting bar for thread:', threadId);
        injectClickUpBar(messageContainer, body, threadId);
    });
}

/**
 * Scan inbox list and add task ID badges to subjects
 * NOTE: We no longer use WeakSet because Gmail's SPA re-renders rows frequently,
 * and the WeakSet refs become stale. Instead we just check if badge exists.
 */
function scanInbox() {
    // Gmail inbox rows - find email rows in list view
    const inboxRows = document.querySelectorAll('tr.zA');

    inboxRows.forEach(row => {
        // Find element with data-legacy-thread-id (can be span or div)
        const threadEl = row.querySelector('[data-legacy-thread-id]');
        if (!threadEl) return;

        // Get the legacy thread ID - this matches what we store
        const legacyThreadId = threadEl.getAttribute('data-legacy-thread-id');
        if (!legacyThreadId) return;

        // Check if already has badge anywhere in the row - this is the only check we need
        if (row.querySelector('.cu-inbox-task-badge')) return;

        // Check if this email has linked tasks
        let matchedTasks = linkedTasks[legacyThreadId] ||
            linkedTasks['email_' + legacyThreadId];

        // Fallback: search in keys just in case
        if (!matchedTasks) {
            for (const [key, tasks] of Object.entries(linkedTasks)) {
                if (key.includes(legacyThreadId)) {
                    matchedTasks = tasks;
                    break;
                }
            }
        }

        if (matchedTasks && matchedTasks.length > 0) {
            // Find the best container for the badge
            // Priority: subject span (.bqe), subject container (.y6), or cell with subject
            const subjectSpan = row.querySelector('.bqe') || row.querySelector('.bog span') || row.querySelector('.y6 span');
            const subjectCell = row.querySelector('td.xY') || row.querySelector('td.a4W');

            // Create task badge
            const badge = document.createElement('span');
            badge.className = 'cu-inbox-task-badge';
            badge.title = `ClickUp: ${matchedTasks.map(t => t.name).join(', ')}`;
            badge.style.cssText = 'display: inline-flex; margin-right: 6px; vertical-align: middle;';

            // Show first task ID (or count if multiple) - CSP-safe version
            if (matchedTasks.length === 1) {
                const link = document.createElement('a');
                link.href = matchedTasks[0].url;
                link.target = '_blank';
                link.className = 'cu-inbox-task-link';
                link.textContent = '#' + matchedTasks[0].id;
                // CSP-safe event listener instead of inline onclick
                link.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    window.open(matchedTasks[0].url, '_blank');
                });
                badge.appendChild(link);
            } else {
                const countSpan = document.createElement('span');
                countSpan.className = 'cu-inbox-task-count';
                countSpan.textContent = matchedTasks.length + ' tasks';
                badge.appendChild(countSpan);
            }

            // Try to insert next to subject text
            if (subjectSpan && subjectSpan.parentElement) {
                subjectSpan.parentElement.insertBefore(badge, subjectSpan);
                console.log('[ClickUp] Added inbox badge for:', legacyThreadId);
            } else if (subjectCell) {
                // Fallback: insert at start of subject cell
                const firstChild = subjectCell.querySelector('.y6') || subjectCell.firstChild;
                if (firstChild) {
                    firstChild.parentElement.insertBefore(badge, firstChild);
                    console.log('[ClickUp] Added inbox badge (fallback) for:', legacyThreadId);
                }
            }
        }
    });
}


/**
 * Get thread ID - prefer stable IDs (legacy/perm) for inbox matching
 */
function getThreadId() {
    // STRATEGY: Tasks are stored using the 'legacy' hex ID (e.g., 19b95d11476b81db).
    // We MUST return that same ID format to find linked tasks.

    // 1. Try URL Hash first - highly reliable for single thread views
    // URL usually looks like #inbox/19b95d11476b81db
    const hash = window.location.hash;
    const urlMatch = hash.match(/\/([a-f0-9]{16,})$/); // Check for hex string at end
    if (urlMatch) {
        console.log('[ClickUp] Using URL thread ID:', urlMatch[1]);
        return urlMatch[1];
    }

    // 2. Strict Search for Legacy ID in DOM (Scoped to ACTIVE Main View)
    // We restrict search to div[role="main"] to avoid picking up IDs from hidden views/inbox list
    const mainView = document.querySelector('div[role="main"]');
    const legacyEl = mainView ? mainView.querySelector('[data-legacy-thread-id]') : document.querySelector('[data-legacy-thread-id]');
    if (legacyEl) {
        const id = legacyEl.getAttribute('data-legacy-thread-id');
        if (id) {
            console.log('[ClickUp] Found legacy ID in DOM:', id);
            return id;
        }
    }

    // 3. Fallback: Try other attributes if desperate (but likely won't spawn linked tasks)
    const threadElement = document.querySelector('[data-thread-perm-id], [data-thread-id]');
    if (threadElement) {
        const id = threadElement.getAttribute('data-thread-perm-id') ||
            threadElement.getAttribute('data-thread-id');
        if (id) {
            console.log('[ClickUp] Fallback to generic thread ID:', id);
            return id;
        }
    }

    // 4. Last resort
    const fallbackId = 'email_' + Date.now();
    console.log('[ClickUp] Generated fallback ID:', fallbackId);
    return fallbackId;
}

/**
 * Get email subject
 */
function getEmailSubject() {
    const el = document.querySelector('h2[data-thread-perm-id]') || document.querySelector('.hP');
    return el ? el.textContent.trim() : 'Email Task';
}

/**
 * Get sender
 */
function getSenderEmail() {
    const el = document.querySelector('.gD[email]');
    return el ? el.getAttribute('email') : '';
}

/**
 * Get body HTML
 */
function getEmailBody() {
    const el = document.querySelector('.a3s.aiL');
    return el ? el.innerHTML : '';
}

/**
 * Inject ClickUp bar between header and body
 */
function injectClickUpBar(container, body, threadId) {
    // Create the ClickUp container
    const bar = document.createElement('div');
    bar.className = 'cu-email-bar';
    bar.dataset.threadId = threadId;
    bar.dataset.createdAt = Date.now().toString(); // Timestamp to prevent infinite re-injection loops

    console.log('[ClickUp Debug] Injecting bar for thread:', threadId, 'Found tasks:', linkedTasks[threadId]);

    // Check if task already linked
    const existingTasks = linkedTasks[threadId] || [];

    bar.innerHTML = `
    <div class="cu-bar-content">
      <button class="cu-add-btn" title="Create ClickUp task from this email">
        <svg width="16" height="16" viewBox="0 0 180 180" fill="currentColor">
          <path d="M25.4 129.1L49.2 110.9C61.9 127.4 75.3 135 90.3 135C105.1 135 118.2 127.5 130.3 111.1L154.4 128.9C137 152.5 115.3 165 90.3 165C65.3 165 43.4 152.6 25.4 129.1Z"/>
          <polygon points="90.2 49.8 47.8 86.4 28.2 63.6 90.3 10.2 151.8 63.7 132.2 86.3"/>
        </svg>
        Add to ClickUp
      </button>
      <div class="cu-linked-tasks">
        ${getLinkedTasksHtml(existingTasks)}
      </div>
    </div>
  `;

    // Add click handler to open our modal
    bar.querySelector('.cu-add-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        openTaskModal(threadId);
    });

    // Insert before the body
    body.parentElement.insertBefore(bar, body);
    console.log('[ClickUp Task Tracker] Bar injected');

    // Trigger validation for this thread's tasks specifically
    verifyThreadTasks(threadId, bar);
}

/**
 * Generate HTML for linked tasks
 */
function getLinkedTasksHtml(tasks) {
    if (!tasks || tasks.length === 0) return '';
    return tasks.map(t => `
          <a href="${t.url}" target="_blank" class="cu-task-link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#7B68EE">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            ${escapeHtml(t.name)}
          </a>
    `).join('');
}

/**
 * Verify tasks for a specific thread against API
 * Updates UI and Storage if tasks are deleted/archived
 */
async function verifyThreadTasks(threadId, barElement) {
    const tasks = linkedTasks[threadId] || [];
    if (tasks.length === 0) return;

    // console.log('[ClickUp] Verifying tasks for thread:', threadId);
    let changed = false;
    const validTasks = [];

    for (const task of tasks) {
        try {
            console.log('[ClickUp Debug] Verifying task:', task.id);
            const response = await browser.runtime.sendMessage({
                action: 'validateTask',
                taskId: task.id
            });
            console.log('[ClickUp Debug] Validation response:', task.id, response);

            if (response && response.exists) {
                validTasks.push(task);
            } else {
                console.log('[ClickUp] Detected deleted/archived task:', task.id);
                changed = true;
            }
        } catch (e) {
            // Network error? Keep task to be safe
            validTasks.push(task);
        }
    }

    if (changed) {
        console.log('[ClickUp] Updating thread tasks after validation');
        linkedTasks[threadId] = validTasks;

        // Update Storage
        const store = await browser.storage.local.get('emailTaskMapping');
        const mapping = store.emailTaskMapping || {};
        mapping[threadId] = validTasks;
        await browser.storage.local.set({ emailTaskMapping: mapping });

        // Update UI
        if (barElement) {
            const container = barElement.querySelector('.cu-linked-tasks');
            if (container) {
                container.innerHTML = getLinkedTasksHtml(validTasks);
            }
        }

        // Also update badge if needed (though badge is in list view)
    }
}

/**
 * Open the task creation modal (our custom implementation)
 */
function openTaskModal(threadId) {
    const emailData = {
        threadId: threadId,
        subject: getEmailSubject(),
        from: getSenderEmail(),
        html: getEmailBody()
    };

    // Use the TaskModal class
    if (typeof TaskModal !== 'undefined') {
        const modal = new TaskModal();
        modal.show(emailData);
    } else {
        console.error('[ClickUp Task Tracker] TaskModal not found');
        showNotification('Error: Modal not loaded', 'error');
    }
}

/**
 * Open ClickUp's official interface (emulates Chrome extension flow)
 * This uses the same data format as the official Chrome extension
 */
function openClickUpOfficial(threadId) {
    // Get the email body element for capturing HTML
    const bodyEl = document.querySelector('.a3s.aiL');
    const emailHtml = bodyEl ? bodyEl.innerHTML : '';

    // Get sender email
    const senderEl = document.querySelector('.gD[email]');
    const senderEmail = senderEl ? senderEl.getAttribute('email') : '';

    // Get user's email (for the data payload)
    const userEmailEl = document.querySelector('[data-inboxsdk-user-email-address]') ||
        document.querySelector('[data-email]');
    const userEmail = userEmailEl ?
        (userEmailEl.getAttribute('data-inboxsdk-user-email-address') ||
            userEmailEl.getAttribute('data-email') || '') : '';

    // Get subject
    const subjectEl = document.querySelector('h2[data-thread-perm-id]') || document.querySelector('.hP');
    const subject = subjectEl ? subjectEl.textContent.trim() : 'Email';

    // Get message ID (legacy format preferred)
    const msgContainer = document.querySelector('[data-message-id]');
    const legacyMsgEl = document.querySelector('[data-legacy-message-id]');
    let messageId = threadId;
    if (legacyMsgEl) {
        messageId = legacyMsgEl.getAttribute('data-legacy-message-id') || messageId;
    } else if (msgContainer) {
        const rawMsgId = msgContainer.getAttribute('data-message-id');
        messageId = rawMsgId && rawMsgId.includes('-') && legacyMsgEl ?
            legacyMsgEl.getAttribute('data-legacy-message-id') : rawMsgId || messageId;
    }

    // Get attachments (download URLs)
    const attachments = [];
    const attEls = document.querySelectorAll('.ii.gt [download_url], .a3s.aiL [download_url]');
    attEls.forEach(el => {
        const url = el.getAttribute('download_url');
        if (url) attachments.push(url);
    });

    // Build the data payload exactly like Chrome extension
    const gmailData = {
        thumbnail: null, // We skip screenshot capture
        html: emailHtml,
        data: {
            email: userEmail,
            id: threadId,
            subject: subject,
            from: senderEmail,
            attachments: attachments,
            msg: messageId,
            client: 'gmail'
        }
    };

    console.log('[ClickUp] Saving Gmail data for ClickUp:', gmailData.data);

    // Save data to storage in Chrome extension format
    browser.storage.local.set({
        screenshotTime: Date.now(),
        gmail: JSON.stringify(gmailData),
        url: '/email'
    }).then(() => {
        console.log('[ClickUp] Data saved. Opening ClickUp interface...');

        // Create the iframe box (emulating inject_main.js behavior)
        createClickUpIframe();
    }).catch(err => {
        console.error('[ClickUp] Failed to save data:', err);
        showNotification('Error saving email data', 'error');
    });
}

/**
 * Create ClickUp popup window (iframe blocked by X-Frame-Options)
 * Opens app.clickup.com in a popup window like the Chrome extension
 */
function createClickUpIframe() {
    // Open ClickUp in a popup window
    // The /email path is used by the Chrome extension for email creation
    const popup = window.open(
        'https://app.clickup.com/',
        'clickup_create',
        'width=500,height=700,left=200,top=100,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
        showNotification('Popup blocked! Please allow popups for this site.', 'error');
        return;
    }

    console.log('[ClickUp] Popup opened - data saved to storage for ClickUp to read');
    showNotification('ClickUp opened in new window. Create your task there!', 'success');
}

/**
 * Update linked tasks display after creation
 */
function updateLinkedTasksDisplay(threadId, task) {
    const bar = document.querySelector(`.cu-email-bar[data-thread-id="${threadId}"]`);
    if (!bar) return;

    const tasksContainer = bar.querySelector('.cu-linked-tasks');
    const taskLink = document.createElement('a');
    taskLink.href = task.url;
    taskLink.target = '_blank';
    taskLink.className = 'cu-task-link cu-task-new';
    taskLink.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#7B68EE">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
    ${escapeHtml(task.name)}
  `;
    tasksContainer.appendChild(taskLink);

    // Update local cache
    if (!linkedTasks[threadId]) linkedTasks[threadId] = [];
    linkedTasks[threadId].push({ id: task.id, name: task.name, url: task.url });
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show notification
 */
function showNotification(message, type) {
    const existing = document.querySelector('.cu-notification');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `cu-notification cu-notification-${type}`;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => el.remove(), 3000);
}

// Handle URL changes - Gmail is a SPA so we need to detect navigation
let lastUrl = '';

// Use popstate for back/forward navigation
window.addEventListener('popstate', () => {
    console.log('[ClickUp] Navigation detected (popstate)');
    loadLinkedTasks();
    debouncedScan();
});

// Single timer for URL changes (reduced from 500ms to 1000ms)
setInterval(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[ClickUp] URL changed, reloading tasks...');
        loadLinkedTasks();
        debouncedScan();
    }
}, 1000);

// Reduced periodic rescan from 2s to 5s - MutationObserver handles most cases
setInterval(() => {
    scanInbox();
}, 5000);

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
