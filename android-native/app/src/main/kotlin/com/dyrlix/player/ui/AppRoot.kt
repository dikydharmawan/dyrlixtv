package com.dyrlix.player.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.BackHandler
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.content.Intent
import android.net.Uri
import android.os.Build
import coil.compose.AsyncImage
import com.dyrlix.player.DyrlixApp
import com.dyrlix.player.core.Categories
import com.dyrlix.player.data.model.Channel
import com.dyrlix.player.data.model.Playlist
import com.dyrlix.player.data.model.PlaylistType
import com.dyrlix.player.data.epg.EpgXml
import com.dyrlix.player.data.epg.EpgRepository
import com.dyrlix.player.data.store.AddPlaylistInput
import com.dyrlix.player.data.net.StreamHealth
import com.dyrlix.player.data.net.StreamHeaders
import com.dyrlix.player.player.PlaybackQueue
import com.dyrlix.player.update.UpdateManager
import com.dyrlix.player.update.UpdateResult
import com.dyrlix.player.data.model.UpdateManifest
import com.dyrlix.player.update.installedVersion
import com.dyrlix.player.ui.theme.LocalDimens
import com.dyrlix.player.ui.theme.LocalIsTvDevice
import com.dyrlix.player.ui.theme.Palette
import com.dyrlix.player.ui.theme.Radius
import com.dyrlix.player.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.ui.PlayerView
import okhttp3.OkHttpClient
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

private enum class MainPage(val title: String, val icon: String) {
    HOME("Beranda", "home-outline"),
    PLAYLISTS("Playlist Saya", "albums-outline"),
    UPDATE("Update Aplikasi", "cloud-download-outline"),
    ABOUT("Tentang Aplikasi", "information-circle-outline"),
}

