import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import EncryptedStorage from 'react-native-encrypted-storage';
import useAppStore from '../../store/useAppStore';
import { registrarMovimientoCaja } from '../../api/api';

export default function ModalMovimientoCaja({ visible, onClose }) {
  const { configuracionGlobal, estadoCaja } = useAppStore();
  const isDark = configuracionGlobal?.temaFondo !== 'light';
  const color  = configuracionGlobal?.colorPrimario || '#ff5a1f';

  const t = {
    bg:       isDark ? '#0d0d0d' : '#ffffff',
    bg2:      isDark ? '#111111' : '#f9fafb',
    bg3:      isDark ? '#161616' : '#f3f4f6',
    border:   isDark ? '#222222' : '#e5e7eb',
    border2:  isDark ? '#333333' : '#d1d5db',
    textPrim: isDark ? '#ffffff' : '#111111',
    textSec:  isDark ? '#9ca3af' : '#6b7280',
    textMut:  isDark ? '#4b5563' : '#9ca3af',
  };

  const [tipo, setTipo]         = useState('egreso');
  const [monto, setMonto]       = useState('');
  const [concepto, setConcepto] = useState('');
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    if (visible) {
      setTipo('egreso');
      setMonto('');
      setConcepto('');
    }
  }, [visible]);

  const handleCerrar = () => {
    setMonto(''); setConcepto(''); setTipo('egreso');
    onClose();
  };

  const handleGuardar = async () => {
    if (!monto || parseFloat(monto) <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido.');
      return;
    }
    if (!concepto.trim()) {
      Alert.alert('Error', 'Debes justificar el movimiento.');
      return;
    }
    setProcesando(true);
    try {
      const sesionId   = estadoCaja?.id || await EncryptedStorage.getItem('sesion_caja_id');
      const empleadoId = await EncryptedStorage.getItem('empleado_id');

      if (!sesionId) {
        Alert.alert('Error', 'No hay sesión de caja activa.');
        return;
      }

      await registrarMovimientoCaja({
        tipo,
        monto:           parseFloat(monto),
        concepto:        concepto.trim(),
        sesion_caja_id:  sesionId,
        empleado_id:     empleadoId,
      });

      Alert.alert(
        '¡Listo!',
        `${tipo === 'egreso' ? 'Salida' : 'Entrada'} de S/ ${parseFloat(monto).toFixed(2)} registrada.`
      );
      handleCerrar();
    } catch (e) {
        Alert.alert('Error', e?.response?.data?.error || 'No se pudo registrar el movimiento.');
    } finally {
      setProcesando(false);
    }
  };

  const esEgreso = tipo === 'egreso';
  const colorTipo = esEgreso ? '#ef4444' : '#10b981';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCerrar}>
      {/* SafeArea: con edge-to-edge (RN 0.85) la hoja se dibuja bajo la barra de gestos;
          el inset evita que el botón inferior pierda los toques. Ver ModalCobro. */}
      <SafeAreaProvider>
      <View style={s.overlay}>
        <SafeAreaView edges={['bottom']} style={[s.container, { backgroundColor: t.bg, borderColor: t.border }]}>

          {/* Header */}
          <View style={[s.header, { backgroundColor: t.bg2, borderBottomColor: t.border }]}>
            <View style={[s.headerIcon, { backgroundColor: `${color}15` }]}>
              <Icon name="money" size={20} color={color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.titulo, { color: t.textPrim }]}>Caja Chica</Text>
              <Text style={[s.subtitulo, { color: t.textMut }]}>MOVIMIENTO DE EFECTIVO</Text>
            </View>
            <TouchableOpacity
              onPress={handleCerrar}
              style={[s.closeBtn, { backgroundColor: t.bg3, borderColor: t.border2 }]}
              activeOpacity={0.7}
            >
              <Icon name="times" size={14} color={t.textSec} />
            </TouchableOpacity>
          </View>

          <View style={s.body}>

            {/* Selector tipo */}
            <View style={[s.tipoSelector, { backgroundColor: t.bg3, borderColor: t.border }]}>
              <TouchableOpacity
                style={[s.tipoBtn, esEgreso && { backgroundColor: '#ef4444' }]}
                onPress={() => setTipo('egreso')}
                activeOpacity={0.8}
              >
                <Icon name="arrow-down" size={12} color={esEgreso ? '#fff' : t.textSec} style={{ marginRight: 6 }} />
                <Text style={[s.tipoBtnText, { color: esEgreso ? '#fff' : t.textSec }]}>GASTO</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tipoBtn, !esEgreso && { backgroundColor: '#10b981' }]}
                onPress={() => setTipo('ingreso')}
                activeOpacity={0.8}
              >
                <Icon name="arrow-up" size={12} color={!esEgreso ? '#fff' : t.textSec} style={{ marginRight: 6 }} />
                <Text style={[s.tipoBtnText, { color: !esEgreso ? '#fff' : t.textSec }]}>INGRESO</Text>
              </TouchableOpacity>
            </View>

            {/* Input monto */}
            <Text style={[s.label, { color: t.textMut }]}>MONTO DEL MOVIMIENTO</Text>
            <View style={[s.montoRow, { backgroundColor: t.bg3, borderColor: t.border2 }]}>
              <Text style={[s.montoPrefix, { color: t.textMut }]}>S/</Text>
              <TextInput
                style={[s.montoInput, { color: t.textPrim }]}
                value={monto}
                onChangeText={setMonto}
                placeholder="0.00"
                placeholderTextColor={t.textMut}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>

            {/* Input concepto */}
            <Text style={[s.label, { color: t.textMut, marginTop: 16 }]}>MOTIVO O JUSTIFICACIÓN</Text>
            <TextInput
              style={[s.conceptoInput, { backgroundColor: t.bg3, borderColor: t.border2, color: t.textPrim }]}
              value={concepto}
              onChangeText={setConcepto}
              placeholder={esEgreso ? 'Ej. Compra de insumos' : 'Ej. Ingreso de sencillo'}
              placeholderTextColor={t.textMut}
              maxLength={200}
            />

            {/* Botón confirmar */}
            <TouchableOpacity
              style={[s.btnConfirmar, { backgroundColor: colorTipo }, procesando && { opacity: 0.6 }]}
              onPress={handleGuardar}
              disabled={procesando}
              activeOpacity={0.8}
            >
              {procesando
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Icon
                      name={esEgreso ? 'sign-out' : 'sign-in'}
                      size={16} color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={s.btnConfirmarText}>
                      REGISTRAR {esEgreso ? 'SALIDA' : 'ENTRADA'}
                    </Text>
                  </>
              }
            </TouchableOpacity>

          </View>
        </SafeAreaView>
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  container:     { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, overflow: 'hidden' },

  header:        { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  headerIcon:    { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titulo:        { fontSize: 20, fontWeight: '900' },
  subtitulo:     { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginTop: 2 },
  closeBtn:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  body:          { padding: 20, paddingBottom: 40 },

  tipoSelector:  { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 24 },
  tipoBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  tipoBtnText:   { fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  label:         { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },

  montoRow:      { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 4 },
  montoPrefix:   { fontSize: 24, fontWeight: '900', marginRight: 8 },
  montoInput:    { flex: 1, fontSize: 36, fontWeight: '900' },

  conceptoInput: { borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: '600', marginBottom: 24 },

  btnConfirmar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 20, paddingVertical: 18 },
  btnConfirmarText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});