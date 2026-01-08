/**
 * ClickUp API Wrapper
 * Handles all communication with ClickUp REST API v2
 */

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

class ClickUpAPI {
    constructor(token) {
        this.token = token;
    }

    /**
     * Make authenticated request to ClickUp API
     */
    async request(endpoint, options = {}) {
        const url = `${CLICKUP_API_BASE}${endpoint}`;
        const headers = {
            'Authorization': this.token,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.err || `API Error: ${response.status}`);
            error.status = response.status;
            throw error;
        }

        return response.json();
    }

    /**
     * Get authenticated user info
     * GET /user
     */
    async getUser() {
        return this.request('/user');
    }

    /**
     * Get all teams (workspaces) for the user
     * GET /team
     */
    async getTeams() {
        return this.request('/team');
    }

    /**
     * Get spaces in a team
     * GET /team/{team_id}/space
     */
    async getSpaces(teamId) {
        return this.request(`/team/${teamId}/space`);
    }

    /**
     * Get folders in a space
     * GET /space/{space_id}/folder
     */
    async getFolders(spaceId) {
        return this.request(`/space/${spaceId}/folder`);
    }

    /**
     * Get lists in a folder
     * GET /folder/{folder_id}/list
     */
    async getListsInFolder(folderId) {
        return this.request(`/folder/${folderId}/list`);
    }

    /**
     * Get folderless lists in a space
     * GET /space/{space_id}/list
     */
    async getListsInSpace(spaceId) {
        return this.request(`/space/${spaceId}/list`);
    }

    /**
     * Get tasks in a list
     * GET /list/{list_id}/task
     */
    async getTasks(listId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/list/${listId}/task${queryString ? '?' + queryString : ''}`;
        return this.request(endpoint);
    }

    /**
     * Search tasks by custom field value (Gmail Thread ID)
     */
    async findTaskByGmailThreadId(listId, customFieldId, threadId) {
        const params = {
            custom_fields: JSON.stringify([
                { field_id: customFieldId, operator: '=', value: threadId }
            ])
        };
        return this.getTasks(listId, params);
    }

    /**
     * Search tasks across the team by query string
     * GET /team/{team_id}/task?include_closed=true
     */
    async searchTasks(teamId, query) {
        // La API de ClickUp no tiene búsqueda por texto directa,
        // pero podemos obtener todas las tareas abiertas y filtrar
        // Usamos el endpoint de tareas filtradas
        return this.request(`/team/${teamId}/task?include_closed=true&subtasks=true`);
    }

    /**
     * Create a new task
     * POST /list/{list_id}/task
     */
    async createTask(listId, taskData) {
        return this.request(`/list/${listId}/task`, {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    }

    /**
     * Upload attachment to a task
     * POST /task/{task_id}/attachment
     */
    async uploadAttachment(taskId, file, filename) {
        const formData = new FormData();
        formData.append('attachment', file, filename);

        const url = `${CLICKUP_API_BASE}/task/${taskId}/attachment`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': this.token
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.err || `Upload Error: ${response.status}`);
        }

        return response.json();
    }
    /**
     * Upload email attachment to a task
     * Uses standard API v2 endpoint
     * 
     * POST /task/{task_id}/attachment
     */
    async uploadEmailAttachment(taskId, emailHtml, emailMetadata) {
        const formData = new FormData();

        // Create HTML blob for the email content
        const htmlBlob = new Blob([emailHtml], { type: 'text/html' });

        // Clean filename from subject
        const safeSubject = (emailMetadata.subject || 'Email')
            .replace(/[<>:"/\\|?*]/g, '')
            .substring(0, 100);

        // Append the HTML file
        formData.append('attachment', htmlBlob, `${safeSubject}.html`);

        const url = `${CLICKUP_API_BASE}/task/${taskId}/attachment`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': this.token
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('[ClickUp] Email attachment error:', error);
            throw new Error(error.err || `Upload Email Error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Add a comment to a task
     * POST /task/{task_id}/comment
     */
    async addComment(taskId, commentText) {
        return this.request(`/task/${taskId}/comment`, {
            method: 'POST',
            body: JSON.stringify({
                comment_text: commentText
            })
        });
    }

    /**
     * Get custom fields for a list
     * GET /list/{list_id}/field
     */
    async getCustomFields(listId) {
        return this.request(`/list/${listId}/field`);
    }

    /**
     * Get a specific task
     * GET /task/{task_id}
     */
    async getTask(taskId) {
        return this.request(`/task/${taskId}`);
    }

    /**
     * Add comment to a task
     * POST /task/{task_id}/comment
     */
    async addComment(taskId, commentData) {
        return this.request(`/task/${taskId}/comment`, {
            method: 'POST',
            body: JSON.stringify(commentData)
        });
    }

    /**
     * Get team members
     * (extracted from team data)
     */
    async getTeamMembers(teamId) {
        const teams = await this.getTeams();
        const team = teams.teams.find(t => t.id === teamId);
        return team ? team.members : [];
    }

    /**
     * Track time on a task
     * POST /team/{team_id}/time_entries
     * @param {string} teamId - Team/Workspace ID
     * @param {object} timeData - { tid: taskId, start: timestamp, duration: ms }
     */
    async trackTime(teamId, timeData) {
        return this.request(`/team/${teamId}/time_entries`, {
            method: 'POST',
            body: JSON.stringify(timeData)
        });
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClickUpAPI;
}
