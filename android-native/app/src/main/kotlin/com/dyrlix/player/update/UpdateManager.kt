package com.dyrlix.player.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import com.dyrlix.player.BuildConfig
import com.dyrlix.player.data.net.HttpStatusException
import com.dyrlix.player.data.model.UpdateManifest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File

/** Hasil pemroresan update, padanan `UpdateResult`. */
sealed interface UpdateResult {
    data class Ok(
        val available: Boolean,
        val message: String? = null,
        val manifest: UpdateManifest? = null,
    ) : UpdateResult

    data class Error(val message: String) : UpdateResult
}

/** Versi terpasang, padanan `getInstalledVersion`. */
data class InstalledVersion(
    val versionName: String?,
    val versionCode: Int?,
)

/** Versi aplikasi terpasang dari `BuildConfig` (setara `expo-application`). */
fun installedVersion(): InstalledVersion =
    InstalledVersion(BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE)

/**
 * Port `services/updateManager.ts` — bagian jaringan/validasi. Unduh+pasang ada
 * di [ApkInstaller] karena butuh `Context`.
 */
class UpdateManager(
    private val client: HttpGetClient,
    private val now: () -> Long = System::currentTimeMillis,
    private val installed: () -> InstalledVersion = ::installedVersion,
) {

    private val json = Json { ignoreUnknownKeys = true }

    /** Periksa apakah ada versi lebih baru dari yang terpasang. */
    suspend fun checkForUpdates(manifestUrl: String): UpdateResult {
        val url = manifestUrl.trim()
        if (url.isEmpty()) return UpdateResult.Error("URL manifest update belum diisi.")
        return try {
            val current = installed()
            if (current.versionCode == null) {
                return UpdateResult.Error("Versi terpasang tidak bisa dibaca.")
            }
            val manifest = fetchManifest(url)
            val available = manifest.versionCode > current.versionCode
            UpdateResult.Ok(
                available = available,
                message = if (available) {
                    "Update ${manifest.versionName} tersedia."
                } else {
                    "Aplikasi sudah dalam versi terbaru."
                },
                manifest = manifest,
            )
        } catch (e: Exception) {
            UpdateResult.Error(e.message ?: "Gagal memeriksa update.")
        }
    }

    /** Ambil semua kandidat, pilih manifest dengan `versionCode` tertinggi. */
    private suspend fun fetchManifest(manifestUrl: String): UpdateManifest {
        var lastError: Exception? = null
        var best: UpdateManifest? = null

        for (candidate in candidateManifestUrls(manifestUrl)) {
            try {
                val text = client.get(
                    withCacheBuster(candidate),
                    mapOf("accept" to "application/json", "cache-control" to "no-cache"),
                )
                val manifest = parseManifest(text)
                if (best == null || manifest.versionCode > best.versionCode) {
                    best = manifest
                }
            } catch (e: HttpStatusException) {
                lastError = Exception("Server merespons HTTP ${e.code}")
            } catch (e: Exception) {
                lastError = e
            }
        }

        return best ?: throw (lastError ?: Exception("Gagal memuat manifest update."))
    }

    private fun parseManifest(text: String): UpdateManifest {
        val obj = json.parseToJsonElement(text) as? JsonObject
            ?: throw invalidManifest()
        val versionCodePrim = obj["versionCode"]
        if (versionCodePrim !is JsonPrimitive || versionCodePrim.isString) {
            throw invalidManifest()
        }
        val versionCode = versionCodePrim.content.toIntOrNull() ?: throw invalidManifest()
        val apkUrl = (obj["apkUrl"] as? JsonPrimitive)
            ?.takeIf { it.isString }
            ?.content
        if (apkUrl.isNullOrEmpty()) throw invalidManifest()

        val packageName = (obj["packageName"] as? JsonPrimitive)
            ?.takeIf { it.isString }
            ?.content
        val applicationId = BuildConfig.APPLICATION_ID
        if (applicationId.isNotEmpty() && packageName != null && packageName != applicationId) {
            throw IllegalStateException("Manifest update bukan untuk aplikasi ini.")
        }

        return UpdateManifest(
            packageName = packageName,
            versionCode = versionCode,
            versionName = (obj["versionName"] as? JsonPrimitive)
                ?.takeIf { it.isString }
                ?.content
                ?: "",
            apkUrl = apkUrl,
            notes = (obj["notes"] as? JsonPrimitive)?.takeIf { it.isString }?.content,
            publishedAt = (obj["publishedAt"] as? JsonPrimitive)?.takeIf { it.isString }?.content,
        )
    }

    private fun invalidManifest() =
        IllegalStateException("update.json tidak valid (butuh versionCode & apkUrl).")

    /** Tambah query anti-cache agar CDN/proxy tidak menyajikan manifest lama. */
    fun withCacheBuster(url: String): String {
        val separator = if (url.contains("?")) "&" else "?"
        return "$url${separator}t=${now()}"
    }

    companion object {
        /** URL manifest default (app.json `extra.updateManifestUrl`). */
        const val DEFAULT_MANIFEST_URL =
            "https://raw.githubusercontent.com/dikydharmawan/dyrlixtv/gh-pages/update.json"

        private val JSDELIVR =
            Regex("^https?://cdn\\.jsdelivr\\.net/gh/([^/@]+)/([^/@]+)@([^/]+)/(.+)$")

        /**
         * Kandidat URL untuk manifest yang sama. jsDelivr `@branch` bisa macet
         * hingga 12 jam, jadi tambahkan padanan `raw.githubusercontent`.
         */
        fun candidateManifestUrls(url: String): List<String> {
            val urls = arrayListOf(url)
            val match = JSDELIVR.find(url)
            if (match != null) {
                val (user, repo, ref, path) = match.destructured
                urls.add("https://raw.githubusercontent.com/$user/$repo/$ref/$path")
            }
            return urls
        }
    }
}

/** Unduh APK lalu buka installer sistem, padanan `downloadAndInstall`. */
class ApkInstaller(
    private val context: Context,
    private val downloader: ApkDownloader,
) {

    suspend fun downloadAndInstall(manifest: UpdateManifest): UpdateResult {
        return try {
            val fileName = "dyrlix-${manifest.versionCode}.apk"
            val target = File(context.cacheDir, fileName)

            val status = downloader.download(manifest.apkUrl, target)
            if (status >= 400) {
                throw IllegalStateException("Download gagal (HTTP $status).")
            }

            val authority = "${context.packageName}.fileprovider"
            val uri = FileProvider.getUriForFile(context, authority, target)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(intent)
            UpdateResult.Ok(available = false, message = "Installer aplikasi telah dibuka.")
        } catch (e: Exception) {
            UpdateResult.Error(e.message ?: "Gagal membuka installer.")
        }
    }

    /** Buka pengaturan "Instal aplikasi tidak dikenal" untuk aplikasi ini. */
    fun openInstallPermissionSettings() {
        val packageName = context.packageName.ifEmpty { "com.dyrlix.player" }
        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:$packageName"),
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }
}
