package com.dyrlix.player.data.store

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import java.io.IOException

/** Abstraksi penyimpanan string sederhana (DataStore di produksi, in-memory saat uji). */
interface KvStore {
    suspend fun get(key: String): String?

    suspend fun put(key: String, value: String)
}

private val Context.dyrlixDataStore by preferencesDataStore(name = "dyrlix")

/** Implementasi DataStore Preferences untuk 3 key penyimpanan aplikasi. */
class DataStoreKvStore(context: Context) : KvStore {

    private val appContext = context.applicationContext

    override suspend fun get(key: String): String? {
        return try {
            appContext.dyrlixDataStore.data.first()[stringPreferencesKey(key)]
        } catch (e: IOException) {
            null
        }
    }

    override suspend fun put(key: String, value: String) {
        appContext.dyrlixDataStore.edit { prefs -> prefs[stringPreferencesKey(key)] = value }
    }
}

/** In-memory untuk pengujian unit (tanpa Android). */
class InMemoryKvStore : KvStore {
    private val map = LinkedHashMap<String, String>()

    override suspend fun get(key: String): String? = map[key]

    override suspend fun put(key: String, value: String) {
        map[key] = value
    }
}
