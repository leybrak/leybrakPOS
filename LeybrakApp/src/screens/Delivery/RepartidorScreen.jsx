import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Linking, Alert, StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import useAppStore from '../../store/useAppStore';
import {
  getPedidosDelivery, tomarPedidoDelivery, actualizarEstadoDelivery, avisarClienteDelivery,
} from '../../api/api';

const ESTADOS = {
  pendiente: { label: 'Disponible', color: '#3b82f6' },
  asignado:  { label: 'Asignado',   color: '#f59e0b' },
  en_camino: { label: 'En camino',  color: '#8b5cf6' },
  entregado: { label: 'Entregado',  color: '#10b981' },
};

const MENSAJES = [
  { label: 'Voy en camino 🛵',        texto: 'Hola 👋 Soy tu repartidor, voy en camino con tu pedido 🛵' },
  { label: 'Llegué a tu dirección 📍', texto: 'Llegué a tu dirección 📍 Estoy afuera con tu pedido.' },
  { label: 'No encuentro la dirección', texto: 'Hola, estoy cerca pero no ubico bien tu dirección. ¿Me pasás una referencia? 🙏' },
];

export default function RepartidorScreen({ onLogout }) {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal?.temaFondo !== 'light';
  const color  = configuracionGlobal?.colorPrimario || '#ff5a1f';

  const t = {
    bg:     isDark ? '#050505' : '#f0f0f0',
    card:   isDark ? '#111111' : '#ffffff',
    border: isDark ? '#1f1f1f' : '#e5e7eb',
    text:   isDark ? '#ffffff' : '#111111',
    sub:    isDark ? '#9ca3af' : '#6b7280',
    mut:    isDark ? '#4b5563' : '#9ca3af',
  };

  const [pedidos, setPedidos] = useState([]);
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [accionando, setAccionando] = useState(null);

  useEffect(() => {
    EncryptedStorage.getItem('empleado_nombre').then(n => setNombre(n || 'Repartidor')).catch(() => {});
  }, []);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const res = await getPedidosDelivery();
      setPedidos(res.data?.pedidos || []);
    } catch (e) {
      if (!silencioso) Alert.alert('Error', e?.response?.data?.error || 'No se pudieron cargar los pedidos.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = setInterval(() => cargar(true), 20000);
    return () => clearInterval(id);
  }, [cargar]);

  const onRefresh = () => { setRefrescando(true); cargar(true); };

  // ── Navegación (inDrive style: elegir app) ──────────────────────
  const navegarA = (lat, lng) => {
    if (lat == null || lng == null) { Alert.alert('Sin ubicación', 'Este pedido no tiene coordenadas.'); return; }
    Alert.alert('Navegar con', '¿Qué app querés usar?', [
      { text: 'Google Maps', onPress: () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`) },
      { text: 'Waze',        onPress: () => Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ── Iniciar ruta: marca los asignados como "en camino" (avisa al
  //    cliente solo) y abre Google Maps con TODAS las paradas. ──────
  const iniciarRuta = async () => {
    const activos = pedidos.filter(p =>
      (p.estado_delivery === 'asignado' || p.estado_delivery === 'en_camino') && p.latitud != null);
    if (activos.length === 0) { Alert.alert('Sin paradas', 'No tenés pedidos asignados con ubicación.'); return; }

    setAccionando('ruta');
    try {
      for (const p of activos.filter(x => x.estado_delivery === 'asignado')) {
        try { await actualizarEstadoDelivery(p.id, 'en_camino'); } catch (e) { console.warn('No se pudo marcar en_camino el pedido', p.id, e?.response?.data?.error || e.message); }
      }
      const puntos = activos.map(p => `${p.latitud},${p.longitud}`);
      const destino = puntos[puntos.length - 1];
      const waypoints = puntos.slice(0, -1).join('|');
      let url = `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
      Linking.openURL(url);
      await cargar(true);
    } finally {
      setAccionando(null);
    }
  };

  const llamar = (tel) => {
    const num = (tel || '').replace(/\D/g, '');
    if (!num) { Alert.alert('Sin teléfono', 'El pedido no tiene número del cliente.'); return; }
    Linking.openURL(`tel:${num}`);
  };

  const whatsapp = (p) => {
    const opciones = MENSAJES.map(m => ({ text: m.label, onPress: () => enviarMensaje(p, m.texto) }));
    opciones.push({ text: 'Cancelar', style: 'cancel' });
    Alert.alert('Mensaje al cliente', 'Se envía por WhatsApp', opciones);
  };
  const enviarMensaje = async (p, texto) => {
    try {
      await avisarClienteDelivery(p.id, texto);
      Alert.alert('✅ Enviado', 'El cliente recibió tu mensaje por WhatsApp.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo enviar el mensaje.');
    }
  };

  const ejecutar = async (id, fn) => {
    setAccionando(id);
    try { await fn(); await cargar(true); }
    catch (e) { Alert.alert('Error', e?.response?.data?.error || 'No se pudo actualizar.'); }
    finally { setAccionando(null); }
  };
  const tomar    = (p) => ejecutar(p.id, () => tomarPedidoDelivery(p.id));
  const enCamino = (p) => ejecutar(p.id, () => actualizarEstadoDelivery(p.id, 'en_camino'));
  const entregar = (p) => Alert.alert('Confirmar entrega', `¿Marcar el pedido #${p.id} como entregado?`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Entregado', onPress: () => ejecutar(p.id, () => actualizarEstadoDelivery(p.id, 'entregado')) },
  ]);

  const hayRuta = pedidos.some(p => p.estado_delivery === 'asignado' || p.estado_delivery === 'en_camino');

  const renderItem = ({ item: p }) => {
    const est = ESTADOS[p.estado_delivery] || ESTADOS.pendiente;
    const ocupado = accionando === p.id;
    const pagado = p.estado_pago === 'pagado';
    const asignado = p.estado_delivery !== 'pendiente';
    return (
      <View style={[s.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cliente, { color: t.text }]}>{p.cliente_nombre}</Text>
            <Text style={[s.pedidoId, { color: t.mut }]}>Pedido #{p.id}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: est.color + '22' }]}>
            <Text style={[s.badgeText, { color: est.color }]}>{est.label}</Text>
          </View>
        </View>

        <View style={s.row}>
          <Icon name="map-marker" size={15} color={t.sub} style={{ width: 20 }} />
          <Text style={[s.rowText, { color: t.sub }]} numberOfLines={2}>{p.direccion || 'Sin dirección'}</Text>
        </View>
        {p.items?.length > 0 && (
          <View style={s.row}>
            <Icon name="shopping-bag" size={14} color={t.sub} style={{ width: 20 }} />
            <Text style={[s.rowText, { color: t.sub }]} numberOfLines={2}>
              {p.items.map(i => `${i.cantidad}x ${i.nombre}`).join(', ')}
            </Text>
          </View>
        )}
        <View style={[s.row, { marginTop: 6 }]}>
          <Icon name="money" size={14} color={t.sub} style={{ width: 20 }} />
          <Text style={[s.rowText, { color: t.text, fontWeight: '800' }]}>S/ {p.total.toFixed(2)}</Text>
          <View style={[s.cobroTag, { backgroundColor: pagado ? '#10b98122' : '#f59e0b22' }]}>
            <Text style={[s.cobroText, { color: pagado ? '#10b981' : '#f59e0b' }]}>
              {pagado ? 'PAGADO' : 'COBRAR AL ENTREGAR'}
            </Text>
          </View>
        </View>
        {!pagado && !!p.metodo_pago_esperado && (
          <Text style={[s.metodo, { color: t.mut }]}>Método: {p.metodo_pago_esperado}</Text>
        )}

        {/* Contacto (solo si ya lo tomó) */}
        {asignado && (
          <View style={s.contacto}>
            <TouchableOpacity style={[s.btnIcono, { borderColor: t.border }]} onPress={() => navegarA(p.latitud, p.longitud)} activeOpacity={0.8}>
              <Icon name="location-arrow" size={15} color={t.text} /><Text style={[s.btnIconoText, { color: t.text }]}>Navegar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnIcono, { borderColor: t.border }]} onPress={() => llamar(p.cliente_telefono)} activeOpacity={0.8}>
              <Icon name="phone" size={15} color="#3b82f6" /><Text style={[s.btnIconoText, { color: t.text }]}>Llamar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnIcono, { borderColor: t.border }]} onPress={() => whatsapp(p)} activeOpacity={0.8}>
              <Icon name="whatsapp" size={15} color="#10b981" /><Text style={[s.btnIconoText, { color: t.text }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Acción de estado */}
        <View style={{ marginTop: 12 }}>
          {p.estado_delivery === 'pendiente' && (
            <TouchableOpacity style={[s.btnMain, { backgroundColor: color }]} onPress={() => tomar(p)} disabled={ocupado} activeOpacity={0.85}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={s.btnMainText}>Tomar pedido</Text>}
            </TouchableOpacity>
          )}
          {p.estado_delivery === 'asignado' && (
            <TouchableOpacity style={[s.btnMain, { backgroundColor: '#8b5cf6' }]} onPress={() => enCamino(p)} disabled={ocupado} activeOpacity={0.85}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={s.btnMainText}>Salir / En camino</Text>}
            </TouchableOpacity>
          )}
          {p.estado_delivery === 'en_camino' && (
            <TouchableOpacity style={[s.btnMain, { backgroundColor: '#10b981' }]} onPress={() => entregar(p)} disabled={ocupado} activeOpacity={0.85}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={s.btnMainText}>Marcar entregado</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.titulo, { color: t.text }]}>🛵 Mis entregas</Text>
          <Text style={[s.subtitulo, { color: t.sub }]}>
            {nombre} · {pedidos.length} {pedidos.length === 1 ? 'pedido' : 'pedidos'}
          </Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={[s.salir, { borderColor: t.border }]} activeOpacity={0.7}>
          <Icon name="sign-out" size={16} color={t.sub} />
        </TouchableOpacity>
      </View>

      {/* Iniciar ruta */}
      {hayRuta && (
        <TouchableOpacity
          style={[s.btnRuta, { backgroundColor: color }]}
          onPress={iniciarRuta}
          disabled={accionando === 'ruta'}
          activeOpacity={0.85}
        >
          {accionando === 'ruta'
            ? <ActivityIndicator color="#fff" />
            : <><Icon name="motorcycle" size={16} color="#fff" /><Text style={s.btnRutaText}>Iniciar ruta y avisar a clientes</Text></>}
        </TouchableOpacity>
      )}

      {cargando ? (
        <ActivityIndicator size="large" color={color} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={color} />}
          ListEmptyComponent={
            <View style={s.vacio}>
              <Icon name="motorcycle" size={40} color={t.mut} />
              <Text style={[s.vacioText, { color: t.mut }]}>No hay pedidos de delivery por ahora.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12 },
  titulo:    { fontSize: 24, fontWeight: '900' },
  subtitulo: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  salir:     { width: 42, height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnRuta:   { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', height: 50, marginHorizontal: 16, marginBottom: 6, borderRadius: 14 },
  btnRutaText:{ color: '#fff', fontWeight: '900', fontSize: 15 },
  card:      { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  cardHead:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cliente:   { fontSize: 16, fontWeight: '800' },
  pedidoId:  { fontSize: 11, fontWeight: '700', marginTop: 2 },
  badge:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  row:       { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rowText:   { fontSize: 13, flex: 1 },
  cobroTag:  { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  cobroText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  metodo:    { fontSize: 11, marginTop: 4, marginLeft: 20 },
  contacto:  { flexDirection: 'row', gap: 8, marginTop: 14 },
  btnIcono:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  btnIconoText:{ fontSize: 11, fontWeight: '700' },
  btnMain:   { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnMainText:{ color: '#fff', fontWeight: '800', fontSize: 14 },
  vacio:     { alignItems: 'center', marginTop: 80, gap: 12 },
  vacioText: { fontSize: 14, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40 },
});
