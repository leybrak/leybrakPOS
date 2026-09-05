package com.leybrakapp

import android.app.Notification
import android.content.ComponentName
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class YapeNotificationService : NotificationListenerService() {
    companion object {
        private const val TAG = "YapeNotifService"
        private const val BASE_URL = "https://pos.leybrak.com/api"
        private val PAQUETES_YAPE = listOf(
            "com.bcp.innovacxion.yapeapp",
            "com.bcp.yape",
            "pe.com.interbank.yape"
        )
        private val PAQUETES_PLIN = listOf(
            "com.bbva.plin", "com.scotiabank.plin", "pe.com.viabcp.plin",
            "pe.com.interbank.mobilebanking", "com.banbif.plin"
        )
        var reactContext: ReactApplicationContext? = null
        var deviceToken: String? = null
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        try {
            val paquete = sbn.packageName ?: return
            Log.d("LeybrakTest", "🔔 Notificación detectada de: $paquete")
            val esYape  = PAQUETES_YAPE.any { paquete.contains(it, ignoreCase = true) }
            val esPlin  = PAQUETES_PLIN.any { paquete.contains(it, ignoreCase = true) }
            if (!esYape && !esPlin) return

            val extras = sbn.notification?.extras ?: return
            val titulo = extras.getString(Notification.EXTRA_TITLE) ?: ""
            val texto  = extras.getString(Notification.EXTRA_TEXT)
                      ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
            val textoCompleto = "$titulo $texto".trim()

            if (textoCompleto.isBlank()) return
            Log.d(TAG, "✅ ${if (esYape) "YAPE" else "PLIN"} | $textoCompleto")

            var token = deviceToken
            if (token.isNullOrBlank()) {
                // Si la variable está vacía, lo rescatamos de SharedPreferences
                val sharedPref = applicationContext.getSharedPreferences("LeybrakPrefs", android.content.Context.MODE_PRIVATE)
                token = sharedPref.getString("DEVICE_TOKEN", null)
            }

            if (token.isNullOrBlank()) {
                Log.e(TAG, "❌ Sin device_token")
                return
            }

            Thread { enviarAlBackend(token, textoCompleto) }.start()

        } catch (e: Exception) {
            Log.e(TAG, "Error: ${e.message}")
        }
    }

    private fun enviarAlBackend(token: String, texto: String) {
        try {
            val url = URL("$BASE_URL/yape/notificacion/")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 8000
            conn.readTimeout = 8000

            val body = JSONObject().apply {
                put("device_token", token)
                put("texto_notificacion", texto)
            }

            OutputStreamWriter(conn.outputStream).use { it.write(body.toString()) }

            val code = conn.responseCode
            Log.d(TAG, "📤 Backend: $code")
            
            if (code == 200 || code == 201) {
                // 1. Leemos el JSON real que nos devuelve Django
                val reader = java.io.BufferedReader(java.io.InputStreamReader(conn.inputStream))
                val responseJson = reader.readText()
                reader.close()

                Log.d(TAG, "📥 Respuesta Django: $responseJson")

                // 2. Emitimos el evento con el nombre exacto de tu hook y pasamos el JSON
                reactContext?.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("PagoYapePlinRecibido", responseJson) 
            }
            conn.disconnect()

        } catch (e: Exception) {
            Log.e(TAG, "Error backend: ${e.message}")
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification) {}

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "🔌 Listener conectado")
    }

    // Si el sistema (Doze, ahorro de batería agresivo del fabricante) nos
    // desconecta mientras la app sigue viva, pedimos que nos reconecte en
    // vez de quedarnos sordos hasta que alguien reabra la app a mano.
    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.w(TAG, "🔌 Listener desconectado — pidiendo rebind")
        requestRebind(ComponentName(applicationContext, YapeNotificationService::class.java))
    }
}