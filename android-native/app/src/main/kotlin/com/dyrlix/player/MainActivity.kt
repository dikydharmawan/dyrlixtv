package com.dyrlix.player

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.dyrlix.player.ui.AppRoot
import com.dyrlix.player.ui.theme.DyrlixTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            DyrlixTheme {
                AppRoot()
            }
        }
    }
}
