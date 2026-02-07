chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_KATA_DATA') {
        const data = extractKataData();
        sendResponse(data);
    }
});

function extractKataData() {
    try {
        const urlPath = window.location.pathname.split('/');
        const kataIndex = urlPath.indexOf('kata');
        let slug = (kataIndex !== -1 && urlPath[kataIndex + 1]) ? urlPath[kataIndex + 1] : 'unknown-kata';

        let language = 'unknown';
        const trainIndex = urlPath.indexOf('train');
        const solIndex = urlPath.indexOf('solutions');

        if (trainIndex !== -1 && urlPath[trainIndex + 1]) {
            language = urlPath[trainIndex + 1];
        } else if (solIndex !== -1 && urlPath[solIndex + 1]) {
            language = urlPath[solIndex + 1];
        } else {
            const langSelector = document.querySelector('#language_dd .active');
            if (langSelector) language = langSelector.textContent.trim().toLowerCase();
        }

        let title = document.title.split('|')[0].trim();
        const titleHeader = document.querySelector('h4.ml-2.mb-3');
        if (titleHeader) title = titleHeader.textContent.trim();

        let rank = 'unknown-rank';
        const rankBadge = document.querySelector('.inner-small-hex');
        if (rankBadge) {
            rank = rankBadge.textContent.replace('kyu', '').trim() + ' kyu';
        } else {
            const rankTag = document.querySelector('div.tag');
            if (rankTag && rankTag.textContent.includes('kyu')) {
                rank = rankTag.textContent.trim();
            }
        }

        rank = rank.replace(/\s+/g, '-').toLowerCase();

        let code = '';
        const codeMirrorLines = document.querySelectorAll('.CodeMirror-code .CodeMirror-line');
        if (codeMirrorLines.length > 0) {
            code = Array.from(codeMirrorLines).map(line => {
                return line.textContent;
            }).join('\n');
        }

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

function setupAutoSync() {
    console.log('Kata-Sync: Listening for Submit...');

    // Use Capture Phase (true) to catch the event before Codewars/jQuery stops it.
    document.addEventListener('click', (event) => {
        const target = event.target;
        const btn = target.closest('#submit_btn, [data-action="finalize"]');

        if (btn) {
            console.log('Kata-Sync: Submit detected on', btn.id);

            // Extract immediately
            setTimeout(() => {
                const data = extractKataData();
                if (data && data.code) {
                    console.log('Kata-Sync: Sending payload...');
                    chrome.runtime.sendMessage({
                        action: 'AUTO_SYNC_TRIGGERED',
                        kataData: data
                    });
                } else {
                    console.warn('Kata-Sync: data extraction failed');
                }
            }, 50);
        }
    }, true);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoSync);
} else {
    setupAutoSync();
}