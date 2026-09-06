import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import EncryptedStorage from 'react-native-encrypted-storage';
import useAppStore from '../../store/useAppStore';
import { getProductos } from '../../api/api';

const obtenerPrecio = (p) => {
  const precio = p.precio_base !== undefined ? p.precio_base : p.precio;
  return parseFloat(precio) || 0;
};

// ─── Equivalente movil de Pos_DrawerVentaRapida.jsx (web) — antes el botón
// "Venta Rápida" de SalonScreen solo guardaba un estado que nadie leía, así
// que no pasaba nada al presionarlo.
export default function ModalVentaRapida({ visible, onClose, onProcederPago }) {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal?.temaFondo !== 'light';
  const color  = configuracionGlobal?.colorPrimario || '#ff5a1f';

  const t = {
    bg:       isDark ? '#050505' : '#f8f9fa',
    bg2:      isDark ? '#0d0d0d' : '#ffffff',
    bg3:      isDark ? '#161616' : '#f3f4f6',
    border:   isDark ? '#222222' : '#e5e7eb',
    border2:  isDark ? '#333333' : '#d1d5db',
    textPrim: isDark ? '#ffffff' : '#111111',
    textSec:  isDark ? '#9ca3af' : '#6b7280',
    textMut:  isDark ? '#4b5563' : '#9ca3af',
  };

  const [cargando, setCargando]     = useState(true);
  const [productos, setProductos]   = useState([]);
  const [carrito, setCarrito]       = useState([]);

  useEffect(() => {
    if (visible) {
      setCarrito([]);
      cargarProductos();
    }
  }, [visible]);

  const cargarProductos = async () => {
    setCargando(true);
    try {
      const sedeId = await EncryptedStorage.getItem('sede_id');
      const { data } = await getProductos({ sede_id: sedeId });
      setProductos((data || []).filter((p) => p.es_venta_rapida === true));
    } catch (e) {
      setProductos([]);
    } finally {
      setCargando(false);
    }
  };

  const agregarAlCarrito = (producto) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === producto.id);
      if (existe) {
        return prev.map((item) => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { id: producto.id, nombre: producto.nombre, precio: obtenerPrecio(producto), cantidad: 1 }];
    });
  };

  const restarDelCarrito = (id) => {
    setCarrito((prev) => {
      const existe = prev.find((item) => item.id === id);
      if (!existe) return prev;
      if (existe.cantidad === 1) return prev.filter((item) => item.id !== id);
      return prev.map((item) => item.id === id ? { ...item, cantidad: item.cantidad - 1 } : item);
    });
  };

  const total = carrito.reduce((sum, item) => sum + item.precio * item.cantidad, 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <View style={[s.overlay, { backgroundColor: t.bg }]}>
          <SafeAreaView style={{ flex: 1 }}>

            {/* Header */}
            <View style={[s.header, { backgroundColor: t.bg2, borderBottomColor: t.border }]}>
              <View style={[s.headerIcon, { backgroundColor: `${color}20` }]}>
                <Icon name="bolt" size={20} color={color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.titulo, { color }]}>Venta Directa</Text>
                <Text style={[s.subtitulo, { color: t.textMut }]}>VENTA RÁPIDA SIN MESA</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[s.closeBtn, { backgroundColor: t.bg3, borderColor: t.border2 }]}
                activeOpacity={0.7}
              >
                <Icon name="times" size={16} color={t.textSec} />
              </TouchableOpacity>
            </View>

            {/* Grid de productos */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.gridContent}>
              {cargando ? (
                <ActivityIndicator color={color} size="large" style={{ marginTop: 60 }} />
              ) : productos.length === 0 ? (
                <View style={s.vacioBox}>
                  <Icon name="cube" size={40} color={t.textMut} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <Text style={[s.vacioText, { color: t.textMut }]}>SIN PRODUCTOS CONFIGURADOS</Text>
                  <Text style={[s.vacioSub, { color: t.textMut }]}>
                    Marca productos como "Venta Rápida" desde el ERP → Menú.
                  </Text>
                </View>
              ) : (
                <View style={s.grid}>
                  {productos.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.productoCard, { backgroundColor: t.bg2, borderColor: t.border }]}
                      onPress={() => agregarAlCarrito(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.productoNombre, { color: t.textPrim }]} numberOfLines={2}>
                        {p.nombre}
                      </Text>
                      <View style={[s.productoPrecioRow, { borderTopColor: t.border }]}>
                        <Text style={[s.productoPrecio, { color }]}>
                          S/ {obtenerPrecio(p).toFixed(2)}
                        </Text>
                        <Icon name="plus-circle" size={16} color={color} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Carrito + total */}
            {carrito.length > 0 && (
              <ScrollView style={s.carritoScroll} contentContainerStyle={{ padding: 12 }}>
                {carrito.map((item) => (
                  <View key={item.id} style={[s.carritoItem, { backgroundColor: t.bg3, borderColor: t.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.carritoNombre, { color: t.textPrim }]} numberOfLines={1}>{item.nombre}</Text>
                      <Text style={[s.carritoUnitario, { color: t.textMut }]}>S/ {item.precio.toFixed(2)} c/u</Text>
                    </View>
                    <View style={s.stepper}>
                      <TouchableOpacity style={[s.stepperBtn, { backgroundColor: t.bg2 }]} onPress={() => restarDelCarrito(item.id)}>
                        <Icon name="minus" size={11} color={t.textSec} />
                      </TouchableOpacity>
                      <Text style={[s.stepperNum, { color: t.textPrim }]}>{item.cantidad}</Text>
                      <TouchableOpacity style={[s.stepperBtn, { backgroundColor: t.bg2 }]} onPress={() => agregarAlCarrito(item)}>
                        <Icon name="plus" size={11} color={t.textSec} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[s.carritoSubtotal, { color }]}>S/ {(item.precio * item.cantidad).toFixed(2)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={[s.footer, { backgroundColor: t.bg2, borderTopColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.footerLabel, { color: t.textMut }]}>TOTAL A PAGAR</Text>
                <Text style={[s.footerTotal, { color }]}>S/ {total.toFixed(2)}</Text>
              </View>
              <TouchableOpacity
                style={[s.btnPagar, { backgroundColor: color }, carrito.length === 0 && { opacity: 0.4 }]}
                onPress={() => onProcederPago(carrito, total)}
                disabled={carrito.length === 0}
                activeOpacity={0.85}
              >
                <Text style={s.btnPagarText}>PAGO EXPRESS</Text>
                <Icon name="angle-right" size={16} color="#fff" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>

          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1 },

  header:     { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  headerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  titulo:     { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  subtitulo:  { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },
  closeBtn:   { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  gridContent: { padding: 12, paddingBottom: 24 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  productoCard: {
    width: '48%', minHeight: 100, borderRadius: 18, borderWidth: 1,
    padding: 14, justifyContent: 'space-between',
  },
  productoNombre:    { fontSize: 14, fontWeight: '800' },
  productoPrecioRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderStyle: 'dashed' },
  productoPrecio:    { fontSize: 15, fontWeight: '900' },

  vacioBox:  { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  vacioText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 6 },
  vacioSub:  { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  carritoScroll:  { maxHeight: 190, borderTopWidth: 1, borderTopColor: 'transparent' },
  carritoItem:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 8 },
  carritoNombre:   { fontSize: 13, fontWeight: '800' },
  carritoUnitario: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  stepper:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10 },
  stepperBtn:     { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepperNum:     { fontSize: 13, fontWeight: '900', width: 24, textAlign: 'center' },
  carritoSubtotal: { fontSize: 13, fontWeight: '900', minWidth: 60, textAlign: 'right' },

  footer:      { flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: 1 },
  footerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  footerTotal: { fontSize: 24, fontWeight: '900', marginTop: 2 },
  btnPagar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 22 },
  btnPagarText: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
});
