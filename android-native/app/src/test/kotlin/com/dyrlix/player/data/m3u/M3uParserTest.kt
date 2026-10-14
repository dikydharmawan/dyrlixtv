package com.dyrlix.player.data.m3u

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class M3uParserTest {

    @Test
    fun `normalisasi BOM kutip keriting zero-width dan url-tvg`() {
        val content = "\uFEFF#EXTM3U url-tvg=\"http://e/x.xml\"\r\n" +
            "#EXTINF:-1 tvg-id=\"A.id@SD\" group-title=\"Berita, Hiburan\",\u200B\" News \"\n" +
            "http://s/1.m3u8\n"

        val channels = M3uParser.parseM3U(content)
        assertEquals(1, channels.size)
        val channel = channels.first()
        assertEquals("http://e/x.xml", M3uParser.extractEpgUrl(content))
        assertEquals("A.id@SD", channel.tvgId)
        assertEquals("Berita, Hiburan", channel.group)
        assertEquals("News", channel.name)
        assertEquals("http://s/1.m3u8", channel.url)
        assertEquals("playlist-0", channel.id)
        assertNull(channel.logo)
    }

    @Test
    fun `extractEpgUrl hanya baris EXTM3U pertama dan pada teks raw`() {
        assertNull(M3uParser.extractEpgUrl("#EXTM3U x-tvg-url=“http://e/x.xml”"))
        assertNull(M3uParser.extractEpgUrl("tanpa header"))
        assertNull(M3uParser.extractEpgUrl(null))
        assertEquals(
            "http://a/b.xml",
            M3uParser.extractEpgUrl("#EXTM3U url-tvg=\"http://a/b.xml\"\n#EXTM3U x-tvg-url=\"http://c/d.xml\""),
        )
    }

    @Test
    fun `fallback nama displayName lalu tvg-name lalu tvg-id lalu Channel N`() {
        val fromTvgName = M3uParser.parseM3U("#EXTINF:-1 tvg-name=\"Nama A\",\nhttp://s/1")
        assertEquals("Nama A", fromTvgName.first().name)

        val fromTvgId = M3uParser.parseM3U("#EXTINF:-1 tvg-id=\"id.a\"\nhttp://s/2")
        assertEquals("id.a", fromTvgId.first().name)

        val fallback = M3uParser.parseM3U("#EXTINF:-1\nhttp://s/3")
        assertEquals("Channel 1", fallback.first().name)
    }

    @Test
    fun `direktif header setelah EXTINF menempel ke channel berikutnya`() {
        val content = "#EXTINF:-1,Judul\n#EXTHTTP:{\"User-Agent\":\"X\"}\nhttp://s/1"
        val channel = M3uParser.parseM3U(content).first()
        assertEquals("Judul", channel.name)
        assertEquals("X", channel.headers?.get("User-Agent"))
    }

    @Test
    fun `direktif header tepat sebelum URL tanpa EXTINF tetap terbawa`() {
        val content = "#EXTHTTP:{\"User-Agent\":\"X\"}\nhttp://s/1"
        val channel = M3uParser.parseM3U(content).first()
        assertEquals("Channel 1", channel.name)
        assertEquals("X", channel.headers?.get("User-Agent"))
    }

    @Test
    fun `EXTINF menggantikan pending sehingga header sebelumnya hilang`() {
        val content = "#EXTHTTP:{\"User-Agent\":\"X\"}\n#EXTINF:-1,Judul\nhttp://s/1"
        val channel = M3uParser.parseM3U(content).first()
        assertEquals("Judul", channel.name)
        assertNull(channel.headers)
    }

    @Test
    fun `EXTVLCOPT memetakan tiga kunci`() {
        val content = "#EXTINF:-1,A\n" +
            "#EXTVLCOPT:http-user-agent=UA1\n" +
            "#EXTVLCOPT:http-referrer=http://ref/\n" +
            "#EXTVLCOPT:http-origin=http://ori\n" +
            "#EXTVLCOPT:lain=abaikan\n" +
            "http://s/1"
        val headers = M3uParser.parseM3U(content).first().headers!!
        assertEquals("UA1", headers["User-Agent"])
        assertEquals("http://ref/", headers["Referer"])
        assertEquals("http://ori", headers["Origin"])
        assertEquals(3, headers.size)
    }

    @Test
    fun `KODIPROP melewati pasangan pertama dan dipisah pipa`() {
        // Sesuai RN: line.slice(eq+1) membuang "prefix=" pertama, sisanya dipisah '|'.
        val content = "#EXTINF:-1,A\n" +
            "#KODIPROP:junk=0|user-agent=UA|referer=http://r?x=a=b\n" +
            "http://s/1"
        val headers = M3uParser.parseM3U(content).first().headers!!
        assertEquals("UA", headers["user-agent"])
        assertEquals("http://r?x=a=b", headers["referer"])
        assertNull(headers["junk"])
    }

    @Test
    fun `EXTHTTP hanya menyimpan nilai string`() {
        val content = "#EXTINF:-1,A\n" +
            "#EXTHTTP:{\"a\":\"1\",\"b\":2,\"c\":true}\nhttp://s/1"
        val headers = M3uParser.parseM3U(content).first().headers!!
        assertEquals(mapOf("a" to "1"), headers)
    }

    @Test
    fun `URL diterima bila mengandung skema di mana saja dan disimpan utuh`() {
        val channels = M3uParser.parseM3U("#EXTINF:-1,A\n>> http://s/1")
        assertEquals(">> http://s/1", channels.first().url)
    }

    @Test
    fun `baris tanpa skema tidak menghabiskan pending dan tidak menghasilkan channel`() {
        val content = "#EXTINF:-1,A\nbukan url\nhttp://s/1"
        val channels = M3uParser.parseM3U(content)
        assertEquals(1, channels.size)
        assertEquals("A", channels.first().name)
    }

    @Test
    fun `kutip tidak seimbang membuat nama jatuh ke fallback`() {
        val content = "#EXTINF:-1 group-title=\"Berita, Nama\nhttp://s/1"
        val channel = M3uParser.parseM3U(content).first()
        assertEquals("Channel 1", channel.name)
    }

    @Test
    fun `indeks id hanya menghitung channel yang diterima`() {
        val content = "http://a/1\n#EXTINF:-1,B\nhttp://b/2"
        val channels = M3uParser.parseM3U(content, "pl")
        assertEquals(listOf("pl-0", "pl-1"), channels.map { it.id })
        assertEquals("Channel 1", channels[0].name)
        assertEquals("B", channels[1].name)
    }

    @Test
    fun `parseM3U mengembalikan daftar kosong untuk input tidak valid`() {
        assertTrue(M3uParser.parseM3U(null).isEmpty())
        assertTrue(M3uParser.parseM3U("").isEmpty())
    }
}