/** Native Compose app shell and route-level screens. */
@Composable
fun AppRoot() {
    val dimens = LocalDimens.current
    val context = LocalContext.current
    val container = remember(context) { (context.applicationContext as DyrlixApp).container }
    var page by remember { mutableStateOf(MainPage.HOME) }
    var channels by remember { mutableStateOf<List<Channel>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var query by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var selectedChannel by remember { mutableStateOf<Channel?>(null) }
    var scheduleChannel by remember { mutableStateOf<Channel?>(null) }
    var showAddPlaylist by remember { mutableStateOf(false) }
    var playlists by remember { mutableStateOf<List<Playlist>>(emptyList()) }
    var playlistsLoading by remember { mutableStateOf(false) }
    var selectedPlaylist by remember { mutableStateOf<Playlist?>(null) }
    var detailChannels by remember { mutableStateOf<List<Channel>>(emptyList()) }
    var detailLoading by remember { mutableStateOf(false) }
    var detailError by remember { mutableStateOf<String?>(null) }
    var pendingDelete by remember { mutableStateOf<Playlist?>(null) }
    var addError by remember { mutableStateOf<String?>(null) }
    var manifestUrl by remember { mutableStateOf(UpdateManager.DEFAULT_MANIFEST_URL) }
    var updateResult by remember { mutableStateOf<UpdateResult?>(null) }
    var pendingManifest by remember { mutableStateOf<UpdateManifest?>(null) }
    var checkingUpdate by remember { mutableStateOf(false) }
    var installingUpdate by remember { mutableStateOf(false) }
    var installPermissionMessage by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun reloadPlaylists() {
        scope.launch { playlists = withContext(Dispatchers.IO) { container.playlists.getPlaylists() } }
    }

    LaunchedEffect(container, page) {
        if (page == MainPage.PLAYLISTS) {
            playlistsLoading = true
            try { playlists = withContext(Dispatchers.IO) { container.playlists.getPlaylists() } }
            finally { playlistsLoading = false }
        }
    }

    LaunchedEffect(container) {
        manifestUrl = withContext(Dispatchers.IO) {
            container.kvStore.get("update_manifest_url") ?: UpdateManager.DEFAULT_MANIFEST_URL
        }
    }

    BackHandler(enabled = showAddPlaylist || selectedPlaylist != null || selectedChannel != null || scheduleChannel != null) {
        when {
            scheduleChannel != null -> scheduleChannel = null
            selectedChannel != null -> selectedChannel = null
            selectedPlaylist != null -> selectedPlaylist = null
            else -> showAddPlaylist = false
        }
    }

    LaunchedEffect(container) {
        val result = withContext(Dispatchers.IO) { container.defaultPlaylist.load() }
        channels = result.channels
        loading = false
        container.epg.ensureEpgLoaded(result.epgUrl)
    }

    val categorySummary = remember(channels) { Categories.summarize(channels) }
    val visibleChannels = remember(channels, query, selectedCategory) {
        channels.filter { channel ->
            (selectedCategory == null || (channel.group ?: Categories.DEFAULT_GROUP) == selectedCategory) &&
                (query.isBlank() || channel.name.contains(query.trim(), ignoreCase = true) ||
                    (channel.group ?: "").contains(query.trim(), ignoreCase = true))
        }
    }

    Box(Modifier.fillMaxSize().background(Palette.Background)) {
        if (selectedChannel == null) {
            androidx.compose.foundation.Image(
                painter = painterResource(com.dyrlix.player.R.drawable.tv_icon),
                contentDescription = null,
                modifier = Modifier.fillMaxWidth(0.75f).fillMaxHeight(0.75f).align(Alignment.Center),
                contentScale = ContentScale.Fit,
                alpha = 0.1f,
            )
        }
        Row(modifier = Modifier.fillMaxSize().padding(dimens.overscan)) {
        if (!showAddPlaylist && selectedPlaylist == null && selectedChannel == null && scheduleChannel == null) {
            SideNavigation(page = page, onSelect = { page = it }, modifier = Modifier.fillMaxHeight())
            Spacer(Modifier.width(Spacing.xl))
        }
        when {
            showAddPlaylist -> AddPlaylistContent(
                onBack = { showAddPlaylist = false },
                error = addError,
                onClearError = { addError = null },
                onSave = { input ->
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { container.playlists.addPlaylist(input) }
                            addError = null
                            showAddPlaylist = false
                            reloadPlaylists()
                            page = MainPage.PLAYLISTS
                        } catch (error: Exception) {
                            addError = error.message ?: "Gagal menyimpan playlist."
                        }
                    }
                },
            )
            scheduleChannel != null -> ScheduleContent(
                channel = scheduleChannel!!,
                repository = container.epg,
                onBack = { scheduleChannel = null },
            )
            selectedChannel != null -> NativePlayerScreen(
                channel = selectedChannel!!,
                repository = container.epg,
                onBack = { selectedChannel = null },
                onChannelChange = { selectedChannel = it },
                onSchedule = { scheduleChannel = selectedChannel },
            )
            selectedPlaylist != null -> PlaylistDetailContent(
                playlist = selectedPlaylist!!,
                channels = detailChannels,
                loading = detailLoading,
                error = detailError,
                onBack = { selectedPlaylist = null },
                onOpenChannel = { channel, queueChannels ->
                    PlaybackQueue.set(queueChannels, queueChannels.indexOfFirst { it.id == channel.id })
                    selectedChannel = channel
                },
                onOpenSchedule = { scheduleChannel = it },
                onRetry = { loadPlaylistDetail(selectedPlaylist!!, container, scope,
                    { detailLoading = it }, { detailChannels = it }, { detailError = it }) },
            )
            page == MainPage.HOME -> HomeContent(
                channels = visibleChannels,
                allChannelsCount = channels.size,
                categories = categorySummary.categories,
                categoryCounts = categorySummary.counts,
                query = query,
                selectedCategory = selectedCategory,
                loading = loading,
                onQueryChange = { query = it },
                onCategorySelect = { selectedCategory = it },
                onOpenChannel = { channel ->
                    PlaybackQueue.set(visibleChannels, visibleChannels.indexOfFirst { it.id == channel.id })
                    selectedChannel = channel
                },
                onOpenSchedule = { scheduleChannel = it },
                onAddPlaylist = { showAddPlaylist = true },
                onRefresh = {
                    scope.launch {
                        loading = true
                        val result = withContext(Dispatchers.IO) { container.defaultPlaylist.load(force = true) }
                        channels = result.channels
                        container.epg.ensureEpgLoaded(result.epgUrl, force = true)
                        loading = false
                    }
                },
                modifier = Modifier.weight(1f).fillMaxHeight(),
            )
            page == MainPage.PLAYLISTS -> PlaylistListContent(
                playlists = playlists,
                loading = playlistsLoading,
                onAdd = { showAddPlaylist = true },
                onOpen = { playlist ->
                    selectedPlaylist = playlist
                    detailChannels = emptyList()
                    detailError = null
                    loadPlaylistDetail(playlist, container, scope,
                        { detailLoading = it }, { detailChannels = it }, { detailError = it })
                },
                onDelete = { pendingDelete = it },
                modifier = Modifier.weight(1f).fillMaxHeight(),
            )
            page == MainPage.UPDATE -> UpdateContent(
                manifestUrl = manifestUrl,
                result = updateResult,
                pendingManifest = pendingManifest,
                checking = checkingUpdate,
                installing = installingUpdate,
                permissionMessage = installPermissionMessage,
                onUrlChange = { value ->
                    manifestUrl = value
                    scope.launch { withContext(Dispatchers.IO) { container.kvStore.put("update_manifest_url", value) } }
                },
                onCheck = {
                    scope.launch {
                        checkingUpdate = true
                        updateResult = null
                        pendingManifest = null
                        val result = withContext(Dispatchers.IO) { container.updateManager.checkForUpdates(manifestUrl) }
                        updateResult = result
                        pendingManifest = (result as? UpdateResult.Ok)?.takeIf { it.available }?.manifest
                        checkingUpdate = false
                    }
                },
                onInstall = {
                    pendingManifest?.let { manifest ->
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
                            installPermissionMessage = "Izinkan instalasi untuk DYRLIX, lalu tekan Unduh & Pasang lagi."
                            container.apkInstaller.openInstallPermissionSettings()
                        } else {
                            scope.launch {
                                installingUpdate = true
                                installPermissionMessage = null
                                updateResult = withContext(Dispatchers.IO) { container.apkInstaller.downloadAndInstall(manifest) }
                                installingUpdate = false
                            }
                        }
                    }
                },
                onOpenInstallPermission = {
                    installPermissionMessage = "Izinkan instalasi aplikasi tidak dikenal untuk DYRLIX, lalu kembali ke sini untuk memasang update."
                    container.apkInstaller.openInstallPermissionSettings()
                },
                modifier = Modifier.weight(1f).fillMaxHeight(),
            )
            page == MainPage.ABOUT -> AboutContent(modifier = Modifier.weight(1f).fillMaxHeight())
            else -> SecondaryPlaceholder(
                title = page.title,
                message = when (page) {
                    MainPage.PLAYLISTS -> "Belum ada playlist"
                    MainPage.UPDATE -> "Pemeriksaan update akan tersedia di layar ini."
                    MainPage.ABOUT -> "DYRLIX TV\nTonton channel favorit Anda di Android TV."
                    MainPage.HOME -> ""
                },
                modifier = Modifier.weight(1f).fillMaxHeight(),
            )
        }
        }
    }
    pendingDelete?.let { playlist ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Hapus Playlist") },
            text = { Text("Hapus \"${playlist.name}\" dari daftar? Tindakan ini tidak dapat dibatalkan.") },
            confirmButton = {
                TextButton(onClick = {
                    pendingDelete = null
                    scope.launch {
                        withContext(Dispatchers.IO) { container.playlists.removePlaylist(playlist.id) }
                        reloadPlaylists()
                    }
                }) { Text("Hapus", color = Palette.Danger) }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Batal") } },
        )
    }
}

