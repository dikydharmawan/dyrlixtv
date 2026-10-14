package com.dyrlix.player.player

import com.dyrlix.player.data.model.Channel

/**
 * Port `services/playbackQueue.ts`. Antrian channel in-memory untuk navigasi
 * next/prev pemutar; tidak dipersist (hanya berlaku sesi tonton).
 */
object PlaybackQueue {

    data class Queue(
        val channels: List<Channel>,
        val index: Int,
    )

    @Volatile
    private var queue: Queue? = null

    fun set(channels: List<Channel>, index: Int) {
        queue = Queue(channels, if (index >= 0) index else 0)
    }

    fun get(): Queue? = queue
}
