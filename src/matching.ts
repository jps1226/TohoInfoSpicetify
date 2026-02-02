/** Song matching and title/name helpers. */
import type { TouhouSong, SongMetadata } from './types';

const STRICT_ORIGINAL_ARTISTS = ['ZUN', '上海アリス幻樂団'] as const;
const MATCH_SCORE_STRICT_ORIGINAL = 50;
const MATCH_SCORE_ARTIST = 5;
const MATCH_SCORE_ALBUM = 10;
const TITLE_TAGS_TO_STRIP = [
    'Remaster',
    '2021 ver',
    'Instrumental',
    'feat.',
    'Original Mix',
];

export function findBestMatch(
    candidates: TouhouSong[],
    meta: SongMetadata,
    isStrictlyOriginal: boolean
): TouhouSong {
    if (!candidates?.length) throw new Error('findBestMatch requires at least one candidate');
    if (candidates.length === 1) return candidates[0];

    let bestScore = -1;
    let bestMatch = candidates[0];
    const spArtist = (meta.artist_name ?? '').toLowerCase();
    const spAlbum = (meta.album_title ?? '').toLowerCase();

    for (const song of candidates) {
        let score = 0;
        if (isStrictlyOriginal && song.songType === 'Original') {
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

export function getEnglishName(song: TouhouSong): string {
    if (!song.names) return '';
    const en = song.names.find((n) => n.language === 'English');
    return en ? en.value : '';
}

export function getCleanTitle(rawTitle: string): string {
    if (!rawTitle) return '';
    let title = rawTitle.normalize('NFKC');
    title = title.replace(/[\(\[][^\)\]]*[\)\]]/g, '');
    for (const tag of TITLE_TAGS_TO_STRIP) {
        title = title.replace(new RegExp(tag, 'gi'), '');
    }
    return title.trim();
}

export function getSpotifyLinkFromSong(song: TouhouSong): string | null {
    const pv = song.pvs?.find((p) => p.service === 'Spotify');
    return pv?.url ?? null;
}

export function isStrictlyOriginalArtist(
    artistName: string,
    title?: string,
    album?: string
): boolean {
    if (!STRICT_ORIGINAL_ARTISTS.includes(artistName as (typeof STRICT_ORIGINAL_ARTISTS)[number])) return false;

    const combined = `${title ?? ''} ${album ?? ''}`.toLowerCase();
    const ARRANGEMENT_KEYWORDS = [
        'violin',
        'remix',
        'arrang',
        'orchestra',
        'cover',
        'rework',
        'tribute',
        'mix',
        'version',
        'ver',
        'instrumental',
        'karaoke',
        'feat.',
        'feat',
    ];

    for (const kw of ARRANGEMENT_KEYWORDS) {
        if (combined.includes(kw)) return false;
    }

    // If the artist field contains additional collaborators, don't assume original
    if (artistName.includes('&') || artistName.includes(',') || artistName.includes('/')) return false;

    return true;
}