@Composable
private fun SideNavigation(page: MainPage, onSelect: (MainPage) -> Unit, modifier: Modifier = Modifier) {
    val dimens = LocalDimens.current
    Column(
        modifier = modifier.width(dimens.sideNavWidth).padding(vertical = Spacing.md),
        verticalArrangement = Arrangement.spacedBy(Spacing.sm),
    ) {
        Text("DYRLIX TV", color = Palette.Primary, fontSize = 25.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(start = Spacing.md, bottom = Spacing.xl))
        MainPage.entries.forEach { item ->
            val label = if (dimens.isTv) item.title else when (item) {
                MainPage.HOME -> "Home"
                MainPage.PLAYLISTS -> "List"
                MainPage.UPDATE -> "Update"
                MainPage.ABOUT -> "About"
            }
            FocusableNavItem(label, item.icon, compact = !dimens.isTv, selected = page == item, onClick = { onSelect(item) })
        }
    }
}

@Composable
private fun FocusableNavItem(title: String, icon: String, compact: Boolean, selected: Boolean, onClick: () -> Unit) {
    val dimens = LocalDimens.current
    var focused by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier.fillMaxWidth().height(dimens.sideNavItemHeight)
            .clip(RoundedCornerShape(Radius.md))
            .background(if (selected || focused) Palette.SurfaceAlt else Color.Transparent)
            .border(BorderStroke(if (focused) dimens.focusBorder else 0.dp, Palette.BorderFocus), RoundedCornerShape(Radius.md))
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick).padding(horizontal = Spacing.md),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (compact) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                IonIcon(icon, title, if (selected || focused) Palette.Text else Palette.TextMuted, 20.sp)
                Text(title, color = if (selected || focused) Palette.Text else Palette.TextMuted,
                    fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                IonIcon(icon, title, if (selected || focused) Palette.Text else Palette.TextMuted, 26.sp)
                Text(title, color = if (selected || focused) Palette.Text else Palette.TextMuted,
                    fontSize = 18.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun HomeContent(
    channels: List<Channel>, allChannelsCount: Int, categories: List<String>,
    categoryCounts: Map<String, Int>, query: String, selectedCategory: String?, loading: Boolean,
    onQueryChange: (String) -> Unit, onCategorySelect: (String?) -> Unit,
    onOpenChannel: (Channel) -> Unit, onOpenSchedule: (Channel) -> Unit,
    onAddPlaylist: () -> Unit, onRefresh: () -> Unit, modifier: Modifier = Modifier,
) {
    val dimens = LocalDimens.current
    val isTvDevice = LocalIsTvDevice.current
    val firstChannelFocus = remember { FocusRequester() }
    val term = query.trim()
    val filterNote = when {
        term.isNotEmpty() -> "Menampilkan ${channels.size} channel untuk pencarian \"$term\" dari $allChannelsCount."
        selectedCategory != null -> "Menampilkan ${channels.size} channel kategori \"$selectedCategory\" dari $allChannelsCount."
        else -> "$allChannelsCount channel dari playlist bawaan. Ketuk ikon segarkan untuk mengambil daftar terbaru tanpa update aplikasi."
    }
    LaunchedEffect(loading) {
        if (isTvDevice && !loading && channels.isNotEmpty()) runCatching { firstChannelFocus.requestFocus() }
    }
    Column(modifier = modifier.padding(vertical = Spacing.md)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.xl)) {
            Column(modifier = Modifier.weight(1f)) {
                Text("DYRLIX TV", color = Palette.Text, fontSize = dimens.heroTitle.value.sp, fontWeight = FontWeight.Bold)
                Text("Tonton channel favorit Anda di Android TV.", color = Palette.TextMuted, fontSize = dimens.bodyText.value.sp)
            }
            PrimaryAction("Tambah Playlist", onClick = onAddPlaylist, icon = "add")
        }
        Spacer(Modifier.height(Spacing.xl))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Channel Bawaan", color = Palette.Text, fontSize = 26.sp, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.weight(1f))
            if (allChannelsCount > 0) TextButton(onClick = onRefresh) {
                IonIcon("refresh", "Segarkan channel bawaan", Palette.Primary, 24.sp)
            }
            SearchField(query = query, onChange = onQueryChange, modifier = Modifier.width(if (dimens.isTv) 360.dp else 260.dp))
        }
        if (categories.size > 1) {
            Row(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.md), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                CategoryChip("Semua", selectedCategory == null, null, onCategorySelect)
                categories.take(if (dimens.isTv) 7 else 4).forEach { category ->
                    CategoryChip(category, selectedCategory == category, categoryCounts[category], onCategorySelect)
                }
            }
        }
        when {
            loading -> Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Palette.Primary)
                    Spacer(Modifier.height(Spacing.md))
                    Text("Memuat channel bawaan…", color = Palette.TextMuted)
                }
            }
            channels.isEmpty() && allChannelsCount == 0 -> SecondaryPlaceholder("Channel bawaan gagal dimuat", "Periksa jaringan lalu coba segarkan kembali. Tautan playlist bawaan berasal dari server pihak ketiga.", Modifier.weight(1f).fillMaxWidth())
            channels.isEmpty() -> SecondaryPlaceholder("Tidak ditemukan", if (term.isNotEmpty()) "Tidak ada channel yang cocok dengan \"$term\". Coba kata kunci lain." else "Tidak ada channel pada kategori \"${selectedCategory.orEmpty()}\". Coba pilih kategori lain.", Modifier.weight(1f).fillMaxWidth())
            else -> LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = if (dimens.isTv) 205.dp else 160.dp),
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(vertical = Spacing.md, horizontal = Spacing.xs),
                horizontalArrangement = Arrangement.spacedBy(Spacing.md),
                verticalArrangement = Arrangement.spacedBy(Spacing.md),
            ) {
                items(channels, key = { it.id }) {
                    ChannelTile(
                        it,
                        onClick = { onOpenChannel(it) },
                        onSchedule = { onOpenSchedule(it) },
                        focusRequester = if (it.id == channels.firstOrNull()?.id) firstChannelFocus else null,
                    )
                }
            }
        }
        if (allChannelsCount > 0) InfoBanner(filterNote, kind = BannerKind.INFO)
    }
}

@Composable
private fun SearchField(query: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    BasicTextField(
        value = query, onValueChange = onChange, singleLine = true,
        modifier = modifier.clip(RoundedCornerShape(Radius.md)).background(Palette.Surface)
            .padding(horizontal = Spacing.md, vertical = Spacing.md),
        textStyle = androidx.compose.ui.text.TextStyle(color = Palette.Text, fontSize = 16.sp),
        decorationBox = { inner ->
            Box {
                if (query.isEmpty()) Text("Cari channel…", color = Palette.TextMuted, fontSize = 16.sp)
                inner()
            }
        },
    )
}

