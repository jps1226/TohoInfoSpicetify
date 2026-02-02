/**
 * API functions for interacting with TouhouDB.
 */
import type { TouhouSong } from './types';

/**
 * Search TouhouDB for songs matching the given query.
 */
export async function searchTouhouDB(query: string): Promise<TouhouSong[]> {
    const url = `https://touhoudb.com/api/songs?query=${encodeURIComponent(query)}&fields=Tags,Names,Artists,Albums`;
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        if (data.items) return data.items;
        return [];
    } catch (err) {
        console.error('TohoInfo: searchTouhouDB failed', err);
        return [];
    }
}

/**
 * Fetch a specific song by ID from TouhouDB.
 */
export async function fetchOriginalSong(id: number): Promise<TouhouSong | null> {
    const url = `https://touhoudb.com/api/songs/${id}?fields=Tags,Names,PVs,Artists`;
    try {
        const response = await fetch(url);
        return response.ok ? await response.json() : null;
    } catch (err) {
        console.error('TohoInfo: fetchOriginalSong failed', err);
        return null;
    }
}

/**
 * Fetch character image URLs for a given artist ID.
 */
export async function fetchCharacterImage(artistId: number): Promise<{ icon: string; popup: string } | null> {
    const url = `https://touhoudb.com/api/artists/${artistId}?fields=MainPicture`;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (data.mainPicture) {
            return {
                icon: data.mainPicture.urlSmallThumb || data.mainPicture.urlTinyThumb || data.mainPicture.urlThumb,
                popup: data.mainPicture.urlThumb || data.mainPicture.urlOriginal,
            };
        }
        return null;
    } catch (err) {
        console.error('TohoInfo: fetchCharacterImage failed', err);
        return null;
    }
}
