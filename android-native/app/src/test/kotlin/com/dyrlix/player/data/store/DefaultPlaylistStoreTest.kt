package com.dyrlix.player.data.store

import com.dyrlix.player.core.Channels
import com.dyrlix.player.data.net.HttpStatusException
import com.dyrlix.player.data.net.PlaylistTextFetcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class DefaultPlaylistStoreTest {

    private class FakeFetcher(private val result: () -> String) : PlaylistTextFetcher {
        var calls = 0
        override suspend fun fetchText(url: String, accept: String, timeoutMs: Long): String {
            calls += 1
            return result()
        }
    }

    private val m3u = "#EXTM3U x-tvg-url=\"http://e/g.xml\"\n#EXTINF:-1,Foo\nhttp://s/1"

    @Test
    fun `cache segar dipakai tanpa fetch`() = runTest {
        val kv = InMemoryKvStore()
        val first = FakeFetcher { m3u }
        val store = DefaultPlaylistStore(kv, first, now = { 0L })
        store.load()
        assertEquals(1, first.calls)

        val second = FakeFetcher { m3u }
        val loaded = DefaultPlaylistStore(kv, second, now = { 1L }).load()
        assertEquals(0, second.calls)
        assertEquals("Foo", loaded.channels.first().name)
        assertEquals("http://e/g.xml", loaded.epgUrl)
    }

    @Test
    fun `force memuat ulang dari jaringan`() = runTest {
        val kv = InMemoryKvStore()
        val first = FakeFetcher { m3u }
        DefaultPlaylistStore(kv, first, now = { 0L }).load()

        val second = FakeFetcher { m3u }
        DefaultPlaylistStore(kv, second, now = { 0L }).load(force = true)
        assertEquals(1, second.calls)
    }

    @Test
    fun `cache basi dan jaringan gagal memakai cache lama`() = runTest {
        val kv = InMemoryKvStore()
        DefaultPlaylistStore(kv, FakeFetcher { m3u }, now = { 0L }).load()

        val failing = FakeFetcher { throw HttpStatusException(500) }
        val stale = DefaultPlaylistStore(kv, failing, now = { 31 * 60 * 1000L }).load()
        assertEquals("Foo", stale.channels.first().name)
        assertEquals(1, failing.calls)
    }

    @Test
    fun `tanpa cache dan jaringan gagal memakai channel contoh`() = runTest {
        val kv = InMemoryKvStore()
        val failing = FakeFetcher { throw IOException("mati") }
        val loaded = DefaultPlaylistStore(kv, failing, now = { 0L }).load()
        assertEquals(Channels.DEFAULT_CHANNELS.size, loaded.channels.size)
        assertEquals(4, loaded.channels.count { it.isDemo })
        assertEquals(null, loaded.epgUrl)
    }

    @Test
    fun `playlist kosong dianggap gagal`() = runTest {
        val kv = InMemoryKvStore()
        val loaded = DefaultPlaylistStore(kv, FakeFetcher { "#EXTM3U saja" }, now = { 0L }).load()
        assertTrue(loaded.channels.all { it.id in Channels.DEFAULT_CHANNELS.map { c -> c.id } })
    }
}
