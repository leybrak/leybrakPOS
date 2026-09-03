import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Switch,
  Platform, StatusBar, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import { 
  getProductos, getCategorias, parchearProducto,
  crearCategoria, parchearCategoria,
  crearProducto, actualizarProducto,
} from '../../../api/api';
import useAppStore from '../../../store/useAppStore';
import ModalCategorias from './ModalCategorias';
import ModalPlato      from './ModalPlato';
import ModalCombos from './ModalCombos';
// ─── Hook de tema ─────────────────────────────────────────────
const useTema = () => {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal.temaFondo !== 'light';
  const color  = configuracionGlobal.colorPrimario || '#3b82f6';
  return {
    isDark, color,
    bg:        isDark ? '#050505' : '#f0f0f0',
    bgCard:    isDark ? '#141414' : '#ffffff',
    bgCard2:   isDark ? '#1a1a1a' : '#f3f4f6',
    bgInput:   isDark ? '#0a0a0a' : '#f9fafb',
    border:    isDark ? '#222222' : '#e5e7eb',
    border2:   isDark ? '#333333' : '#d1d5db',
    textPrim:  isDark ? '#ffffff' : '#111111',
    textSec:   isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#4b5563' : '#9ca3af',
  };
};
// ─── Tarjeta de plato ─────────────────────────────────────────
function TarjetaPlato({ plato, categoria, t, esDueno, onToggle, onEditar }) {
  const esVariable  = parseFloat(plato.precio_base) <= 0;
  const necesitaVar = plato.requiere_seleccion || plato.tiene_variaciones;

  return (
    <TouchableOpacity
      style={[s.platoCard, { backgroundColor: t.bgCard, borderColor: t.border }]}
      onPress={() => esDueno && onEditar(plato)}
      activeOpacity={esDueno ? 0.7 : 1}
    >
      {/* Imagen */}
      <View style={[s.platoImg, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
        {plato.imagen
          ? <Image source={{ uri: plato.imagen }} style={s.platoImgReal} resizeMode="cover" />
          : <Text style={s.platoEmoji}>🍲</Text>
        }
      </View>

      {/* Info */}
      <View style={s.platoInfo}>
        <Text style={[s.platoCat, { color: t.textMuted }]} numberOfLines={1}>
          {categoria || 'Sin categoría'}
        </Text>
        <Text style={[s.platoNombre, { color: t.textPrim }]} numberOfLines={2}>
          {plato.nombre}
        </Text>

        {/* Precio */}
        {esVariable ? (
          <View style={[s.variableBadge, { backgroundColor: `${t.color}10`, borderColor: `${t.color}30` }]}>
            <Text style={[s.variableText, { color: t.color }]}>VARIABLE</Text>
          </View>
        ) : (
          <Text style={[s.platoPrecio, { color: t.textPrim }]}>
            <Text style={[s.platoPrecioS, { color: t.color }]}>S/ </Text>
            {parseFloat(plato.precio_base).toFixed(2)}
          </Text>
        )}
      </View>

      {/* Acciones */}
      <View style={s.platoAcciones}>
        {/* Toggle disponible */}
        <TouchableOpacity
          style={[
            s.toggleBtn,
            plato.disponible
              ? { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' }
              : { backgroundColor: t.bgCard2, borderColor: t.border2 }
          ]}
          onPress={() => onToggle(plato)}
          activeOpacity={0.8}
        >
          <View style={[
            s.toggleDot,
            { backgroundColor: plato.disponible ? '#10b981' : t.textMuted }
          ]} />
        </TouchableOpacity>

        {/* Botón variaciones / receta */}
        {esDueno && (
          <TouchableOpacity
            style={[s.accionBtn, necesitaVar
              ? { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)' }
              : { backgroundColor: t.bgCard2, borderColor: t.border2 }
            ]}
            onPress={() => Alert.alert('Próximamente', necesitaVar ? 'Variaciones' : 'Receta')}
            activeOpacity={0.8}
          >
            <Icon
              name={necesitaVar ? 'list' : 'book'}
              size={13}
              color={necesitaVar ? '#3b82f6' : t.textSec}
            />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────
export default function MenuScreen() {
  const t = useTema();

  const [productos, setProductos]     = useState([]);
  const [categorias, setCategorias]   = useState([]);
  const [catActiva, setCatActiva]     = useState('Todos');
  const [cargando, setCargando]       = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [rolUsuario, setRolUsuario]   = useState('');
  const [modalCombosVisible, setModalCombosVisible] = useState(false);
  const esDueno = ['dueño', 'admin', 'administrador'].includes(rolUsuario.toLowerCase());

  const cargar = useCallback(async () => {
    try {
      const negocioId = await EncryptedStorage.getItem('negocio_id');
      const rol       = await EncryptedStorage.getItem('usuario_rol') || '';
      setRolUsuario(rol);

      const params = { negocio_id: negocioId };
      const [resProd, resCat] = await Promise.all([
        getProductos(params),
        getCategorias(params),
      ]);
      setProductos(resProd.data);
      setCategorias(resCat.data);
    } catch (e) {
      console.error('Error cargando menú:', e);
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, []);

  const onRefresh = () => { setRefreshing(true); cargar(); };

  const handleToggle = async (plato) => {
    try {
      const nuevo = !plato.disponible;
      // Actualiza localmente primero (UX inmediata)
      setProductos(prev => prev.map(p =>
        p.id === plato.id ? { ...p, disponible: nuevo } : p
      ));
      await parchearProducto(plato.id, { disponible: nuevo });
    } catch (e) {
      // Revierte si falla
      setProductos(prev => prev.map(p =>
        p.id === plato.id ? { ...p, disponible: plato.disponible } : p
      ));
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo actualizar la disponibilidad.');
    }
  };

  // Filtrar — solo platos normales (sin combos)
  const platosNormales = productos.filter(p => !p.es_combo);
  const platosFiltrados = platosNormales.filter(p => {
    if (catActiva === 'Todos') return true;
    const cat = categorias.find(c => c.id === p.categoria);
    return (cat?.nombre || p.categoria) === catActiva;
  });

  const getNombreCat = (plato) => {
    return categorias.find(c => c.id === plato.categoria)?.nombre || 'Sin categoría';
  };
  const [modalCatVisible, setModalCatVisible]   = useState(false);
  const [modalPlatoVisible, setModalPlatoVisible] = useState(false);
  const [platoEditar, setPlatoEditar]           = useState(null);
  const handleCrearCategoria = async (nombre) => {
    const negocioId = await EncryptedStorage.getItem('negocio_id');
    await crearCategoria({ nombre, negocio: negocioId });
    await cargar();
  };

  const handleEliminarCategoria = async (id) => {
    await parchearCategoria(id, { activo: false });
    await cargar();
  };

  const handleGuardarPlato = async (form) => {
    const negocioId = await EncryptedStorage.getItem('negocio_id');
    const payload = {
      nombre:             form.nombre,
      precio_base:        form.precio_base || '0.00',
      categoria:          form.categoria_id || null,
      negocio:            negocioId,
      es_venta_rapida:    form.es_venta_rapida,
      requiere_seleccion: form.requiere_seleccion,
      tiene_variaciones:  form.tiene_variaciones,
      grupos_variacion:   form.grupos_variacion,
    };
    if (form.id) await actualizarProducto(form.id, payload);
    else await crearProducto(payload);
    await cargar();
  };
  if (cargando) {
    return (
      <View style={[s.loader, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
        <ActivityIndicator size="large" color={t.color} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.color} />}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <View style={[s.headerIcono, { backgroundColor: `${t.color}15` }]}>
            <Icon name="cutlery" size={26} color={t.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.titulo, { color: t.textPrim }]}>
              Ingeniería de <Text style={{ color: t.color }}>Menú</Text>
            </Text>
            <Text style={[s.subtitulo, { color: t.textSec }]}>
              {esDueno ? 'Gestiona tu catálogo y recetas.' : 'Gestión de disponibilidad.'}
            </Text>
          </View>
        </View>

        {/* Botones acción — solo dueño */}
        {esDueno && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.accionesScroll}>
            {[
              { label: 'Nuevo Plato', icono: 'plus',   primary: true,  onPress: () => { setPlatoEditar(null); setModalPlatoVisible(true); } },
              { label: 'Categorías',  icono: 'folder', primary: false, onPress: () => setModalCatVisible(true) },
              { label: 'Combos', icono: 'th-large', primary: false, onPress: () => setModalCombosVisible(true) },
            ].map(btn => (
              <TouchableOpacity
                key={btn.label}
                style={[
                  s.accionPill,
                  { borderColor: t.border2, backgroundColor: t.bgCard2 },
                  btn.primary && { backgroundColor: t.color, borderColor: t.color },
                ]}
                onPress={btn.onPress}
                activeOpacity={0.8}
              >
                <Icon name={btn.icono} size={12} color={btn.primary ? '#fff' : t.textSec} style={{ marginRight: 6 }} />
                <Text style={[s.accionPillText, { color: btn.primary ? '#fff' : t.textSec }]}>
                  {btn.label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Filtro categorías */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
          {['Todos', ...categorias.map(c => c.nombre)].map(nombre => (
            <TouchableOpacity
              key={nombre}
              style={[
                s.catPill,
                { backgroundColor: t.bgCard, borderColor: t.border },
                catActiva === nombre && { backgroundColor: t.color, borderColor: t.color },
              ]}
              onPress={() => setCatActiva(nombre)}
              activeOpacity={0.8}
            >
              <Text style={[s.catPillText, { color: catActiva === nombre ? '#fff' : t.textSec }]}>
                {nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Contador */}
        <Text style={[s.contador, { color: t.textMuted }]}>
          {platosFiltrados.length} plato{platosFiltrados.length !== 1 ? 's' : ''}
          {catActiva !== 'Todos' ? ` en ${catActiva}` : ' en total'}
        </Text>

        {/* Lista de platos */}
        {platosFiltrados.length === 0 ? (
          <View style={[s.emptyState, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Icon name="cutlery" size={40} color={t.textMuted} />
            <Text style={[s.emptyTitulo, { color: t.textPrim }]}>Sin platos</Text>
            <Text style={[s.emptyDesc, { color: t.textSec }]}>
              {catActiva !== 'Todos' ? `No hay platos en ${catActiva}.` : 'Aún no tienes platos en el menú.'}
            </Text>
          </View>
        ) : (
          platosFiltrados.map(plato => (
            <TarjetaPlato
              key={plato.id}
              plato={plato}
              categoria={getNombreCat(plato)}
              t={t}
              esDueno={esDueno}
              onToggle={handleToggle}
              onEditar={(p) => { setPlatoEditar(p); setModalPlatoVisible(true); }} 
            />
          ))
        )}

      </ScrollView>
      <ModalCategorias
        visible={modalCatVisible}
        categorias={categorias}
        t={t}
        onCrear={handleCrearCategoria}
        onEliminar={handleEliminarCategoria}
        onCerrar={() => setModalCatVisible(false)}
      />
      <ModalPlato
        visible={modalPlatoVisible}
        plato={platoEditar}
        categorias={categorias}
        t={t}
        onGuardar={handleGuardarPlato}
        onCerrar={() => { setModalPlatoVisible(false); setPlatoEditar(null); }}
      />
      <ModalCombos
        visible={modalCombosVisible}
        productos={productos}
        categorias={categorias}
        t={t}
        onCerrar={() => setModalCombosVisible(false)}
      />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container:      { flex: 1 },
  content:        { paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16, paddingBottom: 40 },
  loader:         { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerRow:      { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  headerIcono:    { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titulo:         { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitulo:      { fontSize: 12, marginTop: 2 },

  accionesScroll: { marginBottom: 16 },
  accionPill:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginRight: 8 },
  accionPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  catScroll:      { marginBottom: 12 },
  catPill:        { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  catPillText:    { fontSize: 13, fontWeight: '700' },

  contador:       { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' },

  emptyState:     { borderRadius: 24, padding: 40, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', gap: 8 },
  emptyTitulo:    { fontSize: 18, fontWeight: '900' },
  emptyDesc:      { fontSize: 13, textAlign: 'center' },

  // Tarjeta plato
  platoCard:      { flexDirection: 'row', borderRadius: 20, borderWidth: 1, marginBottom: 10, overflow: 'hidden', padding: 12, gap: 12, alignItems: 'center' },
  platoImg:       { width: 72, height: 72, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  platoImgReal:   { width: '100%', height: '100%' },
  platoEmoji:     { fontSize: 28 },
  platoInfo:      { flex: 1, gap: 4 },
  platoCat:       { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  platoNombre:    { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  platoPrecio:    { fontSize: 16, fontWeight: '900' },
  platoPrecioS:   { fontSize: 11, fontWeight: '700' },
  variableBadge:  { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  variableText:   { fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  platoAcciones:  { gap: 8, alignItems: 'center' },
  toggleBtn:      { width: 44, height: 26, borderRadius: 13, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, justifyContent: 'flex-end' },
  toggleDot:      { width: 18, height: 18, borderRadius: 9 },
  accionBtn:      { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});