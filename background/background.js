/**
 * Background Script
 * Handles OAuth authentication, API communication, and message passing
 * 
 * SECURITY COMPLIANCE (ISO 27001 / OWASP):
 * - OAuth 2.0 for authentication (no password storage)
 * - Each user provides their own OAuth credentials (no shared secrets)
 * - All credentials stored in browser.storage.local (encrypted by browser)
 * - HTTPS only for all API communications
 */

// ===== STATE =====
let clickupAPI = null;
let cachedUser = null;
let cachedTeams = null;

// ===== LOCAL STORAGE FOR EMAIL-TASK MAPPING =====
const EMAIL_TASK_STORAGE_KEY = 'emailTaskMapping';

/**
 * Get OAuth config from user settings
 */
async function getOAuthConfig() {
    const config = await browser.storage.local.get(['oauthClientId', 'oauthClientSecret']);
    return {
        clientId: config.oauthClientId || '',
        clientSecret: config.oauthClientSecret || '',
        authUrl: 'https://app.clickup.com/api',
        tokenUrl: 'https://api.clickup.com/api/v2/oauth/token',
        get redirectUrl() {
            return browser.identity.getRedirectURL();
        }
    };
}

/**
 * Check if OAuth is configured
 */
async function isOAuthConfigured() {
    const config = await getOAuthConfig();
    return !!(config.clientId && config.clientSecret);
}

/**
 * Save OAuth configuration
 */
async function saveOAuthConfig(clientId, clientSecret) {
    await browser.storage.local.set({
        oauthClientId: clientId,
        oauthClientSecret: clientSecret
    });
}

/**
 * Get email-task mappings from local storage
 */
async function getEmailTaskMappings() {
    const result = await browser.storage.local.get(EMAIL_TASK_STORAGE_KEY);
    return result[EMAIL_TASK_STORAGE_KEY] || {};
}

/**
 * Save email-task mapping to local storage
 */
async function saveEmailTaskMapping(threadId, task) {
    const mappings = await getEmailTaskMappings();
    if (!mappings[threadId]) {
        mappings[threadId] = [];
    }
    if (!mappings[threadId].find(t => t.id === task.id)) {
        mappings[threadId].push({
            id: task.id,
            name: task.name,
            url: task.url
        });
    }
    await browser.storage.local.set({ [EMAIL_TASK_STORAGE_KEY]: mappings });
}

/**
 * Find tasks linked to email threads (from local storage)
 * If not found locally, search in ClickUp
 */
async function findLinkedTasks(threadIds) {
    const mappings = await getEmailTaskMappings();
    const results = [];
    const notFoundLocally = [];

    for (const threadId of threadIds) {
        if (mappings[threadId] && mappings[threadId].length > 0) {
            results.push({
                threadId,
                tasks: mappings[threadId]
            });
        } else {
            notFoundLocally.push(threadId);
        }
    }

    // Para los que no encontramos localmente, buscar en ClickUp
    if (notFoundLocally.length > 0 && clickupAPI && cachedTeams) {
        for (const threadId of notFoundLocally) {
            try {
                const gmailUrl = `mail.google.com/mail/u/0/#inbox/${threadId}`;
                const foundTasks = await searchTasksByGmailUrl(gmailUrl, threadId);
                if (foundTasks.length > 0) {
                    results.push({
                        threadId,
                        tasks: foundTasks
                    });
                    // Guardar en cache local para futuras consultas
                    for (const task of foundTasks) {
                        await saveEmailTaskMapping(threadId, task);
                    }
                }
            } catch (err) {
                console.warn('[ClickUp] Error searching for task by Gmail URL:', err);
            }
        }
    }

    return results;
}

/**
 * Search tasks in ClickUp that contain a Gmail Thread ID
 * Searches in task name, description, and comments
 */
async function searchTasksByGmailUrl(gmailUrl, threadId) {
    if (!clickupAPI || !cachedTeams) return [];

    const team = cachedTeams.teams[0];
    if (!team) return [];

    const foundTasks = [];

    try {
        // Buscar en ClickUp por el thread ID
        // La API de búsqueda busca en nombre, descripción y comentarios
        const searchResults = await clickupAPI.searchTasks(team.id, threadId);

        if (searchResults && searchResults.tasks) {
            for (const task of searchResults.tasks) {
                // La tarea fue encontrada por la búsqueda, agregar si no está duplicada
                foundTasks.push({
                    id: task.id,
                    name: task.name,
                    url: task.url
                });
                console.log('[ClickUp] Found linked task via search:', task.id, task.name);
            }
        }
    } catch (err) {
        console.warn('[ClickUp] Search failed:', err);
    }

    return foundTasks;
}

