/**
 * content.js
 * Extracts data from the Codewars interface.
 */

// Listen for messages from Background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_KATA_DATA') {
        const data = extractKataData();
        sendResponse(data);
    }
});

function extractKataData() {
    try {
        // 1. Basic Page Info
        const urlPath = window.location.pathname.split('/');
        // Url format: /kata/{slug_or_id}/train/{language}
        // or /kata/{slug_or_id}/solutions/{language}
        // or /kata/{slug_or_id}

        // Find 'kata' index
        const kataIndex = urlPath.indexOf('kata');
        let slug = (kataIndex !== -1 && urlPath[kataIndex + 1]) ? urlPath[kataIndex + 1] : 'unknown-kata';

        // 2. Language
        // Try to get from URL first
        let language = 'unknown';
        const trainIndex = urlPath.indexOf('train');
        const solIndex = urlPath.indexOf('solutions');

        if (trainIndex !== -1 && urlPath[trainIndex + 1]) {
            language = urlPath[trainIndex + 1];
        } else if (solIndex !== -1 && urlPath[solIndex + 1]) {
            language = urlPath[solIndex + 1];
        } else {
            // Fallback: Try to find active language in UI
            const langSelector = document.querySelector('#language_dd .active');
            if (langSelector) language = langSelector.textContent.trim().toLowerCase();
        }

        // 3. Title
        // Usually H4 in the output panel or page title
        let title = document.title.split('|')[0].trim();
        // Try to be more specific if possible
        const titleHeader = document.querySelector('h4.ml-2.mb-3'); // Common in new UI
        if (titleHeader) title = titleHeader.textContent.trim();

        // 4. Rank/Difficulty (Kyu)
        let rank = 'unknown-rank';
        // Look for the bugde
        const rankBadge = document.querySelector('.inner-small-hex');
        if (rankBadge) {
            rank = rankBadge.textContent.replace('kyu', '').trim() + ' kyu';
        } else {
            // Try text search in header
            const headerText = document.body.textContent; // Expensive, limit scope
            // Refined check:
            const rankTag = document.querySelector('div.tag');
            if (rankTag && rankTag.textContent.includes('kyu')) {
                rank = rankTag.textContent.trim();
            }
        }

        // Normalize rank string "6 kyu" -> "6-kyu"
        rank = rank.replace(/\s+/g, '-').toLowerCase();

        // 5. Code Solution
        let code = '';

        // Strategy A: CodeMirror (Editor Mode)
        // We look for the visual lines in the DOM
        const codeMirrorLines = document.querySelectorAll('.CodeMirror-code .CodeMirror-line');
        if (codeMirrorLines.length > 0) {
            // CodeMirror renders lines as separate divs. 
            // We must handle Zero-width space usually at start (sometimes depends on themes)
            code = Array.from(codeMirrorLines).map(line => {
                // use textContent to get the raw text
                return line.textContent;
            }).join('\n');
        }

        // Strategy B: "My Solutions" (Solutions Mode)
        // If we are on the solutions page, we might look for the user's solution
        // This is harder as we need to identify *our* solution among others.
        // Generally the first sync logic is designed for "Train" view.
        // If code is empty and we are on solution page, warn user?
        // We'll stick to Editor extraction as primary for "Sync Current".

        // Cleanup Code
        // Remove potential zero-width chars if any (ASCII 8203)
        code = code.replace(/\u200B/g, '');

        return {
            title,
            slug,
            language,
            rank,
            code
        };

    } catch (err) {
        console.error('Extraction Error:', err);
        return null;
    }
}
// ==========================================
// Auto-Sync Feature
// ==========================================
function setupAutoSync() {
    // Observer to detect when the Submit button appears (it's dynamic)
    const observer = new MutationObserver((mutations) => {
        // Look for the submit button
        const submitBtn = document.getElementById('submit_btn');
        if (submitBtn && !submitBtn.dataset.hasSyncListener) {
            submitBtn.dataset.hasSyncListener = 'true';
            submitBtn.addEventListener('click', () => {
                console.log('Submit button clicked. Triggering Auto-Sync...');
                // Allow strict "Submit" action to proceed, then sync
                // We send message to background to start the process
                chrome.runtime.sendMessage({ action: 'AUTO_SYNC_TRIGGERED' });
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initialize Auto-Sync monitoring
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoSync);
} else {
    setupAutoSync();
}