@Composable
private fun CategoryChip(title: String, selected: Boolean, count: Int?, onClick: (String?) -> Unit) {
    val text = if (count != null) "$title ($count)" else title
    Button(onClick = { onClick(if (title == "Semua") null else title) },
        colors = ButtonDefaults.buttonColors(containerColor = if (selected) Palette.PrimaryDark else Palette.Surface),
        contentPadding = PaddingValues(horizontal = Spacing.md, vertical = Spacing.xs)) {
        Text(text, color = Palette.Text)
    }
}

@Composable
private fun ChannelTile(
    channel: Channel,
    onClick: () -> Unit,
    onSchedule: (() -> Unit)? = null,
    focusRequester: FocusRequester? = null,
) {
    val dimens = LocalDimens.current
    val isTvDevice = LocalIsTvDevice.current
    var focused by remember { mutableStateOf(false) }
    val focusScale by animateFloatAsState(
        targetValue = if (focused && isTvDevice) 1.06f else 1f,
        animationSpec = tween(140),
        label = "channelFocusScale",
    )
    Column(
        modifier = Modifier.fillMaxWidth().scale(focusScale).then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier).clip(RoundedCornerShape(Radius.lg))
            .background(if (focused) Palette.SurfaceAlt else Palette.Surface)
            .border(BorderStroke(if (focused) dimens.focusBorder else 0.dp, Palette.BorderFocus), RoundedCornerShape(Radius.lg))
            .onFocusChanged { focused = it.isFocused }.clickable(onClick = onClick).padding(Spacing.md),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (!channel.logo.isNullOrBlank()) {
            AsyncImage(model = channel.logo, contentDescription = "Logo ${channel.name}",
                modifier = Modifier.size(dimens.cardLogo).padding(Spacing.sm), contentScale = ContentScale.Fit)
        } else {
            Box(Modifier.size(dimens.cardLogo).padding(Spacing.sm).clip(RoundedCornerShape(Radius.md)).background(Palette.SurfaceAlt), contentAlignment = Alignment.Center) {
                Text(channel.name.take(1).uppercase(), color = Palette.Primary, fontSize = 42.sp, fontWeight = FontWeight.Bold)
            }
        }
        Text(channel.name, color = Palette.Text, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
        Text(channel.group ?: "Umum", color = Palette.TextMuted, fontSize = 13.sp, maxLines = 1)
        if (onSchedule != null && !channel.tvgId.isNullOrBlank()) {
            TextButton(onClick = onSchedule) { Text("Jadwal", color = Palette.Primary) }
        }
    }
}

