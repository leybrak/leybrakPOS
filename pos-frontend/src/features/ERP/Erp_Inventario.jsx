import React, { useState, useEffect } from 'react';
import usePosStore from '../../store/usePosStore';
import {
  getInsumosSede, getCatalogoGlobal, getSedes, registrarIngresoMasivo,
  getOrdenesCompra, getProveedores,
} from '../../api/api';
import ModalIngresoMercaderia from '../../components/modals/ModalIngresoMercaderia';
import ModalNuevoInsumoBase from '../../components/modals/ModalNuevoInsumoBase';
import ModalNuevoPedido from '../../components/modals/ModalNuevoPedido';
import ModalDetallePedido from '../../components/modals/ModalDetallePedido';
import PedidoTimeline from '../../components/PedidoTimeline';
import Erp_Proveedores from './Erp_Proveedores';
import {
  Building2, BookOpen, Search, PackageX, Plus, Truck,
  Hand, ArrowLeft, ArrowDownToLine, ShoppingCart,
  AlertTriangle, Database, CheckCircle2, ChevronRight, ClipboardList, Users,
} from 'lucide-react';

export default function InventarioView() {
  const { configuracionGlobal } = usePosStore();
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';
  const temaFondo = configuracionGlobal?.temaFondo || 'dark';
  const isDark = temaFondo === 'dark';
  const config = configuracionGlobal || { temaFondo: 'dark', colorPrimario: '#ff5a1f' };
  // ==========================================
  // 🛡️ SEGURIDAD DE ROLES
  // ==========================================
  const rolUsuario = localStorage.getItem('usuario_rol')?.toLowerCase() || '';
  const esDueño = rolUsuario === 'dueño'; 
  const sedeAdminId = localStorage.getItem('sede_id');

  const [tab, setTab] = useState('locales'); 
  const [sedeActiva, setSedeActiva] = useState(null); 
  
  const [sedes, setSedes] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [insumosSede, setInsumosSede] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  const [modalCompraOpen, setModalCompraOpen] = useState(false);
  const [modalBaseOpen, setModalBaseOpen] = useState(false);

  // ── Pedidos / Compras ──────────────────────────────────────
  const [ordenes, setOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [modalProveedoresOpen, setModalProveedoresOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [pedidoNuevoConfig, setPedidoNuevoConfig] = useState(null); // { origen, sedeFija, lineasIniciales }

  useEffect(() => {
    fetchBase();
  }, []);

  useEffect(() => {
    if (tab === 'pedidos' && esDueño) {
      fetchPedidos();
    }
  }, [tab]);

  const fetchPedidos = async () => {
    setCargandoPedidos(true);
    try {
      const [resOrdenes, resProveedores] = await Promise.all([getOrdenesCompra(), getProveedores()]);
      setOrdenes(resOrdenes.data);
      setProveedores(resProveedores.data);
    } catch (err) {
      console.error('Error cargando pedidos:', err);
    } finally {
      setCargandoPedidos(false);
    }
  };

  const abrirNuevoPedido = (config) => setPedidoNuevoConfig(config);
  const abrirSolicitudInterna = (sedeId, lineasIniciales = null) => {
    abrirNuevoPedido({ origen: 'interno', sedeFija: sedeId, lineasIniciales });
  };

  const fetchBase = async () => {
    try {
      const [resSedes, resCatalogo] = await Promise.all([getSedes(), getCatalogoGlobal()]);
      setSedes(resSedes.data);
      setCatalogo(resCatalogo.data);

      if (!esDueño) {
        const miSede = resSedes.data.find(s => String(s.id) === String(sedeAdminId));
        if (miSede) setSedeActiva(miSede);
      }
    } catch (err) {
      console.error("Error cargando base:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (sedeActiva) {
      setCargando(true);
      getInsumosSede({ sede_id: sedeActiva.id })
        .then(res => setInsumosSede(res.data))
        .catch(err => console.error(err))
        .finally(() => setCargando(false));
    }
  }, [sedeActiva]);

  const refrescarDatos = async () => {
    const resCatalogo = await getCatalogoGlobal();
    setCatalogo(resCatalogo.data);
    if (sedeActiva) {
      const resStock = await getInsumosSede({ sede_id: sedeActiva.id });
      setInsumosSede(resStock.data);
    }
  };

  const handleIngresarAMatriz = async (insumoId, cantidad) => {
    try {
      await registrarIngresoMasivo({
        insumo_base_id: insumoId,
        ingreso_global: cantidad,
        distribucion: {} 
      });
      alert("📦 Stock añadido al Almacén Central.");
      refrescarDatos();
    } catch (error) {
      const mensajeDjango = error.response?.data?.error || "Error de conexión";
      alert("Error: " + mensajeDjango);
    }
  };

  const inventarioParaMostrar = sedeActiva ? catalogo.map(itemBase => {
    const stockLocal = insumosSede.find(s => 
      s.insumo_base === itemBase.id || s.insumo_base?.id === itemBase.id
    );
    return {
      ...itemBase, 
      stock_actual: stockLocal ? stockLocal.stock_actual : 0,
      stock_minimo: stockLocal ? stockLocal.stock_minimo : 5,
    };
  }) : catalogo; 

  const itemsFiltrados = inventarioParaMostrar.filter(item => {
    const nombre = item.nombre || item.nombre_insumo || '';
    return nombre.toLowerCase().includes(busqueda.toLowerCase());
  });

  const handleTransferirDeMatriz = async (insumoId, cantidad) => {
    try {
      await registrarIngresoMasivo({
        insumo_base_id: insumoId,
        ingreso_global: 0,
        distribucion: { [sedeActiva.id]: cantidad }
      });
      alert("✅ Stock transferido de la Matriz al Local con éxito.");
      refrescarDatos();
    } catch (error) {
      const mensajeDjango = error.response?.data?.error || "Error de conexión";
      alert("Error: " + mensajeDjango);
    }
  };

  return (
    <div className="animate-fadeIn space-y-8 max-w-7xl mx-auto p-4 md:p-8 pb-24">
      
      {/* ========== 🏗️ 1. CABECERA INTEGRADA ========== */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 pt-2 pb-6 border-b" style={{ borderColor: isDark ? '#222' : '#e5e7eb' }}>
        
        {/* ✨ Título e Ícono */}
        <div className="flex items-center gap-5">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}
          >
            {/* Usamos Lucide, pero con tu contenedor de color translúcido */}
            <Database size={32} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {esDueño ? (
                <>Almacén <span style={{ color: colorPrimario }}>Central</span></>
              ) : (
                <>Inventario <span style={{ color: colorPrimario }}>Local</span></>
              )}
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              {esDueño ? 'Visión global de tus locales y catálogo de ingredientes.' : 'Audita y solicita el stock necesario para tu sede.'}
            </p>
          </div>
        </div>

        {/* ✨ CONTROLES DE DUEÑO (TABS Y BOTONES) */}
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          
          {/* TABS DE NAVEGACIÓN */}
          {esDueño && (
            <div className={`flex p-1.5 rounded-xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-100 border-gray-200'}`}>
              <button 
                onClick={() => { setTab('locales'); setSedeActiva(null); setBusqueda(''); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                  tab === 'locales' 
                    ? (isDark ? 'bg-[#222] text-white shadow-md' : 'bg-white text-gray-900 shadow-sm border border-gray-200') 
                    : (isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-500 hover:text-gray-900')
                }`}
              >
                <Building2 size={16} /> Locales
              </button>
              <button 
                onClick={() => { setTab('catalogo'); setSedeActiva(null); setBusqueda(''); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                  tab === 'catalogo' 
                    ? (isDark ? 'bg-[#222] text-white shadow-md' : 'bg-white text-gray-900 shadow-sm border border-gray-200') 
                    : (isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-500 hover:text-gray-900')
                }`}
              >
                <BookOpen size={16} /> Catálogo
              </button>
              <button
                onClick={() => { setTab('pedidos'); setSedeActiva(null); setBusqueda(''); }}
                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
                  tab === 'pedidos'
                    ? (isDark ? 'bg-[#222] text-white shadow-md' : 'bg-white text-gray-900 shadow-sm border border-gray-200')
                    : (isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-500 hover:text-gray-900')
                }`}
              >
                <ClipboardList size={16} /> Pedidos
              </button>
            </div>
          )}

          {/* BOTONES DE ACCIÓN PRINCIPAL */}
          {tab === 'pedidos' && esDueño && (
            <div className="flex gap-2">
              <button
                onClick={() => setModalProveedoresOpen(true)}
                className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
                  isDark ? 'bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border-[#333]' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                <Users size={16} /> Proveedores
              </button>
              <button
                onClick={() => abrirNuevoPedido({ origen: 'interno', sedeFija: null, lineasIniciales: null })}
                className={`px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
                  isDark ? 'bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border-[#333]' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                }`}
              >
                <Building2 size={16} /> Reabastecer Sede
              </button>
              <button
                onClick={() => abrirNuevoPedido({ origen: 'proveedor', sedeFija: null, lineasIniciales: null })}
                style={{ backgroundColor: colorPrimario }}
                className="px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <Truck size={16} /> Comprar a Proveedor
              </button>
            </div>
          )}

          {tab === 'catalogo' && esDueño && (
            <button 
              onClick={() => setModalBaseOpen(true)}
              className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
                isDark ? 'bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border-[#333]' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              <Plus size={16} /> Insumo Base
            </button>
          )}
          
          {tab === 'locales' && esDueño && (
            <button 
              onClick={() => setModalCompraOpen(true)}
              style={{ backgroundColor: colorPrimario }}
              className="px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <Truck size={16} /> Distribución
            </button>
          )}

          {!esDueño && (
            <button
              onClick={() => abrirSolicitudInterna(sedeActiva?.id)}
              style={{ backgroundColor: colorPrimario }}
              className="px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <Hand size={16} /> Pedir Insumos
            </button>
          )}
        </div>
      </div>

      {/* 🏙️ VISTA 1: LA CIUDAD (SOLO DUEÑO) */}
      {tab === 'locales' && !sedeActiva && esDueño && (
        <div className="animate-fadeIn">
          <h3 className="text-xl font-black text-white mb-6 tracking-tight flex items-center gap-2">
            <Building2 size={24} className="text-neutral-500" />
            Selecciona un Local para auditar:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sedes.map(sede => (
              <div 
                key={sede.id} 
                onClick={() => setSedeActiva(sede)}
                className="cursor-pointer bg-[#161616] border border-[#2a2a2a] p-8 rounded-[2rem] hover:border-[#ff5a1f] hover:-translate-y-2 transition-all duration-300 group relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="absolute -right-8 -bottom-8 text-neutral-800 opacity-20 group-hover:opacity-40 transition-opacity">
                  <Building2 size={180} />
                </div>
                <div className="w-20 h-20 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center mb-6 shadow-inner relative z-10 group-hover:scale-110 transition-transform duration-300">
                  <Building2 size={36} className="text-neutral-400 group-hover:text-[#ff5a1f] transition-colors" />
                </div>
                <h3 className="text-2xl font-black text-white group-hover:text-[#ff5a1f] transition-colors relative z-10">{sede.nombre}</h3>
                <p className="text-neutral-500 font-medium mt-3 flex items-center gap-1 relative z-10">
                  Auditar inventario <ChevronRight size={16} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🚪 VISTA 2: DENTRO DEL EDIFICIO */}
      {tab !== 'pedidos' && (sedeActiva || tab === 'catalogo') && (
        <div className="animate-fadeIn space-y-6">
          
          {sedeActiva && (
            <div className="flex items-center gap-4 border-b border-[#222] pb-6">
              {esDueño && (
                <button 
                  onClick={() => { setSedeActiva(null); setBusqueda(''); }}
                  className="w-12 h-12 rounded-full bg-[#161616] border border-[#333] flex items-center justify-center text-white hover:bg-[#ff5a1f] hover:border-[#ff5a1f] transition-all shrink-0"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div>
                <p className="text-xs font-black text-[#ff5a1f] uppercase tracking-widest flex items-center gap-1">
                  <Building2 size={12} /> Inventario Local
                </p>
                <h3 className="text-2xl font-black text-white">{sedeActiva.nombre}</h3>
              </div>
            </div>
          )}

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-[#ff5a1f] transition-colors">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              placeholder={`Buscar en ${tab === 'catalogo' ? 'la Matriz' : sedeActiva?.nombre}...`} 
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-[#111] border border-[#2a2a2a] text-white pl-14 pr-4 py-4 rounded-2xl focus:outline-none focus:border-[#ff5a1f] transition-colors font-medium shadow-inner placeholder-neutral-600"
            />
          </div>

          {cargando ? (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 bg-[#111] rounded-[2rem] border border-[#222]" />)}
            </div>
          ) : itemsFiltrados.length === 0 ? (
            <div className="bg-[#111] border border-[#222] rounded-[2rem] p-16 text-center flex flex-col items-center">
              <PackageX size={64} className="text-neutral-700 mb-6" />
              <h3 className="text-xl font-black text-white mb-2">Sin resultados</h3>
              <p className="text-neutral-500">No se encontraron insumos con esa descripción.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {itemsFiltrados.map((item) => (
                <InsumoCard 
                  key={item.id} 
                  item={item} 
                  isStock={!!sedeActiva} 
                  config={config} 
                  onTransferir={sedeActiva ? handleTransferirDeMatriz : handleIngresarAMatriz}
                  esDueño={esDueño}
                  onSolicitar={(insumo) => {
                    const lineaInicial = [{ insumo_base: insumo.id, cantidad_pedida: insumo.stock_minimo || '' }];
                    if (esDueño) {
                      // El destino (qué sede recibe) lo elige el dueño dentro del modal.
                      abrirNuevoPedido({ origen: 'proveedor', sedeFija: null, lineasIniciales: lineaInicial });
                    } else {
                      abrirSolicitudInterna(sedeActiva?.id, lineaInicial);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 📦 VISTA 3: PEDIDOS / COMPRAS (SOLO DUEÑO) */}
      {tab === 'pedidos' && esDueño && (
        <div className="animate-fadeIn space-y-4">
          {cargandoPedidos ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-[#111] rounded-[2rem] border border-[#222]" />)}
            </div>
          ) : ordenes.length === 0 ? (
            <div className="bg-[#111] border border-[#222] rounded-[2rem] p-16 text-center flex flex-col items-center">
              <ClipboardList size={64} className="text-neutral-700 mb-6" />
              <h3 className="text-xl font-black text-white mb-2">Sin pedidos todavía</h3>
              <p className="text-neutral-500">Crea una compra a un proveedor o un reabastecimiento entre sedes.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ordenes.map(orden => (
                <div
                  key={orden.id}
                  onClick={() => setOrdenSeleccionada(orden)}
                  className="cursor-pointer bg-[#161616] border border-[#2a2a2a] hover:border-[#444] rounded-[2rem] p-6 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                        {orden.origen === 'proveedor' ? 'Compra a Proveedor' : 'Reabastecimiento Interno'} · #{orden.id}
                      </p>
                      <h4 className="text-lg font-black text-white">
                        {orden.origen === 'proveedor' ? (orden.nombre_proveedor || 'Proveedor') : (orden.nombre_sede_destino || 'Sede')}
                      </h4>
                    </div>
                  </div>
                  <PedidoTimeline estado={orden.estado} compacto />
                  <p className="text-xs text-neutral-500 mt-4">{(orden.lineas || []).length} insumo(s)</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ModalIngresoMercaderia isOpen={modalCompraOpen} onClose={() => setModalCompraOpen(false)} sedes={sedes} onSuccess={refrescarDatos} config={config}/>
      <ModalNuevoInsumoBase isOpen={modalBaseOpen} onClose={() => setModalBaseOpen(false)} onSuccess={refrescarDatos} config={config}/>

      <ModalNuevoPedido
        isOpen={!!pedidoNuevoConfig}
        onClose={() => setPedidoNuevoConfig(null)}
        onSuccess={fetchPedidos}
        config={config}
        origen={pedidoNuevoConfig?.origen}
        sedeFija={pedidoNuevoConfig?.sedeFija}
        lineasIniciales={pedidoNuevoConfig?.lineasIniciales}
        sedes={sedes}
        catalogo={catalogo}
        proveedores={proveedores}
        onProveedorCreado={(p) => setProveedores(prev => [...prev, p])}
      />
      <ModalDetallePedido
        isOpen={!!ordenSeleccionada}
        onClose={() => setOrdenSeleccionada(null)}
        onSuccess={fetchPedidos}
        config={config}
        orden={ordenSeleccionada}
      />
      <Erp_Proveedores
        isOpen={modalProveedoresOpen}
        onClose={() => setModalProveedoresOpen(false)}
        proveedores={proveedores}
        onCambio={fetchPedidos}
        config={config}
      />
    </div>
  );
}

// 🃏 SUB-COMPONENTE: Tarjeta Inteligente
function InsumoCard({ item, isStock, config, onTransferir, esDueño, onSolicitar }) {
  const [cantidadTransferir, setCantidadTransferir] = useState('');
  
  const nombre = item.nombre || item.nombre_insumo;
  const unidad = item.unidad_medida;
  
  const stockMostrar = isStock ? (parseFloat(item.stock_actual) || 0) : (parseFloat(item.stock_general) || 0);
  const stockMatrizDisp = parseFloat(item.stock_general) || 0;
  const min = parseFloat(item.stock_minimo) || 5;
  
  const porcentaje = isStock ? Math.min((stockMostrar / (min * 3)) * 100, 100) : 0;
  const esCritico = isStock && stockMostrar <= min;

  const handleBajarStock = () => {
    const cant = parseFloat(cantidadTransferir);
    if (!cant || cant <= 0) return alert("Ingresa una cantidad válida.");
    if (cant > stockMatrizDisp) return alert("No hay suficiente stock en la Matriz.");
    onTransferir(item.id, cant);
    setCantidadTransferir('');
  };

  return (
    <div className={`bg-[#161616] border p-6 rounded-[2rem] flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${esCritico ? 'border-red-500/30 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.05)]' : 'border-[#2a2a2a] hover:border-[#444] hover:-translate-y-1'}`}>
      
      {/* Fondo sutil si es crítico */}
      {esCritico && (
        <div className="absolute top-0 left-0 w-full h-full bg-red-500/5 pointer-events-none"></div>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          {isStock && esCritico && onSolicitar ? (
            <button
              onClick={() => onSolicitar(item)}
              title="Agregar a un pedido"
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <AlertTriangle size={12}/> Alerta Stock
            </button>
          ) : (
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5 ${isStock ? (esCritico ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20') : 'bg-[#ff5a1f]/10 text-[#ff5a1f] border border-[#ff5a1f]/20'}`}>
              {isStock ? (
                esCritico ? <><AlertTriangle size={12}/> Alerta Stock</> : <><CheckCircle2 size={12}/> Stock Local</>
              ) : (
                <><Database size={12}/> Stock en Matriz</>
              )}
            </span>
          )}
        </div>
        
        <h4 className="text-xl font-black text-white leading-tight line-clamp-2" title={nombre}>{nombre}</h4>
        
        <div className="mt-4">
          <p className="text-5xl font-mono font-black text-white tracking-tighter">
            {stockMostrar}
            <span className="text-sm font-sans text-neutral-500 font-bold ml-2 uppercase tracking-wider">{unidad}</span>
          </p>
        </div>
      </div>

      {isStock ? (
        <div className="mt-6 space-y-5 relative z-10">
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] font-bold text-neutral-500 uppercase">
              <span>Mín: {min}</span>
              <span>Nivel</span>
            </div>
            <div className="w-full h-2 bg-[#0a0a0a] rounded-full overflow-hidden border border-[#222]">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${esCritico ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-green-500'}`} 
                style={{ width: `${porcentaje}%` }}
              ></div>
            </div>
          </div>

          {esDueño ? (
            <div className="pt-5 border-t border-[#2a2a2a]">
              <p className="text-[11px] text-neutral-400 font-bold uppercase mb-3 flex items-center gap-1.5">
                <Database size={12} /> Disp. en Matriz: <strong className="text-white text-sm font-mono">{stockMatrizDisp}</strong> {unidad}
              </p>
              <div className="flex gap-2">
                <input 
                  type="number" min="0" placeholder="0.0" value={cantidadTransferir} onChange={(e) => setCantidadTransferir(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-2 rounded-xl text-white font-mono text-sm outline-none focus:border-[#ff5a1f] transition-colors"
                />
                <button 
                  onClick={handleBajarStock}
                  className="bg-[#222] hover:bg-[#ff5a1f] hover:text-white text-neutral-300 font-bold px-4 py-2 rounded-xl text-sm transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <ArrowDownToLine size={16} /> Bajar
                </button>
              </div>
            </div>
          ) : (
             <div className="pt-4 border-t border-[#2a2a2a]">
                <button
                  onClick={() => onSolicitar?.(item)}
                  className="w-full bg-[#222] hover:bg-white hover:text-black text-neutral-300 font-bold px-4 py-3.5 rounded-xl text-sm transition-colors flex justify-center items-center gap-2"
                >
                  <Hand size={18} /> Solicitar Abastecimiento
                </button>
             </div>
          )}
        </div>
      ) : (
        // VISTA DE MATRIZ (Catálogo)
        <div className="mt-6 pt-5 border-t border-[#2a2a2a] relative z-10">
          <p className="text-[11px] text-neutral-400 font-bold uppercase mb-3">
            Ingreso directo a Matriz:
          </p>
          <div className="flex gap-2">
            <input 
              type="number" min="0" placeholder="0.0" value={cantidadTransferir} onChange={(e) => setCantidadTransferir(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#333] px-4 py-2 rounded-xl text-white font-mono text-sm outline-none focus:border-[#ff5a1f] transition-colors"
            />
            <button 
              onClick={() => {
                const cant = parseFloat(cantidadTransferir);
                if (cant > 0) {
                  onTransferir(item.id, cant); 
                  setCantidadTransferir('');
                }
              }}
              className="bg-[#222] hover:bg-green-600 hover:text-white text-neutral-300 font-bold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-1.5"
            >
              <ShoppingCart size={16} /> Añadir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}