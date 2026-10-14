package com.dyrlix.player.core

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Port `utils/format.ts`. */
object FormatUtils {

    private val ID_LOCALE = Locale("id", "ID")

    /** `formatDate` → mis. `11 Okt 2026`; error → `-`. */
    fun formatDate(timestamp: Long): String {
        return try {
            SimpleDateFormat("dd MMM yyyy", ID_LOCALE).format(Date(timestamp))
        } catch (_: Exception) {
            "-"
        }
    }
}
