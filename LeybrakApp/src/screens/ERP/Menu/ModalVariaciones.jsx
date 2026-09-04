import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { getCatalogoGlobal, actualizarVariacionesProducto } from '../../../api/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';
import SelectorInsumo from './SelectorInsumo';

// ─── Mini-modal: receta de una opción puntual (buscador + carrito apilados) ───
function ModalRecetaOpcion({ opcionNombre, catalogo, ingredientes, onAgregar, onCambiarCantidad, onQuitar, onCerrar, t }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={ro.overlay}>
        <View style={[ro.modal, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={[ro.header, { borderBottomColor: t.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[ro.sub, { color: t.textMuted }]}>RECETA DE ESTA VARIANTE</Text>
              <Text style={[ro.titulo, { color: t.textPrim }]} numberOfLines={1}>{opcionNombre || 'Opción sin nombre'}</Text>
            </View>
            <TouchableOpacity onPress={onCerrar} style={{ padding: 4 }}>
              <Icon name="times" size={20} color={t.textSec} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <SelectorInsumo
              catalogo={catalogo}
              agregados={ingredientes.map(i => i.insumo)}
              onAgregar={onAgregar}
              t={t}
            />

            <Text style={[ro.label, { color: t.textMuted, marginTop: 20 }]}>INSUMOS ({ingredientes.length})</Text>
            {ingredientes.length === 0 ? (
              <Text style={{ color: t.textMuted, fontSize: 12, fontWeight: '600', paddingVertical: 12 }}>
                Aún no hay ingredientes en esta variante.
              </Text>
            ) : (
              ingredientes.map((ing, idx) => (
                <View key={idx} style={[ro.itemRow, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
                  <Text style={[ro.itemNombre, { color: t.textPrim }]} numberOfLines={1}>{ing.nombre_insumo}</Text>
                  <TextInput
                    style={[ro.itemCantInput, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
                    value={String(ing.cantidad_necesaria)}
                    onChangeText={v => onCambiarCantidad(idx, v.replace(/[^0-9.]/g, ''))}
                    keyboardType="decimal-pad"
                  />
                  <Text style={[ro.itemUnidad, { color: t.textMuted }]}>{ing.unidad_medida}</Text>
                  <TouchableOpacity onPress={() => onQuitar(idx)} style={{ padding: 6 }}>
                    <Icon name="trash" size={13} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <View style={[ro.footer, { borderTopColor: t.border }]}>
            <TouchableOpacity style={[ro.btnListo, { backgroundColor: t.color }]} onPress={onCerrar} activeOpacity={0.85}>
              <Text style={ro.btnListoText}>LISTO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const ro = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 16 },
  modal:    { borderRadius: 24, borderWidth: 1, maxHeight: '85%' },
  header:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, gap: 12 },
  sub:      { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  titulo:   { fontSize: 16, fontWeight: '900' },
  label:    { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  itemRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
  itemNombre: { fontSize: 12, fontWeight: '700', flex: 1 },
  itemCantInput: { width: 54, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  itemUnidad: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', width: 28 },
  footer:   { padding: 16, borderTopWidth: 1 },
  btnListo: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnListoText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});

// ─── Tarjeta de una opción de variación ───
function OpcionCard({
  opcion, catalogo, t,
  onCambiarNombre, onCambiarPrecio, onCambiarModo, onEliminar, onAbrirReceta,
  onAgregarInsumoUnidad, onCambiarCantidadUnidad, onQuitarInsumoUnidad,
}) {
  const esUnidad = opcion.modo_stock === 'unidad';
  const ingredientes = opcion.ingredientes || [];
  const catalogoUnidades = catalogo.filter(i => i.unidad_medida === 'unidades');

  return (
    <View style={[oc.card, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
      {/* Nombre + precio + eliminar */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <TextInput
          style={[oc.inputNombre, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
          value={opcion.nombre}
          onChangeText={onCambiarNombre}
          placeholder="Nombre de la opción"
          placeholderTextColor={t.textMuted}
        />
        <View style={[oc.inputPrecioBox, { backgroundColor: t.bgInput, borderColor: t.border2 }]}>
          <Text style={{ color: t.textMuted, fontSize: 10, fontWeight: '700' }}>S/</Text>
          <TextInput
            style={[oc.inputPrecio, { color: t.textPrim }]}
            value={String(opcion.precio_adicional)}
            onChangeText={onCambiarPrecio}
            keyboardType="decimal-pad"
          />
        </View>
        <TouchableOpacity
          onPress={onEliminar}
          style={[oc.btnEliminar, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}
        >
          <Icon name="trash" size={13} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Switch modo */}
      <View style={[oc.switchTrack, { backgroundColor: t.bgInput }]}>
        <TouchableOpacity
          style={[oc.switchBtn, !esUnidad && { backgroundColor: t.color }]}
          onPress={() => onCambiarModo('receta')}
          activeOpacity={0.85}
        >
          <Text style={[oc.switchText, { color: !esUnidad ? '#fff' : t.textSec }]}>RECETA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[oc.switchBtn, esUnidad && { backgroundColor: t.color }]}
          onPress={() => onCambiarModo('unidad')}
          activeOpacity={0.85}
        >
          <Text style={[oc.switchText, { color: esUnidad ? '#fff' : t.textSec }]}>POR UNIDAD</Text>
        </TouchableOpacity>
      </View>

      {/* Cuerpo según modo */}
      {!esUnidad ? (
        <TouchableOpacity
          style={[oc.recetaBtn, { backgroundColor: t.bgCard, borderColor: t.border }]}
          onPress={onAbrirReceta}
          activeOpacity={0.8}
        >
          <Text style={[oc.recetaBtnText, { color: t.textSec }]}>
            {ingredientes.length > 0
              ? `${ingredientes.length} insumo${ingredientes.length > 1 ? 's' : ''} configurado${ingredientes.length > 1 ? 's' : ''}`
              : 'Sin receta aún'}
          </Text>
          <Icon name="book" size={12} color={t.color} />
        </TouchableOpacity>
      ) : ingredientes.length === 0 ? (
        catalogoUnidades.length === 0 ? (
          <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '700' }}>
            No hay insumos tipo "unidades" en tu catálogo. Créalos desde Inventario.
          </Text>
        ) : (
          <SelectorInsumo
            catalogo={catalogoUnidades}
            agregados={[]}
            onAgregar={onAgregarInsumoUnidad}
            t={t}
            placeholder="Buscar insumo por unidad..."
          />
        )
      ) : (
        <View style={[oc.unidadRow, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Text style={[oc.unidadNombre, { color: t.textPrim }]} numberOfLines={1}>{ingredientes[0].nombre_insumo}</Text>
          <TextInput
            style={[oc.unidadCantInput, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
            value={String(ingredientes[0].cantidad_necesaria)}
            onChangeText={v => onCambiarCantidadUnidad(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />
          <Text style={{ color: t.textMuted, fontSize: 9, fontWeight: '800' }}>und.</Text>
          <TouchableOpacity onPress={onQuitarInsumoUnidad}>
            <Text style={{ color: t.textSec, fontSize: 10, fontWeight: '800', textDecorationLine: 'underline' }}>Cambiar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const oc = StyleSheet.create({
  card:           { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10 },
  inputNombre:    { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13, fontWeight: '700' },
  inputPrecioBox: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, width: 66 },
  inputPrecio:    { flex: 1, fontSize: 13, fontWeight: '800', paddingVertical: 9, textAlign: 'right' },
  btnEliminar:    { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  switchTrack:    { flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 10 },
  switchBtn:      { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  switchText:     { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  recetaBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
  recetaBtnText:  { fontSize: 12, fontWeight: '700' },
  unidadRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  unidadNombre:   { flex: 1, fontSize: 12, fontWeight: '700' },
  unidadCantInput:{ width: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 6, fontSize: 12, fontWeight: '800', textAlign: 'center' },
});

// ─── Modal principal ───
export default function ModalVariaciones({ visible, plato, t, onCerrar }) {
  const toast = useToast();
  const confirmar = useConfirm();

  const [catalogo, setCatalogo] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [modalRecetaOpcion, setModalRecetaOpcion] = useState(null); // { gIndex, oIndex } | null

  const cargar = useCallback(async () => {
    if (!plato) return;
    setCargando(true);
    try {
      const resCatalogo = await getCatalogoGlobal();
      setCatalogo(Array.isArray(resCatalogo.data) ? resCatalogo.data : (resCatalogo.data.results ?? []));
      setGrupos(plato.grupos_variacion ? JSON.parse(JSON.stringify(plato.grupos_variacion)) : []);
    } catch (e) {
      console.error('Error cargando variaciones:', e);
      toast.error('No se pudo cargar el catálogo.');
    } finally {
      setCargando(false);
    }
  }, [plato, toast]);

  useEffect(() => { if (visible) { cargar(); setModalRecetaOpcion(null); } }, [visible, cargar]);

  const actualizarOpcion = (gIndex, oIndex, cambios) => {
    setGrupos(prev => {
      const copia = [...prev];
      copia[gIndex] = { ...copia[gIndex], opciones: [...copia[gIndex].opciones] };
      copia[gIndex].opciones[oIndex] = { ...copia[gIndex].opciones[oIndex], ...cambios };
      return copia;
    });
  };

  const handleCambiarModo = async (gIndex, oIndex, nuevoModo) => {
    const opcion = grupos[gIndex].opciones[oIndex];
    if (opcion.modo_stock === nuevoModo) return;
    if (nuevoModo === 'unidad' && (opcion.ingredientes?.length || 0) > 0) {
      const n = opcion.ingredientes.length;
      const ok = await confirmar(`¿Cambiar a modo "Por unidad"? Se perderá la receta actual (${n} insumo${n > 1 ? 's' : ''}).`);
      if (!ok) return;
    }
    actualizarOpcion(gIndex, oIndex, { modo_stock: nuevoModo, ingredientes: nuevoModo === 'unidad' ? [] : (grupos[gIndex].opciones[oIndex].ingredientes || []) });
  };

  const handleEliminarOpcion = async (gIndex, oIndex) => {
    const ok = await confirmar('¿Eliminar esta opción?');
    if (!ok) return;
    setGrupos(prev => {
      const copia = [...prev];
      copia[gIndex] = { ...copia[gIndex], opciones: copia[gIndex].opciones.filter((_, i) => i !== oIndex) };
      return copia;
    });
  };

  const handleAgregarIngrediente = (gIndex, oIndex, insumo) => {
    const actuales = grupos[gIndex].opciones[oIndex].ingredientes || [];
    actualizarOpcion(gIndex, oIndex, {
      ingredientes: [...actuales, {
        insumo: insumo.id,
        nombre_insumo: insumo.nombre,
        unidad_medida: insumo.unidad_medida,
        cantidad_necesaria: 1,
      }],
    });
  };

  const handleCambiarCantidadIngrediente = (gIndex, oIndex, iIndex, valor) => {
    const nuevos = [...(grupos[gIndex].opciones[oIndex].ingredientes || [])];
    nuevos[iIndex] = { ...nuevos[iIndex], cantidad_necesaria: valor };
    actualizarOpcion(gIndex, oIndex, { ingredientes: nuevos });
  };

  const handleQuitarIngrediente = (gIndex, oIndex, iIndex) => {
    const nuevos = (grupos[gIndex].opciones[oIndex].ingredientes || []).filter((_, i) => i !== iIndex);
    actualizarOpcion(gIndex, oIndex, { ingredientes: nuevos });
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await actualizarVariacionesProducto(plato.id, grupos);
      toast.success('Recetas de variaciones guardadas correctamente.');
      onCerrar();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudieron guardar las variaciones.');
    } finally {
      setGuardando(false);
    }
  };

  if (!plato) return null;

  const opcionEnEdicion = modalRecetaOpcion
    ? grupos[modalRecetaOpcion.gIndex]?.opciones[modalRecetaOpcion.oIndex]
    : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={[s.container, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bgCard} />

        {/* CABECERA */}
        <View style={[s.header, { backgroundColor: t.bgCard, borderBottomColor: t.border }]}>
          <View style={[s.headerIcono, { backgroundColor: `${t.color}15` }]}>
            <Icon name="list" size={18} color={t.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitulo, { color: t.textPrim }]} numberOfLines={1}>Variaciones: {plato.nombre}</Text>
            <Text style={[s.headerSub, { color: t.textMuted }]}>OPCIONES Y RECETA POR VARIANTE</Text>
          </View>
          <TouchableOpacity onPress={onCerrar} style={[s.closeBtn, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
            <Icon name="times" size={14} color={t.textSec} />
          </TouchableOpacity>
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color={t.color} style={{ marginTop: 60 }} />
        ) : (
          <>
            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
              {grupos.length === 0 ? (
                <View style={[s.emptyState, { borderColor: t.border2 }]}>
                  <Icon name="tags" size={24} color={t.textMuted} />
                  <Text style={{ color: t.textSec, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
                    Este plato no tiene grupos de variación.{'\n'}Añádelos primero al editarlo.
                  </Text>
                </View>
              ) : (
                grupos.map((grupo, gIndex) => (
                  <View key={grupo.id ?? gIndex} style={[s.grupoCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                    <Text style={[s.grupoTitulo, { color: t.color }]}>{grupo.nombre?.toUpperCase()}</Text>

                    {(grupo.opciones || []).map((opcion, oIndex) => (
                      <OpcionCard
                        key={opcion.id ?? oIndex}
                        opcion={opcion}
                        catalogo={catalogo}
                        t={t}
                        onCambiarNombre={(v) => actualizarOpcion(gIndex, oIndex, { nombre: v })}
                        onCambiarPrecio={(v) => actualizarOpcion(gIndex, oIndex, { precio_adicional: v })}
                        onCambiarModo={(modo) => handleCambiarModo(gIndex, oIndex, modo)}
                        onEliminar={() => handleEliminarOpcion(gIndex, oIndex)}
                        onAbrirReceta={() => setModalRecetaOpcion({ gIndex, oIndex })}
                        onAgregarInsumoUnidad={(insumo) => handleAgregarIngrediente(gIndex, oIndex, insumo)}
                        onCambiarCantidadUnidad={(v) => handleCambiarCantidadIngrediente(gIndex, oIndex, 0, v)}
                        onQuitarInsumoUnidad={() => handleQuitarIngrediente(gIndex, oIndex, 0)}
                      />
                    ))}
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[s.footer, { borderTopColor: t.border, backgroundColor: t.bgCard }]}>
              <TouchableOpacity
                style={[s.btnGuardar, { backgroundColor: t.color }, (guardando || grupos.length === 0) && { opacity: 0.6 }]}
                onPress={handleGuardar}
                disabled={guardando || grupos.length === 0}
                activeOpacity={0.8}
              >
                {guardando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Icon name="floppy-o" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={s.btnGuardarText}>GUARDAR RECETAS</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        {modalRecetaOpcion && opcionEnEdicion && (
          <ModalRecetaOpcion
            opcionNombre={opcionEnEdicion.nombre}
            catalogo={catalogo}
            ingredientes={opcionEnEdicion.ingredientes || []}
            onAgregar={(insumo) => handleAgregarIngrediente(modalRecetaOpcion.gIndex, modalRecetaOpcion.oIndex, insumo)}
            onCambiarCantidad={(iIndex, valor) => handleCambiarCantidadIngrediente(modalRecetaOpcion.gIndex, modalRecetaOpcion.oIndex, iIndex, valor)}
            onQuitar={(iIndex) => handleQuitarIngrediente(modalRecetaOpcion.gIndex, modalRecetaOpcion.oIndex, iIndex)}
            onCerrar={() => setModalRecetaOpcion(null)}
            t={t}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16, paddingBottom: 16, borderBottomWidth: 1 },
  headerIcono:  { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitulo: { fontSize: 16, fontWeight: '900' },
  headerSub:    { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  closeBtn:     { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  content:      { padding: 16, paddingBottom: 30 },
  emptyState:   { alignItems: 'center', justifyContent: 'center', padding: 30, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16 },
  grupoCard:    { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14 },
  grupoTitulo:  { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },

  footer:       { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1 },
  btnGuardar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16 },
  btnGuardarText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
