import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';

export default function ModalPlato({ visible, plato, categorias, t, onGuardar, onCerrar }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [paso, setPaso]           = useState(1);
  const [form, setForm]           = useState({});
  const [guardando, setGuardando] = useState(false);
  const [catOpen, setCatOpen]     = useState(false);

  useEffect(() => {
    if (visible) {
      setPaso(1);
      setCatOpen(false);
      setForm({
        id:                 plato?.id || null,
        nombre:             plato?.nombre || '',
        precio_base:        plato?.precio_base ? String(plato.precio_base) : '',
        categoria_id:       plato?.categoria || '',
        es_venta_rapida:    plato?.es_venta_rapida    || false,
        requiere_seleccion: plato?.requiere_seleccion || false,
        tiene_variaciones:  plato?.tiene_variaciones  || false,
        grupos_variacion:   plato?.grupos_variacion   || [],
      });
    }
  }, [visible, plato]);

  const catSeleccionada = categorias.find(c => String(c.id) === String(form.categoria_id));

  const handleGuardar = async () => {
    if (!form.nombre.trim()) {
      toast.warning('El nombre del plato es obligatorio.');
      return;
    }
    if (!form.requiere_seleccion && !form.tiene_variaciones && !form.precio_base) {
      toast.warning('El precio es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar(form);
      toast.success(form.id ? 'Plato actualizado correctamente.' : 'Plato creado correctamente.');
      onCerrar();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar el plato.');
    } finally {
      setGuardando(false);
    }
  };

  const irAPaso2 = () => {
    if (form.grupos_variacion.length === 0) {
      setForm({
        ...form,
        grupos_variacion: [{
          nombre: 'Opciones',
          obligatorio: form.requiere_seleccion,
          seleccion_multiple: false,
          opciones: [],
        }],
      });
    }
    setPaso(2);
  };

  // ─── Helpers grupos ───────────────────────────────────────
  const agregarGrupo = () => {
    setForm({
      ...form,
      grupos_variacion: [
        ...form.grupos_variacion,
        { nombre: 'Nuevo Grupo', obligatorio: false, seleccion_multiple: true, opciones: [] },
      ],
    });
  };

  const eliminarGrupo = async (gi) => {
    const ok = await confirmar('¿Eliminar este grupo?');
    if (!ok) return;
    setForm({ ...form, grupos_variacion: form.grupos_variacion.filter((_, i) => i !== gi) });
  };

  const actualizarGrupo = (gi, campo, valor) => {
    const grupos = [...form.grupos_variacion];
    grupos[gi] = { ...grupos[gi], [campo]: valor };
    setForm({ ...form, grupos_variacion: grupos });
  };

  const agregarOpcion = (gi) => {
    const grupos = [...form.grupos_variacion];
    grupos[gi].opciones = [...grupos[gi].opciones, { nombre: '', precio_adicional: '' }];
    setForm({ ...form, grupos_variacion: grupos });
  };

  const eliminarOpcion = (gi, oi) => {
    const grupos = [...form.grupos_variacion];
    grupos[gi].opciones = grupos[gi].opciones.filter((_, i) => i !== oi);
    setForm({ ...form, grupos_variacion: grupos });
  };

  const actualizarOpcion = (gi, oi, campo, valor) => {
    const grupos = [...form.grupos_variacion];
    grupos[gi].opciones[oi] = { ...grupos[gi].opciones[oi], [campo]: valor };
    setForm({ ...form, grupos_variacion: grupos });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={s.overlay}>
        <View style={[s.modal, { backgroundColor: t.bgCard, borderColor: t.border }]}>

          {/* Header */}
          <View style={[s.header, { borderBottomColor: t.border, backgroundColor: t.bgCard2 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {paso === 2 && (
                <TouchableOpacity
                  onPress={() => setPaso(1)}
                  style={[s.backBtn, { backgroundColor: t.bgCard, borderColor: t.border }]}
                >
                  <Icon name="arrow-left" size={14} color={t.textSec} />
                </TouchableOpacity>
              )}
              <View style={[s.headerIcono, { backgroundColor: `${t.color}15` }]}>
                <Icon name="cutlery" size={16} color={t.color} />
              </View>
              <View>
                <Text style={[s.titulo, { color: t.textPrim }]}>
                  {form.id ? 'Editar Plato' : 'Nuevo Plato'}
                </Text>
                {paso === 2 && (
                  <Text style={[s.subtitulo, { color: t.color }]}>Paso 2 — Opciones y Precios</Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={onCerrar}
              style={[s.closeBtn, { backgroundColor: t.bgCard, borderColor: t.border }]}
            >
              <Icon name="times" size={14} color={t.textSec} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={s.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── PASO 1: Datos básicos ── */}
            {paso === 1 && (
              <View style={{ gap: 16 }}>

                {/* Nombre */}
                <View>
                  <Text style={[s.label, { color: t.textMuted }]}>NOMBRE DEL PLATO</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
                    value={form.nombre}
                    onChangeText={v => setForm({ ...form, nombre: v })}
                    placeholder="Ej. Pizza Hawaiana"
                    placeholderTextColor={t.textMuted}
                  />
                </View>

                {/* Precio */}
                <View>
                  <Text style={[s.label, { color: t.textMuted }]}>PRECIO BASE (S/)</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim },
                      form.requiere_seleccion && { opacity: 0.4 }]}
                    value={form.precio_base}
                    onChangeText={v => setForm({ ...form, precio_base: v })}
                    placeholder="0.00"
                    placeholderTextColor={t.textMuted}
                    keyboardType="decimal-pad"
                    editable={!form.requiere_seleccion}
                  />
                </View>

                {/* Categoría */}
                <View>
                  <Text style={[s.label, { color: t.textMuted }]}>CATEGORÍA</Text>
                  <TouchableOpacity
                    style={[s.input, { backgroundColor: t.bgInput, borderColor: t.border2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    onPress={() => setCatOpen(!catOpen)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: catSeleccionada ? t.textPrim : t.textMuted, fontSize: 14, fontWeight: '600' }}>
                      {catSeleccionada?.nombre || 'Seleccionar categoría...'}
                    </Text>
                    <Icon name={catOpen ? 'chevron-up' : 'chevron-down'} size={12} color={t.textMuted} />
                  </TouchableOpacity>
                  {catOpen && (
                    <View style={[s.dropdown, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                      <TouchableOpacity
                        style={[s.dropdownItem, { borderBottomColor: t.border }]}
                        onPress={() => { setForm({ ...form, categoria_id: '' }); setCatOpen(false); }}
                      >
                        <Text style={[s.dropdownText, { color: t.textSec }]}>Sin categoría</Text>
                      </TouchableOpacity>
                      {categorias.map(cat => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[s.dropdownItem, { borderBottomColor: t.border },
                            String(form.categoria_id) === String(cat.id) && { backgroundColor: `${t.color}15` }]}
                          onPress={() => { setForm({ ...form, categoria_id: cat.id }); setCatOpen(false); }}
                        >
                          <Text style={[s.dropdownText, {
                            color: String(form.categoria_id) === String(cat.id) ? t.color : t.textPrim,
                            fontWeight: String(form.categoria_id) === String(cat.id) ? '800' : '600',
                          }]}>
                            {cat.nombre}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Comportamiento en POS */}
                <View style={[s.switchCard, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
                  <Text style={[s.switchCardTitulo, { color: t.textPrim, borderBottomColor: t.border }]}>
                    Comportamiento en POS
                  </Text>

                  {/* Venta Rápida */}
                  <View style={[s.switchRow, { opacity: form.tiene_variaciones ? 0.4 : 1 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.switchLabel, { color: t.textPrim }]}>Venta Rápida</Text>
                      <Text style={[s.switchDesc, { color: t.textSec }]}>Sin ventanas extra. Directo al carrito.</Text>
                    </View>
                    <Switch
                      value={form.es_venta_rapida}
                      onValueChange={v => setForm({ ...form, es_venta_rapida: v })}
                      disabled={form.tiene_variaciones}
                      trackColor={{ false: t.border2, true: `${t.color}50` }}
                      thumbColor={form.es_venta_rapida ? t.color : t.textMuted}
                    />
                  </View>

                  {/* Requiere Selección */}
                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.switchLabel, { color: t.textPrim }]}>Requiere Selección</Text>
                      <Text style={[s.switchDesc, { color: t.textSec }]}>Ej. Personal o Familiar. Obliga a elegir.</Text>
                    </View>
                    <Switch
                      value={form.requiere_seleccion}
                      onValueChange={v => setForm({
                        ...form,
                        requiere_seleccion: v,
                        tiene_variaciones: v ? false : form.tiene_variaciones,
                        precio_base: v ? '0.00' : form.precio_base,
                      })}
                      trackColor={{ false: t.border2, true: `${t.color}50` }}
                      thumbColor={form.requiere_seleccion ? t.color : t.textMuted}
                    />
                  </View>

                  {/* Tiene Variaciones */}
                  <View style={s.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.switchLabel, { color: t.textPrim }]}>Tiene Variaciones</Text>
                      <Text style={[s.switchDesc, { color: t.textSec }]}>Ej. Extra Queso. Opcionales al agregar.</Text>
                    </View>
                    <Switch
                      value={form.tiene_variaciones}
                      onValueChange={v => setForm({
                        ...form,
                        tiene_variaciones: v,
                        requiere_seleccion: v ? false : form.requiere_seleccion,
                        es_venta_rapida: v ? false : form.es_venta_rapida,
                      })}
                      trackColor={{ false: t.border2, true: `${t.color}50` }}
                      thumbColor={form.tiene_variaciones ? t.color : t.textMuted}
                    />
                  </View>
                </View>

                {/* Botón paso 1 */}
                {(form.requiere_seleccion || form.tiene_variaciones) ? (
                  <TouchableOpacity
                    style={[s.btnPrimario, { backgroundColor: '#2463EB' }]}
                    onPress={irAPaso2}
                    activeOpacity={0.8}
                  >
                    <Text style={s.btnPrimarioText}>
                      {form.id ? 'EDITAR OPCIONES →' : 'SIGUIENTE: DEFINIR OPCIONES →'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[s.btnPrimario, { backgroundColor: t.color },
                      (!form.nombre || !form.precio_base) && { opacity: 0.5 }]}
                    onPress={handleGuardar}
                    disabled={!form.nombre || !form.precio_base || guardando}
                    activeOpacity={0.8}
                  >
                    {guardando
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.btnPrimarioText}>{form.id ? 'GUARDAR CAMBIOS' : 'CREAR PLATO'}</Text>
                    }
                  </TouchableOpacity>
                )}

              </View>
            )}

            {/* ── PASO 2: Grupos de opciones ── */}
            {paso === 2 && (
              <View style={{ gap: 16 }}>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[s.seccionTitulo, { color: t.textPrim }]}>Grupos de Opciones</Text>
                  <TouchableOpacity
                    style={[s.btnSecundario, { backgroundColor: `${t.color}15`, borderColor: `${t.color}30` }]}
                    onPress={agregarGrupo}
                    activeOpacity={0.8}
                  >
                    <Icon name="plus" size={12} color={t.color} style={{ marginRight: 6 }} />
                    <Text style={[s.btnSecundarioText, { color: t.color }]}>Añadir Grupo</Text>
                  </TouchableOpacity>
                </View>

                {form.grupos_variacion.map((grupo, gi) => (
                  <View key={gi} style={[s.grupoCard, { backgroundColor: t.bgCard2, borderColor: t.border }]}>

                    {/* Header grupo */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <TextInput
                        style={[s.grupoNombreInput, { backgroundColor: t.bgInput, borderColor: `${t.color}50`, color: t.textPrim, flex: 1 }]}
                        value={grupo.nombre}
                        onChangeText={v => actualizarGrupo(gi, 'nombre', v)}
                        placeholder="Nombre del grupo"
                        placeholderTextColor={t.textMuted}
                      />
                      <TouchableOpacity
                        onPress={() => eliminarGrupo(gi)}
                        style={[s.btnEliminar, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}
                      >
                        <Icon name="trash" size={13} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <View style={[s.divider, { backgroundColor: t.border }]} />

                    {/* Opciones */}
                    <View style={{ gap: 8, marginTop: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={[s.label, { color: t.textMuted }]}>OPCIONES Y PRECIOS (+S/)</Text>
                        <TouchableOpacity onPress={() => agregarOpcion(gi)}>
                          <Text style={[{ color: t.color, fontSize: 12, fontWeight: '800' }]}>+ Añadir</Text>
                        </TouchableOpacity>
                      </View>

                      {grupo.opciones.length === 0 ? (
                        <Text style={[{ color: t.textMuted, fontSize: 12, fontStyle: 'italic' }]}>
                          Añade opciones para este grupo.
                        </Text>
                      ) : (
                        grupo.opciones.map((opcion, oi) => (
                          <View key={oi} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                            <TextInput
                              style={[s.input, { flex: 1, backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
                              value={opcion.nombre}
                              onChangeText={v => actualizarOpcion(gi, oi, 'nombre', v)}
                              placeholder="Ej. Sin Cebolla"
                              placeholderTextColor={t.textMuted}
                            />
                            <TextInput
                              style={[s.input, { width: 80, backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim, textAlign: 'right' }]}
                              value={String(opcion.precio_adicional)}
                              onChangeText={v => actualizarOpcion(gi, oi, 'precio_adicional', v)}
                              placeholder="0.00"
                              placeholderTextColor={t.textMuted}
                              keyboardType="decimal-pad"
                            />
                            <TouchableOpacity
                              style={[s.btnEliminar, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}
                              onPress={() => eliminarOpcion(gi, oi)}
                            >
                              <Icon name="times" size={12} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                    </View>

                  </View>
                ))}

                {/* Botón guardar paso 2 */}
                <TouchableOpacity
                  style={[s.btnPrimario, { backgroundColor: t.color }, guardando && { opacity: 0.6 }]}
                  onPress={handleGuardar}
                  disabled={guardando}
                  activeOpacity={0.8}
                >
                  {guardando
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.btnPrimarioText}>{form.id ? 'GUARDAR CAMBIOS' : 'CREAR PLATO'}</Text>
                  }
                </TouchableOpacity>

              </View>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:            { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, maxHeight: '92%' },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  titulo:           { fontSize: 18, fontWeight: '900' },
  subtitulo:        { fontSize: 11, fontWeight: '700', marginTop: 2 },
  backBtn:          { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerIcono:      { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closeBtn:         { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  body:             { padding: 20, paddingBottom: 40 },

  label:            { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  input:            { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, fontWeight: '600' },
  dropdown:         { borderWidth: 1, borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  dropdownItem:     { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1 },
  dropdownText:     { fontSize: 14 },

  switchCard:       { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  switchCardTitulo: { fontSize: 14, fontWeight: '800', padding: 14, borderBottomWidth: 1 },
  switchRow:        { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  switchLabel:      { fontSize: 13, fontWeight: '700' },
  switchDesc:       { fontSize: 11, marginTop: 2 },

  btnPrimario:      { borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnPrimarioText:  { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },

  seccionTitulo:    { fontSize: 16, fontWeight: '900' },
  btnSecundario:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  btnSecundarioText:{ fontSize: 12, fontWeight: '800' },

  grupoCard:        { borderRadius: 16, borderWidth: 1, padding: 16 },
  grupoNombreInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '700' },
  btnEliminar:      { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  divider:          { height: 1 },
});