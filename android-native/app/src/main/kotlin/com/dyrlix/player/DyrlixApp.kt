package com.dyrlix.player

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.dyrlix.player.di.AppContainer

class DyrlixApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_PLAYBACK,
                getString(R.string.channel_playback),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.channel_playback_desc)
                setShowBadge(false)
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_UPDATES,
                getString(R.string.channel_updates),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = getString(R.string.channel_updates_desc)
                setShowBadge(false)
            },
        )
    }

    companion object {
        const val CHANNEL_PLAYBACK = "playback"
        const val CHANNEL_UPDATES = "updates"
    }
}
