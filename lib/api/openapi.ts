export interface paths {
    "/": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Root */
        get: operations["root__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/playlist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Playlist */
        get: operations["get_playlist_api_playlist_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/playlist-with-rekordbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Playlist With Rekordbox
         * @description JSON で Rekordbox XML のパスを受け取る版（ローカル用）。
         *     {
         *       "url": "...",
         *       "rekordbox_xml_path": "/Users/xxx/Desktop/rekordbox_collection.xml"
         *     }
         */
        post: operations["playlist_with_rekordbox_api_playlist_with_rekordbox_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/match-snapshot-with-xml": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Match Snapshot With Xml
         * @description 与えられた PlaylistSnapshotV1（JSON）に対して、Rekordbox XML を用いて owned/owned_reason を付与して返す。
         *     URL の再入力は不要。
         *
         *     制限：
         *     - snapshot: 最大 1MB
         *     - XML: MAX_UPLOAD_SIZE（環境変数、デフォルト 50MB）
         */
        post: operations["match_snapshot_with_xml_api_match_snapshot_with_xml_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/playlist-with-rekordbox-upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Playlist With Rekordbox Upload
         * @description フロントからの XML ファイルアップロード版。
         *     - フロントは multipart/form-data で url と file を送る。
         *     - アップロードされた XML を一時ファイルに保存し、Rekordbox 突き合わせ。
         */
        post: operations["playlist_with_rekordbox_upload_api_playlist_with_rekordbox_upload_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** Body_match_snapshot_with_xml_api_match_snapshot_with_xml_post */
        Body_match_snapshot_with_xml_api_match_snapshot_with_xml_post: {
            /**
             * Snapshot
             * @description PlaylistSnapshotV1 JSON string
             */
            snapshot: string;
            /**
             * File
             * @description Rekordbox collection XML
             */
            file: string | null;
        };
        /** Body_playlist_with_rekordbox_upload_api_playlist_with_rekordbox_upload_post */
        Body_playlist_with_rekordbox_upload_api_playlist_with_rekordbox_upload_post: {
            /**
             * Url
             * @description Playlist URL or ID or URL
             */
            url: string;
            /**
             * Source
             * @description spotify or apple
             * @default spotify
             */
            source: string;
            /**
             * Apple Mode
             * @description auto|fast|legacy (Apple only)
             * @default auto
             */
            apple_mode: string;
            /**
             * File
             * @description Rekordbox collection XML
             */
            file?: string | null;
            /**
             * Enrich Spotify
             * @description For Apple: 1 to enrich via Spotify, 0 to skip (default 0 for apple)
             */
            enrich_spotify?: number | null;
            /**
             * Refresh
             * @description Bypass cache when set to 1
             */
            refresh?: number | null;
        };
        /** HTTPValidationError */
        HTTPValidationError: {
            /** Detail */
            detail?: components["schemas"]["ValidationError"][];
        };
        /** PlaylistMetaModel */
        PlaylistMetaModel: {
            /** Cache Hit */
            cache_hit?: boolean | null;
            /** Cache Ttl S */
            cache_ttl_s?: number | null;
            /** Refresh */
            refresh?: number | null;
            /** Fetch Ms */
            fetch_ms?: number | null;
            /** Enrich Ms */
            enrich_ms?: number | null;
            /** Total Backend Ms */
            total_backend_ms?: number | null;
            /** Total Api Ms */
            total_api_ms?: number | null;
            /** Apple Strategy */
            apple_strategy?: string | null;
            /** Apple Mode */
            apple_mode?: string | null;
            /** Apple Legacy Used */
            apple_legacy_used?: boolean | null;
            /** Apple Enrich Skipped */
            apple_enrich_skipped?: boolean | null;
            /** Reason */
            reason?: string | null;
            /** Seen Catalog Playlist Api */
            seen_catalog_playlist_api?: boolean | null;
            /** Apple Api Candidates */
            apple_api_candidates?: unknown[] | null;
            /** Apple Response Candidates */
            apple_response_candidates?: unknown[] | null;
            /** Apple Request Candidates */
            apple_request_candidates?: unknown[] | null;
            /** Apple Xhr Fetch Requests */
            apple_xhr_fetch_requests?: unknown[] | null;
            /** Json Responses Any Domain */
            json_responses_any_domain?: unknown[] | null;
            /** Apple Console Errors */
            apple_console_errors?: unknown[] | null;
            /** Apple Page Errors */
            apple_page_errors?: unknown[] | null;
            /** Apple Page Title */
            apple_page_title?: string | null;
            /** Apple Html Snippet */
            apple_html_snippet?: string | null;
            /** Blocked Hint */
            blocked_hint?: boolean | null;
        } & {
            [key: string]: unknown;
        };
        /** PlaylistResponse */
        PlaylistResponse: {
            /** Playlist Id */
            playlist_id: string;
            /** Playlist Name */
            playlist_name: string;
            /** Playlist Url */
            playlist_url?: string | null;
            /** Tracks */
            tracks: components["schemas"]["TrackModel"][];
            meta?: components["schemas"]["PlaylistMetaModel"] | null;
        };
        /** PlaylistWithRekordboxBody */
        PlaylistWithRekordboxBody: {
            /** Url */
            url: string;
            /** Rekordbox Xml Path */
            rekordbox_xml_path: string;
            /**
             * Source
             * @default spotify
             */
            source: string | null;
        };
        /** StoreLinksModel */
        StoreLinksModel: {
            /** Beatport */
            beatport?: string | null;
            /** Bandcamp */
            bandcamp?: string | null;
            /** Itunes */
            itunes?: string | null;
        };
        /** TrackModel */
        TrackModel: {
            /** Title */
            title: string;
            /** Artist */
            artist: string;
            /** Album */
            album?: string | null;
            /** Isrc */
            isrc?: string | null;
            /** Spotify Url */
            spotify_url?: string | null;
            /** Apple Url */
            apple_url?: string | null;
            links?: components["schemas"]["StoreLinksModel"] | null;
            /** Owned */
            owned?: boolean | null;
            /** Owned Reason */
            owned_reason?: string | null;
            /** Track Key Primary */
            track_key_primary?: string | null;
            /** Track Key Fallback */
            track_key_fallback?: string | null;
            /**
             * Track Key Primary Type
             * @default norm
             * @enum {string}
             */
            track_key_primary_type: "isrc" | "norm";
            /**
             * Track Key Version
             * @default v1
             */
            track_key_version: string;
        };
        /** ValidationError */
        ValidationError: {
            /** Location */
            loc: (string | number)[];
            /** Message */
            msg: string;
            /** Error Type */
            type: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    root__get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    get_playlist_api_playlist_get: {
        parameters: {
            query: {
                /** @description Playlist URL or ID or URL */
                url: string;
                /** @description spotify or apple */
                source?: string;
                /** @description auto|fast|legacy (Apple only) */
                apple_mode?: string;
                /** @description Fill missing ISRCs via MusicBrainz */
                enrich_isrc?: boolean;
                /** @description Max items to try enriching ISRC */
                isrc_limit?: number | null;
                /** @description For Apple: 1 to enrich via Spotify, 0 to skip (default 0 for apple) */
                enrich_spotify?: number | null;
                /** @description Bypass cache when set to 1 */
                refresh?: number | null;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlaylistResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    playlist_with_rekordbox_api_playlist_with_rekordbox_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PlaylistWithRekordboxBody"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlaylistResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    match_snapshot_with_xml_api_match_snapshot_with_xml_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_match_snapshot_with_xml_api_match_snapshot_with_xml_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
    playlist_with_rekordbox_upload_api_playlist_with_rekordbox_upload_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "multipart/form-data": components["schemas"]["Body_playlist_with_rekordbox_upload_api_playlist_with_rekordbox_upload_post"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PlaylistResponse"];
                };
            };
            /** @description Validation Error */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HTTPValidationError"];
                };
            };
        };
    };
}

