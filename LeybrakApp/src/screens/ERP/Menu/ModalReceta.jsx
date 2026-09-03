import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Alert, StatusBar, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { getCatalogoGlobal, getReceta, guardarReceta } from '../../../api/api';
import SelectorInsumo from './SelectorInsumo';

export default function ModalReceta({ visible, plato, t, onCerrar }) {
  const [catalogo, setCatalogo] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [selectorVisible, setSelectorVisible] = useState(false);

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
      Alert.alert('Error', 'No se pudo cargar la receta.');
    } finally {
      setCargando(false);
    }
  }, [plato]);

  useEffect(() => { if (visible) cargar(); }, [visible, cargar]);

  const handleAgregar = (insumo, cantidad) => {
    setIngredientes(prev => [...prev, {
      insumo_id: insumo.id,
      nombre: insumo.nombre,
      unidad: insumo.unidad_medida,
      cantidad_necesaria: cantidad,
    }]);
  };

  const handleQuitar = (idx) => setIngredientes(prev => prev.filter((_, i) => i !== idx));

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await guardarReceta(plato.id, { ingredientes });
      onCerrar();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar la receta.');
    } finally {
      setGuardando(false);
    }
  };

  if (!plato) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar}>
      <View style={[s.container, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bgCard} />

        <View style={[s.header, { backgroundColor: t.bgCard, borderBottomColor: t.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerSub, { color: t.textMuted }]}>INGENIERÍA DE MENÚ</Text>
            <Text style={[s.headerTitulo, { color: t.textPrim }]} numberOfLines={1}>Receta: {plato.nombre}</Text>
          </View>
          <TouchableOpacity onPress={onCerrar} style={{ padding: 6 }}>
            <Icon name="times" size={22} color={t.textSec} />
          </TouchableOpacity>
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color={t.color} style={{ marginTop: 60 }} />
        ) : (
          <>
            <ScrollView contentContainerStyle={s.content}>
              <TouchableOpacity
                style={[s.btnAnadir, { backgroundColor: t.bgCard2, borderColor: t.border2 }]}
                onPress={() => setSelectorVisible(true)}
                activeOpacity={0.8}
              >
                <Icon name="plus" size={12} color={t.color} style={{ marginRight: 8 }} />
                <Text style={[s.btnAnadirText, { color: t.color }]}>AÑADIR INSUMO</Text>
              </TouchableOpacity>

              <Text style={[s.label, { color: t.textMuted }]}>
                COMPOSICIÓN DEL PLATO ({ingredientes.length})
              </Text>

              {ingredientes.length === 0 ? (
                <View style={[s.emptyState, { borderColor: t.border2 }]}>
                  <Icon name="cutlery" size={24} color={t.textMuted} />
                  <Text style={{ color: t.textSec, fontSize: 12, fontWeight: '600', marginTop: 8 }}>
                    Aún no hay ingredientes.
                  </Text>
                </View>
              ) : (
                ingredientes.map((ing, idx) => (
                  <View key={idx} style={[s.itemRow, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
                    <Text style={[s.itemNombre, { color: t.textPrim }]} numberOfLines={1}>{ing.nombre}</Text>
                    <Text style={[s.itemCantidad, { color: t.color }]}>
                      {ing.cantidad_necesaria} <Text style={{ color: t.textMuted, fontWeight: '600' }}>{ing.unidad}</Text>
                    </Text>
                    <TouchableOpacity onPress={() => handleQuitar(idx)} style={{ padding: 8, marginLeft: 4 }}>
                      <Icon name="trash" size={15} color="#ef4444" />
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
                      <Icon name="save" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={s.btnGuardarText}>GUARDAR RECETA</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        <SelectorInsumo
          visible={selectorVisible}
          catalogo={catalogo}
          t={t}
          onAgregar={handleAgregar}
          onCerrar={() => setSelectorVisible(false)}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16, paddingBottom: 16, borderBottomWidth: 1 },
  headerSub:    { fontSize: 9, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  headerTitulo: { fontSize: 18, fontWeight: '900' },
  content:      { padding: 16, paddingBottom: 30 },
  btnAnadir:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  btnAnadirText:{ fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  label:        { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  emptyState:   { alignItems: 'center', justifyContent: 'center', padding: 30, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16 },
  itemRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  itemNombre:   { fontSize: 14, fontWeight: '700', flex: 1 },
  itemCantidad: { fontSize: 14, fontWeight: '900' },
  footer:       { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1 },
  btnGuardar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16 },
  btnGuardarText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
