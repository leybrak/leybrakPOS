import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const ConfirmContext = createContext(null);

function ConfirmDialog({ dialog, onCancelar, onConfirmar }) {
  const peligroso = dialog.peligroso !== false;
  const acento = peligroso ? '#ef4444' : '#3b82f6';
  const icono = dialog.icono || (peligroso ? 'trash' : 'question-circle');

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onCancelar}>
      <View style={st.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancelar} />
        <View style={st.card}>
          <View style={[st.iconBox, { backgroundColor: `${acento}22` }]}>
            <Icon name={icono} size={20} color={acento} />
          </View>

          {dialog.titulo && <Text style={st.titulo}>{dialog.titulo}</Text>}
          <Text style={st.mensaje}>{dialog.mensaje}</Text>

          <View style={st.botones}>
            <TouchableOpacity style={st.btnCancelar} onPress={onCancelar} activeOpacity={0.8}>
              <Text style={st.btnCancelarTxt}>{dialog.textoCancelar || 'Cancelar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.btnConfirmar, { backgroundColor: acento }]} onPress={onConfirmar} activeOpacity={0.8}>
              <Text style={st.btnConfirmarTxt}>{dialog.textoConfirmar || 'Confirmar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const confirmar = useCallback((mensaje, opciones = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog(typeof mensaje === 'string' ? { mensaje, ...opciones } : mensaje);
    });
  }, []);

  const resolver = useCallback((resultado) => {
    resolverRef.current?.(resultado);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {dialog && (
        <ConfirmDialog dialog={dialog} onCancelar={() => resolver(false)} onConfirmar={() => resolver(true)} />
      )}
    </ConfirmContext.Provider>
  );
}

// Uso: const confirmar = useConfirm(); const ok = await confirmar('¿Eliminar esto?');
// Devuelve una Promise<boolean> — true si confirmó, false si canceló.
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm necesita estar dentro de <ConfirmProvider>');
  return ctx;
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#141414',
    borderColor: '#262626',
    borderWidth: 1,
    borderRadius: 28,
    padding: 24,
    elevation: 16,
  },
  iconBox: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  titulo: { color: '#fff', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  mensaje: { color: '#a3a3a3', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  botones: { flexDirection: 'row', gap: 10, marginTop: 24 },
  btnCancelar: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  btnCancelarTxt: { color: '#d4d4d4', fontSize: 13, fontWeight: '700' },
  btnConfirmar: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnConfirmarTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