// ===== OAUTH AUTHENTICATION =====

/**
 * Start OAuth flow
 */
async function startOAuthFlow() {
    const config = await getOAuthConfig();

    if (!config.clientId || !config.clientSecret) {
        throw new Error('OAuth not configured. Please set up your ClickUp OAuth App in settings.');
    }

    try {
        // Launch OAuth popup
        const responseUrl = await browser.identity.launchWebAuthFlow({
            url: `https://app.clickup.com/api?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUrl)}`,
            interactive: true
        });

        // Extract authorization code from response URL
        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');

        if (!code) {
            throw new Error('No authorization code received');
        }

        // Exchange code for access token
        const tokenResponse = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code: code
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.json().catch(() => ({}));
            throw new Error(error.err || 'Failed to exchange code for token');
        }

        const tokenData = await tokenResponse.json();

        // Store token securely
        await browser.storage.local.set({
            clickupToken: tokenData.access_token,
            tokenExpiry: Date.now() + (tokenData.expires_in || 3600) * 1000
        });

        // Initialize API with new token
        return initializeAPI();

    } catch (error) {
        console.error('OAuth flow failed:', error);
        throw error;
    }
}

/**
 * Initialize API with stored token
 */
async function initializeAPI() {
    const { clickupToken } = await browser.storage.local.get('clickupToken');
    if (clickupToken) {
        clickupAPI = new ClickUpAPI(clickupToken);
        try {
            cachedUser = await clickupAPI.getUser();
            cachedTeams = await clickupAPI.getTeams();
            return true;
        } catch (error) {
            console.error('Failed to initialize API:', error);
            await browser.storage.local.remove(['clickupToken', 'tokenExpiry']);
            clickupAPI = null;
            return false;
        }
    }
    return false;
}

/**
 * Clear authentication
 */
async function logout() {
    await browser.storage.local.remove([
        'clickupToken',
        'tokenExpiry',
        'defaultList'
    ]);
    clickupAPI = null;
    cachedUser = null;
    cachedTeams = null;
}

/**
 * Get cached hierarchy data
 */
async function getHierarchy() {
    if (!clickupAPI || !cachedTeams) {
        const initialized = await initializeAPI();
        if (!initialized) return null;
    }
    return cachedTeams;
}

/**
 * Create a task from email data
 */
