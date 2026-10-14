package com.dyrlix.player.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** 1:1 dengan constants/theme.ts `spacing`. */
object Spacing {
    val xs: Dp = 4.dp
    val sm: Dp = 8.dp
    val md: Dp = 12.dp
    val lg: Dp = 16.dp
    val xl: Dp = 24.dp
    val xxl: Dp = 32.dp
}

/** 1:1 dengan constants/theme.ts `radius`. */
object Radius {
    val sm: Dp = 8.dp
    val md: Dp = 12.dp
    val lg: Dp = 18.dp
    val xl: Dp = 24.dp
    val pill: Dp = 999.dp
}

/** 1:1 dengan constants/theme.ts `layout.tvBreakpoint`. */
const val TvBreakpointDp = 1000

/**
 * Keputusan UI B: ukuran dipilih eksplisit untuk breakpoint TV dan compact.
 * [isTv] ditentukan dari lebar layar >= 1000dp.
 */
data class Dimens(
    val isTv: Boolean,
    /** Margin keselamatan TV (overscan) — 48dp di TV, 0 di compact. */
    val overscan: Dp,
    /** Gutter kontainer utama. */
    val gutter: Dp,
    val focusBorder: Dp,
    val sideNavWidth: Dp,
    val sideNavItemHeight: Dp,
    val cardLogo: Dp,
    val heroTitle: Dp,
    val bodyText: Dp,
)

val CompactDimens = Dimens(
    isTv = false,
    overscan = 0.dp,
    gutter = 16.dp,
    focusBorder = 2.dp,
    sideNavWidth = 84.dp,
    sideNavItemHeight = 52.dp,
    cardLogo = 140.dp,
    heroTitle = 42.dp,
    bodyText = 16.dp,
)

val TvDimens = Dimens(
    isTv = true,
    overscan = 48.dp,
    gutter = 30.dp,
    focusBorder = 3.dp,
    sideNavWidth = 272.dp,
    sideNavItemHeight = 64.dp,
    cardLogo = 170.dp,
    heroTitle = 52.dp,
    bodyText = 20.dp,
)
