import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL;
const API_URL = `${apiUrl}/api`;

// ============================================================
// INSTANCIA PRINCIPAL (con interceptores)
// ============================================================
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,   // 🛡️ FIX #2: Necesario para enviar/recibir cookies HttpOnly
});

// ============================================================
// INSTANCIA PÚBLICA (sin token — para carta QR)
// ============================================================
const apiPublica = axios.create({ baseURL: API_URL });

// ============================================================
// HELPERS DE STORAGE
// ============================================================
// 🛡️ FIX #2: Los tokens JWT (access + refresh) ya NO se guardan en localStorage.
//    El backend los setea como cookies HttpOnly; Secure; SameSite=Lax.
//    Solo guardamos datos no-sensibles aquí.
const getEmpleadoId = () => localStorage.getItem('empleado_id');
const getSedeId     = () => localStorage.getItem('sede_id');
const getNegocioId  = () => localStorage.getItem('negocio_id');

// ⚠️  ELIMINADO: getToken() y getRefreshToken() ya no existen.
//    El token viaja automáticamente en la cookie HttpOnly, no en el header.

/** Limpia todo y redirige al login */
export const cerrarSesionGlobal = async () => {
  try {
    await axios.post(`${API_URL}/token/logout/`, {}, { withCredentials: true });
  } catch (_) {}
  
  localStorage.clear();
  
  // 🛡️ Solo redirige si NO estamos ya en la página principal
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  } else {
    window.location.reload(); // Refresca suavemente
  }
};

