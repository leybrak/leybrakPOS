import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, Modal, FlatList,
  StatusBar, Platform, Image, NativeModules, NativeEventEmitter // ← AGREGADOS AQUÍ
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import useAppStore from '../../store/useAppStore';
import ModalCobro from '../../components/modals/ModalCobro';
import ModalModificadores from '../../components/modals/ModalModificadores';
import api, {
  getProductos, getCategorias, getOrdenes, getModificadores,
  crearOrden, actualizarOrden, agregarProductosAOrden, anularItemDeOrden,
} from '../../api/api';
const { NotificationModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(NotificationModule);
// ─── Hook de tema ─────────────────────────────────────────────
const useTema = () => {
  const { configuracionGlobal } = useAppStore();
  const isDark = configuracionGlobal?.temaFondo !== 'light';
  const color  = configuracionGlobal?.colorPrimario || '#ff5a1f';
  return {
    isDark, color,
    bg:        isDark ? '#0a0a0a' : '#f4f4f5',
    bgCard:    isDark ? '#141414' : '#ffffff',
    bgCard2:   isDark ? '#1a1a1a' : '#f3f4f6',
    bgInput:   isDark ? '#111111' : '#f9fafb',
    border:    isDark ? '#222222' : '#e5e7eb',
    border2:   isDark ? '#333333' : '#d1d5db',
    textPrim:  isDark ? '#ffffff' : '#111111',
    textSec:   isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#4b5563' : '#9ca3af',
  };
};

// ─── PosScreen principal ──────────────────────────────────────
export default function PosScreen({ mesaId, onVolver }) {
  const t = useTema();
  const [modalCobroVisible, setModalCobroVisible] = useState(false);
  const esParaLlevar = typeof mesaId === 'object' && mesaId?.id === 'llevar';
  const nombreLlevar = typeof mesaId === 'object' ? mesaId.cliente : '';
  const mesaIdReal   = esParaLlevar ? null : (typeof mesaId === 'object' ? mesaId.id : mesaId);

  const [productos, setProductos]       = useState([]);
  const [categorias, setCategorias]     = useState([]);
  const [ordenActiva, setOrdenActiva]   = useState(null);
  const [carrito, setCarrito]           = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [procesando, setProcesando]     = useState(false);
  const [busqueda, setBusqueda]         = useState('');
  const [busquedaActiva, setBusquedaActiva] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState('todas');
  const [carritoAbierto, setCarritoAbierto]   = useState(false);
  const [mostrarExito, setMostrarExito]       = useState(false);
  const [sedeId, setSedeId]             = useState('');
  const [negocioId, setNegocioId]       = useState('');
  const [empleadoNombre, setEmpleadoNombre] = useState('');
  const [productoParaVariar, setProductoParaVariar] = useState(null);
  const [modalVariacionesVisible, setModalVariacionesVisible] = useState(false);

  // ─── Sesión ───────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const sid    = await EncryptedStorage.getItem('sede_id');
      const nid    = await EncryptedStorage.getItem('negocio_id');
      const enombre = await EncryptedStorage.getItem('empleado_nombre');
      if (sid) setSedeId(sid);
      if (nid) setNegocioId(nid);
      if (enombre) setEmpleadoNombre(enombre);
    };
    init();
  }, []);

  // ─── Cargar datos ─────────────────────────────────────────
  const [modificadores, setModificadores] = useState([]);

  const cargarDatos = useCallback(async () => {
    if (!sedeId || !negocioId) return;
    setCargando(true);
    try {
      const [resProd, resCat, resOrdenes, resMods] = await Promise.all([
        getProductos({ negocio_id: negocioId, sede_id: sedeId, disponible: true }),
        getCategorias({ negocio_id: negocioId }),
        !esParaLlevar && mesaIdReal
          ? getOrdenes({ negocio_id: negocioId, sede_id: sedeId, mesa: mesaIdReal, estado: 'preparando' })
          : Promise.resolve({ data: [] }),
        getModificadores({ negocio_id: negocioId }),
      ]);

      setProductos(resProd.data || []);
      setCategorias(resCat.data || []);
      setModificadores(resMods.data || []);

      const ordenes = resOrdenes.data || [];
      console.warn('MESA:', mesaIdReal, '| ÓRDENES:', JSON.stringify(ordenes.map(o => ({ id: o.id, mesa: o.mesa }))))
      if (ordenes.length > 0) setOrdenActiva(ordenes[0]);

    } catch (e) {
      console.error('Error cargando POS:', e);
    } finally {
      setCargando(false);
    }
  }, [sedeId, negocioId, mesaIdReal, esParaLlevar]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  useEffect(() => {
    const subscripcion = eventEmitter.addListener('PagoYapeRecibido', (mensaje) => {
      console.log('✅ Yape detectado desde Kotlin:', mensaje);

      // 1. Cerramos el modal de cobro y el drawer del carrito si estaban abiertos
      setModalCobroVisible(false);
      setCarritoAbierto(false);

      // 2. Vaciamos el carrito local
      setCarrito([]);

      // 3. Mostramos tu modal de éxito verde con el check
      setMostrarExito(true);

      // 4. Esperamos 2 segundos para que el cajero vea el éxito, y lo devolvemos a las mesas
      setTimeout(() => {
        setMostrarExito(false);
        onVolver();
      }, 2000);
    });

    // Apagamos la antena si el componente se desmonta
    return () => {
      subscripcion.remove();
    };
  }, [onVolver]);
  // ─── Carrito helpers ──────────────────────────────────────
  const totalCarrito      = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const totalOrdenActiva  = ordenActiva
    ? ordenActiva.detalles.reduce((s, d) => s + parseFloat(d.precio_unitario || 0) * (d.cantidad || 1), 0)
    : 0;
  const totalMesa  = totalCarrito + totalOrdenActiva;
  const cantItems  = carrito.reduce((s, i) => s + i.cantidad, 0)
    + (ordenActiva?.detalles.reduce((s, d) => s + d.cantidad, 0) || 0);

  const agregarAlCarrito = (producto) => {
    // Solo forzar modal si la selección es OBLIGATORIA
    if (producto.requiere_seleccion) {
      setProductoParaVariar(producto);
      setModalVariacionesVisible(true);
      return;
    }

    // Producto estándar (con o sin variaciones opcionales) → agrega directo
    const cartId = `base_${producto.id}`;
    setCarrito(prev => {
      const existe = prev.find(i => i.cart_id === cartId);
      if (existe) return prev.map(i => i.cart_id === cartId ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, {
        cart_id:   cartId,
        id:        producto.id,
        nombre:    producto.nombre,
        precio:    parseFloat(producto.precio_base || producto.precio_minimo || 0),
        cantidad:  1,
        imagen:    producto.imagen,
        opciones_seleccionadas: [],
        notas_cocina: '',
      }];
    });
  };

  const agregarConVariaciones = (productoConOpciones) => {
    const cartId = `var_${productoConOpciones.id}_${Date.now()}`;
    setCarrito(prev => [...prev, {
      cart_id:   cartId,
      id:        productoConOpciones.id,
      nombre:    productoConOpciones.nombre,
      precio:    parseFloat(productoConOpciones.precio_base || 0),
      cantidad:  1,
      imagen:    productoConOpciones.imagen,
      opciones_seleccionadas: productoConOpciones.opciones_seleccionadas || [],
      notas_cocina: productoConOpciones.notas_cocina || '',
    }]);
  };

  const restarDelCarrito = (cartId) => {
    setCarrito(prev => {
      const item = prev.find(i => i.cart_id === cartId);
      if (!item) return prev;
      if (item.cantidad <= 1) return prev.filter(i => i.cart_id !== cartId);
      return prev.map(i => i.cart_id === cartId ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  };

  const sumarUnidad = (cartId) => {
    setCarrito(prev => prev.map(i => i.cart_id === cartId ? { ...i, cantidad: i.cantidad + 1 } : i));
  };

  const cantidadSimple = (productoId) => {
    return carrito.filter(i => i.id === productoId).reduce((s, i) => s + i.cantidad, 0);
  };

  // ─── Filtros ──────────────────────────────────────────────
  const productosFiltrados = productos.filter(p => {
    const matchBusqueda  = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchCategoria = categoriaActiva === 'todas' || String(p.categoria) === String(categoriaActiva);
    return matchBusqueda && matchCategoria && p.disponible;
  });

  // ─── Enviar a cocina ──────────────────────────────────────
  const enviarACocina = async () => {
    if (carrito.length === 0) return;
    setProcesando(true);
    try {
      const detalles = carrito.map(item => ({
        producto:              item.id,
        cantidad:              item.cantidad,
        precio_unitario:       item.precio,
        notas_cocina:          item.notas_cocina || '',
        notas_y_modificadores: '',
        // El backend lee las opciones con keys distintas según el endpoint:
        //   crearOrden (perform_create) → 'opciones'
        //   agregar_productos           → 'opciones_seleccionadas'
        // Mandamos ambas para que el precio de la variación se calcule siempre.
        opciones:               item.opciones_seleccionadas || [],
        opciones_seleccionadas: item.opciones_seleccionadas || [],
      }));

      if (ordenActiva) {
        const res = await agregarProductosAOrden(ordenActiva.id, { detalles });
        setOrdenActiva(res.data.orden || res.data);
      } else {
        const payload = {
          sede:           sedeId,
          mesa:           esParaLlevar ? null : mesaIdReal,
          tipo:           esParaLlevar ? 'llevar' : 'salon',
          estado:         'preparando',
          total:          totalCarrito,
          cliente_nombre: esParaLlevar ? nombreLlevar : '',
          detalles,
        };
        const res = await crearOrden(payload);
        setOrdenActiva(res.data.orden || res.data);
      }

      setCarrito([]);
      setCarritoAbierto(false);
      setMostrarExito(true);
      setTimeout(() => { setMostrarExito(false); onVolver(); }, 2000);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo enviar a cocina.');
    } finally {
      setProcesando(false);
    }
  };

  // ─── Anular item ──────────────────────────────────────────
  const anularItem = (detalle) => {
    Alert.alert(
      'Anular plato',
      `¿Anular "${detalle.producto_nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Anular', style: 'destructive',
          onPress: async () => {
            try {
              const res = await anularItemDeOrden(ordenActiva.id, {
                detalle_id:      detalle.id,
                motivo:          'Anulado desde app',
                empleado_nombre: empleadoNombre || 'Staff',
              });
              setOrdenActiva(res.data.orden || res.data);
            } catch (e) { Alert.alert('Error', e?.response?.data?.error || 'No se pudo anular.'); }
          },
        },
      ]
    );
  };

  // ─── Cobrar ───────────────────────────────────────────────
  const cobrar = async () => {
    if (!ordenActiva) return;
    try {
      const sesionCajaId = await EncryptedStorage.getItem('sesion_caja_id');
      await api.post(`/ordenes/${ordenActiva.id}/cobrar_orden/`, {
        pagos: [{ monto: totalMesa, metodo: 'efectivo' }],
        sesion_caja_id: sesionCajaId,
      });
      setCarrito([]);
      setCarritoAbierto(false);
      onVolver();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo cobrar.');
    }
  };

  // ─── Render producto ──────────────────────────────────────
  const renderProducto = ({ item }) => {
    const cant = cantidadSimple(item.id);
    const tieneVariaciones = item.grupos_variacion?.length > 0 || item.requiere_seleccion;
    const precioMin = parseFloat(item.precio_minimo || item.precio_base || 0);
    const precioMax = parseFloat(item.precio_maximo || item.precio_base || 0);

    // ✅ Solo mostrar precio si hay uno válido
    const mostrarPrecio = precioMin > 0;
    const mostrarDesde  = tieneVariaciones && precioMin !== precioMax && precioMin > 0;

    const catNombre = categorias.find(c => String(c.id) === String(item.categoria))?.nombre || '';

    return (
      <TouchableOpacity
        style={[s.prodCard, { backgroundColor: t.bgCard, borderColor: cant > 0 ? t.color : t.border }]}
        onPress={() => agregarAlCarrito(item)}
        activeOpacity={0.8}
      >
        {item.imagen ? (
          <Image source={{ uri: item.imagen }} style={s.prodImg} resizeMode="cover" />
        ) : (
          <View style={[s.prodImgPlaceholder, { backgroundColor: t.bgCard2 }]}>
            <Icon name="cutlery" size={20} color={t.textMuted} />
          </View>
        )}

        <View style={s.prodBody}>
          {catNombre ? <Text style={[s.prodCateg, { color: t.textMuted }]}>{catNombre.toUpperCase()}</Text> : null}
          <Text style={[s.prodNombre, { color: t.textPrim }]} numberOfLines={2}>{item.nombre}</Text>
          {item.es_combo && (
            <View style={[s.comboBadge, { backgroundColor: `${t.color}20`, borderColor: `${t.color}30` }]}>
              <Text style={[s.comboBadgeText, { color: t.color }]}>COMBO</Text>
            </View>
          )}
          {mostrarPrecio && (
            <Text style={[s.prodPrecio, { color: t.color }]}>
              {mostrarDesde ? <Text style={{ fontSize: 10 }}>Desde </Text> : null}
              S/ {precioMin.toFixed(2)}
            </Text>
          )}
        </View>

        {/* Parte inferior */}
        {cant > 0 && !item.requiere_seleccion ? (
          <View style={s.prodCantRow}>
            <TouchableOpacity
              style={[s.prodCantBtn, { backgroundColor: t.bgCard2, borderColor: t.border }]}
              onPress={() => restarDelCarrito(`base_${item.id}`)}
            >
              <Icon name="minus" size={12} color={t.textSec} />
            </TouchableOpacity>
            <View style={[s.prodCantBadge, { backgroundColor: t.color }]}>
              <Text style={s.prodCantNum}>{cant}</Text>
            </View>
            <TouchableOpacity
              style={[s.prodCantBtn, { backgroundColor: t.color }]}
              onPress={() => agregarAlCarrito(item)}
            >
              <Icon name="plus" size={12} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.prodCantBtn, { backgroundColor: t.bgCard2, borderColor: t.border, marginLeft: 2 }]}
              onPress={() => { setProductoParaVariar(item); setModalVariacionesVisible(true); }}
            >
              <Icon name="comment" size={12} color={t.textSec} />
            </TouchableOpacity>
          </View>
        ) : item.tiene_variaciones && !item.requiere_seleccion ? (
          <TouchableOpacity
            style={[s.opcionesBtn, { backgroundColor: `${t.color}15`, borderColor: `${t.color}40` }]}
            onPress={() => { setProductoParaVariar(item); setModalVariacionesVisible(true); }}
            activeOpacity={0.8}
          >
            <Icon name="sliders" size={11} color={t.color} style={{ marginRight: 6 }} />
            <Text style={[s.opcionesBtnText, { color: t.color }]}>+ CON OPCIONES</Text>
          </TouchableOpacity>
        ) : item.requiere_seleccion ? (
          <TouchableOpacity
            style={[s.opcionesBtn, { backgroundColor: `${t.color}15`, borderColor: `${t.color}40` }]}
            onPress={() => agregarAlCarrito(item)}
            activeOpacity={0.8}
          >
            <Icon name="list" size={11} color={t.color} style={{ marginRight: 6 }} />
            <Text style={[s.opcionesBtnText, { color: t.color }]}>VER OPCIONES</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.prodCantRow, { justifyContent: 'flex-end' }]}>
            <TouchableOpacity
              style={[s.prodCantBtn, { backgroundColor: t.bgCard2, borderColor: t.border }]}
              onPress={() => { setProductoParaVariar(item); setModalVariacionesVisible(true); }}
            >
              <Icon name="comment" size={12} color={t.textSec} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (cargando) {
    return (
      <View style={[s.loader, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.color} />
        <Text style={[s.loaderText, { color: t.textMuted }]}>SINCRONIZANDO CAJA...</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bgCard} />

      {/* ─── HEADER ─────────────────────────────────────── */}
      <View style={[s.header, { backgroundColor: t.bgCard, borderBottomColor: t.border }]}>
        <View style={s.headerTop}>
          {/* Botón volver */}
          <TouchableOpacity
            onPress={onVolver}
            style={[s.backBtn, { backgroundColor: t.bgCard2, borderColor: t.border }]}
            activeOpacity={0.7}
          >
            <Icon name="angle-left" size={20} color={t.textSec} />
          </TouchableOpacity>

          {/* Título o búsqueda */}
          {busqueda !== null && busquedaActiva ? (
            <View style={s.searchActiveRow}>
              <TextInput
                style={[s.searchActiveInput, { backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
                value={busqueda}
                onChangeText={setBusqueda}
                placeholder="Buscar plato..."
                placeholderTextColor={t.textMuted}
                autoFocus
              />
              <TouchableOpacity onPress={() => { setBusquedaActiva(false); setBusqueda(''); }}>
                <Icon name="times" size={18} color={t.textSec} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.headerTituloRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.headerSubtipo, { color: t.textMuted }]}>
                  {esParaLlevar ? '🛵 DELIVERY' : '🍽 SALÓN'}
                </Text>
                <Text style={[s.headerTitulo, { color: t.textPrim }]} numberOfLines={1}>
                  {esParaLlevar ? nombreLlevar.toUpperCase() : `MESA ${mesaIdReal}`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setBusquedaActiva(true)}
                style={[s.backBtn, { backgroundColor: t.bgCard2, borderColor: t.border }]}
                activeOpacity={0.7}
              >
                <Icon name="search" size={16} color={t.textSec} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Categorías */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' }}
        >
          {[{ id: 'todas', nombre: 'TODAS' }, ...categorias].map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                s.categPill,
                { borderColor: t.border, backgroundColor: 'transparent' },
                String(categoriaActiva) === String(cat.id) && { backgroundColor: t.color, borderColor: t.color },
              ]}
              onPress={() => setCategoriaActiva(String(cat.id))}
              activeOpacity={0.8}
            >
              <Text style={[
                s.categText,
                { color: t.textMuted },
                String(categoriaActiva) === String(cat.id) && { color: '#fff' },
              ]}>
                {cat.nombre}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ─── GRID DE PRODUCTOS ───────────────────────────── */}
      <FlatList
        data={productosFiltrados}
        renderItem={renderProducto}
        keyExtractor={item => String(item.id)}
        numColumns={2}
        contentContainerStyle={[s.prodGrid, { paddingBottom: (carrito.length > 0 || ordenActiva) ? 100 : 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[s.emptyState, { borderColor: t.border }]}>
            <Icon name="cutlery" size={32} color={t.textMuted} />
            <Text style={[s.emptyTitulo, { color: t.textPrim }]}>Sin productos</Text>
          </View>
        }
      />

      {/* ─── FOOTER ──────────────────────────────────────── */}
      {(carrito.length > 0 || ordenActiva) && (
        <View style={[s.footer, { backgroundColor: t.bgCard, borderTopColor: t.border }]}>
          
          {/* Botón Ver Cuenta */}
          <TouchableOpacity
            style={[s.footerVerCuenta, { 
              backgroundColor: t.bgCard2, 
              borderColor: t.border,
              opacity: cantItems === 0 ? 0.4 : 1 
            }]}
            onPress={() => setCarritoAbierto(true)}
            disabled={cantItems === 0}
            activeOpacity={0.8}
          >
            {/* Badge cantidad */}
            <View style={[s.footerBadge, { backgroundColor: t.color }]}>
              <Text style={s.footerBadgeText}>{cantItems}</Text>
            </View>

            {/* Label */}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.footerVerLabel, { color: t.textPrim }]}>VER CUENTA</Text>
            </View>

            {/* Total */}
            <Text style={[s.footerVerTotal, { color: t.color }]}>
              S/ {totalMesa.toFixed(2)}
            </Text>
          </TouchableOpacity>

          {/* Botón Enviar a cocina */}
          <TouchableOpacity
            style={[
              s.footerEnviar,
              { backgroundColor: carrito.length > 0 ? t.color : t.bgCard2 },
              procesando && { opacity: 0.6 },
            ]}
            onPress={carrito.length > 0 ? enviarACocina : () => setModalCobroVisible(true)}
            disabled={procesando || (carrito.length === 0 && !ordenActiva)}
            activeOpacity={0.8}
          >
            {procesando ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : carrito.length > 0 ? (
              <>
                <Text style={[s.footerEnviarText, { color: '#fff' }]}>ENVIAR</Text>
                <Icon name="paper-plane" size={14} color="#fff" style={{ marginLeft: 6 }} />
              </>
            ) : ordenActiva ? (
              <>
                <Text style={[s.footerEnviarText, { color: '#fff' }]}>COBRAR</Text>
                <Icon name="money" size={14} color="#fff" style={{ marginLeft: 6 }} />
              </>
            ) : null}
          </TouchableOpacity>

        </View>
      )}

      {/* ─── DRAWER CARRITO ──────────────────────────────── */}
      <Modal visible={carritoAbierto} animationType="slide" transparent onRequestClose={() => setCarritoAbierto(false)}>
        <View style={s.carritoOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setCarritoAbierto(false)} />
          <View style={[s.carritoDrawer, { backgroundColor: t.bgCard, borderTopColor: t.border }]}>

            {/* Handle */}
            <TouchableOpacity style={s.handle} onPress={() => setCarritoAbierto(false)}>
              <View style={[s.handleBar, { backgroundColor: t.border2 }]} />
            </TouchableOpacity>

            {/* Header carrito */}
            <View style={[s.carritoHeader, { borderBottomColor: t.border }]}>
              <View>
                <Text style={[s.carritoTotalLabel, { color: t.textSec }]}>TOTAL DE LA CUENTA</Text>
                <Text style={[s.carritoTotalMonto, { color: t.textPrim }]}>S/ {totalMesa.toFixed(2)}</Text>
                <Text style={[s.carritoCantLabel, { color: t.textSec }]}>{cantItems} artículos</Text>
              </View>
              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => setCarritoAbierto(false)} style={[s.carritoCloseBtn, { backgroundColor: t.bgCard2 }]}>
                  <Icon name="times" size={14} color={t.textSec} />
                </TouchableOpacity>
                {carrito.length > 0 && (
                  <TouchableOpacity
                    style={[s.vaciarBtn, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }]}
                    onPress={() => setCarrito([])}
                  >
                    <Icon name="trash" size={10} color="#ef4444" style={{ marginRight: 4 }} />
                    <Text style={s.vaciarBtnText}>Vaciar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

              {/* Items en cocina */}
              {ordenActiva && ordenActiva.detalles.length > 0 && (
                <View style={{ marginBottom: 20 }}>
                  <View style={s.seccionHeader}>
                    <Icon name="fire" size={10} color={t.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[s.seccionLabel, { color: t.textMuted }]}>YA EN COCINA</Text>
                    <View style={[s.seccionLinea, { backgroundColor: t.border }]} />
                  </View>
                    {ordenActiva.detalles.map(detalle => (
                      <View key={detalle.id} style={[s.carritoItem, { backgroundColor: t.bgCard2, borderColor: t.border, opacity: 0.85 }]}>
                        <View style={[s.carritoItemCant, { backgroundColor: t.bgCard }]}>
                          <Text style={[s.carritoItemCantNum, { color: t.textSec }]}>{detalle.cantidad}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[s.carritoItemNombre, { color: t.textPrim }]}>
                            {detalle.producto_nombre}
                          </Text>
                          {/* ✅ Mostrar opciones elegidas */}
                          {detalle.notas_cocina ? (
                            <Text style={{ fontSize: 11, color: t.color, marginTop: 2 }}>
                              {detalle.notas_cocina}
                            </Text>
                          ) : null}
                          <Text style={[s.carritoItemPrecio, { color: t.textSec }]}>
                            S/ {(parseFloat(detalle.precio_unitario) * detalle.cantidad).toFixed(2)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={s.anularBtn}
                          onPress={() => anularItem(detalle)}
                        >
                          <Icon name="trash" size={12} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                </View>
              )}

              {/* Nuevos items */}
              {carrito.length > 0 && (
                <View>
                  <View style={s.seccionHeader}>
                    <View style={[s.seccionDot, { backgroundColor: t.color }]} />
                    <Text style={[s.seccionLabel, { color: t.color }]}>NUEVOS PEDIDOS</Text>
                    <View style={[s.seccionLinea, { backgroundColor: `${t.color}40` }]} />
                  </View>
                  {carrito.map(item => (
                    <View key={item.cart_id} style={[s.carritoItem, { backgroundColor: t.bgCard2, borderColor: t.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.carritoItemNombre, { color: t.textPrim }]}>{item.nombre}</Text>
                        {item.notas_cocina ? (
                          <Text style={[{ fontSize: 11, color: t.color, marginTop: 2 }]}>{item.notas_cocina}</Text>
                        ) : null}
                        <Text style={[s.carritoItemPrecio, { color: t.color }]}>
                          S/ {(item.precio * item.cantidad).toFixed(2)}
                        </Text>
                      </View>
                      <View style={s.cantRow}>
                        <TouchableOpacity
                          style={[s.cantBtn, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }]}
                          onPress={() => restarDelCarrito(item.cart_id)}
                        >
                          <Icon name="minus" size={10} color="#ef4444" />
                        </TouchableOpacity>
                        <Text style={[s.cantNum, { color: t.textPrim }]}>{item.cantidad}</Text>
                        <TouchableOpacity
                          style={[s.cantBtn, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' }]}
                          onPress={() => sumarUnidad(item.cart_id)}
                        >
                          <Icon name="plus" size={10} color="#10b981" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {cantItems === 0 && (
                <View style={[s.carritoVacio, { borderColor: t.border }]}>
                  <Icon name="shopping-cart" size={36} color={t.textMuted} />
                  <Text style={[s.carritoVacioText, { color: t.textSec }]}>Carrito vacío</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer carrito */}
            <View style={[s.carritoFooter, { borderTopColor: t.border }]}>
              {carrito.length > 0 && (
                <TouchableOpacity
                  style={[s.btnEnviarCocina, { backgroundColor: t.color }, procesando && { opacity: 0.6 }]}
                  onPress={enviarACocina}
                  disabled={procesando}
                  activeOpacity={0.8}
                >
                  {procesando
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Icon name="paper-plane" size={16} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={s.btnEnviarCocinaText}>ENVIAR A COCINA</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
              {ordenActiva && carrito.length === 0 && totalMesa > 0 && (
                <TouchableOpacity
                  style={[s.btnEnviarCocina, { backgroundColor: '#10b981' }]}
                  onPress={() => { setCarritoAbierto(false); setModalCobroVisible(true); }}  // ← abrir modal
                  activeOpacity={0.8}
                >
                  <Icon name="money" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={s.btnEnviarCocinaText}>COBRAR TICKET</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      <ModalCobro
        visible={modalCobroVisible}
        onClose={(info) => {
          setModalCobroVisible(false);
          if (info?.pagado) onVolver();
        }}
        total={totalMesa}
        ordenId={ordenActiva?.id}
        carrito={ordenActiva?.detalles || []}
        onCobroExitoso={async ({ pagos, telefono }) => {
          // Persiste el cobro y devuelve el ordenId real. NO cierra ni navega:
          // de eso se encarga onClose (tras Finalizar / Cerrar / emitir comprobante).
          try {
            const sesionCajaId = await EncryptedStorage.getItem('sesion_caja_id');

            // 1. Filtramos solo los pagos que NO han sido confirmados por Yape/Plin nativo
            const pagosManuales = pagos.filter(p => !p.yaConfirmado);

            // 2. Ejecutamos el POST siempre para procesar el cierre y el teléfono
            await api.post(`/ordenes/${ordenActiva.id}/cobrar_orden/`, {
              pagos: pagosManuales, // Si fue Yape puro, enviará un arreglo vacío [] y no duplicará caja
              telefono,             // Aquí viaja el número de WhatsApp para guardarse en la BD
              sesion_caja_id: sesionCajaId,
            });

            return { ordenId: ordenActiva.id };
          } catch (err) {
            console.error(err);
            Alert.alert('Error', err?.response?.data?.error || 'No se pudo registrar los datos del cierre.');
            throw err; // evita avanzar a comprobante/cierre si el cobro falló
          }
        }}
      />
      {/* ─── MODAL VARIACIONES ───────────────────────────── */}
      <ModalModificadores
        visible={modalVariacionesVisible}
        producto={productoParaVariar}
        modificadoresGlobales={modificadores}
        onAgregarAlCarrito={(item, esEdicion) => {
          const cartId = esEdicion ? item.cart_id : `var_${item.id}_${Date.now()}`;
          const precioFinal = parseFloat(
            item.precio_unitario_calculado || 
            item.precio || 
            item.precio_base || 
            0
          );
          if (esEdicion) {
            setCarrito(prev => prev.map(i => 
              i.cart_id === cartId ? { ...item, cart_id: cartId, precio: precioFinal } : i
            ));
          } else {
            
            setCarrito(prev => [...prev, {
              cart_id:               cartId,
              id:                    item.id,
              nombre:                item.nombre,
              precio:                precioFinal,
              cantidad:              item.cantidad || 1,
              imagen:                item.imagen,
              opciones_seleccionadas: item.opciones_seleccionadas || [],
              notas_cocina:          item.notas_cocina || '',
            }]);
          }
        }}
        onClose={() => setModalVariacionesVisible(false)}
      />

      {/* ─── MODAL ÉXITO ─────────────────────────────────── */}
      <Modal visible={mostrarExito} transparent animationType="fade">
        <View style={s.exitoOverlay}>
          <View style={[s.exitoCard, { backgroundColor: t.bgCard, borderColor: `${t.color}4D` }]}>
            <View style={[s.exitoCheck, { shadowColor: '#10b981' }]}>
              <Icon name="check" size={36} color="#fff" />
            </View>
            <Text style={[s.exitoTitulo, { color: t.textPrim }]}>Pedido Enviado</Text>
            <Text style={[s.exitoSub, { color: t.textSec }]}>La cocina ya está en marcha.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container:     { flex: 1 },
  loader:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loaderText:    { fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  header:          { borderBottomWidth: 1 },
  headerTop:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 8, paddingBottom: 8, gap: 10 },
  backBtn:         { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTituloRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerSubtipo:   { fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  headerTitulo:    { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  searchActiveRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchActiveInput: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontWeight: '600' },
    
  searchRow:     { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  searchBox:     { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput:   { flex: 1, fontSize: 14, fontWeight: '500' },

  categScroll:   { maxHeight: 52, borderBottomWidth: 1 },
  categPill:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  categText:     { fontSize: 16, fontWeight: '500' },

  prodGrid:      { paddingHorizontal: 8, paddingTop: 10 },
  prodCard:      { 
    flex: 1, margin: 5, borderRadius: 20, borderWidth: 1.5, 
    overflow: 'hidden', minHeight: 160,  // ← altura fija
    justifyContent: 'space-between',
  },  
  prodImg:       { width: '100%', height: 90 },
  prodImgPlaceholder: { 
    width: '100%', height: 80,           // ← reducir si no hay imagen
    alignItems: 'center', justifyContent: 'center' 
  },  
  prodBody:      { 
    padding: 10, gap: 4, flex: 1        // ← flex: 1 para ocupar espacio
  },
  prodCateg:     { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  prodNombre:    { fontSize: 13, fontWeight: '800', lineHeight: 18 },
  prodPrecio:    { fontSize: 14, fontWeight: '900' },
  varBadge:      { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1, marginTop: 2 },
  varBadgeText:  { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  prodCantRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 10, gap: 4 },
  
  prodCantBtn:   { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  prodCantBadge: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prodCantNum:   { color: '#fff', fontSize: 14, fontWeight: '900' },
  
  prodAddBtn:    { marginHorizontal: 10, marginBottom: 10, borderRadius: 10, borderWidth: 1, paddingVertical: 7, alignItems: 'center' },
  comboBadge:     { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  comboBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  emptyState:    { padding: 40, alignItems: 'center', borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', margin: 20, gap: 8 },
  emptyTitulo:   { fontSize: 15, fontWeight: '900' },

  footer:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, gap: 10, position: 'absolute', bottom: 25, left: 0, right: 0 },
  footerVerCuenta: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14 },
  footerBadge:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footerBadgeText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  footerVerLabel:  { fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  footerVerTotal:  { fontSize: 18, fontWeight: '900' },
  footerEnviar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 25, paddingHorizontal: 20, borderRadius: 16, minWidth: 110 },
  footerEnviarText:{ color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
    
  carritoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  carritoDrawer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    height: '88%',
  },
  handle:         { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  handleBar:      { width: 48, height: 4, borderRadius: 2 },
  carritoHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1 },
  carritoTotalLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  carritoTotalMonto: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  carritoCantLabel:  { fontSize: 11, fontWeight: '600', marginTop: 4 },
  carritoCloseBtn:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  vaciarBtn:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  vaciarBtnText:  { fontSize: 10, fontWeight: '700', color: '#ef4444' },

  seccionHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  seccionDot:     { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  seccionLabel:   { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginRight: 8 },
  seccionLinea:   { flex: 1, height: 1 },

  carritoItem:    { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 8 },
  carritoItemCant: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  carritoItemCantNum: { fontSize: 16, fontWeight: '900' },
  carritoItemNombre: { fontSize: 14, fontWeight: '700' },
  carritoItemPrecio: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  anularBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },

  cantRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cantBtn:        { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cantNum:        { fontSize: 15, fontWeight: '900', minWidth: 22, textAlign: 'center' },

  carritoVacio:   { padding: 40, alignItems: 'center', borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', marginTop: 20, gap: 8 },
  carritoVacioText: { fontSize: 14, fontWeight: '700' },

  carritoFooter:  { padding: 16, borderTopWidth: 1, gap: 10 },
  btnEnviarCocina: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 18, paddingVertical: 18 },
  btnEnviarCocinaText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  opcionesBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8, marginBottom: 10, borderRadius: 10, borderWidth: 1, paddingVertical: 8 },
  opcionesBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  exitoOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  exitoCard:     { padding: 40, borderRadius: 28, borderWidth: 1, alignItems: 'center', minWidth: 240 },
  exitoCheck:    { width: 80, height: 80, borderRadius: 40, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginBottom: 16, elevation: 10 },
  exitoTitulo:   { fontSize: 24, fontWeight: '900', marginBottom: 4 },
  exitoSub:      { fontSize: 13, textAlign: 'center' },
});