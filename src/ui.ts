/** UI: styles, hover card, modal, and update logic. */
import type { TouhouSong, UICardData } from './types';

const RIGHT_BAR_SELECTOR = '.main-nowPlayingBar-right';

export const UI_MESSAGES = {
    SEARCHING: { main: 'Searching...', sub: '...', hasOriginalLink: false },
    ERROR: {
        main: "Couldn't load Touhou info",
        sub: 'Try again later',
        hasOriginalLink: false,
    } as const,
} as const;

export type UICallbacks = {
    onPlayOriginal?: () => void;
    getCurrentMatch?: () => TouhouSong | null;
};

let lastCallbacks: UICallbacks | undefined;

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
    return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SPOTIFY_ICON_SVG =
    '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>';

/**
 * Builds the hover card HTML from card data (escapes text for safety).
 */
export function buildHoverCardHtml(data: NonNullable<UICardData>): string {
    const parts: string[] = [];
    if (data.charInfo) {
        parts.push(
            `<img src="${escapeAttr(data.charInfo.popupUrl)}" class="toho-card-hero-img" alt="" />`
        );
    }
    parts.push('<div class="toho-card-content">');
    parts.push(`<div class="toho-card-title">${escapeHtml(data.main)}</div>`);
    if (data.sub) {
        parts.push(`<div class="toho-card-sub">${escapeHtml(data.sub)}</div>`);
    }
    if (data.extra && data.extra.length > 0) {
        for (const info of data.extra) {
            parts.push(`<div class="toho-card-extra">${escapeHtml(info)}</div>`);
        }
    }
    parts.push(
        '<div class="toho-card-sub" style="font-size: 0.7rem; opacity: 0.7; margin-top:4px;">(Click icon for info)</div>'
    );
    if (data.hasOriginalLink) {
        parts.push('<div class="toho-card-sep"></div>');
        parts.push(
            `<div id="toho-card-spotify-btn" class="toho-card-btn">${SPOTIFY_ICON_SVG}<span>Play Original</span></div>`
        );
    }
    parts.push('</div>');
    return parts.join('');
}

export function injectStyles(): void {
    if (document.getElementById('toho-info-style')) return;

    const style = document.createElement('style');
    style.id = 'toho-info-style';
    style.innerHTML = `
        .main-nowPlayingBar-right {
            overflow: visible !important;
            display: flex !important;
            align-items: center !important;
        }

        #toho-info-container {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 64px;
            height: 64px;
            margin-right: 12px;
            margin-left: 12px;
            border-radius: 50%;
            background-color: rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.05);
            cursor: pointer;
            transition: all 0.2s;
            flex-shrink: 0;
            z-index: 100;
        }
        #toho-info-container:hover {
            background-color: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.4);
            transform: scale(1.05);
        }

        #toho-icon-img {
            width: 60px; height: 60px;
            border-radius: 50%;
            object-fit: cover;
            object-position: top center;
            display: none;
            border: 1px solid rgba(0,0,0,0.5);
        }
        #toho-icon-text {
            font-size: 24px;
            line-height: 1;
            display: none;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }

        #toho-hover-card {
            position: absolute;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            width: max-content;
            max-width: 400px;
            min-width: 250px;
            background-color: var(--spice-card);
            border: 1px solid var(--spice-button-disabled);
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s ease, visibility 0.2s;
            z-index: 9999;
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            gap: 12px;
            text-align: left;
            cursor: default;
        }

        #toho-info-container:hover #toho-hover-card,
        #toho-hover-card:hover {
            opacity: 1;
            visibility: visible;
        }

        #toho-hover-card::before { content: ""; position: absolute; top: 100%; left: 0; width: 100%; height: 20px; background: transparent; }
        #toho-hover-card::after { content: ""; position: absolute; top: 100%; left: 50%; margin-left: -6px; border-width: 6px; border-style: solid; border-color: var(--spice-card) transparent transparent transparent; }

        .toho-card-hero-img {
            width: 80px;
            height: 110px;
            object-fit: cover;
            object-position: top;
            border-radius: 4px;
            flex-shrink: 0;
            border: 1px solid rgba(255,255,255,0.1);
            background-color: rgba(0,0,0,0.3);
        }

        .toho-card-content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            flex: 1;
            min-width: 140px;
        }

        .toho-card-title { color: var(--spice-text); font-weight: bold; font-size: 0.95rem; line-height: 1.3; margin-bottom: 4px; }
        .toho-card-sub { color: var(--spice-subtext); font-size: 0.8rem; line-height: 1.2; }
        .toho-card-extra { color: var(--spice-subtext); font-size: 0.75rem; line-height: 1.2; font-style: italic; opacity: 0.85; }
        .toho-card-sep { height: 1px; background: var(--spice-button-disabled); margin: 8px 0; opacity: 0.3; }

        .toho-card-btn {
            display: flex; align-items: center; justify-content: center; gap: 6px;
            padding: 6px 10px; background: rgba(255,255,255,0.05); border-radius: 4px;
            cursor: pointer; font-size: 0.75rem; font-weight: bold; color: var(--spice-text);
            transition: background 0.2s;
            align-self: flex-start;
            width: 100%;
        }
        .toho-card-btn:hover { background: rgba(255,255,255,0.15); }
        .toho-card-btn svg { width: 16px; height: 16px; fill: #1DB954; }

        .toho-iframe-container { width: 100%; height: 60vh; border-radius: 8px; overflow: hidden; background: #fff; }
    `;
    document.head.appendChild(style);
}

