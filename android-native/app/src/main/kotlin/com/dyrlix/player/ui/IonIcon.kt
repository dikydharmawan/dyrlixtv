package com.dyrlix.player.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import com.dyrlix.player.R
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

private val IoniconsFont = FontFamily(Font(R.font.ionicons))

@Composable
fun IonIcon(
    name: String,
    contentDescription: String?,
    tint: Color,
    size: TextUnit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val glyphs = remember(context) {
        runCatching {
            Json.parseToJsonElement(
                context.assets.open("ionicons_codepoints.json").bufferedReader().use { it.readText() },
            ).jsonObject
                .mapNotNull { (key, value) -> runCatching { key to value.jsonPrimitive.int }.getOrNull() }
                .toMap()
        }.getOrDefault(emptyMap())
    }
    val glyph = glyphs[name]?.takeIf { it in 0..0xFFFF }?.toChar()?.toString().orEmpty()
    val iconModifier = if (contentDescription == null) modifier else modifier.semantics {
        this.contentDescription = contentDescription
    }
    Text(
        text = glyph,
        modifier = iconModifier,
        color = tint,
        fontFamily = IoniconsFont,
        fontSize = size,
        lineHeight = size,
        maxLines = 1,
    )
}
