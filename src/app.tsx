import { ZUN_LINKS } from './zundb';

// --- DATA INTERFACES ---
interface TouhouName { language: string; value: string; }
interface TouhouPV { id: number; service: string; url: string; }
interface TouhouArtistEntry { categories: string; artist?: { id: number; name: string; artistType: string; } }
interface TouhouAlbum { name: string; id: number; }
interface TouhouSong {
    id: number; name: string; songType: "Original" | "Arrangement"; originalVersionId?: number;
    names?: TouhouName[]; pvs?: TouhouPV[]; artists?: TouhouArtistEntry[]; albums?: TouhouAlbum[];
}
interface CharacterInfo {
    name: string;
    iconUrl: string;
    popupUrl: string;
}

/** Minimal Spotify track metadata used for matching. */
interface SongMetadata {
    title?: string;
    artist_name?: string;
    album_title?: string;
}

// --- CONSTANTS ---
const RIGHT_BAR_SELECTOR = ".main-nowPlayingBar-right";
const UI_POLL_MS = 100;
const STRICT_ORIGINAL_ARTISTS = ["ZUN", "上海アリス幻樂団"] as const;
const MATCH_SCORE_STRICT_ORIGINAL = 50;
const MATCH_SCORE_ARTIST = 5;
const MATCH_SCORE_ALBUM = 10;
const TITLE_TAGS_TO_STRIP = ["Remaster", "2021 ver", "Instrumental", "feat.", "Original Mix"];

// Global state (used by UI and song-change handler)
let currentMatch: TouhouSong | null = null;
let currentOriginal: TouhouSong | null = null;
let originalSpotifyLink: string | null = null;

async function main() {
    injectStyles();

    while (!document.querySelector(RIGHT_BAR_SELECTOR)) {
        await new Promise(resolve => setTimeout(resolve, UI_POLL_MS));
    }
    console.log("TohoInfo: UI Ready.");

    Spicetify.Player.addEventListener("songchange", async () => {
        const metadata = Spicetify.Player.data.item.metadata;
        if (!metadata || !metadata.title) { updateUI(null); return; }
        await checkSong(metadata);
    });

    const currentMeta = Spicetify.Player.data.item.metadata;
    if (currentMeta) checkSong(currentMeta);
}

// ---------------------------------------------------------
// UI MANAGEMENT
// ---------------------------------------------------------

