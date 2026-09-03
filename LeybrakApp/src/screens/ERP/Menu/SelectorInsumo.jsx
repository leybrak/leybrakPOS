import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

// ─── Paso 2: cantidad del insumo elegido ───────────────────────
function PasoCantidad({ insumo, t, onConfirmar, onVolver }) {
  const [cantidad, setCantidad] = useState('');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={sp.paso}>
        <TouchableOpacity onPress={onVolver} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Icon name="chevron-left" size={12} color={t.textSec} style={{ marginRight: 6 }} />
          <Text style={{ color: t.textSec, fontSize: 12, fontWeight: '700' }}>Elegir otro insumo</Text>
        </TouchableOpacity>

        <Text style={[sp.insumoNombre, { color: t.textPrim }]}>{insumo.nombre}</Text>
        <Text style={[sp.label, { color: t.textMuted }]}>CANTIDAD NECESARIA ({insumo.unidad_medida})</Text>
        <TextInput
          style={[sp.input, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
          value={cantidad}
          onChangeText={v => setCantidad(v.replace(/[^0-9.]/g, ''))}
          placeholder="0.00"
          placeholderTextColor={t.textMuted}
          keyboardType="decimal-pad"
          autoFocus
        />

        <TouchableOpacity
          style={[sp.btnConfirmar, { backgroundColor: t.color }, !(parseFloat(cantidad) > 0) && { opacity: 0.4 }]}
          onPress={() => parseFloat(cantidad) > 0 && onConfirmar(parseFloat(cantidad))}
          disabled={!(parseFloat(cantidad) > 0)}
          activeOpacity={0.8}
        >
          <Text style={sp.btnConfirmarText}>AGREGAR A LA RECETA</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const sp = StyleSheet.create({
  paso:            { padding: 20 },
  insumoNombre:    { fontSize: 18, fontWeight: '900', marginBottom: 16 },
  label:           { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  input:           { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '600', marginBottom: 20 },
  btnConfirmar:    { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  btnConfirmarText:{ color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});

// ─── Modal selector de insumo del catálogo ─────────────────────
export default function SelectorInsumo({ visible, catalogo, t, onAgregar, onCerrar }) {
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState(null);

  useEffect(() => {
    if (visible) { setBusqueda(''); setElegido(null); }
  }, [visible]);

  const filtrados = catalogo.filter(i => i.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={si.overlay}>
        <View style={[si.modal, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={[si.header, { borderBottomColor: t.border }]}>
            <Text style={[si.titulo, { color: t.textPrim }]}>Añadir insumo</Text>
            <TouchableOpacity onPress={onCerrar} style={{ padding: 4 }}>
              <Icon name="times" size={18} color={t.textSec} />
            </TouchableOpacity>
          </View>

          {elegido ? (
            <PasoCantidad
              insumo={elegido}
              t={t}
              onVolver={() => setElegido(null)}
              onConfirmar={(cantidad) => { onAgregar(elegido, cantidad); setElegido(null); }}
            />
          ) : (
            <>
              <View style={[si.busquedaBox, { backgroundColor: t.bgInput, borderColor: t.border2 }]}>
                <Icon name="search" size={13} color={t.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, color: t.textPrim, fontSize: 14, fontWeight: '500', padding: 0 }}
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar en el catálogo..."
                  placeholderTextColor={t.textMuted}
                />
              </View>
              <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
                {filtrados.length === 0 ? (
                  <Text style={{ color: t.textMuted, fontSize: 13, textAlign: 'center', padding: 20 }}>
                    Sin resultados.
                  </Text>
                ) : (
                  filtrados.map(insumo => (
                    <TouchableOpacity
                      key={insumo.id}
                      style={[si.itemRow, { backgroundColor: t.bgCard2, borderColor: t.border }]}
                      onPress={() => setElegido(insumo)}
                      activeOpacity={0.8}
                    >
                      <Text style={[si.itemNombre, { color: t.textPrim }]} numberOfLines={1}>{insumo.nombre}</Text>
                      <Text style={[si.itemUnidad, { color: t.textMuted }]}>{insumo.unidad_medida}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const si = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  modal:        { borderRadius: 24, borderWidth: 1, maxHeight: '80%' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  titulo:       { fontSize: 15, fontWeight: '900' },
  busquedaBox:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 16, marginTop: 12 },
  itemRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  itemNombre:   { fontSize: 13, fontWeight: '700', flex: 1, marginRight: 8 },
  itemUnidad:   { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
});
