package com.dyrlix.player.core

import com.dyrlix.player.data.model.Channel

/** Port `utils/grid.ts`. `null` mewakili placeholder kosong. */
object GridUtils {

    /**
     * Menambahkan placeholder `null` agar baris terakhir grid tetap penuh.
     * Mengembalikan daftar yang sama bila tidak diperlukan.
     */
    fun withPlaceholders(items: List<Channel>, columns: Int): List<Channel?> {
        if (columns <= 1 || items.isEmpty()) return items
        val remainder = items.size % columns
        if (remainder == 0) return items

        val result = ArrayList<Channel?>(items.size + columns - remainder)
        result.addAll(items)
        repeat(columns - remainder) { result.add(null) }
        return result
    }

    /** Jumlah kolom berdasarkan lebar layar (padanan `hooks/useResponsive.ts`). */
    fun columnsFor(width: Int): Int = when {
        width >= 1800 -> 5
        width >= 1360 -> 4
        width >= 880 -> 3
        width >= 560 -> 2
        else -> 1
    }
}
