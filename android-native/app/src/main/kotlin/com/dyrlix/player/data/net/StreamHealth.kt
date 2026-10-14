package com.dyrlix.player.data.net

import com.dyrlix.player.core.UrlUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/** Port `utils/stream.ts`. */
object StreamHealth {

    enum class StreamCheck { OK, DEAD, NETWORK, INVALID }

    data class Detail(val status: StreamCheck, val httpStatus: Int? = null)

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .build()
    }

    /** `checkStreamDetail` — hanya 404/410 yang dianggap mati. */
    suspend fun checkDetail(
        url: String,
        timeoutMs: Long = 8000,
        headers: Map<String, String>? = null,
    ): Detail {
        if (!UrlUtils.isValidStreamUrl(url)) return Detail(StreamCheck.INVALID)

        val request = Request.Builder()
            .url(url)
            .get()
            .apply {
                StreamHeaders.merge(headers).forEach { (k, v) -> header(k, v) }
            }
            .build()

        val callClient = client.newBuilder()
            .callTimeout(timeoutMs, TimeUnit.MILLISECONDS)
            .build()

        return withContext(Dispatchers.IO) {
            try {
                callClient.newCall(request).execute().use { response ->
                    // Status header sudah cukup; body tidak dibaca (hemat kuota).
                    if (response.code == 404 || response.code == 410) {
                        Detail(StreamCheck.DEAD, response.code)
                    } else {
                        Detail(StreamCheck.OK, response.code)
                    }
                }
            } catch (_: Exception) {
                Detail(StreamCheck.NETWORK)
            }
        }
    }

    /** `describeStatus`. */
    fun describeStatus(code: Int): String? = when {
        code == 404 || code == 410 ->
            "Kanal tidak tersedia (HTTP 404) — tautan mati atau diblokir server."

        code == 403 ->
            "Server menolak akses (HTTP 403) — channel ini kemungkinan butuh " +
                "langganan/token atau memblokir hotlink."

        code == 451 ->
            "Channel diblokir (HTTP 451) — tidak tersedia untuk wilayah Anda."

        code >= 500 ->
            "Server channel sedang bermasalah (HTTP $code). Coba lagi nanti."

        code >= 400 ->
            "Permintaan ditolak server (HTTP $code)."

        else -> null
    }

    private val HTTP_STATUS_PATTERN = Regex("\\b([45]\\d\\d)\\b")

    private val NETWORK_PATTERN = Regex(
        "timeout|timed out|network|failed to connect|unreachable|ENOTFOUND|ECONN|abort",
        RegexOption.IGNORE_CASE,
    )

    fun detectStatus(message: String, httpStatus: Int?): Int? {
        if (httpStatus != null) return httpStatus
        val match = HTTP_STATUS_PATTERN.find(message) ?: return null
        return match.groupValues[1].toIntOrNull()
    }

    /** `friendlyStreamError`. */
    fun friendlyStreamError(raw: Throwable?, httpStatus: Int? = null): String? {
        val message = raw?.message
        if (message == null) {
            return httpStatus?.let { describeStatus(it) }
        }

        val code = detectStatus(message, httpStatus)
        if (code != null) {
            val described = describeStatus(code)
            if (described != null) return described
        }

        if (NETWORK_PATTERN.containsMatchIn(message)) {
            return "Tidak dapat terhubung ke channel. Periksa koneksi internet atau tautan."
        }
        return null
    }
}
