import React, { useState, useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Modal, ScrollView, TextInput, Alert,
  Platform, StatusBar, Easing
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import { BlurView } from '@react-native-community/blur';

import DashboardScreen     from '../screens/ERP/DashboardScreen';
import ConfiguracionScreen from '../screens/ERP/ConfiguracionScreen';
import PersonalScreen      from '../screens/ERP/PersonalScreen';
import MenuScreen          from '../screens/ERP/Menu/MenuScreen';
import InventarioScreen    from '../screens/ERP/InventarioScreen';
import SedesScreen         from '../screens/ERP/SedesScreen';
import ClientesScreen      from '../screens/ERP/ClientesScreen';
import FacturacionScreen   from '../screens/ERP/FacturacionScreen';
import SalonScreen         from '../screens/POS/SalonScreen';
import useAppStore         from '../store/useAppStore';
import PosScreen           from '../screens/POS/PosScreen';
import { setLogoutCallback, crearTicket } from '../api/api';
const { width } = Dimensions.get('window');

const COLOR_DEFAULT = '#3b82f6';
const SAFE_BOTTOM   = Platform.OS === 'ios' ? 34 : 24;
const SAFE_TOP      = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10;

// ─── Placeholder (features que hoy solo viven en la web) ───────
const PlaceholderScreen = ({ titulo, icono }) => (
  <View style={{ flex: 1, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 64, height: 64, backgroundColor: '#121212', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#1e1e1e' }}>
      <Icon name={icono} size={28} color="#333" />
    </View>
    <Text style={{ color: '#6b7280', fontSize: 14, fontWeight: '800', letterSpacing: 2 }}>
      {titulo.toUpperCase()}
    </Text>
    <View style={{ marginTop: 12, backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
      <Text style={{ color: COLOR_DEFAULT, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>SOLO DISPONIBLE EN LA WEB</Text>
    </View>
  </View>
);

// ─── Metadata de cada pantalla (id -> ícono FontAwesome + título de arriba) ───
const SCREENS_META = {
  dashboard:     { icono: 'th-large',    nombre: 'Panel de Control' },
  menu:          { icono: 'cutlery',     nombre: 'Carta y Precios' },
  inventario:    { icono: 'cube',        nombre: 'Inventario y Recetas' },
  sedes:         { icono: 'map-marker',  nombre: 'Sedes y Mapa' },
  personal:      { icono: 'users',       nombre: 'Personal y Accesos' },
  configuracion: { icono: 'cog',         nombre: 'Mi Negocio y Plan' },
  crm:           { icono: 'heart',       nombre: 'Fidelización (CRM)' },
  bot_wsp:       { icono: 'whatsapp',    nombre: 'Bot WhatsApp' },
  carta_qr:      { icono: 'qrcode',      nombre: 'Carta QR Virtual' },
  facturacion:   { icono: 'file-text',   nombre: 'Facturación SUNAT' },
};

// ─── Mismos 5 grupos, mismos ítems y mismas reglas de "quién ve qué"
// que el sidebar de la web (pos-frontend/src/features/ERP/Erp_Sidebar.jsx).
// Cambiá esto ahí primero si el sidebar de la web cambia.
function construirGruposMenu(modulos, esDueño) {
  return [
    {
      titulo: 'MONITOREO',
      items: [
        { id: 'dashboard', show: true },
      ],
    },
    {
      titulo: 'CATÁLOGO Y LOGÍSTICA',
      items: [
        { id: 'menu', show: true },
        { id: 'inventario', show: modulos.inventario },
      ],
    },
    {
      titulo: 'ADMINISTRACIÓN',
      items: [
        { id: 'sedes', show: esDueño },
        { id: 'personal', show: esDueño },
        { id: 'configuracion', show: esDueño },
      ],
    },
    {
      titulo: 'ECOSISTEMA DIGITAL',
      items: [
        { id: 'crm', show: modulos.clientes },
        { id: 'bot_wsp', show: modulos.botWsp },
        { id: 'carta_qr', show: modulos.cartaQr },
      ],
    },
    {
      titulo: 'CONTABILIDAD',
      items: [
        { id: 'facturacion', show: modulos.facturacion },
      ],
    },
  ];
}

// ─── Modal "Reportar un problema" (igual a Erp_Sidebar.jsx en la web) ───
function ModalReportarProblema({ visible, onClose }) {
  const [asunto, setAsunto]   = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const cerrar = () => { onClose(); setTimeout(() => { setAsunto(''); setMensaje(''); setEnviado(false); }, 200); };

  const enviar = async () => {
    if (!asunto.trim() || !mensaje.trim()) return;
    setEnviando(true);
    try {
      await crearTicket({ asunto, mensaje });
      setEnviado(true);
    } catch {
      Alert.alert('Error', 'No se pudo enviar el reporte. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={cerrar}>
      <View style={rp.overlay}>
        <View style={rp.card}>
          {enviado ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <Icon name="check-circle" size={40} color="#10b981" />
              <Text style={rp.tituloExito}>¡Reporte enviado!</Text>
              <Text style={rp.subExito}>Lo vamos a revisar pronto.</Text>
              <TouchableOpacity style={rp.btnCerrar} onPress={cerrar}>
                <Text style={rp.btnCerrarText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={rp.titulo}>Reportar un problema</Text>
              <TextInput
                style={rp.input}
                placeholder="¿Qué problema tuviste?"
                placeholderTextColor="#525252"
                value={asunto}
                onChangeText={setAsunto}
              />
              <TextInput
                style={[rp.input, rp.textarea]}
                placeholder="Cuéntanos con detalle qué pasó…"
                placeholderTextColor="#525252"
                value={mensaje}
                onChangeText={setMensaje}
                multiline
                numberOfLines={4}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={rp.btnCancelar} onPress={cerrar}>
                  <Text style={rp.btnCancelarText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rp.btnEnviar, (!asunto.trim() || !mensaje.trim() || enviando) && { opacity: 0.4 }]}
                  onPress={enviar}
                  disabled={enviando || !asunto.trim() || !mensaje.trim()}
                >
                  <Text style={rp.btnEnviarText}>{enviando ? 'Enviando…' : 'Enviar'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Drawer (sidebar completo, igual a la web) ─────────────────
function Drawer({ visible, vistaActiva, color, gruposMenu, onNavegar, onIrAlPos, onReportar, onLogout, onClose }) {
  const [render, setRender] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const [gruposExpandidos, setGruposExpandidos] = useState({});

  useEffect(() => {
    if (visible) {
      setRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0,      duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1,      duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -width, duration: 250, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0,      duration: 250, useNativeDriver: true }),
      ]).start(() => setRender(false));
    }
  }, [visible]);

  if (!render && !visible) return null;

  const toggleGrupo = (titulo) => setGruposExpandidos(prev => ({ ...prev, [titulo]: prev[titulo] === false ? true : false }));

  return (
    <Modal transparent visible onRequestClose={onClose} animationType="none">
      <View style={d.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <BlurView
            style={StyleSheet.absoluteFill}
            blurType="dark"
            blurAmount={10}
            reducedTransparencyFallbackColor="rgba(0,0,0,0.85)"
          />
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[d.drawer, { transform: [{ translateX: slideAnim }] }]}>
          <View style={d.drawerHeader}>
            <View>
              <Text style={d.drawerBrand}>LEYBRAK<Text style={{ color }}>POS</Text></Text>
              <Text style={d.drawerSub}>SAAS PLATFORM</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={d.closeBtn} activeOpacity={0.7}>
              <Icon name="times" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {gruposMenu.map(grupo => {
              const itemsVisibles = grupo.items.filter(i => i.show);
              if (itemsVisibles.length === 0) return null;
              const expandido = gruposExpandidos[grupo.titulo] !== false;

              return (
                <View key={grupo.titulo} style={d.grupo}>
                  <TouchableOpacity style={d.grupoHeader} onPress={() => toggleGrupo(grupo.titulo)} activeOpacity={0.7}>
                    <Text style={d.grupoTitulo}>{grupo.titulo}</Text>
                    <Icon name={expandido ? 'chevron-up' : 'chevron-down'} size={9} color="#4b5563" />
                  </TouchableOpacity>

                  {expandido && itemsVisibles.map(item => {
                    const sc     = SCREENS_META[item.id];
                    const activo = vistaActiva === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[d.drawerItem, activo && d.drawerItemActivo]}
                        onPress={() => { onNavegar(item.id); onClose(); }}
                        activeOpacity={0.7}
                      >
                        <View style={[d.drawerItemIcono, activo && { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
                          <Icon name={sc.icono} size={14} color={activo ? color : '#6b7280'} />
                        </View>
                        <Text style={[d.drawerItemNombre, activo && { color: '#fff', fontWeight: '700' }]}>
                          {sc.nombre}
                        </Text>
                        {activo && <View style={[d.drawerItemBarra, { backgroundColor: color }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <View style={d.drawerFooter}>
            <TouchableOpacity
              style={[d.posBtn, { backgroundColor: color }]}
              onPress={() => { onIrAlPos(); onClose(); }}
              activeOpacity={0.8}
            >
              <Icon name="desktop" size={16} color="#fff" style={{ marginRight: 10 }} />
              <Text style={d.posBtnText}>Terminal POS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={d.reportarBtn} onPress={() => { onClose(); setTimeout(onReportar, 300); }} activeOpacity={0.8}>
              <Icon name="life-ring" size={15} color="#6b7280" style={{ marginRight: 10 }} />
              <Text style={d.reportarBtnText}>Reportar un problema</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={d.logoutBtn}
              onPress={() => { onClose(); setTimeout(() => onLogout(), 300); }}
              activeOpacity={0.8}
            >
              <Icon name="sign-out" size={16} color="#ef4444" style={{ marginRight: 10 }} />
              <Text style={d.logoutBtnText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Layout ERP ───────────────────────────────────────────────
function ERPLayout({ onIrAlPos, onLogout }) {
  const [vistaActiva, setVistaActiva]   = useState('dashboard');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [reportarVisible, setReportarVisible] = useState(false);
  const [esDueño, setEsDueño] = useState(false);

  const { configuracionGlobal } = useAppStore();
  const color   = configuracionGlobal.colorPrimario || COLOR_DEFAULT;
  const isDark  = configuracionGlobal.temaFondo !== 'light';
  const modulos = configuracionGlobal.modulos || {};
  const bgColor = isDark ? '#050505' : '#f0f0f0';

  useEffect(() => {
    (async () => {
      const rol = (await EncryptedStorage.getItem('usuario_rol')) || 'Empleado';
      setEsDueño(['dueño', 'admin', 'administrador'].includes(rol.trim().toLowerCase()));
    })();
  }, []);

  const gruposMenu = construirGruposMenu(modulos, esDueño);
  const idsVisibles = gruposMenu.flatMap(g => g.items.filter(i => i.show).map(i => i.id));

  // Si el módulo/rol que habilitaba la pantalla activa se apaga, volvemos al inicio.
  useEffect(() => {
    if (!idsVisibles.includes(vistaActiva)) setVistaActiva('dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulos, esDueño]);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bgColor} />

      {/* Barra superior — reemplaza a la tab bar: acá vive el único acceso
          de navegación, igual que el sidebar persistente de la web. */}
      <View style={[th.header, { backgroundColor: isDark ? '#0a0a0a' : '#fff', borderBottomColor: isDark ? '#1a1a1a' : '#e5e7eb' }]}>
        <TouchableOpacity style={th.menuBtn} onPress={() => setDrawerVisible(true)} activeOpacity={0.7}>
          <Icon name="bars" size={18} color={isDark ? '#fff' : '#111'} />
        </TouchableOpacity>
        <Text style={[th.titulo, { color: isDark ? '#fff' : '#111' }]}>{SCREENS_META[vistaActiva]?.nombre}</Text>
        <TouchableOpacity style={th.posBtn} onPress={onIrAlPos} activeOpacity={0.8}>
          <Icon name="desktop" size={16} color={color} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {vistaActiva === 'dashboard'     && <DashboardScreen />}
        {vistaActiva === 'configuracion' && <ConfiguracionScreen />}
        {vistaActiva === 'menu'          && <MenuScreen />}
        {vistaActiva === 'personal'      && <PersonalScreen />}
        {vistaActiva === 'inventario'    && <InventarioScreen />}
        {vistaActiva === 'sedes'         && <SedesScreen />}
        {vistaActiva === 'crm'           && <ClientesScreen />}
        {vistaActiva === 'facturacion'   && <FacturacionScreen />}
        {vistaActiva === 'bot_wsp'       && <PlaceholderScreen titulo="Bot WhatsApp" icono="whatsapp" />}
        {vistaActiva === 'carta_qr'      && <PlaceholderScreen titulo="Carta QR Virtual" icono="qrcode" />}
      </View>

      <Drawer
        visible={drawerVisible}
        vistaActiva={vistaActiva}
        color={color}
        gruposMenu={gruposMenu}
        onNavegar={setVistaActiva}
        onIrAlPos={onIrAlPos}
        onReportar={() => setReportarVisible(true)}
        onLogout={onLogout}
        onClose={() => setDrawerVisible(false)}
      />
      <ModalReportarProblema visible={reportarVisible} onClose={() => setReportarVisible(false)} />
    </View>
  );
}

// ─── POS Layout ───────────────────────────────────────────────
function POSLayout({ onVolver }) {
  const [mesaActiva, setMesaActiva] = useState(null);

  // Sin mesa seleccionada → mapa de mesas
  if (!mesaActiva) {
    return (
      <View style={{ flex: 1 }}>
        {/* Botón volver al ERP */}
        <SalonScreen
          onSeleccionarMesa={(mesa) => setMesaActiva(mesa)}
          onVolver={onVolver}
        />
      </View>
    );
  }

  // Mesa seleccionada → PosScreen real
  return (
    <PosScreen
      key={typeof mesaActiva === 'object' ? mesaActiva.id : mesaActiva}
      mesaId={mesaActiva}
      onVolver={() => setMesaActiva(null)}
    />
  );
}

// ─── Stack ────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();

export default function AppNavigator({ sesion, onLogout }) {
  const [enPos, setEnPos] = useState(false);

  useEffect(() => {
    setLogoutCallback(onLogout);
    return () => setLogoutCallback(null);
  }, [onLogout]);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">
          {() => enPos
            ? <POSLayout onVolver={() => setEnPos(false)} />
            : <ERPLayout onIrAlPos={() => setEnPos(true)} onLogout={onLogout} />
          }
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Estilos de la barra superior ───────────────────────────────
const th = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10,
    paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1,
  },
  menuBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titulo:   { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, flex: 1, textAlign: 'center' },
  posBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});

// ─── Estilos Drawer ───────────────────────────────────────────
const d = StyleSheet.create({
  overlay:   { flex: 1, flexDirection: 'row' },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: width * 0.8, maxWidth: 320,
    backgroundColor: '#0a0a0a',
    borderRightWidth: 1, borderRightColor: '#1a1a1a',
    shadowColor: '#000', shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 15, elevation: 20,
  },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: SAFE_TOP, paddingBottom: 24,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  drawerBrand:      { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  drawerSub:        { fontSize: 9, color: '#6b7280', fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, backgroundColor: '#121212',
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#222',
  },
  grupo:            { paddingHorizontal: 12, paddingTop: 12 },
  grupoHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 10 },
  grupoTitulo:      { fontSize: 10, fontWeight: '800', color: '#4b5563', letterSpacing: 1.5 },
  drawerItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4, position: 'relative', overflow: 'hidden' },
  drawerItemActivo: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#1e1e1e' },
  drawerItemIcono: {
    width: 32, height: 32, backgroundColor: '#161616',
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    marginRight: 14, borderWidth: 1, borderColor: '#222',
  },
  drawerItemNombre: { flex: 1, fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  drawerItemBarra:  { position: 'absolute', right: 0, top: 8, bottom: 8, width: 3, borderRadius: 4 },
  drawerFooter: {
    padding: 20, paddingBottom: SAFE_BOTTOM + 20,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    backgroundColor: '#0a0a0a', gap: 10,
  },
  posBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16 },
  posBtnText:       { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  reportarBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: 'transparent',
  },
  reportarBtnText:  { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  logoutBtnText:    { color: '#ef4444', fontSize: 14, fontWeight: '700' },
});

// ─── Estilos "Reportar un problema" ─────────────────────────────
const rp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card:    { width: '100%', maxWidth: 400, backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 20, padding: 24 },
  titulo:  { color: '#fff', fontWeight: '900', fontSize: 15, marginBottom: 16 },
  input: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 13, marginBottom: 12,
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  btnCancelar:     { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' },
  btnCancelarText: { color: '#9ca3af', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  btnEnviar:       { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#ff5a1f', alignItems: 'center' },
  btnEnviarText:   { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  tituloExito: { color: '#fff', fontWeight: '900', fontSize: 15, marginTop: 12 },
  subExito:    { color: '#737373', fontSize: 12, marginTop: 4 },
  btnCerrar:   { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: '#ff5a1f' },
  btnCerrarText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
});
