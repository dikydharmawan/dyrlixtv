package com.dyrlix.player.di

import android.content.Context
import com.dyrlix.player.data.epg.EpgRepository
import com.dyrlix.player.data.epg.FileEpgCache
import com.dyrlix.player.data.epg.OkHttpEpgFetcher
import com.dyrlix.player.data.net.OkHttpTextFetcher
import com.dyrlix.player.data.net.PlaylistLoader
import com.dyrlix.player.data.store.DataStoreKvStore
import com.dyrlix.player.data.store.DefaultPlaylistStore
import com.dyrlix.player.data.store.PlaylistStore
import com.dyrlix.player.update.OkHttpApkDownloader
import com.dyrlix.player.update.OkHttpHttpGetClient
import com.dyrlix.player.update.ApkInstaller
import com.dyrlix.player.update.UpdateManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient

/** Lokasi dependensi aplikasi (pengganti singleton modul RN). */
class AppContainer(context: Context) {

    val applicationScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val httpClient: OkHttpClient = OkHttpClient.Builder().build()

    val kvStore = DataStoreKvStore(context)

    private val textFetcher = OkHttpTextFetcher(httpClient)

    val epg: EpgRepository = EpgRepository(
        fetcher = OkHttpEpgFetcher(httpClient),
        cache = FileEpgCache(context.cacheDir),
        scope = applicationScope,
    )

    val playlists: PlaylistStore = PlaylistStore(kvStore)

    val defaultPlaylist: DefaultPlaylistStore = DefaultPlaylistStore(kvStore, textFetcher)

    val playlistLoader: PlaylistLoader = PlaylistLoader(textFetcher)

    val updateManager: UpdateManager = UpdateManager(OkHttpHttpGetClient(httpClient))

    val apkInstaller: ApkInstaller = ApkInstaller(context.applicationContext, OkHttpApkDownloader(httpClient))
}
