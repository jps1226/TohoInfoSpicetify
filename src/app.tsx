/**
 * TohoInfo: Touhou song metadata and character info in the Spotify bar.
 * Entry point wires UI, API, matching, and Spotify navigation.
 */
import type { CharacterInfo, SongMetadata, TouhouSong } from './types';
import { searchTouhouDB, fetchOriginalSong, fetchCharacterImage, fetchAlbumImage } from './api';
import { ZUN_LINKS } from './zundb';
import {
    findBestMatch,
    getEnglishName,
    getCleanTitle,
    getSpotifyLinkFromSong,
    isStrictlyOriginalArtist,
} from './matching';
import { openOriginalSpotify } from './spotify';
import {
    injectStyles,
    updateUI,
    UI_MESSAGES,
    RIGHT_BAR_SELECTOR,
    type UICallbacks,
} from './ui';

const UI_POLL_MS = 100;

/**
 * Extract stage/theme information from song tags.
 * Returns an array of stage/theme names from the "Themes" category with English translations.
 * Also includes album game title if available.
 * Character names take priority over stage numbers.
 */
function getGameAndStageInfo(song: TouhouSong): string[] {
    const extra: string[] = [];

    // Extract album/game name with game number preference
    if (song.albums && song.albums.length > 0) {
        const album = song.albums[0];
        if (album.additionalNames) {
            // additionalNames contains comma-separated aliases
            const names = album.additionalNames.split(',').map(n => n.trim());
            // Look for "TH0X" or "Touhou X" format
            let gameTitle = '';
            for (const name of names) {
                const thMatch = name.match(/TH(\d+)/);
                if (thMatch) {
                    gameTitle = `Touhou ${parseInt(thMatch[1])}`;
                    break;
                }
            }
            // Fallback: look for "Perfect Cherry Blossom" style name
            if (!gameTitle) {
                const englishName = names.find(n => n.includes('Perfect') || n.includes('Mystical'));
                if (englishName) {
                    gameTitle = englishName;
                }
            }
            if (gameTitle) {
                extra.push(gameTitle);
            }
        } else if (album.name) {
            extra.push(album.name);
        }
    }

    // Extract character name if available - takes priority over stage
    let hasCharacter = false;
    if (song.artists) {
        for (const artistEntry of song.artists) {
            if (
                (artistEntry.categories === 'Subject' || 
                 (artistEntry.artist && artistEntry.artist.artistType === 'Character'))
            ) {
                // Extract English name from additionalNames
                if (artistEntry.artist?.additionalNames) {
                    const names = artistEntry.artist.additionalNames.split(',').map(n => n.trim());
                    // First entry is usually English
                    if (names.length > 0 && names[0]) {
                        extra.push(names[0]);
                        hasCharacter = true;
                        break;
                    }
                }
            }
        }
    }

    // Extract stage/theme tags only if no character was found
    if (!hasCharacter && song.tags) {
        for (const songTag of song.tags) {
            if (songTag.tag.categoryName === 'Themes') {
                // additionalNames contains English translations separated by commas
                if (songTag.tag.additionalNames) {
                    const translations = songTag.tag.additionalNames.split(',').map(t => t.trim());
                    // Prefer translations with numbers (e.g., "2nd stage" over "second stage")
                    const english = translations.find(t => /\d/.test(t)) || translations[0];
                    if (english) {
                        extra.push(english);
                    }
                } else {
                    extra.push(songTag.tag.name);
                }
            }
        }
    }

    return extra;
}

// Global state (used by song-change handler and UI callbacks)
let currentMatch: TouhouSong | null = null;
let currentOriginal: TouhouSong | null = null;
let originalSpotifyLink: string | null = null;

function getCallbacks(): UICallbacks {
    return {
        onPlayOriginal: () =>
            openOriginalSpotify(originalSpotifyLink, currentOriginal),
        getCurrentMatch: () => currentMatch,
    };
}

async function main() {
    injectStyles();

    while (!document.querySelector(RIGHT_BAR_SELECTOR)) {
        await new Promise((resolve) => setTimeout(resolve, UI_POLL_MS));
    }
    console.log('TohoInfo: UI Ready.');

    Spicetify.Player.addEventListener('songchange', async () => {
        const metadata = Spicetify.Player.data.item?.metadata;
        console.log('TohoInfo: Song change detected', {
            title: metadata?.title,
            artist: metadata?.artist_name,
            album: metadata?.album_title,
            fullMetadata: metadata,
        });
        if (!metadata?.title) {
            console.log('TohoInfo: No metadata or title found, clearing UI');
            updateUI(null);
            return;
        }
        await checkSong(metadata as SongMetadata, metadata);
    });

    const currentMeta = Spicetify.Player.data.item?.metadata;
    if (currentMeta) {
        console.log('TohoInfo: Checking initial song', {
            title: currentMeta.title,
            artist: currentMeta.artist_name,
        });
        checkSong(currentMeta as SongMetadata, currentMeta);
    }
}

