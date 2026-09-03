import React, { useState, useEffect } from 'react';

export default function Erp_ModalCategorias({
  isOpen,
  onClose,
  tema,
  colorPrimario,
  nombreNuevaCat,
  setNombreNuevaCat,
  manejarCrearCategoria,
  categorias,
  eliminarCategoriaLocal
}) {
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    if (!isOpen) setBusqueda('');
  }, [isOpen]);

  if (!isOpen) return null;

  const categoriasFiltradas = categorias.filter(c => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className={`border rounded-3xl w-full max-w-md animate-fadeIn relative overflow-hidden transition-colors ${tema === 'dark' ? 'bg-[#121212] border-[#333]' : 'bg-white border-gray-200'}`}>
        
        {/* Cabecera */}
        <div className={`p-6 border-b flex justify-between items-center transition-colors ${tema === 'dark' ? 'border-[#222] bg-[#1a1a1a]' : 'border-gray-200 bg-gray-50'}`}>
          <h3 className={`text-xl font-black ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>Categorías del Menú</h3>
          <button onClick={onClose} className={`font-bold text-xl transition-colors ${tema === 'dark' ? 'text-neutral-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}`}>✕</button>
        </div>
        
        <div className="p-6 space-y-6">
          
          {/* INPUT PARA NUEVA CATEGORÍA */}
          <div className="flex gap-2">
            <input 
              type="text" 
              value={nombreNuevaCat}
              onChange={(e) => setNombreNuevaCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && manejarCrearCategoria()}
              className={`flex-1 border rounded-xl px-4 py-3 outline-none transition-colors ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333] text-white focus:border-[#ff5a1f]' : 'bg-white border-gray-300 text-gray-900 focus:border-[#ff5a1f]'}`} 
              style={{ '--tw-ring-color': colorPrimario }}
              onFocus={(e) => e.target.style.borderColor = colorPrimario}
              onBlur={(e) => e.target.style.borderColor = tema === 'dark' ? '#333' : '#d1d5db'}
              placeholder="Ej. Bebidas, Postres..." 
            />
            <button 
              onClick={manejarCrearCategoria}
              disabled={!nombreNuevaCat.trim()}
              className="text-white px-6 font-bold rounded-xl disabled:opacity-50 transition-all hover:brightness-110 active:scale-95 shadow-md"
              style={{ backgroundColor: colorPrimario }}
            >
              Agregar
            </button>
          </div>

          <div className={`h-px w-full ${tema === 'dark' ? 'bg-[#222]' : 'bg-gray-200'}`}></div>

          {/* BUSCADOR DE CATEGORÍAS */}
          {categorias.length > 0 && (
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
              <i className={`fi fi-rr-search text-xs ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}></i>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar categoría..."
                className={`flex-1 bg-transparent outline-none text-sm font-bold ${tema === 'dark' ? 'text-white placeholder:text-neutral-600' : 'text-gray-900 placeholder:text-gray-400'}`}
              />
              {busqueda && (
                <button onClick={() => setBusqueda('')} className={tema === 'dark' ? 'text-neutral-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
                  <i className="fi fi-rr-cross-small"></i>
                </button>
              )}
            </div>
          )}

          {/* LISTA DE CATEGORÍAS ACTUALES */}
          <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2">
            {categorias.length === 0 ? (
              <p className={`text-center text-sm py-4 ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>No hay categorías creadas aún.</p>
            ) : categoriasFiltradas.length === 0 ? (
              <p className={`text-center text-sm py-4 ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>Sin resultados para "{busqueda}"</p>
            ) : (
              categoriasFiltradas.map(cat => (
                <div key={cat.id} className={`flex justify-between items-center p-3 rounded-xl border transition-colors ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={`font-bold ${tema === 'dark' ? 'text-white' : 'text-gray-800'}`}>{cat.nombre}</span>
                  <button 
                    onClick={() => eliminarCategoriaLocal(cat.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:text-red-500 hover:bg-red-500/10 ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}
                    title="Eliminar categoría"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}