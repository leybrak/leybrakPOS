import React, { useState, useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Modal, ScrollView,
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
import { setLogoutCallback } from '../api/api';
const { width } = Dimensions.get('window');

const COLOR_DEFAULT = '#3b82f6';
const SAFE_BOTTOM   = Platform.OS === 'ios' ? 34 : 24;
const SAFE_TOP      = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10;

// ─── Placeholder ──────────────────────────────────────────────
const PlaceholderScreen = ({ titulo, icono }) => (
  <View style={{ flex: 1, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 64, height: 64, backgroundColor: '#121212', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#1e1e1e' }}>
      <Icon name={icono} size={28} color="#333" />
    </View>
    <Text style={{ color: '#6b7280', fontSize: 14, fontWeight: '800', letterSpacing: 2 }}>
      {titulo.toUpperCase()}
    </Text>
    <View style={{ marginTop: 12, backgroundColor: 'rgba(59,130,246,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
      <Text style={{ color: COLOR_DEFAULT, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>EN CONSTRUCCIÓN</Text>
    </View>
  </View>
);

const SCREENS_META = {
  dashboard:    { icono: 'bar-chart',  nombre: 'Inicio'     },
  menu:         { icono: 'cutlery',    nombre: 'Menú'       },
  personal:     { icono: 'users',      nombre: 'Personal'   },
  inventario:   { icono: 'cube',       nombre: 'Inventario' },
  sedes:        { icono: 'map-marker', nombre: 'Sedes'      },
  configuracion:{ icono: 'cog',        nombre: 'Ajustes'    },
  crm:          { icono: 'heart',      nombre: 'Clientes'   },
  facturacion:  { icono: 'file-text',  nombre: 'Facturación'},
};

const TAB_ITEMS = ['dashboard', 'menu', 'personal'];

const ALL_DRAWER_ITEMS = [
  { id: 'inventario',    grupo: 'CATÁLOGO', moduloKey: 'inventario' },
  { id: 'sedes',         grupo: 'ADMIN',     moduloKey: null         },
  { id: 'configuracion', grupo: 'ADMIN',     moduloKey: null         },
  { id: 'crm',           grupo: 'DIGITAL',   moduloKey: 'clientes'   },
  { id: 'facturacion',   grupo: 'DIGITAL',   moduloKey: 'facturacion'},
];

// ─── Drawer ───────────────────────────────────────────────────
function Drawer({ visible, vistaActiva, color, drawerItems, onNavegar, onIrAlPos, onLogout, onClose }) {
  const [render, setRender] = useState(false);
  const slideAnim = useRef(new Animated.Value(width)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRender(true);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0,     duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 1,     duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: width, duration: 250, easing: Easing.in(Easing.cubic),  useNativeDriver: true }),
        Animated.timing(fadeAnim,  { toValue: 0,     duration: 250, useNativeDriver: true }),
      ]).start(() => setRender(false));
    }
  }, [visible]);

  if (!render && !visible) return null;

  const grupos = [...new Set(drawerItems.map(i => i.grupo))];

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
              <Text style={d.drawerSub}>SISTEMA DE GESTIÓN</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={d.closeBtn} activeOpacity={0.7}>
              <Icon name="times" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {grupos.map(grupo => (
              <View key={grupo} style={d.grupo}>
                <Text style={d.grupoTitulo}>{grupo}</Text>
                {drawerItems.filter(i => i.grupo === grupo).map(item => {
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
                      <Icon name="chevron-right" size={10} color={activo ? color : '#333'} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
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
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [drawerVisible, setDrawerVisible] = useState(false);

  const { configuracionGlobal } = useAppStore();
  const color   = configuracionGlobal.colorPrimario || COLOR_DEFAULT;
  const isDark  = configuracionGlobal.temaFondo !== 'light';
  const modulos = configuracionGlobal.modulos || {};
  const bgColor = isDark ? '#050505' : '#f0f0f0';

  const drawerItemsFiltrados = ALL_DRAWER_ITEMS.filter(item => {
    if (item.moduloKey === null) return true;
    return modulos[item.moduloKey] === true;
  });

  useEffect(() => {
    const itemActivo = ALL_DRAWER_ITEMS.find(i => i.id === vistaActiva);
    if (itemActivo && itemActivo.moduloKey && !modulos[itemActivo.moduloKey]) {
      setVistaActiva('dashboard');
    }
  }, [modulos]);

  const estaEnDrawer = !TAB_ITEMS.includes(vistaActiva);

  return (
    <View style={{ flex: 1, backgroundColor: bgColor }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={bgColor} />

      <View style={{ flex: 1 }}>
        {vistaActiva === 'dashboard'     && <DashboardScreen />}
        {vistaActiva === 'configuracion' && <ConfiguracionScreen />}
        {vistaActiva === 'menu'          && <MenuScreen />}
        {vistaActiva === 'personal'      && <PersonalScreen />}
        {vistaActiva === 'inventario'    && <InventarioScreen />}
        {vistaActiva === 'sedes'         && <SedesScreen />}
        {vistaActiva === 'crm'           && <ClientesScreen />}
        {vistaActiva === 'facturacion'   && <FacturacionScreen />}
      </View>

      {/* Tab Bar */}
      <View style={tb.tabBarWrapper}>
        <View style={tb.tabBar}>

          {TAB_ITEMS.slice(0, 2).map(id => {
            const sc     = SCREENS_META[id];
            const activo = vistaActiva === id;
            return (
              <TouchableOpacity key={id} style={tb.tabItem} onPress={() => setVistaActiva(id)} activeOpacity={0.7}>
                <Icon name={sc.icono} size={20} color={activo ? color : '#4b5563'} />
                <Text style={[tb.tabLabel, activo && { color }]}>{sc.nombre}</Text>
              </TouchableOpacity>
            );
          })}

          {/* FAB POS */}
          <View style={tb.fabContainer}>
            <TouchableOpacity
              style={[tb.fabButton, { backgroundColor: color, shadowColor: color }]}
              onPress={onIrAlPos}
              activeOpacity={0.8}
            >
              <Icon name="desktop" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={[tb.tabLabel, { color, marginTop: 6 }]}>POS</Text>
          </View>

          {/* Personal */}
          <TouchableOpacity style={tb.tabItem} onPress={() => setVistaActiva(TAB_ITEMS[2])} activeOpacity={0.7}>
            <Icon name={SCREENS_META[TAB_ITEMS[2]].icono} size={20} color={vistaActiva === TAB_ITEMS[2] ? color : '#4b5563'} />
            <Text style={[tb.tabLabel, vistaActiva === TAB_ITEMS[2] && { color }]}>{SCREENS_META[TAB_ITEMS[2]].nombre}</Text>
          </TouchableOpacity>

          {/* Más */}
          <TouchableOpacity style={tb.tabItem} onPress={() => setDrawerVisible(true)} activeOpacity={0.7}>
            <Icon name="bars" size={20} color={estaEnDrawer ? color : '#4b5563'} />
            <Text style={[tb.tabLabel, estaEnDrawer && { color }]}>Más</Text>
          </TouchableOpacity>

        </View>
      </View>

      <Drawer
        visible={drawerVisible}
        vistaActiva={vistaActiva}
        color={color}
        drawerItems={drawerItemsFiltrados}
        onNavegar={setVistaActiva}
        onIrAlPos={onIrAlPos}
        onLogout={onLogout}
        onClose={() => setDrawerVisible(false)}
      />
    </View>
  );
}

// ─── POS Layout ───────────────────────────────────────────────
function POSLayout({ onVolver }) {
  const [mesaActiva, setMesaActiva] = useState(null);

  const { configuracionGlobal } = useAppStore();
  const color = configuracionGlobal.colorPrimario || COLOR_DEFAULT;

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

// ─── Estilos Tab Bar ──────────────────────────────────────────
const tb = StyleSheet.create({
  tabBarWrapper: {
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingBottom: SAFE_BOTTOM,
  },
  tabBar: {
    flexDirection: 'row',
    height: 72,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4b5563',
    marginTop: 6,
    letterSpacing: 0.5,
  },
  fabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -32,
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#0a0a0a',
  },
});

// ─── Estilos Drawer ───────────────────────────────────────────
const d = StyleSheet.create({
  overlay:   { flex: 1, flexDirection: 'row' },
  drawer: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: width * 0.75, maxWidth: 320,
    backgroundColor: '#0a0a0a',
    borderLeftWidth: 1, borderLeftColor: '#1a1a1a',
    shadowColor: '#000', shadowOffset: { width: -5, height: 0 },
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
  grupo:            { paddingHorizontal: 16, paddingTop: 24 },
  grupoTitulo:      { fontSize: 10, fontWeight: '800', color: '#4b5563', letterSpacing: 2, marginBottom: 12, paddingLeft: 4 },
  drawerItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, marginBottom: 4 },
  drawerItemActivo: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#1e1e1e' },
  drawerItemIcono: {
    width: 32, height: 32, backgroundColor: '#161616',
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    marginRight: 14, borderWidth: 1, borderColor: '#222',
  },
  drawerItemNombre: { flex: 1, fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  drawerFooter: {
    padding: 20, paddingBottom: SAFE_BOTTOM + 20,
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    backgroundColor: '#0a0a0a', gap: 12,
  },
  posBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16 },
  posBtnText:       { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.05)', borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  logoutBtnText:    { color: '#ef4444', fontSize: 14, fontWeight: '700' },
});