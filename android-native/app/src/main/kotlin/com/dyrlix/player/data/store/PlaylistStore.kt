package com.dyrlix.player.data.store

import com.dyrlix.player.core.UrlUtils
import com.dyrlix.player.data.m3u.M3uParser
import com.dyrlix.player.data.model.Playlist
import com.dyrlix.player.data.model.PlaylistType
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.random.Random

/** Error validasi playlist dengan pesan persis seperti RN. */
class PlaylistValidationException(message: String) : Exception(message)

/** Input `addPlaylist`, padanan `AddPlaylistInput`. */
data class AddPlaylistInput(
    val mode: PlaylistType,
    val url: String? = null,
    val content: String? = null,
    val name: String? = null,
)

/**
 * Port `services/playlistStorage.ts` (AsyncStorage → DataStore). Normalisasi
 * ketat dipertahankan agar data lama/rusak tetap kompatibel.
 */
class PlaylistStore(
    private val store: KvStore,
    private val now: () -> Long = System::currentTimeMillis,
    private val random: Random = Random.Default,
) {

    @OptIn(ExperimentalSerializationApi::class)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    suspend fun getPlaylists(): List<Playlist> {
        val raw = store.get(STORAGE_KEY) ?: return emptyList()
        val parsed: JsonElement = runCatching { json.parseToJsonElement(raw) }.getOrNull()
            ?: return emptyList()
        val array = parsed as? JsonArray ?: return emptyList()
        return array.mapNotNull { normalizePlaylist(it) }.sortedByDescending { it.addedAt }
    }

    suspend fun getPlaylistById(id: String): Playlist? =
        getPlaylists().firstOrNull { it.id == id }

    suspend fun addPlaylist(input: AddPlaylistInput): Playlist {
        val name = input.name?.trim()?.takeUnless { it.isEmpty() }
        val existing = getPlaylists()

        val playlist = if (input.mode == PlaylistType.CONTENT) {
            val content = input.content?.trim()
            if (content.isNullOrEmpty()) {
                throw PlaylistValidationException("Isi teks M3U tidak boleh kosong.")
            }
            val parsed = M3uParser.parseM3U(content, "preview")
            if (parsed.isEmpty()) {
                throw PlaylistValidationException(
                    "Teks tidak mengandung channel M3U yang valid " +
                        "(butuh baris #EXTINF + URL stream).",
                )
            }
            if (existing.any { it.type == PlaylistType.CONTENT && it.content == content }) {
                throw PlaylistValidationException("Playlist dengan isi yang sama sudah tersimpan.")
            }
            Playlist(
                id = generateId(),
                name = name ?: "${parsed.size} channel (tempel)",
                url = "",
                addedAt = now(),
                type = PlaylistType.CONTENT,
                content = content,
                channelCount = parsed.size,
            )
        } else {
            val url = input.url?.trim() ?: ""
            if (url.isEmpty()) {
                throw PlaylistValidationException("Tautan playlist tidak boleh kosong.")
            }
            if (!UrlUtils.isValidStreamUrl(url)) {
                throw PlaylistValidationException(
                    "Tautan tidak valid. Gunakan URL http(s) yang benar.",
                )
            }
            if (existing.any { it.url == url }) {
                throw PlaylistValidationException("Playlist dengan tautan ini sudah tersimpan.")
            }
            Playlist(
                id = generateId(),
                name = name ?: UrlUtils.deriveNameFromUrl(url),
                url = url,
                addedAt = now(),
                type = PlaylistType.URL,
            )
        }

        write(listOf(playlist) + existing)
        return playlist
    }

    suspend fun removePlaylist(id: String): List<Playlist> {
        val next = getPlaylists().filter { it.id != id }
        write(next)
        return next
    }

    private suspend fun write(playlists: List<Playlist>) {
        store.put(STORAGE_KEY, json.encodeToString(ListSerializer(Playlist.serializer()), playlists))
    }

    private fun generateId(): String {
        val time = now().toString(36)
        val suffix = buildString(6) { repeat(6) { append(BASE36[random.nextInt(BASE36.length)]) } }
        return "$time-$suffix"
    }

    /** Padanan `normalizePlaylist` — buang entri yang tidak punya `id`/`name`/`addedAt` bertipe benar. */
    private fun normalizePlaylist(value: JsonElement): Playlist? {
        val candidate = value as? JsonObject ?: return null

        val id = stringField(candidate, "id") ?: return null
        val name = stringField(candidate, "name") ?: return null

        val addedAtPrim = candidate["addedAt"]
        if (addedAtPrim !is JsonPrimitive || addedAtPrim.isString) return null
        val addedAt = addedAtPrim.content.toLongOrNull()
            ?: addedAtPrim.content.toDoubleOrNull()?.toLong()
            ?: return null

        val type = if (stringField(candidate, "type") == "content") {
            PlaylistType.CONTENT
        } else {
            PlaylistType.URL
        }

        val channelCountPrim = candidate["channelCount"]
        val channelCount = if (channelCountPrim is JsonPrimitive && !channelCountPrim.isString) {
            channelCountPrim.content.toIntOrNull()
        } else {
            null
        }

        return Playlist(
            id = id,
            name = name,
            url = stringField(candidate, "url") ?: "",
            addedAt = addedAt,
            type = type,
            content = stringField(candidate, "content"),
            channelCount = channelCount,
        )
    }

    private fun stringField(obj: JsonObject, key: String): String? {
        val prim = obj[key] as? JsonPrimitive ?: return null
        return if (prim.isString) prim.content else null
    }

    companion object {
        const val STORAGE_KEY = "playlists"

        private const val BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"
    }
}
