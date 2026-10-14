package com.dyrlix.player.data.m3u

import com.dyrlix.player.core.JsRegex
import com.dyrlix.player.data.model.Channel
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Port byte-for-byte `utils/m3uParser.ts`. */
object M3uParser {

    private val ATTRIBUTE_PATTERN = Regex("""([A-Za-z0-9_-]+)="([^"]*)"""")

    private val INVISIBLE_CHARS = Regex("[\\u200B-\\u200F\\u202A-\\u202E\\u2060\\uFEFF]")

    private val CURLY_QUOTES = Regex("[\u201C\u201D]")
    private val CRLF = Regex("\\r\\n?")
    private val LINE_SEP = Regex("[\u2028\u2029]")

    private val EXTINF = Regex("^#EXTINF", RegexOption.IGNORE_CASE)
    private val EXTHTTP = Regex("^#EXTHTTP:", RegexOption.IGNORE_CASE)
    private val KODIPROP = Regex("^#KODIPROP:", RegexOption.IGNORE_CASE)
    private val EXTVLCOPT = Regex("^#EXTVLCOPT:", RegexOption.IGNORE_CASE)

    private val HEADER_MATCH = Regex("#EXTM3U([^\\n\\r]*)", RegexOption.IGNORE_CASE)
    private val TVG_URL_MATCH =
        Regex("""(?:x-tvg-url|url-tvg)="([^"]+)"""", RegexOption.IGNORE_CASE)

    private val json = Json { ignoreUnknownKeys = true }

    private data class Pending(
        val name: String? = null,
        val logo: String? = null,
        val group: String? = null,
        val tvgId: String? = null,
        val headers: Map<String, String>? = null,
    )

    private fun normalizeContent(content: String): String {
        return content
            .replace(CURLY_QUOTES, "\"")
            .replace(CRLF, "\n")
            .replace(LINE_SEP, "\n")
            .replace(INVISIBLE_CHARS, "")
    }

    /** `extractEpgUrl` — memakai teks RAW (tanpa normalisasi). */
    fun extractEpgUrl(content: String?): String? {
        if (content.isNullOrEmpty()) return null
        val headerMatch = HEADER_MATCH.find(content) ?: return null
        val urlMatch = TVG_URL_MATCH.find(headerMatch.groupValues[1]) ?: return null
        val raw = JsRegex.trimJs(urlMatch.groupValues[1])
        return raw.ifEmpty { null }
    }

    private fun parseAttributes(input: String): Map<String, String> {
        val attributes = LinkedHashMap<String, String>()
        for (match in ATTRIBUTE_PATTERN.findAll(input)) {
            attributes[match.groupValues[1].lowercase()] = match.groupValues[2]
        }
        return attributes
    }

    private fun collectHeaders(pending: Pending?, line: String): Pending {
        val base = pending ?: Pending()
        val merged = LinkedHashMap<String, String>()
        base.headers?.let { merged.putAll(it) }

        when {
            EXTHTTP.containsMatchIn(line) -> {
                val raw = JsRegex.trimJs(line.substring("#EXTHTTP:".length))
                runCatching {
                    val parsed = json.parseToJsonElement(raw)
                    if (parsed is JsonObject) {
                        for ((key, value) in parsed) {
                            if (value is JsonPrimitive && value.isString) {
                                merged[key] = value.content
                            }
                        }
                    }
                }
            }

            KODIPROP.containsMatchIn(line) -> {
                val eq = line.indexOf('=')
                if (eq >= 0) {
                    val value = line.substring(eq + 1)
                    for (pair in value.split('|')) {
                        val i = pair.indexOf('=')
                        if (i > 0) {
                            val key = JsRegex.trimJs(pair.substring(0, i))
                            val value2 = JsRegex.trimJs(pair.substring(i + 1))
                            if (key.isNotEmpty() && value2.isNotEmpty()) merged[key] = value2
                        }
                    }
                }
            }

            EXTVLCOPT.containsMatchIn(line) -> {
                val eq = line.indexOf('=')
                if (eq >= 0) {
                    val key = JsRegex.trimJs(
                        line.substring("#EXTVLCOPT:".length, eq),
                    ).lowercase()
                    val value = JsRegex.trimJs(line.substring(eq + 1))
                    if (value.isNotEmpty()) {
                        when (key) {
                            "http-user-agent" -> merged["User-Agent"] = value
                            "http-referrer" -> merged["Referer"] = value
                            "http-origin" -> merged["Origin"] = value
                        }
                    }
                }
            }
        }

        return base.copy(headers = merged.ifEmpty { null })
    }

    private fun findNameSplitIndex(line: String): Int {
        var inQuotes = false
        for (i in line.indices) {
            val char = line[i]
            if (char == '"') {
                inQuotes = !inQuotes
            } else if (char == ',' && !inQuotes) {
                return i
            }
        }
        return -1
    }

    private fun cleanDisplayName(value: String): String {
        val trimmed = JsRegex.trimJs(value)
        return if (trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
            JsRegex.trimJs(trimmed.substring(1, trimmed.length - 1))
        } else {
            trimmed
        }
    }

    /** `parseM3U`. */
    fun parseM3U(content: String?, playlistId: String = "playlist"): List<Channel> {
        if (content.isNullOrEmpty()) return emptyList()

        val lines = normalizeContent(content).split('\n')
        val channels = ArrayList<Channel>()
        var pending: Pending? = null
        var index = 0

        for (rawLine in lines) {
            val line = JsRegex.trimJs(rawLine)
            if (line.isEmpty()) continue

            if (EXTINF.containsMatchIn(line)) {
                val commaIndex = findNameSplitIndex(line)
                val hasSeparator = commaIndex >= 0
                val meta = if (hasSeparator) line.substring(0, commaIndex) else line
                val displayName =
                    if (hasSeparator) cleanDisplayName(line.substring(commaIndex + 1)) else ""
                val attributes = parseAttributes(meta)
                pending = Pending(
                    name = displayName
                        .ifEmpty { attributes["tvg-name"] }
                        .takeUnless { it.isNullOrEmpty() }
                        ?: attributes["tvg-id"]?.ifEmpty { null },
                    logo = attributes["tvg-logo"]?.ifEmpty { null },
                    group = attributes["group-title"]?.ifEmpty { null },
                    tvgId = attributes["tvg-id"]?.ifEmpty { null },
                )
                continue
            }

            if (EXTHTTP.containsMatchIn(line) ||
                KODIPROP.containsMatchIn(line) ||
                EXTVLCOPT.containsMatchIn(line)
            ) {
                pending = collectHeaders(pending, line)
                continue
            }

            if (line.startsWith("#")) continue
            if (!line.contains("://")) continue

            channels.add(
                Channel(
                    id = "$playlistId-$index",
                    name = pending?.name?.let { JsRegex.trimJs(it) }?.ifEmpty { null }
                        ?: "Channel ${index + 1}",
                    url = line,
                    logo = pending?.logo,
                    group = pending?.group,
                    tvgId = pending?.tvgId,
                    headers = pending?.headers,
                ),
            )

            index += 1
            pending = null
        }

        return channels
    }
}
