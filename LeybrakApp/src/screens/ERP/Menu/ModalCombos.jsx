import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Image,
  Platform, StatusBar, KeyboardAvoidingView, RefreshControl
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import api from '../../../api/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';

// ─── Helper precio ────────────────────────────────────────────
const getPrecio = (producto) => {
  if (producto.requiere_seleccion) {
    const precios = producto.grupos_variacion
      ?.flatMap(g => g.opciones?.map(o => parseFloat(o.precio_adicional)) ?? []) ?? [];
    if (!precios.length) return 'S/ 0.00';
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    return min === max ? `S/ ${min.toFixed(2)}` : `S/ ${min.toFixed(2)}–${max.toFixed(2)}`;
  }
  return `S/ ${parseFloat(producto.precio_base || 0).toFixed(2)}`;
};

// ─── Modal selección de opción ────────────────────────────────
function ModalOpcion({ producto, t, onConfirmar, onCerrar }) {
  const [seleccionadas, setSeleccionadas] = useState({});

  const toggle = (grupoId, opcionId, multiple) => {
    setSeleccionadas(prev => {
      if (multiple) {
        const actual = prev[grupoId] ?? [];
        return {
          ...prev,
          [grupoId]: actual.includes(opcionId) 
            ? actual.filter(id => id !== opcionId) 
            : [...actual, opcionId]
        };
      }
      return { ...prev, [grupoId]: opcionId };
    });
  };

  const puedeConfirmar = useMemo(() => {
    return (producto.grupos_variacion || []).every(g => {
      if (!g.obligatorio) return true;
      const sel = seleccionadas[g.id];
      return sel && (Array.isArray(sel) ? sel.length > 0 : true);
    });
  }, [seleccionadas, producto.grupos_variacion]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={mo.overlay}>
        <View style={[mo.modal, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={[mo.header, { borderBottomColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[mo.sub, { color: t.textMuted }]}>ELIGE PRESENTACIÓN</Text>
              <Text style={[mo.titulo, { color: t.textPrim }]} numberOfLines={2}>
                {producto.nombre}
              </Text>
            </View>
            <TouchableOpacity onPress={onCerrar} style={{ padding: 4 }}>
              <Icon name="times" size={20} color={t.textSec} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {(producto.grupos_variacion || []).map(grupo => (
              <View key={grupo.id}>
                <View style={mo.grupoHeader}>
                  <Text style={[mo.grupoTitulo, { color: t.textSec }]}>
                    {grupo.nombre.toUpperCase()}
                  </Text>
                  {grupo.obligatorio && (
                    <View style={mo.requeridoBadge}>
                      <Text style={mo.requeridoText}>REQUERIDO</Text>
                    </View>
                  )}
                </View>
                <View style={mo.opcionesGrid}>
                  {(grupo.opciones || []).map(opcion => {
                    const sel = seleccionadas[grupo.id];
                    const activo = Array.isArray(sel) ? sel.includes(opcion.id) : sel === opcion.id;
                    return (
                      <TouchableOpacity
                        key={opcion.id}
                        style={[
                          mo.opcionBtn, 
                          { borderColor: t.border2, backgroundColor: t.bgCard2 },
                          activo && { borderColor: t.color, backgroundColor: `${t.color}15` }
                        ]}
                        onPress={() => toggle(grupo.id, opcion.id, grupo.seleccion_multiple)}
                        activeOpacity={0.8}
                      >
                        <Text style={[mo.opcionNombre, { color: activo ? t.color : t.textPrim }]}>
                          {opcion.nombre}
                        </Text>
                        {parseFloat(opcion.precio_adicional) > 0 && (
                          <Text style={[mo.opcionPrecio, { color: t.textMuted }]}>
                            +S/ {parseFloat(opcion.precio_adicional).toFixed(2)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={[mo.footer, { borderTopColor: t.border }]}>
            <TouchableOpacity
              style={[mo.btnConfirmar, { backgroundColor: t.color }, !puedeConfirmar && { opacity: 0.4 }]}
              onPress={() => {
                const opcionId = Object.values(seleccionadas).find(v => !Array.isArray(v));
                onConfirmar({ opcion_seleccionada_id: opcionId ?? null });
              }}
              disabled={!puedeConfirmar}
              activeOpacity={0.8}
            >
              <Text style={mo.btnConfirmarText}>AÑADIR AL COMBO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const mo = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  modal:          { borderRadius: 24, borderWidth: 1, maxHeight: '85%' },
  header:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, gap: 12 },
  sub:            { fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  titulo:         { fontSize: 16, fontWeight: '900' },
  grupoHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  grupoTitulo:    { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  requeridoBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  requeridoText:  { fontSize: 8, fontWeight: '900', color: '#ef4444', letterSpacing: 1 },
  opcionesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcionBtn:      { borderWidth: 1.5, borderRadius: 12, padding: 10, flexBasis: '48%', flexGrow: 1 },
  opcionNombre:   { fontSize: 13, fontWeight: '700' },
  opcionPrecio:   { fontSize: 10, marginTop: 2, fontWeight: '600' },
  footer:         { padding: 16, borderTopWidth: 1 },
  btnConfirmar:   { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnConfirmarText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});

// ─── Formulario combo ─────────────────────────────────────────
function FormularioCombo({ combo, productos, categorias, t, onGuardar, guardando }) {
  const toast = useToast();
  const [form, setForm] = useState({ nombre: '', precio: '', items: [] });
  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('todas');
  const [modalOpcion, setModalOpcion] = useState(null);

  useEffect(() => {
    setForm({
      nombre: combo?.nombre ?? '',
      precio: combo?.precio_base ? String(combo.precio_base) : '',
      items:  combo?.items_combo?.map(i => ({
        producto_hijo_id:        i.producto_hijo,
        cantidad:                i.cantidad,
        opcion_seleccionada_id:  i.opcion_seleccionada ?? null,
        _nombre:                 i.producto_hijo_nombre ?? '',
      })) ?? [],
    });
    setBusqueda('');
    setCatFiltro('todas');
  }, [combo]);

  // Optimizado con useMemo
  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      if (p.es_combo) return false;
      const matchCat = catFiltro === 'todas' || String(p.categoria) === String(catFiltro);
      const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
      return matchCat && matchBusq;
    });
  }, [productos, catFiltro, busqueda]);

  // Optimizado con useMemo
  const precioReal = useMemo(() => {
    return form.items.reduce((total, item) => {
      const prod = productos.find(p => String(p.id) === String(item.producto_hijo_id));
      if (!prod) return total;
      let precio = parseFloat(prod.precio_base) || 0;
      if (precio === 0 && prod.grupos_variacion?.length > 0) {
        const precios = prod.grupos_variacion
          .flatMap(g => g.opciones?.map(o => parseFloat(o.precio_adicional)) ?? [])
          .filter(p => p > 0);
        if (precios.length > 0) precio = Math.min(...precios);
      }
      return total + precio * item.cantidad;
    }, 0);
  }, [form.items, productos]);

  const agregarProducto = (producto, extras = {}) => {
    const opcionId = extras.opcion_seleccionada_id ?? null;
    setForm(f => {
      const idx = f.items.findIndex(it =>
        String(it.producto_hijo_id) === String(producto.id) &&
        it.opcion_seleccionada_id === opcionId
      );
      if (idx >= 0) {
        return { ...f, items: f.items.map((it, i) => i === idx ? { ...it, cantidad: it.cantidad + 1 } : it) };
      }
      return { 
        ...f, 
        items: [...f.items, { 
          producto_hijo_id: producto.id, 
          cantidad: 1, 
          opcion_seleccionada_id: opcionId, 
          _nombre: producto.nombre 
        }] 
      };
    });
    setModalOpcion(null);
  };

  const handleClickProducto = (producto) => {
    if (producto.requiere_seleccion && producto.grupos_variacion?.length > 0) {
      setModalOpcion(producto);
    } else {
      agregarProducto(producto);
    }
  };

  const quitarItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const cambiarCantidad = (idx, delta) =>
    setForm(f => ({ 
      ...f, 
      items: f.items.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, it.cantidad + delta) } : it) 
    }));

  const handleGuardar = () => {
    if (!form.nombre.trim()) { toast.warning('El nombre es obligatorio.'); return; }
    if (!form.precio || parseFloat(form.precio) <= 0) { toast.warning('El precio debe ser mayor a 0.'); return; }
    if (form.items.length === 0) { toast.warning('Agrega al menos un producto al combo.'); return; }
    onGuardar({ nombre: form.nombre, precio: parseFloat(form.precio), items: form.items });
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={fc.content} keyboardShouldPersistTaps="handled">
        {/* Nombre */}
        <Text style={[fc.label, { color: t.textMuted }]}>NOMBRE DEL COMBO</Text>
        <TextInput
          style={[fc.input, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
          value={form.nombre}
          onChangeText={v => setForm(f => ({ ...f, nombre: v }))}
          placeholder="Ej. Combo Familiar"
          placeholderTextColor={t.textMuted}
        />

        {/* Precio */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={[fc.label, { color: t.textMuted }]}>TU PRECIO (S/)</Text>
            <TextInput
              style={[fc.input, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
              value={form.precio}
              onChangeText={v => setForm(f => ({ ...f, precio: v.replace(/[^0-9.]/g, '') }))} // Solo números
              placeholder="0.00"
              placeholderTextColor={t.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
          {precioReal > 0 && (
            <View style={[fc.precioReal, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
              <Text style={[fc.precioRealLabel, { color: t.textMuted }]}>COSTO REAL</Text>
              <Text style={[fc.precioRealValor, {
                color: parseFloat(form.precio) < precioReal ? '#ef4444' : '#10b981'
              }]}>
                S/ {precioReal.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Indicador margen */}
        {precioReal > 0 && parseFloat(form.precio) > 0 && (
          <View style={[fc.margenBadge, { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
            backgroundColor: parseFloat(form.precio) >= precioReal ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'
          }]}>
            <Icon
              name={parseFloat(form.precio) >= precioReal ? 'check' : 'exclamation-triangle'}
              size={11}
              color={parseFloat(form.precio) >= precioReal ? '#10b981' : '#ef4444'}
            />
            <Text style={{ color: parseFloat(form.precio) >= precioReal ? '#10b981' : '#ef4444', fontSize: 11, fontWeight: '800' }}>
              {parseFloat(form.precio) >= precioReal ? 'Precio con ganancia' : 'Precio por debajo del costo'}
              {' · '}S/ {Math.abs(parseFloat(form.precio) - precioReal).toFixed(2)}
            </Text>
          </View>
        )}

        {/* Items seleccionados */}
        <Text style={[fc.label, { color: t.textMuted, marginTop: 24 }]}>
          PRODUCTOS DEL COMBO ({form.items.length})
        </Text>
        {form.items.length === 0 ? (
          <View style={[fc.emptyItems, { borderColor: t.border2 }]}>
            <Icon name="shopping-basket" size={24} color={t.textMuted} />
            <Text style={{ color: t.textSec, fontSize: 12, fontWeight: '600', marginTop: 8 }}>
              Selecciona productos de la lista
            </Text>
          </View>
        ) : (
          form.items.map((item, idx) => (
            <View key={idx} style={[fc.itemRow, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
              <Text style={[fc.itemNombre, { color: t.textPrim, flex: 1 }]} numberOfLines={1}>{item._nombre}</Text>
              <TouchableOpacity onPress={() => cambiarCantidad(idx, -1)} style={[fc.cantBtn, { backgroundColor: t.bgCard }]}>
                <Text style={{ color: t.textPrim, fontWeight: '900' }}>−</Text>
              </TouchableOpacity>
              <Text style={[fc.cantNum, { color: t.textPrim }]}>{item.cantidad}</Text>
              <TouchableOpacity onPress={() => cambiarCantidad(idx, 1)} style={[fc.cantBtn, { backgroundColor: t.bgCard }]}>
                <Text style={{ color: t.textPrim, fontWeight: '900' }}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => quitarItem(idx)} style={{ padding: 8, marginLeft: 4 }}>
                <Icon name="trash" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Buscador */}
        <Text style={[fc.label, { color: t.textMuted, marginTop: 24 }]}>AGREGAR PRODUCTOS</Text>
        <View style={[fc.busquedaBox, { backgroundColor: t.bgInput, borderColor: t.border2 }]}>
          <Icon name="search" size={14} color={t.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, color: t.textPrim, fontSize: 14, fontWeight: '500', padding: 0 }}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar producto..."
            placeholderTextColor={t.textMuted}
          />
          {busqueda.length > 0 && (
            <TouchableOpacity onPress={() => setBusqueda('')} style={{ padding: 4 }}>
              <Icon name="times-circle" size={16} color={t.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtro categorías */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }} contentContainerStyle={{ paddingRight: 16 }}>
          {['todas', ...categorias.map(c => String(c.id))].map((id) => {
            const nombre = id === 'todas' ? 'Todas' : categorias.find(c => String(c.id) === id)?.nombre || id;
            const activo = catFiltro === id;
            return (
              <TouchableOpacity
                key={id}
                style={[fc.catPill, { backgroundColor: t.bgCard2, borderColor: t.border },
                  activo && { backgroundColor: t.color, borderColor: t.color }]}
                onPress={() => setCatFiltro(id)}
                activeOpacity={0.8}
              >
                <Text style={[fc.catPillText, { color: activo ? '#fff' : t.textSec }]}>{nombre}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Grid productos */}
        <View style={fc.productosGrid}>
          {productosFiltrados.map(p => {
            const yaAgregado = form.items.some(it => String(it.producto_hijo_id) === String(p.id));
            return (
              <TouchableOpacity
                key={p.id}
                style={[fc.productoCard, { backgroundColor: t.bgCard2, borderColor: t.border },
                  yaAgregado && { borderColor: t.color, backgroundColor: `${t.color}10` }]}
                onPress={() => handleClickProducto(p)}
                activeOpacity={0.8}
              >
                <View style={[fc.productoImg, { backgroundColor: t.bgCard }]}>
                  {p.imagen
                    ? <Image source={{ uri: p.imagen }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    : <Icon name="cutlery" size={18} color={t.textMuted} />
                  }
                  {yaAgregado && (
                    <View style={[fc.checkOverlay, { backgroundColor: `${t.color}50` }]}>
                      <Icon name="check" size={18} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={fc.productoInfo}>
                  <Text style={[fc.productoNombre, { color: t.textPrim }]} numberOfLines={2}>{p.nombre}</Text>
                  <Text style={[fc.productoPrecio, { color: t.color }]}>{getPrecio(p)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      {/* Botón guardar fijo al fondo */}
      <View style={[fc.footer, { borderTopColor: t.border, backgroundColor: t.bgCard }]}>
        <TouchableOpacity
          style={[fc.btnGuardar, { backgroundColor: t.color }, guardando && { opacity: 0.6 }]}
          onPress={handleGuardar}
          disabled={guardando}
          activeOpacity={0.8}
        >
          {guardando
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Icon name="floppy-o" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={fc.btnGuardarText}>{combo ? 'GUARDAR CAMBIOS' : 'CREAR COMBO'}</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {modalOpcion && (
        <ModalOpcion
          producto={modalOpcion}
          t={t}
          onConfirmar={(extras) => agregarProducto(modalOpcion, extras)}
          onCerrar={() => setModalOpcion(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const fc = StyleSheet.create({
  content:       { padding: 16, paddingBottom: 30 },
  label:         { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  input:         { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '600' },
  precioReal:    { borderRadius: 14, borderWidth: 1, padding: 12, justifyContent: 'center', minWidth: 110, alignItems: 'center' },
  precioRealLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  precioRealValor: { fontSize: 18, fontWeight: '900' },
  margenBadge:   { borderRadius: 10, padding: 12, marginTop: 10, alignItems: 'center' },
  emptyItems:    { alignItems: 'center', justifyContent: 'center', padding: 24, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, marginBottom: 12 },
  itemRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  itemNombre:    { fontSize: 14, fontWeight: '700' },
  cantBtn:       { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cantNum:       { fontSize: 14, fontWeight: '900', width: 24, textAlign: 'center' },
  busquedaBox:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  catPill:       { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  catPillText:   { fontSize: 12, fontWeight: '700' },
  productosGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  productoCard:  { flexBasis: '31%', borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  productoImg:   { height: 65, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  checkOverlay:  { position: 'absolute', inset: 0, top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  productoInfo:  { padding: 8, alignItems: 'center' },
  productoNombre:{ fontSize: 11, fontWeight: '700', lineHeight: 14, marginBottom: 4, textAlign: 'center' },
  productoPrecio:{ fontSize: 11, fontWeight: '900' },
  footer:        { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1 },
  btnGuardar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16 },
  btnGuardarText:{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});

// ─── Modal principal Combos ───────────────────────────────────
export default function ModalCombos({ visible, productos, categorias, t, onCerrar }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [combos, setCombos]           = useState([]);
  const [cargando, setCargando]       = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [guardando, setGuardando]     = useState(false);
  const [vista, setVista]             = useState('lista');
  const [comboEditando, setComboEditando] = useState(null);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefrescando(true);
    else setCargando(true);
    
    try {
      const negocioId = await EncryptedStorage.getItem('negocio_id');
      const { data } = await api.get('/productos/', { params: { es_combo: true, negocio_id: negocioId } });
      setCombos(Array.isArray(data) ? data.filter(p => p.es_combo) : []);
    } catch (e) {
      console.error('Error cargando combos:', e);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useEffect(() => {
    if (visible) { cargar(); setVista('lista'); setComboEditando(null); }
  }, [visible, cargar]);

  const handleGuardar = async (formData) => {
    setGuardando(true);
    try {
      const negocioId = await EncryptedStorage.getItem('negocio_id');
      if (comboEditando) {
        await api.patch(`/productos/${comboEditando.id}/`, { nombre: formData.nombre, precio_base: formData.precio });
        await api.post(`/productos/${comboEditando.id}/actualizar_items_combo/`, { items: formData.items });
      } else {
        const { data: nuevo } = await api.post('/productos/', {
          negocio: negocioId, nombre: formData.nombre, precio_base: formData.precio, es_combo: true, disponible: true
        });
        await api.post(`/productos/${nuevo.id}/actualizar_items_combo/`, { items: formData.items });
      }
      await cargar();
      toast.success(comboEditando ? 'Combo actualizado correctamente.' : 'Combo creado correctamente.');
      setVista('lista');
      setComboEditando(null);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar el combo.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (combo) => {
    const ok = await confirmar(`¿Eliminar el combo "${combo.nombre}" del menú?`);
    if (!ok) return;
    try {
      await api.patch(`/productos/${combo.id}/`, { activo: false });
      await cargar();
      toast.success('Combo eliminado.');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo eliminar el combo.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={[mc.container, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bgCard} />

        {/* Header */}
        <View style={[mc.header, { backgroundColor: t.bgCard, borderBottomColor: t.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, flexShrink: 1, marginRight: 12 }}>
            {vista === 'formulario' && (
              <TouchableOpacity
                onPress={() => { setVista('lista'); setComboEditando(null); }}
                style={[mc.backBtn, { backgroundColor: t.bgCard2 }]}
              >
                <Icon name="chevron-left" size={16} color={t.textSec} />
              </TouchableOpacity>
            )}
            <View style={[mc.headerIcono, { backgroundColor: `${t.color}15` }]}>
              <Icon name="th-large" size={16} color={t.color} />
            </View>
            <View style={{ flex: 1, flexShrink: 1 }}>
              <Text style={[mc.headerSub, { color: t.textMuted }]} numberOfLines={1}>MÓDULO DE MENÚ</Text>
              <Text style={[mc.headerTitulo, { color: t.textPrim }]} numberOfLines={1}>
                {vista === 'lista' ? 'Combos del Menú' : comboEditando ? 'Editar Combo' : 'Nuevo Combo'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexShrink: 0 }}>
            {vista === 'lista' && (
              <TouchableOpacity
                style={[mc.btnNuevo, { backgroundColor: t.color }]}
                onPress={() => { setComboEditando(null); setVista('formulario'); }}
                activeOpacity={0.8}
              >
                <Icon name="plus" size={12} color="#fff" style={{ marginRight: 6 }} />
                <Text style={mc.btnNuevoText}>NUEVO COMBO</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onCerrar} style={{ padding: 6 }}>
              <Icon name="times" size={22} color={t.textSec} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenido */}
        {vista === 'lista' ? (
          <ScrollView 
            contentContainerStyle={mc.listaContent}
            refreshControl={
              <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[t.color]} />
            }
          >
            {cargando ? (
              <ActivityIndicator size="large" color={t.color} style={{ marginTop: 60 }} />
            ) : combos.length === 0 ? (
              <View style={[mc.emptyState, { borderColor: t.border }]}>
                <View style={[mc.emptyIconBox, { backgroundColor: t.bgCard2 }]}>
                  <Icon name="th-large" size={32} color={t.textMuted} />
                </View>
                <Text style={[mc.emptyTitulo, { color: t.textPrim }]}>Sin combos</Text>
                <Text style={[mc.emptyDesc, { color: t.textSec }]}>Atrae más clientes creando tu primer combo.</Text>
              </View>
            ) : (
              <View style={mc.combosGrid}>
                {combos.map(combo => (
                  <View key={combo.id} style={[mc.comboCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                    <View style={[mc.comboImg, { backgroundColor: t.bgCard2 }]}>
                      {combo.imagen
                        ? <Image source={{ uri: combo.imagen }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        : <Icon name="th-large" size={28} color={t.textMuted} />
                      }
                    </View>
                    <View style={mc.comboCardBody}>
                      <Text style={[mc.comboNombre, { color: t.textPrim }]} numberOfLines={2}>{combo.nombre}</Text>
                      <Text style={[mc.comboPrecio, { color: t.color }]}>
                        S/ {parseFloat(combo.precio_base).toFixed(2)}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                        <TouchableOpacity
                          style={[mc.comboBtn, { flex: 1, backgroundColor: t.bgCard2, borderColor: t.border }]}
                          onPress={() => { setComboEditando(combo); setVista('formulario'); }}
                          activeOpacity={0.8}
                        >
                          <Icon name="pencil" size={12} color={t.textSec} style={{ marginRight: 6 }} />
                          <Text style={[mc.comboBtnText, { color: t.textSec }]}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[mc.comboBtn, { width: 40, backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}
                          onPress={() => handleEliminar(combo)}
                          activeOpacity={0.8}
                        >
                          <Icon name="trash" size={14} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : (
          <FormularioCombo
            combo={comboEditando}
            productos={productos}
            categorias={categorias}
            t={t}
            onGuardar={handleGuardar}
            guardando={guardando}
          />
        )}
      </View>
    </Modal>
  );
}

const mc = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16, paddingBottom: 16, borderBottomWidth: 1 },
  headerIcono:  { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerSub:    { fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  headerTitulo: { fontSize: 20, fontWeight: '900' },
  backBtn:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnNuevo:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  btnNuevoText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  listaContent: { padding: 16, paddingBottom: 40 },
  emptyState:   { padding: 40, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', gap: 10, marginTop: 40 },
  emptyIconBox: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitulo:  { fontSize: 20, fontWeight: '900' },
  emptyDesc:    { fontSize: 14, textAlign: 'center' },
  combosGrid:   { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  comboCard:    { width: '48%', borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  comboImg:     { height: 90, alignItems: 'center', justifyContent: 'center' },
  comboCardBody:{ padding: 12 },
  comboNombre:  { fontSize: 14, fontWeight: '800', marginBottom: 6, minHeight: 40 },
  comboPrecio:  { fontSize: 16, fontWeight: '900' },
  comboBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  comboBtnText: { fontSize: 12, fontWeight: '800' },
});