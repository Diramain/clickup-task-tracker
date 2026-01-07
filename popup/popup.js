/**
 * Popup Script - Launcher
 * Opens settings in a new tab to prevent popup from closing when clicking outside
 */

// Check if running in tab mode
const urlParams = new URLSearchParams(window.location.search);
const isTabMode = urlParams.get('tab') === 'true';

if (!isTabMode) {
    // Open settings page in new tab
    browser.tabs.create({
        url: browser.runtime.getURL('popup/popup.html?tab=true')
    });
    // Close the popup
    window.close();
} else {
    // Running in tab mode - initialize the full UI
    initializeApp();
}

async function initializeApp() {
    // DOM Elements
    const setupSection = document.getElementById('setup-section');
    const loginSection = document.getElementById('login-section');
    const settingsSection = document.getElementById('settings-section');
    const redirectUrlEl = document.getElementById('redirect-url');
    const copyUrlBtn = document.getElementById('copy-url-btn');
    const clientIdInput = document.getElementById('client-id');
    const clientSecretInput = document.getElementById('client-secret');
    const saveOAuthBtn = document.getElementById('save-oauth-btn');
    const setupError = document.getElementById('setup-error');
    const connectBtn = document.getElementById('connect-btn');
    const loginError = document.getElementById('login-error');
    const reconfigureBtn = document.getElementById('reconfigure-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');
    const teamSelect = document.getElementById('team-select');
    const spaceSelect = document.getElementById('space-select');
    const folderSelect = document.getElementById('folder-select');
    const listSelect = document.getElementById('list-select');
    const saveBtn = document.getElementById('save-btn');
    const saveMessage = document.getElementById('save-message');

    // Get redirect URL first
    const urlResult = await browser.runtime.sendMessage({ action: 'getRedirectUrl' });
    if (urlResult && urlResult.redirectUrl) {
        redirectUrlEl.textContent = urlResult.redirectUrl;
    }

    const status = await browser.runtime.sendMessage({ action: 'getStatus' });

    if (status.authenticated) {
        showSettings(status.user);
        loadHierarchy();
    } else if (status.configured) {
        showLogin();
    } else {
        showSetup();
    }

    // Functions
    function showSetup() {
        setupSection.classList.remove('hidden');
        loginSection.classList.add('hidden');
        settingsSection.classList.add('hidden');
    }

    function showLogin() {
        setupSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
        settingsSection.classList.add('hidden');
    }

    function showSettings(user) {
        setupSection.classList.add('hidden');
        loginSection.classList.add('hidden');
        settingsSection.classList.remove('hidden');

        if (user) {
            userName.textContent = user.username || user.email;
            userEmail.textContent = user.email || '';
            userAvatar.textContent = (user.username || user.email || '?')[0].toUpperCase();
        }
    }

    async function copyRedirectUrl() {
        try {
            await navigator.clipboard.writeText(redirectUrlEl.textContent);
            copyUrlBtn.textContent = '✅';
            setTimeout(() => { copyUrlBtn.textContent = '📋'; }, 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }

    async function saveOAuthConfig() {
        const clientId = clientIdInput.value.trim();
        const clientSecret = clientSecretInput.value.trim();

        if (!clientId || !clientSecret) {
            setupError.textContent = 'Por favor, introduce Client ID y Client Secret';
            return;
        }

        saveOAuthBtn.disabled = true;
        saveOAuthBtn.textContent = 'Guardando...';
        setupError.textContent = '';

        try {
            await browser.runtime.sendMessage({
                action: 'saveOAuthConfig',
                clientId: clientId,
                clientSecret: clientSecret
            });

            showLogin();
        } catch (error) {
            setupError.textContent = error.message;
        } finally {
            saveOAuthBtn.disabled = false;
            saveOAuthBtn.textContent = 'Guardar y Continuar';
        }
    }

    async function connect() {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Conectando...';
        loginError.textContent = '';

        try {
            const result = await browser.runtime.sendMessage({ action: 'startOAuth' });

            if (result.success) {
                showSettings(result.user);
                loadHierarchy();
            } else {
                loginError.textContent = result.error || 'Error de autenticación';
            }
        } catch (error) {
            loginError.textContent = error.message;
        } finally {
            connectBtn.disabled = false;
            connectBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Iniciar sesión con ClickUp
      `;
        }
    }

    async function logout() {
        await browser.runtime.sendMessage({ action: 'logout' });
        showLogin();
    }

    async function loadHierarchy() {
        const hierarchy = await browser.runtime.sendMessage({ action: 'getHierarchy' });

        if (hierarchy && hierarchy.teams) {
            teamSelect.innerHTML = '<option value="">Seleccionar team...</option>';
            hierarchy.teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = team.name;
                teamSelect.appendChild(option);
            });
        }
    }

    async function loadSpaces(teamId) {
        spaceSelect.innerHTML = '<option value="">Cargando...</option>';
        spaceSelect.disabled = true;
        folderSelect.innerHTML = '<option value="">Sin folder (listas raíz)</option>';
        folderSelect.disabled = true;
        listSelect.innerHTML = '<option value="">Seleccionar list...</option>';
        listSelect.disabled = true;

        const result = await browser.runtime.sendMessage({
            action: 'getSpaces',
            teamId: teamId
        });

        spaceSelect.innerHTML = '<option value="">Seleccionar space...</option>';
        if (result && result.spaces) {
            result.spaces.forEach(space => {
                const option = document.createElement('option');
                option.value = space.id;
                option.textContent = space.name;
                spaceSelect.appendChild(option);
            });
            spaceSelect.disabled = false;
        }
    }

    async function loadFolders(spaceId) {
        folderSelect.innerHTML = '<option value="">Cargando...</option>';
        folderSelect.disabled = true;
        listSelect.innerHTML = '<option value="">Seleccionar list...</option>';
        listSelect.disabled = true;

        const result = await browser.runtime.sendMessage({
            action: 'getFolders',
            spaceId: spaceId
        });

        folderSelect.innerHTML = '<option value="">Sin folder (listas raíz)</option>';
        if (result && result.folders) {
            result.folders.forEach(folder => {
                const option = document.createElement('option');
                option.value = folder.id;
                option.textContent = folder.name;
                folderSelect.appendChild(option);
            });
        }
        folderSelect.disabled = false;
        loadLists(spaceId, null);
    }

    async function loadLists(spaceId, folderId) {
        listSelect.innerHTML = '<option value="">Cargando...</option>';
        listSelect.disabled = true;

        const result = await browser.runtime.sendMessage({
            action: 'getLists',
            spaceId: spaceId,
            folderId: folderId
        });

        listSelect.innerHTML = '<option value="">Seleccionar list...</option>';
        if (result && result.lists) {
            result.lists.forEach(list => {
                const option = document.createElement('option');
                option.value = list.id;
                option.textContent = list.name;
                listSelect.appendChild(option);
            });
            listSelect.disabled = false;
        }
    }

    async function saveSettings() {
        const defaultList = listSelect.value;

        if (!defaultList) {
            saveMessage.textContent = 'Por favor, selecciona una lista';
            saveMessage.className = 'error-message';
            return;
        }

        await browser.storage.local.set({ defaultList });

        saveMessage.textContent = '¡Configuración guardada!';
        saveMessage.className = 'success-message';
        setTimeout(() => { saveMessage.textContent = ''; }, 3000);
    }

    // Event Listeners
    copyUrlBtn.addEventListener('click', copyRedirectUrl);
    saveOAuthBtn.addEventListener('click', saveOAuthConfig);
    connectBtn.addEventListener('click', connect);
    reconfigureBtn.addEventListener('click', showSetup);
    logoutBtn.addEventListener('click', logout);
    saveBtn.addEventListener('click', saveSettings);

    teamSelect.addEventListener('change', (e) => {
        if (e.target.value) loadSpaces(e.target.value);
    });

    spaceSelect.addEventListener('change', (e) => {
        if (e.target.value) loadFolders(e.target.value);
    });

    folderSelect.addEventListener('change', (e) => {
        loadLists(spaceSelect.value, e.target.value || null);
    });
}
