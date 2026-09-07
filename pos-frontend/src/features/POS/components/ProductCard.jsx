import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

// Pedido directo: mobile ya muestra la foto del plato en la tarjeta
// (PosScreen.jsx → renderProducto) y se ve mejor así — la web era solo
// texto. Mismo layout acá: imagen fija arriba (o un placeholder con
// ícono si el producto no tiene foto), el resto del contenido queda igual.
function ImagenProducto({ prod, isDark }) {
  return (
    <div className={`h-24 sm:h-28 w-full shrink-0 overflow-hidden ${isDark ? 'bg-[#0a0a0a]' : 'bg-gray-100'}`}>
      {prod.imagen ? (
        <img src={prod.imagen} alt={prod.nombre} className="w-full h-full object-cover pointer-events-none" />
      ) : (
        <div className="w-full h-full flex items-center justify-center pointer-events-none">
          <UtensilsCrossed size={22} className={isDark ? 'text-neutral-700' : 'text-gray-300'} />
        </div>
      )}
    </div>
  );
}

export default function ProductCard({
  prod,
  tema,
  colorPrimario,
  carrito,
  categoriasReales,
  ordenActiva,
  totalMesa,
  busqueda,
  abrirModalParaNuevo,
  aprenderSeleccion,
  agregarProducto,
  restarDesdeGrid,
  notificarEstadoMesa,
  formatearSoles,
  happyHours,
  limpiarBusqueda,
}) {
  const isDark = tema === 'dark';
  const totalCantidadProd = carrito.filter(item => item.id === prod.id).reduce((acc, curr) => acc + curr.cantidad, 0);
  const tieneVariantes = carrito.some(item => item.id === prod.id && item.cart_id !== `base_${prod.id}`);
  const nombreCategoriaMuestra = categoriasReales.find(c => String(c.id) === String(prod.categoria))?.nombre || 'Sin categoría';
  // Verificar si este producto tiene alguna HH activa
  const tieneHappyHour = happyHours?.some(hh => 
    (hh.producto && String(hh.producto) === String(prod.id)) ||
    (hh.categoria && String(hh.categoria) === String(prod.categoria))
  );
  // ==========================================
  // CASO 1: PRODUCTO REQUIERE SELECCIÓN OBLIGATORIA
  // ==========================================
  if (prod.requiere_seleccion) {
    return (
      <button
        onClick={() => {
            if (prod.disponible) {
                // Si se llegó buscando el nombre de una variante (ej.
                // "gordita"), el modal se abre con esa opción ya elegida.
                abrirModalParaNuevo(prod, prod._coincidenciaOpcion || null);
                aprenderSeleccion(prod.id, busqueda);
            }
        }}
        disabled={!prod.disponible}
        className={`relative rounded-3xl transition-all flex flex-col text-left overflow-hidden h-60 sm:h-72 border ${
          tieneHappyHour ? 'border-amber-500/30' :  // 👈 agrega esto primero
          prod.disponible
            ? (isDark ? 'bg-[#141414] border-[#222] hover:border-[#333] hover:-translate-y-1 cursor-pointer' : 'bg-white border-gray-200 hover:border-gray-300 hover:-translate-y-1 cursor-pointer')
            : (isDark ? 'bg-[#0a0a0a] border-[#1a1a1a] opacity-50 cursor-not-allowed' : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed')
        }`}
      >
        {!prod.disponible && (
          <div className="absolute top-3 right-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest z-10">
            Agotado
          </div>
        )}

        <ImagenProducto prod={prod} isDark={isDark} />

        <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between pointer-events-none">
          <div className="flex flex-col">
            <span className={`font-bold leading-tight text-[14px] sm:text-[16px] line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {prod.nombre}
            </span>

            {tieneHappyHour && (
              <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-1 w-fit"
                style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>
                <i className="fi fi-rr-clock text-[8px]" /> Happy Hour
              </span>
            )}
            {prod._coincidenciaVariacion && (
              <span className="text-[10px] font-black uppercase mt-0.5 animate-pulse" style={{ color: colorPrimario }}>
                ↳ {prod._coincidenciaVariacion}
              </span>
            )}

            <p className={`text-[9px] sm:text-[10px] mt-0.5 uppercase font-black tracking-widest truncate ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              {nombreCategoriaMuestra}
            </p>
          </div>

          <div className="flex justify-between items-end w-full mt-1 shrink-0">
              <span className={`text-[9px] sm:text-[10px] uppercase font-black tracking-widest px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${isDark ? 'text-neutral-400 bg-[#1a1a1a] border-[#333]' : 'text-gray-500 bg-gray-100 border-gray-200'}`}>
                <i className="fi fi-rr-list text-[10px] mt-0.5"></i> Opciones
              </span>
              {totalCantidadProd > 0 && (
                  <div className="text-white w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-sm sm:text-base" style={{ backgroundColor: colorPrimario }}>
                    {totalCantidadProd}
                  </div>
              )}
          </div>
        </div>
      </button>
    );
  }

  // ==========================================
  // CASO 2: PRODUCTO ESTÁNDAR (Con o sin variantes opcionales)
  // ==========================================
  const base = parseFloat(prod.precio_base ?? prod.precio ?? 0);
  const min  = parseFloat(prod.precio_minimo ?? base);
  const max  = parseFloat(prod.precio_maximo ?? base);
  const precioAMostrar = min;
  const mostrarDesde = prod.tiene_variaciones && min !== max;
  
  return (
    <div
      onClick={() => {
        if (prod.disponible) {
          if (prod._coincidenciaOpcion) {
            // Se buscó el nombre de una variante (ej. "gordita") en vez del
            // producto — abre el modal con esa opción ya seleccionada en
            // lugar de agregar el producto base sin variante.
            abrirModalParaNuevo(prod, prod._coincidenciaOpcion);
          } else {
            if (ordenActiva) notificarEstadoMesa('tomando_pedido', totalMesa);
            agregarProducto(prod);
            limpiarBusqueda?.();
          }
          aprenderSeleccion(prod.id, busqueda);
        }
      }}
      className={`relative rounded-3xl transition-all flex flex-col text-left overflow-hidden h-60 sm:h-72 border ${
        prod.disponible
          ? (isDark ? 'bg-[#141414] border-[#222] hover:border-[#333] hover:-translate-y-1 cursor-pointer' : 'bg-white border-gray-200 hover:border-gray-300 hover:-translate-y-1 cursor-pointer')
          : (isDark ? 'bg-[#0a0a0a] border-[#1a1a1a] opacity-50 cursor-not-allowed' : 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed')
      }`}
    >
      {!prod.disponible && (
        <div className="absolute top-3 right-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest z-10">
          Agotado
        </div>
      )}

      <ImagenProducto prod={prod} isDark={isDark} />

      <div className="flex-1 mb-1 p-3 sm:p-4 pointer-events-none flex flex-col">
        <span className={`font-bold leading-tight text-[14px] sm:text-[16px] line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {prod.nombre}
        </span>
        {prod.es_combo && (
          <span className="inline-flex items-center text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-1 w-fit"
            style={{ backgroundColor: colorPrimario + '20', color: colorPrimario, border: `1px solid ${colorPrimario}30` }}>
            Combo
          </span>
        )}
        {tieneHappyHour && (
          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md mt-1 w-fit"
            style={{ backgroundColor: '#f59e0b20', color: '#f59e0b' }}>
            <i className="fi fi-rr-clock text-[8px]" /> Happy Hour
          </span>
        )}
        {prod._coincidenciaVariacion && (
          <span className="text-[10px] font-black uppercase mt-0.5 animate-pulse" style={{ color: colorPrimario }}>
            ↳ {prod._coincidenciaVariacion}
          </span>
        )}

        <p className={`text-[9px] mt-0.5 uppercase font-black tracking-widest truncate ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
          {nombreCategoriaMuestra}
        </p>

        <p className="font-black text-xs sm:text-sm mt-auto pb-1" style={{ color: colorPrimario }}>
          {mostrarDesde && <span className="text-[9px] font-black opacity-60 mr-0.5">Desde </span>}
          <span className="text-[10px] mr-0.5 opacity-80">S/</span>{formatearSoles(precioAMostrar).replace('S/ ', '')}
        </p>
      </div>

      <div className={`flex flex-row items-center justify-between gap-1.5 px-3 pb-3 sm:px-4 sm:pb-4 pt-2 border-t shrink-0 ${!prod.disponible ? 'pointer-events-none' : ''} ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
          
          {totalCantidadProd > 0 && (
            <div className="flex-1 flex items-center justify-between gap-1.5">
              {/* Botón Restar */}
              <button 
                onClick={(e) => { e.stopPropagation(); restarDesdeGrid(prod.id); }} 
                disabled={!prod.disponible} 
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-lg transition-all border disabled:opacity-50 ${isDark ? 'bg-[#1a1a1a] text-red-400 border-[#333] hover:bg-red-500/10 hover:border-red-500/30' : 'bg-gray-50 text-red-500 border-gray-200 hover:bg-red-50 hover:border-red-200'}`}
              >
                -
              </button>
              
              {/* Contador Central */}
              <span className={`flex-1 h-8 sm:h-10 rounded-xl font-black text-sm sm:text-base flex items-center justify-center border transition-all relative ${isDark ? 'bg-[#1a1a1a] text-white border-[#333]' : 'bg-gray-50 text-gray-900 border-gray-200'}`}>
                  {totalCantidadProd}
                  {tieneVariantes && (
                    <span className="absolute top-1 right-1">
                      <i className="fi fi-rr-settings text-[8px]" style={{ color: colorPrimario }}></i>
                    </span>
                  )}
              </span>
              
              {/* Botón Sumar */}
              <button 
                onClick={(e) => { e.stopPropagation(); agregarProducto(prod); }} 
                disabled={!prod.disponible} 
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-lg transition-all border disabled:opacity-50`}
                style={{ backgroundColor: `${colorPrimario}15`, borderColor: `${colorPrimario}30`, color: colorPrimario }}
              >
                +
              </button>
            </div>
          )}
          
          {/* BOTONES DE CONFIGURACIÓN (Variaciones / Notas) */}
          {prod.tiene_variaciones ? (
            totalCantidadProd > 0 ? (
              <button 
                onClick={(e) => { e.stopPropagation(); abrirModalParaNuevo(prod); }} 
                disabled={!prod.disponible} 
                className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl border transition-colors flex items-center justify-center hover:brightness-110 disabled:opacity-50`} 
                style={{ color: colorPrimario, backgroundColor: colorPrimario + '15', borderColor: colorPrimario + '30' }}
                title="Configurar Variaciones"
              >
                <i className="fi fi-rr-settings text-sm mt-0.5"></i>
              </button>
            ) : (
              <button 
                onClick={(e) => { e.stopPropagation(); abrirModalParaNuevo(prod); }} 
                disabled={!prod.disponible} 
                className={`w-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest py-2.5 sm:py-3 rounded-xl border transition-colors hover:brightness-110 flex items-center justify-center gap-1.5`} 
                style={{ color: colorPrimario, backgroundColor: colorPrimario + '15', borderColor: colorPrimario + '30' }}
              >
                <i className="fi fi-rr-settings text-xs mt-0.5"></i> Variantes
              </button>
            )
          ) : (
            totalCantidadProd > 0 ? (
              <button 
                onClick={(e) => { e.stopPropagation(); abrirModalParaNuevo(prod); }} 
                disabled={!prod.disponible} 
                className={`shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl border transition-colors flex items-center justify-center disabled:opacity-50 ${isDark ? 'bg-[#1a1a1a] border-[#333] text-neutral-400 hover:text-white hover:border-[#444]' : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-900'}`} 
                title="Agregar Nota"
              >
                <i className="fi fi-rr-comment-alt text-sm mt-0.5"></i>
              </button>
            ) : (
              <div className="w-full flex justify-end">
                <button 
                  onClick={(e) => { e.stopPropagation(); abrirModalParaNuevo(prod); }} 
                  disabled={!prod.disponible} 
                  className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border transition-colors flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 ${isDark ? 'text-neutral-500 bg-[#1a1a1a] border-[#333] hover:text-white hover:border-[#444]' : 'text-gray-500 bg-gray-50 border-gray-200 hover:text-gray-900'}`}
                >
                  <i className="fi fi-rr-comment-alt text-xs mt-0.5"></i> <span className="hidden sm:inline">Nota</span>
                </button>
              </div>
            )
          )}
      </div>
    </div>
  );
}