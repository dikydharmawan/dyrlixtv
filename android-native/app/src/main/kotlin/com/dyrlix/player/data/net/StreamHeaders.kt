package com.dyrlix.player.data.net

/** Port `constants/streamHeaders.ts`. */
object StreamHeaders {

    const val DEFAULT_USER_AGENT =
        "Mozilla/5.0 (Linux; Android 11; AndroidTV) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    val DEFAULT_STREAM_HEADERS: Map<String, String> = linkedMapOf(
        "User-Agent" to DEFAULT_USER_AGENT,
        "Accept" to "*/*",
    )

    /** `mergeStreamHeaders` — perbandingan kunci case-insensitive, channel menang. */
    fun merge(channelHeaders: Map<String, String>?): Map<String, String> {
        val merged = LinkedHashMap<String, String>(DEFAULT_STREAM_HEADERS)
        if (channelHeaders.isNullOrEmpty()) return merged

        for ((key, value) in channelHeaders) {
            val lower = key.lowercase()
            val toRemove = merged.keys.filter { it.lowercase() == lower }
            toRemove.forEach { merged.remove(it) }
            merged[key] = value
        }
        return merged
    }

    /** `browserRetryHeaders` — UA paksa default + Referer/Origin dari URL. */
    fun browserRetryHeaders(url: String, base: Map<String, String>?): Map<String, String> {
        val headers = LinkedHashMap(merge(base))
        headers["User-Agent"] = DEFAULT_USER_AGENT
        try {
            val uri = java.net.URI(url)
            val scheme = uri.scheme
            val host = uri.host
            if (scheme != null && host != null) {
                val builder = StringBuilder().append(scheme).append("://").append(host)
                val port = uri.port
                val isDefaultPort = (scheme == "http" && port == 80) ||
                    (scheme == "https" && port == 443)
                if (port != -1 && !isDefaultPort) builder.append(':').append(port)
                val origin = builder.toString()
                headers["Referer"] = "$origin/"
                if (headers["Origin"].isNullOrEmpty()) headers["Origin"] = origin
            }
        } catch (_: Exception) {
            // URL tidak valid → biarkan header apa adanya
        }
        return headers
    }
}
