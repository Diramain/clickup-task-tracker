/**
 * Task Creation Modal Component
 * With WYSIWYG editor and space avatars
 */

class TaskModal {
    constructor() {
        this.modal = null;
        this.emailData = null;
        this.hierarchy = { spaces: [], folders: {}, lists: {}, members: [], allLists: [] };
        this.selectedListId = null;
        this.selectedListPath = '';
        this.selectedTaskId = null;      // For attach tab
        this.selectedTaskData = null;    // For attach tab
        this.isResizing = false;
        this.teamId = null;
    }

    async show(emailData) {
        this.emailData = emailData;
        this.createModal();
        await this.loadFullHierarchy();
        document.body.appendChild(this.modal);
        this.modal.querySelector('#cu-task-name').focus();
    }

    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'cu-modal-container';
        this.modal.innerHTML = `
      <div class="cu-modal-window" tabindex="0">
        <div class="cu-modal-header" id="cu-modal-drag-handle">
          <h2>Create ClickUp Task</h2>
          <button class="cu-modal-close" title="Close (ESC)">x</button>
        </div>
        
        <div class="cu-modal-tabs">
          <button class="cu-tab cu-tab-active" data-tab="create">Create Task</button>
          <button class="cu-tab" data-tab="attach">Attach to Existing</button>
        </div>
        
        <div class="cu-modal-body">
          <!-- Create Task Tab -->
          <div class="cu-tab-content cu-tab-create active">
            
            <div class="cu-form-row">
              <label>Location</label>
              <div class="cu-location-search">
                <input type="text" id="cu-location-input" class="cu-input" 
                       placeholder="Type to search lists..." autocomplete="off">
                <div class="cu-location-dropdown hidden">
                  <div class="cu-location-results"></div>
                </div>
                <div class="cu-selected-location hidden">
                  <span class="cu-location-path"></span>
                  <button class="cu-location-clear" title="Change">x</button>
                </div>
              </div>
            </div>
            
            <div class="cu-form-row cu-form-row-inline">
              <div class="cu-form-group">
                <label>Start Date</label>
                <input type="date" id="cu-start-date" class="cu-input">
              </div>
              <div class="cu-form-group">
                <label>Due Date</label>
                <input type="date" id="cu-due-date" class="cu-input">
              </div>
            </div>
            
            <div class="cu-form-row">
              <label>Assignee</label>
              <div class="cu-assignee-container">
                <input type="text" id="cu-assignee-search" class="cu-input" 
                       placeholder="Search members..." autocomplete="off">
                <div class="cu-assignee-dropdown hidden"></div>
                <div class="cu-selected-assignees"></div>
              </div>
            </div>
            
            <div class="cu-form-row">
              <label>Task Name</label>
              <input type="text" id="cu-task-name" class="cu-input cu-input-large" 
                     placeholder="Task name...">
            </div>
            
            <div class="cu-form-row">
              <label>Description</label>
              <div class="cu-editor-container">
                <div class="cu-editor-tabs">
                  <button type="button" class="cu-editor-tab active" data-view="visual">Visual</button>
                  <button type="button" class="cu-editor-tab" data-view="source">Source</button>
                </div>
                <div class="cu-editor-toolbar">
                  <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                  <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                  <button type="button" data-cmd="strikeThrough" title="Strike"><s>S</s></button>
                  <span class="cu-toolbar-sep"></span>
                  <button type="button" data-cmd="insertUnorderedList" title="List">List</button>
                  <button type="button" data-cmd="createLink" title="Link">Link</button>
                </div>
                <div id="cu-editor-visual" class="cu-editor-visual" contenteditable="true" 
                     placeholder="Description (paste with formatting)..."></div>
                <textarea id="cu-editor-source" class="cu-editor-source hidden" 
                          placeholder="Raw markdown (e.g., **bold**, _italic_)..."></textarea>
              </div>
            </div>
            
            <div class="cu-form-row cu-form-row-inline">
              <div class="cu-form-group">
                <label>Time Estimate</label>
                <input type="text" id="cu-time-estimate" class="cu-input" 
                       placeholder="e.g., 2h 30m">
              </div>
              <div class="cu-form-group">
                <label>Track Time</label>
                <input type="text" id="cu-time-tracked" class="cu-input" 
                       placeholder="e.g., 10m">
              </div>
            </div>
            
            <div class="cu-form-row">
              <label class="cu-checkbox-label">
                <input type="checkbox" id="cu-attach-email" checked>
                Attach email as HTML file
              </label>
            </div>
          </div>
          
          <!-- Attach to Existing Tab -->
          <div class="cu-tab-content cu-tab-attach">
            <div class="cu-form-row">
              <label>Search Task</label>
              <div class="cu-task-search-container">
                <input type="text" id="cu-task-search" class="cu-input" 
                       placeholder="Enter task ID or name (min 4 chars)..." autocomplete="off">
                <div class="cu-task-search-results hidden"></div>
              </div>
            </div>
            <div class="cu-selected-task hidden">
              <div class="cu-selected-task-info">
                <span class="cu-selected-task-name"></span>
                <span class="cu-selected-task-list"></span>
              </div>
              <button class="cu-selected-task-clear">x</button>
            </div>
            <p class="cu-search-hint">Type at least 4 characters to search by name or paste exact task ID.</p>
          </div>
        </div>
        
        <div class="cu-modal-footer">
          <button class="cu-btn cu-btn-secondary cu-btn-cancel">Cancel</button>
          <button class="cu-btn cu-btn-primary cu-btn-submit">
            <span class="cu-btn-text">Create Task</span>
            <span class="cu-btn-spinner hidden"></span>
          </button>
        </div>
        
        <div class="cu-resize-handle"></div>
      </div>
    `;

