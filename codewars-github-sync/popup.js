document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const setupSection = document.getElementById('setup-section');
  const syncSection = document.getElementById('sync-section');

  // Codewars Inputs
  const cwUsernameInput = document.getElementById('codewars-username');
  const verifyUserBtn = document.getElementById('verify-user-btn');
  const userStatus = document.getElementById('user-status');

  // GitHub Inputs
  const authBtn = document.getElementById('auth-btn');
  const ghUserInfo = document.getElementById('github-user-info');
  const ghUsernameDisplay = document.getElementById('gh-username');
  const githubRepoInput = document.getElementById('github-repo');

  // Global Buttons
  const saveBtn = document.getElementById('save-btn');
  const syncBtn = document.getElementById('sync-btn');
  const editConfigBtn = document.getElementById('edit-config-btn');


  // Repo UI
  const refreshReposBtn = document.getElementById('refresh-repos-btn');
  const repoSelect = document.getElementById('repo-select');

  // Display Areas
  const messageArea = document.getElementById('message-area');
  const currentRepoDisplay = document.getElementById('current-repo');
  const displayCwUser = document.getElementById('display-cw-user');

  // State
  let state = {
    codewarsUsername: null,
    githubToken: null,
    githubUsername: null,
    githubRepo: null
  };

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async function init() {
    const data = await chrome.storage.local.get([
      'codewarsUsername',
      'githubToken',
      'githubUsername',
      'githubRepo'
    ]);

    state = { ...state, ...data };

    if (state.codewarsUsername && state.githubToken && state.githubRepo) {
      showSyncUI();
    } else {
      showSetupUI();
      // Prefill available data
      if (state.codewarsUsername) cwUsernameInput.value = state.codewarsUsername;
      if (state.githubRepo) githubRepoInput.value = state.githubRepo;
      updateAuthUI();
      checkFormValidity();
    }
  }

  init();
  createFireflies();

  // ... rest of code ...

  function createFireflies() {
    // Clean up any existing
    const existing = document.querySelectorAll('.firefly');
    existing.forEach(el => el.remove());

    const container = document.body;

    // Create 15 fireflies
    for (let i = 1; i <= 15; i++) {
      const fly = document.createElement('div');
      fly.className = 'firefly';

      // Randomize animation properties
      const moveAnim = `move${(i % 6) + 1}`; // move1 to move6
      const duration = 15 + Math.random() * 15 + 's'; // 15-30s duration for slower drift
      const delay = Math.random() * 5 + 's';

      fly.style.animationName = moveAnim;
      fly.style.animationDuration = duration;
      fly.style.animationDelay = delay;

      container.appendChild(fly);
    }
  }
  // ACTIONS
  // ==========================================

  // 1. Verify Codewars User
  verifyUserBtn.addEventListener('click', async () => {
    const username = cwUsernameInput.value.trim();
    if (!username) return showStatus(userStatus, 'Please enter a username', 'error');

    verifyUserBtn.disabled = true;
    verifyUserBtn.textContent = '...';

    const response = await chrome.runtime.sendMessage({
      action: 'VERIFY_USER',
      username: username
    });

    verifyUserBtn.disabled = false;
    verifyUserBtn.textContent = 'Verify';

    if (response && response.success) {
      state.codewarsUsername = response.username;
      showStatus(userStatus, `✅ Found: ${response.rank} (${response.honor})`, 'success');
      checkFormValidity();
    } else {
      state.codewarsUsername = null;
      showStatus(userStatus, '❌ User not found', 'error');
    }
  });

  // 2. GitHub Auth
  authBtn.addEventListener('click', async () => {
    console.log('GitHub Auth Button Clicked');
    authBtn.disabled = true;
    authBtn.innerHTML = 'Connecting...';

    try {
      console.log('Sending message to background...');
      const response = await chrome.runtime.sendMessage({ action: 'AUTH_GITHUB' });
      console.log('Response received:', response);

      if (response && response.success) {
        state.githubToken = response.token;
        state.githubUsername = response.username;
        await chrome.storage.local.set({
          githubToken: response.token,
          githubUsername: response.username
        });
        updateAuthUI();
        checkFormValidity();
      } else {
        console.error('Auth failed response:', response);
        authBtn.disabled = false;
        authBtn.innerHTML = 'Sign in with GitHub';
        alert('Authentication failed: ' + (response?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Popup Error:', err);
      authBtn.disabled = false;
      authBtn.innerHTML = 'Sign in with GitHub';
      alert('Error: ' + err.message);
    }
  });



  // 4. Save Configuration
  saveBtn.addEventListener('click', async () => {
    const repo = repoSelect.value || githubRepoInput.value.trim();
    if (!repo || !repo.includes('/')) {
      alert('Please select or enter a repository in "username/repo" format');
      return;
    }

    state.githubRepo = repo;

    await chrome.storage.local.set({
      codewarsUsername: state.codewarsUsername,
      githubRepo: repo
    });

    showMessage('Configuration saved!', 'success');
    setTimeout(() => {
      showSyncUI();
    }, 1000);
  });

  // 5. Sync Action
  syncBtn.addEventListener('click', async () => {
    setSyncing(true);
    showMessage('Initializing sync...', 'normal');

    try {
      const { githubToken, githubRepo } = await chrome.storage.local.get(['githubToken', 'githubRepo']);

      if (!githubToken || !githubRepo) throw new Error('Configuration missing.');

      const response = await chrome.runtime.sendMessage({
        action: 'SYNC_KATA',
        token: githubToken,
        repo: githubRepo
      });

      if (response && response.success) {
        let msg = `Successfully synced to ${response.filePath}`;
        if (response.readmeUpdated) msg += ' and updated README.md';
        showMessage(msg, 'success');
        loadStats(); // Update counters
      } else {
        throw new Error(response.error || 'Unknown error occurred');
      }

    } catch (err) {
      console.error(err);
      showMessage(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  });

  // 6. Config Edit / Reset
  editConfigBtn.addEventListener('click', () => {
    showSetupUI();
    cwUsernameInput.value = state.codewarsUsername || '';
    githubRepoInput.value = state.githubRepo || '';
    updateAuthUI();
  });



  // ==========================================
  // HELPERS
  // ==========================================



  // ... (previous code)

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async function init() {
    const data = await chrome.storage.local.get([
      'codewarsUsername',
      'githubToken',
      'githubUsername',
      'githubRepo'
    ]);

    state = { ...state, ...data };

    if (state.codewarsUsername && state.githubToken && state.githubRepo) {
      showSyncUI();
    } else {
      showSetupUI();
      if (state.codewarsUsername) cwUsernameInput.value = state.codewarsUsername;
      if (state.githubRepo) githubRepoInput.value = state.githubRepo;
      updateAuthUI();

      // Attempt to load repos if token exists
      if (state.githubToken) {
        loadRepositories();
      }
    }
  }

  init();

  // ... (previous actions)

  // 7. Refresh Repositories
  refreshReposBtn.addEventListener('click', loadRepositories);

  // 8. Handle Repo Selection
  repoSelect.addEventListener('change', () => {
    const selectedRepo = repoSelect.value;
    if (selectedRepo) {
      githubRepoInput.value = selectedRepo;
      state.githubRepo = selectedRepo;
      checkFormValidity();
    }
  });

  // 9. Tab Switching
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Activate Tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show Content
      const targetId = tab.getAttribute('data-tab');
      tabContents.forEach(content => {
        if (content.id === targetId) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      });

      // If History tab, load history
      if (targetId === 'tab-history') {
        loadHistory();
      }
    });
  });

  // 10. Clear History
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const historyList = document.getElementById('history-list');

  clearHistoryBtn.addEventListener('click', async () => {
    // console.log('Clear History clicked');
    if (confirm('Clear sync history?')) {
      await chrome.storage.local.remove('syncHistory');
      loadHistory();
    }
  });

  async function loadHistory() {
    const data = await chrome.storage.local.get('syncHistory');
    const history = data.syncHistory || [];
    renderHistory(history);
  }

  function renderHistory(history) {
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No sync history yet.</div>';
      return;
    }

    historyList.innerHTML = '';
    history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';

      const date = new Date(item.timestamp).toLocaleDateString();

      div.innerHTML = `
            <div class="history-item-left">
                <span class="history-title">${item.title}</span>
                <div class="history-meta">
                    <span class="history-rank">${item.rank}</span>
                    <span>${item.language}</span>
                    <span>• ${date}</span>
                </div>
            </div>
            ${item.url ? `<a href="${item.url}" target="_blank" class="history-btn">View</a>` : ''}
        `;
      historyList.appendChild(div);
    });
  }

  // Helpers
  async function loadRepositories() {
    if (!state.githubToken) return;

    refreshReposBtn.disabled = true;
    repoSelect.disabled = true;
    repoSelect.innerHTML = '<option>Loading...</option>';
    refreshReposBtn.classList.add('rotating');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'FETCH_REPOS',
        token: state.githubToken
      });

      if (response && response.success) {
        populateRepoSelect(response.repos);
      } else {
        const errorMsg = response ? response.error : 'No response from background';
        throw new Error(errorMsg || 'Failed to fetch');
      }
    } catch (err) {
      console.error(err);
      // Show specific error in dropdown for debugging
      repoSelect.innerHTML = `<option value="">Error: ${err.message}</option>`;
      refreshReposBtn.disabled = false;
    } finally {
      refreshReposBtn.disabled = false;
      repoSelect.disabled = false;
      refreshReposBtn.classList.remove('rotating');
    }
  }

  function populateRepoSelect(repos) {
    repoSelect.innerHTML = '<option value="">Select a repository...</option>';
    const currentRepo = state.githubRepo || githubRepoInput.value;

    let foundCurrent = false;
    repos.forEach(repo => {
      const option = document.createElement('option');
      option.value = repo;
      option.textContent = repo;
      if (repo === currentRepo) {
        option.selected = true;
        foundCurrent = true;
      }
      repoSelect.appendChild(option);
    });

    // If current repo content manually typed isn't in list, add it or handle it?
    if (currentRepo && !foundCurrent) {
      const option = document.createElement('option');
      option.value = currentRepo;
      option.textContent = currentRepo + ' (Custom)';
      option.selected = true;
      repoSelect.appendChild(option);
    }
  }

  function showSetupUI() {
    setupSection.classList.remove('hidden');
    syncSection.classList.add('hidden');
    messageArea.textContent = '';
  }

  function showSyncUI() {
    setupSection.classList.add('hidden');
    syncSection.classList.remove('hidden');
    currentRepoDisplay.textContent = state.githubRepo;
    displayCwUser.textContent = state.codewarsUsername || 'Unknown';
    messageArea.textContent = '';
    loadStats(); // Load stats when UI shows
  }

  // Load Stats from background
  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'GET_STATS' });
      if (response) {
        document.getElementById('stat-solved').textContent = response.problemsSolved || 0;
        document.getElementById('stat-streak').textContent = response.streak || 0;
      }
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  }

  // Update Auth UI to also enable/disable repo fetch
  function updateAuthUI() {
    if (state.githubToken) {
      authBtn.classList.add('hidden');
      ghUserInfo.classList.remove('hidden');
      ghUsernameDisplay.textContent = state.githubUsername || 'Connected';
      refreshReposBtn.disabled = false;
      repoSelect.disabled = false;
      if (repoSelect.options.length <= 1) loadRepositories(); // Auto load if empty
    } else {
      authBtn.classList.remove('hidden');
      authBtn.disabled = false;
      authBtn.innerHTML = `
            <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            Sign in with GitHub`;
      ghUserInfo.classList.add('hidden');
      refreshReposBtn.disabled = true;
      repoSelect.disabled = true;
    }
  }

  function checkFormValidity() {
    const repo = repoSelect.value || githubRepoInput.value.trim();
    if (state.githubToken && state.codewarsUsername && repo) {
      saveBtn.disabled = false;
    } else {
      saveBtn.disabled = true;
    }
  }

  function showStatus(element, text, type) {
    element.textContent = text;
    element.className = 'sub-hint ' + type;
    element.classList.remove('hidden');
    if (type === 'success') {
      element.style.color = 'var(--success)';
    } else if (type === 'error') {
      element.style.color = 'var(--error)';
    }
  }

  function showMessage(text, type = 'normal') {
    messageArea.textContent = text;
    messageArea.className = 'message-area ' + type;
  }

  function setSyncing(isSyncing) {
    syncBtn.disabled = isSyncing;
    syncBtn.innerHTML = isSyncing
      ? '<span class="icon">⏳</span> Syncing...'
      : '<span class="icon">⚡</span> Sync Current Solution';
  }

  // Check initial validity on input Change
  cwUsernameInput.addEventListener('input', () => {
    // Invalidate verification if changed? 
    // For now, let's reset verification state to ensure they verify again
    if (state.codewarsUsername !== cwUsernameInput.value) {
      state.codewarsUsername = null;
      saveBtn.disabled = true;
      userStatus.classList.add('hidden');
    }
  });

  githubRepoInput.addEventListener('input', () => {
    state.githubRepo = githubRepoInput.value.trim();
    checkFormValidity();
  });

  repoSelect.addEventListener('change', () => {
    const selected = repoSelect.value;
    if (selected) {
      githubRepoInput.value = selected;
      state.githubRepo = selected;
    }
    checkFormValidity();
  });

  refreshReposBtn.addEventListener('click', () => {
    loadRepositories();
  });



}); // End DOMContentLoaded

// Global Event Delegation for Buttons (Robust Fix)
// Global Event Delegation for Buttons (Robust Fix)
document.addEventListener('click', async (e) => {
  // Logout
  const logoutBtn = e.target.closest('#app-logout-btn');
  if (logoutBtn) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Global Logout Click');
    // REMOVE specific auth/config keys but KEEP syncHistory/stats
    await chrome.storage.local.remove([
      'codewarsUsername',
      'githubToken',
      'githubUsername',
      'githubRepo'
    ]);
    window.location.reload();
  }

  // Clear History
  if (e.target && e.target.id === 'clear-history-btn') {
    e.preventDefault();
    if (confirm('Clear sync history?')) {
      await chrome.storage.local.remove('syncHistory');
      // Reload UI if possible, or just reload window
      window.location.reload();
    }
  }
});
