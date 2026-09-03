import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Alert, StatusBar, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { getCatalogoGlobal, actualizarVariacionesProducto } from '../../../api/api';
import SelectorInsumo from './SelectorInsumo';

export default function ModalVariaciones({ visible, plato, t, onCerrar }) {
  const [catalogo, setCatalogo] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [destino, setDestino] = useState(null); // { gIndex, oIndex } — dónde añadir el próximo insumo

  const cargar = useCallback(async () => {
    if (!plato) return;
    setCargando(true);
    try {
      const resCatalogo = await getCatalogoGlobal();
      setCatalogo(Array.isArray(resCatalogo.data) ? resCatalogo.data : (resCatalogo.data.results ?? []));
      setGrupos(plato.grupos_variacion ? JSON.parse(JSON.stringify(plato.grupos_variacion)) : []);
    } catch (e) {
      console.error('Error cargando variaciones:', e);
      Alert.alert('Error', 'No se pudo cargar el catálogo.');
    } finally {
      setCargando(false);
    }
  }, [plato]);

  useEffect(() => { if (visible) cargar(); }, [visible, cargar]);

  const handleEliminarIngrediente = (gIndex, oIndex, iIndex) => {
    setGrupos(prev => {
      const copia = [...prev];
      copia[gIndex] = { ...copia[gIndex], opciones: [...copia[gIndex].opciones] };
      copia[gIndex].opciones[oIndex] = {
        ...copia[gIndex].opciones[oIndex],
        ingredientes: copia[gIndex].opciones[oIndex].ingredientes.filter((_, i) => i !== iIndex),
      };
      return copia;
    });
  };

  const handleAgregarIngrediente = (insumo, cantidad) => {
    if (!destino) return;
    const { gIndex, oIndex } = destino;
    setGrupos(prev => {
      const copia = [...prev];
      copia[gIndex] = { ...copia[gIndex], opciones: [...copia[gIndex].opciones] };
      const opcion = copia[gIndex].opciones[oIndex];
      copia[gIndex].opciones[oIndex] = {
        ...opcion,
        ingredientes: [...(opcion.ingredientes || []), {
          insumo: insumo.id,
          nombre_insumo: insumo.nombre,
          unidad_medida: insumo.unidad_medida,
          cantidad_necesaria: cantidad,
        }],
      };
      return copia;
    });
    setDestino(null);
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await actualizarVariacionesProducto(plato.id, grupos);
      onCerrar();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudieron guardar las variaciones.');
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
            <Text style={[s.headerTitulo, { color: t.textPrim }]} numberOfLines={1}>Variaciones: {plato.nombre}</Text>
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
                      <View key={opcion.id ?? oIndex} style={[s.opcionCard, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
                        <Text style={[s.opcionNombre, { color: t.textPrim }]}>● {opcion.nombre}</Text>

                        {(opcion.ingredientes || []).length === 0 ? (
                          <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: '600', marginVertical: 6 }}>
                            Sin insumos asignados.
                          </Text>
                        ) : (
                          opcion.ingredientes.map((ing, iIndex) => (
                            <View key={iIndex} style={[s.ingRow, { borderColor: t.border }]}>
                              <Text style={[s.ingNombre, { color: t.textSec }]} numberOfLines={1}>{ing.nombre_insumo}</Text>
                              <Text style={[s.ingCantidad, { color: t.color }]}>
                                {ing.cantidad_necesaria} <Text style={{ color: t.textMuted, fontWeight: '600' }}>{ing.unidad_medida}</Text>
                              </Text>
                              <TouchableOpacity onPress={() => handleEliminarIngrediente(gIndex, oIndex, iIndex)} style={{ padding: 6 }}>
                                <Icon name="times" size={13} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          ))
                        )}

                        <TouchableOpacity
                          style={[s.btnAnadirIns, { borderColor: t.border2 }]}
                          onPress={() => setDestino({ gIndex, oIndex })}
                          activeOpacity={0.8}
                        >
                          <Icon name="plus" size={10} color={t.textSec} style={{ marginRight: 6 }} />
                          <Text style={{ color: t.textSec, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>AÑADIR INSUMO</Text>
                        </TouchableOpacity>
                      </View>
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
                      <Icon name="save" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={s.btnGuardarText}>GUARDAR RECETAS</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </>
        )}

        <SelectorInsumo
          visible={!!destino}
          catalogo={catalogo}
          t={t}
          onAgregar={handleAgregarIngrediente}
          onCerrar={() => setDestino(null)}
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
  emptyState:   { alignItems: 'center', justifyContent: 'center', padding: 30, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16 },
  grupoCard:    { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14 },
  grupoTitulo:  { fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
  opcionCard:   { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10 },
  opcionNombre: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  ingRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderStyle: 'dashed' },
  ingNombre:    { fontSize: 12, fontWeight: '600', flex: 1 },
  ingCantidad:  { fontSize: 12, fontWeight: '900' },
  btnAnadirIns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', marginTop: 8 },
  footer:       { padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, borderTopWidth: 1 },
  btnGuardar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16 },
  btnGuardarText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
