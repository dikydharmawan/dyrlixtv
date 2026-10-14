package com.dyrlix.player.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Padanan `types/index.ts` `Channel`. */
@Serializable
data class Channel(
    val id: String,
    val name: String,
    val url: String,
    val logo: String? = null,
    val group: String? = null,
    val tvgId: String? = null,
    val isDemo: Boolean = false,
    val headers: Map<String, String>? = null,
)

/** Padanan `types/index.ts` `PlaylistType`. */
@Serializable
enum class PlaylistType {
    @SerialName("url")
    URL,

    @SerialName("content")
    CONTENT,
}

/** Padanan `types/index.ts` `Playlist`. */
@Serializable
data class Playlist(
    val id: String,
    val name: String,
    /** Kosong (`""`) untuk playlist bertipe `content`. */
    val url: String = "",
    val addedAt: Long,
    val type: PlaylistType = PlaylistType.URL,
    val content: String? = null,
    val channelCount: Int? = null,
)

/** Padanan `EpgProgramme` hasil `services/epg.ts`. */
data class EpgProgramme(
    val channelId: String,
    val start: Long,
    val stop: Long,
    val title: String,
    val description: String? = null,
)

/** Peta `normalizedChannelId -> daftar programme` (urut `start` naik). */
typealias EpgGuide = Map<String, List<EpgProgramme>>

/** Padanan `UpdateManifest` di `services/updateManager.ts`. */
@Serializable
data class UpdateManifest(
    val packageName: String? = null,
    val versionCode: Int,
    val versionName: String,
    val apkUrl: String,
    val notes: String? = null,
    val publishedAt: String? = null,
)

/** Padanan isi cache `@iptv_player/default_playlist:v3`. */
@Serializable
data class DefaultPlaylistCache(
    val channels: List<Channel>,
    val epgUrl: String? = null,
    val fetchedAt: Long,
)

/** Hasil `loadDefaultPlaylist` (cache/fetch/fallback). */
data class DefaultPlaylistData(
    val channels: List<Channel>,
    val epgUrl: String?,
)

/** Padanan `services/playlistLoader.ts` `PlaylistData`. */
data class PlaylistData(
    val channels: List<Channel>,
    val epgUrl: String?,
)
