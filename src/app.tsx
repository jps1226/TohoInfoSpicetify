/**
 * TohoInfo: Touhou song metadata and character info in the Spotify bar.
 * Entry point wires UI, API, matching, and Spotify navigation.
 */
import type { CharacterInfo, SongMetadata, TouhouSong } from './types';
import { searchTouhouDB, fetchOriginalSong, fetchCharacterImage } from './api';
import { ZUN_LINKS } from './links';
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
        if (!metadata?.title) {
            updateUI(null);
            return;
        }
        await checkSong(metadata as SongMetadata);
    });

    const currentMeta = Spicetify.Player.data.item?.metadata;
    if (currentMeta) checkSong(currentMeta as SongMetadata);
}

async function checkSong(metadata: SongMetadata) {
    updateUI(UI_MESSAGES.SEARCHING, getCallbacks());

    currentMatch = null;
    currentOriginal = null;
    originalSpotifyLink = null;

    try {
        const isStrictlyOriginal = isStrictlyOriginalArtist(
            metadata.artist_name ?? ''
        );
        const cleanTitle = getCleanTitle(metadata.title ?? '');
        const candidates = await searchTouhouDB(cleanTitle);

        if (candidates.length === 0) {
            updateUI(null);
            return;
        }

        const match = findBestMatch(candidates, metadata, isStrictlyOriginal);
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

        if (
            !subText ||
            subText === match.name ||
            mainText.includes(subText)
        ) {
            subText = '';
        }
        updateUI(
            { main: mainText, sub: subText, hasOriginalLink: hasLink, charInfo },
            getCallbacks()
        );
    } catch (err) {
        console.error('TohoInfo: checkSong failed', err);
        updateUI(UI_MESSAGES.ERROR, getCallbacks());
    }
}

export default main;