// ============================================================
// INTERCEPTOR DE REQUEST — adjunta empleado, sede y CSRF
// ============================================================
api.interceptors.request.use(
  (config) => {
    const empleadoId    = getEmpleadoId();
    const sedeIdSesion  = getSedeId();

    // 🛡️ FIX #2: Ya NO se adjunta el token JWT en el header Authorization.
    //    La cookie HttpOnly se envía automáticamente por el navegador.

    // Header de empleado activo (no-sensible, solo un ID)
    if (empleadoId) {
      config.headers['X-Empleado-ID'] = empleadoId;
    }

    // 🛡️ CSRF: axios con withCredentials no adjunta X-CSRFToken automáticamente.
    //    Lo leemos de la cookie 'csrftoken' (no HttpOnly) que Django setea.
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }

    // Inyección automática de sede en GETs
    const tieneSedeEnUrl    = config.url.includes('sede_id=') || config.url.includes('sede=');
    const tieneSedeEnParams = config.params?.sede_id || config.params?.sede;
    const esRutaGlobal      = config.url.includes('negocios');

    // 🔧 FIX: Si la request ya trae negocio_id en params (caso dueño viendo "Todas"),
    //    NO inyectamos sede_id para no pisar la intención del dueño de ver todo el negocio.
    const tieneNegocioEnParams = config.params?.negocio_id;

    if (
      sedeIdSesion &&
      config.method === 'get' &&
      !tieneSedeEnUrl &&
      !tieneSedeEnParams &&
      !esRutaGlobal &&
      !tieneNegocioEnParams  // 🔧 NUEVA CONDICIÓN
    ) {
      const sep = config.url.includes('?') ? '&' : '?';
      config.url = `${config.url}${sep}sede_id=${sedeIdSesion}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================================
// HELPER: leer valor de una cookie por nombre
// ============================================================
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

// ============================================================
// INTERCEPTOR DE RESPONSE — refresco automático de token
// ============================================================
let estaRefrescando = false;
let colaDeEspera    = [];

const procesarCola = (error, ok = true) => {
  colaDeEspera.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(ok);
  });
  colaDeEspera = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestOriginal = error.config;

    if (
      error.response?.status === 401 &&
      !requestOriginal._yaReintento &&
      !requestOriginal.url?.includes('token/refresh') &&
      !requestOriginal.url?.includes('verificar-sesion') 
    ) {
      requestOriginal._yaReintento = true;

      if (estaRefrescando) {
        return new Promise((resolve, reject) => {
          colaDeEspera.push({ resolve, reject });
        }).then(() => api(requestOriginal));
      }

      estaRefrescando = true;

      try {
        // 🛡️ FIX #2: El refresh token viaja en la cookie HttpOnly, no en el body.
        //    El endpoint /token/refresh/ lee la cookie 'refresh_token' directamente.
        await axios.post(
          `${API_URL}/token/refresh/`,
          {},
          { withCredentials: true }
        );

        procesarCola(null, true);
        return api(requestOriginal);

      } catch (errorRefresh) {
        procesarCola(errorRefresh);
        cerrarSesionGlobal();
        return Promise.reject(errorRefresh);

      } finally {
        estaRefrescando = false;
      }
    }

    return Promise.reject(error);
  }
);

// ============================================================
// LOGIN DEL DUEÑO
// ============================================================
export const loginAdministrador = async (credenciales) => {
  // 🛡️ FIX #2: El backend setea las cookies HttpOnly como respuesta.
  //    Ya NO llamamos a guardarTokens() — no hay nada que guardar en localStorage.
  const res = await axios.post(`${API_URL}/login-admin/`, credenciales, {
    withCredentials: true,
  });
  // Solo guardamos datos no-sensibles
  if (res.data.negocio_id) {
    localStorage.setItem('negocio_id', res.data.negocio_id);
  }
  return res;
};

// ============================================================
// WEBSOCKET — FIX #3: El token NO va en la URL
// ============================================================
/**
 * Crea una conexión WebSocket segura.
 * El token JWT se envía en la PRIMERA TRAMA después de conectar,
 * no en la URL (lo que lo expondría en logs y Referer headers).
 *
 * En el backend (middleware.py) debes leer el token del primer mensaje,
 * no del query string.
 *
 * @param {string} path - Ej: `/ws/salon/3/`
 * @returns {WebSocket}
 */
export const crearWebSocket = (path) => {
  const wsBase = import.meta.env.VITE_WS_URL;
  // 🛡️ FIX #3: Sin ?token=... en la URL
  const ws = new WebSocket(`${wsBase}${path}`);

  ws.addEventListener('open', () => {
    // Enviamos el token de autenticación en la primera trama,
    // que el middleware del backend leerá y validará.
    // El token viene de la cookie (el middleware lo lee server-side),
    // por lo que desde el frontend solo mandamos un "handshake" de autenticación.
    ws.send(JSON.stringify({ type: 'authenticate' }));
  });

  return ws;
};
// Reemplaza validarPinEmpleado
export const loginPinEmpleado = (payload) =>
  axios.post(`${API_URL}/empleados/login-pin/`, payload, { withCredentials: true });

export const verificarSesionEmpleado = () =>
  axios.get(`${API_URL}/empleados/verificar-sesion/`, { withCredentials: true });

// Refresca el JWT del dueño usando la cookie HttpOnly 'refresh_token'.
// Se usa en el arranque para revivir la sesión del dueño cuando el access token
// expiró pero el refresh sigue vigente (evita caer al PIN por error). No usa el
// interceptor (que excluye verificar-sesion para no entrar en bucle de recarga).
export const refrescarSesion = () =>
  axios.post(`${API_URL}/token/refresh/`, {}, { withCredentials: true });

// ============================================================
// CAJA Y LOGIN DE EMPLEADOS
// ============================================================
export const validarPinEmpleado      = (payload)  => api.post(`/empleados/validar_pin/`, { ...payload, sede_id: getSedeId() });
export const getEstadoCaja           = (params)   => api.get(`/sesiones_caja/estado_actual/`, { params });
export const abrirCajaBD             = (payload)  => api.post(`/sesiones_caja/abrir_caja/`, { ...payload, sede_id: getSedeId() });
export const cerrarCaja              = (data)     => api.post('/sesiones_caja/cerrar_caja/', { ...data, sede_id: getSedeId() });

// ============================================================
// VISTAS PRINCIPALES
// ============================================================
export const getProductos  = (params) => api.get(`/productos/`, { params });
export const getMesas      = (params) => api.get(`/mesas/`, { params });
export const getOrdenes    = (params) => api.get(`/ordenes/`, { params });

// ============================================================
// OPERACIONES CON ORDEN Y MESA
// ============================================================
export const crearOrden              = (ordenData)        => api.post('/ordenes/', ordenData);
export const actualizarOrden         = (id, data)         => api.patch(`/ordenes/${id}/`, data);
export const agregarProductosAOrden  = (idOrden, payload) => api.post(`/ordenes/${idOrden}/agregar_productos/`, payload);
export const actualizarMesa          = (id, data)         => api.patch(`/mesas/${id}/`, data);
export const crearPago               = (pagoData)         => api.post('/pagos/', pagoData);
export const anularItemDeOrden       = (idOrden, payload) => api.post(`/ordenes/${idOrden}/anular_item/`, payload);

// ============================================================
// DASHBOARD Y CONFIGURACIÓN
// ============================================================
export const obtenerMetricasDashboard = (params) => api.get(`/dashboard/metricas/`, { params });
export const getNegocioConfig         = (params) => api.get(`/negocio/configuracion/`, { params });
export const updateNegocioConfig      = (data)   => api.put(`/negocio/configuracion/?negocio_id=${getNegocioId()}`, data);

// ============================================================
// EMPLEADOS, ROLES Y SEDES
// ============================================================
export const getEmpleados       = (params)    => api.get(`/empleados/`, { params });
export const crearEmpleado      = (data)      => api.post('/empleados/', data);
export const actualizarEmpleado = (id, data)  => api.patch(`/empleados/${id}/`, data);
export const getRoles           = (params)    => api.get('/roles/', { params });
export const getSedes           = (params)    => api.get('/sedes/', { params });
export const actualizarSede     = (id, data)  => api.patch(`/sedes/${id}/`, data);
export const crearSede          = (data)      => api.post('/sedes/', data);
export const getRendimientoEmpleados = (params) =>
  api.get('/empleados/rendimiento/', { params });
// ============================================================
// PRODUCTOS Y CATEGORÍAS
// ============================================================
export const crearProducto           = (data)         => api.post('/productos/', data);
export const actualizarProducto      = (id, data)     => api.put(`/productos/${id}/`, data);
export const parchearProducto        = (id, data)     => api.patch(`/productos/${id}/`, data);
export const getCategorias           = (params)       => api.get('/categorias/', { params });
export const crearCategoria          = (data)         => api.post('/categorias/', data);
export const parchearCategoria       = (id, data)     => api.patch(`/categorias/${id}/`, data);
export const getModificadores        = (params)       => api.get('/modificadores-rapidos/', { params });
export const actualizarVariacionesProducto = (productoId, gruposData) =>
  api.patch(`/productos/${productoId}/`, { grupos_variacion: gruposData });

// ============================================================
// NEGOCIO
// ============================================================
export const getNegocio        = (id)       => api.get(`/negocios/${id}/`);
export const actualizarNegocio = (id, data) => api.patch(`/negocios/${id}/`, data);

// ============================================================
// MESAS
// ============================================================
export const crearMesa = (data) => api.post('/mesas/', data);

// ============================================================
// CAJA — MOVIMIENTOS
// ============================================================
export const registrarMovimientoCaja = (data) => api.post('/movimientos-caja/', data);

// ============================================================
// INSUMOS Y RECETAS
// ============================================================
export const getInsumos              = (params)       => api.get('/insumos/', { params });
export const registrarCompraInsumo   = (data)         => api.post('/insumos/registrar_compra/', data);
export const getRecetas              = (productoId)   => api.get(`/productos/${productoId}/receta/`);
export const guardarReceta           = (productoId, datosReceta) =>
  api.post(`/productos/${productoId}/configurar_receta/`, datosReceta);
export const getReceta               = (productoId)   =>
  api.get(`/productos/${productoId}/obtener_receta/`);

// ============================================================
// CATÁLOGO GLOBAL (para el Dueño)
// ============================================================
export const getCatalogoGlobal       = (params) => api.get('/insumo-base/', { params });
export const crearInsumoBase         = (data)   => api.post('/insumo-base/', data);
export const registrarIngresoMasivo  = (data)   => api.post('/insumo-sede/ingreso_masivo/', data);

// ============================================================
// STOCK FÍSICO POR SEDE
// ============================================================
export const getInsumosSede      = (params) => api.get('/insumo-sede/', { params });
export const vincularInsumoASede = (data)   => api.post('/insumo-sede/', data);

// ============================================================
// ENDPOINTS PÚBLICOS — Carta QR (sin token)
// ============================================================
export const getMenuPublico   = (sedeId)           => apiPublica.get(`/menu-publico/${sedeId}/`);
export const getOrdenPublica  = (sedeId, mesaId)   => apiPublica.get(`/orden-publica/${sedeId}/${mesaId}/`);

export const crearModificador = (data) => api.post('/modificadores-rapidos/', data);
export const actualizarModificador = (id, data) => api.put(`/modificadores-rapidos/${id}/`, data);
export const eliminarModificador = (id) => api.delete(`/modificadores-rapidos/${id}/`);

export const getPlanesDisponibles = () => api.get('/planes-saas/');
export const getCombosPromocionales = () => api.get('/combos-promocionales/');
export const crearComboPromocional = (data) => api.post('/combos-promocionales/', data);
export const actualizarComboPromocional = (id, data) => api.put(`/combos-promocionales/${id}/`, data);
export const eliminarComboPromocional = (id) => api.delete(`/combos-promocionales/${id}/`);
export const getPagosSuscripcion = (negocioId) => api.get('/pagos-suscripcion/', { params: { negocio_id: negocioId } });

// ============================================================
// SUSCRIPCIÓN — Cobro con MercadoPago
// ============================================================
export const getEstadoSuscripcion    = () => api.get('/negocio/estado-suscripcion/');
export const generarPagoSuscripcion   = (planId) =>
  api.post('/negocio/suscripcion/generar-pago/', planId ? { plan_id: planId } : {});

// ============================================================
// FACTURACIÓN ELECTRÓNICA (SUNAT)
// ============================================================
export const emitirComprobante = (ordenId, payload) => api.post(`/ordenes/${ordenId}/emitir-comprobante/`, payload);
// Envía el ticket/boleta por WhatsApp (vía webhook de n8n → Evolution API).
export const enviarTicketWhatsapp = (ordenId, telefono) => api.post(`/ordenes/${ordenId}/enviar-ticket/`, { telefono });
export const getComprobante    = (ordenId)          => api.get(`/ordenes/${ordenId}/comprobante/`);
export const getComprobantes   = (params)           => api.get('/comprobantes/', { params });
export const consultarRuc      = (ruc)              => api.get(`/negocios/consultar_ruc/${ruc}/`);
export const consultarDni      = (dni)              => api.get(`/negocios/consultar_dni/${dni}/`);

// ============================================================
// PANEL DE STAFF (Leybrak) — solo superusuario, salvo crearTicket
// ============================================================
export const getMetricasStaff      = () => api.get('/staff/metricas/');
export const getSaludBot           = () => api.get('/staff/salud-bot/');
export const getSaludServidor      = () => api.get('/staff/salud-servidor/');
export const getTicketsStaff       = (params) => api.get('/tickets-soporte/', { params });
export const actualizarTicketStaff = (id, data) => api.patch(`/tickets-soporte/${id}/`, data);
// La usa cualquier dueño para reportar un problema desde el ERP normal.
export const crearTicket           = (data) => api.post('/tickets-soporte/', data);

export default api;