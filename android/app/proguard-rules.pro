# R8 rules for the CNCV Capacitor app.
# Keep the JS <-> native bridge and all plugins intact (they are resolved by reflection).

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable,Exceptions
-renamesourcefileattribute SourceFile

# Capacitor core + plugins
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.PermissionCallback *;
    @com.getcapacitor.annotation.ActivityCallback *;
}
-keep class com.capacitorjs.** { *; }
-keep class io.capawesome.** { *; }
-keep class io.ionic.** { *; }

# Cordova plugins (capacitor-cordova-android-plugins)
-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin { *; }

# WebView JavaScript interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# App entry points
-keep class com.evenimentecncv.app.** { *; }

# Firebase / Google Play services (push notifications)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# AndroidX FileProvider used by share/filesystem
-keep class androidx.core.content.FileProvider { *; }
