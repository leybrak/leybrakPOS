import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const ConfirmContext = createContext(null);

function ConfirmDialog({ dialog, valorTexto, setValorTexto, onCancelar, onConfirmar }) {
  const peligroso = dialog.peligroso !== false;
  const acento = peligroso ? '#ef4444' : '#3b82f6';
  const icono = dialog.icono || (peligroso ? 'trash' : 'question-circle');
  const pedirTexto = dialog.pedirTexto;
  const deshabilitado = !!(pedirTexto && pedirTexto.obligatorio !== false && !valorTexto.trim());

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

          {pedirTexto && (
            <TextInput
              autoFocus
              value={valorTexto}
              onChangeText={setValorTexto}
              placeholder={pedirTexto.placeholder || ''}
              placeholderTextColor="#666"
              maxLength={pedirTexto.maxLength}
              style={st.input}
              onSubmitEditing={() => { if (!deshabilitado) onConfirmar(); }}
            />
          )}

          <View style={st.botones}>
            <TouchableOpacity style={st.btnCancelar} onPress={onCancelar} activeOpacity={0.8}>
              <Text style={st.btnCancelarTxt}>{dialog.textoCancelar || 'Cancelar'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.btnConfirmar, { backgroundColor: acento }, deshabilitado && { opacity: 0.5 }]}
              onPress={onConfirmar}
              disabled={deshabilitado}
              activeOpacity={0.8}
            >
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
  const [valorTexto, setValorTexto] = useState('');
  const resolverRef = useRef(null);

  const mostrarDialogo = useCallback((mensaje, opciones = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      const config = typeof mensaje === 'string' ? { mensaje, ...opciones } : mensaje;
      setValorTexto(config?.pedirTexto?.valorInicial || '');
      setDialog(config);
    });
  }, []);

  // Confirmación simple sí/no — Promise<boolean> (true si confirmó, false si canceló).
  // Uso: const confirmar = useConfirm(); const ok = await confirmar('¿Eliminar esto?');
  const confirmar = useCallback((mensaje, opciones) => mostrarDialogo(mensaje, opciones), [mostrarDialogo]);

  // Reemplaza a los Alert.alert con botón de texto libre (ej. "¿Motivo?")
  // con el mismo diseño — Promise<string|null> (el texto escrito si
  // confirmó, null si canceló). `opciones.pedirTexto` acepta
  // { placeholder, valorInicial, obligatorio (default true), maxLength }.
  // Uso: const prompt = usePrompt(); const motivo = await prompt('¿Por qué se cancela?', { pedirTexto: { placeholder: 'Motivo...' } });
  const prompt = useCallback((mensaje, opciones = {}) => {
    const base = typeof mensaje === 'string' ? { mensaje, ...opciones } : mensaje;
    return mostrarDialogo({ ...base, pedirTexto: base.pedirTexto || {} });
  }, [mostrarDialogo]);

  const resolver = useCallback((confirmado) => {
    if (dialog?.pedirTexto) {
      resolverRef.current?.(confirmado ? valorTexto.trim() : null);
    } else {
      resolverRef.current?.(confirmado);
    }
    resolverRef.current = null;
    setDialog(null);
    setValorTexto('');
  }, [dialog, valorTexto]);

  return (
    <ConfirmContext.Provider value={{ confirmar, prompt }}>
      {children}
      {dialog && (
        <ConfirmDialog
          dialog={dialog}
          valorTexto={valorTexto}
          setValorTexto={setValorTexto}
          onCancelar={() => resolver(false)}
          onConfirmar={() => resolver(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm necesita estar dentro de <ConfirmProvider>');
  return ctx.confirmar;
}

export function usePrompt() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('usePrompt necesita estar dentro de <ConfirmProvider>');
  return ctx.prompt;
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
  input: {
    marginTop: 16, borderRadius: 12, borderWidth: 1, borderColor: '#333',
    backgroundColor: '#1a1a1a', color: '#fff', fontSize: 14, fontWeight: '600',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  botones: { flexDirection: 'row', gap: 10, marginTop: 24 },
  btnCancelar: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', alignItems: 'center' },
  btnCancelarTxt: { color: '#d4d4d4', fontSize: 13, fontWeight: '700' },
  btnConfirmar: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  btnConfirmarTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