@Composable
private fun PrimaryAction(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: String? = null,
) {
    Button(onClick = onClick, modifier = modifier, colors = ButtonDefaults.buttonColors(containerColor = Palette.PrimaryDark)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            if (icon != null) IonIcon(icon, null, Palette.Text, 20.sp)
            Text(title, color = Palette.Text, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun SecondaryAction(title: String, onClick: () -> Unit, icon: String? = null) {
    TextButton(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            if (icon != null) IonIcon(icon, null, Palette.Primary, 20.sp)
            Text(title, color = Palette.Primary, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun SecondaryPlaceholder(title: String, message: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier, verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, color = Palette.Text, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(Spacing.sm))
        Text(message, color = Palette.TextMuted, fontSize = 16.sp)
    }
}

private enum class BannerKind { INFO, WARNING, DANGER }

@Composable
private fun InfoBanner(message: String, kind: BannerKind) {
    val accent = when (kind) {
        BannerKind.INFO -> Palette.Primary
        BannerKind.WARNING -> Palette.Accent
        BannerKind.DANGER -> Palette.Danger
    }
    val fill = when (kind) {
        BannerKind.INFO -> Palette.PrimarySoft
        BannerKind.WARNING -> Color(0x29F59E0B)
        BannerKind.DANGER -> Palette.DangerSoft
    }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.sm)).background(fill)
            .border(BorderStroke(1.dp, accent.copy(alpha = 0.45f)), RoundedCornerShape(Radius.sm))
            .padding(Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(message, color = Palette.Text, fontSize = 13.sp)
    }
}

@Composable
private fun NativePlayerScreen(
    channel: Channel,
    repository: EpgRepository,
    onBack: () -> Unit,
    onChannelChange: (Channel) -> Unit,
    onSchedule: () -> Unit,
) {
    val context = LocalContext.current
    val isTvDevice = LocalIsTvDevice.current
    val backFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (isTvDevice) runCatching { backFocus.requestFocus() } }
    val player = remember(context) { ExoPlayer.Builder(context).build() }
    var playbackError by remember(channel.url) {
        mutableStateOf(if (channel.url.isBlank()) "Gagal memuat stream" else null)
    }
    var warning by remember(channel.url) { mutableStateOf<String?>(null) }
    var buffering by remember(channel.url) { mutableStateOf(true) }
    var retryAttempt by remember(channel.url) { mutableStateOf(0) }
    val queue = PlaybackQueue.get()
    val queueIndex = queue?.channels?.indexOfFirst { it.id == channel.id } ?: -1
    val nowNext = channel.tvgId?.let { repository.getNowNext(it) }

    androidx.compose.runtime.DisposableEffect(player, channel.url) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                buffering = playbackState == Player.STATE_BUFFERING || playbackState == Player.STATE_IDLE
            }
            override fun onPlayerError(error: PlaybackException) {
                playbackError = StreamHealth.friendlyStreamError(error) ?: "Tidak dapat memutar channel ini."
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
        }
    }

    androidx.compose.runtime.DisposableEffect(player) {
        onDispose { player.release() }
    }

    LaunchedEffect(channel.url, channel.headers) {
        if (channel.url.isNotBlank()) {
            val check = StreamHealth.checkDetail(channel.url, headers = channel.headers)
            if (check.status == StreamHealth.StreamCheck.DEAD) {
                warning = "Tautan ini kemungkinan mati (HTTP ${check.httpStatus}). Mencoba tetap memutar…"
            }
        }
    }

    LaunchedEffect(player, channel.url, channel.headers) {
        if (channel.url.isNotBlank()) {
            player.setMediaSource(createChannelMediaSource(channel.url, channel.headers))
            player.prepare()
            player.playWhenReady = true
        }
    }

    LaunchedEffect(playbackError, channel.url, retryAttempt) {
        if (playbackError != null && channel.url.isNotBlank() && retryAttempt == 0) {
            delay(600)
            retryAttempt = 1
            playbackError = null
            player.stop()
            player.setMediaSource(createChannelMediaSource(
                channel.url,
                StreamHeaders.browserRetryHeaders(channel.url, channel.headers),
            ))
            player.prepare()
            player.playWhenReady = true
        }
    }

    Box(Modifier.fillMaxSize().background(Palette.Black)) {
        AndroidView(
            factory = { viewContext -> PlayerView(viewContext).apply { useController = true; this.player = player } },
            update = { it.player = player },
            modifier = Modifier.fillMaxSize(),
        )
        Row(
            Modifier.fillMaxWidth().background(Color(0x8C020617)).padding(horizontal = Spacing.lg, vertical = Spacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        ) {
            TextButton(
                modifier = Modifier.size(48.dp).focusRequester(backFocus)
                    .background(Color(0xB30F172A), RoundedCornerShape(Radius.md))
                    .semantics { contentDescription = "Kembali" },
                onClick = onBack,
            ) {
                IonIcon("arrow-back", "Kembali", Palette.Text, 24.sp)
            }
            Column(Modifier.weight(1f)) {
                Text(channel.name, color = Palette.Text, fontSize = 20.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                    Text("● LIVE", color = Palette.Danger, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    if (queueIndex >= 0 && queue != null) Text("Channel ${queueIndex + 1}/${queue.channels.size}", color = Palette.TextMuted, fontSize = 13.sp)
                }
                nowNext?.now?.let { Text("Sekarang · ${it.title}", color = Palette.TextMuted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
                nowNext?.next?.let { Text("Berikutnya · ${it.title}", color = Palette.TextMuted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            }
            if (!channel.tvgId.isNullOrBlank()) TextButton(
                onClick = onSchedule,
                modifier = Modifier.semantics { contentDescription = "Jadwal Tayang" },
            ) { IonIcon("calendar-outline", null, Palette.Text, 24.sp) }
            TextButton(enabled = queueIndex > 0, modifier = Modifier.size(52.dp)
                .background(if (queueIndex > 0) Color(0x1FFFFFFF) else Color(0x12FFFFFF), RoundedCornerShape(Radius.pill))
                .semantics { contentDescription = "Channel sebelumnya" }, onClick = {
                val current = PlaybackQueue.get() ?: return@TextButton
                PlaybackQueue.set(current.channels, queueIndex - 1)
                onChannelChange(current.channels[queueIndex - 1])
            }) { IonIcon("play-skip-back", null, if (queueIndex > 0) Palette.Text else Palette.TextMuted, 24.sp) }
            val nextEnabled = queue != null && queueIndex >= 0 && queueIndex < queue.channels.lastIndex
            TextButton(enabled = nextEnabled, modifier = Modifier.size(52.dp)
                .background(if (nextEnabled) Color(0x1FFFFFFF) else Color(0x12FFFFFF), RoundedCornerShape(Radius.pill))
                .semantics { contentDescription = "Channel berikutnya" }, onClick = {
                val current = PlaybackQueue.get() ?: return@TextButton
                PlaybackQueue.set(current.channels, queueIndex + 1)
                onChannelChange(current.channels[queueIndex + 1])
            }) { IonIcon("play-skip-forward", null, if (nextEnabled) Palette.Text else Palette.TextMuted, 24.sp) }
        }
        warning?.let { message ->
            Surface(Modifier.align(Alignment.BottomCenter).padding(Spacing.lg), color = Color(0xE60F172A), shape = RoundedCornerShape(Radius.md)) {
                Text(message, modifier = Modifier.padding(Spacing.md), color = Palette.Accent)
            }
        }
        if (buffering && playbackError == null) {
            Box(Modifier.fillMaxSize().padding(top = 132.dp).background(Palette.Overlay), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Palette.Primary)
                    Spacer(Modifier.height(Spacing.md))
                    Text("Memuat siaran…", color = Palette.Text)
                }
            }
        }
        playbackError?.let { error ->
            Box(Modifier.fillMaxSize().padding(top = 132.dp).background(Palette.Overlay), contentAlignment = Alignment.Center) {
                Column(Modifier.fillMaxWidth().padding(Spacing.xl), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Gagal memuat stream", color = Palette.Text, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(Spacing.sm))
                    Text(error, color = Palette.TextMuted)
                    Spacer(Modifier.height(Spacing.md))
                    Surface(Modifier.widthIn(max = 560.dp), color = Color(0xE60F172A), shape = RoundedCornerShape(Radius.md)) {
                        Column(Modifier.padding(Spacing.md)) {
                            Text("URL", color = Palette.TextMuted, fontSize = 12.sp)
                            SelectionContainer { Text(channel.url, color = Palette.Text, fontSize = 12.sp) }
                        }
                    }
                    Spacer(Modifier.height(Spacing.md))
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                        PrimaryAction("Coba Lagi", onClick = {
                            retryAttempt = 0
                            playbackError = null
                            player.stop()
                            player.setMediaSource(createChannelMediaSource(channel.url, channel.headers))
                            player.prepare()
                            player.playWhenReady = true
                        })
                        TextButton(onClick = onBack) { Text("Kembali", color = Palette.Text) }
                    }
                }
            }
        }
    }
}

private fun createChannelMediaSource(url: String, headers: Map<String, String>?): androidx.media3.exoplayer.source.MediaSource {
    val dataSourceFactory = OkHttpDataSource.Factory(OkHttpClient())
        .setDefaultRequestProperties(StreamHeaders.merge(headers))
    return DefaultMediaSourceFactory(dataSourceFactory).createMediaSource(MediaItem.fromUri(url))
}

@Composable
private fun AddPlaylistContent(
    onBack: () -> Unit,
    error: String?,
    onClearError: () -> Unit,
    onSave: (AddPlaylistInput) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(PlaylistType.URL) }
    var fileMode by remember { mutableStateOf(false) }
    var url by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var fileName by remember { mutableStateOf("") }
    var pickingError by remember { mutableStateOf<String?>(null) }
    val parsedChannelCount = remember(content) {
        if (content.isBlank()) 0 else com.dyrlix.player.data.m3u.M3uParser.parseM3U(content, "preview").size
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            scope.launch {
                runCatching {
                    withContext(Dispatchers.IO) {
                        context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                            ?: throw IllegalStateException("Gagal membaca file M3U.")
                    }
                }.onSuccess { text ->
                    content = text
                    fileName = uri.lastPathSegment?.substringAfterLast('/') ?: "playlist.m3u"
                    pickingError = if (text.isBlank()) "File tersebut kosong atau tidak dapat dibaca." else null
                }.onFailure { pickingError = it.message ?: "Gagal membaca file. Coba file lain." }
            }
        }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.xl), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Tambah Playlist", color = Palette.Text, fontSize = 28.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onBack) { Text("Kembali") }
        }
        Text("Format M3U / M3U8", color = Palette.TextMuted)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
            CategoryChip("Tautan URL", mode == PlaylistType.URL && !fileMode, null) { mode = PlaylistType.URL; fileMode = false }
            CategoryChip("Tempel Teks", mode == PlaylistType.CONTENT && !fileMode, null) { mode = PlaylistType.CONTENT; fileMode = false }
            CategoryChip("Pilih File", fileMode, null) { fileMode = true; mode = PlaylistType.CONTENT }
        }
        if (mode == PlaylistType.URL && !fileMode) {
            OutlinedTextField(value = url, onValueChange = { url = it; onClearError() },
                label = { Text("Tautan Playlist *") }, placeholder = { Text("https://contoh.com/playlist.m3u") },
                modifier = Modifier.fillMaxWidth(), singleLine = true)
        } else if (fileMode) {
            PrimaryAction(if (content.isBlank()) "Pilih File M3U…" else fileName.ifBlank { "File dipilih" }, {
                picker.launch(arrayOf("*/*"))
            }, icon = if (content.isBlank()) "folder-open-outline" else "document-text-outline")
            if (content.isNotBlank()) Text("$parsedChannelCount channel valid ditemukan", color = Palette.TextMuted)
        } else {
            OutlinedTextField(value = content, onValueChange = { content = it; onClearError() },
                label = { Text("Isi File M3U") }, placeholder = { Text("#EXTM3U\n#EXTINF:-1,...,Channel 1\nhttps://…/stream.m3u8") },
                modifier = Modifier.fillMaxWidth().height(260.dp), minLines = 8)
            if (content.isNotBlank()) Text("$parsedChannelCount channel valid terdeteksi", color = Palette.TextMuted)
        }
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nama Playlist (opsional)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
        (error ?: pickingError)?.let { Text(it, color = Palette.Danger) }
        InfoBanner("Playlist dari sumber pihak ketiga merupakan tanggung jawab pengguna.", kind = BannerKind.WARNING)
        PrimaryAction("Simpan Playlist", {
            onClearError()
            pickingError = null
            when {
                fileMode && content.isBlank() -> pickingError = "Pilih file M3U terlebih dahulu."
                mode == PlaylistType.CONTENT && content.isBlank() -> pickingError = "Isi teks M3U tidak boleh kosong."
                mode == PlaylistType.URL && url.isBlank() -> pickingError = "Tautan playlist tidak boleh kosong."
                mode == PlaylistType.URL && !url.trim().matches(Regex("(?i)^https?://[^\\s]+$")) -> pickingError = "Format tautan tidak valid. Contoh: https://contoh.com/playlist.m3u"
                else -> onSave(AddPlaylistInput(mode = mode, url = url, content = content, name = name))
            }
        })
    }
}

