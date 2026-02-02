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
    // Remove common arrangement suffixes (e.g. "VIOLIN ROCK", "ROCK", "VIOLIN", Japanese equivalents)
    const SUFFIXES_TO_STRIP = ['VIOLIN ROCK', 'VIOLINROCK', 'VIOLIN', 'ROCK', 'バイオリンロック'];
    for (const s of SUFFIXES_TO_STRIP) {
        const re = new RegExp(`\\b${s}\\b`, 'gi');
        title = title.replace(re, '');
    }
    // Collapse multiple spaces and trim
    title = title.replace(/\s+/g, ' ');
    return title.trim();
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
    if (!STRICT_ORIGINAL_ARTISTS.includes(artistName as (typeof STRICT_ORIGINAL_ARTISTS)[number])) return false;

    // If Spotify metadata lists additional artist_name fields (e.g. 'artist_name:1'),
    // treat any non-strict artist in those fields as an indication this is an arrangement.
    if (metadata && typeof metadata === 'object') {
        try {
            const secondaryArtists: string[] = [];
            for (const k of Object.keys(metadata)) {
                // match keys like 'artist_name', 'artist_name:1', 'artist_name:2', etc.
                if (/^artist_name(?::\d+)?$/i.test(k)) {
                    const v = String((metadata as any)[k] ?? '').trim();
                    if (v) secondaryArtists.push(v);
                }
            }
            // If there are multiple artist_name fields and any is not a STRICT_ORIGINAL_ARTIST,
            // treat the track as non-original.
            if (secondaryArtists.length > 1) {
                for (const a of secondaryArtists) {
                    const isStrict = STRICT_ORIGINAL_ARTISTS.some((s) => s.toLowerCase() === a.toLowerCase());
                    if (!isStrict) {
                        console.debug('isStrictlyOriginalArtist -> false (secondary artist list)', { artistName, secondaryArtists });
                        return false;
                    }
                }
            }
            // Also if there's exactly one artist_name and it's not a strict original, treat as non-original
            if (secondaryArtists.length === 1) {
                const single = secondaryArtists[0];
                if (!STRICT_ORIGINAL_ARTISTS.some((s) => s.toLowerCase() === single.toLowerCase())) {
                    console.debug('isStrictlyOriginalArtist -> false (single artist_name non-strict)', { artistName, single });
                    return false;
                }
            }
        } catch (e) {
            // ignore metadata inspection errors
        }
    }

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
        // Japanese keywords commonly used on arrangement albums
        'バイオリン',
        'アレンジ',
        'アレンジメント',
        'リミックス',
        '編曲',
        'カバー',
        'ヴァージョン',
        'バージョン',
        'オーケストラ',
        // Known arranger/label patterns
        'tamusic',
    ];

    const reasons: string[] = [];

    for (const kw of ARRANGEMENT_KEYWORDS) {
        if (combined.includes(kw)) {
            reasons.push(`keyword:${kw}`);
        }
    }

    // If the artist field contains additional collaborators, don't assume original
    if (artistName.includes('&') || artistName.includes(',') || artistName.includes('/')) reasons.push('collab');

    // If album/title explicitly mentions a known arranger/label (like TAMUSIC), it's not an original
    if ((album ?? '').toLowerCase().includes('tamusic')) reasons.push('album:tamusic');

    // If any metadata field contains known arranger/label/publisher strings, treat as not original.
    let haystack = '';
    if (metadata) {
        try {
            haystack = JSON.stringify(metadata).toLowerCase();
        } catch (e) {
            haystack = '';
        }

        // If metadata contains additional artist_name fields (e.g. 'artist_name:1') prefer them
        try {
            for (const k of Object.keys(metadata)) {
                const lk = k.toLowerCase();
                if (lk.startsWith('artist_name') && lk !== 'artist_name') {
                    try {
                        const v = String((metadata as any)[k] ?? '').trim();
                        if (v) {
                            const isStrict = STRICT_ORIGINAL_ARTISTS.some((s) => s.toLowerCase() === v.toLowerCase());
                            if (!isStrict) {
                                reasons.push(`metadata_artist:${k}=${v}`);
                            }
                        }
                    } catch (e) {
                        // ignore per-key
                    }
                }
            }
        } catch (e) {
            // ignore
        }

        // Fallback: inspect all enumerable values for strings that mention known arranger labels/keywords
        try {
            const vals: string[] = [];
            for (const k of Object.keys(metadata)) {
                try {
                    const v = (metadata as any)[k];
                    if (typeof v === 'string') vals.push(v.toLowerCase());
                    else if (Array.isArray(v)) vals.push(...v.map((x) => String(x).toLowerCase()));
                    else if (v && typeof v === 'object') vals.push(JSON.stringify(v).toLowerCase());
                } catch (e) {
                    // ignore per-key errors
                }
            }
            const joined = vals.join(' ');
            if (joined.includes('tamusic')) reasons.push('metadata_values:tamusic');
            if (joined.includes('arrange') || joined.includes('編曲') || joined.includes('arranger')) reasons.push('metadata_values:arrange');
        } catch (e) {
            // ignore
        }
    }

    if (reasons.length > 0) {
        console.debug('isStrictlyOriginalArtist -> false', { artistName, title, album, reasons, haystackSample: haystack.slice(0, 400) });
        return false;
    }

    console.debug('isStrictlyOriginalArtist -> true', { artistName, title, album });
    return true;
}