export function updateUI(data: UICardData, callbacks?: UICallbacks): void {
    if (callbacks) lastCallbacks = callbacks;

    const rightBar = document.querySelector(RIGHT_BAR_SELECTOR);
    if (!rightBar) return;

    let container = document.getElementById('toho-info-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toho-info-container';
        container.onclick = () => showTouhouDBModal(lastCallbacks?.getCurrentMatch?.() ?? null);

        const iconImg = document.createElement('img');
        iconImg.id = 'toho-icon-img';
        const iconText = document.createElement('div');
        iconText.id = 'toho-icon-text';
        iconText.innerText = '⛩️';

        const card = document.createElement('div');
        card.id = 'toho-hover-card';
        card.onclick = (e) => e.stopPropagation();

        container.appendChild(iconImg);
        container.appendChild(iconText);
        container.appendChild(card);
        rightBar.insertBefore(container, rightBar.firstChild);
    }

    if (!data) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';

    const iconImg = document.getElementById('toho-icon-img') as HTMLImageElement | null;
    const iconText = document.getElementById('toho-icon-text');
    if (data.charInfo && iconImg && iconText) {
        iconImg.src = data.charInfo.iconUrl;
        iconImg.style.display = 'block';
        iconText.style.display = 'none';
    } else if (iconImg && iconText) {
        iconImg.style.display = 'none';
        iconText.style.display = 'block';
    }

    const card = document.getElementById('toho-hover-card');
    if (card) {
        card.innerHTML = buildHoverCardHtml(data);
        const btn = document.getElementById('toho-card-spotify-btn');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                lastCallbacks?.onPlayOriginal?.();
            };
        }
    }
}

export function showTouhouDBModal(match: TouhouSong | null): void {
    if (!match) return;
    const url = `https://touhoudb.com/S/${match.id}`;
    const htmlContent = `
        <div style="display:flex; flex-direction:column; gap:10px; height:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0;">TouhouDB Browser</h2>
                <a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" style="color:var(--text-subdued);">Open in Browser ↗</a>
            </div>
            <div class="toho-iframe-container">
                <iframe src="${url.replace(/"/g, '&quot;')}" width="100%" height="100%" frameborder="0" title="TouhouDB"></iframe>
            </div>
        </div>
    `;
    Spicetify.PopupModal.display({ title: 'Touhou Info', content: htmlContent, isLarge: true });
}

export { RIGHT_BAR_SELECTOR };
