/** Spotify link parsing and navigation. */
import type { TouhouSong } from './types';

export function parseSpotifyLink(link: string): string {
    try {
        if (link.startsWith('spotify:')) {
            const parts = link.split(':');
            if (parts.length > 2) return `/${parts[1]}/${parts[2]}`;
            return link;
        }
        if (link.includes('http')) {
            const url = new URL(link);
            return url.pathname;
        }
        return link;
    } catch {
        return link;
    }
}

export function openOriginalSpotify(
    link: string | null,
    currentOriginal: TouhouSong | null
): void {
    if (link) {
        Spicetify.Platform.History.push(parseSpotifyLink(link));
    } else if (currentOriginal) {
        const query = `ZUN ${currentOriginal.name}`;
        Spicetify.Platform.History.push(`/search/${encodeURIComponent(query)}`);
    }
}
