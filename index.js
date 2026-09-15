import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const STYLE_ID = 'doki-ui-styles';
let mutationObserver = null;

// Initialize default settings for doki-UI
if (!extension_settings.dokiUI) {
    extension_settings.dokiUI = {
        enabled: true,
        stickyAvatar: true,
        comicBubble: false,
        comicAlignLeft: false,
        comicDarkMode: false
    };
}

// Ensure properties exist on settings object
if (extension_settings.dokiUI.comicBubble === undefined) extension_settings.dokiUI.comicBubble = false;
if (extension_settings.dokiUI.comicAlignLeft === undefined) extension_settings.dokiUI.comicAlignLeft = false;
if (extension_settings.dokiUI.comicDarkMode === undefined) extension_settings.dokiUI.comicDarkMode = false;

// Function to parse a text node and wrap text inside double quotes with CSS tag spans
function parseTextNodeForQuotes(node) {
    const text = node.nodeValue;
    if (!text.includes('"')) return;

    // Matches text inside double quotes, ignoring quotes that are part of HTML markup
    const regex = /"([^"]+)"/g;
    if (regex.test(text)) {
        const parent = node.parentNode;
        if (!parent) return;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        regex.lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Text before the quote
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }

            // Hidden opening quote span
            const openQuote = document.createElement('span');
            openQuote.className = 'comic-quote-hide';
            openQuote.textContent = '"';
            fragment.appendChild(openQuote);

            // Comic bubble text span
            const bubble = document.createElement('span');
            bubble.className = 'comic-bubble';
            bubble.textContent = match[1];
            fragment.appendChild(bubble);

            // Hidden closing quote span
            const closeQuote = document.createElement('span');
            closeQuote.className = 'comic-quote-hide';
            closeQuote.textContent = '"';
            fragment.appendChild(closeQuote);

            lastIndex = regex.lastIndex;
        }

        // Remaining text
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }

        parent.replaceChild(fragment, node);
    }
}

// Walks through the DOM of an element to process text nodes
function processElementForQuotes(element) {
    if (!element) return;
    const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const textNodes = [];

    while (node = walk.nextNode()) {
        const parent = node.parentElement;
        if (parent) {
            // Skip processing within code tags, raw textareas, pre, or already processed tags
            if (parent.tagName === 'CODE' || parent.tagName === 'PRE' || 
                parent.closest('pre') || parent.closest('code') || 
                parent.classList.contains('comic-bubble') || parent.classList.contains('comic-quote-hide')) {
                continue;
            }
            textNodes.push(node);
        }
    }

    textNodes.forEach(node => parseTextNodeForQuotes(node));
}

// Process all existing messages
function processAllMessages() {
    $('.mes_text').each(function() {
        processElementForQuotes(this);
    });
}

// Monitor chat box changes to process new incoming messages dynamically
function startChatObserver() {
    if (mutationObserver) mutationObserver.disconnect();

    const chatEl = document.getElementById('chat');
    if (!chatEl) return;

    mutationObserver = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            for (let node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const mesTexts = node.querySelectorAll ? node.querySelectorAll('.mes_text') : [];
                    mesTexts.forEach(el => processElementForQuotes(el));
                    if (node.classList && node.classList.contains('mes_text')) {
                        processElementForQuotes(node);
                    }
                }
            }
        }
    });

    mutationObserver.observe(chatEl, { childList: true, subtree: true });
}

// Function to apply/remove CSS patches dynamically
function applyStyles() {
    $(`#${STYLE_ID}`).remove();

    if (!extension_settings.dokiUI.enabled) {
        console.debug('doki-UI: Disabled. CSS patches removed.');
        return;
    }

    let css = '';

    if (extension_settings.dokiUI.stickyAvatar) {
        css += `
            /* Sticky message avatar for long texts */
            .mesAvatarWrapper {
                position: sticky !important;
                top: 10px !important;
                align-self: flex-start !important;
                z-index: 5;
            }
        `;
    }

    // Comic speech bubble styles (or reset styles when disabled)
    if (extension_settings.dokiUI.comicBubble) {
        const alignment = extension_settings.dokiUI.comicAlignLeft ? 'left' : 'center';
        
        // Colors for Light vs Dark speech bubbles
        const bgColor = extension_settings.dokiUI.comicDarkMode ? 'black' : 'white';
        const textColor = extension_settings.dokiUI.comicDarkMode ? 'white' : 'black';
        const borderColor = extension_settings.dokiUI.comicDarkMode ? 'white' : 'black';
        const shadowColor = extension_settings.dokiUI.comicDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';

        css += `
            .comic-quote-hide {
                display: none !important;
            }
            .comic-bubble {
                display: inline-block !important;
                background-color: ${bgColor} !important;
                color: ${textColor} !important;
                border: 2px solid ${borderColor} !important;
                border-radius: 20px !important;
                padding: 6px 14px !important;
                margin: 4px 0 !important;
                box-shadow: 2px 2px 0px ${shadowColor} !important;
                font-weight: 500 !important;
                text-align: ${alignment} !important;
                font-family: inherit !important;
            }
        `;
    } else {
        css += `
            .comic-quote-hide {
                display: inline !important;
            }
            .comic-bubble {
                display: inline !important;
                background: transparent !important;
                color: inherit !important;
                border: none !important;
                border-radius: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                font-weight: inherit !important;
                text-align: inherit !important;
                font-family: inherit !important;
            }
        `;
    }

    if (css) {
        $('<style>')
            .attr('id', STYLE_ID)
            .text(css)
            .appendTo('head');
        console.debug('doki-UI: Enabled. CSS patches applied.');
    }
}

