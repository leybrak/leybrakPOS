import { useEffect, useRef, useCallback } from 'react';
import api from '../../../api/api';

// onMensaje recibe CUALQUIER mensaje del canal de pagos del negocio (no solo
// 'pago_recibido') — el llamador decide qué hacer según `data.type`. Antes
// este hook filtraba internamente solo 'pago_recibido', así que no había
// forma de enterarse cuando OTRA caja confirmaba una notificación (evento
// 'notificacion_confirmada') para sacarla de la lista local a tiempo.
export const usePagosWS = (negocioId, onMensaje) => {
  const wsRef = useRef(null);

  const onMensajeRef = useRef(onMensaje);
  useEffect(() => { onMensajeRef.current = onMensaje; }, [onMensaje]);

  // Expone un método para cerrar el WS manualmente (cuando se cierra el modal)
  const desconectar = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null; // Evita reconexión al cerrar manualmente
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!negocioId) return;

    let ws = null;
    let reconnectTimeout = null;
    let unmounted = false;

    const conectar = async () => {
      if (unmounted) return;

      const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const baseUrl = import.meta.env.VITE_WS_URL || apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');

      try {
        const res = await api.get('/verificar-sesion/');
        const wsToken = res.data.ws_token;
        const wsUrl = `${baseUrl}/ws/pagos/${negocioId}/?token=${wsToken}`;

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log(`✅ WebSocket Pagos conectado (Negocio ${negocioId})`);
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            onMensajeRef.current?.(data);
          } catch (err) {
            console.warn('⚠️ Mensaje WebSocket Pagos no válido', err);
          }
        };

        ws.onclose = (e) => {
          if (e.code === 4001 || e.code === 4003) {
            console.error(`🔒 WebSocket Pagos rechazado (Código ${e.code}).`);
            return;
          }
          if (!unmounted) reconnectTimeout = setTimeout(conectar, 5000);
        };

        ws.onerror = () => {
          console.warn('⚠️ Error de red en WebSocket Pagos, reconectando...');
        };

      } catch (err) {
        console.warn('⚠️ No se pudo obtener token WS Pagos, reintentando...', err);
        if (!unmounted) reconnectTimeout = setTimeout(conectar, 5000);
      }
    };

    conectar();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimeout);
      if (ws) {
        if (ws.readyState === WebSocket.CONNECTING) ws.onopen = () => ws.close();
        else ws.close();
      }
    };
  }, [negocioId]);

  return { wsRef, desconectar };
};