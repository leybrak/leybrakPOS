import { useEffect, useRef } from 'react';
import api from '../api/api';

// Espejo de pos-frontend/src/features/POS/hooks/usePagosWS.js.
// 🛠️ Sin este hook, el mobile solo se enteraba de un pago Yape/Plin si el
// MISMO celular que corre el POS tenía instalada la app de Yape/Plin y su
// NotificationListenerService seguía vivo en ese momento (ver
// useYapePlinListener.js) — si el negocio cobra en un celular/tablet
// distinto al que recibe las notificaciones de Yape (o Android mató el
// listener en segundo plano), la pantalla de "esperando Yape" se quedaba
// esperando para siempre aunque el backend sí hubiera registrado el pago.
// El backend YA transmite cada NotificacionPago por WS al grupo
// `pagos_negocio_{id}` (ver pago_yape_views.py) — la web ya escucha eso;
// el mobile no escuchaba nada.
export const usePagosWS = (negocioId, onMensaje) => {
  const onMensajeRef = useRef(onMensaje);
  useEffect(() => { onMensajeRef.current = onMensaje; }, [onMensaje]);

  useEffect(() => {
    if (!negocioId) return;

    let ws = null;
    let reconnectTimeout = null;
    let unmounted = false;

    const conectar = async () => {
      if (unmounted) return;
      try {
        const res = await api.get('/verificar-sesion/');
        const token = res.data.ws_token;
        ws = new WebSocket(`wss://pos.leybrak.com/ws/pagos/${negocioId}/?token=${token}`);

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            onMensajeRef.current?.(data);
          } catch {
            // mensaje no-JSON, se ignora
          }
        };
        ws.onclose = (e) => {
          if (e.code === 4001 || e.code === 4003) return;
          if (!unmounted) reconnectTimeout = setTimeout(conectar, 5000);
        };
        ws.onerror = () => ws.close();
      } catch {
        if (!unmounted) reconnectTimeout = setTimeout(conectar, 5000);
      }
    };

    conectar();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimeout);
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [negocioId]);
};
