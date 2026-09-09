import { useEffect, useRef } from 'react';
import api from '../../../api/api';
import { refrescarMenuCache } from '../../../services/menuCache';

export const useTerminalWS = (sedeActualId, setMesas, setOrdenesLlevar, setSolicitudesBot, sedeActualIdRef) => {
  const wsRef = useRef(null);

  const setMesasRef          = useRef(setMesas);
  const setOrdenesLlevarRef  = useRef(setOrdenesLlevar);
  const setSolicitudesBotRef = useRef(setSolicitudesBot);

  useEffect(() => { setMesasRef.current = setMesas; },                [setMesas]);
  useEffect(() => { setOrdenesLlevarRef.current = setOrdenesLlevar; }, [setOrdenesLlevar]);
  useEffect(() => { setSolicitudesBotRef.current = setSolicitudesBot; }, [setSolicitudesBot]);

  useEffect(() => {
    if (!sedeActualId) return;

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
        const wsUrl = `${baseUrl}/ws/salon/${sedeActualId}/?token=${wsToken}`;

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log(`✅ WebSocket Salón conectado (Sede ${sedeActualId})`);
        };

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);

            if (data.type === 'conexion_exitosa') {
              console.log(data.mensaje);
            }

            if (data.type === 'mesa_actualizada') {
              // 🔧 FIX: ignorar eventos de mesas si ya cambiamos de sede.
              // El WS se reconecta async y pueden llegar eventos de la sede anterior
              // justo cuando ya cargamos las mesas de la nueva sede.
              const sedeActivaAhora = sedeActualIdRef?.current ?? sedeActualId;
              if (String(sedeActivaAhora) !== String(sedeActualId)) return;

              setMesasRef.current(prev => prev.map(mesa =>
                mesa.id === data.mesa_id
                  ? { ...mesa, estado: data.estado, totalConsumido: data.total ?? mesa.totalConsumido }
                  : mesa
              ));
            }

            if (data.type === 'orden_llevar_actualizada') {
              const orden = data.orden;
              setOrdenesLlevarRef.current(prev => {
                if (data.accion === 'nueva')       return [orden, ...prev].slice(0, 10);
                if (data.accion === 'completada')  return prev.filter(o => o.id !== orden.id);
                if (data.accion === 'actualizada') return prev.map(o => o.id === orden.id ? orden : o);
                return prev;
              });
            }

            if (data.type === 'solicitud_cambio_nueva') {
              console.log('🤖 Solicitud del Bot recibida en Terminal:', data);
              if (setSolicitudesBotRef.current) {
                setSolicitudesBotRef.current(prev => {
                  if (prev.some(s => s.solicitud_id === data.solicitud_id)) return prev;
                  return [data, ...prev];
                });
              }
              try { new Audio('/assets/sounds/notification.mp3').play().catch(() => {}); } catch {}
            }

            if (data.type === 'error') {
              console.error('🛑 Django rechazó la conexión:', data.mensaje);
            }

            // La carta cambió (alguien activó/desactivó o editó un producto
            // desde el ERP) — refrescamos la cache local en segundo plano
            // para que la próxima mesa que se abra ya la tenga al día
            // (ver negocios/signals.py: avisar_menu_actualizado_*, y el
            // mismo manejo en SalonScreen.jsx de mobile).
            if (data.type === 'menu_actualizado') {
              refrescarMenuCache(sedeActualId).catch(() => {});
            }

          } catch (err) {
            console.warn('⚠️ Mensaje WebSocket no válido', err);
          }
        };

        ws.onclose = (e) => {
          if (e.code === 4001 || e.code === 4003) {
            console.error(`🔒 WebSocket rechazado (Código ${e.code}). Reintentando...`);
          }
          if (!unmounted) reconnectTimeout = setTimeout(conectar, 5000);
        };

        ws.onerror = () => {
          console.warn('⚠️ Error de red en WebSocket, reconectando...');
        };

      } catch (err) {
        console.warn('⚠️ No se pudo obtener token WS, reintentando en 5s...', err);
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

  }, [sedeActualId]);

  return wsRef;
};