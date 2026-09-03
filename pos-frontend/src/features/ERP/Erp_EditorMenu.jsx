import React, { useState } from 'react';
import usePosStore from '../../store/usePosStore';
import DrawerCombosNormales from './MenuComponents/DrawerCombosNormales';

export default function EditorMenu({ 
  categorias, 
  productosReales, 
  onOpenCategorias, 
  onOpenPlatoNuevo, 
  onEditPlato, 
  onToggleDisponibilidad,
  onEliminarPlato,
  onOpenReceta,
  onOpenVariaciones,
  onOpenModificadores,
  onOpenCombos
}) {
  const { configuracionGlobal } = usePosStore();
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';
  const temaFondo = configuracionGlobal?.temaFondo || 'dark';
  const isDark = temaFondo === 'dark';

  const rolUsuario = localStorage.getItem('usuario_rol')?.toLowerCase() || '';
  const esDueño = ['dueño', 'admin', 'administrador'].includes(rolUsuario.trim());

  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('Todos');
  const [drawerCombosAbierto, setDrawerCombosAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Solo platos normales (sin combos) en el grid principal
  const platosNormales = productosReales.filter(p => !p.es_combo);

  const platosFiltrados = platosNormales
    .filter(plato => {
      if (categoriaSeleccionada === 'Todos') return true;
      const nombreCat = categorias.find(c => c.id === plato.categoria)?.nombre || plato.categoria;
      return nombreCat === categoriaSeleccionada;
    })
    .filter(plato => plato.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  // Determina si un plato debe abrir variaciones o receta
  const handleBotonRecetaOVariacion = (e, plato) => {
    e.stopPropagation();
    if (plato.requiere_seleccion || plato.tiene_variaciones) {
      onOpenVariaciones(plato);
    } else {
      onOpenReceta(plato);
    }
  };

  return (
    <div className="animate-fadeIn space-y-8 max-w-7xl mx-auto min-w-0 px-3 sm:px-4 pb-24 h-full flex flex-col">
      
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 pt-2 pb-6 border-b" style={{ borderColor: isDark ? '#222' : '#e5e7eb' }}>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}>
            <i className="fi fi-rr-restaurant mt-1"></i>
          </div>
          <div>
            <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Ingeniería de <span style={{ color: colorPrimario }}>Menú</span>
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              {esDueño ? 'Estructura tu catálogo, recetas maestras y variaciones.' : 'Gestión rápida de disponibilidad de platos.'}
            </p>
          </div>
        </div>

        {esDueño && (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-end gap-3 shrink-0">
            <button onClick={onOpenModificadores}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 whitespace-nowrap ${
                isDark ? 'bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border-[#333]' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}>
              <i className="fi fi-rr-settings-sliders text-sm"></i> Modificadores
            </button>

            <button onClick={onOpenCategorias}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 whitespace-nowrap ${
                isDark ? 'bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border-[#333]' : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}>
              <i className="fi fi-rr-folder text-sm"></i> Categorías
            </button>

            {/* ✨ NUEVO: Botón combos */}
            <button onClick={() => onOpenCombos(true)}
              className={`w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border flex items-center justify-center gap-2 whitespace-nowrap ${
                isDark ? 'bg-[#1a1a1a] hover:bg-[#222] text-purple-400 border-purple-500/20' : 'bg-purple-50 hover:bg-purple-100 text-purple-600 border-purple-200'
              }`}>
              <i className="fi fi-rr-layers text-sm"></i> Combos
            </button>

            <button onClick={onOpenPlatoNuevo}
              style={{ backgroundColor: colorPrimario }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
              <i className="fi fi-rr-add text-sm"></i> Nuevo Plato
            </button>
          </div>
        )}
      </div>

      {/* CUERPO */}
      <div className="flex flex-col lg:flex-row gap-8 items-start flex-1 min-h-0">
        
        {/* Sidebar categorías */}
        <div className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 h-auto">
          <h4 className={`text-[10px] font-black uppercase tracking-widest mb-4 px-2 hidden lg:block ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            Filtro de Catálogo
          </h4>
          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible custom-scrollbar pb-2 lg:pb-0">
            <button onClick={() => setCategoriaSeleccionada('Todos')}
              className={`whitespace-nowrap lg:whitespace-normal text-left px-5 py-3 rounded-xl font-black transition-all text-sm flex items-center gap-3 border border-transparent ${
                categoriaSeleccionada === 'Todos'
                  ? 'text-white shadow-md'
                  : isDark ? 'text-neutral-400 hover:bg-[#1a1a1a] hover:border-[#333]' : 'text-gray-600 hover:bg-gray-100 hover:border-gray-200'
              }`}
              style={categoriaSeleccionada === 'Todos' ? { backgroundColor: colorPrimario } : {}}>
              <i className="fi fi-rr-apps text-base opacity-70"></i> Todo el Catálogo
            </button>

            {categorias.map(cat => (
              <button key={cat.id} onClick={() => setCategoriaSeleccionada(cat.nombre)}
                className={`whitespace-nowrap lg:whitespace-normal text-left px-5 py-3 rounded-xl font-bold transition-all text-sm flex items-center gap-3 border border-transparent ${
                  categoriaSeleccionada === cat.nombre
                    ? 'text-white shadow-md'
                    : isDark ? 'text-neutral-400 hover:bg-[#1a1a1a] hover:border-[#333]' : 'text-gray-600 hover:bg-gray-100 hover:border-gray-200'
                }`}
                style={categoriaSeleccionada === cat.nombre ? { backgroundColor: colorPrimario } : {}}>
                <i className="fi fi-rr-angle-small-right text-base opacity-50"></i> {cat.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de platos (solo platos normales, sin combos) */}
        <div className="flex-1 w-full min-w-0">

          {/* Buscador de productos */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-5 ${
            isDark ? 'bg-[#141414] border-[#222]' : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <i className={`fi fi-rr-search text-sm ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}></i>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto por nombre..."
              className={`flex-1 bg-transparent outline-none text-sm font-bold ${
                isDark ? 'text-white placeholder:text-neutral-600' : 'text-gray-900 placeholder:text-gray-400'
              }`}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')}
                className={`text-xs font-black ${isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                ✕
              </button>
            )}
          </div>

          {platosFiltrados.length === 0 ? (
            <div className={`text-center py-16 border-2 border-dashed rounded-3xl ${isDark ? 'border-[#2a2a2a] text-neutral-500' : 'border-gray-200 text-gray-400'}`}>
              <i className="fi fi-rr-search text-3xl opacity-30 mb-3 block"></i>
              <p className="text-sm font-bold">
                {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay productos en esta categoría.'}
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {platosFiltrados
              .map((plato) => {
                const nombreCategoriaMuestra = categorias.find(c => c.id === plato.categoria)?.nombre || plato.categoria || 'Sin categoría';
                const esVariable = parseFloat(plato.precio_base) <= 0;

                // ✨ FIX: requiere_seleccion O tiene_variaciones → botón variaciones
                const necesitaVariaciones = plato.requiere_seleccion || plato.tiene_variaciones;

                return (
                  <div key={plato.id}
                    onClick={() => { if (esDueño) onEditPlato(plato); }}
                    className={`rounded-3xl p-6 flex flex-col relative transition-all duration-200 border ${esDueño ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'} ${
                      isDark
                        ? `bg-[#141414] border-[#222] ${esDueño ? 'hover:border-neutral-500 hover:shadow-lg' : ''}`
                        : `bg-white border-gray-200 shadow-sm ${esDueño ? 'hover:border-gray-300 hover:shadow-lg' : ''}`
                    }`}>

                    {/* Imagen */}
                    <div className={`w-full h-36 rounded-2xl flex items-center justify-center text-5xl mb-5 overflow-hidden ${
                      isDark ? 'bg-[#0a0a0a] border border-[#222]' : 'bg-gray-50 border border-gray-100 shadow-inner'
                    }`}>
                      {plato.imagen
                        ? <img src={plato.imagen} alt={plato.nombre} className="w-full h-full object-cover" />
                        : '🍲'
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <p className={`text-[9px] font-black uppercase tracking-widest mb-1 truncate ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                        {nombreCategoriaMuestra}
                      </p>
                      <h5 className={`font-black text-lg leading-snug mb-5 ${isDark ? 'text-white' : 'text-gray-900'}`}
                        style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {plato.nombre}
                      </h5>
                    </div>

                    {/* Pie */}
                    <div className={`mt-auto flex items-end justify-between pt-5 border-t ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
                      <div>
                        <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                          Precio Base
                        </p>
                        {!esVariable ? (
                          <p className={`font-black text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            <span className="text-xs mr-0.5 opacity-80" style={{ color: colorPrimario }}>S/</span>
                            {parseFloat(plato.precio_base).toFixed(2)}
                          </p>
                        ) : (
                          <div className="px-2 py-1 rounded border inline-block" style={{ backgroundColor: colorPrimario + '10', borderColor: colorPrimario + '30' }}>
                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: colorPrimario }}>Variable</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2.5 shrink-0 z-10">
                        {/* Toggle disponibilidad */}
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleDisponibilidad(plato); }}
                          className={`w-14 h-8 rounded-full border p-1 flex items-center transition-all ${
                            plato.disponible
                              ? 'bg-green-500/10 border-green-500/30 justify-end shadow-inner'
                              : `justify-start shadow-inner ${isDark ? 'bg-[#222] border-[#333]' : 'bg-gray-100 border-gray-200'}`
                          }`}
                          title={`Marcar como ${plato.disponible ? 'Agotado' : 'Disponible'}`}>
                          <div className={`w-6 h-6 rounded-full transition-all shadow-md ${plato.disponible ? 'bg-green-500' : isDark ? 'bg-neutral-600' : 'bg-gray-300'}`} />
                        </button>

                        {/* ✨ FIX: botón receta O variaciones según tipo */}
                        {esDueño && (
                          <button
                            onClick={(e) => handleBotonRecetaOVariacion(e, plato)}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors border text-sm ${
                              necesitaVariaciones
                                ? isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20' : 'bg-blue-50 border-blue-200 text-blue-500 hover:bg-blue-100'
                                : isDark ? 'bg-[#1a1a1a] border-[#333] text-neutral-400 hover:text-white hover:bg-[#333]' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                            }`}
                            title={necesitaVariaciones ? 'Configurar Variaciones / Opciones' : 'Receta del Plato'}>
                            <i className={`fi ${necesitaVariaciones ? 'fi-rr-list' : 'fi-rr-book-alt'} mt-0.5`}></i>
                          </button>
                        )}

                        {/* Eliminar (soft delete: deja de mostrarse, no se borra de BD) */}
                        {esDueño && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEliminarPlato(plato); }}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors border text-sm ${
                              isDark ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100'
                            }`}
                            title="Eliminar plato del catálogo">
                            <i className="fi fi-rr-trash mt-0.5"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          )}
        </div>
      </div>

      {/* ✨ Drawer de combos normales */}
      <DrawerCombosNormales
        isOpen={drawerCombosAbierto}
        onClose={() => setDrawerCombosAbierto(false)}
        isDark={isDark}
        colorPrimario={colorPrimario}
        productosReales={productosReales}
        categoriasReales={categorias}
      />
    </div>
  );
}