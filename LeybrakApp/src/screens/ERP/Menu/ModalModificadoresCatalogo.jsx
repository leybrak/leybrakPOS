import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, FlatList, ScrollView, ActivityIndicator, StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import { getModificadores, crearModificador, actualizarModificador, eliminarModificador } from '../../../api/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';

export default function ModalModificadoresCatalogo({ visible, categorias = [], t, onCerrar }) {
  const toast = useToast();
  const confirmar = useConfirm();

  const [modificadores, setModificadores] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [vista, setVista] = useState('lista'); // 'lista' | 'formulario'
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState({ nombre: '', precio: '', categorias_aplicables: [] });

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const negocioId = await EncryptedStorage.getItem('negocio_id');
      const res = await getModificadores({ negocio_id: negocioId });
      setModificadores(res.data || []);
    } catch (e) {
      console.error('Error cargando modificadores:', e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (visible) { cargar(); setVista('lista'); setEditando(null); setBusqueda(''); }
  }, [visible, cargar]);

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ nombre: '', precio: '', categorias_aplicables: [] });
    setVista('formulario');
  };

  const abrirEdicion = (mod) => {
    setEditando(mod);
    setForm({
      nombre: mod.nombre,
      precio: mod.precio != null ? String(mod.precio) : '',
      categorias_aplicables: mod.categorias_aplicables || [],
    });
    setVista('formulario');
  };

  const toggleCategoria = (catId) => {
    setForm(f => ({
      ...f,
      categorias_aplicables: f.categorias_aplicables.includes(catId)
        ? f.categorias_aplicables.filter(id => id !== catId)
        : [...f.categorias_aplicables, catId],
    }));
  };

  const handleGuardar = async () => {
    if (!form.nombre.trim()) return toast.warning('El nombre del modificador es obligatorio.');
    if (form.categorias_aplicables.length === 0) return toast.warning('Debes seleccionar al menos una categoría.');
    const precioTexto = form.precio.trim() === '' ? '0.00' : form.precio;
    const precioNum = parseFloat(precioTexto);
    if (isNaN(precioNum) || precioNum < 0) return toast.warning('El precio debe ser un número válido mayor o igual a 0.');

    setGuardando(true);
    try {
      const negocioId = await EncryptedStorage.getItem('negocio_id');
      const payload = {
        nombre: form.nombre.trim(),
        precio: precioNum.toFixed(2),
        categorias_aplicables: form.categorias_aplicables,
        negocio: negocioId,
      };
      if (editando) await actualizarModificador(editando.id, payload);
      else await crearModificador(payload);
      toast.success(editando ? 'Modificador actualizado correctamente.' : 'Modificador creado correctamente.');
      await cargar();
      setVista('lista');
      setEditando(null);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Error al guardar el modificador.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (mod) => {
    const ok = await confirmar(`¿Eliminar el modificador "${mod.nombre}"?`);
    if (!ok) return;
    try {
      await eliminarModificador(mod.id);
      toast.success('Modificador eliminado.');
      await cargar();
    } catch (e) {
      toast.error('No se pudo eliminar el modificador.');
    }
  };

  const modificadoresFiltrados = modificadores.filter(m => m.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={[st.overlay, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />

        {/* CABECERA */}
        <View style={[st.header, { borderBottomColor: t.border, backgroundColor: t.bgCard2 }]}>
          <View style={st.headerLeft}>
            {vista === 'formulario' && (
              <TouchableOpacity
                onPress={() => { setVista('lista'); setEditando(null); }}
                style={[st.backBtn, { backgroundColor: t.bgCard, borderColor: t.border }]}
              >
                <Icon name="angle-left" size={16} color={t.textSec} />
              </TouchableOpacity>
            )}
            <View style={[st.headerIcono, { backgroundColor: `${t.color}15` }]}>
              <Icon name="sliders" size={18} color={t.color} />
            </View>
            <View>
              <Text style={[st.titulo, { color: t.textPrim }]}>Modificadores Rápidos</Text>
              <Text style={[st.subtitulo, { color: t.textMuted }]}>Extras por categoría</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onCerrar} style={[st.closeBtn, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Icon name="times" size={14} color={t.textSec} />
          </TouchableOpacity>
        </View>

        {vista === 'lista' ? (
          <>
            <View style={st.listaHeader}>
              <Text style={[st.contadorTxt, { color: t.textMuted }]}>Existentes ({modificadores.length})</Text>
              <TouchableOpacity onPress={abrirNuevo} style={[st.btnNuevo, { backgroundColor: t.color }]} activeOpacity={0.85}>
                <Icon name="plus" size={11} color="#fff" style={{ marginRight: 5 }} />
                <Text style={st.btnNuevoTxt}>Nuevo</Text>
              </TouchableOpacity>
            </View>

            {modificadores.length > 0 && (
              <View style={[st.buscadorBox, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                <Icon name="search" size={12} color={t.textMuted} />
                <TextInput
                  style={[st.buscadorInput, { color: t.textPrim }]}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar modificador..."
                  placeholderTextColor={t.textMuted}
                />
              </View>
            )}

            {cargando ? (
              <ActivityIndicator size="large" color={t.color} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={modificadoresFiltrados}
                keyExtractor={item => String(item.id)}
                contentContainerStyle={st.lista}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={[st.emptyState, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                    <Icon name="sliders" size={32} color={t.textMuted} />
                    <Text style={[st.emptyTitulo, { color: t.textPrim }]}>
                      {modificadores.length === 0 ? 'Aún no hay modificadores' : `Sin resultados para "${busqueda}"`}
                    </Text>
                    {modificadores.length === 0 && (
                      <Text style={[st.emptyDesc, { color: t.textSec }]}>Crea el primero con el botón "Nuevo"</Text>
                    )}
                  </View>
                }
                renderItem={({ item: mod }) => (
                  <TouchableOpacity
                    style={[st.modRow, { backgroundColor: t.bgCard, borderColor: t.border }]}
                    onPress={() => abrirEdicion(mod)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[st.modNombre, { color: t.textPrim }]} numberOfLines={1}>{mod.nombre}</Text>
                      <Text style={[st.modCatCount, { color: t.textMuted }]}>
                        {(mod.categorias_aplicables || []).length} categoría{(mod.categorias_aplicables || []).length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={[st.modPrecio, { color: t.color }]}>+S/ {parseFloat(mod.precio || 0).toFixed(2)}</Text>
                    <TouchableOpacity
                      style={st.deleteBtn}
                      onPress={() => handleEliminar(mod)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Icon name="trash" size={13} color="#ef4444" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        ) : (
          <ScrollView contentContainerStyle={st.formBody} showsVerticalScrollIndicator={false}>
            <Text style={[st.label, { color: t.textMuted }]}>Nombre del Extra *</Text>
            <TextInput
              style={[st.input, { backgroundColor: t.bgCard, borderColor: t.border2, color: t.textPrim }]}
              value={form.nombre}
              onChangeText={(v) => setForm(f => ({ ...f, nombre: v }))}
              placeholder="Ej. Sin Cebolla, Extra Queso..."
              placeholderTextColor={t.textMuted}
            />

            <Text style={[st.label, { color: t.textMuted, marginTop: 18 }]}>Precio Adicional (S/)</Text>
            <TextInput
              style={[st.inputPrecio, { backgroundColor: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.2)', color: '#10b981' }]}
              value={form.precio}
              onChangeText={(v) => setForm(f => ({ ...f, precio: v }))}
              placeholder="0.00"
              placeholderTextColor="rgba(16,185,129,0.35)"
              keyboardType="decimal-pad"
            />
            <Text style={[st.hint, { color: t.textMuted }]}>Si dejas vacío, se guardará como S/ 0.00 (sin costo adicional)</Text>

            <Text style={[st.label, { color: t.textMuted, marginTop: 18 }]}>¿A qué categorías aplica? *</Text>
            {categorias.length === 0 ? (
              <View style={[st.warnBox, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                <Text style={[st.warnTxt, { color: t.textSec }]}>
                  No hay categorías disponibles. Crea categorías primero en el menú.
                </Text>
              </View>
            ) : (
              <View style={st.catGrid}>
                {categorias.map(cat => {
                  const activo = form.categorias_aplicables.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        st.catChip,
                        { backgroundColor: t.bgCard, borderColor: t.border2 },
                        activo && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
                      ]}
                      onPress={() => toggleCategoria(cat.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[st.catChipTxt, { color: activo ? '#fff' : t.textSec }]}>{cat.nombre}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[st.btnGuardar, { backgroundColor: t.color }, guardando && { opacity: 0.6 }]}
              onPress={handleGuardar}
              disabled={guardando}
              activeOpacity={0.85}
            >
              {guardando ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Icon name={editando ? 'floppy-o' : 'plus'} size={13} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={st.btnGuardarTxt}>{editando ? 'Guardar Cambios' : 'Crear Modificador'}</Text>
                </>
              )}
            </TouchableOpacity>

            {editando && (
              <TouchableOpacity
                style={[st.btnCancelar, { backgroundColor: t.bgCard2, borderColor: t.border }]}
                onPress={() => { setVista('lista'); setEditando(null); }}
                activeOpacity={0.85}
              >
                <Text style={[st.btnCancelarTxt, { color: t.textSec }]}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, paddingTop: StatusBar.currentHeight || 24 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  backBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerIcono: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 16, fontWeight: '900' },
  subtitulo: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  listaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  contadorTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  btnNuevo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  btnNuevoTxt: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  buscadorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 18, marginBottom: 12 },
  buscadorInput: { flex: 1, fontSize: 13, fontWeight: '600', padding: 0 },

  lista: { paddingHorizontal: 18, paddingBottom: 30 },
  modRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 8 },
  modNombre: { fontSize: 14, fontWeight: '800' },
  modCatCount: { fontSize: 10, fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },
  modPrecio: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  deleteBtn: { padding: 6 },

  emptyState: { borderRadius: 20, padding: 32, alignItems: 'center', borderWidth: 1, gap: 6, marginTop: 20 },
  emptyTitulo: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  emptyDesc: { fontSize: 12, textAlign: 'center' },

  formBody: { padding: 18, paddingBottom: 40 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: '700' },
  inputPrecio: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16, fontSize: 20, fontWeight: '900' },
  hint: { fontSize: 10, marginTop: 8, lineHeight: 15 },

  warnBox: { borderWidth: 1, borderRadius: 14, padding: 14 },
  warnTxt: { fontSize: 11, lineHeight: 16 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  catChipTxt: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  btnGuardar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16, marginTop: 28 },
  btnGuardarTxt: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  btnCancelar: { alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, paddingVertical: 14, marginTop: 10 },
  btnCancelarTxt: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
});
