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

/**
 * Initialize
 */
function initialize() {
    console.log('[ClickUp Task Tracker] Initializing...');

    waitForGmail().then(() => {
        console.log('[ClickUp Task Tracker] Gmail ready');
        startObserver();
        loadLinkedTasks();

        // Listen for task creation events from modal
        window.addEventListener('cu-task-created', (e) => {
            const { task, threadId } = e.detail;
            updateLinkedTasksDisplay(threadId, task);
        });
    });
}

/**
 * Wait for Gmail
 */
function waitForGmail() {
    return new Promise((resolve) => {
        const check = () => {
            if (document.querySelector('div[role="main"]')) {
                resolve();
            } else {
                setTimeout(check, 500);
            }
        };
        check();
    });
}

/**
 * Load linked tasks from storage and validate they still exist
 */
async function loadLinkedTasks() {
    try {
        const result = await browser.storage.local.get('emailTaskMapping');
        const allTasks = result.emailTaskMapping || {};

        // Validate tasks exist ONLY ONCE per page load
        if (!hasValidatedTasks) {
            hasValidatedTasks = true;
            validateAndCleanTasks(allTasks);
        }

        linkedTasks = allTasks;
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
    const observer = new MutationObserver(() => {
        requestAnimationFrame(scanEmails);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial scan
    scanEmails();
}

/**
 * Scan for email messages
 */
function scanEmails() {
    // Find email body containers
    const emailBodies = document.querySelectorAll('.a3s.aiL, .ii.gt');

    emailBodies.forEach(body => {
        const messageContainer = body.closest('.gs') || body.closest('.h7') || body.parentElement;
        if (!messageContainer || processedMessages.has(messageContainer)) return;
        processedMessages.add(messageContainer);

        const threadId = getThreadId();
        injectClickUpBar(messageContainer, body, threadId);
    });
}

/**
 * Get thread ID
 */
function getThreadId() {
    const hash = window.location.hash;
    const match = hash.match(/\/([a-zA-Z0-9]+)$/);
    return match ? match[1] : 'email_' + Date.now();
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

    // Check if task already linked
    const existingTasks = linkedTasks[threadId] || [];

    bar.innerHTML = `
    <div class="cu-bar-content">
      <button class="cu-add-btn" title="Create ClickUp task from this email">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
        </svg>
        Add to ClickUp
      </button>
      <div class="cu-linked-tasks">
        ${existingTasks.map(t => `
          <a href="${t.url}" target="_blank" class="cu-task-link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#7B68EE">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            ${escapeHtml(t.name)}
          </a>
        `).join('')}
      </div>
    </div>
  `;

    // Add click handler to open modal
    bar.querySelector('.cu-add-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        openTaskModal(threadId);
    });

    // Insert before the body
    body.parentElement.insertBefore(bar, body);
    console.log('[ClickUp Task Tracker] Bar injected');
}

/**
 * Open the task creation modal
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

// Handle URL changes
let lastUrl = '';
setInterval(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        loadLinkedTasks();
    }
}, 1000);

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