// Render Settings panel in SillyTavern UI
function renderDokiUI() {
    $('#doki_ui_enabled').prop('checked', extension_settings.dokiUI.enabled);
    $('#doki_ui_sticky_avatar').prop('checked', extension_settings.dokiUI.stickyAvatar);
    $('#doki_ui_comic_bubble').prop('checked', extension_settings.dokiUI.comicBubble);
    $('#doki_ui_comic_align_left').prop('checked', extension_settings.dokiUI.comicAlignLeft);
    $('#doki_ui_comic_dark_mode').prop('checked', extension_settings.dokiUI.comicDarkMode);
    
    // Toggle sub-options visibility depending on global state
    if (extension_settings.dokiUI.enabled) {
        $('.doki_ui_suboptions').slideDown(200);
    } else {
        $('.doki_ui_suboptions').slideUp(200);
    }
}

function setupUIHandlers() {
    $('#doki_ui_enabled').off('change').on('change', function() {
        extension_settings.dokiUI.enabled = $(this).prop('checked');
        saveSettingsDebounced();
        applyStyles();
        renderDokiUI();
    });

    $('#doki_ui_sticky_avatar').off('change').on('change', function() {
        extension_settings.dokiUI.stickyAvatar = $(this).prop('checked');
        saveSettingsDebounced();
        applyStyles();
    });

    $('#doki_ui_comic_bubble').off('change').on('change', function() {
        extension_settings.dokiUI.comicBubble = $(this).prop('checked');
        saveSettingsDebounced();
        applyStyles();
    });

    $('#doki_ui_comic_align_left').off('change').on('change', function() {
        extension_settings.dokiUI.comicAlignLeft = $(this).prop('checked');
        saveSettingsDebounced();
        applyStyles();
    });

    $('#doki_ui_comic_dark_mode').off('change').on('change', function() {
        extension_settings.dokiUI.comicDarkMode = $(this).prop('checked');
        saveSettingsDebounced();
        applyStyles();
    });
}

// Initializer
jQuery(() => {
    const container = $(document.getElementById('extensions_settings2') ?? document.getElementById('extensions_settings'));
    if (container.length === 0) return;

    const html = `
    <div class="doki_ui_settings" style="margin-bottom: 20px;">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>doki-UI Customizer</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content" style="display: none; padding: 10px;">
                <div class="doki_ui_description" style="margin-bottom: 10px; font-size: 0.95em; opacity: 0.9;">
                    Customize and patch the SillyTavern user interface dynamically without altering core files.
                </div>
                
                <label for="doki_ui_enabled" class="checkbox_label" style="display: flex; align-items: center; margin-bottom: 15px; font-weight: bold; cursor: pointer;">
                    <input type="checkbox" id="doki_ui_enabled" name="doki_ui_enabled" style="margin-right: 8px;">
                    Enable doki-UI Patches
                </label>
                
                <div class="doki_ui_suboptions" style="display: flex; flex-direction: column; gap: 10px; padding-left: 10px; border-left: 2px solid var(--SmartThemeBorderColor);">
                    <label for="doki_ui_sticky_avatar" class="checkbox_label" style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="doki_ui_sticky_avatar" name="doki_ui_sticky_avatar" style="margin-right: 8px;">
                        Sticky Chat Avatars (Follow scroll on long messages)
                    </label>
                    
                    <label for="doki_ui_comic_bubble" class="checkbox_label" style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="doki_ui_comic_bubble" name="doki_ui_comic_bubble" style="margin-right: 8px;">
                        Comic Speech Bubble (Wrap quotes in dialogue bubbles)
                    </label>
                    
                    <label for="doki_ui_comic_align_left" class="checkbox_label" style="display: flex; align-items: center; cursor: pointer; margin-left: 20px;">
                        <input type="checkbox" id="doki_ui_comic_align_left" name="doki_ui_comic_align_left" style="margin-right: 8px;">
                        Align bubble text to the Left (Default: Center)
                    </label>

                    <label for="doki_ui_comic_dark_mode" class="checkbox_label" style="display: flex; align-items: center; cursor: pointer; margin-left: 20px;">
                        <input type="checkbox" id="doki_ui_comic_dark_mode" name="doki_ui_comic_dark_mode" style="margin-right: 8px;">
                        Dark Mode for Speech Bubbles (Black background, white text)
                    </label>
                </div>
            </div>
        </div>
    </div>`;

    container.append(html);

    // Initial load, processing and style application
    processAllMessages();
    startChatObserver();
    applyStyles();
    renderDokiUI();
    setupUIHandlers();

    // Re-run parser on events and chat change
    const { eventSource, event_types } = SillyTavern.getContext();
    
    function processMessageById(messageId) {
        const el = document.querySelector(`[mesid="${messageId}"] .mes_text`);
        if (el) {
            processElementForQuotes(el);
        }
    }

    eventSource.on(event_types.CHAT_CHANGED, () => {
        processAllMessages();
        startChatObserver();
    });

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId) => {
        processMessageById(messageId);
    });

    eventSource.on(event_types.USER_MESSAGE_RENDERED, (messageId) => {
        processMessageById(messageId);
    });

    eventSource.on(event_types.MESSAGE_UPDATED, (messageId) => {
        processMessageById(messageId);
    });

    eventSource.on(event_types.MESSAGE_SWIPED, (messageId) => {
        processMessageById(messageId);
    });
});
