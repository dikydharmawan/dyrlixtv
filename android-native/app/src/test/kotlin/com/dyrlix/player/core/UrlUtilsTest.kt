package com.dyrlix.player.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UrlUtilsTest {

    @Test
    fun `isValidStreamUrl`() {
        assertTrue(UrlUtils.isValidStreamUrl("https://a.b/c.m3u8"))
        assertTrue(UrlUtils.isValidStreamUrl("  http://a.b/c  "))
        assertFalse(UrlUtils.isValidStreamUrl("ftp://a.b/c"))
        assertFalse(UrlUtils.isValidStreamUrl("http://a b/c"))
        assertFalse(UrlUtils.isValidStreamUrl(""))
        assertFalse(UrlUtils.isValidStreamUrl(null))
    }

    @Test
    fun `deriveNameFromUrl`() {
        assertEquals("bar — host.com", UrlUtils.deriveNameFromUrl("https://host.com/foo/bar.m3u8"))
        assertEquals("host.com", UrlUtils.deriveNameFromUrl("https://host.com"))
        assertEquals("b — host.com", UrlUtils.deriveNameFromUrl("https://host.com/a/b.txt?x=1"))
        assertEquals("host.com", UrlUtils.deriveNameFromUrl("https://host.com/file.mp4"))
        // Tanpa exception, host = seluruh string (fallback hanya saat error).
        assertEquals("bukan url sama sekali", UrlUtils.deriveNameFromUrl("bukan url sama sekali"))
    }

    @Test
    fun `summarize urut jumlah menurun lalu nama`() {
        val channels = listOf(
            com.dyrlix.player.data.model.Channel("1", "a", "u", group = "B"),
            com.dyrlix.player.data.model.Channel("2", "b", "u", group = "A"),
            com.dyrlix.player.data.model.Channel("3", "c", "u", group = "B"),
            com.dyrlix.player.data.model.Channel("4", "d", "u"),
        )
        val summary = Categories.summarize(channels)
        assertEquals(listOf("B", "A", "Umum"), summary.categories)
        assertEquals(2, summary.counts["B"])
    }

    @Test
    fun `withPlaceholders mengisi baris terakhir`() {
        val items = listOf(
            com.dyrlix.player.data.model.Channel("1", "a", "u"),
            com.dyrlix.player.data.model.Channel("2", "b", "u"),
            com.dyrlix.player.data.model.Channel("3", "c", "u"),
        )
        assertEquals(4, GridUtils.withPlaceholders(items, 2).size)
        assertEquals(3, GridUtils.withPlaceholders(items, 3).size)
        assertEquals(3, GridUtils.withPlaceholders(items, 1).size)
    }
}
