package com.dyrlix.player.core

import com.dyrlix.player.data.model.Channel

/** Port `utils/categories.ts`. */
object Categories {

    const val DEFAULT_GROUP = "Umum"

    data class Summary(
        val categories: List<String>,
        val counts: Map<String, Int>,
    )

    /** `summarizeCategories`: urut jumlah desc, tie-break nama naik. */
    fun summarize(channels: List<Channel>): Summary {
        val counts = LinkedHashMap<String, Int>()
        for (channel in channels) {
            val key = channel.group ?: DEFAULT_GROUP
            counts[key] = (counts[key] ?: 0) + 1
        }
        val categories = counts.keys.sortedWith(
            compareByDescending<String> { counts[it] }.thenBy { it },
        )
        return Summary(categories = categories, counts = counts)
    }
}
