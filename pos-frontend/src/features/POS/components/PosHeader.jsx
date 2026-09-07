import React from 'react';

export default function PosHeader({
  esModoTerminal,
  onVolver,
  tema,
  colorPrimario,
  esParaLlevar,
  nombreLlevar,
  mesaId,
  numeroMesaMostrado,
  inputBusquedaActivo,
  setInputBusquedaActivo,
  busqueda,
  setBusqueda,
  categoriaActiva,
  setCategoriaActiva,
  categoriasReales,
  productosBase
}) {
  const isDark = tema === 'dark';

  return (
    <>
      {/* ======================= HEADER TEMATIZADO (MÓVIL) ======================= */}
      {!esModoTerminal && (
        <header className={`px-4 py-4 sticky top-0 z-10 border-b transition-colors ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
          <div className="flex justify-between items-center mb-4 gap-3">
            <div className="flex items-center gap-3 flex-1">
              {/* Botón Volver (Estilo ERP) */}
              <button 
                onClick={onVolver} 
                className={`shrink-0 w-11 h-11 border rounded-xl flex items-center justify-center transition-colors active:scale-95 ${
                  isDark 
                    ? 'bg-[#141414] hover:bg-[#1a1a1a] border-[#222] text-neutral-400 hover:text-white' 
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-900'
                }`}
              >
                <i className="fi fi-rr-angle-left text-xl mt-1"></i>
              </button>
              
              {inputBusquedaActivo ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input 
                      autoFocus
                      type="text"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar plato..."
                      className={`w-full h-11 px-4 rounded-xl font-bold text-sm border focus:outline-none transition-colors ${
                        isDark 
                          ? 'bg-[#0a0a0a] border-[#333] text-white focus:border-neutral-500' 
                          : 'bg-white border-gray-300 text-gray-900 focus:border-gray-400'
                      }`}
                      style={{ borderColor: busqueda ? colorPrimario : '' }}
                    />
                    <button 
                      onClick={() => { setInputBusquedaActivo(false); setBusqueda(''); }} 
                      className={`w-11 h-11 flex items-center justify-center text-xl font-black active:scale-90 transition-colors ${
                        isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <i className="fi fi-rr-cross-small mt-1"></i>
                    </button>
                  </div>
              ) : (
                <div className="flex-1 flex justify-between items-center">
                  <div className="min-w-0">
                      <span className={`text-[10px] font-black tracking-widest uppercase truncate flex items-center gap-1.5 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                        {esParaLlevar ? <><i className="fi fi-rr-motorcycle"></i> Cajón Delivery</> : <><i className="fi fi-rr-restaurant"></i> Salón</>}
                      </span>
                      <h1 className={`text-xl font-black uppercase tracking-tight truncate leading-none mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {/* 🛠️ mesaId es el id de la fila en la BD (autoincremental
                            GLOBAL de todo el sistema, no del negocio) — mostrarlo
                            tal cual hacía que "Mesa 1" apareciera como "Mesa 15"
                            en negocios con pocas mesas. numeroMesaMostrado trae el
                            número/nombre real (ver TerminalSidebar.jsx); si no
                            llega (por compatibilidad), cae al id como antes. */}
                        {esParaLlevar ? nombreLlevar : `Mesa ${numeroMesaMostrado ?? mesaId}`}
                      </h1>
                  </div>
                  <button 
                    onClick={() => setInputBusquedaActivo(true)} 
                    className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors active:scale-95 border ${
                      isDark 
                        ? 'bg-[#141414] border-[#222] text-neutral-400 hover:text-white' 
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    <i className="fi fi-rr-search text-lg mt-0.5"></i>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide snap-x">
            {/* Pill de Categorías MÓVIL sin sombras */}
            <button 
              onClick={() => setCategoriaActiva('Todas')}
              className={`snap-start shrink-0 px-5 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border ${
                categoriaActiva === 'Todas' 
                  ? `text-white border-transparent` 
                  : (isDark ? 'bg-transparent text-neutral-500 border-[#333] hover:text-white hover:bg-[#141414]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')
              }`}
              style={categoriaActiva === 'Todas' ? { backgroundColor: colorPrimario } : {}}
            >
              TODAS
            </button>
            
            {categoriasReales
              .filter(cat => productosBase.some(prod => String(prod.categoria) === String(cat.id) || prod.categoria === cat.nombre || prod.categoria === cat))
              .map((cat, index) => {
              const nombreMostrar = cat.nombre || cat;
              const keyUnica = cat.id || `cat-${index}`;
              return (
                <button 
                  key={keyUnica} 
                  onClick={() => setCategoriaActiva(nombreMostrar)}
                  className={`snap-start shrink-0 px-5 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 border ${
                    categoriaActiva === nombreMostrar
                      ? `text-white border-transparent` 
                      : (isDark ? 'bg-transparent text-neutral-500 border-[#333] hover:text-white hover:bg-[#141414]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')
                  }`}
                  style={categoriaActiva === nombreMostrar ? { backgroundColor: colorPrimario } : {}}
                >
                  {nombreMostrar}
                </button>
              )
            })}
          </div>
        </header>
      )}

      {/* ======================= HEADER MODO TERMINAL (PC PANTALLA DIVIDIDA) ======================= */}
      {esModoTerminal && (
        <div className={`px-4 sm:px-6 pt-4 pb-3 sticky top-0 z-10 border-b transition-colors ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
           <div className="mb-4">
             {inputBusquedaActivo ? (
                <div className="flex items-center gap-2">
                  <input 
                    autoFocus
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar plato rápidamente..."
                    className={`w-full h-12 px-5 rounded-2xl font-bold text-sm border focus:outline-none transition-colors ${
                      isDark ? 'bg-[#0a0a0a] border-[#333] text-white focus:border-neutral-500' : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-gray-400'
                    }`}
                    style={{ borderColor: busqueda ? colorPrimario : '' }} // Se quitó el boxShadow encendido
                  />
                  <button 
                    onClick={() => { setInputBusquedaActivo(false); setBusqueda(''); }} 
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black active:scale-95 transition-colors border ${
                      isDark ? 'bg-[#141414] text-neutral-400 border-[#222] hover:text-white hover:border-[#333]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:text-gray-900'
                    }`}
                  >
                    <i className="fi fi-rr-cross-small mt-1"></i>
                  </button>
                </div>
             ) : (
                <button 
                  onClick={() => setInputBusquedaActivo(true)} 
                  className={`w-full h-12 px-5 rounded-2xl font-bold text-sm border flex items-center justify-between transition-colors active:scale-[0.99] ${
                    isDark ? 'bg-[#141414] border-[#222] text-neutral-400 hover:border-[#333] hover:text-white' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <i className="fi fi-rr-search mt-0.5"></i> Buscar por nombre o atajo...
                  </span>
                  <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-lg border uppercase tracking-widest ${
                    isDark ? 'bg-[#1a1a1a] border-[#333] text-neutral-500' : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    Ctrl + K
                  </span>
                </button>
             )}
           </div>

           <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide snap-x">
             {/* Pill de Categorías PC sin sombras */}
              <button 
                onClick={() => setCategoriaActiva('Todas')}
                className={`snap-start shrink-0 px-5 py-2.5 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 border ${
                  categoriaActiva === 'Todas' 
                    ? `text-white border-transparent` 
                    : (isDark ? 'bg-transparent text-neutral-500 border-[#333] hover:text-white hover:bg-[#141414]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')
                }`}
                style={categoriaActiva === 'Todas' ? { backgroundColor: colorPrimario } : {}}
              >
                TODAS
              </button>

              {categoriasReales
                .filter(cat => productosBase.some(prod => String(prod.categoria) === String(cat.id) || prod.categoria === cat.nombre || prod.categoria === cat))
                .map((cat, index) => {
                const nombreMostrar = cat.nombre || cat;
                const keyUnica = cat.id || `cat-${index}`;
                return (
                  <button 
                    key={keyUnica} 
                    onClick={() => setCategoriaActiva(nombreMostrar)}
                    className={`snap-start shrink-0 px-5 py-2.5 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all active:scale-95 border ${
                      categoriaActiva === nombreMostrar
                        ? `text-white border-transparent` 
                        : (isDark ? 'bg-transparent text-neutral-500 border-[#333] hover:text-white hover:bg-[#141414]' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100')
                    }`}
                    style={categoriaActiva === nombreMostrar ? { backgroundColor: colorPrimario } : {}}
                  >
                    {nombreMostrar}
                  </button>
                )
              })}
           </div>
        </div>
      )}
    </>
  );
}