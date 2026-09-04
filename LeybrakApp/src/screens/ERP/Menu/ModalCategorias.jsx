import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';

export default function ModalCategorias({ visible, categorias, t, onCrear, onEliminar, onCerrar }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [nombre, setNombre]     = useState('');
  const [guardando, setGuardando] = useState(false);

  const handleCrear = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      await onCrear(nombre.trim());
      setNombre('');
      toast.success('Categoría creada correctamente.');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo crear la categoría.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (cat) => {
    const ok = await confirmar(`¿Eliminar "${cat.nombre}"? Los platos de esta categoría quedarán sin categoría.`);
    if (!ok) return;
    try {
      await onEliminar(cat.id);
      toast.success('Categoría eliminada.');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'No se pudo eliminar la categoría.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCerrar}>
      <View style={s.overlay}>
        <View style={[s.modal, { backgroundColor: t.bgCard, borderColor: t.border }]}>

          {/* Header */}
          <View style={[s.header, { borderBottomColor: t.border, backgroundColor: t.bgCard2 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[s.headerIcono, { backgroundColor: `${t.color}15` }]}>
                <Icon name="folder" size={16} color={t.color} />
              </View>
              <Text style={[s.titulo, { color: t.textPrim }]}>Categorías del Menú</Text>
            </View>
            <TouchableOpacity
              onPress={onCerrar}
              style={[s.closeBtn, { backgroundColor: t.bgCard, borderColor: t.border }]}
            >
              <Icon name="times" size={14} color={t.textSec} />
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            {/* Input nueva categoría */}
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim, flex: 1 }]}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Bebidas, Postres..."
                placeholderTextColor={t.textMuted}
                onSubmitEditing={handleCrear}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[s.btnAgregar, { backgroundColor: t.color },
                  (!nombre.trim() || guardando) && { opacity: 0.5 }]}
                onPress={handleCrear}
                disabled={!nombre.trim() || guardando}
                activeOpacity={0.8}
              >
                {guardando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnAgregarText}>AGREGAR</Text>
                }
              </TouchableOpacity>
            </View>

            <View style={[s.divider, { backgroundColor: t.border }]} />

            {/* Lista de categorías */}
            <ScrollView
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator={false}
            >
              {categorias.length === 0 ? (
                <Text style={[s.emptyText, { color: t.textMuted }]}>
                  No hay categorías creadas aún.
                </Text>
              ) : (
                categorias.map(cat => (
                  <View
                    key={cat.id}
                    style={[s.catRow, { backgroundColor: t.bgCard2, borderColor: t.border }]}
                  >
                    <Text style={[s.catNombre, { color: t.textPrim }]}>{cat.nombre}</Text>
                    <TouchableOpacity
                      style={s.catDeleteBtn}
                      onPress={() => handleEliminar(cat)}
                      activeOpacity={0.7}
                    >
                      <Icon name="trash" size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:         { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, maxHeight: '80%' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  headerIcono:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titulo:        { fontSize: 18, fontWeight: '900' },
  closeBtn:      { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  body:          { padding: 20 },
  inputRow:      { flexDirection: 'row', gap: 10, marginBottom: 16 },
  input:         { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontWeight: '600' },
  btnAgregar:    { paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 90, minHeight: 48 },
  btnAgregarText:{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  divider:       { height: 1, marginBottom: 16 },
  emptyText:     { textAlign: 'center', fontSize: 13, paddingVertical: 20 },
  catRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  catNombre:     { fontSize: 14, fontWeight: '700' },
  catDeleteBtn:  { padding: 8 },
});