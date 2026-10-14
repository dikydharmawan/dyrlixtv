package com.dyrlix.player.data.store

import com.dyrlix.player.core.Channels
import com.dyrlix.player.data.m3u.M3uParser
import com.dyrlix.player.data.model.Channel
import com.dyrlix.player.data.model.DefaultPlaylistCache
import com.dyrlix.player.data.model.DefaultPlaylistData
import com.dyrlix.player.data.net.PlaylistTextFetcher
import kotlinx.serialization.json.Json

/** Port `services/defaultPlaylist.ts` (AsyncStorage → DataStore). */
class DefaultPlaylistStore(
    private val store: KvStore,
    private val fetcher: PlaylistTextFetcher,
    private val now: () -> Long = System::currentTimeMillis,
) {

    private val json = Json { ignoreUnknownKeys = true }

    /** Memuat channel bawaan; fail-safe cache basi → channel contoh. */
    suspend fun load(force: Boolean = false): DefaultPlaylistData {
        val cached = readCache()

        if (!force && cached != null && now() - cached.fetchedAt < STALE_MS) {
            return DefaultPlaylistData(cached.channels, cached.epgUrl)
        }

        return try {
            val text = fetcher.fetchText(Channels.DEFAULT_PLAYLIST_URL, ACCEPT, timeoutMs = 0)
            val channels = M3uParser.parseM3U(text, "bawaan")
            if (channels.isEmpty()) throw IllegalStateException("Playlist bawaan kosong.")
            val epgUrl = M3uParser.extractEpgUrl(text)
            writeCache(DefaultPlaylistCache(channels, epgUrl, now()))
            DefaultPlaylistData(channels, epgUrl)
        } catch (e: Exception) {
            if (cached != null) {
                DefaultPlaylistData(cached.channels, cached.epgUrl)
            } else {
                DefaultPlaylistData(Channels.DEFAULT_CHANNELS.toList(), null)
            }
        }
    }

    /** Versi ringkas yang hanya mengembalikan daftar channel. */
    suspend fun loadChannels(force: Boolean = false): List<Channel> = load(force).channels

    private suspend fun readCache(): DefaultPlaylistCache? {
        return try {
            val raw = store.get(CACHE_KEY) ?: return null
            json.decodeFromString(DefaultPlaylistCache.serializer(), raw)
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun writeCache(entry: DefaultPlaylistCache) {
        try {
            store.put(CACHE_KEY, json.encodeToString(DefaultPlaylistCache.serializer(), entry))
        } catch (e: Exception) {
            // cache gagal tersimpan bukan masalah fatal
        }
    }

    companion object {
        const val CACHE_KEY = "default_playlist"

        private const val STALE_MS = 30 * 60 * 1000L
        private const val ACCEPT = "text/plain,*/*"
    }
}
