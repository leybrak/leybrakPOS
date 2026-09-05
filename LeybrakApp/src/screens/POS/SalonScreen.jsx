import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  Platform, StatusBar, Alert, Animated
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import useAppStore from '../../store/useAppStore';
import ModalCierreCaja from '../../components/modals/ModalCierreCaja';
import ModalMovimientoCaja from '../../components/modals/ModalMovimientoCaja';
import ModalCobro from '../../components/modals/ModalCobro';
// ─── IMPORTACIONES DE API Y POS ───
import api, {
  getMesas, getSedes, getOrdenesLlevar, getOrdenes,
  actualizarOrden, actualizarMesa,
  abrirCajaBD, getEstadoCaja,
  crearOrden, crearPago,
  registrarMovimientoCaja, validarPinEmpleado
} from '../../api/api';

// ─── Hook de tema (Alineado con los colores de tu Web) ───
const useTema = () => {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal.temaFondo !== 'light';
  const color  = configuracionGlobal.colorPrimario || '#ff5a1f'; 
  return {
    isDark, color,
    bg:        isDark ? '#0a0a0a' : '#f0f0f0',
    bgCard:    isDark ? '#161616' : '#ffffff',
    bgCard2:   isDark ? '#1a1a1a' : '#f9fafb',
    bgInput:   isDark ? '#0a0a0a' : '#f9fafb',
    border:    isDark ? '#2a2a2a' : '#e5e7eb',
    border2:   isDark ? '#333333' : '#d1d5db',
    textPrim:  isDark ? '#ffffff' : '#111111',
    textSec:   isDark ? '#a3a3a3' : '#6b7280', 
    textMuted: isDark ? '#737373' : '#9ca3af', 
  };
};

// ─── Colores de estado de mesa (Igual a tu Grid web) ───
const getMesaStyles = (estado, colorPrimario, isDark) => {
  const est = estado?.toLowerCase() || 'libre';
  
  if (est === 'ocupada') {
    return { bg: isDark ? `${colorPrimario}15` : `${colorPrimario}10`, border: `${colorPrimario}60`, textPrim: isDark ? '#fff' : '#000', badgeBg: `${colorPrimario}20`, badgeText: colorPrimario, icon: 'cutlery' };
  }
  if (est === 'pidiendo') {
    return { bg: isDark ? '#fbbf2415' : '#fef9c3', border: '#fbbf24aa', textPrim: '#fbbf24', badgeBg: '#fbbf2433', badgeText: '#fbbf24', icon: 'pencil' };
  }
  if (est === 'cobrando') { // Naranja web
    return { bg: isDark ? '#f9731615' : '#fff7ed', border: '#f97316aa', textPrim: '#f97316', badgeBg: '#f9731633', badgeText: '#f97316', icon: 'credit-card' };
  }
  // Libre
  return { bg: isDark ? '#161616' : '#ffffff', border: isDark ? '#2a2a2a' : '#e5e7eb', textPrim: isDark ? '#ffffff' : '#111111', badgeBg: isDark ? '#222222' : '#f3f4f6', badgeText: isDark ? '#a3a3a3' : '#6b7280', icon: null };
};

const labelEstado = (estado) => {
  switch (estado) {
    case 'ocupada':  return 'Ocupada';
    case 'pidiendo': return 'Pidiendo';
    case 'cobrando': return 'Cobrando';
    default:         return 'Libre';
  }
};

