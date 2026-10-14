package com.dyrlix.player.data.epg

import com.dyrlix.player.core.JsRegex
import java.util.Calendar
import java.util.GregorianCalendar
import java.util.TimeZone

/** Utilitas XMLTV/EPG — port `services/epg.ts`. */
object EpgXml {

    private val AT_SUFFIX = Regex("@.*$")
    private val NON_ALNUM = Regex("[^a-z0-9]")

    /** `normalizeEpgId`: huruf kecil, buang kualitas `@SD`, buang pemisah. */
    fun normalizeEpgId(id: String): String {
        return id.lowercase()
            .replace(AT_SUFFIX, "")
            .replace(NON_ALNUM, "")
    }

    private val XMLTV_TIME = Regex(
        "^(\\d{4})(\\d{2})(\\d{2})(\\d{2})(\\d{2})(\\d{2})?${JsRegex.WS_STAR}([+-]\\d{2}:?\\d{2})?",
    )

    /**
     * `parseXmltvTime` → epoch ms, atau `NaN` bila tidak valid.
     * Tanpa zona waktu → diperlakukan UTC; detik opsional; tahun 0–99 → +1900
     * (perilaku `Date.UTC`).
     */
    fun parseXmltvTime(value: String?): Double {
        if (value.isNullOrEmpty()) return Double.NaN
        val match = XMLTV_TIME.find(JsRegex.trimJs(value)) ?: return Double.NaN
        val groups = match.groupValues
        val yearRaw = groups[1].toInt()
        val year = if (yearRaw in 0..99) yearRaw + 1900 else yearRaw
        val month = groups[2].toInt() - 1
        val day = groups[3].toInt()
        val hour = groups[4].toInt()
        val minute = groups[5].toInt()
        val second = groups[6].ifEmpty { "00" }.toInt()
        val tz = groups[7]

        val calendar = GregorianCalendar(TimeZone.getTimeZone("UTC")).apply {
            isLenient = true
            clear()
            set(year, month, day, hour, minute, second)
        }
        var ms = calendar.timeInMillis.toDouble()

        if (tz.isNotEmpty()) {
            val clean = tz.replace(":", "")
            val sign = if (clean[0] == '-') -1 else 1
            val offsetMinutes = clean.substring(1, 3).toInt() * 60 + clean.substring(3, 5).toInt()
            ms -= sign * offsetMinutes * 60000
        }
        return ms
    }

    private val NUM_ENTITY = Regex("&#(\\d+);")
    private val HEX_ENTITY = Regex("&#x([0-9a-fA-F]+);")

    /** `decodeEntities` — `&amp;` paling akhir agar entity bersarang benar. */
    fun decodeEntities(input: String): String {
        var result = input
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
        result = NUM_ENTITY.replace(result) { codePointString(it.groupValues[1].toInt()) }
        result = HEX_ENTITY.replace(result) { codePointString(it.groupValues[1].toInt(16)) }
        result = result.replace("&amp;", "&")
        return result
    }

    private fun codePointString(codePoint: Int): String =
        StringBuilder().appendCodePoint(codePoint).toString()

    /** `hashString`: FNV-1a 32-bit atas UTF-16 code unit, cetak base-36. */
    fun hashString(input: String): String {
        var hash = 2166136261L
        for (char in input) {
            hash = hash xor char.code.toLong()
            hash = (hash * 16777619L) and 0xFFFFFFFFL
        }
        return hash.toString(36)
    }

    /** `localDateKey` — tanggal lokal `YYYY-MM-DD`. */
    fun localDateKey(): String {
        val now = Calendar.getInstance()
        val month = (now.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
        val day = now.get(Calendar.DAY_OF_MONTH).toString().padStart(2, '0')
        return "${now.get(Calendar.YEAR)}-$month-$day"
    }
}

/** Dekoder UTF-8 bertahap (aman antar-chunk), port `createUtf8Decoder`. */
class Utf8StreamDecoder {
    private var codePoint = 0
    private var needed = 0

    fun decode(bytes: ByteArray, offset: Int = 0, length: Int = bytes.size): String {
        val out = StringBuilder()
        var i = offset
        val end = offset + length
        while (i < end) {
            val byte = bytes[i].toInt() and 0xFF
            if (needed == 0) {
                when {
                    byte < 0x80 -> out.append(byte.toChar())
                    byte in 0xC0..0xDF -> {
                        codePoint = byte and 0x1F
                        needed = 1
                    }

                    byte in 0xE0..0xEF -> {
                        codePoint = byte and 0x0F
                        needed = 2
                    }

                    byte in 0xF0..0xF7 -> {
                        codePoint = byte and 0x07
                        needed = 3
                    }

                    else -> out.append('\uFFFD')
                }
            } else if (byte in 0x80..0xBF) {
                codePoint = (codePoint shl 6) or (byte and 0x3F)
                needed -= 1
                if (needed == 0) {
                    out.appendCodePoint(codePoint)
                    codePoint = 0
                }
            } else {
                out.append('\uFFFD')
                needed = 0
                codePoint = 0
                i -= 1
            }
            i += 1
        }
        return out.toString()
    }
}

/** Parser XMLTV bertahap, port `XmltvCollector`. */
class XmltvCollector(now: Long) {