async function createTaskFromEmail(emailData) {
    if (!clickupAPI) throw new Error('Not authenticated');

    const { defaultList } = await browser.storage.local.get('defaultList');
    if (!defaultList) throw new Error('No default list configured');

    // Construir la URL de Gmail para poder buscar después
    const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${emailData.threadId}`;

    // Descripción sin el link de Gmail (el link va en comentario)
    const taskData = {
        name: emailData.subject || 'Email Task',
        description: `📧 **Email from:** ${emailData.from}\n\n${emailData.description || ''}`,
    };

    if (emailData.assignees && emailData.assignees.length > 0) {
        taskData.assignees = emailData.assignees;
    }

    const task = await clickupAPI.createTask(defaultList, taskData);

    // Save email-task mapping locally
    await saveEmailTaskMapping(emailData.threadId, {
        id: task.id,
        name: task.name,
        url: task.url
    });

    // Agregar comentario con link a Gmail (más visible y fácil de buscar)
    try {
        const commentText = `📧 **Email vinculado:**\n🔗 [Ver email original en Gmail](${gmailUrl})\n\n_Thread ID: ${emailData.threadId}_`;
        await clickupAPI.addComment(task.id, commentText);
        console.log('[ClickUp] Gmail link added as comment');
    } catch (error) {
        console.error('Failed to add Gmail link comment:', error);
    }

    // Upload email as attachment
    if (emailData.html) {
        try {
            await clickupAPI.uploadEmailAttachment(task.id, emailData.html, {
                threadId: emailData.threadId,
                messageId: emailData.messageId || emailData.threadId,
                subject: emailData.subject,
                from: emailData.from,
                attachments: []
            });
            console.log('[ClickUp] Email attached');
        } catch (error) {
            console.error('Failed to upload email attachment:', error);
        }
    }

    return task;
}

/**
 * Message handler
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleAsync = async () => {
        switch (message.action) {
            case 'getStatus':
                const configured = await isOAuthConfigured();
                return {
                    authenticated: !!clickupAPI,
                    configured: configured,
                    user: cachedUser?.user
                };

            case 'saveOAuthConfig':
                await saveOAuthConfig(message.clientId, message.clientSecret);
                return { success: true };

            case 'getRedirectUrl':
                return { redirectUrl: browser.identity.getRedirectURL() };

            case 'startOAuth':
                try {
                    const success = await startOAuthFlow();
                    return { success, user: cachedUser?.user };
                } catch (error) {
                    return { success: false, error: error.message };
                }

            case 'logout':
                await logout();
                return { success: true };

            case 'getHierarchy':
                return await getHierarchy();

            case 'findLinkedTasks':
                return await findLinkedTasks(message.threadIds);

            case 'createTask':
                return await createTaskFromEmail(message.emailData);

            case 'getSpaces':
                if (!clickupAPI) return null;
                return await clickupAPI.getSpaces(message.teamId);

            case 'getFolders':
                if (!clickupAPI) return null;
                return await clickupAPI.getFolders(message.spaceId);

            case 'getLists':
                if (!clickupAPI) return null;
                if (message.folderId) {
                    return await clickupAPI.getListsInFolder(message.folderId);
                } else {
                    return await clickupAPI.getListsInSpace(message.spaceId);
                }

            case 'validateTask':
                // Check if a task exists (not deleted)
                // IMPORTANT: If API is unavailable, assume task exists to prevent accidental deletion
                if (!clickupAPI) {
                    console.log('[ClickUp] API not ready, skipping validation');
                    return { exists: true, skipped: true };
                }
                try {
                    const task = await clickupAPI.getTask(message.taskId);

                    // Check if task is archived (in trash) or deleted
                    if (task.archived) {
                        return { exists: false, reason: 'archived', taskStatus: task.status };
                    }

                    // Task exists if we get a valid response
                    return { exists: !!(task && task.id), reason: 'exists', taskStatus: task.status };
                } catch (error) {
                    const status = error.status || 0;

                    // Only mark as deleted if it's a 404 (Not Found) or 403 (Access Denied/Deleted)
                    // "This task is unavailable" can be a 403 if user lost access
                    if (status === 404 || status === 403 || (error.message && error.message.includes('404'))) {
                        console.log('[ClickUp] Task not found or access denied:', message.taskId, status);
                        return { exists: false, reason: 'api_error', errorStatus: status };
                    }

                    // For other errors (network, auth, etc), assume task exists to prevent data loss
                    console.log('[ClickUp] Validation error, keeping task:', error.message);
                    return { exists: true, error: error.message, errorStatus: status };
                }

            case 'searchTasks':
                // Search tasks by ID or name
                if (!clickupAPI) return { tasks: [] };

                const query = message.query || '';
                const results = [];

                // First, try to find by exact task ID
                if (query.length >= 4) {
                    try {
                        const taskById = await clickupAPI.getTask(query);
                        if (taskById && taskById.id) {
                            results.push({
                                id: taskById.id,
                                name: taskById.name,
                                url: taskById.url,
                                status: taskById.status?.status || 'unknown',
                                list: taskById.list?.name || ''
                            });
                        }
                    } catch (e) {
                        // Task ID not found, continue to name search
                    }
                }

                // Search by name in available teams
                if (query.length >= 4) {
                    try {
                        const teams = await getHierarchy();
                        if (teams && teams.teams && teams.teams[0]) {
                            const teamId = teams.teams[0].id;
                            // Use filtered team tasks endpoint
                            const searchResult = await clickupAPI.request(
                                `/team/${teamId}/task?` + new URLSearchParams({
                                    page: 0,
                                    order_by: 'updated',
                                    reverse: true,
                                    include_closed: false
                                }).toString()
                            );

                            if (searchResult && searchResult.tasks) {
                                const lowerQuery = query.toLowerCase();
                                const matched = searchResult.tasks
                                    .filter(t => t.name.toLowerCase().includes(lowerQuery))
                                    .slice(0, 10) // Max 10 results
                                    .map(t => ({
                                        id: t.id,
                                        name: t.name,
                                        url: t.url,
                                        status: t.status?.status || 'unknown',
                                        list: t.list?.name || ''
                                    }));

                                // Add to results, avoiding duplicates
                                matched.forEach(t => {
                                    if (!results.find(r => r.id === t.id)) {
                                        results.push(t);
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        console.error('Search error:', e);
                    }
                }

                return { tasks: results.slice(0, 10) };

            case 'createTaskFull':
                // Full task creation with custom list and all fields
                if (!clickupAPI) throw new Error('Not authenticated');

                const taskPayload = {
                    name: message.taskData.name || 'Email Task',
                    // Use markdown_description for proper Markdown rendering in ClickUp
                    markdown_description: message.taskData.description || ''
                };

                if (message.taskData.assignees && message.taskData.assignees.length > 0) {
                    taskPayload.assignees = message.taskData.assignees;
                }
                if (message.taskData.start_date) {
                    taskPayload.start_date = message.taskData.start_date;
                }
                if (message.taskData.due_date) {
                    taskPayload.due_date = message.taskData.due_date;
                }
                if (message.taskData.time_estimate) {
                    taskPayload.time_estimate = message.taskData.time_estimate;
                }

                const newTask = await clickupAPI.createTask(message.listId, taskPayload);

                // Save email-task mapping
                if (message.emailData && message.emailData.threadId) {
                    await saveEmailTaskMapping(message.emailData.threadId, {
                        id: newTask.id,
                        name: newTask.name,
                        url: newTask.url
                    });
                }

                // Upload email as attachment if requested
                if (message.emailData && message.emailData.html) {
                    try {
                        const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${message.emailData.subject || 'Email'}</title></head>
<body>
  <p><strong>From:</strong> ${message.emailData.from || 'Unknown'}</p>
  <p><strong>Subject:</strong> ${message.emailData.subject || 'No subject'}</p>
  <hr>
  ${message.emailData.html}
</body>
</html>`;
                        const blob = new Blob([htmlContent], { type: 'text/html' });
                        await clickupAPI.uploadAttachment(newTask.id, blob, `email-${Date.now()}.html`);
                    } catch (e) {
                        console.error('Failed to upload attachment:', e);
                    }
                }

                // Track time if provided (POST /team/{team_id}/time_entries)
                if (message.timeTracked && message.teamId) {
                    try {
                        const now = Date.now();
                        await clickupAPI.trackTime(message.teamId, {
                            tid: newTask.id,
                            start: now - message.timeTracked,
                            duration: message.timeTracked
                        });
                    } catch (e) {
                        console.error('Failed to track time:', e);
                    }
                }

                return newTask;

            case 'attachToTask':
                // Attach email to existing task
                if (!clickupAPI) throw new Error('Not authenticated');

                const taskId = message.taskId;
                const emailData = message.emailData;

                // Add comment with email info
                try {
                    await clickupAPI.addComment(taskId, {
                        comment_text: `📧 **Email attached**\n\n**From:** ${emailData.from}\n**Subject:** ${emailData.subject}`
                    });
                } catch (e) {
                    console.error('Failed to add comment:', e);
                }

                // Upload email as attachment
                if (emailData.html) {
                    try {
                        const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${emailData.subject || 'Email'}</title></head>
<body>
  <p><strong>From:</strong> ${emailData.from || 'Unknown'}</p>
  <p><strong>Subject:</strong> ${emailData.subject || 'No subject'}</p>
  <hr>
  ${emailData.html}
</body>
</html>`;
                        const blob = new Blob([htmlContent], { type: 'text/html' });
                        await clickupAPI.uploadAttachment(taskId, blob, `email-${Date.now()}.html`);
                    } catch (e) {
                        console.error('Failed to upload attachment:', e);
                    }
                }

                // Save mapping
                if (emailData.threadId) {
                    const task = await clickupAPI.getTask(taskId);
                    await saveEmailTaskMapping(emailData.threadId, {
                        id: task.id,
                        name: task.name,
                        url: task.url
                    });
                }

                return { success: true };

            // NOTE: case 'searchTasks' is handled above at line 348 with full functionality

            default:
                return { error: 'Unknown action' };
        }
    };

    handleAsync().then(sendResponse).catch(error => {
        sendResponse({ error: error.message });
    });

    return true;
});

// Initialize on startup
initializeAPI();
