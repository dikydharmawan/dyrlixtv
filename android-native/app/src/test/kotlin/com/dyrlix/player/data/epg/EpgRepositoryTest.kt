package com.dyrlix.player.data.epg

import com.dyrlix.player.data.model.EpgGuide
import com.dyrlix.player.data.model.EpgProgramme
import kotlinx.coroutines.async
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class EpgRepositoryTest {

    private fun programme(id: String, start: Long, stop: Long, title: String) =
        EpgProgramme(channelId = id, start = start, stop = stop, title = title)

    private class FakeFetcher(private val guides: Map<String, EpgGuide>) : EpgFetcher {
        val calls = mutableListOf<String>()
        override suspend fun fetchGuide(url: String, now: Long): EpgGuide {
            calls.add(url)
            return guides[url] ?: throw IOException("no guide for $url")
        }
    }

    private class InMemoryCache : EpgCache {
        val store = LinkedHashMap<String, EpgGuide>()
        override suspend fun read(key: String, dateKey: String): EpgGuide? = store[key]
        override suspend fun write(key: String, dateKey: String, guide: EpgGuide) {
            store[key] = guide
        }
    }

    @Test
    fun `normalizeUrls memecah koma dedupe lalu menambah sumber cadangan`() {
        val urls = EpgRepository.normalizeUrls(listOf("http://a/x.xml, http://b/y.xml", "http://a/x.xml"))
        assertEquals("http://a/x.xml", urls[0])
        assertEquals("http://b/y.xml", urls[1])
        assertEquals(EpgRepository.FALLBACK_EPG_URLS.size + 2, urls.size)
        assertEquals(EpgRepository.FALLBACK_EPG_URLS[0], urls[2])
    }

    @Test
    fun `normalizeUrls input null hanya menghasilkan sumber cadangan`() {
        assertEquals(EpgRepository.FALLBACK_EPG_URLS, EpgRepository.normalizeUrls(null))
    }

    @Test
    fun `ensureEpgLoaded menggabungkan sumber dan dedupe`() = runTest {
        val primary = "http://primary/guide.xml"
        val fetcher = FakeFetcher(
            mapOf(
                primary to mapOf(
                    "cnnus" to listOf(
                        programme("cnnus", 200, 300, "B"),
                        programme("cnnus", 100, 200, "A"),
                        programme("cnnus", 200, 300, "B"),
                    ),
                ),
            ),
        )
        val cache = InMemoryCache()
        val repo = EpgRepository(fetcher, cache, this)

        val guide = repo.ensureEpgLoaded(primary)
        val list = guide!!["cnnus"]!!
        assertEquals(2, list.size)
        assertEquals(listOf("A", "B"), list.map { it.title })
        assertEquals(4, fetcher.calls.size)
        assertEquals(1, cache.store.size)
    }

    @Test
    fun `panggilan kedua memakai state tanpa fetch ulang`() = runTest {
        val primary = "http://primary/guide.xml"
        val fetcher = FakeFetcher(mapOf(primary to mapOf("id" to listOf(programme("id", 1, 2, "X")))))
        val repo = EpgRepository(fetcher, InMemoryCache(), this)

        repo.ensureEpgLoaded(primary)
        val callsAfterFirst = fetcher.calls.size
        repo.ensureEpgLoaded(primary)
        assertEquals(callsAfterFirst, fetcher.calls.size)
    }

    @Test
    fun `ensureEpgLoaded memakai cache hari yang sama`() = runTest {
        val primary = "http://primary/guide.xml"
        val cache = InMemoryCache()
        val first = EpgRepository(
            FakeFetcher(mapOf(primary to mapOf("id" to listOf(programme("id", 1, 2, "X"))))),
            cache,
            this,
        )
        first.ensureEpgLoaded(primary)

        val offline = EpgRepository(FakeFetcher(emptyMap()), cache, this)
        val guide = offline.ensureEpgLoaded(primary)
        assertEquals("X", guide!!["id"]!!.first().title)
        assertTrue(offline.getEpg() != null)
    }

    @Test
    fun `force melewati cache dan fetch ulang`() = runTest {
        val primary = "http://primary/guide.xml"
        val fetcher = FakeFetcher(mapOf(primary to mapOf("id" to listOf(programme("id", 1, 2, "X")))))
        val repo = EpgRepository(fetcher, InMemoryCache(), this)

        repo.ensureEpgLoaded(primary)
        val before = fetcher.calls.size
        repo.ensureEpgLoaded(primary, force = true)
        assertEquals(before * 2, fetcher.calls.size)
    }

    @Test
    fun `panggilan serentak berbagi satu permintaan`() = runTest {
        val primary = "http://primary/guide.xml"
        val fetcher = FakeFetcher(mapOf(primary to mapOf("id" to listOf(programme("id", 1, 2, "X")))))
        val repo = EpgRepository(fetcher, InMemoryCache(), this)

        val a = async { repo.ensureEpgLoaded(primary) }
        val b = async { repo.ensureEpgLoaded(primary) }
        val ra = a.await()
        val rb = b.await()
        assertSame(ra, rb)
        assertEquals(4, fetcher.calls.size)
    }

    @Test
    fun `getNowNext memilih acara aktif dan berikutnya`() = runTest {
        val primary = "u"
        val repo = EpgRepository(
            FakeFetcher(
                mapOf(
                    primary to mapOf(
                        "c" to listOf(
                            programme("c", 100, 200, "A"),
                            programme("c", 200, 300, "B"),
                            programme("c", 300, 400, "C"),
                        ),
                    ),
                ),
            ),
            InMemoryCache(),
            this,
        )
        repo.ensureEpgLoaded(primary)

        val nowNext = repo.getNowNext("c", at = 150)!!
        assertEquals("A", nowNext.now!!.title)
        assertEquals("B", nowNext.next!!.title)

        val edge = repo.getNowNext("c", at = 200)!!
        assertEquals("B", edge.now!!.title)
        assertEquals("C", edge.next!!.title)

        val gap = repo.getNowNext("c", at = 50)!!
        assertNull(gap.now)
        assertEquals("A", gap.next!!.title)

        assertNull(repo.getNowNext("c", at = 500))
    }

    @Test
    fun `getSchedule menormalkan tvg-id dan kosong bila tidak ada`() = runTest {
        val primary = "u"
        val repo = EpgRepository(
            FakeFetcher(mapOf(primary to mapOf("antvid" to listOf(programme("antvid", 1, 2, "A"))))),
            InMemoryCache(),
            this,
        )
        repo.ensureEpgLoaded(primary)
        assertEquals(1, repo.getSchedule("ANTV.id@SD").size)
        assertTrue(repo.getSchedule("lain").isEmpty())
        assertTrue(repo.getSchedule(null).isEmpty())
    }

    @Test
    fun `isLiveTitle mendeteksi penanda langsung`() = runTest {
        val repo = EpgRepository(FakeFetcher(emptyMap()), InMemoryCache(), this)
        assertTrue(repo.isLiveTitle("Berita (L)"))
        assertTrue(repo.isLiveTitle("LIVE sepak bola"))
        assertTrue(repo.isLiveTitle("Siaran Langsung"))
        assertFalse(repo.isLiveTitle("Film malam"))
        assertFalse(repo.isLiveTitle(""))
        assertFalse(repo.isLiveTitle(null))
    }
}
