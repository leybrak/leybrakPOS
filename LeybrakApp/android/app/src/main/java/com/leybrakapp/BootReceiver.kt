package com.leybrakapp

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.util.Log

/**
 * Tras reiniciar el celular (o actualizar la app), algunos fabricantes
 * (Xiaomi, Huawei, Oppo) no reconectan el NotificationListenerService
 * solos. requestRebind() fuerza al sistema a reintentar el bind sin que
 * el dueño del negocio tenga que reabrir la app a mano para que vuelva
 * a detectar los pagos de Yape/Plin.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        try {
            NotificationListenerService.requestRebind(
                ComponentName(context, YapeNotificationService::class.java)
            )
            Log.d("BootReceiver", "requestRebind enviado a YapeNotificationService")
        } catch (e: Exception) {
            Log.e("BootReceiver", "Error pidiendo rebind: ${e.message}")
        }
    }
}
