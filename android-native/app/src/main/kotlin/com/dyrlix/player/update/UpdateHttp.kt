package com.dyrlix.player.update

import com.dyrlix.player.data.net.HttpStatusException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

/** GET teks sederhana dengan header; melempar `HttpStatusException` bila non-2xx. */
fun interface HttpGetClient {
    suspend fun get(url: String, headers: Map<String, String>): String
}

class OkHttpHttpGetClient(private val client: OkHttpClient) : HttpGetClient {
    override suspend fun get(url: String, headers: Map<String, String>): String =
        withContext(Dispatchers.IO) {
            val builder = Request.Builder().url(url)
            headers.forEach { (key, value) -> builder.header(key, value) }
            client.newCall(builder.build()).execute().use { response ->
                if (!response.isSuccessful) throw HttpStatusException(response.code)
                response.body?.string() ?: ""
            }
        }
}

/** Pengunduh APK ke berkas; mengembalikan kode HTTP respons. */
fun interface ApkDownloader {
    suspend fun download(url: String, target: File): Int
}

class OkHttpApkDownloader(private val client: OkHttpClient) : ApkDownloader {
    override suspend fun download(url: String, target: File): Int = withContext(Dispatchers.IO) {
        val request = Request.Builder().url(url).build()
        client.newCall(request).execute().use { response ->
            if (response.isSuccessful) {
                target.parentFile?.mkdirs()
                response.body?.byteStream()?.use { input ->
                    target.outputStream().use { output -> input.copyTo(output) }
                }
            }
            response.code
        }
    }
}