function injectStyles() {
    if (document.getElementById("toho-info-style")) return;

    const style = document.createElement("style");
    style.id = "toho-info-style";
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
            width: 42px;
            height: 42px;
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
            width: 38px; height: 38px;
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

function updateUI(data: { main: string; sub: string; hasOriginalLink: boolean; charInfo?: CharacterInfo } | null) {
    const rightBar = document.querySelector(RIGHT_BAR_SELECTOR);
    if (!rightBar) return;

    let container = document.getElementById("toho-info-container");
    if (!container) {
        container = document.createElement("div"); 
        container.id = "toho-info-container";
        container.onclick = () => showTouhouDBModal(); 
        
        const iconImg = document.createElement("img");
        iconImg.id = "toho-icon-img";
        const iconText = document.createElement("div");
        iconText.id = "toho-icon-text";
        iconText.innerText = "⛩️";

        const card = document.createElement("div");
        card.id = "toho-hover-card";
        card.onclick = (e) => e.stopPropagation(); 

        container.appendChild(iconImg);
        container.appendChild(iconText);
        container.appendChild(card);
        
        rightBar.insertBefore(container, rightBar.firstChild);
    }

    if (!data) {
        container.style.display = "none";
        return;
    }
    container.style.display = "flex";

    // --- ICON LOGIC ---
    const iconImg = document.getElementById("toho-icon-img") as HTMLImageElement;
    const iconText = document.getElementById("toho-icon-text");
    
    if (data.charInfo && iconImg && iconText) {
        iconImg.src = data.charInfo.iconUrl; 
        iconImg.style.display = "block";
        iconText.style.display = "none";
    } else if (iconImg && iconText) {
        iconImg.style.display = "none";
        iconText.style.display = "block";
    }

    // --- HOVER CARD CONTENT ---
    const card = document.getElementById("toho-hover-card");
    if (card) {
        let html = "";
        
        if (data.charInfo) {
            html += `<img src="${data.charInfo.popupUrl}" class="toho-card-hero-img" />`;
        }

        html += `<div class="toho-card-content">`;
        html += `
            <div class="toho-card-title">${data.main}</div>
            ${data.sub ? `<div class="toho-card-sub">${data.sub}</div>` : ""}
            <div class="toho-card-sub" style="font-size: 0.7rem; opacity: 0.7; margin-top:4px;">(Click icon for info)</div>
        `;

        if (data.hasOriginalLink) {
            html += `
                <div class="toho-card-sep"></div>
                <div id="toho-card-spotify-btn" class="toho-card-btn">
                    <svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.48.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                    <span>Play Original</span>
                </div>
            `;
        }
        
        html += `</div>`; 
        card.innerHTML = html;

        const btn = document.getElementById("toho-card-spotify-btn");
        if (btn) btn.onclick = (e) => { e.stopPropagation(); openOriginalSpotify(); };
    }
}

// ---------------------------------------------------------
// LOGIC
// ---------------------------------------------------------

async function checkSong(metadata: SongMetadata) {
    updateUI({ main: "Searching...", sub: "...", hasOriginalLink: false });

    currentMatch = null;
    currentOriginal = null;
    originalSpotifyLink = null;

    const artistName = metadata.artist_name ?? "";
    const isStrictlyOriginal = STRICT_ORIGINAL_ARTISTS.includes(artistName as typeof STRICT_ORIGINAL_ARTISTS[number]);

    const cleanTitle = getCleanTitle(metadata.title);
    const candidates = await searchTouhouDB(cleanTitle);

    if (candidates.length === 0) {
        updateUI(null); 
        return;
    }

    const match = findBestMatch(candidates, metadata, isStrictlyOriginal);
    currentMatch = match;

    let mainText = "";
    let subText = "";
    let hasLink = false;
    let charInfo: CharacterInfo | undefined = undefined;
    let sourceSongForChar = match;

    if (match.songType === "Original") {
        if (isStrictlyOriginal) {
            mainText = `Original: ${match.name}`;
            subText = getEnglishName(match);
        } else {
            mainText = `Arrangement of: ${match.name}`;
            subText = getEnglishName(match);
            currentOriginal = match;
            if (ZUN_LINKS[match.id]) {
                originalSpotifyLink = ZUN_LINKS[match.id];
                hasLink = true;
            } else {
                const fullOrig = await fetchOriginalSong(match.id);
                const link = fullOrig ? getSpotifyLinkFromSong(fullOrig) : null;
                if (link) {
                    originalSpotifyLink = link;
                    hasLink = true;
                }
            }
        }
    } else if (match.songType === "Arrangement" && match.originalVersionId) {
        const linkFromZun = ZUN_LINKS[match.originalVersionId];
        if (linkFromZun) {
            originalSpotifyLink = linkFromZun;
            hasLink = true;
        }
        const original = await fetchOriginalSong(match.originalVersionId);
        if (original) {
            currentOriginal = original;
            sourceSongForChar = original;
            mainText = `Arrangement of: ${original.name}`;
            subText = getEnglishName(original);
            if (!hasLink) {
                const link = getSpotifyLinkFromSong(original);
                if (link) {
                    originalSpotifyLink = link;
                    hasLink = true;
                }
            }
        } else {
            mainText = `Arrangement of ID #${match.originalVersionId}`;
        }
    } else {
        mainText = `Touhou: ${match.name}`;
        subText = getEnglishName(match);
    }

    if (sourceSongForChar && sourceSongForChar.artists) {
        const charArtist = sourceSongForChar.artists.find(a => 
            a.categories === "Subject" || (a.artist && a.artist.artistType === "Character")
        );
        if (charArtist && charArtist.artist) {
            const imgs = await fetchCharacterImage(charArtist.artist.id);
            if (imgs) {
                charInfo = { 
                    name: charArtist.artist.name, 
                    iconUrl: imgs.icon,
                    popupUrl: imgs.popup
                };
            }
        }
    }

    if (!subText || subText === match.name || mainText.includes(subText)) subText = ""; 
    updateUI({ main: mainText, sub: subText, hasOriginalLink: hasLink, charInfo });
}

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------

function getSpotifyLinkFromSong(song: TouhouSong): string | null {
    const pv = song.pvs?.find(p => p.service === "Spotify");
    return pv?.url ?? null;
}

async function fetchCharacterImage(artistId: number): Promise<{ icon: string; popup: string } | null> {
    const url = `https://touhoudb.com/api/artists/${artistId}?fields=MainPicture`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        
        if (data.mainPicture) {
            return {
                icon: data.mainPicture.urlSmallThumb || data.mainPicture.urlTinyThumb || data.mainPicture.urlThumb,
                popup: data.mainPicture.urlThumb || data.mainPicture.urlOriginal
            };
        }
    } catch (err) { console.error(err); }
    return null;
}

