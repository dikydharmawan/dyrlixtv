package com.dyrlix.player.data.epg

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EpgXmlTest {

    @Test
    fun `normalizeEpgId membuang kualitas dan pemisah`() {
        assertEquals("antvid", EpgXml.normalizeEpgId("ANTV.id@SD"))
        assertEquals("cnnus", EpgXml.normalizeEpgId("CNN.us"))
        assertEquals("", EpgXml.normalizeEpgId("@HD"))
    }

    @Test
    fun `parseXmltvTime menangani zona detik opsional dan default utc`() {
        assertEquals(0.0, EpgXml.parseXmltvTime("19700101000000 +0000"), 0.0)
        assertEquals(0.0, EpgXml.parseXmltvTime("19700101000000"), 0.0)
        assertEquals(0.0, EpgXml.parseXmltvTime("19700101010000 +0100"), 0.0)
        assertEquals(3_600_000.0, EpgXml.parseXmltvTime("19700101000000 -0100"), 0.0)
        assertEquals(0.0, EpgXml.parseXmltvTime("197001010000 +0000"), 0.0)
        assertTrue(EpgXml.parseXmltvTime("bukan waktu").isNaN())
        assertTrue(EpgXml.parseXmltvTime(null).isNaN())
    }

    @Test
    fun `decodeEntities mengurai entity dan menunda amp`() {
        assertEquals("<>&\"'", EpgXml.decodeEntities("&lt;&gt;&amp;&quot;&apos;"))
        assertEquals("AB", EpgXml.decodeEntities("&#65;&#x42;"))
        assertEquals("&lt;", EpgXml.decodeEntities("&amp;lt;"))
    }

    @Test
    fun `hashString dan localDateKey berbentuk stabil`() {
        assertTrue(Regex("^[0-9a-z]+$").matches(EpgXml.hashString("http://a|b")))
        assertEquals(EpgXml.hashString("x"), EpgXml.hashString("x"))
        assertTrue(Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(EpgXml.localDateKey()))
    }

    @Test
    fun `Utf8StreamDecoder aman antar chunk`() {
        val decoder = Utf8StreamDecoder()
        val bytes = "é😀".toByteArray(Charsets.UTF_8)
        assertEquals(6, bytes.size)
        assertEquals("é", decoder.decode(bytes, 0, 3))
        assertEquals("😀", decoder.decode(bytes, 3, 3))
    }

    @Test
    fun `XmltvCollector menyaring jendela waktu dan membersihkan teks`() {
        val xml = """
            <tv>
             <programme start="19700101000000 +0000" stop="19700101010000 +0000" channel="ANTV.id@SD">
               <title>Berita <b>Utama</b> &amp; Olahraga</title>
               <desc>Deskripsi <i>panjang</i> &lt;tes&gt;</desc>
             </programme>
             <programme start="19700103000000 +0000" stop="19700103010000 +0000" channel="Lain.id">
               <title>Diluar Jendela</title>
             </programme>
            </tv>
        """.trimIndent()

        val collector = XmltvCollector(0L)
        collector.feed(xml)
        val guide = collector.finish()

        assertEquals(1, guide.size)
        val programme = guide["antvid"]!!.single()
        assertEquals("Berita Utama & Olahraga", programme.title)
        assertEquals("Deskripsi panjang <tes>", programme.description)
        assertEquals(0L, programme.start)
        assertNull(guide["lainid"])
    }

    @Test
    fun `XmltvCollector membatasi deskripsi dan aman antar feed`() {
        val longDescription = "x".repeat(150)
        val xml = "<tv><programme start=\"19700101000000 +0000\" stop=\"19700101010000 +0000\" channel=\"c\">" +
            "<title>Judul</title><desc>$longDescription</desc></programme></tv>"

        val collector = XmltvCollector(0L)
        collector.feed(xml.substring(0, 20))
        collector.feed(xml.substring(20))
        val programme = collector.finish()["c"]!!.single()

        assertNotNull(programme.description)
        assertEquals(140, programme.description!!.length)
    }
}
