import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import useAppStore from '../../store/useAppStore';

const formatearSoles = (monto) => `S/ ${parseFloat(monto || 0).toFixed(2)}`;

export default function ModalModificadores({
  visible,
  producto,
  modificadoresGlobales = [],
  onAgregarAlCarrito,
  onClose,
}) {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal?.temaFondo !== 'light';
  const color  = configuracionGlobal?.colorPrimario || '#ff5a1f';

  const t = {
    bg:       isDark ? '#0a0a0a' : '#f8f9fa',
    bg2:      isDark ? '#111111' : '#ffffff',
    bg3:      isDark ? '#151515' : '#f3f4f6',
    border:   isDark ? '#222222' : '#e5e7eb',
    border2:  isDark ? '#2a2a2a' : '#d1d5db',
    textPrim: isDark ? '#ffffff' : '#111111',
    textSec:  isDark ? '#9ca3af' : '#6b7280',
    textMut:  isDark ? '#4b5563' : '#9ca3af',
  };

  const [cantidad, setCantidad]         = useState(1);
  const [selecciones, setSelecciones]   = useState({});
  const [chipsActivos, setChipsActivos] = useState([]);
  const [notaLibre, setNotaLibre]       = useState('');

  useEffect(() => {
    if (visible && producto) {
      if (producto.cart_id && producto.notas_y_modificadores) {
        setCantidad(producto.cantidad || 1);
        setSelecciones(producto.notas_y_modificadores.variaciones || {});
        setChipsActivos(producto.notas_y_modificadores.chips || []);
        setNotaLibre(producto.notas_y_modificadores.nota_libre || '');
      } else {
        setCantidad(1);
        setSelecciones({});
        setChipsActivos([]);
        setNotaLibre('');
      }
    }
  }, [visible, producto]);

  if (!producto) return null;

  // ─── Modificadores globales filtrados ────────────────────
  const modificadoresPermitidos = modificadoresGlobales.filter(mod => {
    if (!mod.categorias_aplicables || mod.categorias_aplicables.length === 0) return true;
    return mod.categorias_aplicables.some(catId => String(catId) === String(producto.categoria));
  });
  const notasGratis    = modificadoresPermitidos.filter(m => parseFloat(m.precio || 0) === 0);
  const agregadosPagos = modificadoresPermitidos.filter(m => parseFloat(m.precio || 0) > 0);

  // ─── Cálculo de precio ───────────────────────────────────
  const precioBase = parseFloat(producto.precio_base || producto.precio || 0);
  let precioExtras = 0;

  Object.values(selecciones).forEach(opcionesSeleccionadas => {
    opcionesSeleccionadas.forEach(idOpcion => {
      producto.grupos_variacion?.forEach(grupo => {
        const opcion = grupo.opciones.find(opt => opt.id === idOpcion);
        if (opcion) precioExtras += parseFloat(opcion.precio_adicional || 0);
      });
    });
  });

  chipsActivos.forEach(nombreChip => {
    const mod = modificadoresGlobales.find(m => (m.nombre || m) === nombreChip);
    if (mod && parseFloat(mod.precio || 0) > 0) precioExtras += parseFloat(mod.precio);
  });

  const precioUnitario = precioBase + precioExtras;
  const precioTotal    = precioUnitario * cantidad;

  // ─── Toggle opciones ─────────────────────────────────────
  const toggleOpcion = (grupo, opcionId) => {
    setSelecciones(prev => {
      const actuales = prev[grupo.id] || [];
      if (grupo.seleccion_multiple) {
        return {
          ...prev,
          [grupo.id]: actuales.includes(opcionId)
            ? actuales.filter(id => id !== opcionId)
            : [...actuales, opcionId],
        };
      }
      return { ...prev, [grupo.id]: [opcionId] };
    });
  };

  const toggleChip = (nombreChip) => {
    setChipsActivos(prev =>
      prev.includes(nombreChip) ? prev.filter(c => c !== nombreChip) : [...prev, nombreChip]
    );
  };

  // ─── Validación obligatorios ──────────────────────────────
  const todosObligatoriosListos = producto.grupos_variacion?.every(grupo => {
    if (!grupo.obligatorio) return true;
    return (selecciones[grupo.id] || []).length > 0;
  }) ?? true;

  // ─── Confirmar ───────────────────────────────────────────
  const handleAgregar = () => {
    const notasYModificadores = {
      variaciones: selecciones,
      chips:       chipsActivos,
      nota_libre:  notaLibre,
    };

    let textoCocina = [];
    Object.values(selecciones).forEach(opcionesSeleccionadas => {
      opcionesSeleccionadas.forEach(idOpcion => {
        producto.grupos_variacion?.forEach(g => {
          const opt = g.opciones.find(o => o.id === idOpcion);
          if (opt) textoCocina.push(opt.nombre);
        });
      });
    });
    if (chipsActivos.length > 0) textoCocina.push(...chipsActivos);
    if (notaLibre.trim()) textoCocina.push(`Nota: ${notaLibre.trim()}`);

    const esEdicion = !!producto.cart_id;

    onAgregarAlCarrito({
      ...producto,
      cart_id:                 esEdicion ? producto.cart_id : undefined,
      precio:                  precioUnitario,
      precio_unitario_calculado: precioUnitario,
      cantidad,
      notas_y_modificadores:  notasYModificadores,
      notas_cocina:            textoCocina.join(' | '),
      opciones_seleccionadas:  Object.values(selecciones).flat(),
    }, esEdicion);

    onClose();
  };

  const mostrarPrecioBase = !(producto.requiere_seleccion && precioBase === 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* SafeArea: con edge-to-edge (RN 0.85) la hoja se dibuja bajo la barra de gestos;
          el inset evita que el botón inferior pierda los toques. Ver ModalCobro. */}
      <SafeAreaProvider>
      <View style={s.overlay}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[s.container, { backgroundColor: t.bg, borderTopColor: t.border }]}>

          {/* Handle */}
          <View style={s.handle}>
            <View style={[s.handleBar, { backgroundColor: t.border2 }]} />
          </View>

          {/* Header */}
          <View style={[s.header, { backgroundColor: t.bg2, borderBottomColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.titulo, { color: t.textPrim }]}>{producto.nombre}</Text>
              {mostrarPrecioBase && precioBase > 0 && (
                <Text style={[s.precioBase, { color: t.textSec }]}>
                  Precio Base: {formatearSoles(precioBase)}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[s.closeBtn, { backgroundColor: t.bg3, borderColor: t.border2 }]}
              activeOpacity={0.7}
            >
              <Icon name="times" size={14} color={t.textSec} />
            </TouchableOpacity>
          </View>

          {/* Cuerpo */}
          <ScrollView 
            style={{ flex: 1, flexShrink: 1 }} 
            contentContainerStyle={s.body} 
            showsVerticalScrollIndicator={false}
            >

            {/* 1. Grupos de variación */}
            {producto.grupos_variacion?.map((grupo, gIdx) => (
              <View key={grupo.id || `g-${gIdx}`} style={{ marginBottom: 24 }}>
                <View style={s.grupoHeaderRow}>
                  <Text style={[s.grupoTitulo, { color: t.textPrim }]}>{grupo.nombre}</Text>
                  {grupo.obligatorio ? (
                    <View style={s.obligatorioBadge}>
                      <Text style={s.obligatorioText}>OBLIGATORIO</Text>
                    </View>
                  ) : (
                    <Text style={[s.opcionalText, { color: t.textMut }]}>Opcional</Text>
                  )}
                </View>

                <View style={s.opcionesGrid}>
                  {grupo.opciones.map((opcion, oIdx) => {
                    const activo = (selecciones[grupo.id] || []).includes(opcion.id);
                    const precioAdicional = parseFloat(opcion.precio_adicional || 0);
                    return (
                      <TouchableOpacity
                        key={opcion.id || `o-${oIdx}`}
                        style={[
                          s.opcionCard,
                          { backgroundColor: t.bg3, borderColor: t.border2 },
                          activo && { backgroundColor: `${color}15`, borderColor: color },
                        ]}
                        onPress={() => toggleOpcion(grupo, opcion.id)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.opcionCheck, { borderColor: activo ? color : t.border2, backgroundColor: activo ? color : 'transparent' }]}>
                          {activo && <Icon name="check" size={9} color="#fff" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.opcionNombre, { color: activo ? color : t.textPrim }]}>{opcion.nombre}</Text>
                          {precioAdicional > 0 && (
                            <Text style={[s.opcionPrecio, { color: t.textSec }]}>
                              {precioBase === 0 ? formatearSoles(precioAdicional) : `+${formatearSoles(precioAdicional)}`}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* 2. Agregados con precio */}
            {agregadosPagos.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <View style={[s.divider, { borderTopColor: t.border }]} />
                <Text style={[s.seccionTitulo, { color: t.textSec }]}>AGREGADOS EXTRAS</Text>
                <View style={s.chipsRow}>
                  {agregadosPagos.map((chip, idx) => {
                    const nombre = chip.nombre || chip;
                    const precio = parseFloat(chip.precio || 0);
                    const activo = chipsActivos.includes(nombre);
                    return (
                      <TouchableOpacity
                        key={chip.id || `ag-${idx}`}
                        style={[
                          s.chipBtn,
                          { borderColor: t.border2, backgroundColor: 'transparent' },
                          activo && { borderColor: color, backgroundColor: `${color}15` },
                        ]}
                        onPress={() => toggleChip(nombre)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipNombre, { color: activo ? '#fff' : t.textSec }]}>{nombre}</Text>
                        <View style={[s.chipPrecioBadge, { backgroundColor: activo ? color : t.bg3 }]}>
                          <Text style={[s.chipPrecioText, { color: activo ? '#fff' : color }]}>+{formatearSoles(precio)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 3. Notas rápidas gratis */}
            {notasGratis.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <View style={[s.divider, { borderTopColor: t.border }]} />
                <Text style={[s.seccionTitulo, { color: t.textSec }]}>NOTAS RÁPIDAS</Text>
                <View style={s.chipsRow}>
                  {notasGratis.map((chip, idx) => {
                    const nombre = chip.nombre || chip;
                    const activo = chipsActivos.includes(nombre);
                    return (
                      <TouchableOpacity
                        key={chip.id || `ng-${idx}`}
                        style={[
                          s.chipSimple,
                          { borderColor: t.border2, backgroundColor: t.bg3 },
                          activo && { borderColor: color, backgroundColor: color },
                        ]}
                        onPress={() => toggleChip(nombre)}
                        activeOpacity={0.8}
                      >
                        <Text style={[s.chipSimpleText, { color: activo ? '#fff' : t.textSec }]}>{nombre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 4. Nota personalizada */}
            <View style={{ marginBottom: 8 }}>
              <View style={[s.divider, { borderTopColor: t.border }]} />
              <Text style={[s.seccionTitulo, { color: t.textSec }]}>NOTA PERSONALIZADA</Text>
              <TextInput
                style={[s.notaInput, { backgroundColor: t.bg3, borderColor: t.border2, color: t.textPrim }]}
                value={notaLibre}
                onChangeText={setNotaLibre}
                placeholder="Ej: Sin cebolla, bien cocido..."
                placeholderTextColor={t.textMut}
                multiline
                numberOfLines={3}
              />
            </View>

          </ScrollView>

          {/* Footer */}
          <View style={[s.footer, { backgroundColor: t.bg2, borderTopColor: t.border }]}>
            {/* Selector cantidad */}
            <View style={[s.cantSelector, { backgroundColor: t.bg3, borderColor: t.border2 }]}>
              <TouchableOpacity
                style={[s.cantBtn, { backgroundColor: t.bg2, borderColor: t.border }]}
                onPress={() => setCantidad(prev => Math.max(1, prev - 1))}
                activeOpacity={0.8}
              >
                <Text style={[s.cantBtnText, { color: t.textPrim }]}>-</Text>
              </TouchableOpacity>
              <Text style={[s.cantNum, { color: t.textPrim }]}>{cantidad}</Text>
              <TouchableOpacity
                style={[s.cantBtn, { backgroundColor: t.bg2, borderColor: t.border }]}
                onPress={() => setCantidad(prev => prev + 1)}
                activeOpacity={0.8}
              >
                <Text style={[s.cantBtnText, { color: t.textPrim }]}>+</Text>
              </TouchableOpacity>
            </View>

            {/* Botón confirmar */}
            <TouchableOpacity
              style={[
                s.btnConfirmar,
                { backgroundColor: todosObligatoriosListos ? color : t.bg3 },
              ]}
              onPress={handleAgregar}
              disabled={!todosObligatoriosListos}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.btnConfirmarLabel, { color: todosObligatoriosListos ? '#fff' : t.textMut }]}>
                  {!todosObligatoriosListos
                    ? 'Falta seleccionar'
                    : producto.cart_id ? 'Guardar Cambios' : 'Confirmar'}
                </Text>
              </View>
              {precioTotal > 0 && (
                <View style={s.btnConfirmarPrecio}>
                  <Text style={s.btnConfirmarPrecioText}>{formatearSoles(precioTotal)}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

        </SafeAreaView>
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    container: { 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    borderTopWidth: 1, 
    height: '90%',        // ← cambiar maxHeight por height fijo
    },
  handle:         { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handleBar:      { width: 48, height: 4, borderRadius: 2 },

  header:         { flexDirection: 'row', alignItems: 'flex-start', padding: 20, borderBottomWidth: 1 },
  titulo:         { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  precioBase:     { fontSize: 12, fontWeight: '600', marginTop: 4 },
  closeBtn:       { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  body:           { padding: 20, paddingBottom: 16 },

  grupoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  grupoTitulo:    { fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  obligatorioBadge: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  obligatorioText:  { fontSize: 9, fontWeight: '900', color: '#ef4444', letterSpacing: 1 },
  opcionalText:   { fontSize: 11, fontWeight: '700' },

  opcionesGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcionCard:     { flexDirection: 'row', alignItems: 'center', width: '47%', borderRadius: 14, borderWidth: 1.5, padding: 12, gap: 10 },
  opcionCheck:    { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  opcionNombre:   { fontSize: 13, fontWeight: '700' },
  opcionPrecio:   { fontSize: 11, fontWeight: '600', marginTop: 2 },

  divider:        { borderTopWidth: 1, marginBottom: 16 },
  seccionTitulo:  { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },

  chipsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipBtn:        { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingLeft: 12, paddingRight: 4, paddingVertical: 6, gap: 6 },
  chipNombre:     { fontSize: 12, fontWeight: '700' },
  chipPrecioBadge:{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  chipPrecioText: { fontSize: 10, fontWeight: '900' },

  chipSimple:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipSimpleText: { fontSize: 12, fontWeight: '700' },

  notaInput:      { borderRadius: 14, borderWidth: 1, padding: 14, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },

  footer:         { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1, gap: 12 },
  cantSelector:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  cantBtn:        { width: 44, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cantBtnText:    { fontSize: 22, fontWeight: '900', lineHeight: 26 },
  cantNum:        { fontSize: 20, fontWeight: '900', minWidth: 28, textAlign: 'center' },

  btnConfirmar:   { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
  btnConfirmarLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, color: '#fff' },
  btnConfirmarPrecio: { backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  btnConfirmarPrecioText: { fontSize: 15, fontWeight: '900', color: '#fff' },
});