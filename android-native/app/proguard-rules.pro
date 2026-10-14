# Media3 / OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.slf4j.**

# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class com.dyrlix.player.** {
    kotlinx.serialization.KSerializer serializer(...);
}
