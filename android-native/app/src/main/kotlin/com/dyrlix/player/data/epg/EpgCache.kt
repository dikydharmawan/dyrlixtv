package com.dyrlix.player.data.epg

import com.dyrlix.player.data.model.EpgGuide
import com.dyrlix.player.data.model.EpgProgramme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put
import java.io.File

/**
 * Cache guide EPG sebagai berkas terpisah `cacheDir/epg/<hash>-<date>.json`
 * (keputusan EPG-1, menggantikan AsyncStorage). Format payload sama persis
 * dengan versi RN: `{ "date": "...", "guide": { id: [[start,stop,title?,desc?]] } }`.
 */
class FileEpgCache(cacheDir: File) : EpgCache {

    private val dir = File(cacheDir, "epg")
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    override suspend fun read(key: String, dateKey: String): EpgGuide? = withContext(Dispatchers.IO) {
        try {
            val file = fileFor(key)
            if (!file.exists()) return@withContext null
            val root = json.parseToJsonElement(file.readText()) as? JsonObject
                ?: return@withContext null
            if (root["date"]?.jsonPrimitive?.contentOrNull != dateKey) return@withContext null
            val guide = root["guide"] as? JsonObject ?: return@withContext null
            expandGuide(guide)
        } catch (e: Exception) {
            // cache rusak → anggap tidak ada
            null
        }
    }

    override suspend fun write(key: String, dateKey: String, guide: EpgGuide) {
        withContext(Dispatchers.IO) {
            try {
                val payload = compactPayload(dateKey, guide)
                if (payload.length > CACHE_MAX_BYTES) return@withContext
                if (!dir.exists()) dir.mkdirs()
                fileFor(key).writeText(payload)
            } catch (e: Exception) {
                // gagal menyimpan cache bukan masalah fatal
            }
        }
    }

    private fun fileFor(key: String): File = File(dir, key.replace(':', '-') + ".json")

    private fun compactPayload(dateKey: String, guide: EpgGuide): String {
        val root = buildJsonObject {
            put("date", dateKey)
            put(
                "guide",
                buildJsonObject {
                    for ((channelId, list) in guide) {
                        put(
                            channelId,
                            buildJsonArray {
                                for (programme in list) {
                                    add(
                                        buildJsonArray {
                                            add(JsonPrimitive(programme.start))
                                            add(JsonPrimitive(programme.stop))
                                            add(JsonPrimitive(programme.title))
                                            if (!programme.description.isNullOrEmpty()) {
                                                add(JsonPrimitive(programme.description))
                                            }
                                        },
                                    )
                                }
                            },
                        )
                    }
                },
            )
        }
        return root.toString()
    }

    private fun expandGuide(guide: JsonObject): EpgGuide {
        val result = LinkedHashMap<String, List<EpgProgramme>>()
        for ((channelId, value) in guide) {
            val entries = value as? JsonArray ?: continue
            val list = ArrayList<EpgProgramme>(entries.size)
            for (element in entries) {
                val entry = element as? JsonArray ?: continue
                if (entry.size < 3) continue
                list.add(
                    EpgProgramme(
                        channelId = channelId,
                        start = entry[0].jsonPrimitive.long,
                        stop = entry[1].jsonPrimitive.long,
                        title = entry[2].jsonPrimitive.content,
                        description = if (entry.size >= 4) {
                            entry[3].jsonPrimitive.contentOrNull
                        } else {
                            null
                        },
                    ),
                )
            }
            result[channelId] = list
        }
        return result
    }

    companion object {
        private const val CACHE_MAX_BYTES = 4_500_000
    }
}
