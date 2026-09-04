import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const ToastContext = createContext(null);

// Mismos colores/iconos que el ToastContext de la web, para que el
// "sistema de avisos" se vea igual en ambas plataformas.
const CONFIG = {
  success: { bg: '#0d1f0d', border: '#22c55e40', icon: 'check-circle', color: '#4ade80' },
  error:   { bg: '#1f0d0d', border: '#ef444440', icon: 'times-circle', color: '#f87171' },
  info:    { bg: '#0d0d1f', border: '#3b82f640', icon: 'info-circle', color: '#60a5fa' },
  warning: { bg: '#1f160d', border: '#f9731640', icon: 'exclamation-triangle', color: '#fb923c' },
};

function ToastItem({ toast, onClose }) {
  const c = CONFIG[toast.tipo] || CONFIG.info;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[st.toast, { backgroundColor: c.bg, borderColor: c.border, opacity, transform: [{ translateY }] }]}
    >
      <Icon name={c.icon} size={18} color={c.color} style={{ marginTop: 1 }} />
      <Text style={st.toastText}>{toast.mensaje}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="times" size={12} color="#666" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const add = useCallback((mensaje, tipo = 'success', dur = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.slice(-3), { id, mensaje, tipo, dur }]);
    setTimeout(() => remove(id), dur);
  }, [remove]);

  const toast = useMemo(() => ({
    success: (msg, dur) => add(msg, 'success', dur),
    error:   (msg, dur) => add(msg, 'error', dur ?? 4500),
    info:    (msg, dur) => add(msg, 'info', dur),
    warning: (msg, dur) => add(msg, 'warning', dur),
  }), [add]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Modal visible={toasts.length > 0} transparent animationType="none" statusBarTranslucent onRequestClose={() => {}}>
        <View pointerEvents="box-none" style={st.overlay}>
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
          ))}
        </View>
      </Modal>
    </ToastContext.Provider>
  );
}

// Uso: const toast = useToast(); toast.success('Guardado'); toast.error('Falló');
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast necesita estar dentro de <ToastProvider>');
  return ctx;
}

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 32,
    paddingHorizontal: 16,
    gap: 10,
  },
  toast: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  toastText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 18 },
});
