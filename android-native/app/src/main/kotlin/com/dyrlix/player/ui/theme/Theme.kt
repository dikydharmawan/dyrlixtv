package com.dyrlix.player.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import android.content.res.Configuration

val LocalDimens = staticCompositionLocalOf { CompactDimens }
val LocalIsTvDevice = staticCompositionLocalOf { false }

private val DyrlixColorScheme = darkColorScheme(
    primary = Palette.Primary,
    onPrimary = Palette.Black,
    primaryContainer = Palette.PrimaryDark,
    onPrimaryContainer = Palette.White,
    secondary = Palette.Accent,
    onSecondary = Palette.Black,
    secondaryContainer = Palette.SurfaceAlt,
    onSecondaryContainer = Palette.Text,
    tertiary = Palette.Success,
    onTertiary = Palette.Black,
    background = Palette.Background,
    onBackground = Palette.Text,
    surface = Palette.Surface,
    onSurface = Palette.Text,
    surfaceVariant = Palette.SurfaceAlt,
    onSurfaceVariant = Palette.TextMuted,
    surfaceContainer = Palette.BackgroundAlt,
    surfaceContainerHigh = Palette.Surface,
    surfaceContainerHighest = Palette.SurfaceAlt,
    surfaceContainerLow = Palette.BackgroundAlt,
    surfaceContainerLowest = Palette.Background,
    outline = Palette.Border,
    outlineVariant = Palette.Border,
    error = Palette.Danger,
    onError = Palette.White,
    errorContainer = Palette.DangerSoft,
    onErrorContainer = Palette.Danger,
    inverseSurface = Palette.Text,
    inverseOnSurface = Palette.Background,
    inversePrimary = Palette.PrimaryDark,
)

@Composable
fun DyrlixTheme(content: @Composable () -> Unit) {
    val configuration = LocalConfiguration.current
    val context = LocalContext.current
    val isWideLayout = configuration.screenWidthDp >= TvBreakpointDp
    val isTvDevice = (configuration.uiMode and Configuration.UI_MODE_TYPE_MASK) == Configuration.UI_MODE_TYPE_TELEVISION ||
        context.packageManager.hasSystemFeature("android.software.leanback")
    val dimens = if (isWideLayout) TvDimens else CompactDimens

    MaterialTheme(
        colorScheme = DyrlixColorScheme,
        typography = if (isWideLayout) TvTypography else CompactTypography,
    ) {
        CompositionLocalProvider(LocalDimens provides dimens, LocalIsTvDevice provides isTvDevice) {
            content()
        }
    }
}