        this.bindEvents();
        this.prefillData();
        this.setupResize();
        this.setupDrag();
    }

    prefillData() {
        if (!this.emailData) return;
        this.modal.querySelector('#cu-task-name').value = this.emailData.subject || '';
    }

    setupResize() {
        const handle = this.modal.querySelector('.cu-resize-handle');
        const modalWindow = this.modal.querySelector('.cu-modal-window');

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isResizing = true;
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = modalWindow.offsetWidth;
            const startHeight = modalWindow.offsetHeight;

            const onMouseMove = (e) => {
                if (!this.isResizing) return;
                modalWindow.style.width = Math.max(400, startWidth + (e.clientX - startX)) + 'px';
                modalWindow.style.height = Math.max(400, startHeight + (e.clientY - startY)) + 'px';
            };

            const onMouseUp = () => {
                this.isResizing = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    setupDrag() {
        const handle = this.modal.querySelector('#cu-modal-drag-handle');
        const modalWindow = this.modal.querySelector('.cu-modal-window');

        handle.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('cu-modal-close')) return;
            e.preventDefault();

            const startX = e.clientX - modalWindow.offsetLeft;
            const startY = e.clientY - modalWindow.offsetTop;

            const onMouseMove = (e) => {
                modalWindow.style.left = (e.clientX - startX) + 'px';
                modalWindow.style.top = (e.clientY - startY) + 'px';
                modalWindow.style.transform = 'none';
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    bindEvents() {
        // Close
        this.modal.querySelector('.cu-modal-close').addEventListener('click', () => this.close());
        this.modal.querySelector('.cu-btn-cancel').addEventListener('click', () => this.close());
        this.modal.querySelector('.cu-modal-window').addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });

        // Tabs
        this.modal.querySelectorAll('.cu-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Location search
        const locationInput = this.modal.querySelector('#cu-location-input');
        locationInput.addEventListener('input', () => this.searchLists(locationInput.value));
        locationInput.addEventListener('focus', () => {
            if (!this.selectedListId) this.searchLists(locationInput.value);
        });
        this.modal.querySelector('.cu-location-clear').addEventListener('click', () => this.clearLocation());

        // Assignee search
        const assigneeInput = this.modal.querySelector('#cu-assignee-search');
        assigneeInput.addEventListener('input', (e) => this.searchAssignees(e.target.value));
        assigneeInput.addEventListener('focus', () => this.showAssigneeDropdown());

        // Editor toolbar (execCommand for WYSIWYG)
        this.modal.querySelectorAll('.cu-editor-toolbar button').forEach(btn => {
            btn.addEventListener('click', () => this.execEditorCommand(btn.dataset.cmd));
        });

        // Editor tabs
        this.modal.querySelectorAll('.cu-editor-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchEditorView(tab.dataset.view));
        });

        // Smart paste in visual editor
        this.modal.querySelector('#cu-editor-visual').addEventListener('paste', (e) => this.handleVisualPaste(e));

        // Submit
        this.modal.querySelector('.cu-btn-submit').addEventListener('click', () => this.submit());

        // Task search for Attach tab
        const taskSearchInput = this.modal.querySelector('#cu-task-search');
        let searchTimeout = null;
        taskSearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.searchTasks(taskSearchInput.value), 300);
        });

        // Clear selected task
        this.modal.querySelector('.cu-selected-task-clear').addEventListener('click', () => this.clearSelectedTask());

        // Close dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.cu-location-search')) {
                this.modal.querySelector('.cu-location-dropdown').classList.add('hidden');
            }
            if (!e.target.closest('.cu-assignee-container')) {
                this.modal.querySelector('.cu-assignee-dropdown').classList.add('hidden');
            }
            if (!e.target.closest('.cu-task-search-container')) {
                this.modal.querySelector('.cu-task-search-results').classList.add('hidden');
            }
        });
    }

    /**
     * Execute editor command (WYSIWYG)
     */
    execEditorCommand(cmd) {
        const editor = this.modal.querySelector('#cu-editor-visual');
        editor.focus();

        if (cmd === 'createLink') {
            const url = prompt('Enter URL:');
            if (url) document.execCommand(cmd, false, url);
        } else {
            document.execCommand(cmd, false, null);
        }
    }

    /**
     * Handle paste in visual editor - filter unsupported content
     */
    handleVisualPaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;

        // Block images
        if (clipboardData.files && clipboardData.files.length > 0) {
            e.preventDefault();
            this.showToast('Images not supported (use attachments)', 'error');
            return;
        }

        // Get HTML content
        const html = clipboardData.getData('text/html');
        if (html) {
            e.preventDefault();

            // Clean HTML - remove images, scripts, etc.
            const cleaned = this.cleanHtmlForClickUp(html);
            document.execCommand('insertHTML', false, cleaned);
        }
        // Plain text will paste normally
    }

    /**
     * Clean HTML for ClickUp compatibility
     */
    cleanHtmlForClickUp(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove unsupported elements
        temp.querySelectorAll('img, script, style, iframe, object, embed, video, audio, canvas, svg, form, input, button').forEach(el => el.remove());

        // Remove inline styles except basic ones
        temp.querySelectorAll('*').forEach(el => {
            const keepStyles = ['font-weight', 'font-style', 'text-decoration'];
            const style = el.getAttribute('style');
            if (style) {
                el.removeAttribute('style');
            }
        });

        // Remove class and id attributes
        temp.querySelectorAll('*').forEach(el => {
            el.removeAttribute('class');
            el.removeAttribute('id');
        });

        return temp.innerHTML;
    }

    /**
     * Convert visual editor HTML to ClickUp markdown
     */
    htmlToClickUpMarkdown(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        // Remove all scripts, styles, images first
        temp.querySelectorAll('script, style, img, svg, canvas, video, audio, iframe').forEach(el => el.remove());

        // Process links before removing tags
        temp.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            const text = a.textContent.trim();
            if (href && text) {
                a.replaceWith(`[${text}](${href})`);
            } else if (text) {
                a.replaceWith(text);
            }
        });

        // Process formatting
        temp.querySelectorAll('strong, b').forEach(el => {
            const text = el.textContent.trim();
            if (text) el.replaceWith(`**${text}**`);
        });

        temp.querySelectorAll('em, i').forEach(el => {
            const text = el.textContent.trim();
            if (text) el.replaceWith(`_${text}_`);
        });

        temp.querySelectorAll('del, s, strike').forEach(el => {
            const text = el.textContent.trim();
            if (text) el.replaceWith(`~~${text}~~`);
        });

        temp.querySelectorAll('code').forEach(el => {
            const text = el.textContent.trim();
            if (text) el.replaceWith(`\`${text}\``);
        });

        // Process lists
        temp.querySelectorAll('li').forEach(el => {
            const text = el.textContent.trim();
            if (text) el.replaceWith(`- ${text}\n`);
        });

        // Get text content and clean up
        let text = temp.textContent || temp.innerText || '';

        // Clean up whitespace
        text = text
            .replace(/\r\n/g, '\n')           // Normalize line endings
            .replace(/\t/g, ' ')               // Tabs to spaces
            .replace(/ +/g, ' ')               // Multiple spaces to single
            .replace(/\n +/g, '\n')            // Leading spaces on lines
            .replace(/ +\n/g, '\n')            // Trailing spaces on lines
            .replace(/\n{3,}/g, '\n\n')        // Max 2 consecutive newlines
            .split('\n')                       // Split into lines
            .map(line => line.trim())          // Trim each line
            .filter((line, i, arr) => {        // Remove empty lines between content
                if (line) return true;
                // Keep one empty line between paragraphs
                return i > 0 && arr[i - 1] && i < arr.length - 1 && arr[i + 1];
            })
            .join('\n')
            .trim();

        return text;
    }

    async loadFullHierarchy() {
        try {
            const teams = await browser.runtime.sendMessage({ action: 'getHierarchy' });
            if (!teams || !teams.teams || teams.teams.length === 0) return;

            const team = teams.teams[0];
            this.teamId = team.id;
            this.hierarchy.members = team.members || [];

            const spacesResult = await browser.runtime.sendMessage({ action: 'getSpaces', teamId: team.id });
            if (!spacesResult || !spacesResult.spaces) return;

            this.hierarchy.spaces = spacesResult.spaces;
            await this.loadAllLists();
        } catch (error) {
            console.error('Failed to load hierarchy:', error);
        }
    }

    async loadAllLists() {
        const allLists = [];

        for (const space of this.hierarchy.spaces) {
            const spaceColor = space.color || '#7B68EE';
            const spaceAvatar = space.avatar ? space.avatar.url : null;

            try {
                const listsResult = await browser.runtime.sendMessage({
                    action: 'getLists', spaceId: space.id, folderId: null
                });
                if (listsResult && listsResult.lists) {
                    listsResult.lists.forEach(list => {
                        allLists.push({
                            id: list.id,
                            name: list.name,
                            path: `${space.name} > ${list.name}`,
                            spaceName: space.name,
                            spaceColor: spaceColor,
                            spaceAvatar: spaceAvatar
                        });
                    });
                }

                const foldersResult = await browser.runtime.sendMessage({
                    action: 'getFolders', spaceId: space.id
                });
                if (foldersResult && foldersResult.folders) {
                    for (const folder of foldersResult.folders) {
                        const folderLists = await browser.runtime.sendMessage({
                            action: 'getLists', folderId: folder.id
                        });
                        if (folderLists && folderLists.lists) {
                            folderLists.lists.forEach(list => {
                                allLists.push({
                                    id: list.id,
                                    name: list.name,
                                    path: `${space.name} > ${folder.name} > ${list.name}`,
                                    spaceName: space.name,
                                    folderName: folder.name,
                                    spaceColor: spaceColor,
                                    spaceAvatar: spaceAvatar
                                });
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('Error loading lists:', e);
            }
        }

        this.hierarchy.allLists = allLists;
    }

    searchLists(query) {
        const dropdown = this.modal.querySelector('.cu-location-dropdown');
        const resultsContainer = this.modal.querySelector('.cu-location-results');

        if (!query) {
            dropdown.classList.add('hidden');
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = this.hierarchy.allLists.filter(list =>
            list.name.toLowerCase().includes(lowerQuery) ||
            list.path.toLowerCase().includes(lowerQuery)
        );

        if (filtered.length > 0) {
            resultsContainer.innerHTML = filtered.slice(0, 15).map(list => {
                const avatar = list.spaceAvatar
                    ? `<img src="${list.spaceAvatar}" class="cu-space-avatar">`
                    : `<span class="cu-space-avatar" style="background:${list.spaceColor}">${list.spaceName[0]}</span>`;

                return `
          <div class="cu-location-item" data-list-id="${list.id}" data-path="${this.escapeHtml(list.path)}">
            ${avatar}
            <div class="cu-location-info">
              <span class="cu-location-item-name">${this.highlightMatch(list.name, query)}</span>
              <span class="cu-location-item-path">${this.escapeHtml(list.path)}</span>
            </div>
          </div>
        `;
            }).join('');

            resultsContainer.querySelectorAll('.cu-location-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.selectLocation(item.dataset.listId, item.dataset.path);
                });
            });

            dropdown.classList.remove('hidden');
        } else {
            resultsContainer.innerHTML = '<p class="cu-hint">No lists found</p>';
            dropdown.classList.remove('hidden');
        }
    }

    highlightMatch(text, query) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return this.escapeHtml(text).replace(regex, '<strong>$1</strong>');
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    selectLocation(listId, path) {
        this.selectedListId = listId;
        this.selectedListPath = path;

        const input = this.modal.querySelector('#cu-location-input');
        const selectedDiv = this.modal.querySelector('.cu-selected-location');
        const pathSpan = this.modal.querySelector('.cu-location-path');

        input.classList.add('hidden');
        selectedDiv.classList.remove('hidden');
        pathSpan.textContent = path;

        this.modal.querySelector('.cu-location-dropdown').classList.add('hidden');
    }

    clearLocation() {
        this.selectedListId = null;
        this.selectedListPath = '';

        const input = this.modal.querySelector('#cu-location-input');
        const selectedDiv = this.modal.querySelector('.cu-selected-location');

        input.classList.remove('hidden');
        input.value = '';
        selectedDiv.classList.add('hidden');
    }

    switchTab(tab) {
        this.modal.querySelectorAll('.cu-tab').forEach(t => t.classList.remove('cu-tab-active'));
        this.modal.querySelector(`[data-tab="${tab}"]`).classList.add('cu-tab-active');

        this.modal.querySelectorAll('.cu-tab-content').forEach(c => c.classList.remove('active'));
        this.modal.querySelector(`.cu-tab-${tab}`).classList.add('active');

        const submitBtn = this.modal.querySelector('.cu-btn-submit .cu-btn-text');
        submitBtn.textContent = tab === 'create' ? 'Create Task' : 'Attach Email';
    }

    switchEditorView(view) {
        const visual = this.modal.querySelector('#cu-editor-visual');
        const source = this.modal.querySelector('#cu-editor-source');
        const toolbar = this.modal.querySelector('.cu-editor-toolbar');

        this.modal.querySelectorAll('.cu-editor-tab').forEach(t => t.classList.remove('active'));
        this.modal.querySelector(`[data-view="${view}"]`).classList.add('active');

        if (view === 'source') {
            // Convert visual to markdown and show in source
            source.value = this.htmlToClickUpMarkdown(visual.innerHTML);
            visual.classList.add('hidden');
            source.classList.remove('hidden');
            toolbar.classList.add('hidden');
        } else {
            // Keep source as-is, show visual
            visual.classList.remove('hidden');
            source.classList.add('hidden');
            toolbar.classList.remove('hidden');
        }
    }

    searchAssignees(query) {
        const dropdown = this.modal.querySelector('.cu-assignee-dropdown');
        if (!query) {
            dropdown.classList.add('hidden');
            return;
        }

        const filtered = this.hierarchy.members.filter(m =>
            m.user && (m.user.username?.toLowerCase().includes(query.toLowerCase()) ||
                m.user.email?.toLowerCase().includes(query.toLowerCase()))
        );

        if (filtered.length > 0) {
            dropdown.innerHTML = filtered.map(m => {
                const avatar = m.user.profilePicture
                    ? `<img src="${m.user.profilePicture}" class="cu-avatar">`
                    : `<span class="cu-avatar cu-avatar-default">${(m.user.username || m.user.email || '?')[0].toUpperCase()}</span>`;
                return `
          <div class="cu-assignee-option" data-id="${m.user.id}">
            ${avatar}
            <span class="cu-assignee-name">${m.user.username || m.user.email}</span>
          </div>
        `;
            }).join('');

            dropdown.querySelectorAll('.cu-assignee-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    const member = filtered.find(m => m.user.id.toString() === opt.dataset.id);
                    this.selectAssignee(opt.dataset.id, member);
                });
            });

            dropdown.classList.remove('hidden');
        } else {
            dropdown.classList.add('hidden');
        }
    }

    showAssigneeDropdown() {
        const query = this.modal.querySelector('#cu-assignee-search').value;
        if (query) this.searchAssignees(query);
    }

    selectAssignee(id, member) {
        const container = this.modal.querySelector('.cu-selected-assignees');
        if (container.querySelector(`[data-id="${id}"]`)) return;

        const avatar = member?.user?.profilePicture
            ? `<img src="${member.user.profilePicture}" class="cu-avatar-small">`
            : `<span class="cu-avatar-small cu-avatar-default">${(member?.user?.username || '?')[0]}</span>`;

        const tag = document.createElement('span');
        tag.className = 'cu-assignee-tag';
        tag.dataset.id = id;
        tag.innerHTML = `${avatar} ${member?.user?.username || 'User'} <button type="button">x</button>`;
        tag.querySelector('button').addEventListener('click', () => tag.remove());
        container.appendChild(tag);

        this.modal.querySelector('.cu-assignee-dropdown').classList.add('hidden');
        this.modal.querySelector('#cu-assignee-search').value = '';
    }

    parseTime(timeStr) {
        if (!timeStr) return null;

        let totalMs = 0;
        const hours = timeStr.match(/(\d+)\s*h/i);
        const minutes = timeStr.match(/(\d+)\s*m/i);

        if (hours) totalMs += parseInt(hours[1]) * 60 * 60 * 1000;
        if (minutes) totalMs += parseInt(minutes[1]) * 60 * 1000;

        if (!hours && !minutes) {
            const num = parseInt(timeStr);
            if (!isNaN(num)) totalMs = num * 60 * 1000;
        }

        return totalMs > 0 ? totalMs : null;
    }

    getDescription() {
        const visual = this.modal.querySelector('#cu-editor-visual');
        const source = this.modal.querySelector('#cu-editor-source');

        // If source is visible, use source content directly
        if (!source.classList.contains('hidden')) {
            return source.value;
        }

        // Otherwise convert visual to markdown
        return this.htmlToClickUpMarkdown(visual.innerHTML);
    }

    async submit() {
        const activeTab = this.modal.querySelector('.cu-tab-active').dataset.tab;

        if (activeTab === 'attach') {
            // Use selected task or input value
            const taskId = this.selectedTaskId || this.modal.querySelector('#cu-task-search').value.trim();
            if (taskId) {
                await this.attachToTask(taskId);
            } else {
                this.showToast('Please select or enter a task', 'error');
            }
            return;
        }

        if (!this.selectedListId) {
            this.showToast('Please select a location', 'error');
            return;
        }

        const btn = this.modal.querySelector('.cu-btn-submit');
        btn.disabled = true;
        btn.querySelector('.cu-btn-spinner').classList.remove('hidden');
        btn.querySelector('.cu-btn-text').textContent = 'Creating...';

        try {
            const assignees = Array.from(this.modal.querySelectorAll('.cu-assignee-tag'))
                .map(tag => parseInt(tag.dataset.id));

            const startDate = this.modal.querySelector('#cu-start-date').value;
            const dueDate = this.modal.querySelector('#cu-due-date').value;
            const timeEstimate = this.parseTime(this.modal.querySelector('#cu-time-estimate').value);
            const timeTracked = this.parseTime(this.modal.querySelector('#cu-time-tracked').value);

            const taskData = {
                name: this.modal.querySelector('#cu-task-name').value || 'Email Task',
                description: this.getDescription(),
                assignees: assignees,
                start_date: startDate ? new Date(startDate).getTime() : undefined,
                due_date: dueDate ? new Date(dueDate).getTime() : undefined
            };

            if (timeEstimate) taskData.time_estimate = timeEstimate;

            const response = await browser.runtime.sendMessage({
                action: 'createTaskFull',
                listId: this.selectedListId,
                taskData: taskData,
                emailData: this.modal.querySelector('#cu-attach-email').checked ? this.emailData : null,
                timeTracked: timeTracked,
                teamId: this.teamId
            });

            if (response && response.id) {
                this.showToast('Task created!', 'success');
                window.dispatchEvent(new CustomEvent('cu-task-created', {
                    detail: { task: response, threadId: this.emailData.threadId }
                }));
                this.close();
            } else {
                this.showToast(response?.error || 'Failed', 'error');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
        }

        btn.disabled = false;
        btn.querySelector('.cu-btn-spinner').classList.add('hidden');
        btn.querySelector('.cu-btn-text').textContent = 'Create Task';
    }

    async attachToTask(taskId) {
        const btn = this.modal.querySelector('.cu-btn-submit');
        btn.disabled = true;

        try {
            const response = await browser.runtime.sendMessage({
                action: 'attachToTask',
                taskId: taskId,
                emailData: this.emailData
            });

            if (response && response.success) {
                this.showToast('Email attached!', 'success');
                this.close();
            } else {
                this.showToast(response?.error || 'Failed', 'error');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
        }

        btn.disabled = false;
    }

    showToast(msg, type) {
        const existing = document.querySelector('.cu-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `cu-toast cu-toast-${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    close() {
        this.modal.remove();
        this.modal = null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Search tasks by ID or name
     */
    async searchTasks(query) {
        const resultsContainer = this.modal.querySelector('.cu-task-search-results');

        if (query.length < 4) {
            resultsContainer.classList.add('hidden');
            return;
        }

        resultsContainer.innerHTML = '<div class="cu-search-loading">Searching...</div>';
        resultsContainer.classList.remove('hidden');

        try {
            const response = await browser.runtime.sendMessage({
                action: 'searchTasks',
                query: query
            });

            if (response && response.tasks && response.tasks.length > 0) {
                resultsContainer.innerHTML = response.tasks.map(task => `
                    <div class="cu-task-result" data-task-id="${task.id}" data-task-name="${this.escapeHtml(task.name)}" 
                         data-task-url="${task.url}" data-task-list="${this.escapeHtml(task.list)}">
                        <div class="cu-task-result-name">${this.highlightMatch(task.name, query)}</div>
                        <div class="cu-task-result-meta">
                            <span class="cu-task-result-id">#${task.id}</span>
                            <span class="cu-task-result-list">${this.escapeHtml(task.list)}</span>
                        </div>
                    </div>
                `).join('');

                resultsContainer.querySelectorAll('.cu-task-result').forEach(item => {
                    item.addEventListener('click', () => {
                        this.selectTask({
                            id: item.dataset.taskId,
                            name: item.dataset.taskName,
                            url: item.dataset.taskUrl,
                            list: item.dataset.taskList
                        });
                    });
                });
            } else {
                resultsContainer.innerHTML = '<div class="cu-search-empty">No tasks found</div>';
            }
        } catch (error) {
            resultsContainer.innerHTML = '<div class="cu-search-error">Search failed</div>';
        }
    }

    /**
     * Select a task for attaching
     */
    selectTask(task) {
        this.selectedTaskId = task.id;
        this.selectedTaskData = task;

        const input = this.modal.querySelector('#cu-task-search');
        const resultsContainer = this.modal.querySelector('.cu-task-search-results');
        const selectedContainer = this.modal.querySelector('.cu-selected-task');
        const hint = this.modal.querySelector('.cu-search-hint');

        input.classList.add('hidden');
        resultsContainer.classList.add('hidden');
        if (hint) hint.classList.add('hidden');
        selectedContainer.classList.remove('hidden');

        selectedContainer.querySelector('.cu-selected-task-name').textContent = task.name;
        selectedContainer.querySelector('.cu-selected-task-list').textContent = task.list ? `in ${task.list}` : `#${task.id}`;
    }

    /**
     * Clear selected task
     */
    clearSelectedTask() {
        this.selectedTaskId = null;
        this.selectedTaskData = null;

        const input = this.modal.querySelector('#cu-task-search');
        const selectedContainer = this.modal.querySelector('.cu-selected-task');
        const hint = this.modal.querySelector('.cu-search-hint');

        input.classList.remove('hidden');
        input.value = '';
        selectedContainer.classList.add('hidden');
        if (hint) hint.classList.remove('hidden');
    }
}

window.TaskModal = TaskModal;
