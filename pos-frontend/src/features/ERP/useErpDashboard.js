import { useState, useEffect } from 'react';
import { 
  obtenerMetricasDashboard, getEmpleados, getRoles, getOrdenes,
  crearEmpleado, getProductos, crearProducto, actualizarProducto, parchearProducto,
  getCategorias, crearCategoria, actualizarNegocio, actualizarEmpleado, parchearCategoria,
  getModificadores,
} from '../../api/api';
import api from '../../api/api';
import usePosStore from '../../store/usePosStore';

export const useErpDashboard = () => {
  const { configuracionGlobal, setConfiguracionGlobal } = usePosStore();
  const tema = configuracionGlobal?.temaFondo || 'dark';
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';

  const SYNC_MAP = {
    mod_salon_activo:       'modSalon',
    mod_cocina_activo:      'modCocina',
    mod_inventario_activo:  'modInventario',
    mod_delivery_activo:    'modDelivery',
    mod_clientes_activo:    'modClientes',
    mod_facturacion_activo: 'modFacturacion',
    mod_carta_qr_activo:    'modCartaQr',
    mod_bot_wsp_activo:     'modBotWsp',
    mod_ml_activo:          'modMl',
  };

  // ==========================================
  // 1. ESTADOS PRINCIPALES
  // ==========================================
  const [ordenesReales, setOrdenesReales] = useState([]);
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  
  const _rolInicial = localStorage.getItem('usuario_rol')?.toLowerCase() || '';
  const _esDueñoInicial = _rolInicial === 'dueño';
  const [sedeVentasId, setSedeVentasId] = useState(
    _esDueñoInicial ? '' : (localStorage.getItem('memoria_sede_ventas') || '')
  );
  const [sedePersonalId, setSedePersonalId] = useState(localStorage.getItem('memoria_sede_personal') || '');
  const [sedeMenuId, setSedeMenuId] = useState(localStorage.getItem('memoria_sede_menu') || '');

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [modalEmpleado, setModalEmpleado] = useState(false);
  const [modalVariacionesOpen, setModalVariacionesOpen] = useState(false);
  const [productoParaVariaciones, setProductoParaVariaciones] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [config, setConfig] = useState({
    // Identidad
    ruc: '', razon_social: '', telefono_propietario: '', logoPreview: null, logoFile: null, logo: null,
    // Billeteras
    yape_numero: '', yape_qrPreview: null, yape_qrFile: null, yape_qr: null,
    plin_numero: '', plin_qrPreview: null, plin_qrFile: null, plin_qr: null,
    // Automatización Yape/Plin
    confirmacion_automatica: false,
    device_token: null,
    negocio_id: null,
    // Módulos — camelCase (para manejarGuardarConfig y hayCambiosPendientes)
    modSalon: true, modCocina: false, modDelivery: false, modInventario: false,
    modClientes: false, modFacturacion: false, modCartaQr: false, modBotWsp: false, modMl: false,
    // Módulos — snake_case (para Tab_Modulos, refleja los mismos valores)
    mod_salon_activo: true, mod_cocina_activo: false, mod_delivery_activo: false,
    mod_inventario_activo: false, mod_clientes_activo: false, mod_facturacion_activo: false,
    mod_carta_qr_activo: false, mod_bot_wsp_activo: false, mod_ml_activo: false,
    // UI — ambas versiones
    colorPrimario: '#ff5a1f', color_primario: '#ff5a1f',
    temaFondo: 'dark', tema_fondo: 'dark',
    // Plan
    permisosPlan: {},
    plan_detalles: null,
  });
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [productosReales, setProductosReales] = useState([]);
  const [modificadoresReales, setModificadoresReales] = useState([]);
  const [modalPlato, setModalPlato] = useState(false);
  const [pasoModal, setPasoModal] = useState(1);
  const [formPlato, setFormPlato] = useState({ 
    id: null, nombre: '', precio_base: '', categoria_id: '', es_venta_rapida: true,
    requiere_seleccion: false, tiene_variaciones: false, disponible: true, grupos_variacion: []
  });
  const [empleadosReales, setEmpleadosReales] = useState([]);
  const [rolesReales, setRolesReales] = useState([]);
  const [sedesReales, setSedesReales] = useState([]);
  const [formEmpleado, setFormEmpleado] = useState({ id: null, nombre: '', pin: '', rol: '', sede: '' });
  const [metricas, setMetricas] = useState({ ventas: 0, ordenes: 0, ticketPromedio: 0, actividadReciente: [] });
  const [modalCategorias, setModalCategorias] = useState(false);
  const [nombreNuevaCat, setNombreNuevaCat] = useState('');
  const [modalRecetaOpen, setModalRecetaOpen] = useState(false);
  const [productoParaReceta, setProductoParaReceta] = useState(null);
  const [configOriginal, setConfigOriginal] = useState(null);
  const [modalCambiosPendientes, setModalCambiosPendientes] = useState(false);
  const [vistaPendiente, setVistaPendiente] = useState(null);

  const hayCambiosPendientes = configOriginal ? (
    config.numeroYape !== configOriginal.numeroYape ||
    config.modSalon !== configOriginal.modSalon ||
    config.modCocina !== configOriginal.modCocina ||
    config.modDelivery !== configOriginal.modDelivery ||
    config.modInventario !== configOriginal.modInventario ||
    config.modClientes !== configOriginal.modClientes ||
    config.modFacturacion !== configOriginal.modFacturacion ||
    config.modCartaQr !== configOriginal.modCartaQr ||
    config.modBotWsp !== configOriginal.modBotWsp ||
    config.modMl !== configOriginal.modMl ||
    config.colorPrimario !== configOriginal.colorPrimario ||
    config.temaFondo !== configOriginal.temaFondo
  ) : false;

  const moduloKdsActivo = configuracionGlobal?.modulos?.cocina;
  const rolesFiltrados = rolesReales.filter(rol => {
    if (!moduloKdsActivo && (rol.nombre.toLowerCase().includes('cocin') || rol.nombre.toLowerCase().includes('chef'))) return false;
    return true; 
  });
  
  const recargarSedes = async () => {
    try {
      const negocioId = parseInt(localStorage.getItem('negocio_id') || 1);
      const resSedes = await api.get(`/sedes/`, { params: { negocio_id: negocioId } });
      setSedesReales(resSedes.data);
    } catch (error) { console.error("Error cargando sedes:", error); }
  };

  useEffect(() => {
    recargarSedes();
  }, []);

  // ==========================================
  // 2. EFECTOS MULTITAREA
  // ==========================================
  const buildDashboardParams = (sedeId, extraParams = {}) => {
    const negocioId = localStorage.getItem('negocio_id');
    const rol = localStorage.getItem('usuario_rol')?.toLowerCase();
    const esDueño = rol === 'dueño';
    if (sedeId) return { sede_id: sedeId, ...extraParams };
    if (esDueño) return { negocio_id: negocioId, ...extraParams };
    return { ...extraParams };
  };

  // Dashboard
  useEffect(() => {
    if (vistaActiva === 'dashboard') {
      const cargarDatos = async () => {
        try {
          const params = buildDashboardParams(sedeVentasId, { modo: 'dashboard' });
          const [resMetricas, resOrdenes] = await Promise.all([
            obtenerMetricasDashboard(params),
            getOrdenes(params)
          ]);
          setMetricas(resMetricas.data);
          setOrdenesReales(resOrdenes.data);
        } catch (error) { console.error("Error al cargar métricas:", error); }
      };
      cargarDatos();
      const intervalo = setInterval(cargarDatos, 10000);
      return () => clearInterval(intervalo);
    }
  }, [vistaActiva, sedeVentasId]);

  // Personal
  useEffect(() => {
    if (vistaActiva === 'personal') {
      const cargarDatosPersonal = async () => {
        try {
          const negocioId = parseInt(localStorage.getItem('negocio_id') || 1);
          const params = { negocio_id: negocioId, negocio: negocioId };
          if (sedePersonalId) { params.sede_id = sedePersonalId; params.sede = sedePersonalId; }
          const [resEmpleados, resRoles, resSedes] = await Promise.all([
            getEmpleados(params), getRoles(), api.get(`/sedes/`, { params: { negocio_id: negocioId } })
          ]);
          setEmpleadosReales(resEmpleados.data);
          setRolesReales(resRoles.data);
          setSedesReales(resSedes.data);
        } catch (error) { console.error("Error cargando personal:", error); }
      };
      cargarDatosPersonal();
    }
  }, [vistaActiva, sedePersonalId]);

  // Menú
  useEffect(() => {
    if (vistaActiva === 'menu' || vistaActiva === 'bot_wsp' || vistaActiva === 'crm') {
      const cargarMenu = async () => {
        try {
          const negocioId = localStorage.getItem('negocio_id');
          const [resProductos, resCategorias, resModificadores] = await Promise.all([
            getProductos({ sede_id: sedeMenuId }), 
            getCategorias(),
            getModificadores({ negocio_id: negocioId })
          ]);
          setProductosReales(resProductos.data);
          setCategorias(resCategorias.data);
          setModificadoresReales(resModificadores.data || []);
        } catch (error) { 
          console.error("Error menú:", error); 
          setModificadoresReales([]);
        }
      };
      cargarMenu();
    }
  }, [vistaActiva, sedeMenuId]);

  // Configuración global del negocio
  useEffect(() => {
    const cargarConfiguracionGlobal = async () => {
      try {
        const negocioId = localStorage.getItem('negocio_id') || 1;
        const response = await api.get(`/negocios/${negocioId}/`);
        const datosBD = response.data;
        const configData = {
          // Identidad
          ruc: datosBD.ruc || '',
          razon_social: datosBD.razon_social || '',
          telefono_propietario: datosBD.telefono_propietario || '',
          logo: datosBD.logo || null,
          // Billeteras
          yape_numero: datosBD.yape_numero || '',
          yape_qr: datosBD.yape_qr || null,
          plin_numero: datosBD.plin_numero || '',
          plin_qr: datosBD.plin_qr || null,
          // ✅ Automatización Yape/Plin
          confirmacion_automatica: datosBD.confirmacion_automatica || false,
          device_token:            datosBD.device_token            || null,
          negocio_id:              datosBD.id,
          // Módulos camelCase (para manejarGuardarConfig — NO CAMBIAR)
          modSalon:       datosBD.mod_salon_activo       ?? true,
          modCocina:      datosBD.mod_cocina_activo      ?? false,
          modInventario:  datosBD.mod_inventario_activo  ?? false,
          modDelivery:    datosBD.mod_delivery_activo    ?? false,
          modClientes:    datosBD.mod_clientes_activo    ?? false,
          modFacturacion: datosBD.mod_facturacion_activo ?? false,
          modCartaQr:     datosBD.mod_carta_qr_activo    ?? false,
          modBotWsp:      datosBD.mod_bot_wsp_activo     ?? false,
          modMl:          datosBD.mod_ml_activo          ?? false,
          // Módulos snake_case (para Tab_Modulos) — mismos valores
          mod_salon_activo:       datosBD.mod_salon_activo       ?? true,
          mod_cocina_activo:      datosBD.mod_cocina_activo      ?? false,
          mod_inventario_activo:  datosBD.mod_inventario_activo  ?? false,
          mod_delivery_activo:    datosBD.mod_delivery_activo    ?? false,
          mod_clientes_activo:    datosBD.mod_clientes_activo    ?? false,
          mod_facturacion_activo: datosBD.mod_facturacion_activo ?? false,
          mod_carta_qr_activo:    datosBD.mod_carta_qr_activo    ?? false,
          mod_bot_wsp_activo:     datosBD.mod_bot_wsp_activo     ?? false,
          mod_ml_activo:          datosBD.mod_ml_activo          ?? false,
          // UI — ambas versiones
          colorPrimario:  datosBD.color_primario || '#ff5a1f',
          color_primario: datosBD.color_primario || '#ff5a1f',
          temaFondo:      datosBD.tema_fondo     || 'dark',
          tema_fondo:     datosBD.tema_fondo     || 'dark',
          // Plan
          permisosPlan:  datosBD.plan_detalles || {},
          plan_detalles: datosBD.plan_detalles || null,
          // Interruptor global de Leybrak (ver Tab_Modulos: "Próximamente")
          modulos_globales: datosBD.modulos_globales || {},
        };
        const plan = datosBD.plan_detalles || {};
        // Interruptor maestro de Leybrak: si un módulo está apagado acá, se
        // oculta para todos los negocios sin tocar el flag de cada uno.
        // OJO: se combina solo para decidir qué mostrar, nunca se guarda en
        // `config` (ese es el que se reenvía tal cual al grabar cualquier
        // pestaña) para no persistirlo como si fuera la preferencia real.
        const g = datosBD.modulos_globales || {};

        setConfig(configData);
        setConfigOriginal(JSON.parse(JSON.stringify(configData)));
        setConfiguracionGlobal({
          colorPrimario:           configData.colorPrimario,
          temaFondo:               configData.temaFondo,
          yape_numero:             configData.yape_numero,
          yape_qr:                 configData.yape_qr,
          plin_numero:             configData.plin_numero,
          plin_qr:                 configData.plin_qr,
          // ✅ Automatización
          confirmacion_automatica: configData.confirmacion_automatica,
          device_token:            configData.device_token,
          negocio_id:              configData.negocio_id,
          facturacion_emision:     datosBD.facturacion_emision || 'desactivado',
          modulos_globales:        g,
          modulos: {
            salon:           configData.modSalon      && (g.salon           ?? true),
            cocina:          configData.modCocina      && (plan.modulo_kds        ?? false) && (g.cocina          ?? true),
            delivery:        configData.modDelivery    && (plan.modulo_delivery   ?? false) && (g.delivery        ?? true),
            inventario:      configData.modInventario  && (plan.modulo_inventario ?? false) && (g.inventario      ?? true),
            clientes:        configData.modClientes    && (g.clientes        ?? true),
            facturacion:     configData.modFacturacion && (g.facturacion     ?? true),
            cartaQr:         configData.modCartaQr     && (plan.modulo_carta_qr   ?? false) && (g.cartaQr         ?? true),
            botWsp:          configData.modBotWsp      && (plan.modulo_bot_wsp    ?? false) && (g.botWsp          ?? true),
            machineLearning: configData.modMl          && (plan.modulo_ml         ?? false) && (g.machineLearning ?? true),
          }
        });
      } catch (error) { console.error("Error config:", error); }
    };
    cargarConfiguracionGlobal();
  }, [setConfiguracionGlobal]);

  // ==========================================
  // 3. CALCULADOR DINÁMICO DE ESTADO ACTIVO
  // ==========================================
  const getSedeFiltroIdActivo = () => {
    if (vistaActiva === 'dashboard') return sedeVentasId;
    if (vistaActiva === 'personal') return sedePersonalId;
    if (vistaActiva === 'menu') return sedeMenuId;
    return '';
  };

  const sedeFiltroIdActivo = getSedeFiltroIdActivo();
  const sedeObj = sedesReales.find(s => String(s.id) === String(sedeFiltroIdActivo));
  const sedeFiltroActiva = sedeObj ? sedeObj.nombre : 'Todas';

  // ==========================================
  // 4. FUNCIONES DE CONTROL
  // ==========================================
  const cambiarSedeFiltro = (valor) => {
    let nuevoId = '';
    if (typeof valor === 'object' && valor !== null) {
      nuevoId = valor.id || '';
    } else if (valor === 'Todas' || valor === '') {
      nuevoId = '';
    } else {
      const sedeEncontrada = sedesReales.find(s => String(s.id) === String(valor) || s.nombre === valor);
      if (sedeEncontrada) nuevoId = sedeEncontrada.id;
      else nuevoId = valor;
    }

    if (vistaActiva === 'dashboard') {
      setSedeVentasId(nuevoId);
      if (nuevoId) localStorage.setItem('memoria_sede_ventas', nuevoId);
      else localStorage.removeItem('memoria_sede_ventas');
    } else if (vistaActiva === 'personal') {
      setSedePersonalId(nuevoId);
      if (nuevoId) localStorage.setItem('memoria_sede_personal', nuevoId);
      else localStorage.removeItem('memoria_sede_personal');
    } else if (vistaActiva === 'menu') {
      setSedeMenuId(nuevoId);
      if (nuevoId) localStorage.setItem('memoria_sede_menu', nuevoId);
      else localStorage.removeItem('memoria_sede_menu');
    }
  };

  const manejarCambioVista = (nuevaVista) => {
    if (vistaActiva === 'config' && hayCambiosPendientes) {
      setVistaPendiente(nuevaVista); setModalCambiosPendientes(true); return;
    }
    if (nuevaVista === 'config') {
      const { qrFile: _qrFile, qrPreview: _qrPreview, ...configSegura } = config;
      setConfigOriginal(JSON.parse(JSON.stringify(configSegura)));
    } else {
      setConfigOriginal(null);
    }
    setVistaActiva(nuevaVista);
    setMenuAbierto(false);
  };

  const descartarCambios = () => {
    if (configOriginal) {
      setConfig({
        ...configOriginal,
        mod_salon_activo:       configOriginal.modSalon,
        mod_cocina_activo:      configOriginal.modCocina,
        mod_inventario_activo:  configOriginal.modInventario,
        mod_delivery_activo:    configOriginal.modDelivery,
        mod_clientes_activo:    configOriginal.modClientes,
        mod_facturacion_activo: configOriginal.modFacturacion,
        mod_carta_qr_activo:    configOriginal.modCartaQr,
        mod_bot_wsp_activo:     configOriginal.modBotWsp,
        mod_ml_activo:          configOriginal.modMl,
        color_primario:         configOriginal.colorPrimario,
        tema_fondo:             configOriginal.temaFondo,
      });
    }
    setModalCambiosPendientes(false);
    if (vistaPendiente) {
      setVistaActiva(vistaPendiente);
      setConfigOriginal(null);
      setVistaPendiente(null);
    }
    setMenuAbierto(false);
  };

  const guardarYCambiarVista = async () => {
    await manejarGuardarConfig(); 
    setModalCambiosPendientes(false);
    if (vistaPendiente) {
      setVistaActiva(vistaPendiente);
      setConfigOriginal(null);
      setVistaPendiente(null);
    }
    setMenuAbierto(false);
  };

  const cancelarCambioVista = () => {
    setModalCambiosPendientes(false);
    setVistaPendiente(null);
  };

  const manejarGuardarConfig = async () => {
    setGuardandoConfig(true);
    try {
      const negocioId = localStorage.getItem('negocio_id'); 
      if (!negocioId) return alert("⚠️ No se encontró ID negocio.");

      const formData = new FormData();

      // Identidad
      formData.append('ruc',          config.ruc          || '');
      formData.append('razon_social', config.razon_social || '');
      formData.append('telefono_propietario', config.telefono_propietario || '');

      // Billeteras
      formData.append('yape_numero', config.yape_numero || '');
      formData.append('plin_numero', config.plin_numero || '');

      // ✅ Automatización Yape/Plin (reemplaza Culqi)
      formData.append('confirmacion_automatica', config.confirmacion_automatica ? 'True' : 'False');

      // Archivos
      if (config.logoFile)    formData.append('logo',    config.logoFile);
      if (config.yape_qrFile) formData.append('yape_qr', config.yape_qrFile);
      if (config.plin_qrFile) formData.append('plin_qr', config.plin_qrFile);

      // Feature Flags — sigue leyendo camelCase, no tocar
      formData.append('mod_salon_activo',       config.modSalon       ? 'True' : 'False');
      formData.append('mod_cocina_activo',       config.modCocina      ? 'True' : 'False');
      formData.append('mod_inventario_activo',   config.modInventario  ? 'True' : 'False');
      formData.append('mod_delivery_activo',     config.modDelivery    ? 'True' : 'False');
      formData.append('mod_clientes_activo',     config.modClientes    ? 'True' : 'False');
      formData.append('mod_facturacion_activo',  config.modFacturacion ? 'True' : 'False');
      formData.append('mod_carta_qr_activo',     config.modCartaQr     ? 'True' : 'False');
      formData.append('mod_bot_wsp_activo',      config.modBotWsp      ? 'True' : 'False');
      formData.append('mod_ml_activo',           config.modMl          ? 'True' : 'False');

      if (config.colorPrimario) formData.append('color_primario', config.colorPrimario);
      if (config.temaFondo)     formData.append('tema_fondo',     config.temaFondo);

      await api.patch(`/negocios/${negocioId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const plan = config.plan_detalles || {};
      // Interruptor maestro de Leybrak, guardado en el store al cargar la
      // config (ver cargarConfiguracionGlobal) — no se refetchea acá.
      const g = configuracionGlobal.modulos_globales || {};

      // ✅ Store global actualizado con automatización
      setConfiguracionGlobal({
        colorPrimario:           config.colorPrimario,
        temaFondo:               config.temaFondo,
        yape_numero:             config.yape_numero,
        yape_qr:                 config.yape_qrPreview || config.yape_qr,
        plin_numero:             config.plin_numero,
        plin_qr:                 config.plin_qrPreview || config.plin_qr,
        confirmacion_automatica: config.confirmacion_automatica,
        device_token:            config.device_token,
        negocio_id:              parseInt(negocioId),
        modulos: {
          salon:           config.modSalon      && (g.salon           ?? true),
          cocina:          config.modCocina      && (plan.modulo_kds        ?? false) && (g.cocina          ?? true),
          delivery:        config.modDelivery    && (plan.modulo_delivery   ?? false) && (g.delivery        ?? true),
          inventario:      config.modInventario  && (plan.modulo_inventario ?? false) && (g.inventario      ?? true),
          clientes:        config.modClientes    && (g.clientes        ?? true),
          facturacion:     config.modFacturacion && (g.facturacion     ?? true),
          cartaQr:         config.modCartaQr     && (plan.modulo_carta_qr   ?? false) && (g.cartaQr         ?? true),
          botWsp:          config.modBotWsp      && (plan.modulo_bot_wsp    ?? false) && (g.botWsp          ?? true),
          machineLearning: config.modMl          && (plan.modulo_ml         ?? false) && (g.machineLearning ?? true),
        }
      });

      // Limpieza del estado original sin crashear por los Files
      const {
        logoFile: _l, yape_qrFile: _y, plin_qrFile: _p,
        logoPreview: _lp, yape_qrPreview: _yqp, plin_qrPreview: _pqp,
        ...configSegura
      } = config;
      setConfigOriginal(JSON.parse(JSON.stringify(configSegura)));

      // Sincroniza snake_case con los camelCase recién guardados
      setConfig(prev => ({
        ...prev,
        mod_salon_activo:       prev.modSalon,
        mod_cocina_activo:      prev.modCocina,
        mod_inventario_activo:  prev.modInventario,
        mod_delivery_activo:    prev.modDelivery,
        mod_clientes_activo:    prev.modClientes,
        mod_facturacion_activo: prev.modFacturacion,
        mod_carta_qr_activo:    prev.modCartaQr,
        mod_bot_wsp_activo:     prev.modBotWsp,
        mod_ml_activo:          prev.modMl,
        color_primario:         prev.colorPrimario,
        tema_fondo:             prev.temaFondo,
      }));

      alert("✅ ¡Configuración guardada!");
    } catch (error) { 
      console.error(error);
      alert("❌ Error al guardar. Verifica la consola."); 
    } finally { 
      setGuardandoConfig(false); 
    }
  };

  const abrirModalEdicion = (emp) => {
    setFormEmpleado({ id: emp.id, nombre: emp.nombre, pin: '', rol: emp.rol, sede: emp.sede });
    setModalEmpleado(true);
  };

  const toggleActivo = async (emp) => {
    if (!window.confirm(`¿Seguro?`)) return;
    try {
      await actualizarEmpleado(emp.id, { activo: !emp.activo });
      setEmpleadosReales(prev => prev.map(e => e.id === emp.id ? { ...e, activo: !emp.activo } : e));
    } catch (error) { alert("Error de conexión."); }
  };

  const manejarGuardarEmpleado = async () => {
    const esCreacion = !formEmpleado.id;
    if (!formEmpleado.nombre || (esCreacion && formEmpleado.pin.length !== 4)) return alert("Revisa los datos.");
    try {
      const negocioId = parseInt(localStorage.getItem('negocio_id') || 1);
      const sedeSel = formEmpleado.sede ? parseInt(formEmpleado.sede) : null;
      const rolSel  = formEmpleado.rol  ? parseInt(formEmpleado.rol)  : null;
      const payload = {
        negocio: negocioId, negocio_id: negocioId,
        nombre: formEmpleado.nombre, rol: rolSel, rol_id: rolSel, sede: sedeSel, sede_id: sedeSel
      };
      if (!esCreacion && formEmpleado.pin && formEmpleado.pin.length === 4) payload.pin = formEmpleado.pin; 
      else if (esCreacion) { payload.pin = formEmpleado.pin; payload.activo = true; }

      if (esCreacion) await crearEmpleado(payload);
      else await actualizarEmpleado(formEmpleado.id, payload);

      setModalEmpleado(false);
      setFormEmpleado({ id: null, nombre: '', pin: '', rol: rolesReales[0]?.id || '', sede: sedesReales[0]?.id || '' });
      const resEmpleados = await getEmpleados({ negocio_id: negocioId, sede_id: sedeFiltroIdActivo });
      setEmpleadosReales(resEmpleados.data);
    } catch (error) { alert("❌ Hubo un error."); }
  };

  const manejarGuardarPlato = async () => {
    if (!formPlato.nombre) return alert("Obligatorio.");
    const negocioId = localStorage.getItem('negocio_id') || 1;
    const gruposLimpios = formPlato.grupos_variacion.map(g => ({
      ...g,
      opciones: g.opciones.map(o => ({ ...o, precio_adicional: o.precio_adicional || "0.00" }))
    }));
    const payload = {
      negocio: negocioId, nombre: formPlato.nombre, precio_base: formPlato.precio_base || "0.00",
      es_venta_rapida: formPlato.es_venta_rapida, requiere_seleccion: formPlato.requiere_seleccion,
      tiene_variaciones: formPlato.tiene_variaciones, disponible: formPlato.disponible,
      categoria: formPlato.categoria_id || null, grupos_variacion: gruposLimpios
    };
    try {
      if (formPlato.id) await actualizarProducto(formPlato.id, payload);
      else await crearProducto(payload);
      setModalPlato(false); setPasoModal(1);
      const res = await getProductos({ sede_id: sedeFiltroIdActivo });
      setProductosReales(res.data);
      alert("✅ Guardado");
    } catch (error) { alert("Error al guardar."); }
  };

  const manejarCrearCategoria = async () => {
    if (!nombreNuevaCat.trim()) return;
    try {
      const res = await crearCategoria({
        nombre: nombreNuevaCat, negocio: localStorage.getItem('negocio_id') || 1, orden: 0, activo: true
      });
      setCategorias([...categorias, res.data]);
      setNombreNuevaCat('');
    } catch (error) { alert("Error al crear categoría."); }
  };

  const eliminarCategoriaLocal = async (id) => {
    if (!window.confirm("¿Seguro?")) return;
    try {
      await parchearCategoria(id, { activo: false });
      setCategorias(categorias.filter(c => c.id !== id));
    } catch (error) {}
  };

  const toggleDisponibilidad = async (plato) => {
    const nuevoValor = !plato.disponible;
    // Optimistic UI: reflejamos el cambio de inmediato, antes de esperar la respuesta del server
    setProductosReales(prev => prev.map(p => p.id === plato.id ? { ...p, disponible: nuevoValor } : p));
    try {
      await parchearProducto(plato.id, { disponible: nuevoValor });
    } catch (error) {
      // Revertimos si el server falló
      setProductosReales(prev => prev.map(p => p.id === plato.id ? { ...p, disponible: !nuevoValor } : p));
      alert("Error al cambiar estado.");
    }
  };

  const eliminarProductoLocal = async (plato) => {
    if (!window.confirm(`¿Eliminar "${plato.nombre}" del catálogo? No se borrará el historial de ventas, solo dejará de mostrarse.`)) return;
    // Optimistic UI: lo quitamos del panel de inmediato
    setProductosReales(prev => prev.filter(p => p.id !== plato.id));
    try {
      await parchearProducto(plato.id, { activo: false });
    } catch (error) {
      // Revertimos si el server falló
      setProductosReales(prev => [...prev, plato]);
      alert("Error al eliminar el producto.");
    }
  };

  const abrirModalEditar = (plato) => {
    const grp = plato.grupos_variacion
      ? plato.grupos_variacion.map(g => ({
          ...g,
          opciones: g.opciones
            ? g.opciones.map(o => ({ id: o.id, nombre: o.nombre, precio_adicional: o.precio_adicional }))
            : []
        }))
      : [];
    setFormPlato({
      id: plato.id, nombre: plato.nombre, precio_base: plato.precio_base,
      categoria_id: plato.categoria || '', es_venta_rapida: plato.es_venta_rapida || false,
      requiere_seleccion: plato.requiere_seleccion || false, tiene_variaciones: plato.tiene_variaciones || false,
      disponible: plato.disponible, grupos_variacion: grp
    });
    setPasoModal(1);
    setModalPlato(true);
  };

  const cerrarModalPlato = () => {
    setModalPlato(false); setPasoModal(1);
    setFormPlato({
      id: null, nombre: '', precio_base: '', categoria_id: '', es_venta_rapida: false,
      requiere_seleccion: false, tiene_variaciones: false, disponible: true, grupos_variacion: []
    });
  };

  // ==========================================
  // RETORNO
  // ==========================================
  return {
    tema, colorPrimario, config, setConfig, vistaActiva, setVistaActiva, 
    sedeFiltro: sedeFiltroActiva, 
    sedeFiltroId: sedeFiltroIdActivo, 
    setSedeFiltroId: cambiarSedeFiltro, 
    setSedeFiltro: cambiarSedeFiltro,
    menuAbierto, setMenuAbierto,
    isCollapsed, setIsCollapsed,
    modalEmpleado, setModalEmpleado, modalVariacionesOpen, setModalVariacionesOpen,
    productoParaVariaciones, setProductoParaVariaciones, categorias, setCategorias,
    guardandoConfig, setGuardandoConfig, productosReales, setProductosReales,
    modalPlato, setModalPlato, pasoModal, setPasoModal, formPlato, setFormPlato,
    empleadosReales, setEmpleadosReales, rolesReales, setRolesReales, sedesReales, setSedesReales,
    formEmpleado, setFormEmpleado, metricas, setMetricas, modalCategorias, setModalCategorias,
    nombreNuevaCat, setNombreNuevaCat, modalRecetaOpen, setModalRecetaOpen,
    productoParaReceta, setProductoParaReceta, modalCambiosPendientes, rolesFiltrados, ordenesReales,
    modificadoresReales, setModificadoresReales,
    cambiarSedeFiltro, manejarCambioVista, descartarCambios, guardarYCambiarVista,
    cancelarCambioVista, manejarGuardarConfig, abrirModalEdicion, toggleActivo,
    manejarGuardarEmpleado, manejarGuardarPlato, manejarCrearCategoria,
    eliminarCategoriaLocal, toggleDisponibilidad, eliminarProductoLocal, abrirModalEditar, cerrarModalPlato, recargarSedes
  };
};