function findBestMatch(candidates: TouhouSong[], meta: SongMetadata, isStrictlyOriginal: boolean): TouhouSong {
    if (!candidates?.length) throw new Error("findBestMatch requires at least one candidate");
    if (candidates.length === 1) return candidates[0];

    let bestScore = -1;
    let bestMatch = candidates[0];
    const spArtist = (meta.artist_name ?? "").toLowerCase();
    const spAlbum = (meta.album_title ?? "").toLowerCase();

    for (const song of candidates) {
        let score = 0;
        if (isStrictlyOriginal && song.songType === "Original") {
            score += MATCH_SCORE_STRICT_ORIGINAL;
        }
        if (song.artists) {
            for (const artistEntry of song.artists) {
                if (artistEntry?.artist?.name) {
                    const dbArtist = artistEntry.artist.name.toLowerCase();
                    if (spArtist.includes(dbArtist)) score += MATCH_SCORE_ARTIST;
                }
            }
        }
        if (song.albums) {
            for (const album of song.albums) {
                if (album?.name) {
                    const dbAlbum = album.name.toLowerCase();
                    if (spAlbum.includes(dbAlbum) || dbAlbum.includes(spAlbum)) score += MATCH_SCORE_ALBUM;
                }
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = song;
        }
    }
    return bestMatch;
}

function getEnglishName(song: TouhouSong): string {
    if (!song.names) return "";
    const en = song.names.find(n => n.language === "English");
    return en ? en.value : "";
}

function getCleanTitle(rawTitle: string): string {
    let title = rawTitle.normalize("NFKC");
    title = title.replace(/[\(\[][^\)\]]*[\)\]]/g, "");
    for (const tag of TITLE_TAGS_TO_STRIP) {
        title = title.replace(new RegExp(tag, "gi"), "");
    }
    return title.trim();
}

async function searchTouhouDB(cleanTitle: string): Promise<TouhouSong[]> {
    const query = encodeURIComponent(cleanTitle);
    const url = `https://touhoudb.com/api/songs?query=${query}&fields=Tags,Names,Artists,Albums`;
    try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        if (data.items) return data.items as TouhouSong[];
    } catch (err) { console.error(err); }
    return [];
}

async function fetchOriginalSong(id: number): Promise<TouhouSong | null> {
    const url = `https://touhoudb.com/api/songs/${id}?fields=Tags,Names,PVs,Artists`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await res.json() as TouhouSong;
    } catch (err) { console.error(err); }
    return null;
}

function openOriginalSpotify() {
    if (originalSpotifyLink) Spicetify.Platform.History.push(parseSpotifyLink(originalSpotifyLink));
    else if (currentOriginal) {
        const query = `ZUN ${currentOriginal.name}`;
        Spicetify.Platform.History.push(`/search/${encodeURIComponent(query)}`);
    }
}
function parseSpotifyLink(link: string): string {
    try {
        if (link.startsWith("spotify:")) {
            const parts = link.split(":");
            if (parts.length > 2) return `/${parts[1]}/${parts[2]}`;
            return link;
        }
        if (link.includes("http")) { const url = new URL(link); return url.pathname; }
        return link; 
    } catch (e) { return link; }
}
function showTouhouDBModal() {
    if (!currentMatch) return;
    const url = `https://touhoudb.com/S/${currentMatch.id}`;
    const htmlContent = `
        <div style="display:flex; flex-direction:column; gap:10px; height:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin:0;">TouhouDB Browser</h2>
                <a href="${url}" target="_blank" style="color:var(--text-subdued);">Open in Browser ↗</a>
            </div>
            <div class="toho-iframe-container">
                <iframe src="${url}" width="100%" height="100%" frameborder="0"></iframe>
            </div>
        </div>
    `;
    Spicetify.PopupModal.display({ title: "Touhou Info", content: htmlContent, isLarge: true });
}

export default main;