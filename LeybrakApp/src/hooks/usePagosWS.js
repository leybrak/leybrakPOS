import { useEffect, useRef } from 'react';
import EncryptedStorage from 'react-native-encrypted-storage';
import api from '../api/api';

/**
 * Escucha por WebSocket los pagos Yape/Plin del negocio (grupo `pagos_negocio_{id}`).
 * Es el equivalente al listener nativo de notificaciones (useYapePlinListener), pero
 * para cuando la notificación la capturó OTRO dispositivo (p.ej. el celular del dueño
 * con Yape instalado) y no el tablet/celular donde está cobrando el cajero: sin esto,
 * ese segundo dispositivo se queda esperando para siempre porque nunca le llega el aviso.
 *
 * @param {boolean} activo - Si debe conectar (solo mientras se muestra el paso QR).
 * @param {function} onPagoRecibido - Callback con los datos del pago ({ tipo, monto, ... }).
 */
export function usePagosWS(activo, onPagoRecibido) {
  const onPagoRecibidoRef = useRef(onPagoRecibido);
  useEffect(() => { onPagoRecibidoRef.current = onPagoRecibido; }, [onPagoRecibido]);

  useEffect(() => {
    if (!activo) return;
    let ws = null;
    let unmounted = false;
    let retry = null;

    const conectar = async () => {
      if (unmounted) return;
      try {
        const negocioId = await EncryptedStorage.getItem('negocio_id');
        if (!negocioId) { retry = setTimeout(conectar, 5000); return; }

        const res   = await api.get('/verificar-sesion/');
        const token = res.data.ws_token;
        // El middleware de Channels solo lee el token de la cookie o del
        // query string (?token=), nunca de un header 'Authorization'.
        ws = new WebSocket(`wss://pos.leybrak.com/ws/pagos/${negocioId}/?token=${token}`);

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'pago_recibido') {
              onPagoRecibidoRef.current?.(data);
            }
          } catch {}
        };
        ws.onerror = () => ws.close();
        ws.onclose = (ev) => {
          if (ev?.code === 4001 || ev?.code === 4003) return; // sin acceso: no reintentar
          if (!unmounted) retry = setTimeout(conectar, 5000);
        };
      } catch {
        if (!unmounted) retry = setTimeout(conectar, 5000);
      }
    };

    conectar();
    return () => {
      unmounted = true;
      clearTimeout(retry);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [activo]);
}