async function checkSong(metadata: SongMetadata, fullMetadata?: any) {
    console.log('TohoInfo: checkSong called', {
        title: metadata.title,
        artist: metadata.artist_name,
        album: metadata.album_title,
    });
    updateUI(UI_MESSAGES.SEARCHING, getCallbacks());

    currentMatch = null;
    currentOriginal = null;
    originalSpotifyLink = null;

    try {
        const isStrictlyOriginal = isStrictlyOriginalArtist(
            metadata.artist_name ?? '',
            metadata.title ?? '',
            metadata.album_title ?? '',
            fullMetadata ?? metadata
        );
        const cleanTitle = getCleanTitle(metadata.title ?? '');
        console.log('TohoInfo: Searching TouhouDB', {
            originalTitle: metadata.title,
            cleanTitle,
            isStrictlyOriginal,
            artist: metadata.artist_name,
        });
        const candidates = await searchTouhouDB(cleanTitle);
        console.log('TohoInfo: Search results', {
            cleanTitle,
            candidateCount: candidates.length,
            candidates: candidates.map((c: TouhouSong) => ({
                id: c.id,
                name: c.name,
                songType: c.songType,
            })),
        });

        if (candidates.length === 0) {
            console.log('TohoInfo: No candidates found for', cleanTitle);
            updateUI(null);
            return;
        }

        const match = findBestMatch(candidates, metadata, isStrictlyOriginal);
        console.log('TohoInfo: Best match', match ? {
            id: match.id,
            name: match.name,
            songType: match.songType,
            originalVersionId: match.originalVersionId,
        } : 'none');
        currentMatch = match;

        let mainText = '';
        let subText = '';
        let hasLink = false;
        let charInfo: CharacterInfo | undefined = undefined;
        let sourceSongForChar = match;

        if (match.songType === 'Original') {
            if (isStrictlyOriginal) {
                mainText = `Original: ${match.name}`;
                subText = getEnglishName(match);
            } else {
                mainText = `Arrangement of: ${match.name}`;
                subText = getEnglishName(match);
                currentOriginal = match;
                const link =
                    ZUN_LINKS[match.id] ??
                    (await fetchOriginalSong(match.id).then((s) =>
                        s ? getSpotifyLinkFromSong(s) : null
                    ));
                if (link) {
                    originalSpotifyLink = link;
                    hasLink = true;
                }
            }
        } else if (
            match.songType === 'Arrangement' &&
            match.originalVersionId != null
        ) {
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

        if (sourceSongForChar?.artists) {
            const charArtist = sourceSongForChar.artists.find(
                (a) =>
                    a.categories === 'Subject' ||
                    (a.artist && a.artist.artistType === 'Character')
            );
            if (charArtist?.artist) {
                const imgs = await fetchCharacterImage(charArtist.artist.id);
                if (imgs) {
                    charInfo = {
                        name: charArtist.artist.name,
                        iconUrl: imgs.icon,
                        popupUrl: imgs.popup,
                    };
                }
            }
        }

        // Fallback to album art if no character image found
        if (!charInfo && sourceSongForChar?.albums && sourceSongForChar.albums.length > 0) {
            const album = sourceSongForChar.albums[0];
            if (album.id) {
                const albumImgs = await fetchAlbumImage(album.id);
                if (albumImgs) {
                    charInfo = {
                        name: album.name,
                        iconUrl: albumImgs.icon,
                        popupUrl: albumImgs.popup,
                    };
                }
            }
        }

        if (
            !subText ||
            subText === match.name ||
            mainText.includes(subText)
        ) {
            subText = '';
        }

        // Use original song for game/stage info if available, otherwise use match
        const extra = getGameAndStageInfo(sourceSongForChar);
        updateUI(
            { main: mainText, sub: subText, extra: extra.length > 0 ? extra : undefined, hasOriginalLink: hasLink, charInfo },
            getCallbacks()
        );
    } catch (err) {
        console.error('TohoInfo: checkSong failed', err);
        updateUI(UI_MESSAGES.ERROR, getCallbacks());
    }
}

export default main;
