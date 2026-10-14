package com.dyrlix.player.data.net

import com.dyrlix.player.data.model.Playlist
import com.dyrlix.player.data.model.PlaylistType
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class PlaylistLoaderTest {

    private class FakeFetcher(private val result: () -> String) : PlaylistTextFetcher {
        var lastUrl: String? = null
        override suspend fun fetchText(url: String, accept: String, timeoutMs: Long): String {
            lastUrl = url
            return result()
        }
    }

    private fun playlist(type: PlaylistType, url: String = "", content: String? = null) =
        Playlist(id = "p1", name = "P", url = url, addedAt = 0, type = type, content = content)

    @Test
    fun `content diparse tanpa jaringan`() = runTest {
        val fetcher = FakeFetcher { throw AssertionError("tidak boleh fetch") }
        val data = PlaylistLoader(fetcher).loadPlaylistData(
            playlist(PlaylistType.CONTENT, content = "#EXTM3U\n#EXTINF:-1,A\nhttp://s/1"),
        )
        assertEquals(1, data.channels.size)
        assertEquals("p1-0", data.channels.first().id)
    }

    @Test
    fun `url diunduh lalu diparse beserta epgUrl`() = runTest {
        val fetcher = FakeFetcher { "#EXTM3U url-tvg=\"http://e/x.xml\"\n#EXTINF:-1,A\nhttp://s/1" }
        val data = PlaylistLoader(fetcher).loadPlaylistData(
            playlist(PlaylistType.URL, url = "http://a/b.m3u"),
        )
        assertEquals("http://a/b.m3u", fetcher.lastUrl)
        assertEquals("http://e/x.xml", data.epgUrl)
    }

    @Test
    fun `playlist tanpa channel melempar pesan yang sama`() = runTest {
        val error = runCatching {
            PlaylistLoader(FakeFetcher { "#EXTM3U kosong" }).loadPlaylistData(
                playlist(PlaylistType.URL, url = "http://a/b.m3u"),
            )
        }.exceptionOrNull()!!
        assertEquals("Playlist tidak berisi channel yang valid.", error.message)
    }

    @Test
    fun `status http non-2xx memetakan pesan yang sama`() = runTest {
        val error = runCatching {
            PlaylistLoader(FakeFetcher { throw HttpStatusException(503) }).loadPlaylistData(
                playlist(PlaylistType.URL, url = "http://a/b.m3u"),
            )
        }.exceptionOrNull()!!
        assertEquals("Server menolak permintaan (HTTP 503).", error.message)
    }

    @Test
    fun `timeout dan kegagalan koneksi memetakan pesan yang sama`() = runTest {
        val timeout = runCatching {
            PlaylistLoader(FakeFetcher { throw SocketTimeoutException("timeout") }).loadPlaylistData(
                playlist(PlaylistType.URL, url = "http://a/b.m3u"),
            )
        }.exceptionOrNull()!!
        assertEquals("Koneksi habis waktu. Periksa jaringan lalu coba lagi.", timeout.message)

        val offline = runCatching {
            PlaylistLoader(FakeFetcher { throw UnknownHostException("no dns") }).loadPlaylistData(
                playlist(PlaylistType.URL, url = "http://a/b.m3u"),
            )
        }.exceptionOrNull()!!
        assertEquals(
            "Tidak dapat terhubung ke tautan. Periksa URL atau koneksi internet.",
            offline.message,
        )
    }

    @Test
    fun `error generik memakai message aslinya`() = runTest {
        val error = runCatching {
            PlaylistLoader(FakeFetcher { throw IllegalStateException("boom") }).loadPlaylistData(
                playlist(PlaylistType.URL, url = "http://a/b.m3u"),
            )
        }.exceptionOrNull()!!
        assertTrue(error.message == "boom")
    }
}
