package com.dyrlix.player.data.net

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StreamHeadersTest {

    @Test
    fun `merge tanpa header channel mengembalikan default`() {
        val merged = StreamHeaders.merge(null)
        assertEquals(StreamHeaders.DEFAULT_USER_AGENT, merged["User-Agent"])
        assertEquals("*/*", merged["Accept"])
    }

    @Test
    fun `merge menimpa kunci dengan case berbeda tanpa duplikat`() {
        val merged = StreamHeaders.merge(mapOf("user-agent" to "X", "Referer" to "http://r/"))
        assertFalse(merged.containsKey("User-Agent"))
        assertEquals("X", merged["user-agent"])
        assertEquals("http://r/", merged["Referer"])
        assertEquals("*/*", merged["Accept"])
        assertEquals(3, merged.size)
    }

    @Test
    fun `browserRetryHeaders menambah referer origin dan memaksa UA`() {
        val headers = StreamHeaders.browserRetryHeaders("https://h.com:8443/p.m3u8", null)
        assertEquals(StreamHeaders.DEFAULT_USER_AGENT, headers["User-Agent"])
        assertEquals("https://h.com:8443/", headers["Referer"])
        assertEquals("https://h.com:8443", headers["Origin"])
    }

    @Test
    fun `browserRetryHeaders tidak menimpa Origin dan mengabaikan port default`() {
        val headers = StreamHeaders.browserRetryHeaders(
            "https://h.com/p.m3u8",
            mapOf("Origin" to "http://keep"),
        )
        assertEquals("https://h.com/", headers["Referer"])
        assertEquals("http://keep", headers["Origin"])
    }

    @Test
    fun `browserRetryHeaders mengabaikan url tidak valid`() {
        val headers = StreamHeaders.browserRetryHeaders("bukan url", null)
        assertEquals(StreamHeaders.DEFAULT_USER_AGENT, headers["User-Agent"])
        assertNull(headers["Referer"])
    }
}
