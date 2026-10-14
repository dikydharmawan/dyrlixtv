package com.dyrlix.player.data.net

import com.dyrlix.player.data.m3u.M3uParser
import com.dyrlix.player.data.model.Channel
import com.dyrlix.player.data.model.Playlist
import com.dyrlix.player.data.model.PlaylistData
import com.dyrlix.player.data.model.PlaylistType
import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.SocketException
import java.net.UnknownHostException

/**
 * Port `services/playlistLoader.ts`. Pesan error harus identik dengan RN.
 * `PlaylistValidationException`/pesan generik dilempar sebagai `IllegalStateException`.
 */
class PlaylistLoader(private val fetcher: PlaylistTextFetcher) {

    suspend fun loadPlaylistData(playlist: Playlist): PlaylistData {
        if (playlist.type == PlaylistType.CONTENT && !playlist.content.isNullOrEmpty()) {
            return buildData(playlist.content, playlist.id)
        }
        val text = fetchPlaylistText(playlist.url)
        return buildData(text, playlist.id)
    }

    /** Tetap tersedia untuk pemanggil lama yang hanya butuh daftar channel. */
    suspend fun loadPlaylistChannels(playlist: Playlist): List<Channel> =
        loadPlaylistData(playlist).channels

    private fun buildData(m3u: String, playlistId: String): PlaylistData {
        val channels = M3uParser.parseM3U(m3u, playlistId)
        if (channels.isEmpty()) {
            throw IllegalStateException("Playlist tidak berisi channel yang valid.")
        }
        return PlaylistData(channels, M3uParser.extractEpgUrl(m3u))
    }

    private suspend fun fetchPlaylistText(url: String): String {
        return try {
            fetcher.fetchText(url, ACCEPT, FETCH_TIMEOUT_MS)
        } catch (e: HttpStatusException) {
            throw IllegalStateException("Server menolak permintaan (HTTP ${e.code}).")
        } catch (e: InterruptedIOException) {
            // SocketTimeoutException extends InterruptedIOException → termasuk timeout.
            throw IllegalStateException("Koneksi habis waktu. Periksa jaringan lalu coba lagi.")
        } catch (e: UnknownHostException) {
            throw IllegalStateException(
                "Tidak dapat terhubung ke tautan. Periksa URL atau koneksi internet.",
            )
        } catch (e: ConnectException) {
            throw IllegalStateException(
                "Tidak dapat terhubung ke tautan. Periksa URL atau koneksi internet.",
            )
        } catch (e: SocketException) {
            throw IllegalStateException(
                "Tidak dapat terhubung ke tautan. Periksa URL atau koneksi internet.",
            )
        } catch (e: Exception) {
            throw IllegalStateException(e.message ?: "Gagal memuat playlist.")
        }
    }

    companion object {
        private const val FETCH_TIMEOUT_MS = 20_000L
        private const val ACCEPT =
            "application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*"
    }
}
