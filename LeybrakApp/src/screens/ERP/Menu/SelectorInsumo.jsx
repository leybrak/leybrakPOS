import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

// Buscador inline de insumos (reemplaza el modal-popup de 2 pasos de antes).
// Al tocar un resultado, se agrega directo con cantidad 1 — la cantidad
// se edita después en la fila del carrito, igual que en la web.
export default function SelectorInsumo({ catalogo, agregados = [], onAgregar, t, placeholder = 'Buscar insumo para agregar...' }) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = busqueda.trim()
    ? catalogo.filter(i => i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 8)
    : [];

  const yaAgregado = (id) => agregados.includes(id);

  const elegir = (insumo) => {
    if (yaAgregado(insumo.id)) return;
    onAgregar(insumo);
    setBusqueda('');
  };

  return (
    <View>
      <View style={[si.busquedaBox, { backgroundColor: t.bgInput, borderColor: t.border2 }]}>
        <Icon name="search" size={13} color={t.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={{ flex: 1, color: t.textPrim, fontSize: 13, fontWeight: '600', padding: 0 }}
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder={placeholder}
          placeholderTextColor={t.textMuted}
        />
        {busqueda.length > 0 && (
          <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="times-circle" size={14} color={t.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {busqueda.trim() !== '' && (
        <View style={[si.dropdown, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          {filtrados.length === 0 ? (
            <Text style={[si.sinResultados, { color: t.textMuted }]}>Sin resultados</Text>
          ) : (
            filtrados.map(insumo => {
              const agregado = yaAgregado(insumo.id);
              return (
                <TouchableOpacity
                  key={insumo.id}
                  style={[si.itemRow, { borderBottomColor: t.border }, agregado && { opacity: 0.4 }]}
                  onPress={() => elegir(insumo)}
                  disabled={agregado}
                  activeOpacity={0.7}
                >
                  <Text style={[si.itemNombre, { color: t.textPrim }]} numberOfLines={1}>{insumo.nombre}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[si.itemUnidad, { color: t.textMuted }]}>{insumo.unidad_medida}</Text>
                    {agregado && <Icon name="check" size={11} color={t.color} />}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const si = StyleSheet.create({
  busquedaBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  dropdown: { borderWidth: 1, borderRadius: 14, marginTop: 6, overflow: 'hidden' },
  sinResultados: { fontSize: 12, textAlign: 'center', padding: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  itemNombre: { flex: 1, fontSize: 13, fontWeight: '700', marginRight: 8 },
  itemUnidad: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
