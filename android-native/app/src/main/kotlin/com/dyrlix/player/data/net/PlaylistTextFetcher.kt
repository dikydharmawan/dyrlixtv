package com.dyrlix.player.data.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Respons HTTP non-2xx saat mengambil teks (M3U/EPG). */
class HttpStatusException(val code: Int) : IOException("HTTP $code")

/** Pengambil teks jaringan dengan `Accept` dan timeout yang bisa diatur. */
interface PlaylistTextFetcher {
    /**
     * @param timeoutMs timeout total; `<= 0` berarti tanpa timeout (seperti
     *   `fetch(DEFAULT_PLAYLIST_URL)` di RN).
     */
    suspend fun fetchText(url: String, accept: String, timeoutMs: Long): String
}

/** Implementasi OkHttp dengan dua klien turunan (ber-timeout & tanpa timeout). */
class OkHttpTextFetcher(baseClient: OkHttpClient) : PlaylistTextFetcher {

    private val timed = baseClient.newBuilder()
        .callTimeout(PLAYLIST_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        .build()

    private val untimed = baseClient.newBuilder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .callTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    override suspend fun fetchText(url: String, accept: String, timeoutMs: Long): String =
        withContext(Dispatchers.IO) {
            val client = if (timeoutMs > 0) timed else untimed
            val request = Request.Builder()
                .url(url)
                .header("accept", accept)
                .build()
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw HttpStatusException(response.code)
                response.body?.string() ?: ""
            }
        }

    companion object {
        private const val PLAYLIST_TIMEOUT_MS = 20_000L
    }
}
