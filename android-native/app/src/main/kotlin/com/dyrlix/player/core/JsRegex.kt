package com.dyrlix.player.core

/**
 * Java's `\s` hanya mencakup `[ \t\n\x0B\f\r]`, sedangkan `\s` JavaScript
 * mencakup seluruh Unicode whitespace. Konstanta ini menyamakan keduanya
 * agar port regex dari RN tetap identik.
 */
object JsRegex {
    /** Setara kelas karakter `\s` milik JavaScript (tanpa kuantifier). */
    const val WS_CLASS: String =
        "[\\t\\n\\x0B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]"

    /** Setara `\s+`. */
    const val WS_PLUS: String = "$WS_CLASS+"

    /** Setara `\s*`. */
    const val WS_STAR: String = "$WS_CLASS*"

    /** Setara `\s` (satu karakter). */
    const val WS: String = WS_CLASS

    /** Isi kelas `\s` tanpa kurung siku, untuk dipakai di kelas ternegasi `[^...]`. */
    const val WS_CONTENT: String =
        "\\t\\n\\x0B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"

    /**
     * Himpunan kode karakter `\s` JavaScript. Dipakai untuk `trim()` karena
     * `String.trim()` Kotlin (Character.isWhitespace) TIDAK menghapus NBSP/U+2028
     * sedangkan JavaScript `String.prototype.trim` menghapusnya.
     */
    val WHITESPACE_CODES: Set<Int> = buildSet {
        addAll(listOf(0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20, 0xA0, 0x1680))
        for (c in 0x2000..0x200A) add(c)
        addAll(listOf(0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF))
    }

    fun isWhitespace(c: Char): Boolean = c.code in WHITESPACE_CODES

    /** Setara `String.prototype.trim()`. */
    fun trimJs(s: String): String = s.trim { isWhitespace(it) }
}
