import React, { useState } from 'react';
import { useErpDashboard } from '../features/ERP/useErpDashboard';
import { useToast } from '../context/ToastContext';
import { cerrarSesionGlobal, getAlertasNegocio } from '../api/api';
import Erp_ModalPerfil from '../features/ERP/Erp_ModalPerfil';

// ==========================================
// 📦 IMPORTACIÓN DE COMPONENTES MODULARIZADOS
// ==========================================
import Erp_DashboardVentas from '../features/ERP/Erp_DashboardVentas';
import Erp_DashboardCartaQR from '../features/ERP/DashboardCartaQR';
import Erp_EditorMenu from '../features/ERP/Erp_EditorMenu';
import Erp_GestionSedes from '../features/ERP/Erp_GestionSedes'; 
import Erp_Inventario from '../features/ERP/Erp_Inventario';
import Erp_TabFacturacion from '../features/ERP/Erp_TabFacturacion';
import Erp_Personal from '../features/ERP/Erp_Personal';
import Erp_Crm from '../features/ERP/Erp_Crm';
import Erp_Configuracion from '../features/ERP/Erp_Configuracion';
import Erp_BotWsp from '../features/ERP/Erp_BotWsp'; 

// 🧩 MODALES MODULARIZADOS
import Erp_ModalCambios from '../features/ERP/Erp_ModalCambios';
import Erp_ModalCategorias from '../features/ERP/Erp_ModalCategorias';
import Erp_ModalEmpleado from '../features/ERP/Erp_ModalEmpleado';
import Erp_ModalPlato from '../features/ERP/Erp_ModalPlato';
import Erp_ModalReceta from '../features/ERP/Erp_ModalReceta';
import Erp_ModalVariaciones from '../features/ERP/Erp_ModalVariaciones';
import Erp_Sidebar from '../features/ERP/Erp_Sidebar';
import ModalModificadores from '../features/ERP/Erp_ModalModificadores';
import { crearModificador, actualizarModificador, getModificadores } from '../api/api';
import DrawerCombosNormales from '../features/ERP/MenuComponents/DrawerCombosNormales';
// ==========================================
// 🌟 COMPONENTE HEADER INTEGRADOR (TOPBAR)
// ==========================================
const NIVEL_ESTILO = {
  danger:  { icono: 'fi-rr-exclamation', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  warning: { icono: 'fi-rr-clock',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

const Topbar = ({ vistaActiva, setMenuAbierto, tema, colorPrimario, manejarCambioVista }) => {
  const isDark = tema === 'dark';

  // Extraemos la data real de la sesión activa
  const [usuarioNombre, setUsuarioNombre] = React.useState(localStorage.getItem('usuario_nombre') || 'Administrador');
  const [usuarioAvatar, setUsuarioAvatar] = React.useState(localStorage.getItem('usuario_avatar') || null);
  const usuarioRol = localStorage.getItem('usuario_rol') || 'Dueño';
  const sedeNombre = localStorage.getItem('sede_nombre') || 'Todas las Sedes';

  const [menuPerfilAbierto, setMenuPerfilAbierto] = React.useState(false);
  const [modalPerfilAbierto, setModalPerfilAbierto] = React.useState(false);
  const menuPerfilRef = React.useRef(null);

  const [alertas, setAlertas] = React.useState([]);
  const [menuAlertasAbierto, setMenuAlertasAbierto] = React.useState(false);
  const menuAlertasRef = React.useRef(null);

  const cargarAlertas = React.useCallback(() => {
    getAlertasNegocio().then(res => setAlertas(res.data || [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    cargarAlertas();
    const timer = setInterval(cargarAlertas, 5 * 60000);
    return () => clearInterval(timer);
  }, [cargarAlertas]);

  React.useEffect(() => {
    const handleClickFuera = (e) => {
      if (menuPerfilRef.current && !menuPerfilRef.current.contains(e.target)) {
        setMenuPerfilAbierto(false);
      }
      if (menuAlertasRef.current && !menuAlertasRef.current.contains(e.target)) {
        setMenuAlertasAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => document.removeEventListener('mousedown', handleClickFuera);
  }, []);

  const handleCerrarSesion = async () => {
    if (window.confirm('¿Estás seguro que deseas cerrar sesión?')) {
      await cerrarSesionGlobal();
    }
  };

  // Reloj dinámico
  const [fechaHora, setFechaHora] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setFechaHora(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatearFecha = (fecha) => {
    return fecha.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  
  return (
    <header className={`px-6 py-4 md:px-8 md:py-5 flex justify-between items-center sticky top-0 z-30 border-b transition-colors duration-300 ${
      isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200 shadow-sm'
    }`}>
      {/* 👈 LADO IZQUIERDO: Menú y Título */}
      <div className="flex items-center gap-5">
        <button 
          onClick={() => setMenuAbierto(true)} 
          className={`md:hidden w-11 h-11 flex items-center justify-center rounded-xl border transition-colors ${
            isDark ? 'bg-[#1a1a1a] border-[#333] text-white hover:bg-[#222]' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
          }`}
        >
          <i className="fi fi-rr-menu-burger mt-0.5"></i>
        </button>
        
        <div>
          <h2 className={`text-xl md:text-2xl font-black capitalize tracking-tight leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {vistaActiva.replace(/_/g, ' ')}
          </h2>
          <p className={`text-[10px] font-bold uppercase tracking-widest mt-1.5 hidden sm:block ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            {formatearFecha(fechaHora)}
          </p>
        </div>
      </div>

      {/* 👉 LADO DERECHO: Herramientas y Perfil */}
      <div className="flex items-center gap-4 sm:gap-6">
        
        {/* Indicador de Sede Activa (Desktop) */}
        <div className={`hidden md:flex items-center gap-2.5 px-4 py-2 rounded-xl border ${
          isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-200'
        }`}>
          <i className="fi fi-rr-shop text-sm" style={{ color: colorPrimario }}></i>
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {sedeNombre}
          </span>
        </div>

        {/* Campana de Notificaciones — alertas reales del negocio */}
        <div className="relative" ref={menuAlertasRef}>
          <button
            onClick={() => setMenuAlertasAbierto(v => !v)}
            className={`relative w-11 h-11 rounded-xl border flex items-center justify-center transition-all shadow-sm ${
              isDark ? 'bg-[#141414] border-[#333] text-neutral-400 hover:text-white hover:border-neutral-500' : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
            title="Notificaciones"
          >
            <i className="fi fi-rr-bell text-lg mt-0.5"></i>
            {alertas.length > 0 && (
              <span className="absolute top-2.5 right-3 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: colorPrimario }}></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: colorPrimario }}></span>
              </span>
            )}
          </button>

          {menuAlertasAbierto && (
            <div className={`absolute right-0 top-[calc(100%+10px)] w-80 rounded-2xl border shadow-2xl overflow-hidden z-40 animate-fadeIn ${
              isDark ? 'bg-[#141414] border-[#2a2a2a]' : 'bg-white border-gray-200'
            }`}>
              <div className={`px-4 py-3 border-b ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
                <p className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
                  Notificaciones
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {alertas.length === 0 ? (
                  <p className={`px-4 py-8 text-center text-xs font-bold ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                    No tienes notificaciones pendientes.
                  </p>
                ) : (
                  alertas.map((alerta, i) => {
                    const estilo = NIVEL_ESTILO[alerta.nivel] || NIVEL_ESTILO.warning;
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (alerta.vista && manejarCambioVista) manejarCambioVista(alerta.vista);
                          setMenuAlertasAbierto(false);
                        }}
                        disabled={!alerta.vista}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b last:border-0 transition-colors ${
                          isDark ? 'border-[#1e1e1e]' : 'border-gray-50'
                        } ${alerta.vista ? (isDark ? 'hover:bg-[#1e1e1e] cursor-pointer' : 'hover:bg-gray-50 cursor-pointer') : 'cursor-default'}`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: estilo.bg, color: estilo.color }}
                        >
                          <i className={`fi ${estilo.icono} text-xs`}></i>
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-black leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {alerta.titulo}
                          </p>
                          <p className={`text-[11px] mt-1 leading-snug ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                            {alerta.mensaje}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`w-px h-8 hidden sm:block ${isDark ? 'bg-[#333]' : 'bg-gray-200'}`}></div>

        {/* Perfil de Usuario — estilo red social: click abre menú (perfil / cerrar sesión) */}
        <div className="relative" ref={menuPerfilRef}>
          <button
            onClick={() => setMenuPerfilAbierto(v => !v)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="hidden sm:block text-right">
              <p className={`text-sm font-black leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {usuarioNombre}
              </p>
              <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                {usuarioRol}
              </p>
            </div>
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md transition-transform group-hover:scale-105 overflow-hidden"
              style={{ backgroundColor: colorPrimario }}
            >
              {usuarioAvatar ? (
                <img src={usuarioAvatar} alt={usuarioNombre} className="w-full h-full object-cover" />
              ) : (
                usuarioNombre.charAt(0).toUpperCase()
              )}
            </div>
          </button>

          {menuPerfilAbierto && (
            <div className={`absolute right-0 top-[calc(100%+10px)] w-64 rounded-2xl border shadow-2xl overflow-hidden z-40 animate-fadeIn ${
              isDark ? 'bg-[#141414] border-[#2a2a2a]' : 'bg-white border-gray-200'
            }`}>
              <div className={`p-4 flex items-center gap-3 border-b ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md shrink-0 overflow-hidden"
                  style={{ backgroundColor: colorPrimario }}
                >
                  {usuarioAvatar ? (
                    <img src={usuarioAvatar} alt={usuarioNombre} className="w-full h-full object-cover" />
                  ) : (
                    usuarioNombre.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-black leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {usuarioNombre}
                  </p>
                  <p className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                    {usuarioRol} · {sedeNombre}
                  </p>
                </div>
              </div>

              <button
                onClick={() => { setModalPerfilAbierto(true); setMenuPerfilAbierto(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors ${
                  isDark ? 'text-neutral-300 hover:bg-[#1e1e1e]' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <i className="fi fi-rr-user text-sm"></i> Mi Perfil
              </button>

              <button
                onClick={() => { setMenuPerfilAbierto(false); handleCerrarSesion(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 transition-colors border-t ${
                  isDark ? 'border-[#222] hover:bg-red-500/10' : 'border-gray-100 hover:bg-red-50'
                }`}
              >
                <i className="fi fi-rr-exit text-sm"></i> Cerrar Sesión
              </button>
            </div>
          )}
        </div>

      </div>

      <Erp_ModalPerfil
        isOpen={modalPerfilAbierto}
        onClose={() => setModalPerfilAbierto(false)}
        isDark={isDark}
        colorPrimario={colorPrimario}
        usuarioNombre={usuarioNombre}
        usuarioAvatar={usuarioAvatar}
        onPerfilActualizado={({ nombre, avatar }) => {
          setUsuarioNombre(nombre);
          setUsuarioAvatar(avatar);
        }}
      />
    </header>
  );
};


// ==========================================
// 🔒 PANTALLA SIN PERMISOS
// ==========================================
const SinPermisos = ({ onVolver }) => (
  <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-8 font-sans">
    <div className="max-w-md w-full text-center">
      <div className="w-24 h-24 rounded-3xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-8 shadow-2xl">
        <i className="fi fi-rr-lock text-4xl text-neutral-600 mt-1"></i>
      </div>
      <h1 className="text-3xl font-black text-white tracking-tighter mb-3">
        Acceso Restringido
      </h1>
      <p className="text-neutral-500 text-sm leading-relaxed mb-10">
        No tienes permisos para acceder al Panel de Control.<br />
        Solo los administradores y dueños del negocio pueden ingresar aquí.
      </p>
      <button
        onClick={onVolver}
        className="w-full bg-gradient-to-r from-[#ff5a1f] to-[#e0155b] hover:opacity-90 active:scale-95 text-white py-4 rounded-2xl font-black text-sm tracking-widest uppercase transition-all shadow-[0_8px_30px_rgba(255,90,31,0.25)]"
      >
        Volver al Terminal POS
      </button>
    </div>
  </div>
);

// ==========================================
// 🚀 VISTA PRINCIPAL (LAYOUT)
// ==========================================
export default function ErpDashboard({ onVolverAlPos, rolUsuario }) {
  const toast = useToast();
  const rolesERP = ['dueño', 'administrador', 'admin','superadmin'];
  if (!rolesERP.includes((rolUsuario || '').toLowerCase().trim())) {
    return <SinPermisos onVolver={onVolverAlPos} />;
  }
  const {
    tema, colorPrimario, config, setConfig, vistaActiva, recargarSedes,
    sedeFiltro, cambiarSedeFiltro, sedeFiltroId, setSedeFiltroId, 
    menuAbierto, setMenuAbierto, isCollapsed, setIsCollapsed, modalEmpleado, setModalEmpleado, 
    modalVariacionesOpen, setModalVariacionesOpen, productoParaVariaciones, setProductoParaVariaciones, 
    categorias, guardandoConfig, productosReales, subiendoImagenPlato, guardandoPlato,
    modalPlato, setModalPlato, pasoModal, setPasoModal, formPlato, setFormPlato,
    empleadosReales, sedesReales, formEmpleado, setFormEmpleado, metricas, 
    modalCategorias, setModalCategorias, nombreNuevaCat, setNombreNuevaCat, 
    modalRecetaOpen, setModalRecetaOpen, productoParaReceta, setProductoParaReceta, 
    modalCambiosPendientes, rolesFiltrados, ordenesReales,
    
    manejarCambioVista, descartarCambios, guardarYCambiarVista,
    cancelarCambioVista, manejarGuardarConfig, abrirModalEdicion, toggleActivo,
    manejarGuardarEmpleado, manejarGuardarPlato, manejarCrearCategoria,
    eliminarCategoriaLocal, toggleDisponibilidad, eliminarProductoLocal, abrirModalEditar, cerrarModalPlato, modificadoresReales, setModificadoresReales
  } = useErpDashboard();
  
  // ✅ Estado local para controlar el modal
  const [modalModificadoresAbierto, setModalModificadoresAbierto] = useState(false);
  const [drawerCombosAbierto, setDrawerCombosAbierto] = useState(false);
  const handleOpenModificadores = () => {
    setModalModificadoresAbierto(true);
  };

  // ✅ Función para recargar modificadores después de guardar
  const recargarModificadores = async () => {
    try {
      const negocioId = localStorage.getItem('negocio_id');
      const resModificadores = await getModificadores({ negocio_id: negocioId });
      setModificadoresReales(resModificadores.data || []);
    } catch (error) {
      console.error("Error recargando modificadores:", error);
    }
  };

  return (
    <div className={`min-h-screen font-sans flex transition-colors duration-500 ${tema === 'dark' ? 'bg-[#0a0a0a] text-neutral-100' : 'bg-[#f0f0f0] text-neutral-900'}`}>
      
      {/* 🧭 BARRA LATERAL */}
      <Erp_Sidebar 
        vistaActiva={vistaActiva} 
        manejarCambioVista={manejarCambioVista} 
        menuAbierto={menuAbierto} 
        setMenuAbierto={setMenuAbierto} 
        onVolverAlPos={onVolverAlPos} 
        isCollapsed={isCollapsed}       
        setIsCollapsed={setIsCollapsed} 
      />

      <div className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'md:ml-20' : 'md:ml-72'}`}>
        
        {/* ✨ CABECERA PROFESIONAL APLICADA AQUÍ */}
        <Topbar
          vistaActiva={vistaActiva}
          setMenuAbierto={setMenuAbierto}
          tema={tema}
          colorPrimario={colorPrimario}
          manejarCambioVista={manejarCambioVista}
        />

        {/* 🖥️ ÁREA PRINCIPAL DE RENDERIZADO */}
        <main className="p-4 md:p-8 flex-1 overflow-y-auto overflow-x-hidden min-w-0 w-full">
          
          {vistaActiva === 'dashboard' && (
            <Erp_DashboardVentas config={config} sedeFiltro={sedeFiltro} cambiarSedeFiltro={cambiarSedeFiltro} sedesReales={sedesReales} metricas={metricas} ordenesReales={ordenesReales} />
          )}

          {vistaActiva === 'negocio' && (
            <Erp_Configuracion 
              config={config} 
              setConfig={setConfig} 
              manejarGuardarConfig={manejarGuardarConfig} 
              guardandoConfig={guardandoConfig} 
              sedesReales={sedesReales} 
            />
          )}

          {vistaActiva === 'menu' && (
            <Erp_EditorMenu 
              categorias={categorias} 
              productosReales={productosReales} 
              onOpenCategorias={() => setModalCategorias(true)} 
              onOpenPlatoNuevo={() => { cerrarModalPlato(); setModalPlato(true); }} 
              onEditPlato={abrirModalEditar} 
              onToggleDisponibilidad={toggleDisponibilidad}
              onEliminarPlato={eliminarProductoLocal}
              onOpenReceta={(plato) => { setProductoParaReceta(plato); setModalRecetaOpen(true); }}
              onOpenVariaciones={(plato) => { setProductoParaVariaciones(plato); setModalVariacionesOpen(true); }} 
              onOpenModificadores={handleOpenModificadores} 
              onOpenCombos={() => setDrawerCombosAbierto(true)}
            />
          )}

          {vistaActiva === 'personal' && (
            <Erp_Personal config={config} empleadosReales={empleadosReales} sedesReales={sedesReales} sedeFiltroId={sedeFiltroId} onCambiarSedeFiltro={(id) => setSedeFiltroId(id || null)} onNuevoEmpleado={() => setModalEmpleado(true)} onEditarEmpleado={abrirModalEdicion} onToggleActivo={toggleActivo} />
          )}

          {vistaActiva === 'crm' && (
            <Erp_Crm 
              config={config} 
              sedesReales={sedesReales} 
              productosReales={productosReales} 
              categoriasReales={categorias}
            />
          )}

          {vistaActiva === 'inventario' && (
            <Erp_Inventario />
          )}

          {vistaActiva === 'carta_qr' && (
            <Erp_DashboardCartaQR config={config} />
          )}

          {vistaActiva === 'sedes' && (
            <Erp_GestionSedes />
          )}

          {vistaActiva === 'bot_wsp' && (
            <Erp_BotWsp 
              sedesReales={sedesReales} 
              onRefrescar={recargarSedes} // 👈 ¡EL CABLE MÁGICO CONECTADO!
              productosReales={productosReales}
            />
          )}

          {vistaActiva === 'facturacion' && <Erp_TabFacturacion />}

        </main>
      </div>

      {/* ========================================== */}
      {/* 🧩 ZONA DE MODALES */}
      {/* ========================================== */}
      
      <Erp_ModalEmpleado isOpen={modalEmpleado} config={config} formEmpleado={formEmpleado} setFormEmpleado={setFormEmpleado} rolesFiltrados={rolesFiltrados} sedesReales={sedesReales} onGuardar={manejarGuardarEmpleado} onClose={() => { setModalEmpleado(false); setFormEmpleado({ id: null, nombre: '', pin: '', rol: rolesFiltrados[0]?.id || '', sede: sedesReales[0]?.id || '' }); }} />
      <Erp_ModalPlato isOpen={modalPlato} onClose={cerrarModalPlato} formPlato={formPlato} setFormPlato={setFormPlato} pasoModal={pasoModal} setPasoModal={setPasoModal} categorias={categorias} manejarGuardarPlato={manejarGuardarPlato} subiendoImagenPlato={subiendoImagenPlato} guardandoPlato={guardandoPlato} />
      <Erp_ModalCategorias isOpen={modalCategorias} onClose={() => setModalCategorias(false)} tema={tema} colorPrimario={colorPrimario} nombreNuevaCat={nombreNuevaCat} setNombreNuevaCat={setNombreNuevaCat} manejarCrearCategoria={manejarCrearCategoria} categorias={categorias} eliminarCategoriaLocal={eliminarCategoriaLocal} />
      <Erp_ModalCambios isOpen={modalCambiosPendientes} config={config} onGuardar={guardarYCambiarVista} onDescartar={descartarCambios} onCancelar={cancelarCambioVista} />
      <Erp_ModalReceta isOpen={modalRecetaOpen} onClose={() => setModalRecetaOpen(false)} producto={productoParaReceta} config={config} />
      <Erp_ModalVariaciones isOpen={modalVariacionesOpen} onClose={() => setModalVariacionesOpen(false)} producto={productoParaVariaciones} config={config} />
      <DrawerCombosNormales
        isOpen={drawerCombosAbierto}
        onClose={() => setDrawerCombosAbierto(false)}
        isDark={tema === 'dark'}
        colorPrimario={colorPrimario}
        productosReales={productosReales}
        categoriasReales={categorias}
      />
      {/* ✅ MODAL DE MODIFICADORES */}
      <ModalModificadores 
        isOpen={modalModificadoresAbierto}
        onClose={() => setModalModificadoresAbierto(false)}
        categorias={categorias}
        modificadores={modificadoresReales || []} 
        tema={tema}
        colorPrimario={colorPrimario}
        onRecargar={recargarModificadores}
        onGuardar={async (formData) => {
          try {
            const negocioId = localStorage.getItem('negocio_id');
            
            if (formData.id) {
              // EDITAR EXISTENTE
              const dataParaActualizar = { 
                ...formData, 
                negocio: negocioId 
              };
              await actualizarModificador(formData.id, dataParaActualizar);
            } else {
              // CREAR NUEVO
              const dataParaEnviar = { 
                ...formData, 
                negocio: negocioId 
              };
              await crearModificador(dataParaEnviar);
            }
            
            toast.success('Modificador guardado correctamente.');
          } catch (error) {
            console.error("Error al procesar modificador:", error);
            toast.error('Error al guardar el modificador.');
            throw error; // Re-lanzar para que el modal no se cierre si hay error
          }
        }}
      />

    </div>
  );
}