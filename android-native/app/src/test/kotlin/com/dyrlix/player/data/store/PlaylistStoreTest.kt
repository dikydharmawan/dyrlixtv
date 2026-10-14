package com.dyrlix.player.data.store

import com.dyrlix.player.data.model.PlaylistType
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class PlaylistStoreTest {

    private fun store(vararg stored: Pair<String, String>) = InMemoryKvStore().also { kv ->
        kotlinx.coroutines.runBlocking { stored.forEach { (k, v) -> kv.put(k, v) } }
    }

    private fun newStore(kv: KvStore) = PlaylistStore(kv, now = { 1000L }, random = Random(1))

    @Test
    fun `tambah playlist url memakai deriveNameFromUrl`() = runTest {
        val kv = store()
        val playlist = newStore(kv).addPlaylist(
            AddPlaylistInput(mode = PlaylistType.URL, url = "https://contoh.com/senarai/kanal.m3u"),
        )
        assertEquals("kanal — contoh.com", playlist.name)
        assertEquals(PlaylistType.URL, playlist.type)
        assertEquals("https://contoh.com/senarai/kanal.m3u", playlist.url)
        assertEquals(1, newStore(kv).getPlaylists().size)
    }

    @Test
    fun `tambah content menghitung channel dan menolak duplikat`() = runTest {
        val content = "#EXTM3U\n#EXTINF:-1,A\nhttp://s/1"
        val kv = store()
        val playlist = newStore(kv).addPlaylist(AddPlaylistInput(PlaylistType.CONTENT, content = content))
        assertEquals("1 channel (tempel)", playlist.name)
        assertEquals(1, playlist.channelCount)

        val duplicate = runCatching {
            newStore(kv).addPlaylist(AddPlaylistInput(PlaylistType.CONTENT, content = content))
        }.exceptionOrNull()
        assertTrue(duplicate is PlaylistValidationException)
        assertEquals("Playlist dengan isi yang sama sudah tersimpan.", duplicate!!.message)
    }

    @Test
    fun `validasi url kosong tidak valid dan duplikat`() = runTest {
        val kv = store()
        val store0 = newStore(kv)

        assertEquals(
            "Tautan playlist tidak boleh kosong.",
            runCatching { store0.addPlaylist(AddPlaylistInput(PlaylistType.URL, url = "  ")) }
                .exceptionOrNull()!!.message,
        )
        assertEquals(
            "Tautan tidak valid. Gunakan URL http(s) yang benar.",
            runCatching { store0.addPlaylist(AddPlaylistInput(PlaylistType.URL, url = "ftp://x")) }
                .exceptionOrNull()!!.message,
        )

        store0.addPlaylist(AddPlaylistInput(PlaylistType.URL, url = "http://a/b.m3u"))
        assertEquals(
            "Playlist dengan tautan ini sudah tersimpan.",
            runCatching {
                newStore(kv).addPlaylist(AddPlaylistInput(PlaylistType.URL, url = "http://a/b.m3u"))
            }.exceptionOrNull()!!.message,
        )
    }

    @Test
    fun `getPlaylists menyaring entri rusak dan mengurutkan addedAt menurun`() = runTest {
        val raw = """
            [
              {"id":"a","name":"A","addedAt":2,"url":"http://x","type":"url"},
              {"id":"b","name":"B"},
              {"name":"C","addedAt":1},
              {"id":"d","addedAt":1},
              {"id":"e","name":"E","addedAt":"x"},
              {"id":"f","name":"F","addedAt":3,"type":"content","content":"z","channelCount":4}
            ]
        """.trimIndent()
        val playlists = newStore(store("playlists" to raw)).getPlaylists()
        assertEquals(listOf("F", "A"), playlists.map { it.name })
        assertEquals(PlaylistType.CONTENT, playlists[0].type)
        assertEquals(4, playlists[0].channelCount)
        assertEquals("http://x", playlists[1].url)
    }

    @Test
    fun `getPlaylists pada data bukan array mengembalikan kosong`() = runTest {
        assertTrue(newStore(store("playlists" to "{}")).getPlaylists().isEmpty())
        assertTrue(newStore(store("playlists" to "bukan json")).getPlaylists().isEmpty())
        assertTrue(newStore(store()).getPlaylists().isEmpty())
    }

    @Test
    fun `removePlaylist menghapus dan mengembalikan daftar terbaru`() = runTest {
        val kv = store()
        val store0 = newStore(kv)
        val first = store0.addPlaylist(AddPlaylistInput(PlaylistType.URL, url = "http://a/one.m3u"))
        val second = store0.addPlaylist(AddPlaylistInput(PlaylistType.URL, url = "http://a/two.m3u"))

        val next = newStore(kv).removePlaylist(first.id)
        assertEquals(listOf(second.id), next.map { it.id })
        assertNull(newStore(kv).getPlaylistById(first.id))
    }

    @Test
    fun `getPlaylistById mengembalikan playlist yang cocok`() = runTest {
        val kv = store()
        val created = newStore(kv).addPlaylist(
            AddPlaylistInput(PlaylistType.URL, url = "http://a/b.m3u", name = "  Favorit  "),
        )
        val loaded = newStore(kv).getPlaylistById(created.id)!!
        assertEquals("Favorit", loaded.name)
    }
}