// ─── Tarjeta de mesa (Estilo Web: rounded-3xl) ───
function TarjetaMesa({ mesa, t, color, onPress, seleccionada, modoUnir, ancho }) {
  const styles = getMesaStyles(mesa.estado, color, t.isDark);
  
  return (
    <TouchableOpacity
      style={[
        s.mesaCard,
        { width: ancho, backgroundColor: styles.bg, borderColor: styles.border },
        seleccionada && { backgroundColor: color, borderColor: color, transform: [{ scale: 1.02 }] },
        modoUnir && !seleccionada && { opacity: 0.7 }
      ]}
      onPress={() => onPress(mesa)}
      activeOpacity={0.8}
    >
      <View style={s.mesaCardHeader}>
        <View style={[s.mesaEstadoBadge, { backgroundColor: seleccionada ? 'rgba(255,255,255,0.2)' : styles.badgeBg }]}>
          <Text style={[s.mesaEstadoText, { color: seleccionada ? '#fff' : styles.badgeText }]}>
            {mesa.esGigante ? 'GRUPO' : labelEstado(mesa.estado).toUpperCase()}
          </Text>
        </View>
        {styles.icon && !modoUnir && <Icon name={styles.icon} size={12} color={styles.badgeText} style={{ opacity: 0.7 }} />}
      </View>

      <View style={s.mesaCardBody}>
        <Text style={[s.mesaNumero, { color: seleccionada ? '#fff' : styles.textPrim }]}>
          {mesa.numero_o_nombre}
        </Text>
      </View>

      {mesa.total_orden > 0 && !modoUnir && (
        <Text style={[s.mesaTotal, { color: seleccionada ? '#fff' : styles.textPrim }]}>
          S/ {parseFloat(mesa.total_orden).toFixed(2)}
        </Text>
      )}

      {/* Indicador de mesas unidas */}
      {mesa.unida_a && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Icon name="link" size={10} color={seleccionada ? '#fff' : t.textMuted} style={{ marginRight: 4 }} />
          <Text style={{ fontSize: 9, fontWeight: '700', color: seleccionada ? '#fff' : t.textMuted }}>Unida a {mesa.unida_a}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Modal cliente llevar (Estilo Web) ───
function ModalCliente({ visible, t, color, onConfirmar, onCerrar }) {
  const [nombre, setNombre]     = useState('');
  const [telefono, setTelefono] = useState('');

  useEffect(() => { if (visible) { setNombre(''); setTelefono(''); } }, [visible]);

  const handleConfirmar = () => {
    if (!nombre.trim()) { Alert.alert('Error', 'El nombre es obligatorio.'); return; }
    onConfirmar({ nombre, telefono });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={mc.overlay}>
        <View style={[mc.modal, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={[mc.header, { borderBottomColor: t.border }]}>
            <View>
              <Text style={[mc.titulo, { color: t.textPrim }]}>Datos del Cliente</Text>
              <Text style={[mc.sub, { color: t.textSec }]}>Identifica el pedido para llevar</Text>
            </View>
            <TouchableOpacity onPress={onCerrar} style={[mc.closeBtn, { backgroundColor: t.bgCard2 }]}>
              <Icon name="times" size={14} color={t.textSec} />
            </TouchableOpacity>
          </View>
          <View style={mc.body}>
            <Text style={[mc.label, { color: t.textMuted }]}>
              <Icon name="user" size={10} /> NOMBRE (OBLIGATORIO)
            </Text>
            <TextInput
              style={[mc.input, { backgroundColor: t.bgInput, borderColor: t.border, color: t.textPrim }]}
              value={nombre} onChangeText={setNombre} placeholder="Ej. Carlos Gutiérrez"
              placeholderTextColor={t.textMuted} autoFocus maxLength={80}
            />
            <Text style={[mc.label, { color: t.textMuted, marginTop: 20 }]}>
              <Icon name="whatsapp" size={10} /> WHATSAPP (OPCIONAL)
            </Text>
            <TextInput
              style={[mc.input, { backgroundColor: t.bgInput, borderColor: t.border, color: t.textPrim }]}
              value={telefono} onChangeText={(v) => setTelefono(v.replace(/\D/g, ''))} placeholder="Ej. 999999999"
              placeholderTextColor={t.textMuted} keyboardType="phone-pad" maxLength={9}
            />
            <TouchableOpacity style={[mc.btnConfirmar, { backgroundColor: color, marginTop: 28 }]} onPress={handleConfirmar}>
              <Text style={mc.btnConfirmarText}>IR AL MENÚ</Text>
              <Icon name="arrow-right" size={12} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Pantalla principal ───
export default function SalonScreen({ onSeleccionarMesa, onVolver }) {
  const t = useTema();
  const { estadoCaja, setEstadoCaja } = useAppStore();

  const [mesas, setMesas]                 = useState([]);
  const [sedes, setSedes]                 = useState([]);
  const [ordenesLlevar, setOrdenesLlevar] = useState([]);
  const [sedeId, setSedeId]               = useState('');
  const [vistaLocal, setVistaLocal]       = useState(null);
  const [modulos, setModulos]             = useState({ salon: true, delivery: true });
  const [cargando, setCargando]           = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const wsRef = useRef(null);

  const [rolUsuario, setRolUsuario]         = useState('Empleado');
  const [fondoCaja, setFondoCaja]           = useState('');
  const [abriendoCaja, setAbriendoCaja]     = useState(false);
  const [modoUnir, setModoUnir]             = useState(false);
  const [mesaPrincipal, setMesaPrincipal]   = useState(null);

  const [modalClienteVisible, setModalClienteVisible]         = useState(false);
  const [drawerVentaRapidaAbierto, setDrawerVentaRapidaAbierto] = useState(false);
  const [modalMovimientosAbierto, setModalMovimientosAbierto] = useState(false);
  const [modalCierreAbierto, setModalCierreAbierto]           = useState(false);
  const [ordenACobrar, setOrdenACobrar]                       = useState(null);

  const cajaAbierta  = estadoCaja === 'abierto' || estadoCaja?.estado === 'abierto';
  const esDueno      = ['dueño', 'admin', 'administrador'].includes(rolUsuario.toLowerCase());
  const puedeAbrirCaja = ['cajero', 'administrador', 'admin', 'dueño'].includes(rolUsuario.toLowerCase());

  // Animación del dot "En vivo"
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const cargar = useCallback(async () => {
    try {
      const negocioId = await EncryptedStorage.getItem('negocio_id');
      const savedSede = await EncryptedStorage.getItem('sede_id') || '';
      const savedRol  = await EncryptedStorage.getItem('usuario_rol') || 'Empleado';
      setSedeId(savedSede);
      setRolUsuario(savedRol);

      try {
        const resCaja = await getEstadoCaja({ sede_id: savedSede });
        if (resCaja.data?.estado === 'abierto') {
          setEstadoCaja('abierto');
          const sesionId = resCaja.data?.id || resCaja.data?.sesion_id;
          if (sesionId) await EncryptedStorage.setItem('sesion_caja_id', String(sesionId));
        }
      } catch {}

      const params = { negocio_id: negocioId, sede_id: savedSede };

      const [resMesas, resSedes, resOrdenes, resOrdenesActivas] = await Promise.all([
        getMesas(params),
        getSedes({ negocio_id: negocioId }),
        getOrdenesLlevar(params),
        getOrdenes({ negocio_id: negocioId, sede_id: savedSede, estado: 'preparando' }),
      ]);
      const mesasConEstado = resMesas.data.map(mesa => {
        const ordenActiva = resOrdenesActivas.data?.find(o => String(o.mesa) === String(mesa.id));
        return {
          ...mesa,
          estado:      ordenActiva ? 'ocupada' : 'libre',
          total_orden: ordenActiva ? parseFloat(ordenActiva.total || 0) : 0,
        };
      });

      setMesas(mesasConEstado);
      setSedes(resSedes.data);
      // 🛠️ 'delivery' (bot de WhatsApp) entra en el mismo balde que 'llevar' —
      // antes quedaba afuera de esta pestaña por completo.
      setOrdenesLlevar(
        (resOrdenes.data || []).filter(o =>
          (o.tipo === 'llevar' || o.tipo === 'delivery') &&
          o.estado !== 'completado' && o.estado !== 'cancelado'
        )
      );

      const { configuracionGlobal } = useAppStore.getState();
      const mods = configuracionGlobal?.modulos || {};
      setModulos({ salon: mods.salon !== false, delivery: mods.delivery !== false });
      setVistaLocal(mods.salon !== false ? 'salon' : 'llevar');

    } catch (e) {
      setVistaLocal('salon');
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, []);

  // WebSocket
  useEffect(() => {
    if (!sedeId) return;
    let ws = null;
    let unmounted = false;
    let retry = null;

    const conectar = async () => {
      if (unmounted) return;
      try {
        const res   = await api.get('/verificar-sesion/');
        const token = res.data.ws_token;
        // Token en header en vez de URL para no exponerlo en logs de servidor
        ws = new WebSocket(`wss://pos.leybrak.com/ws/salon/${sedeId}/`, null, {
          headers: { Authorization: `Bearer ${token}` },
        });
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'mesa_estado') {
              setMesas(prev => prev.map(m =>
                String(m.id) === String(data.mesa_id)
                  ? { ...m, estado: data.estado, total_orden: data.total ?? m.total_orden }
                  : m
              ));
            }
            if (data.type === 'orden_llevar') cargar();
          } catch {}
        };
        ws.onerror  = () => ws.close();
        ws.onclose  = () => { if (!unmounted) retry = setTimeout(conectar, 4000); };
      } catch {
        if (!unmounted) retry = setTimeout(conectar, 4000);
      }
    };

    conectar();
    return () => { unmounted = true; clearTimeout(retry); ws?.close(); };
  }, [sedeId]);

  useEffect(() => {
    const autoSede = async () => {
      if (sedes.length > 0 && !sedeId) {
        const primera = String(sedes[0].id);
        await EncryptedStorage.setItem('sede_id', primera);
        setSedeId(primera);
      }
    };
    autoSede();
  }, [sedes]);

  const handleAbrirCaja = async () => {
    const sedeIdActual = sedeId || await EncryptedStorage.getItem('sede_id');
    const empleadoId   = await EncryptedStorage.getItem('empleado_id');
    const negocioId    = await EncryptedStorage.getItem('negocio_id');

    if (!sedeIdActual) { Alert.alert('Error', 'No hay sede seleccionada.'); return; }
    if (!fondoCaja || isNaN(fondoCaja) || parseFloat(fondoCaja) < 0) {
      Alert.alert('Error', 'Ingresa un fondo de caja válido.'); return;
    }
    setAbriendoCaja(true);
    try {
      const res = await abrirCajaBD({
        sede_id:       sedeIdActual,
        empleado_id:   empleadoId,
        negocio_id:    negocioId,
        fondo_inicial: parseFloat(fondoCaja),
      });
      await EncryptedStorage.setItem('sesion_caja_id', String(res.data.id));
      setEstadoCaja('abierto');
      setFondoCaja('');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo abrir la caja.');
    } finally {
      setAbriendoCaja(false);
    }
  };

  const manejarClickMesa = async (mesa) => {
    if (modoUnir) {
      if (!mesaPrincipal) {
        setMesaPrincipal(mesa.id);
      } else if (mesa.id !== mesaPrincipal) {
        try {
          await actualizarMesa(mesa.id, { mesa_principal: mesaPrincipal });
          setModoUnir(false); setMesaPrincipal(null);
          cargar();
        } catch (e) { Alert.alert('Error', e?.response?.data?.error || 'No se pudo unir las mesas.'); }
      }
    } else {
      if (mesa.estado === 'libre' && wsRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'mesa_estado', mesa_id: mesa.id, estado: 'pidiendo' }));
      }
      onSeleccionarMesa(mesa.id);
    }
  };

  const handleCierreCajaSeguro = () => {
    const hayOcupadas = mesas.some(m => m.estado === 'ocupada' || m.orden_activa);
    const hayLlevar   = ordenesLlevar.some(o => o.estado_pago !== 'pagado');
    if (hayOcupadas || hayLlevar) {
      Alert.alert('Atención', 'Hay mesas ocupadas o pedidos pendientes.');
      return;
    }
    setModalCierreAbierto(true);
  };

  const handleCancelarOrdenLlevar = (id) => {
    Alert.alert('Cancelar pedido', '¿Estás seguro?', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: async () => {
        try {
          await actualizarOrden(id, { estado: 'cancelado', cancelado: true });
          cargar();
        } catch (e) { Alert.alert('Error', e?.response?.data?.error || 'No se pudo cancelar.'); }
      }},
    ]);
  };

  // 🛠️ Antes: onPress={() => {}} — el botón de check no hacía nada.
  const handleEntregarOrdenLlevar = async (id) => {
    try {
      await actualizarOrden(id, { estado: 'completado' });
      cargar();
    } catch (e) { Alert.alert('Error', e?.response?.data?.error || 'No se pudo marcar como entregado.'); }
  };

  // ── Cálculo de columnas ──
  const mesasFiltradas = mesas.filter(m => sedeId ? String(m.sede) === String(sedeId) : true);
  const maxColumna     = mesasFiltradas.length > 0 ? Math.max(...mesasFiltradas.map(m => m.posicion_x || 0)) + 1 : 2;
  const numColumnas    = Math.max(2, Math.min(3, maxColumna)); 
  const anchoCelda     = `${Math.floor(100 / numColumnas) - 3}%`;
  
  const sedeActualInfo = sedes?.find(s => String(s.id) === String(sedeId));

  if (vistaLocal === null || cargando) {
    return (
      <View style={[s.loader, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
        <View style={[s.loaderIconWrapper, { backgroundColor: `${t.color}15` }]}>
          <Icon name="cutlery" size={30} color={t.color} />
        </View>
        <ActivityIndicator size="large" color={t.color} style={{ marginTop: 20 }} />
        <Text style={[s.loaderText, { color: t.textMuted }]}>CONECTANDO SISTEMA...</Text>
      </View>
    );
  }

  if (!cajaAbierta) {
    return (
      <View style={[s.cajaContainer, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
        {esDueno && onVolver && (
          <TouchableOpacity style={[s.volverBtn, { borderColor: t.border, backgroundColor: t.bgCard }]} onPress={onVolver}>
            <Icon name="arrow-left" size={14} color={t.textSec} style={{ marginRight: 8 }} />
            <Text style={[s.volverBtnText, { color: t.textSec }]}>Volver al ERP</Text>
          </TouchableOpacity>
        )}
        <Icon name="lock" size={60} color={t.textMuted} style={{ marginBottom: 20 }} />
        <Text style={[s.cajaTitulo, { color: t.textPrim }]}>CAJA CERRADA</Text>
        <Text style={[s.cajaSub, { color: t.textSec }]}>
          {puedeAbrirCaja ? 'Ingresa el fondo inicial para abrir el turno.' : 'Esperando que un administrador abra la caja.'}
        </Text>
        {puedeAbrirCaja && (
          <View style={[s.cajaForm, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <TextInput
              style={[s.cajaInput, { backgroundColor: t.bgInput, color: t.textPrim, borderColor: t.border }]}
              value={fondoCaja} onChangeText={setFondoCaja} placeholder="S/. 0.00"
              placeholderTextColor={t.textMuted} keyboardType="numeric"
            />
            <TouchableOpacity style={[s.btnAbrirCaja, { backgroundColor: t.color }]} onPress={handleAbrirCaja} disabled={abriendoCaja}>
              <Text style={s.btnAbrirCajaText}>{abriendoCaja ? 'ABRIENDO...' : '💰 ABRIR CAJA'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      {/* Header Estilo Web / Mobile */}
      <View style={[s.header, { backgroundColor: t.bg, borderBottomColor: t.border, alignItems: 'center' }]}>
        
        {/* 1. Contenedor del Título (Con más espacio ahora) */}
        <View style={{ flex: 1, marginRight: 12, justifyContent: 'center' }}>
          <Text 
            style={[s.headerTitulo, { color: t.textPrim }]}
            numberOfLines={2} 
            ellipsizeMode="tail"
          >
            {vistaLocal === 'salon' ? 'SALÓN ' : 'PARA '}
            <Text style={{ color: t.color }}>
              {vistaLocal === 'salon' ? (sedeActualInfo?.nombre || 'PRINCIPAL') : 'LLEVAR'}
            </Text>
          </Text>
          <View style={s.envivoWrapper}>
            <Text style={s.envivoText}>EN VIVO</Text>
            <Animated.View style={[s.envivoDot, { opacity: pulseAnim }]} />
          </View>
        </View>

        {/* 2. Contenedor de Botones (Columna que agrupa las 2 filas) */}
        <View style={{ flexDirection: 'column', gap: 6 }}>
          
          {/* FILA 1: Config, Venta Rápida, Unir Mesas */}
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>
            {esDueno && onVolver && (
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' }]} onPress={onVolver}>
                <Icon name="cog" size={18} color="#3b82f6" />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: `${t.color}1A`, borderColor: `${t.color}4D` }]} onPress={() => setDrawerVentaRapidaAbierto(true)}>
              <Icon name="bolt" size={18} color={t.color} />
            </TouchableOpacity>
            
            {vistaLocal === 'salon' && (
              <TouchableOpacity 
                style={[s.actionBtn, { backgroundColor: t.bgCard, borderColor: t.border }, modoUnir && { backgroundColor: t.color, borderColor: t.color }]} 
                onPress={() => { setModoUnir(!modoUnir); setMesaPrincipal(null); }}
              >
                <Icon name="link" size={16} color={modoUnir ? '#fff' : t.textSec} />
              </TouchableOpacity>
            )}
          </View>

          {/* FILA 2: Cambiar Vista, Caja Chica, Cerrar Caja */}
          <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'flex-end' }}>
            <TouchableOpacity 
              style={[s.actionBtn, { backgroundColor: t.bgCard, borderColor: t.border }]} 
              onPress={() => setVistaLocal(vistaLocal === 'salon' ? 'llevar' : 'salon')}
            >
              <Icon name={vistaLocal === 'salon' ? 'shopping-bag' : 'table'} size={16} color={t.textSec} />
              {vistaLocal === 'salon' && ordenesLlevar.length > 0 && (
                <View style={[s.badgeNotif, { backgroundColor: t.color }]}>
                  <Text style={s.badgeNotifText}>{ordenesLlevar.length}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {['cajero', 'administrador', 'admin', 'dueño'].includes(rolUsuario.toLowerCase()) && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }]}
                onPress={() => setModalMovimientosAbierto(true)}
              >
                <Icon name="money" size={18} color="#10b981" />
              </TouchableOpacity>
            )}

            {['cajero', 'administrador', 'admin', 'dueño'].includes(rolUsuario.toLowerCase()) && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}
                onPress={handleCierreCajaSeguro}
              >
                <Icon name="lock" size={18} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} tintColor={t.color} />}
      >
        {vistaLocal === 'salon' && (
          <>
            {modoUnir && (
              <View style={[s.unirBanner, { backgroundColor: `${t.color}1A`, borderColor: `${t.color}4D` }]}>
                <Icon name="link" size={16} color={t.color} style={{ marginRight: 8 }} />
                <Text style={[s.unirBannerText, { color: t.color }]}>
                  {mesaPrincipal ? `Selecciona la mesa que se unirá a la ${mesaPrincipal}...` : 'Paso 1: Selecciona la Mesa Principal...'}
                </Text>
              </View>
            )}
            
            <View style={s.mesasGrid}>
              {mesasFiltradas
                .sort((a, b) => a.posicion_y !== b.posicion_y ? a.posicion_y - b.posicion_y : a.posicion_x - b.posicion_x)
                .map(mesa => (
                  <TarjetaMesa
                    key={mesa.id}
                    mesa={mesa}
                    t={t}
                    color={t.color}
                    ancho={anchoCelda}
                    onPress={manejarClickMesa}
                    seleccionada={mesaPrincipal === mesa.id}
                    modoUnir={modoUnir}
                  />
                ))}
            </View>
          </>
        )}

        {vistaLocal === 'llevar' && (
          <View style={{ maxWidth: 600, width: '100%', alignSelf: 'center' }}>
            <TouchableOpacity style={[s.btnNuevaOrden, { backgroundColor: t.color }]} onPress={() => setModalClienteVisible(true)} activeOpacity={0.8}>
              <Icon name="plus" size={14} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.btnNuevaOrdenText}>NUEVA ORDEN PARA LLEVAR</Text>
            </TouchableOpacity>

            {ordenesLlevar.length === 0 ? (
              <View style={[s.emptyState, { borderColor: t.border }]}>
                <Icon name="shopping-bag" size={40} color={t.textMuted} style={{ opacity: 0.5 }} />
                <Text style={[s.emptyTitulo, { color: t.textPrim }]}>SIN PEDIDOS ACTIVOS</Text>
                <Text style={[s.emptySub, { color: t.textMuted }]}>Las órdenes para llevar aparecerán aquí</Text>
              </View>
            ) : (
              ordenesLlevar.map(orden => {
                const esDelivery = orden.tipo === 'delivery';
                const estaPagado = orden.estado_pago === 'pagado';
                return (
                <View key={orden.id} style={[s.llevarCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                  <View style={s.llevarHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <View style={[s.badgeTipo, { backgroundColor: esDelivery ? 'rgba(59,130,246,0.1)' : `${t.color}15` }]}>
                          <Icon name={esDelivery ? 'motorcycle' : 'shopping-bag'} size={9} color={esDelivery ? '#3b82f6' : t.color} style={{ marginRight: 4 }} />
                          <Text style={[s.badgeTipoText, { color: esDelivery ? '#3b82f6' : t.color }]}>{esDelivery ? 'DELIVERY' : 'PARA LLEVAR'}</Text>
                        </View>
                      </View>
                      <Text style={[s.llevarNombre, { color: t.textPrim }]}>{orden.cliente_nombre || 'Cliente sin nombre'}</Text>
                      {orden.cliente_telefono && (
                        <Text style={[s.llevarTel, { color: t.textSec }]}><Icon name="whatsapp" /> {orden.cliente_telefono}</Text>
                      )}
                      {esDelivery && orden.direccion_entrega && (
                        <Text style={[s.llevarTel, { color: t.textMuted }]}><Icon name="map-marker" /> {orden.direccion_entrega}</Text>
                      )}
                    </View>
                    <Text style={[s.llevarTotal, { color: t.color }]}>S/ {parseFloat(orden.total || 0).toFixed(2)}</Text>
                  </View>

                  <View style={s.llevarActions}>
                    {!estaPagado ? (
                      <TouchableOpacity style={[s.btnCobrarLlevar, { backgroundColor: t.color }]} onPress={() => setOrdenACobrar(orden)}>
                        <Icon name="money" size={12} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={s.btnCobrarText}>COBRAR</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[s.btnCobrarLlevar, { backgroundColor: '#22c55e' }]} onPress={() => handleEntregarOrdenLlevar(orden.id)}>
                        <Icon name="check" size={12} color="#fff" style={{ marginRight: 6 }} />
                        <Text style={s.btnCobrarText}>ENTREGAR</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[s.btnActionIcon, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]} onPress={() => handleCancelarOrdenLlevar(orden.id)}>
                      <Icon name="trash" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      <ModalCliente visible={modalClienteVisible} t={t} color={t.color} onConfirmar={({ nombre, telefono }) => { setModalClienteVisible(false); onSeleccionarMesa({ id: 'llevar', cliente: nombre, telefono }); }} onCerrar={() => setModalClienteVisible(false)} />
      <ModalCierreCaja
        visible={modalCierreAbierto}
        onClose={() => setModalCierreAbierto(false)}
        onCierreExitoso={(resumen) => {
          setModalCierreAbierto(false);
          const dif = resumen?.diferencia || 0;
          const msg = dif === 0 ? '✅ ¡Cuadre perfecto!'
            : dif > 0 ? `⚠️ Sobrante de S/ ${dif.toFixed(2)}`
            : `🚨 Faltante de S/ ${Math.abs(dif).toFixed(2)}`;
          Alert.alert('Cierre completado', msg);
        }}
      />
      <ModalMovimientoCaja
        visible={modalMovimientosAbierto}
        onClose={() => setModalMovimientosAbierto(false)}
      />
      <ModalCobro
        visible={!!ordenACobrar}
        onClose={() => { setOrdenACobrar(null); cargar(); }}
        total={ordenACobrar ? parseFloat(ordenACobrar.total || 0) : 0}
        ordenId={ordenACobrar?.id}
        carrito={ordenACobrar?.detalles || []}
        onCobroExitoso={async ({ pagos, telefono }) => {
          try {
            const sesionCajaId = await EncryptedStorage.getItem('sesion_caja_id');
            const pagosManuales = pagos.filter(p => !p.yaConfirmado);
            await api.post(`/ordenes/${ordenACobrar.id}/cobrar_orden/`, {
              pagos: pagosManuales,
              telefono,
              sesion_caja_id: sesionCajaId,
            });
            return { ordenId: ordenACobrar.id };
          } catch (err) {
            Alert.alert('Error', err?.response?.data?.error || 'No se pudo procesar el pago.');
            throw err;
          }
        }}
      />
    </View>
  );
}

// ─── Estilos (Adaptados a Tailwind Web) ───
const mc = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modal:          { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 24, borderBottomWidth: 1 },
  titulo:         { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  sub:            { fontSize: 12, marginTop: 4 },
  closeBtn:       { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  body:           { padding: 24 },
  label:          { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  input:          { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, fontSize: 14, fontWeight: '700' },
  btnConfirmar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 18, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 4 } },
  btnConfirmarText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});

const s = StyleSheet.create({
  container:       { flex: 1 },
  loader:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderIconWrapper:{ width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  loaderText:      { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 16 },
  
  cajaContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  cajaTitulo:      { fontSize: 24, fontWeight: '900', marginBottom: 8, letterSpacing: -0.5 },
  cajaSub:         { fontSize: 14, textAlign: 'center', marginBottom: 30 },
  cajaForm:        { width: '100%', maxWidth: 350, padding: 30, borderRadius: 32, borderWidth: 1 },
  cajaInput:       { fontSize: 28, fontWeight: '900', textAlign: 'center', padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 16 },
  btnAbrirCaja:    { padding: 18, borderRadius: 16, alignItems: 'center' },
  btnAbrirCajaText:{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },

  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 20, borderBottomWidth: 1 },
  headerTitulo:    { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, textTransform: 'uppercase' },
  envivoWrapper:   { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  envivoText:      { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#737373', marginRight: 6 },
  envivoDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e', shadowColor: '#22c55e', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  
  headerActions:   { flexDirection: 'row', gap: 8 },
  actionBtn:       { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeNotif:      { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#161616' },
  badgeNotifText:  { color: '#fff', fontSize: 9, fontWeight: '900' },

  content:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  unirBanner:      { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  unirBannerText:  { fontSize: 12, fontWeight: '800' },

  mesasGrid:       { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  mesaCard:        { aspectRatio: 0.9, borderRadius: 24, borderWidth: 1.5, padding: 14, justifyContent: 'space-between' },
  mesaCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  mesaEstadoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  mesaEstadoText:  { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  mesaCardBody:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mesaNumero:      { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  mesaTotal:       { fontSize: 12, fontWeight: '900', textAlign: 'center' },

  btnNuevaOrden:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 18, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 4 } },
  btnNuevaOrdenText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  emptyState:      { padding: 40, alignItems: 'center', borderRadius: 32, borderWidth: 2, borderStyle: 'dashed' },
  emptyTitulo:     { fontSize: 16, fontWeight: '900', marginTop: 16, letterSpacing: 1 },
  emptySub:        { fontSize: 12, fontWeight: '700', marginTop: 4 },
  
  llevarCard:      { borderRadius: 24, borderWidth: 1, padding: 20, marginBottom: 12 },
  llevarHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  llevarNombre:    { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  llevarTel:       { fontSize: 12, fontWeight: '700', marginTop: 4 },
  badgeTipo:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeTipoText:   { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  llevarTotal:     { fontSize: 20, fontWeight: '900' },
  llevarActions:   { flexDirection: 'row', gap: 8 },
  btnCobrarLlevar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  btnCobrarText:   { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  btnActionIcon:   { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  
  volverBtn:       { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, marginBottom: 30 },
  volverBtnText:   { fontSize: 13, fontWeight: '800' },
});