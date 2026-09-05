import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';

export default function ModalAlertaBot({ solicitud, onResolver }) {
  const [procesando, setProcesando] = useState(false);

  if (!solicitud) return null;

  const manejarClick = async (decision) => {
    setProcesando(true);
    await onResolver(solicitud.solicitud_id, solicitud.orden_id, decision);
    setProcesando(false);
  };

  return (
    <Modal visible transparent animationType="fade">
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.iconBox}>
              <Text style={{ fontSize: 26 }}>⚠️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.titulo}>¡Alerta del Bot!</Text>
              <Text style={s.subtitulo}>Orden #{solicitud.orden_id} - {solicitud.mesa}</Text>
            </View>
          </View>

          <View style={s.detalleBox}>
            <Text style={s.detalleLabel}>SOLICITUD: {solicitud.accion?.toUpperCase()}</Text>
            <Text style={s.detalleTexto}>{solicitud.descripcion}</Text>
          </View>

          <View style={s.botones}>
            <TouchableOpacity
              style={[s.btn, s.btnRechazar]}
              onPress={() => manejarClick('rechazar')}
              disabled={procesando}
              activeOpacity={0.8}
            >
              {procesando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnRechazarText}>RECHAZAR (EN FUEGO)</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnAprobar]}
              onPress={() => manejarClick('aprobar')}
              disabled={procesando}
              activeOpacity={0.8}
            >
              {procesando ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnAprobarText}>APROBAR CAMBIO</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card:           { width: '100%', maxWidth: 420, backgroundColor: '#1a1a1a', borderWidth: 2, borderColor: '#ff5a1f', borderRadius: 24, padding: 24 },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  iconBox:        { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' },
  titulo:         { color: '#fff', fontSize: 18, fontWeight: '900', textTransform: 'uppercase' },
  subtitulo:      { color: '#a3a3a3', fontSize: 12, fontWeight: '700', marginTop: 2 },
  detalleBox:     { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', borderRadius: 16, padding: 16, marginBottom: 20 },
  detalleLabel:   { color: '#ff5a1f', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  detalleTexto:   { color: '#fff', fontSize: 15, fontWeight: '500', lineHeight: 21 },
  botones:        { flexDirection: 'row', gap: 12 },
  btn:            { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnRechazar:    { backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
  btnRechazarText:{ color: '#d4d4d4', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  btnAprobar:     { backgroundColor: '#ff5a1f' },
  btnAprobarText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
