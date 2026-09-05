import { useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform, Alert } from 'react-native';

const { NotificationModule } = NativeModules;

/**
 * Hook para escuchar pagos de Yape/Plin desde notificaciones del celular.
 * Solo funciona en Android y solo en el dispositivo que tenga Yape/Plin instalado.
 *
 * @param {boolean} activo - Si debe escuchar (solo el dispositivo con Yape)
 * @param {function} onPagoRecibido - Callback con los datos del pago
 */
export function useYapePlinListener(activo, onPagoRecibido) {
  const listenerRef = useRef(null);
  const onPagoRecibidoRef = useRef(onPagoRecibido);

  useEffect(() => {
    onPagoRecibidoRef.current = onPagoRecibido;
  }, [onPagoRecibido]);

  useEffect(() => {
    if (!activo || Platform.OS !== 'android' || !NotificationModule) return;

    const emitter = new NativeEventEmitter(NotificationModule);

    listenerRef.current = emitter.addListener('PagoYapePlinRecibido', (payloadJson) => {
      try {
        const data = typeof payloadJson === 'string'
          ? JSON.parse(payloadJson)
          : payloadJson;
        console.log('💜 Pago recibido:', data);
        onPagoRecibidoRef.current?.(data);
      } catch (e) {
        console.error('Error parseando pago:', e);
      }
    });

    return () => {
      listenerRef.current?.remove();
    };
  }, [activo]);
}

/**
 * Verifica si el permiso de lectura de notificaciones está activo
 */
export async function verificarPermisoNotificaciones() {
  if (Platform.OS !== 'android' || !NotificationModule) return false;
  try {
    return await NotificationModule.tienePermisoNotificaciones();
  } catch {
    return false;
  }
}

/**
 * Abre la pantalla de configuración para activar el permiso
 */
export async function abrirConfiguracionPermisos() {
  if (Platform.OS !== 'android' || !NotificationModule) return;
  try {
    await NotificationModule.abrirConfiguracionPermisos();
  } catch (e) {
    console.error('Error abriendo configuración:', e);
  }
}

/**
 * Verifica si la app ya está excluida del ahorro de batería. Sin esto,
 * Android (sobre todo Xiaomi/Huawei/Oppo) puede matar el lector de
 * notificaciones en segundo plano y dejar de detectar pagos hasta que
 * alguien reabra la app a mano.
 */
export async function verificarExclusionBateria() {
  if (Platform.OS !== 'android' || !NotificationModule) return false;
  try {
    return await NotificationModule.tieneExclusionBateria();
  } catch {
    return false;
  }
}

/**
 * Abre el diálogo del sistema para pedir la exclusión del ahorro de batería.
 */
export async function pedirExclusionBateria() {
  if (Platform.OS !== 'android' || !NotificationModule) return;
  try {
    await NotificationModule.pedirExclusionBateria();
  } catch (e) {
    console.error('Error pidiendo exclusión de batería:', e);
  }
}

export default NotificationModule;