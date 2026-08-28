import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { emitirComprobante, consultarRuc, consultarDni } from '../../api/api';

/**
 * Modal para emitir un comprobante SUNAT (Boleta/Factura) de una orden pagada.
 */
export default function ModalEmitirComprobante({ visible, onClose, ordenId, isDark = true, color = '#ff5a1f' }) {
  const [tipo, setTipo]           = useState('boleta');
  const [ruc, setRuc]             = useState('');
  const [dni, setDni]             = useState('');
  const [nombre, setNombre]       = useState('');
  const [direccion, setDireccion] = useState('');
  const [buscando, setBuscando]   = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [error, setError]         = useState(null);
  const [resultado, setResultado] = useState(null);

  const t = {
    bg:       isDark ? '#0a0a0a' : '#ffffff',
    card:     isDark ? '#111111' : '#f9fafb',
    input:    isDark ? '#0a0a0a' : '#ffffff',
    border:   isDark ? '#222222' : '#e5e7eb',
    textPrim: isDark ? '#ffffff' : '#111111',
    textSec:  isDark ? '#9ca3af' : '#6b7280',
    textMut:  isDark ? '#4b5563' : '#9ca3af',
  };

  const cerrar = () => {
    setTipo('boleta'); setRuc(''); setDni(''); setNombre(''); setDireccion('');
    setError(null); setResultado(null);
    onClose();
  };

  const buscarRuc = async () => {
    if (ruc.length !== 11) { setError('El RUC debe tener 11 dígitos.'); return; }
    setBuscando(true); setError(null);
    try { const r = await consultarRuc(ruc); setNombre(r.data?.razon_social || ''); }
    catch { setError('No se pudo consultar el RUC.'); }
    finally { setBuscando(false); }
  };

  const buscarDni = async () => {
    if (dni.length !== 8) { setError('El DNI debe tener 8 dígitos.'); return; }
    setBuscando(true); setError(null);
    try { const r = await consultarDni(dni); setNombre(r.data?.nombre || ''); }
    catch { setError('No se pudo consultar el DNI.'); }
    finally { setBuscando(false); }
  };

  const emitir = async () => {
    setEmitiendo(true); setError(null);
    const receptor = tipo === 'factura'
      ? { num_doc: ruc, denominacion: nombre, direccion }
      : (dni ? { num_doc: dni, denominacion: nombre } : {});
    try {
      const r = await emitirComprobante(ordenId, { tipo, receptor });
      setResultado(r.data);
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo emitir el comprobante.');
    } finally {
      setEmitiendo(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      {/* SafeArea: con edge-to-edge (RN 0.85) la hoja se dibuja bajo la barra de gestos;
          el inset evita que el botón inferior pierda los toques. Ver ModalCobro. */}
      <SafeAreaProvider>
      <View style={st.overlay}>
        <SafeAreaView edges={['bottom']} style={[st.card, { backgroundColor: t.bg, borderTopColor: t.border }]}>
          <View style={[st.header, { borderBottomColor: t.border }]}>
            <View style={st.headerLeft}>
              <View style={[st.headerIcon, { backgroundColor: color + '22' }]}>
                <Icon name="file-text" size={18} color={color} />
              </View>
              <Text style={[st.title, { color: t.textPrim }]}>Comprobante SUNAT</Text>
            </View>
            <TouchableOpacity onPress={cerrar} style={[st.closeBtn, { backgroundColor: t.card }]}>
              <Icon name="times" size={16} color={t.textSec} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
            {resultado && resultado.aceptado_por_sunat ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <View style={st.okCircle}><Icon name="check" size={30} color="#fff" /></View>
                <Text style={[st.okTitle, { color: t.textPrim }]}>¡Comprobante emitido!</Text>
                <Text style={[st.okSub, { color: t.textSec }]}>
                  {resultado.tipo === 'factura' ? 'Factura' : 'Boleta'} {resultado.serie}-{resultado.numero}
                </Text>
                {!!resultado.enlace_pdf && (
                  <TouchableOpacity style={[st.btn, { backgroundColor: color, marginTop: 18 }]}
                    onPress={() => Linking.openURL(resultado.enlace_pdf)}>
                    <Icon name="download" size={16} color="#fff" />
                    <Text style={st.btnText}>Ver / Descargar PDF</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[st.btnSec, { backgroundColor: t.card }]} onPress={cerrar}>
                  <Text style={[st.btnSecText, { color: t.textSec }]}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[st.toggle, { backgroundColor: t.card }]}>
                  {['boleta', 'factura'].map(tt => (
                    <TouchableOpacity key={tt} onPress={() => { setTipo(tt); setError(null); }}
                      style={[st.toggleBtn, tipo === tt && { backgroundColor: color }]}>
                      <Text style={[st.toggleText, { color: tipo === tt ? '#fff' : t.textSec }]}>
                        {tt === 'boleta' ? 'Boleta' : 'Factura'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {tipo === 'factura' ? (
                  <>
                    <Text style={[st.label, { color: t.textMut }]}>RUC</Text>
                    <View style={st.row}>
                      <TextInput value={ruc} onChangeText={v => setRuc(v.replace(/[^0-9]/g, '').slice(0, 11))}
                        placeholder="20123456789" placeholderTextColor={t.textMut} keyboardType="number-pad"
                        style={[st.input, { flex: 1, backgroundColor: t.input, borderColor: t.border, color: t.textPrim }]} />
                      <TouchableOpacity onPress={buscarRuc} disabled={buscando} style={[st.searchBtn, { backgroundColor: t.card }]}>
                        {buscando ? <ActivityIndicator size="small" color={color} /> : <Icon name="search" size={18} color={t.textSec} />}
                      </TouchableOpacity>
                    </View>
                    <Text style={[st.label, { color: t.textMut }]}>Razón social</Text>
                    <TextInput value={nombre} onChangeText={setNombre} placeholder="EMPRESA SAC" placeholderTextColor={t.textMut}
                      style={[st.input, { backgroundColor: t.input, borderColor: t.border, color: t.textPrim }]} />
                    <Text style={[st.label, { color: t.textMut }]}>Dirección</Text>
                    <TextInput value={direccion} onChangeText={setDireccion} placeholder="Av. Ejemplo 123" placeholderTextColor={t.textMut}
                      style={[st.input, { backgroundColor: t.input, borderColor: t.border, color: t.textPrim }]} />
                  </>
                ) : (
                  <>
                    <Text style={[st.hint, { color: t.textSec }]}>Boleta a consumidor final. El DNI es opcional (obligatorio si supera S/700).</Text>
                    <Text style={[st.label, { color: t.textMut }]}>DNI (opcional)</Text>
                    <View style={st.row}>
                      <TextInput value={dni} onChangeText={v => setDni(v.replace(/[^0-9]/g, '').slice(0, 8))}
                        placeholder="12345678" placeholderTextColor={t.textMut} keyboardType="number-pad"
                        style={[st.input, { flex: 1, backgroundColor: t.input, borderColor: t.border, color: t.textPrim }]} />
                      <TouchableOpacity onPress={buscarDni} disabled={buscando} style={[st.searchBtn, { backgroundColor: t.card }]}>
                        {buscando ? <ActivityIndicator size="small" color={color} /> : <Icon name="search" size={18} color={t.textSec} />}
                      </TouchableOpacity>
                    </View>
                    {!!dni && (
                      <>
                        <Text style={[st.label, { color: t.textMut }]}>Nombre</Text>
                        <TextInput value={nombre} onChangeText={setNombre} placeholder="Nombre del cliente" placeholderTextColor={t.textMut}
                          style={[st.input, { backgroundColor: t.input, borderColor: t.border, color: t.textPrim }]} />
                      </>
                    )}
                  </>
                )}

                {!!error && (
                  <View style={st.errorBox}>
                    <Icon name="exclamation-triangle" size={14} color="#ef4444" />
                    <Text style={st.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity style={[st.btn, { backgroundColor: color, marginTop: 16 }, emitiendo && { opacity: 0.6 }]}
                  onPress={emitir} disabled={emitiendo}>
                  {emitiendo ? <ActivityIndicator color="#fff" /> : <Text style={st.btnText}>Emitir a SUNAT</Text>}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  card:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, maxHeight: '90%' },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  headerLeft:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon:{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title:     { fontSize: 17, fontWeight: '900' },
  closeBtn:  { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  body:      { padding: 20, paddingBottom: 36 },
  toggle:    { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 18 },
  toggleBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  toggleText:{ fontSize: 14, fontWeight: '800' },
  label:     { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  hint:      { fontSize: 12, marginBottom: 4 },
  row:       { flexDirection: 'row', gap: 8 },
  input:     { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontWeight: '700' },
  searchBtn: { width: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, marginTop: 14 },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },
  btn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
  btnText:   { color: '#fff', fontSize: 15, fontWeight: '900' },
  btnSec:    { borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 10, width: '100%' },
  btnSecText:{ fontSize: 14, fontWeight: '800' },
  okCircle:  { width: 64, height: 64, borderRadius: 32, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  okTitle:   { fontSize: 20, fontWeight: '900' },
  okSub:     { fontSize: 13, marginTop: 4 },
});