@Composable
private fun PlaylistListContent(
    playlists: List<Playlist>, loading: Boolean, onAdd: () -> Unit, onOpen: (Playlist) -> Unit,
    onDelete: (Playlist) -> Unit, modifier: Modifier = Modifier,
) {
    val isTvDevice = LocalIsTvDevice.current
    val initialFocus = remember { FocusRequester() }
    LaunchedEffect(playlists, loading) { if (isTvDevice && !loading) runCatching { initialFocus.requestFocus() } }
    Column(modifier = modifier.padding(Spacing.xl), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Playlist Saya", color = Palette.Text, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                Text(if (loading) "Memuat playlist…" else "${playlists.size} playlist tersimpan", color = Palette.TextMuted)
            }
            PrimaryAction("Tambah Playlist Baru", onAdd,
                modifier = if (playlists.isEmpty()) Modifier.focusRequester(initialFocus) else Modifier)
        }
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Palette.Primary)
                    Spacer(Modifier.height(Spacing.md))
                    Text("Memuat playlist…", color = Palette.TextMuted)
                }
            }
        } else if (playlists.isEmpty()) {
            SecondaryPlaceholder("Belum ada playlist", "Tambahkan tautan M3U/M3U8 untuk mulai menonton channel pilihan Anda.", Modifier.fillMaxSize())
        } else {
            androidx.compose.foundation.lazy.LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
                items(playlists.size) { index ->
                    val playlist = playlists[index]
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.md)).background(Palette.Surface).padding(Spacing.md), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(playlist.name, color = Palette.Text, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(if (playlist.type == PlaylistType.CONTENT) "Konten tersimpan · ${playlist.channelCount ?: "—"} channel" else playlist.url,
                                color = Palette.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        TextButton(
                            modifier = if (index == 0) Modifier.focusRequester(initialFocus) else Modifier,
                            onClick = { onOpen(playlist) },
                        ) { Text("Buka") }
                        TextButton(onClick = { onDelete(playlist) }) { Text("Hapus", color = Palette.Danger) }
                    }
                }
            }
        }
    }
}

