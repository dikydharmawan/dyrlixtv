package com.dyrlix.player.data.epg

import com.dyrlix.player.core.JsRegex
import com.dyrlix.player.data.model.EpgGuide
import com.dyrlix.player.data.model.EpgProgramme
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.async
import kotlinx.coroutines.yield

/** Perkiraan acara sekarang/berikutnya, padanan `NowNext`. */
data class NowNext(
    val now: EpgProgramme?,
    val next: EpgProgramme?,
)

/** Sumber EPG jaringan, padanan `fetchGuide`. */
fun interface EpgFetcher {
    suspend fun fetchGuide(url: String, now: Long): EpgGuide
}

/** Cache guide per hari, padanan `readCachedGuide`/`writeCachedGuide`. */
interface EpgCache {
    suspend fun read(key: String, dateKey: String): EpgGuide?

    suspend fun write(key: String, dateKey: String, guide: EpgGuide)
}

/**
 * Port `services/epg.ts`. State module-level → state instance; state global app
 * disediakan lewat service locator.
 */
class EpgRepository(
    private val fetcher: EpgFetcher,
    private val cache: EpgCache,
    private val scope: CoroutineScope,
) {

    private val lock = Any()

    @Volatile
    private var guide: EpgGuide? = null

    private var loadedKey: String = ""
    private var inFlight: Deferred<EpgGuide?>? = null
    private var inFlightKey: String = ""

    private val listeners = java.util.concurrent.CopyOnWriteArraySet<(EpgGuide?) -> Unit>()

    fun getEpg(): EpgGuide? = guide

    fun subscribeEpg(listener: (EpgGuide?) -> Unit): () -> Unit {
        listeners.add(listener)
        return { listeners.remove(listener) }
    }

    fun resetEpg() {
        synchronized(lock) {
            guide = null
            loadedKey = ""
            inFlight = null
            inFlightKey = ""
        }
        listeners.forEach { it(null) }
    }

    private fun notifyListeners() {
        val current = guide
        listeners.forEach { it(current) }
    }

    /** `ensureEpgLoaded` dengan input tunggal (mis. `playlist.epgUrl`). */
    suspend fun ensureEpgLoaded(input: String?, force: Boolean = false): EpgGuide? =
        ensureLoaded(normalizeUrls(input?.let { listOf(it) }), force)

    /** `ensureEpgLoaded` dengan daftar URL. */
    suspend fun ensureEpgLoaded(inputs: List<String>, force: Boolean = false): EpgGuide? =
        ensureLoaded(normalizeUrls(inputs), force)

    private suspend fun ensureLoaded(urls: List<String>, force: Boolean): EpgGuide? {
        if (urls.isEmpty()) return null
        val dateKey = EpgXml.localDateKey()
        val key = "${EpgXml.hashString(urls.joinToString("|"))}:$dateKey"

        val shared: Deferred<EpgGuide?>
        synchronized(lock) {
            if (!force && guide != null && loadedKey == key) return guide!!
            val pending = inFlight
            if (pending != null && inFlightKey == key) {
                shared = pending
            } else {
                val task = scope.async { runLoad(urls, dateKey, key, force) }
                inFlight = task
                inFlightKey = key
                shared = task
            }
        }

        try {
            return shared.await()
        } finally {
            synchronized(lock) {
                if (inFlight === shared) {
                    inFlight = null
                    inFlightKey = ""
                }
            }
        }
    }

    private suspend fun runLoad(
        urls: List<String>,
        dateKey: String,
        key: String,
        force: Boolean,
    ): EpgGuide? {
        if (!force) {
            val cached = cache.read(key, dateKey)
            if (cached != null) {
                guide = cached
                loadedKey = key
                notifyListeners()
                return cached
            }
        }

        val merged = LinkedHashMap<String, MutableList<EpgProgramme>>()
        var any = false
        val now = System.currentTimeMillis()
        for (url in urls) {
            try {
                val partial = fetcher.fetchGuide(url, now)
                if (mergeGuides(merged, partial)) any = true
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // lewati sumber yang gagal
            }
            yield()
        }

        if (!any) return guide

        val deduped = dedupeGuide(merged)
        guide = deduped
        loadedKey = key
        notifyListeners()
        cache.write(key, dateKey, deduped)
        return deduped
    }

    /** `isLiveTitle`: penanda siaran langsung `(L)` / `live` / `langsung`. */
    fun isLiveTitle(title: String?): Boolean {
        if (title.isNullOrEmpty()) return false
        return LIVE_PAREN.containsMatchIn(title) || LIVE_WORD.containsMatchIn(title)
    }

    /** `getSchedule` — daftar acara untuk sebuah `tvg-id`. */
    fun getSchedule(tvgId: String?): List<EpgProgramme> {
        val current = guide
        if (tvgId.isNullOrEmpty() || current == null) return emptyList()
        return current[EpgXml.normalizeEpgId(tvgId)] ?: emptyList()
    }

    /** `getNowNext` — pencarian biner acara aktif + berikutnya. */
    fun getNowNext(tvgId: String?, at: Long = System.currentTimeMillis()): NowNext? {
        val current = guide
        if (tvgId.isNullOrEmpty() || current == null) return null
        val list = current[EpgXml.normalizeEpgId(tvgId)] ?: return null
        if (list.isEmpty()) return null

        var low = 0
        var high = list.size
        while (low < high) {
            val mid = (low + high) ushr 1
            if (list[mid].stop <= at) low = mid + 1 else high = mid
        }

        val candidate = list.getOrNull(low)
        val now = if (candidate != null && candidate.start <= at) candidate else null
        val next = if (now != null) list.getOrNull(low + 1) else candidate
        if (now == null && next == null) return null
        return NowNext(now, next)
    }

    companion object {
        /** Sumber EPG tambahan dari `services/epg.ts`. */
        val FALLBACK_EPG_URLS = listOf(
            "https://raw.githubusercontent.com/StrangeDrVN/epg/public/guide.xml.gz",
            "https://raw.githubusercontent.com/AqFad2811/epg/main/indonesia.xml",
            "https://raw.githubusercontent.com/kemalsyabaniadama/test-epg/main/guide.xml",
        )

        private val LIVE_PAREN = Regex("\\(l\\)", RegexOption.IGNORE_CASE)
        private val LIVE_WORD = Regex("\\b(live|langsung)\\b", RegexOption.IGNORE_CASE)

        /** `normalizeUrls`: pecah koma, dedupe, lalu tambahkan sumber cadangan. */
        fun normalizeUrls(input: List<String>?): List<String> {
            val raw = input ?: emptyList()
            val urls = ArrayList<String>()
            for (item in raw) {
                for (part in item.split(",")) {
                    val url = JsRegex.trimJs(part)
                    if (url.isNotEmpty() && !urls.contains(url)) urls.add(url)
                }
            }
            for (fallback in FALLBACK_EPG_URLS) {
                if (!urls.contains(fallback)) urls.add(fallback)
            }
            return urls
        }

        /** `mergeGuides` — gabung, kembalikan `true` bila ada yang ditambahkan. */
        fun mergeGuides(
            target: MutableMap<String, MutableList<EpgProgramme>>,
            source: EpgGuide,
        ): Boolean {
            var added = false
            for ((channelId, list) in source) {
                if (list.isEmpty()) continue
                target.getOrPut(channelId) { ArrayList() }.addAll(list)
                added = true
            }
            return added
        }

        /** `dedupeGuide` — urut `start` lalu buang duplikat `start-title`. */
        fun dedupeGuide(source: Map<String, List<EpgProgramme>>): EpgGuide {
            val result = LinkedHashMap<String, List<EpgProgramme>>()
            for ((channelId, list) in source) {
                val sorted = list.sortedBy { it.start }
                val seen = HashSet<String>()
                result[channelId] = sorted.filter { programme ->
                    seen.add("${programme.start}-${programme.title}")
                }
            }
            return result
        }
    }
}
