package com.dyrlix.player.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.sp

/** Ukuran huruf dipetakan eksplisit per breakpoint, tidak memakai faktor skala global. */
private fun style(size: Int, lineHeight: Int = (size * 1.2f).toInt()) = TextStyle(
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
)

val CompactTypography = Typography(
    displayLarge = style(42, 50),
    displayMedium = style(34, 41),
    displaySmall = style(26, 31),
    headlineLarge = style(26, 31),
    headlineMedium = style(22, 27),
    headlineSmall = style(20, 24),
    titleLarge = style(20, 24),
    titleMedium = style(16, 20),
    titleSmall = style(14, 17),
    bodyLarge = style(16, 24),
    bodyMedium = style(14, 21),
    bodySmall = style(12, 18),
    labelLarge = style(16, 20),
    labelMedium = style(14, 17),
    labelSmall = style(12, 14),
)

/** TV uses the RN TV tokens plus the approved 52dp far-view hero and 20dp body. */
val TvTypography = Typography(
    displayLarge = style(52, 62),
    displayMedium = style(42, 50),
    displaySmall = style(30, 36),
    headlineLarge = style(30, 36),
    headlineMedium = style(26, 32),
    headlineSmall = style(24, 29),
    titleLarge = style(26, 31),
    titleMedium = style(20, 24),
    titleSmall = style(18, 22),
    bodyLarge = style(20, 30),
    bodyMedium = style(18, 27),
    bodySmall = style(16, 24),
    labelLarge = style(20, 24),
    labelMedium = style(18, 22),
    labelSmall = style(16, 19),
)
