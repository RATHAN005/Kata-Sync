/**
 * background.js
 * Handles the orchestration between Popup, Content Script, and GitHub API.
 */

// Mapping Codewars language names to file extensions
const EXTENSION_MAP = {
    'javascript': 'js',
    'python': 'py',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'csharp': 'cs',
    'ruby': 'rb',
    'rust': 'rs',
    'go': 'go',
    'haskell': 'hs',
    'swift': 'swift',
    'scala': 'scala',
    'kotlin': 'kt',
    'typescript': 'ts',
    'shell': 'sh',
    'sql': 'sql',
    'php': 'php',
    'r': 'r',
    'lua': 'lua',
    'clojure': 'clj',
    'elixir': 'ex',
    'julia': 'jl',
    'dart': 'dart',
    // Add defaults
    'default': 'txt'
};

/**
 * Listen for messages from the Popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SYNC_KATA') {
        handleSync(request).then(sendResponse);
        return true; // Keep channel open for async response
    }
    if (request.action === 'AUTH_GITHUB') {
        authenticateGitHub().then(sendResponse);
        return true;
    }
    if (request.action === 'VERIFY_USER') {
        verifyCodewarsUser(request.username).then(sendResponse);
        return true;
    }
    if (request.action === 'FETCH_REPOS') {
        fetchUserRepos(request.token).then(sendResponse);
        return true;
    }
    if (request.action === 'GET_STATS') {
        getStats().then(sendResponse);
        return true;
    }
    if (request.action === 'AUTO_SYNC_TRIGGERED') {
        chrome.storage.local.get(['githubToken', 'githubRepo'], (data) => {
            if (data.githubToken && data.githubRepo) {
                console.log('Auto-Sync triggered.');
                handleSync({
                    token: data.githubToken,
                    repo: data.githubRepo,
                    isAuto: true // Flag to indicate auto-sync
                });
            } else {
                console.warn('Auto-Sync skipped: Configuration missing.');
            }
        });
        return true;
    }
    return true; // Keep channel open for all async responses
});

/**
 * Get Stats
 */
async function getStats() {
    const data = await chrome.storage.local.get('syncHistory');
    const history = data.syncHistory || [];

    // Calculate Streak (Robust)
    let streak = 0;
    if (history.length > 0) {
        const today = new Date().setHours(0, 0, 0, 0);
        const yesterday = today - 86400000;

        // Group all unique solved days
        const days = new Set(history.map(h => new Date(h.timestamp).setHours(0, 0, 0, 0)));

        // Start checking from today, or if not today, from yesterday
        let currentDay = days.has(today) ? today : (days.has(yesterday) ? yesterday : null);

        if (currentDay !== null) {
            while (days.has(currentDay)) {
                streak++;
                currentDay -= 86400000;
            }
        }
    }

    return {
        problemsSolved: history.length,
        streak: streak
    };
}

/**
 * Fetch User Repositories
 */
async function fetchUserRepos(token) {
    try {
        console.log('Fetching repos with token length:', token ? token.length : 'null');
        const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        console.log('Repo fetch status:', res.status);

        if (!res.ok) {
            const errText = await res.text();
            console.error('Repo fetch failed:', errText);
            return { success: false, error: `Failed to fetch repos: ${res.status}` };
        }

        const repos = await res.json();
        console.log(`Found ${repos.length} repositories.`);
        return {
            success: true,
            repos: repos.map(r => r.full_name)
        };
    } catch (err) {
        console.error('Repo fetch error:', err);
        return { success: false, error: err.message };
    }
}

// ==========================================
// CONFIGURATION (USER MUST UPDATE THESE)
// ==========================================
const OAUTH_CONFIG = {
    clientId: 'Ov23liubuXbPw7YyTL2s',        // TODO: Replace with your Client ID
    clientSecret: '2730ce2790c3564d970ddeab9b02d77bc64b9601', // User provided secret
    redirectUri: chrome.identity.getRedirectURL()
};

// Log the redirect URI to help the user configure the GitHub OAuth App
// Redirect URI for GitHub OAuth App
console.log('Redirect URI:', OAUTH_CONFIG.redirectUri);

/**
 * Authenticate with GitHub using OAuth 2.0
 */
