package com.dyrlix.player.data.epg

import com.dyrlix.player.data.model.EpgGuide
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.yield
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.ByteArrayInputStream
import java.io.IOException
import java.util.concurrent.TimeUnit
import java.util.zip.GZIPInputStream

/**
 * `fetchGuide` jaringan (OkHttp). Gzip dideteksi dari magic byte seperti versi
 * RN, lalu didekompresi bertahap agar guide besar tidak ditahan sekaligus.
 */
class OkHttpEpgFetcher(baseClient: OkHttpClient) : EpgFetcher {

    private val client = baseClient.newBuilder()
        .callTimeout(FETCH_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .build()

    override suspend fun fetchGuide(url: String, now: Long): EpgGuide = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(url)
            .header("accept", ACCEPT)
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("HTTP ${response.code}")
            val bytes = response.body?.bytes() ?: ByteArray(0)
            parseGuide(bytes, now)
        }
    }

    private suspend fun parseGuide(bytes: ByteArray, now: Long): EpgGuide {
        val collector = XmltvCollector(now)
        val decoder = Utf8StreamDecoder()
        val isGzip = bytes.size > 2 &&
            bytes[0] == 0x1F.toByte() && bytes[1] == 0x8B.toByte()

        if (!isGzip) {
            collector.feed(decoder.decode(bytes))
            return collector.finish()
        }

        GZIPInputStream(ByteArrayInputStream(bytes), INFLATE_SLICE).use { input ->
            val buffer = ByteArray(INFLATE_SLICE)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                collector.feed(decoder.decode(buffer, 0, read))
                yield()
            }
        }
        return collector.finish()
    }

    companion object {
        private const val FETCH_TIMEOUT_MS = 30_000L
        private const val INFLATE_SLICE = 1 shl 16
        private const val ACCEPT = "application/gzip, application/xml, text/xml, */*"
    }
}
