import axios from 'axios';
import EncryptedStorage from 'react-native-encrypted-storage';

const BASE_URL = __DEV__
  ? 'https://pos.leybrak.com/api'
  : 'https://pos.leybrak.com/api';

let onLogoutCallback = null;
export const setLogoutCallback = (fn) => { onLogoutCallback = fn; };

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Token helpers ────────────────────────────────────────────
export const guardarTokens = async (access, refresh) => {
  await EncryptedStorage.setItem('access_token', access);
  await EncryptedStorage.setItem('refresh_token', refresh);
};

export const limpiarTokens = async () => {
  await EncryptedStorage.removeItem('access_token');
  await EncryptedStorage.removeItem('refresh_token');
  await EncryptedStorage.removeItem('negocio_id');
  await EncryptedStorage.removeItem('empleado_id');
  await EncryptedStorage.removeItem('sede_id');
  await EncryptedStorage.removeItem('usuario_rol');
};

export const getAccessToken = async () =>
  await EncryptedStorage.getItem('access_token');

// ─── Interceptor REQUEST ──────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const empleadoId = await EncryptedStorage.getItem('empleado_id');
    if (empleadoId) config.headers['X-Empleado-ID'] = empleadoId;

    // ✅ Auto-inyectar sede_id en GETs (igual que la web)
    const sedeId = await EncryptedStorage.getItem('sede_id');
    const tieneSedeEnUrl    = config.url?.includes('sede_id=') || config.url?.includes('sede=');
    const tieneSedeEnParams = config.params?.sede_id || config.params?.sede;
    const tieneNegocioEnParams = config.params?.negocio_id;
    const esRutaGlobal      = config.url?.includes('negocios');

    if (
      sedeId &&
      config.method === 'get' &&
      !tieneSedeEnUrl &&
      !tieneSedeEnParams &&
      !esRutaGlobal &&
      !tieneNegocioEnParams
    ) {
      const sep = config.url?.includes('?') ? '&' : '?';
      config.url = `${config.url}${sep}sede_id=${sedeId}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Interceptor RESPONSE — refresh automático ───────────────
let estaRefrescando = false;
let colaDeEspera = [];

const procesarCola = (error) => {
  colaDeEspera.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve()
  );
  colaDeEspera = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (estaRefrescando) {
        return new Promise((resolve, reject) =>
          colaDeEspera.push({ resolve, reject })
        ).then(() => api(original));
      }

      estaRefrescando = true;
      try {
        const refresh = await EncryptedStorage.getItem('refresh_token');
        if (!refresh) throw new Error('Sin refresh token');

        // ✅ Usa el endpoint móvil, no el de cookies
        const res = await axios.post(`${BASE_URL}/movil/refresh/`, { refresh });
        await EncryptedStorage.setItem('access_token', res.data.access);
        original.headers.Authorization = `Bearer ${res.data.access}`;
        procesarCola(null);
        return api(original);
      } catch (err) {
        procesarCola(err);
        await limpiarTokens();
        if (onLogoutCallback) onLogoutCallback();
      } finally {
        estaRefrescando = false;
      }
    }
    return Promise.reject(error);
  }
);

// ─── Versión de la app (forzar actualización) ────────────────
// Sin auth: el endpoint es público.
export const getAppVersion = () => axios.get(`${BASE_URL}/app/version/`);

// ─── Auth ─────────────────────────────────────────────────────
export const loginMovil = (credentials) =>
  axios.post(`${BASE_URL}/movil/login/`, credentials);

export const loginPinEmpleado = (payload) =>
  api.post('/empleados/login-pin/', payload);

export const verificarSesionEmpleado = () =>
  api.get('/empleados/verificar-sesion/');

// ─── Negocio ──────────────────────────────────────────────────
export const getNegocio        = (id)       => api.get(`/negocios/${id}/`);
export const actualizarNegocio = (id, data) => api.patch(`/negocios/${id}/`, data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});

// ─── Menú ─────────────────────────────────────────────────────
export const getProductos  = (params) => api.get('/productos/', { params });
export const getCategorias = (params) => api.get('/categorias/', { params });
export const crearProducto      = (data)     => api.post('/productos/', data);
export const actualizarProducto = (id, data) => api.put(`/productos/${id}/`, data);
export const parchearProducto   = (id, data) => api.patch(`/productos/${id}/`, data);
export const crearCategoria     = (data)     => api.post('/categorias/', data);
export const parchearCategoria  = (id, data) => api.patch(`/categorias/${id}/`, data);

// ─── Mesas y órdenes ─────────────────────────────────────────
export const getMesas              = (params)        => api.get('/mesas/', { params });
export const getOrdenes            = (params)        => api.get('/ordenes/', { params });
export const crearOrden            = (data)          => api.post('/ordenes/', data);
export const actualizarOrden       = (id, data)      => api.patch(`/ordenes/${id}/`, data);
export const agregarProductosAOrden = (id, payload)  => api.post(`/ordenes/${id}/agregar_productos/`, payload);
export const anularItemDeOrden     = (id, payload)   => api.post(`/ordenes/${id}/anular_item/`, payload);

// ─── Caja ─────────────────────────────────────────────────────
export const getEstadoCaja = (params)  => api.get('/sesiones_caja/estado_actual/', { params });
export const abrirCajaBD = async (payload) => {
  const sedeId = await EncryptedStorage.getItem('sede_id');
  const finalPayload = { ...payload, sede_id: payload.sede_id || sedeId };
  const res = await api.post('/sesiones_caja/abrir_caja/', finalPayload);
  return res;
};
export const cerrarCaja = async (data) => {
  const sedeId = await EncryptedStorage.getItem('sede_id');
  const res = await api.post('/sesiones_caja/cerrar_caja/', { ...data, sede_id: data.sede_id || sedeId });
  return res;
};
export const validarPinEmpleado = async (payload) => {
  const sedeId = await EncryptedStorage.getItem('sede_id');
  return api.post('/empleados/validar_pin/', { ...payload, sede_id: payload.sede_id || sedeId });
};
export const actualizarMesa = (id, data) => api.patch(`/mesas/${id}/`, data);

export const registrarMovimientoCaja = async (data) => {
  const sedeId = await EncryptedStorage.getItem('sede_id');
  return api.post('/movimientos-caja/', { ...data, sede_id: data.sede_id || sedeId });
};
// ─── Empleados y roles ────────────────────────────────────────
export const getEmpleados       = (params)   => api.get('/empleados/', { params });
export const crearEmpleado      = (data)     => api.post('/empleados/', data);
export const actualizarEmpleado = (id, data) => api.patch(`/empleados/${id}/`, data);
export const getRoles           = (params)   => api.get('/roles/', { params });

// ─── Sedes ────────────────────────────────────────────────────
export const getSedes       = (params)   => api.get('/sedes/', { params });
export const crearSede      = (data)     => api.post('/sedes/', data);
export const actualizarSede = (id, data) => api.patch(`/sedes/${id}/`, data);

// ─── Dashboard ────────────────────────────────────────────────
export const obtenerMetricasDashboard = (params) =>
  api.get('/dashboard/metricas/', { params });

// ─── Yape / Plin ─────────────────────────────────────────────
export const confirmarPagoYape = (data) => api.post('/yape/confirmar/', data);

// ─── Modificadores ───────────────────────────────────────────
export const getModificadores      = (params)   => api.get('/modificadores-rapidos/', { params });
export const crearModificador      = (data)     => api.post('/modificadores-rapidos/', data);
export const actualizarModificador = (id, data) => api.put(`/modificadores-rapidos/${id}/`, data);
export const eliminarModificador   = (id)       => api.delete(`/modificadores-rapidos/${id}/`);
// 🛠️ Antes forzaba tipo:'llevar' + estado:'preparando' — las órdenes
// 'delivery' del bot quedaban afuera y las 'pendiente'/'listo' también.
// El backend solo filtra por un valor exacto, así que acá no filtramos
// nada: SalonScreen se queda con lo que corresponda a "para llevar".
export const getOrdenesLlevar = (params) => api.get('/ordenes/', { params });

// ─── Soporte ────────────────────────────────────────────────────
export const crearTicket = (data) => api.post('/tickets-soporte/', data);

// ─── Inventario ───────────────────────────────────────────────
export const getCatalogoGlobal      = (params) => api.get('/insumo-base/', { params });
export const getInsumosSede         = (params) => api.get('/insumo-sede/', { params });
export const registrarIngresoMasivo = (data)   => api.post('/insumo-sede/ingreso_masivo/', data);

// ─── Recetas y variaciones de productos ────────────────────────
export const getReceta = (productoId) => api.get(`/productos/${productoId}/obtener_receta/`);
export const guardarReceta = (productoId, datosReceta) =>
  api.post(`/productos/${productoId}/configurar_receta/`, datosReceta);
export const actualizarVariacionesProducto = (productoId, gruposData) =>
  api.patch(`/productos/${productoId}/`, { grupos_variacion: gruposData });

// ─── CRM (clientes) ───────────────────────────────────────────
export const getClientes = (params) => api.get('/clientes/', { params });

// ─── Facturación electrónica (SUNAT) ─────────────────────────
export const emitirComprobante = (ordenId, payload) => api.post(`/ordenes/${ordenId}/emitir-comprobante/`, payload);
// Envía el ticket/boleta por WhatsApp (vía webhook de n8n → Evolution API).
export const enviarTicketWhatsapp = (ordenId, telefono) => api.post(`/ordenes/${ordenId}/enviar-ticket/`, { telefono });

// 🛵 Delivery — app del repartidor
export const getPedidosDelivery       = ()                 => api.get('/delivery/pedidos/');
export const tomarPedidoDelivery      = (ordenId)          => api.post(`/delivery/pedidos/${ordenId}/tomar/`);
export const actualizarEstadoDelivery = (ordenId, estado)  => api.post(`/delivery/pedidos/${ordenId}/estado/`, { estado });
export const avisarClienteDelivery     = (ordenId, mensaje) => api.post(`/delivery/pedidos/${ordenId}/avisar/`, { mensaje });
export const getComprobante    = (ordenId)          => api.get(`/ordenes/${ordenId}/comprobante/`);
export const getComprobantes   = (params)           => api.get('/comprobantes/', { params });
export const consultarRuc      = (ruc)              => api.get(`/negocios/consultar_ruc/${ruc}/`);
export const consultarDni      = (dni)              => api.get(`/negocios/consultar_dni/${dni}/`);
// Patch JSON de la config de facturación (no multipart, a diferencia de actualizarNegocio).
export const actualizarFacturacion = (id, data)     => api.patch(`/negocios/${id}/`, data);

export default api;