async function authenticateGitHub() {
    try {
        const authUrl = new URL('https://github.com/login/oauth/authorize');
        authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientId);
        authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUri);
        authUrl.searchParams.set('scope', 'repo');
        // Force re-approval to pick up new scopes or account switch
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', Math.random().toString(36).substring(7)); // Bust cache

        // 1. Launch Web Auth Flow
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true
        });

        if (chrome.runtime.lastError) {
            console.error('Runtime Error:', chrome.runtime.lastError.message);
            throw new Error(chrome.runtime.lastError.message);
        }

        // 2. Extract Code from Redirect URL
        const urlParams = new URL(redirectUrl).searchParams;
        const code = urlParams.get('code');

        if (!code) {
            throw new Error('No code received from GitHub.');
        }

        // 3. Exchange Code for Token
        // Note: Client Secret usage here is only for personal extensions.
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: OAUTH_CONFIG.clientId,
                client_secret: OAUTH_CONFIG.clientSecret,
                code: code
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('Token Exchange Error:', tokenData);
            throw new Error(tokenData.error_description || 'Token exchange failed');
        }

        // 4. Get User Profile (optional, to verify)
        const userRes = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${tokenData.access_token}` }
        });
        const userData = await userRes.json();

        return {
            success: true,
            token: tokenData.access_token,
            username: userData.login
        };

    } catch (error) {
        console.error('Auth Error details:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Verify Codewars User
 */
async function verifyCodewarsUser(username) {
    try {
        const res = await fetch(`https://www.codewars.com/api/v1/users/${username}`);
        if (res.status === 404) {
            return { success: false, error: 'User not found' };
        }
        if (!res.ok) {
            return { success: false, error: 'API Error' };
        }
        const data = await res.json();
        return {
            success: true,
            rank: data.ranks.overall.name,
            honor: data.honor,
            username: data.username
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Main Sync Workflow
 */
async function handleSync(config) {
    try {
        const { token, repo } = config;

        // 1. Get the Active Tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            return { success: false, error: 'No active tab found.' };
        }

        if (!tab.url.includes('codewars.com')) {
            return { success: false, error: 'Not a Codewars page.' };
        }

        // 2. Get Kata Data from Content Script
        // Ensure content script is injected first to avoid "Could not establish connection"
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (injectionError) {
            // Ignore if already exists or other minor issue, proceed to message
            console.warn('Script injection warning:', injectionError);
        }

        let kataData;
        try {
            // Small delay to ensure injected script binds listener
            await new Promise(r => setTimeout(r, 100));
            kataData = await chrome.tabs.sendMessage(tab.id, { action: 'GET_KATA_DATA' });
        } catch (e) {
            return { success: false, error: 'Connection failed. Please reload the Codewars page.' + e.message };
        }

        if (!kataData) {
            return { success: false, error: 'Failed to extract kata data.' };
        }

        if (!kataData.code || !kataData.code.trim()) {
            return { success: false, error: 'No solution code found. Are you on a solution page?' };
        }

        // 3. Prepare File Data
        const fileExt = EXTENSION_MAP[kataData.language.toLowerCase()] || EXTENSION_MAP['default'];
        // Clean fields
        const safeLanguage = sanitizeFilename(kataData.language);
        const safeKyu = sanitizeFilename(kataData.rank || 'unknown-rank');
        // User requested "Problem Name" instead of "series of numbers" (slug/id)
        const safeTitle = sanitizeFilename(kataData.title || 'unknown-kata');

        const filePath = `codewars/${safeLanguage}/${safeKyu}/${safeTitle}.${fileExt}`;
        const content = kataData.code;
        // User asked to show Problem Name in the commit column
        // Format: "Problem Title" (No timestamp)
        let message = `${kataData.title}`;

        // 4. Push to GitHub
        const result = await pushToGitHub(token, repo, filePath, content, message);

        // 4b. Update README.md
        let readmeUpdated = false;
        try {
            await updateRepoReadme(token, repo, kataData, filePath);
            readmeUpdated = true;
        } catch (readmeErr) {
            console.error('Failed to update README:', readmeErr);
            // We don't fail the whole sync if readme fails, just log it
        }

        // 5. Save to History
        await saveSyncHistory({
            id: kataData.id || kataData.slug, // Use slug if id missing
            title: kataData.title,
            rank: kataData.rank,
            language: kataData.language,
            timestamp: new Date().toISOString(),
            repo: repo,
            filePath: filePath,
            url: result.content ? result.content.html_url : null
        });

        if (config.isAuto) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Codewars Sync',
                message: `Auto-synced "${kataData.title}" to GitHub!`
            });
        }

        return { success: true, filePath: filePath, readmeUpdated, ...result };

    } catch (err) {
        console.error('Sync Error:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Save Sync History
 */
async function saveSyncHistory(record) {
    try {
        const data = await chrome.storage.local.get('syncHistory');
        const history = data.syncHistory || [];

        // Add new record to beginning
        history.unshift(record);

        // Keep last 50 items
        if (history.length > 50) {
            history.pop();
        }

        await chrome.storage.local.set({ syncHistory: history });
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

/**
 * GitHub API Interaction
 */
async function pushToGitHub(token, repo, path, content, message) {
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Codewars-Sync-Extension' // Important for usage policies
    };

    // Step A: Check if file exists (to get SHA for update)
    let sha = null;
    let existingContent = null;

    try {
        const getRes = await fetch(apiUrl, { headers });
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
            // Decode existing content to check for duplicates
            // GitHub API returns content in Base64 (usually with newlines)
            existingContent = decodeBase64(data.content);
        } else if (getRes.status !== 404) {
            throw new Error(`GitHub API Error: ${getRes.status}`);
        }
    } catch (err) {
        // If network error or similar
        throw new Error('Failed to check existing file: ' + err.message);
    }

    // Prevent duplicate commits if content is identical
    if (existingContent && existingContent.trim() === content.trim()) {
        throw new Error('File already exists with identical content. No changes made.');
    }

    // Step B: Create or Update file
    const body = {
        message: message,
        content: encodeBase64(content),
        ...(sha && { sha }) // Include SHA if updating
    };

    const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            ...headers,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!putRes.ok) {
        const errData = await putRes.json();
        throw new Error(errData.message || `Upload failed: ${putRes.status}`);
    }

    return await putRes.json();
}

/**
 * Update Repository README.md
 */
async function updateRepoReadme(token, repo, kataData, filePath) {
    const readmePath = 'README.md';
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${readmePath}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Codewars-Sync-Extension'
    };

    let content = '';
    let sha = null;

    // 1. Get existing README
    try {
        const res = await fetch(apiUrl, { headers });
        if (res.ok) {
            const data = await res.json();
            content = decodeBase64(data.content);
            sha = data.sha;
        }
    } catch (e) {
        // Assume 404/New file
    }

    // 2. Prepare Entry
    const date = new Date().toLocaleDateString();
    const cleanTitle = (kataData.title || 'Unknown').replace(/\|/g, '-'); // Escape pipes
    const lang = kataData.language || 'txt';
    const rank = kataData.rank || 'Unknown';
    // Markdown Table Row
    const newRow = `| [${cleanTitle}](https://www.codewars.com/kata/${kataData.slug}) | ${rank} | ${lang} | [Solution](${filePath}) | ${date} |`;

    // 3. Construct/Update Content
    const tableHeader = `
| ⚡ Problem | 🥋 Difficulty | 🛠️ Language | 📜 Solution | 📅 Date |
| :--- | :--- | :--- | :--- | :--- |`;

    if (!content) {
        // Initialize new README with Badges & Beautification
        content = `# 🛡️ Kata-Sync

![Codewars](https://img.shields.io/badge/Codewars-B1361E?style=for-the-badge&logo=codewars&logoColor=white)
![Auto-Sync](https://img.shields.io/badge/Sync-Automated-brightgreen?style=for-the-badge)

Welcome! This repository is automatically updated with my solutions to various algorithmic problems on [Codewars](https://www.codewars.com).

## 🚀 Solved Problems
${tableHeader}
${newRow}
`;
    } else {
        // Append to existing
        if (content.includes('| :--- |')) {
            content += `\n${newRow}`;
        } else {
            content += `\n\n## 🚀 Solved Problems\n${tableHeader}\n${newRow}\n`;
        }
    }

    // 4. Push Update
    const body = {
        message: `Docs: Add ${cleanTitle} to README`,
        content: encodeBase64(content),
        ...(sha && { sha })
    };

    await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

/**
 * Utilities
 */
function sanitizeFilename(str) {
    if (!str) return 'unknown';
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '');   // Trim hyphens
}

// Unicode-safe Base64 Encoding
function encodeBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

// Unicode-safe Base64 Decoding
function decodeBase64(str) {
    // Github might add newlines
    const cleanStr = str.replace(/\n/g, '');
    return decodeURIComponent(escape(atob(cleanStr)));
}
