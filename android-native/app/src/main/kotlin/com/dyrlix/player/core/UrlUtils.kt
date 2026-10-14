package com.dyrlix.player.core

/** Port `utils/url.ts`. */
object UrlUtils {

    private val STREAM_URL_REGEX =
        Regex("^https?://[^${JsRegex.WS_CONTENT}]+$", RegexOption.IGNORE_CASE)

    /** `isValidStreamUrl` */
    fun isValidStreamUrl(value: String?): Boolean {
        if (value.isNullOrEmpty()) return false
        return STREAM_URL_REGEX.matches(value.trim())
    }

    /** `deriveNameFromUrl` */
    fun deriveNameFromUrl(value: String, fallback: String = "Playlist"): String {
        return try {
            val cleaned = Regex("^https?://", RegexOption.IGNORE_CASE)
                .replace(value.trim(), "")
            val withoutQuery = cleaned.split(Regex("[?#]"))[0]
            val segments = withoutQuery.split('/').filter { it.isNotEmpty() }
            val host = segments.firstOrNull() ?: fallback
            val lastSegment = if (segments.size > 1) segments.last() else ""
            val prettyFile = if (lastSegment.isNotEmpty()) {
                decodeUriComponent(
                    Regex("\\.(m3u8?|txt)$", RegexOption.IGNORE_CASE)
                        .replace(lastSegment, ""),
                )
            } else {
                ""
            }
            if (prettyFile.isNotEmpty() && !prettyFile.contains('.')) {
                "$prettyFile — $host"
            } else {
                host
            }
        } catch (_: Exception) {
            fallback
        }
    }

    /**
     * Setara `decodeURIComponent`: hanya `%XX` yang di-decode, `+` TIDAK menjadi
     * spasi (berbeda dari `java.net.URLDecoder`), dan escape rusak melempar error.
     */
    private fun decodeUriComponent(input: String): String {
        val bytes = ArrayList<Byte>(input.length)
        var i = 0
        while (i < input.length) {
            val c = input[i]
            if (c == '%') {
                require(i + 3 <= input.length) { "URI malformed" }
                val hex = input.substring(i + 1, i + 3)
                val value = hex.toIntOrNull(16) ?: throw IllegalArgumentException("URI malformed")
                bytes.add(value.toByte())
                i += 3
            } else {
                c.toString().toByteArray(Charsets.UTF_8).forEach { bytes.add(it) }
                i += 1
            }
        }
        return String(bytes.toByteArray(), Charsets.UTF_8)
    }
}
