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
    console.log('getCleanTitle: start', { rawTitle, normalized: title });
    
    // Remove parenthetical content (game titles, etc.)
    title = title.replace(/[\(\[][^\)\]]*[\)\]]/g, '');
    console.log('getCleanTitle: after parens removal', { title });
    
    // Remove stage boss descriptions (e.g., "-5面ボス・クラウンピース" or "- 5th Stage Boss - Clownpiece")
    title = title.replace(/-[\s　]*[0-9０-９]*[\s　]*面[\s　]*ボス[^\s　-]*/g, '');
    title = title.replace(/-[\s　]*(?:[0-9]+(?:st|nd|rd|th)?[\s　]*)?(?:stage[\s　]*)?(?:boss)?[^\s　-]*/gi, '');
    console.log('getCleanTitle: after stage removal', { title });
    
    for (const tag of TITLE_TAGS_TO_STRIP) {
        title = title.replace(new RegExp(tag, 'gi'), '');
    }
    // Remove arrangement terms - use word boundaries and handle no-space cases
    title = title.replace(/VIOLIN[\s]*ROCK/gi, ' ');
    title = title.replace(/VIOLINROCK/gi, ' ');
    title = title.replace(/VIOLIN/gi, ' ');
    title = title.replace(/ROCK/gi, ' ');
    title = title.replace(/バイオリンロック/gi, ' ');
    title = title.replace(/バイオリン/gi, ' ');
    title = title.replace(/REMIX/gi, ' ');
    title = title.replace(/ARRANGE/gi, ' ');
    console.log('getCleanTitle: after term removal', { title });
    // Collapse multiple spaces/full-width spaces and trim
    title = title.replace(/[\s　]+/g, ' ');
    const result = title.trim();
    console.log('getCleanTitle: final', { result });
    return result;
}

export function getSpotifyLinkFromSong(song: TouhouSong): string | null {
    const pv = song.pvs?.find((p) => p.service === 'Spotify');
    return pv?.url ?? null;
}

export function isStrictlyOriginalArtist(
    artistName: string,
    title?: string,
    album?: string,
    metadata?: any
): boolean {
    console.log('isStrictlyOriginalArtist called', { artistName, title, album, hasMetadata: !!metadata });
    
    // Quick rejection: if main artist is NOT ZUN/上海アリス幻樂団, not original
    if (!STRICT_ORIGINAL_ARTISTS.includes(artistName as (typeof STRICT_ORIGINAL_ARTISTS)[number])) {
        console.log('isStrictlyOriginalArtist: artist not strict original', { artistName });
        return false;
    }

    // ARRANGEMENT KEYWORD CHECK: if title/album contains common arrangement markers, not original
    const combined = `${title ?? ''} ${album ?? ''}`.toLowerCase();
    console.log('isStrictlyOriginalArtist: checking keywords', { combined });
    const ARRANGEMENT_KEYWORDS = [
        'violin',
        'バイオリン',
        'remix',
        'arrang',
        'orchestra',
        'cover',
        'rework',
        'tribute',
        'mix',
        'tamusic',
    ];
    for (const kw of ARRANGEMENT_KEYWORDS) {
        if (combined.includes(kw)) {
            console.log('isStrictlyOriginalArtist: keyword matched', { kw });
            return false;
        }
    }

    // SECONDARY ARTIST CHECK: explicitly check for known secondary artist fields
    if (metadata && typeof metadata === 'object') {
        console.log('isStrictlyOriginalArtist: checking metadata for secondary artists');
        const secondaryArtistKeys = ['artist_name:1', 'artist_name1', 'artist_name_1', 'artist_name2', 'artist_name:2'];
        for (const key of secondaryArtistKeys) {
            const secondaryArtist = String(metadata[key] ?? '').trim();
            console.log('isStrictlyOriginalArtist: checking key', { key, value: secondaryArtist });
            if (secondaryArtist && !STRICT_ORIGINAL_ARTISTS.some(s => s.toLowerCase() === secondaryArtist.toLowerCase())) {
                console.log('isStrictlyOriginalArtist: secondary artist found and is not strict', { key, secondaryArtist });
                return false;
            }
        }
    } else {
        console.log('isStrictlyOriginalArtist: no metadata object');
    }

    console.log('isStrictlyOriginalArtist: returning true (is strict original)');
    return true;
}
