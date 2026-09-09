package com.leybrakapp

import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.*

class NotificationModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "NotificationModule"

    init {
        YapeNotificationService.reactContext = reactContext
    }

    @ReactMethod
    fun tienePermisoNotificaciones(promise: Promise) {
        try {
            val pkgName = reactContext.packageName
            val flat = Settings.Secure.getString(
                reactContext.contentResolver,
                "enabled_notification_listeners"
            )
            val tienePermiso = !TextUtils.isEmpty(flat) && flat.contains(pkgName)
            promise.resolve(tienePermiso)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun abrirConfiguracionPermisos(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
    @ReactMethod
    fun tieneExclusionBateria(promise: Promise) {
        try {
            val pm = reactContext.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(reactContext.packageName))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // Sin esto, Android (sobre todo Xiaomi/Huawei/Oppo) puede matar el
    // proceso en background y el celular deja de detectar pagos de
    // Yape/Plin hasta que alguien reabra la app a mano.
    @ReactMethod
    fun pedirExclusionBateria(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
            intent.data = Uri.parse("package:${reactContext.packageName}")
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun setDeviceToken(token: String) {
        // Lo guarda en memoria rápida
        YapeNotificationService.deviceToken = token
        
        // Lo guarda permanentemente en SharedPreferences
        val sharedPref = reactApplicationContext.getSharedPreferences("LeybrakPrefs", android.content.Context.MODE_PRIVATE)
        with (sharedPref.edit()) {
            putString("DEVICE_TOKEN", token)
            apply()
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