    private val guide = LinkedHashMap<String, MutableList<com.dyrlix.player.data.model.EpgProgramme>>()
    private var buffer = ""

    private val windowStart: Double = (now - WINDOW_BACK_MS).toDouble()
    private val windowEnd: Double = (now + WINDOW_FORWARD_MS).toDouble()

    fun feed(text: String) {
        buffer += text
        if (buffer.length > 2_000_000 && !buffer.contains(PROGRAMME_OPEN)) {
            buffer = ""
            return
        }
        var close = buffer.indexOf(PROGRAMME_CLOSE)
        while (close != -1) {
            val open = buffer.lastIndexOf(PROGRAMME_OPEN, close)
            if (open != -1) {
                handleBlock(buffer.substring(open, close + PROGRAMME_CLOSE.length))
            }
            buffer = buffer.substring(close + PROGRAMME_CLOSE.length)
            close = buffer.indexOf(PROGRAMME_CLOSE)
        }
    }

    fun finish(): Map<String, List<com.dyrlix.player.data.model.EpgProgramme>> {
        if (buffer.isNotEmpty()) feed(buffer)
        guide.values.forEach { list -> list.sortBy { it.start } }
        return guide.mapValues { it.value.toList() }
    }

    private fun handleBlock(block: String) {
        val gt = block.indexOf('>')
        if (gt < 0) return
        val attributes = block.substring(0, gt)

        val rawChannelId = CHANNEL_ATTR.find(attributes)?.groupValues?.get(1) ?: return
        if (rawChannelId.isEmpty()) return
        val channelId = EpgXml.normalizeEpgId(rawChannelId)
        if (channelId.isEmpty()) return

        val start = EpgXml.parseXmltvTime(START_ATTR.find(attributes)?.groupValues?.get(1))
        val stop = EpgXml.parseXmltvTime(STOP_ATTR.find(attributes)?.groupValues?.get(1))
        if (!start.isFinite() || !stop.isFinite()) return
        if (stop < windowStart || start > windowEnd) return

        val rawTitle = TITLE_REGEX.find(block)?.groupValues?.get(1) ?: ""
        val title = JsRegex.trimJs(
            WS_COLLAPSE.replace(EpgXml.decodeEntities(TAG_STRIP.replace(rawTitle, " ")), " "),
        )
        if (title.isEmpty()) return

        val rawDescription = DESC_REGEX.find(block)?.groupValues?.get(1)
        val description = if (rawDescription != null) {
            JsRegex.trimJs(
                WS_COLLAPSE.replace(
                    EpgXml.decodeEntities(TAG_STRIP.replace(rawDescription, " ")),
                    " ",
                ),
            )
        } else {
            ""
        }

        guide.getOrPut(channelId) { ArrayList() }.add(
            com.dyrlix.player.data.model.EpgProgramme(
                channelId = channelId,
                start = start.toLong(),
                stop = stop.toLong(),
                title = title,
                description = description.take(MAX_DESCRIPTION).ifEmpty { null },
            ),
        )
    }

    companion object {
        private const val CACHE_MAX_BYTES = 4_500_000
        private const val WINDOW_BACK_MS = 3 * 60 * 60 * 1000L
        private const val WINDOW_FORWARD_MS = 24 * 60 * 60 * 1000L
        private const val MAX_DESCRIPTION = 140

        private const val PROGRAMME_OPEN = "<programme"
        private const val PROGRAMME_CLOSE = "</programme>"

        private val CHANNEL_ATTR = Regex("channel=\"([^\"]*)\"", RegexOption.IGNORE_CASE)
        private val START_ATTR = Regex("start=\"([^\"]*)\"", RegexOption.IGNORE_CASE)
        private val STOP_ATTR = Regex("stop=\"([^\"]*)\"", RegexOption.IGNORE_CASE)
        private val TITLE_REGEX =
            Regex("<title\\b[^>]*>([\\s\\S]*?)</title>", RegexOption.IGNORE_CASE)
        private val DESC_REGEX =
            Regex("<desc\\b[^>]*>([\\s\\S]*?)</desc>", RegexOption.IGNORE_CASE)
        private val TAG_STRIP = Regex("<[^>]*>")
        private val WS_COLLAPSE = Regex(JsRegex.WS_PLUS)
    }
}
