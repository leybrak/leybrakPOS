import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, StatusBar, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import useAppStore from '../../store/useAppStore';
import api, { getOrdenes, actualizarOrden, getNegocio } from '../../api/api';
import ModalAlertaBot from '../../components/modals/ModalAlertaBot';
import { useToast } from '../../context/ToastContext';

// ─── Hook de tema (mismo patrón que SalonScreen/MenuScreen) ───
const useTema = () => {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal?.temaFondo !== 'light';
  const color  = configuracionGlobal?.colorPrimario || '#3b82f6';
  return {
    isDark, color,
    bg:        isDark ? '#050505' : '#f8fafc',
    bgCard:    isDark ? '#0a0a0a' : '#ffffff',
    bgCard2:   isDark ? '#121212' : '#f9fafb',
    bgCard3:   isDark ? '#1a1a1a' : '#f3f4f6',
    border:    isDark ? '#1a1a1a' : '#e5e7eb',
    border2:   isDark ? '#1e1e1e' : '#e5e7eb',
    textPrim:  isDark ? '#ffffff' : '#111111',
    textSec:   isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
  };
};

const ESTACIONES = ['TODO', 'COCINA', 'BAR', 'PARRILLA'];

// ─── Estilos de urgencia según minutos transcurridos (igual a View_Kds.jsx) ───
const estiloUrgencia = (minutos, t) => {
  if (minutos >= 20) {
    return { header: t.isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2', badgeBg: t.isDark ? 'rgba(239,68,68,0.2)' : '#fee2e2', badgeText: '#ef4444', texto: '¡URGENTE!' };
  }
  if (minutos >= 10) {
    return { header: t.isDark ? 'rgba(245,158,11,0.05)' : '#fffbeb', badgeBg: t.isDark ? 'rgba(245,158,11,0.1)' : '#fef3c7', badgeText: '#f59e0b', texto: 'Demorado' };
  }
  return { header: t.bgCard2, badgeBg: t.bgCard3, badgeText: '#22c55e', texto: 'A tiempo' };
};

// ─── Tarjeta de comanda ───
function TicketCard({ orden, t, color, onTacharItem, onDespachar }) {
  const urg = estiloUrgencia(orden.minutos, t);
  const todosListos = orden.items.every(i => i.listo);

  return (
    <View style={[k.ticket, { backgroundColor: t.bgCard, borderColor: t.border2 }]}>
      <View style={[k.ticketHeader, { backgroundColor: urg.header }]}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {orden.is_delivery && <Icon name="shopping-bag" size={12} color={t.textSec} />}
            <Text style={[k.ticketOrigen, { color: t.textPrim }]} numberOfLines={1}>{orden.origen}</Text>
          </View>
          <Text style={[k.ticketId, { color: t.textMuted }]}>#{orden.id}</Text>
        </View>
        <View style={[k.tiempoBadge, { backgroundColor: urg.badgeBg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="clock-o" size={11} color={urg.badgeText} />
            <Text style={[k.tiempoNum, { color: urg.badgeText }]}>{orden.minutos}'</Text>
          </View>
          <Text style={[k.tiempoTexto, { color: urg.badgeText }]}>{urg.texto}</Text>
        </View>
      </View>

      <View style={k.itemsBox}>
        {orden.items.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[k.item, { backgroundColor: t.bgCard2, borderColor: t.border2 }, item.listo && { opacity: 0.4 }]}
            onPress={() => onTacharItem(orden.kds_id, item.id)}
            activeOpacity={0.8}
          >
            <View style={[k.itemCant, { backgroundColor: item.listo ? 'rgba(34,197,94,0.2)' : t.bgCard3 }]}>
              {item.listo
                ? <Icon name="check" size={13} color="#22c55e" />
                : <Text style={[k.itemCantText, { color }]}>{item.cant}</Text>
              }
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={[k.itemNombre, { color: t.textPrim }, item.listo && { textDecorationLine: 'line-through' }]}>
                  {item.nombre}
                </Text>
                {item.agregado_reciente && !item.listo && (
                  <View style={k.badgeNuevo}>
                    <Icon name="bell" size={8} color={color} />
                    <Text style={[k.badgeNuevoText, { color }]}>NUEVO</Text>
                  </View>
                )}
              </View>
              {item.notas && !item.listo && (
                <View style={{ flexDirection: 'row', gap: 5, marginTop: 4 }}>
                  <Icon name="exclamation-triangle" size={11} color="#f59e0b" style={{ marginTop: 2 }} />
                  <Text style={k.itemNotas}>{item.notas}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[k.ticketFooter, { borderTopColor: t.border2 }]}>
        <TouchableOpacity
          style={[k.btnDespachar, { backgroundColor: todosListos ? '#16a34a' : color }]}
          onPress={() => onDespachar(orden)}
          activeOpacity={0.85}
        >
          {todosListos
            ? <><Icon name="check-circle" size={16} color="#fff" style={{ marginRight: 8 }} /><Text style={k.btnDespacharText}>DESPACHAR TICKET</Text></>
            : <Text style={k.btnDespacharText}>MARCAR LISTO</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Pantalla principal ───
export default function KdsScreen({ onCerrarTurno }) {
  const t = useTema();
  const toast = useToast();

  const [verificandoAcceso, setVerificandoAcceso] = useState(true);
  const [accesoPermitido, setAccesoPermitido] = useState(false);
  const [sedeId, setSedeId] = useState('');

  const [estacionActiva, setEstacionActiva] = useState('TODO');
  const [verConsolidado, setVerConsolidado] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [solicitudesBot, setSolicitudesBot] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const wsRef = useRef(null);

  // ─── Permisos del módulo cocina ───
  useEffect(() => {
    const verificar = async () => {
      try {
        const nId = await EncryptedStorage.getItem('negocio_id');
        const sId = await EncryptedStorage.getItem('sede_id');
        setSedeId(sId);
        const res = await getNegocio(nId);
        setAccesoPermitido(!!res.data.mod_cocina_activo);
      } catch (e) {
        setAccesoPermitido(false);
      } finally {
        setVerificandoAcceso(false);
      }
    };
    verificar();
  }, []);

  // ─── Carga inicial de comandas en preparación ───
  const cargar = useCallback(async () => {
    if (!accesoPermitido || !sedeId) return;
    try {
      const res = await getOrdenes({ sede_id: sedeId });
      const pendientes = (res.data || []).filter(o => o.estado === 'preparando');
      const formateadas = pendientes.map(o => {
        const fecha = new Date(o.creado_en || new Date());
        const minutos = Math.floor((new Date() - fecha) / 60000);
        return {
          kds_id: `mem_${o.id}_${Math.random()}`,
          id: o.id,
          // 🛠️ o.mesa es el id autoincremental GLOBAL de la fila de mesa
          // (no el número real de la mesa del negocio) — usar mesa_nombre
          // (numero_o_nombre, ya viene del serializer).
          origen: o.mesa ? `Mesa ${o.mesa_nombre || o.mesa}` : `LLEVAR - ${o.cliente_nombre || 'Cliente'}`,
          is_delivery: !o.mesa,
          minutos: isNaN(minutos) ? 0 : minutos,
          estacion: 'COCINA',
          items: (o.detalles || []).map(d => ({
            id: d.id, cant: d.cantidad, nombre: d.producto_nombre || d.nombre, listo: false, notas: d.notas_cocina,
          })),
        };
      });
      setOrdenes(formateadas);
    } catch (e) {
      console.error('Error cargando comandas:', e);
    } finally {
      setRefreshing(false);
    }
  }, [accesoPermitido, sedeId]);

  useEffect(() => { cargar(); }, [cargar]);

  // ─── WebSocket de cocina — mismo patrón (token en query) que SalonScreen ───
  useEffect(() => {
    if (!accesoPermitido || !sedeId) return;
    let ws = null;
    let unmounted = false;
    let retry = null;

    const conectar = async () => {
      if (unmounted) return;
      try {
        const res = await api.get('/verificar-sesion/');
        const token = res.data.ws_token;
        ws = new WebSocket(`wss://pos.leybrak.com/ws/cocina/${sedeId}/?token=${token}`);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);

            if (data.type === 'nueva_orden' || data.type === 'orden_nueva') {
              const nuevosItems = (data.orden.detalles || []).map(d => ({
                id: d.id,
                cant: d.cantidad !== undefined ? d.cantidad : 1,
                nombre: d.producto_nombre || d.nombre,
                listo: false,
                notas: d.notas_cocina,
              }));

              setOrdenes(prev => {
                const viejo = prev.find(o => o.id === data.orden.id);
                if (viejo) {
                  const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
                  const itemsNuevos = nuevosItems
                    .filter(n => !viejo.items.some(v => v.id === n.id))
                    .map(item => ({ ...item, agregado_reciente: true, hora_agregado: hora }));
                  const actualizado = { ...viejo, items: [...viejo.items, ...itemsNuevos] };
                  return [actualizado, ...prev.filter(o => o.id !== data.orden.id)];
                }
                const nueva = {
                  kds_id: `ws_${data.orden.id}_${Date.now()}`,
                  id: data.orden.id,
                  real_id: data.orden.real_id || data.orden.id,
                  origen: data.orden.mesa ? `Mesa ${data.orden.mesa_nombre || data.orden.mesa}` : `DELIVERY - ${data.orden.cliente_nombre || 'Cliente'}`,
                  is_delivery: !data.orden.mesa,
                  minutos: 0,
                  estacion: 'COCINA',
                  items: nuevosItems,
                };
                return [nueva, ...prev];
              });
            }

            if (data.type === 'solicitud_cambio_nueva') {
              setSolicitudesBot(prev => prev.some(s => s.solicitud_id === data.solicitud_id) ? prev : [data, ...prev]);
            }
          } catch (_) {}
        };
        ws.onerror = () => ws.close();
        ws.onclose = () => { if (!unmounted) retry = setTimeout(conectar, 4000); };
      } catch (_) {
        if (!unmounted) retry = setTimeout(conectar, 4000);
      }
    };

    conectar();
    return () => { unmounted = true; clearTimeout(retry); ws?.close(); };
  }, [accesoPermitido, sedeId]);

  // ─── Timer: sube el contador de minutos cada minuto ───
  useEffect(() => {
    if (!accesoPermitido) return;
    const id = setInterval(() => {
      setOrdenes(prev => prev.map(o => ({ ...o, minutos: o.minutos + 1 })));
    }, 60000);
    return () => clearInterval(id);
  }, [accesoPermitido]);

  const tacharItem = (kdsId, itemId) => {
    setOrdenes(prev => prev.map(o => o.kds_id === kdsId
      ? { ...o, items: o.items.map(i => i.id === itemId ? { ...i, listo: !i.listo } : i) }
      : o
    ));
  };

  const despacharOrden = async (orden) => {
    try {
      await actualizarOrden(orden.real_id || orden.id, { estado: 'listo' });
      setHistorial(prev => [orden, ...prev].slice(0, 5));
      setOrdenes(prev => prev.filter(o => o.kds_id !== orden.kds_id));
    } catch (e) {
      toast.error('No se pudo despachar la orden.');
    }
  };

  const recuperarOrden = (orden) => {
    setOrdenes(prev => [...prev, orden]);
    setHistorial(prev => prev.filter(h => h.kds_id !== orden.kds_id));
  };

  const obtenerConsolidado = () => {
    const resumen = {};
    ordenes
      .filter(o => estacionActiva === 'TODO' || o.estacion === estacionActiva)
      .forEach(o => o.items.forEach(i => { if (!i.listo) resumen[i.nombre] = (resumen[i.nombre] || 0) + i.cant; }));
    return Object.entries(resumen);
  };

  const manejarResolucionBot = async (solicitud_id, orden_id, decision) => {
    try {
      await api.post(`/ordenes/${orden_id}/resolver_solicitud_bot/`, { solicitud_id, decision });
      setSolicitudesBot(prev => prev.filter(s => s.solicitud_id !== solicitud_id));
    } catch (e) {
      toast.error('No se pudo resolver la solicitud del bot.');
    }
  };

  const ordenesFiltradas = ordenes.filter(o => estacionActiva === 'TODO' || o.estacion === estacionActiva);

  // ─── Estados de carga / permisos ───
  if (verificandoAcceso) {
    return (
      <View style={[k.loader, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
        <Icon name="cutlery" size={40} color={t.textMuted} style={{ marginBottom: 16, opacity: 0.5 }} />
        <ActivityIndicator size="large" color={t.color} />
        <Text style={[k.loaderText, { color: t.textMuted }]}>VERIFICANDO PERMISOS DE COCINA...</Text>
      </View>
    );
  }

  if (!accesoPermitido) {
    return (
      <View style={[k.loader, { backgroundColor: t.bg, padding: 24 }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
        <View style={k.moduloOffBox}>
          <Icon name="power-off" size={26} color="#ef4444" />
        </View>
        <Text style={[k.moduloOffTitulo, { color: t.textPrim }]}>Módulo Desactivado</Text>
        <Text style={[k.moduloOffDesc, { color: t.textSec }]}>
          La Pantalla de Cocina (KDS) no está habilitada para la suscripción actual de este negocio.
        </Text>
        {onCerrarTurno && (
          <TouchableOpacity
            style={[k.btnDespachar, { backgroundColor: t.color, marginTop: 24, width: '100%' }]}
            onPress={() => Alert.alert('Terminar turno', '¿Terminar tu turno? Se marcará tu salida.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Terminar', style: 'destructive', onPress: onCerrarTurno },
            ])}
          >
            <Text style={k.btnDespacharText}>TERMINAR TURNO</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[k.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bgCard} />

      {/* Header */}
      <View style={[k.header, { backgroundColor: t.bgCard, borderBottomColor: t.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[k.headerIcono, { backgroundColor: `${t.color}15` }]}>
            <Icon name="cutlery" size={18} color={t.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[k.headerTitulo, { color: t.textPrim }]}>
              LEYBRAK <Text style={{ color: t.color }}>KDS</Text>
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <View style={k.dotVivo} />
              <Text style={[k.headerSub, { color: t.textMuted }]}>SISTEMA EN LÍNEA · {ordenesFiltradas.length} PENDIENTES</Text>
            </View>
          </View>
          {onCerrarTurno && (
            <TouchableOpacity
              style={[k.headerBtn, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}
              onPress={() => Alert.alert('Terminar turno', '¿Terminar tu turno? Se marcará tu salida.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Terminar', style: 'destructive', onPress: onCerrarTurno },
              ])}
            >
              <Icon name="sign-out" size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            {ESTACIONES.map(est => (
              <TouchableOpacity
                key={est}
                style={[k.estacionPill, { backgroundColor: t.bgCard2, borderColor: t.border2 }, estacionActiva === est && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => setEstacionActiva(est)}
                activeOpacity={0.8}
              >
                <Text style={[k.estacionPillText, { color: estacionActiva === est ? '#fff' : t.textSec }]}>{est}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[k.headerBtn, verConsolidado && { backgroundColor: t.color, borderColor: t.color }, !verConsolidado && { backgroundColor: t.bgCard2, borderColor: t.border2 }]}
            onPress={() => setVerConsolidado(!verConsolidado)}
          >
            <Icon name={verConsolidado ? 'list' : 'bar-chart'} size={16} color={verConsolidado ? '#fff' : t.textSec} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={k.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={t.color} />}
      >
        {verConsolidado ? (
          <View style={[k.consolidadoBox, { backgroundColor: t.bgCard, borderColor: t.border2 }]}>
            <Text style={[k.consolidadoTitulo, { color: t.textMuted }]}>RESUMEN DE PRODUCCIÓN: {estacionActiva}</Text>
            {obtenerConsolidado().length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Icon name="check-circle" size={32} color={t.textMuted} style={{ opacity: 0.5, marginBottom: 10 }} />
                <Text style={{ color: t.textSec, fontSize: 13, fontWeight: '700' }}>No hay platos pendientes en esta estación.</Text>
              </View>
            ) : (
              obtenerConsolidado().map(([nombre, cant]) => (
                <View key={nombre} style={[k.consolidadoRow, { backgroundColor: t.bgCard2, borderColor: t.border2 }]}>
                  <Text style={[k.consolidadoNombre, { color: t.textPrim }]}>{nombre}</Text>
                  <Text style={[k.consolidadoCant, { color: t.color }]}>x{cant}</Text>
                </View>
              ))
            )}
          </View>
        ) : ordenesFiltradas.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 80, opacity: 0.5 }}>
            <Icon name="cutlery" size={56} color={t.textMuted} style={{ marginBottom: 14 }} />
            <Text style={{ color: t.textMuted, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', fontSize: 13 }}>Esperando comandas...</Text>
          </View>
        ) : (
          ordenesFiltradas.map(orden => (
            <TicketCard
              key={orden.kds_id}
              orden={orden}
              t={t}
              color={t.color}
              onTacharItem={tacharItem}
              onDespachar={despacharOrden}
            />
          ))
        )}
      </ScrollView>

      {historial.length > 0 && (
        <View style={[k.historialFooter, { backgroundColor: t.bgCard, borderTopColor: t.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 4 }}>
            <Icon name="clock-o" size={12} color={t.textMuted} />
            <Text style={[k.historialLabel, { color: t.textMuted }]}>RECIENTES:</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {historial.map(h => (
              <TouchableOpacity
                key={h.kds_id}
                style={[k.historialChip, { backgroundColor: t.bgCard2, borderColor: t.border2 }]}
                onPress={() => recuperarOrden(h)}
                activeOpacity={0.8}
              >
                <Icon name="undo" size={12} color={t.textMuted} style={{ marginRight: 6 }} />
                <Text style={[k.historialChipText, { color: t.textSec }]}>Recuperar {h.origen}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {solicitudesBot.length > 0 && (
        <ModalAlertaBot solicitud={solicitudesBot[0]} onResolver={manejarResolucionBot} />
      )}
    </View>
  );
}

const k = StyleSheet.create({
  container:  { flex: 1 },
  loader:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 16 },

  moduloOffBox:   { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  moduloOffTitulo:{ fontSize: 20, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  moduloOffDesc:  { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  header:       { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 14, borderBottomWidth: 1 },
  headerIcono:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  headerSub:    { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  dotVivo:      { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  headerBtn:    { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  estacionPill:     { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  estacionPillText: { fontSize: 11, fontWeight: '800' },

  content: { padding: 16, paddingBottom: 40 },

  consolidadoBox:     { borderRadius: 20, borderWidth: 1, padding: 20 },
  consolidadoTitulo:  { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center', marginBottom: 16 },
  consolidadoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  consolidadoNombre:  { fontSize: 15, fontWeight: '700' },
  consolidadoCant:    { fontSize: 20, fontWeight: '900' },

  ticket:       { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 14 },
  ticketOrigen: { fontSize: 16, fontWeight: '800' },
  ticketId:     { fontSize: 11, fontWeight: '600', marginTop: 2 },
  tiempoBadge:  { alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  tiempoNum:    { fontSize: 17, fontWeight: '900' },
  tiempoTexto:  { fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 2, opacity: 0.9, textTransform: 'uppercase' },

  itemsBox: { padding: 10, gap: 8 },
  item:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  itemCant: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  itemCantText: { fontSize: 13, fontWeight: '800' },
  itemNombre:   { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  itemNotas:    { fontSize: 11, fontWeight: '600', color: '#f59e0b', flexShrink: 1, lineHeight: 15 },
  badgeNuevo:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(59,130,246,0.1)' },
  badgeNuevoText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  ticketFooter:  { padding: 10, borderTopWidth: 1 },
  btnDespachar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 14 },
  btnDespacharText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  historialFooter: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: 1 },
  historialLabel:  { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  historialChip:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  historialChipText: { fontSize: 11, fontWeight: '700' },
});
