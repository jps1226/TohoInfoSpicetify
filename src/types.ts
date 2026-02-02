/**
 * Type definitions for TohoInfo extension.
 */

export interface SongName {
    language: string;
    value: string;
}

export interface Artist {
    id: number;
    name: string;
    artistType?: string;
}

export interface ArtistEntry {
    artist?: Artist;
    categories?: string;
}

export interface Album {
    name: string;
}

export interface PV {
    service: string;
    url: string;
}

export interface TouhouSong {
    id: number;
    name: string;
    songType: 'Original' | 'Arrangement';
    originalVersionId?: number;
    names?: SongName[];
    artists?: ArtistEntry[];
    albums?: Album[];
    pvs?: PV[];
}

export interface SongMetadata {
    title?: string;
    artist_name?: string;
    album_title?: string;
}

export interface CharacterInfo {
    name: string;
    iconUrl: string;
    popupUrl: string;
}

export interface UICardData {
    main: string;
    sub?: string;
    hasOriginalLink: boolean;
    charInfo?: CharacterInfo;
}
