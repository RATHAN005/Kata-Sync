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
    'default': 'txt'
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SYNC_KATA') {
        handleSync(request).then(sendResponse);
        return true;
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
                    isAuto: true
                });
            } else {
                console.warn('Auto-Sync skipped: Configuration missing.');
            }
        });
        return true;
    }
    return true;
});

async function getStats() {
    const data = await chrome.storage.local.get('syncHistory');
    const history = data.syncHistory || [];

    let streak = 0;
    if (history.length > 0) {
        const today = new Date().setHours(0, 0, 0, 0);
        const yesterday = today - 86400000;

        const days = new Set(history.map(h => new Date(h.timestamp).setHours(0, 0, 0, 0)));

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

const OAUTH_CONFIG = {
    clientId: 'Ov23liubuXbPw7YyTL2s',
    clientSecret: '2730ce2790c3564d970ddeab9b02d77bc64b9601',
    redirectUri: chrome.identity.getRedirectURL()
};

console.log('Redirect URI:', OAUTH_CONFIG.redirectUri);

async function authenticateGitHub() {
    try {
        const authUrl = new URL('https://github.com/login/oauth/authorize');
        authUrl.searchParams.set('client_id', OAUTH_CONFIG.clientId);
        authUrl.searchParams.set('redirect_uri', OAUTH_CONFIG.redirectUri);
        authUrl.searchParams.set('scope', 'repo');
        authUrl.searchParams.set('prompt', 'consent');
        authUrl.searchParams.set('state', Math.random().toString(36).substring(7));

        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true
        });

        if (chrome.runtime.lastError) {
            console.error('Runtime Error:', chrome.runtime.lastError.message);
            throw new Error(chrome.runtime.lastError.message);
        }

        const urlParams = new URL(redirectUrl).searchParams;
        const code = urlParams.get('code');

        if (!code) {
            throw new Error('No code received from GitHub.');
        }

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

async function handleSync(config) {
    try {
        const { token, repo } = config;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            return { success: false, error: 'No active tab found.' };
        }

        if (!tab.url.includes('codewars.com')) {
            return { success: false, error: 'Not a Codewars page.' };
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
        } catch (injectionError) {
            console.warn('Script injection warning:', injectionError);
        }

        let kataData;
        try {
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

        const fileExt = EXTENSION_MAP[kataData.language.toLowerCase()] || EXTENSION_MAP['default'];
        const safeLanguage = sanitizeFilename(kataData.language);
        const safeKyu = sanitizeFilename(kataData.rank || 'unknown-rank');
        const safeTitle = sanitizeFilename(kataData.title || 'unknown-kata');

        const filePath = `codewars/${safeLanguage}/${safeKyu}/${safeTitle}.${fileExt}`;
        const content = kataData.code;
        let message = `${kataData.title}`;

        const result = await pushToGitHub(token, repo, filePath, content, message);

        let readmeUpdated = false;
        try {
            await updateRepoReadme(token, repo, kataData, filePath);
            readmeUpdated = true;
        } catch (readmeErr) {
            console.error('Failed to update README:', readmeErr);
        }

        await saveSyncHistory({
            id: kataData.id || kataData.slug,
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

async function saveSyncHistory(record) {
    try {
        const data = await chrome.storage.local.get('syncHistory');
        const history = data.syncHistory || [];

        history.unshift(record);

        if (history.length > 50) {
            history.pop();
        }

        await chrome.storage.local.set({ syncHistory: history });
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

async function pushToGitHub(token, repo, path, content, message) {
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Codewars-Sync-Extension'
    };

    let sha = null;
    let existingContent = null;

    try {
        const getRes = await fetch(apiUrl, { headers });
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
            existingContent = decodeBase64(data.content);
        } else if (getRes.status !== 404) {
            throw new Error(`GitHub API Error: ${getRes.status}`);
        }
    } catch (err) {
        throw new Error('Failed to check existing file: ' + err.message);
    }

    if (existingContent && existingContent.trim() === content.trim()) {
        throw new Error('File already exists with identical content. No changes made.');
    }

    const body = {
        message: message,
        content: encodeBase64(content),
        ...(sha && { sha })
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

    try {
        const res = await fetch(apiUrl, { headers });
        if (res.ok) {
            const data = await res.json();
            content = decodeBase64(data.content);
            sha = data.sha;
        }
    } catch (e) {
    }

    const date = new Date().toLocaleDateString();
    const cleanTitle = (kataData.title || 'Unknown').replace(/\|/g, '-');
    const lang = kataData.language || 'txt';
    const rank = kataData.rank || 'Unknown';
    const newRow = `| [${cleanTitle}](https://www.codewars.com/kata/${kataData.slug}) | ${rank} | ${lang} | [Solution](${filePath}) | ${date} |`;

    const tableHeader = `
| ⚡ Problem | 🥋 Difficulty | 🛠️ Language | 📜 Solution | 📅 Date |
| :--- | :--- | :--- | :--- | :--- |`;

    if (!content) {
        content = `# 🛡️ Kata-Sync

![Codewars](https://img.shields.io/badge/Codewars-B1361E?style=for-the-badge&logo=codewars&logoColor=white)
![Auto-Sync](https://img.shields.io/badge/Sync-Automated-brightgreen?style=for-the-badge)

Welcome! This repository is automatically updated with my solutions to various algorithmic problems on [Codewars](https://www.codewars.com).

## 🚀 Solved Problems
${tableHeader}
${newRow}
`;
    } else {
        if (content.includes('| :--- |')) {
            content += `\n${newRow}`;
        } else {
            content += `\n\n## 🚀 Solved Problems\n${tableHeader}\n${newRow}\n`;
        }
    }

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

function sanitizeFilename(str) {
    if (!str) return 'unknown';
    return str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function encodeBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}

function decodeBase64(str) {
    const cleanStr = str.replace(/\n/g, '');
    return decodeURIComponent(escape(atob(cleanStr)));
}