private fun loadPlaylistDetail(
    playlist: Playlist,
    container: com.dyrlix.player.di.AppContainer,
    scope: kotlinx.coroutines.CoroutineScope,
    setLoading: (Boolean) -> Unit,
    setChannels: (List<Channel>) -> Unit,
    setError: (String?) -> Unit,
) {
    setLoading(true)
    scope.launch {
        try {
            val data = withContext(Dispatchers.IO) { container.playlistLoader.loadPlaylistData(playlist) }
            setChannels(data.channels)
            setError(null)
            container.epg.ensureEpgLoaded(data.epgUrl)
        } catch (error: Exception) {
            setChannels(emptyList())
            setError(error.message ?: "Gagal memuat playlist.")
        } finally {
            setLoading(false)
        }
    }
}

@Composable
private fun PlaylistDetailContent(
    playlist: Playlist, channels: List<Channel>, loading: Boolean, error: String?,
    onBack: () -> Unit, onOpenChannel: (Channel, List<Channel>) -> Unit,
    onOpenSchedule: (Channel) -> Unit, onRetry: () -> Unit,
) {
    var query by remember(playlist.id) { mutableStateOf("") }
    var selectedCategory by remember(playlist.id) { mutableStateOf<String?>(null) }
    val categories = remember(channels) { Categories.summarize(channels) }
    val filteredChannels = remember(channels, query, selectedCategory) {
        channels.filter { channel ->
            (selectedCategory == null || (channel.group ?: Categories.DEFAULT_GROUP) == selectedCategory) &&
                (query.isBlank() || channel.name.contains(query.trim(), true) ||
                    (channel.group ?: "").contains(query.trim(), true))
        }
    }
    Column(Modifier.fillMaxSize().padding(Spacing.xl), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(playlist.name, color = Palette.Text, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text("${channels.size} channel", color = Palette.TextMuted)
            }
            TextButton(onClick = onBack) { Text("Kembali") }
        }
        when {
            loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = Palette.Primary)
                    Spacer(Modifier.height(Spacing.md))
                    Text("Memuat channel dari playlist…", color = Palette.TextMuted)
                }
            }
            error != null -> Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Gagal memuat playlist", color = Palette.Text, fontSize = 22.sp)
                Text(error, color = Palette.TextMuted)
                PrimaryAction("Coba Lagi", onRetry, icon = "refresh")
            }
            channels.isEmpty() -> SecondaryPlaceholder("Channel tidak ditemukan", "Playlist ini tidak memiliki channel valid.", Modifier.fillMaxSize())
            else -> {
                SearchField(query = query, onChange = { query = it }, modifier = Modifier.fillMaxWidth())
                if (categories.categories.size > 1) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                        CategoryChip("Semua", selectedCategory == null, null) { selectedCategory = it }
                        categories.categories.take(6).forEach { category ->
                            CategoryChip(category, selectedCategory == category, categories.counts[category]) { selectedCategory = it }
                        }
                    }
                }
                if (filteredChannels.isEmpty()) {
                    SecondaryPlaceholder("Channel tidak ditemukan", "Tidak ada channel yang cocok dengan pencarian atau kategori ini.", Modifier.weight(1f).fillMaxWidth())
                } else LazyVerticalGrid(columns = GridCells.Adaptive(minSize = 200.dp), horizontalArrangement = Arrangement.spacedBy(Spacing.md), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
                items(filteredChannels, key = { it.id }) {
                    ChannelTile(it, { onOpenChannel(it, filteredChannels) }, { onOpenSchedule(it) })
                }
            }
            }
        }
    }
}

@Composable
private fun UpdateContent(
    manifestUrl: String,
    result: UpdateResult?,
    pendingManifest: UpdateManifest?,
    checking: Boolean,
    installing: Boolean,
    permissionMessage: String?,
    onUrlChange: (String) -> Unit,
    onCheck: () -> Unit,
    onInstall: () -> Unit,
    onOpenInstallPermission: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val installed = installedVersion()
    val isTvDevice = LocalIsTvDevice.current
    val checkFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { if (isTvDevice) runCatching { checkFocus.requestFocus() } }
    Column(modifier.padding(Spacing.xl), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Text("Update Aplikasi", color = Palette.Text, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Text("Terpasang v${installed.versionName ?: "?"} (${installed.versionCode ?: "?"})", color = Palette.TextMuted)
        OutlinedTextField(
            value = manifestUrl,
            onValueChange = onUrlChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("URL Manifest Update") },
            placeholder = { Text("https://host-anda.com/dyrlix/update.json") },
            singleLine = true,
        )
        Text("File update.json berisi versi terbaru dan tautan APK.", color = Palette.TextMuted, fontSize = 13.sp)
        PrimaryAction(
            if (checking) "Memeriksa…" else "Periksa Update",
            { if (!checking) onCheck() },
            Modifier.focusRequester(checkFocus),
        )
        when (result) {
            is UpdateResult.Error -> Surface(color = Palette.DangerSoft, shape = RoundedCornerShape(Radius.md)) {
                Column(Modifier.padding(Spacing.md)) {
                    Text("Gagal Memeriksa", color = Palette.Danger, fontWeight = FontWeight.Bold)
                    Text(result.message, color = Palette.Text)
                }
            }
            is UpdateResult.Ok -> if (result.available && pendingManifest != null) {
                Surface(color = Palette.PrimarySoft, shape = RoundedCornerShape(Radius.md)) {
                    Column(Modifier.padding(Spacing.md), verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                        Text("Update v${pendingManifest.versionName} tersedia", color = Palette.Primary, fontWeight = FontWeight.Bold)
                        Text(pendingManifest.notes ?: "Versi ${pendingManifest.versionCode} siap dipasang.", color = Palette.Text)
                        PrimaryAction(if (installing) "Menyiapkan…" else "Unduh & Pasang", onClick = { if (!installing) onInstall() })
                    }
                }
            } else {
                Surface(color = Palette.Surface, shape = RoundedCornerShape(Radius.md)) {
                    Text("Terbaru · ${result.message.orEmpty()}", Modifier.padding(Spacing.md), color = Palette.Text)
                }
            }
            null -> Unit
        }
        permissionMessage?.let { InfoBanner(it, BannerKind.WARNING) }
        SecondaryAction("Buka Izin Instal Aplikasi", onOpenInstallPermission, icon = "settings-outline")
        InfoBanner("Pembaruan diunduh dari URL manifest ini lalu dipasang lewat installer Android. Pastikan perangkat mengizinkan instalasi aplikasi tidak dikenal untuk DYRLIX dan hanya gunakan server tepercaya.", BannerKind.WARNING)
    }
}

