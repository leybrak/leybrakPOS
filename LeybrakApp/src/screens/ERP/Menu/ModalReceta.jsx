import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { getCatalogoGlobal, getReceta, guardarReceta } from '../../../api/api';
import { useToast } from '../../../context/ToastContext';
import SelectorInsumo from './SelectorInsumo';

export default function ModalReceta({ visible, plato, t, onCerrar }) {
  const toast = useToast();
  const [catalogo, setCatalogo] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    if (!plato) return;
    setCargando(true);
    try {
      const [resCatalogo, resReceta] = await Promise.all([
        getCatalogoGlobal(),
        getReceta(plato.id),
      ]);
      setCatalogo(Array.isArray(resCatalogo.data) ? resCatalogo.data : (resCatalogo.data.results ?? []));
      setIngredientes(resReceta.data);
    } catch (e) {
      console.error('Error cargando receta:', e);
      toast.error('No se pudo cargar la receta.');
    } finally {
      setCargando(false);
    }
  }, [plato, toast]);

  useEffect(() => { if (visible) cargar(); }, [visible, cargar]);

  const handleAgregar = (insumo) => {
    setIngredientes(prev => [...prev, {
      insumo_id: insumo.id,
      nombre: insumo.nombre,
      unidad: insumo.unidad_medida,
      cantidad_necesaria: 1,
    }]);
  };

  const handleCambiarCantidad = (idx, valor) => {
    setIngredientes(prev => prev.map((ing, i) => i === idx ? { ...ing, cantidad_necesaria: valor } : ing));
  };

  const handleQuitar = (idx) => setIngredientes(prev => prev.filter((_, i) => i !== idx));

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await guardarReceta(plato.id, { ingredientes });
      toast.success('Receta guardada correctamente.');
      onCerrar();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo guardar la receta.');
    } finally {
      setGuardando(false);
    }
  };

  if (!plato) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={[s.container, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bgCard} />

        {/* CABECERA */}
        <View style={[s.header, { backgroundColor: t.bgCard, borderBottomColor: t.border }]}>
          <View style={[s.headerIcono, { backgroundColor: `${t.color}15` }]}>
            <Icon name="book" size={18} color={t.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitulo, { color: t.textPrim }]} numberOfLines={1}>Receta: {plato.nombre}</Text>
            <Text style={[s.headerSub, { color: t.textMuted }]}>INSUMOS QUE CONSUME ESTE PLATO</Text>
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

              {/* BUSCADOR */}
              <Text style={[s.label, { color: t.textMuted }]}>CATÁLOGO DE INSUMOS ({catalogo.length})</Text>
              <SelectorInsumo
                catalogo={catalogo}
                agregados={ingredientes.map(i => i.insumo_id)}
                onAgregar={handleAgregar}
                t={t}
              />

              {/* CARRITO / RECETA */}
              <Text style={[s.label, { color: t.textMuted, marginTop: 24 }]}>
                COMPOSICIÓN DEL PLATO ({ingredientes.length})
              </Text>

              {ingredientes.length === 0 ? (
                <View style={[s.emptyState, { borderColor: t.border2 }]}>
                  <Icon name="shopping-basket" size={24} color={t.textMuted} />
                  <Text style={{ color: t.textSec, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
                    Aún no hay ingredientes.{'\n'}Elige insumos del buscador de arriba.
                  </Text>
                </View>
              ) : (
                ingredientes.map((ing, idx) => (
                  <View key={ing.insumo_id} style={[s.itemRow, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
                    <Text style={[s.itemNombre, { color: t.textPrim }]} numberOfLines={1}>{ing.nombre}</Text>
                    <TextInput
                      style={[s.itemCantInput, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
                      value={String(ing.cantidad_necesaria)}
                      onChangeText={v => handleCambiarCantidad(idx, v.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                    />
                    <Text style={[s.itemUnidad, { color: t.textMuted }]}>{ing.unidad}</Text>
                    <TouchableOpacity onPress={() => handleQuitar(idx)} style={{ padding: 6, marginLeft: 2 }}>
                      <Icon name="trash" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[s.footer, { borderTopColor: t.border, backgroundColor: t.bgCard }]}>
              <TouchableOpacity
                style={[s.btnGuardar, { backgroundColor: t.color }, guardando && { opacity: 0.6 }]}
                onPress={handleGuardar}
                disabled={guardando}
                activeOpacity={0.8}
              >
                {guardando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Icon name="floppy-o" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={s.btnGuardarText}>GUARDAR RECETA</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </>
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
  label:        { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  emptyState:   { alignItems: 'center', justifyContent: 'center', padding: 30, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16 },
  itemRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  itemNombre:   { fontSize: 13, fontWeight: '700', flex: 1 },
  itemCantInput:{ width: 60, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  itemUnidad:   { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', width: 30 },

  footer:       { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1 },
  btnGuardar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16 },
  btnGuardarText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
