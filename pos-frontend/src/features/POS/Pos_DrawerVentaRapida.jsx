import React, { useState, useEffect } from 'react';
import { getProductos } from '../../api/api';
import usePosStore from '../../store/usePosStore';

const formatearSoles = (monto) => {
  const numero = parseFloat(monto);
  if (isNaN(numero)) return "S/ 0.00";
  return `S/ ${numero.toFixed(2)}`;
};

const obtenerPrecio = (p) => {
  const precio = p.precio_base !== undefined ? p.precio_base : p.precio;
  return parseFloat(precio) || 0;
};

export default function DrawerVentaRapida({ isOpen, onClose, onProcederPago, modoInline = false, mostrarTodos = false }) {
  const { configuracionGlobal } = usePosStore();
  const tema = configuracionGlobal?.temaFondo || 'dark';
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';

  const [productosRapidos, setProductosRapidos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const sedeActualId = localStorage.getItem('sede_id');

  // 🏬 Modo Tienda (modoInline + mostrarTodos): siempre "abierto", muestra
  // el catálogo completo en vez de solo los productos marcados a mano como
  // "venta rápida" — no tiene sentido pedirle al dueño de una tienda que
  // marque producto por producto. El modo restaurante (drawer normal) no
  // se toca: sigue filtrando por es_venta_rapida.
  const abierto = modoInline || isOpen;

  const cargarProductos = async () => {
    try {
      const res = await getProductos({ sede_id: sedeActualId });
      const filtrados = mostrarTodos ? (res.data || []) : (res.data || []).filter(p => p.es_venta_rapida === true);
      setProductosRapidos(filtrados);
    } catch (error) {
      console.error("Error cargando menú para venta rápida", error);
    }
  };

  useEffect(() => {
    if (abierto) {
      cargarProductos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const agregarAlCarrito = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === producto.id);
      if (existe) {
        return prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...prev, { id: producto.id, nombre: producto.nombre, precio: obtenerPrecio(producto), cantidad: 1 }];
    });
  };

  const restarDelCarrito = (id) => {
    setCarrito(prev => {
      const existe = prev.find(item => item.id === id);
      if (!existe) return prev;
      if (existe.cantidad === 1) {
        return prev.filter(item => item.id !== id);
      } else {
        return prev.map(item => item.id === id ? { ...item, cantidad: item.cantidad - 1 } : item);
      }
    });
  };

  const calcularTotal = () => carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  return (
    <div className={modoInline
      ? 'h-full w-full flex flex-col'
      : `fixed inset-0 z-[100] transition-all duration-300 ease-out ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`
    }>
      {!modoInline && <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>}

      <div className={modoInline
        ? `flex-1 flex flex-col overflow-hidden ${tema === 'dark' ? 'bg-[#0a0a0a]' : 'bg-[#fcfcfc]'}`
        : `absolute right-0 top-0 bottom-0 w-[95%] md:w-[85%] lg:w-[80%] max-w-[1400px] flex flex-col transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? 'translate-x-0' : 'translate-x-full'} ${
          tema === 'dark' ? 'bg-[#0a0a0a] border-l border-[#222]' : 'bg-[#fcfcfc] border-l border-gray-200'
        }`
      }>

        {/* CABECERA */}
        <div className={`p-4 md:p-6 flex justify-between items-center border-b sticky top-0 z-10 shrink-0 ${
          tema === 'dark' ? 'border-[#222] bg-[#0d0d0d]' : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `${colorPrimario}20`, color: colorPrimario }}>
              <i className="fi fi-rr-bolt text-2xl mt-1"></i>
            </div>
            <div>
                <h2 className="text-xl md:text-3xl font-black uppercase tracking-tighter leading-none" style={{ color: colorPrimario }}>
                  {modoInline ? 'Tienda' : 'Venta Directa'}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded ${tema === 'dark' ? 'bg-[#1a1a1a] text-neutral-500' : 'bg-gray-100 text-gray-400'}`}>
                    Sede: {localStorage.getItem('sede_nombre') || 'Principal'}
                  </span>
                </div>
            </div>
          </div>
          {!modoInline && (
            <button
              onClick={onClose}
              className={`w-12 h-12 rounded-2xl flex justify-center items-center transition-all active:scale-90 ${
                tema === 'dark'
                  ? 'bg-[#1a1a1a] text-neutral-400 hover:text-white border border-[#222]'
                  : 'bg-gray-100 text-gray-500 hover:text-gray-900 border border-gray-200'
              }`}
            >
              <i className="fi fi-rr-cross-small text-2xl"></i>
            </button>
          )}
        </div>

        {/* CUERPO */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* PANEL DE PRODUCTOS */}
          <div className={`flex-1 flex flex-col p-4 md:p-8 overflow-hidden border-b lg:border-b-0 lg:border-r ${
            tema === 'dark' ? 'bg-[#050505] border-[#222]' : 'bg-[#f8f9fa] border-gray-200'
          }`}>
            <div className="flex items-center gap-3 mb-6">
              <i className={`fi fi-rr-apps ${tema === 'dark' ? 'text-neutral-600' : 'text-gray-400'}`}></i>
              <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}>{mostrarTodos ? 'Catálogo' : 'Productos Rápidos'}</h3>
              <div className={`flex-1 h-px ${tema === 'dark' ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`}></div>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 content-start pr-2 scrollbar-hide">
              {productosRapidos.length === 0 && (
                <div className="col-span-full text-center py-32 opacity-30">
                  <i className="fi fi-rr-box-open text-6xl block mb-4"></i>
                  <p className="font-bold uppercase tracking-widest text-xs">Sin productos configurados</p>
                </div>
              )}
              {productosRapidos.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => agregarAlCarrito(p)}
                  className={`group relative p-5 rounded-3xl border text-left transition-all active:scale-[0.95] flex flex-col justify-between min-h-[140px] overflow-hidden ${
                    tema === 'dark'
                      ? 'bg-[#121212] border-[#2a2a2a] hover:border-[#444]'
                      : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'
                  }`}
                >
                  {/* Badge flotante de precio */}
                  <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: colorPrimario }}>
                    <i className="fi fi-rr-add text-xl"></i>
                  </div>

                  <span className={`font-black text-base md:text-lg leading-tight transition-colors ${
                    tema === 'dark' ? 'text-neutral-200 group-hover:text-white' : 'text-gray-800'
                  }`}>
                    {p.nombre}
                  </span>

                  <div className="mt-4 pt-4 border-t border-dashed border-neutral-800 flex items-center justify-between">
                    <span className="font-mono font-black text-xl" style={{ color: colorPrimario }}>
                      {formatearSoles(obtenerPrecio(p))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* PANEL DEL CARRITO */}
          <div className={`h-[45vh] lg:h-auto lg:w-[380px] xl:w-[450px] flex flex-col shrink-0 ${
            tema === 'dark' ? 'bg-[#0d0d0d]' : 'bg-white'
          }`}>
            <div className={`p-4 md:p-6 font-black border-b flex items-center gap-3 ${
              tema === 'dark' ? 'text-neutral-400 border-[#222] bg-[#111]' : 'text-gray-600 border-gray-200 bg-gray-50'
            }`}>
              <i className="fi fi-rr-receipt mt-1"></i>
              <span className="text-xs uppercase tracking-[0.2em]">Resumen de Ticket</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scrollbar-hide">
              {carrito.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-10">
                    <i className="fi fi-rr-shopping-cart text-6xl mb-4"></i>
                    <p className="text-xs font-black uppercase tracking-widest leading-relaxed">El ticket está vacío</p>
                </div>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className={`group flex flex-col p-4 rounded-2xl border transition-all ${
                    tema === 'dark' ? 'bg-[#141414] border-[#222] hover:border-[#333]' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`font-black leading-tight flex-1 pr-4 ${
                        tema === 'dark' ? 'text-white' : 'text-gray-800'
                      }`}>{item.nombre}</span>
                      <span className="font-mono font-black text-base shrink-0" style={{ color: colorPrimario }}>
                        {formatearSoles(item.precio * item.cantidad)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        tema === 'dark' ? 'text-neutral-600' : 'text-gray-400'
                      }`}>{formatearSoles(item.precio)} c/u</span>
                      
                      <div className={`flex items-center gap-1 rounded-xl p-1 border ${
                        tema === 'dark' ? 'bg-[#050505] border-[#222]' : 'bg-white border-gray-200'
                      }`}>
                        <button 
                          onClick={() => restarDelCarrito(item.id)} 
                          className={`w-8 h-8 flex justify-center items-center rounded-lg transition-all active:scale-75 ${
                            tema === 'dark' ? 'text-neutral-500 hover:text-red-500 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500'
                          }`}
                        >
                          <i className="fi fi-rr-minus-small text-xl"></i>
                        </button>
                        
                        <span className={`font-black text-base w-8 text-center ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {item.cantidad}
                        </span>
                        
                        <button 
                          onClick={() => agregarAlCarrito(item)} 
                          className={`w-8 h-8 flex justify-center items-center rounded-lg transition-all active:scale-75 ${
                            tema === 'dark' ? 'text-neutral-500 hover:text-emerald-500 hover:bg-emerald-500/10' : 'text-gray-400 hover:text-emerald-500'
                          }`}
                        >
                          <i className="fi fi-rr-plus-small text-xl"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* TOTAL Y BOTÓN COBRO */}
            <div className={`p-6 md:p-8 border-t shrink-0 ${
              tema === 'dark' ? 'border-[#222] bg-[#0d0d0d]' : 'border-gray-200 bg-white'
            }`}>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <span className={`block text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${
                    tema === 'dark' ? 'text-neutral-500' : 'text-gray-400'
                  }`}>Total a Pagar</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl md:text-5xl font-black tracking-tighter" style={{ color: colorPrimario }}>
                      {formatearSoles(calcularTotal())}
                    </span>
                  </div>
                </div>
              </div>
              
              <button 
                disabled={carrito.length === 0}
                onClick={() => onProcederPago(carrito, calcularTotal())}
                className={`group w-full py-5 rounded-2xl font-black uppercase tracking-[0.1em] text-lg md:text-xl transition-all flex justify-center items-center gap-3 ${
                  carrito.length > 0 
                    ? 'text-white shadow-xl active:scale-95 hover:brightness-110' 
                    : (tema === 'dark' ? 'bg-[#1a1a1a] text-neutral-600' : 'bg-gray-100 text-gray-300')
                }`}
                style={carrito.length > 0 ? { 
                  backgroundColor: colorPrimario,
                  boxShadow: `0 10px 30px ${colorPrimario}40` 
                } : {}}
              >
                PAGO EXPRESS
                <i className={`fi fi-rr-angle-small-right text-2xl transition-transform group-hover:translate-x-1 ${carrito.length === 0 ? 'opacity-0' : ''}`}></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}