package com.dyrlix.player.core

import com.dyrlix.player.data.model.Channel

/** Port `constants/channels.ts`. */
object Channels {

    /** Endpoint HLS resmi TVRI (kanal publik). */
    private const val TVRI_HLS = "https://ott-balancer.tvri.go.id/live/eds"

    /** Stream contoh (DEMO) publik. */
    private const val DEMO_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"

    private const val TVRI_LOGO =
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/TVRI_2023.svg/240px-TVRI_2023.svg.png"

    /** Playlist M3U bawaan yang dimuat di Beranda. */
    const val DEFAULT_PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.m3u"

    /** Daftar channel bawaan (fallback bila jaringan & cache gagal). */
    val DEFAULT_CHANNELS: List<Channel> = listOf(
        Channel(
            id = "tvri-nasional",
            name = "TVRI Nasional",
            group = "Nasional",
            url = "$TVRI_HLS/Nasional/hls/Nasional.m3u8",
            logo = TVRI_LOGO,
        ),
        Channel(
            id = "tvri-sport",
            name = "TVRI Sport",
            group = "Olahraga",
            url = "$TVRI_HLS/SportHD/hls/SportHD.m3u8",
            logo = TVRI_LOGO,
        ),
        Channel(id = "trans-tv", name = "Trans TV", group = "Hiburan", url = DEMO_HLS, isDemo = true),
        Channel(id = "trans7", name = "Trans7", group = "Hiburan", url = DEMO_HLS, isDemo = true),
        Channel(id = "tvone", name = "TVOne", group = "Berita", url = DEMO_HLS, isDemo = true),
        Channel(id = "kompas-tv", name = "Kompas TV", group = "Berita", url = DEMO_HLS, isDemo = true),
    )
}
