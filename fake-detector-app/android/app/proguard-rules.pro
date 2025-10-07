# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ==============================================
# CAPACITOR CORE OBFUSCATION RULES
# ==============================================

# Keep Capacitor core classes
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }

# Keep JavaScript interfaces
-keepclassmembers class * implements com.getcapacitor.Plugin {
    public *;
}

# Keep plugin classes and their methods
-keep class com.getcapacitor.plugin.** { *; }

# ==============================================
# CAPACITOR PLUGIN SPECIFIC RULES
# ==============================================

# Camera Plugin
-keep class com.getcapacitor.plugin.camera.** { *; }
-keep class androidx.camera.** { *; }
-keep class androidx.camera.core.** { *; }
-keep class androidx.camera.lifecycle.** { *; }

# File System Plugin
-keep class com.getcapacitor.plugin.filesystem.** { *; }
-keep class androidx.documentfile.** { *; }

# Splash Screen Plugin
-keep class com.getcapacitor.plugin.splashscreen.** { *; }

# Status Bar Plugin
-keep class com.getcapacitor.plugin.statusbar.** { *; }

# Browser Plugin
-keep class com.getcapacitor.plugin.browser.** { *; }

# AdMob Plugin
-keep class com.getcapacitor.plugin.admob.** { *; }
-keep class com.google.android.gms.ads.** { *; }

# Edge-to-Edge Support Plugin
-keep class com.getcapacitor.plugin.androidedgetoedgesupport.** { *; }

# ==============================================
# FIREBASE OBFUSCATION RULES
# ==============================================

# Keep Firebase classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Keep Firebase Analytics
-keep class com.google.firebase.analytics.** { *; }

# Keep Firebase Auth
-keep class com.google.firebase.auth.** { *; }

# ==============================================
# FIREBASE CRASHLYTICS OBFUSCATION RULES
# ==============================================

# Keep Crashlytics classes
-keep class com.google.firebase.crashlytics.** { *; }
-keep class com.google.firebase.crash.** { *; }

# Keep Crashlytics mapping file generation
-keepattributes SourceFile,LineNumberTable

# Keep Crashlytics NDK integration
-keep class com.google.firebase.crashlytics.ndk.** { *; }

# Keep Crashlytics custom keys and logs
-keep class com.google.firebase.crashlytics.FirebaseCrashlytics {
    *;
}

# Keep Crashlytics data collection switch
-keep class com.google.firebase.crashlytics.CrashlyticsCore {
    *;
}

# ==============================================
# ANDROID CORE OBFUSCATION RULES
# ==============================================

# Keep Android system classes
-keep class androidx.** { *; }
-keep class android.** { *; }
-keep class com.android.** { *; }

# Keep ViewModels and LiveData
-keep class androidx.lifecycle.** { *; }

# Keep Data Binding
-keep class androidx.databinding.** { *; }

# Keep Room Database
-keep class androidx.room.** { *; }

# Keep WorkManager
-keep class androidx.work.** { *; }

# ==============================================
# WEBVIEW AND JAVASCRIPT INTERFACE RULES
# ==============================================

# Keep WebView classes
-keep class android.webkit.** { *; }

# Keep JavaScript interfaces for WebView
-keepclassmembers class * implements android.webkit.WebViewClient {
    public *;
}
-keepclassmembers class * implements android.webkit.WebChromeClient {
    public *;
}

# ==============================================
# GENERAL APPLICATION RULES
# ==============================================

# Keep application classes
-keep class com.sampidia.fakeproductdetector.** { *; }

# Keep Activities, Services, BroadcastReceivers, ContentProviders
-keep class * extends android.app.Activity
-keep class * extends android.app.Service
-keep class * extends android.content.BroadcastReceiver
-keep class * extends android.content.ContentProvider

# Keep View classes
-keep class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
    public void set*(...);
}

# Keep Parcelable classes
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep Serializable classes
-keep class * implements java.io.Serializable { *; }

# ==============================================
# NATIVE METHOD AND ENUM RULES
# ==============================================

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep enums
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ==============================================
# REFLECTION AND ANNOTATION RULES
# ==============================================

# Keep classes that are accessed via reflection
-keep class **.R$* { *; }
-keep class **.BuildConfig { *; }

# Keep annotations
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes Deprecated
-keepattributes SourceFile,LineNumberTable
-keepattributes EnclosingMethod

# ==============================================
# PERFORMANCE OPTIMIZATION RULES
# ==============================================

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(java.lang.String, java.lang.String);
    public static int v(java.lang.String, java.lang.String, java.lang.Throwable);
    public static int d(java.lang.String, java.lang.String);
    public static int d(java.lang.String, java.lang.String, java.lang.Throwable);
    public static int i(java.lang.String, java.lang.String);
    public static int i(java.lang.String, java.lang.String, java.lang.Throwable);
    public static int w(java.lang.String, java.lang.String);
    public static int w(java.lang.String, java.lang.String, java.lang.Throwable);
    public static int e(java.lang.String, java.lang.String);
    public static int e(java.lang.String, java.lang.String, java.lang.Throwable);
}

# Remove System.out.println in release builds
-assumenosideeffects class java.lang.System {
    public static void print*(java.lang.String);
}

# ==============================================
# SECURITY ENHANCEMENT RULES
# ==============================================

# Keep security-related classes
-keep class javax.crypto.** { *; }
-keep class java.security.** { *; }

# Keep SSL/TLS classes
-keep class javax.net.ssl.** { *; }

# Keep key store classes
-keep class java.security.KeyStore { *; }
-keep class javax.net.ssl.TrustManagerFactory { *; }
-keep class javax.net.ssl.KeyManagerFactory { *; }

# ==============================================
# DEBUGGING SUPPORT (Comment out for production)
# ==============================================

# Uncomment the following lines if you need to debug obfuscated code
# -keepattributes SourceFile,LineNumberTable
# -renamesourcefileattribute SourceFile

# Keep line number information for better crash reporting
-keepattributes SourceFile,LineNumberTable
