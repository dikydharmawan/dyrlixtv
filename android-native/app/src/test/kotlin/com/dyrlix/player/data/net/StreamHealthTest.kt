package com.dyrlix.player.data.net

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class StreamHealthTest {

    @Test
    fun `describeStatus memetakan kode`() {
        assertEquals(
            "Kanal tidak tersedia (HTTP 404) — tautan mati atau diblokir server.",
            StreamHealth.describeStatus(404),
        )
        assertEquals(
            "Kanal tidak tersedia (HTTP 404) — tautan mati atau diblokir server.",
            StreamHealth.describeStatus(410),
        )
        assertTrue(StreamHealth.describeStatus(403)!!.startsWith("Server menolak akses"))
        assertTrue(StreamHealth.describeStatus(451)!!.startsWith("Channel diblokir"))
        assertEquals("Server channel sedang bermasalah (HTTP 503). Coba lagi nanti.", StreamHealth.describeStatus(503))
        assertEquals("Permintaan ditolak server (HTTP 429).", StreamHealth.describeStatus(429))
        assertNull(StreamHealth.describeStatus(200))
    }

    @Test
    fun `detectStatus memakai httpStatus lalu regex`() {
        assertEquals(404, StreamHealth.detectStatus("apa saja", 404))
        assertEquals(503, StreamHealth.detectStatus("error 503 terjadi", null))
        assertNull(StreamHealth.detectStatus("tanpa kode", null))
    }

    @Test
    fun `friendlyStreamError memilih pesan yang tepat`() {
        assertEquals(
            "Kanal tidak tersedia (HTTP 404) — tautan mati atau diblokir server.",
            StreamHealth.friendlyStreamError(Throwable("gagal 404"), null),
        )
        assertEquals(
            "Server channel sedang bermasalah (HTTP 500). Coba lagi nanti.",
            StreamHealth.friendlyStreamError(null, 500),
        )
        assertEquals(
            "Tidak dapat terhubung ke channel. Periksa koneksi internet atau tautan.",
            StreamHealth.friendlyStreamError(Throwable("SocketTimeoutException: timeout"), null),
        )
        assertNull(StreamHealth.friendlyStreamError(Throwable("boom"), null))
    }
}