@Composable
private fun AboutContent(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val version = installedVersion()
    androidx.compose.foundation.lazy.LazyColumn(
        modifier = modifier.padding(horizontal = Spacing.xl),
        contentPadding = PaddingValues(vertical = Spacing.xl),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        item {
            Text("DYRLIX TV", color = Palette.Text, fontSize = 34.sp, fontWeight = FontWeight.Bold)
            Text("Pemutar IPTV ringan dan cepat untuk HP, Web, dan Android TV.", color = Palette.TextMuted)
            Text("v${version.versionName} (build ${version.versionCode})", color = Palette.Primary)
        }
        item { Text("Fitur Unggulan", color = Palette.Text, fontSize = 22.sp, fontWeight = FontWeight.Bold) }
        val features = listOf(
            "Pemutar HLS cepat — streaming M3U8 dengan dukungan header khusus.",
            "Playlist bawaan siap tonton — channel publik dimuat otomatis.",
            "Impor playlist — URL, tempel teks M3U, atau file perangkat.",
            "Pencarian dan kategori — temukan channel dengan cepat.",
            "Pembaruan mandiri — unduh APK dari dalam aplikasi.",
        )
        items(features.size) { index ->
            Surface(color = Palette.Surface, shape = RoundedCornerShape(Radius.md)) {
                Text(features[index], Modifier.fillMaxWidth().padding(Spacing.md), color = Palette.Text)
            }
        }
        item {
            Text("Detail Teknis", color = Palette.Text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text("Pengembang: Ahmad Diky Dharmawan\nPaket: ${context.packageName}\nPlatform: Kotlin · Android TV\nMesin pemutar: AndroidX Media3", color = Palette.TextMuted)
        }
        item {
            Text("Kredit", color = Palette.Text, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.md)) {
                TextButton(onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/dikydharmawan"))) } }) { Text("GitHub") }
                TextButton(onClick = { runCatching { context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:dikyaye118@gmail.com"))) } }) { Text("Email") }
            }
        }
        item {
            Surface(color = Color(0x29F59E0B), shape = RoundedCornerShape(Radius.md)) {
                Text("Konten playlist berasal dari sumber pihak ketiga. Pengguna bertanggung jawab memastikan hak akses atas konten yang ditonton.", Modifier.padding(Spacing.md), color = Palette.Text)
            }
        }
    }
}

@Composable
private fun ScheduleContent(channel: Channel, repository: EpgRepository, onBack: () -> Unit) {
    var now by remember { mutableStateOf(System.currentTimeMillis()) }
    var guide by remember(repository) { mutableStateOf(repository.getEpg()) }
    LaunchedEffect(repository) { guide = repository.getEpg() ?: repository.ensureEpgLoaded(null) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            now = System.currentTimeMillis()
        }
    }
    val entries = remember(guide, channel.tvgId) {
        val currentGuide = guide
        if (currentGuide == null || channel.tvgId.isNullOrBlank()) emptyList()
        else currentGuide[EpgXml.normalizeEpgId(channel.tvgId)].orEmpty()
    }
    val formatter = remember { SimpleDateFormat("HH:mm", Locale("id", "ID")) }
    Column(Modifier.fillMaxSize().padding(Spacing.xl), verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(channel.name, color = Palette.Text, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text("Jadwal tayang", color = Palette.TextMuted)
            }
            TextButton(onClick = onBack) { Text("Kembali") }
        }
        if (entries.isEmpty()) {
            SecondaryPlaceholder(if (guide == null) "Memuat jadwal…" else "Jadwal tidak tersedia",
                "Panduan acara untuk channel ini belum tersedia.", Modifier.fillMaxSize())
        } else {
            val today = Calendar.getInstance().apply { timeInMillis = now; set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
            val groups = entries.groupBy { Calendar.getInstance().apply { timeInMillis = it.start; set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis }.toSortedMap()
            androidx.compose.foundation.lazy.LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.sm)) {
                groups.forEach { (dayStart, programmes) ->
                    val diff = ((dayStart - today) / 86_400_000L).toInt()
                    val dayLabel = when (diff) {
                        0 -> "Hari ini"
                        1 -> "Besok"
                        else -> SimpleDateFormat("EEEE, d MMM", Locale("id", "ID")).format(Date(dayStart))
                    }
                    item(key = "heading-$dayStart") {
                        Text(dayLabel, color = Palette.Primary, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = Spacing.md))
                    }
                    items(programmes.size, key = { index -> "${programmes[index].start}-${programmes[index].title}" }) { index ->
                        val programme = programmes[index]
                        val live = programme.start <= now && now < programme.stop
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.md))
                            .background(if (live) Palette.PrimarySoft else Palette.Surface).padding(Spacing.md),
                            horizontalArrangement = Arrangement.spacedBy(Spacing.md), verticalAlignment = Alignment.Top) {
                            Column(Modifier.width(64.dp)) {
                                Text(formatter.format(Date(programme.start)), color = if (live) Palette.Primary else Palette.Text, fontWeight = FontWeight.Bold)
                                Text(formatter.format(Date(programme.stop)), color = Palette.TextMuted, fontSize = 13.sp)
                            }
                            Column(Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(programme.title, color = Palette.Text, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    if (live) Text(if (Regex("\\(l\\)", RegexOption.IGNORE_CASE).containsMatchIn(programme.title) || Regex("\\b(live|langsung)\\b", RegexOption.IGNORE_CASE).containsMatchIn(programme.title)) "● LIVE" else "● SEDANG TAYANG", color = Palette.Success, fontSize = 12.sp)
                                }
                                programme.description?.takeIf { it.isNotBlank() }?.let {
                                    Text(it, color = Palette.TextMuted, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
