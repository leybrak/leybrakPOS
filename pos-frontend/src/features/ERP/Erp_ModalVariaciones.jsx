import React, { useState, useEffect } from 'react';
import usePosStore from '../../store/usePosStore';
import { getCatalogoGlobal, actualizarVariacionesProducto } from '../../api/api';
import { useToast } from '../../context/ToastContext';

// ============================================================
// SUBCOMPONENTE: buscador de insumos para agregar a una opción
// (reemplaza el <select> combobox de antes)
// ============================================================
function SelectorInsumo({ catalogo, ingredientesActuales, onAgregar, isDark, colorPrimario }) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);

  const filtrados = busqueda.trim()
    ? catalogo.filter(i => i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 8)
    : [];

  const yaAgregado = (id) => ingredientesActuales.some(ing => ing.insumo === id);

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#111] border-[#333]' : 'bg-white border-gray-200'}`}>
        <i className="fi fi-rr-search text-xs text-neutral-500 shrink-0"></i>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder="Buscar insumo para agregar..."
          className={`flex-1 bg-transparent outline-none text-xs font-bold ${isDark ? 'text-white placeholder:text-neutral-600' : 'text-gray-900 placeholder:text-gray-400'}`}
        />
      </div>
      {abierto && busqueda.trim() && (
        <div className={`absolute z-20 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border shadow-xl ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
          {filtrados.length === 0 ? (
            <p className="text-xs text-neutral-500 px-3 py-2">Sin resultados</p>
          ) : (
            filtrados.map(insumo => {
              const agregado = yaAgregado(insumo.id);
              return (
                <button
                  key={insumo.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { if (!agregado) onAgregar(insumo); setBusqueda(''); setAbierto(false); }}
                  disabled={agregado}
                  className={`w-full text-left px-3 py-2 text-xs font-bold flex justify-between items-center transition-colors ${
                    agregado
                      ? 'opacity-40 cursor-default'
                      : isDark ? 'text-neutral-300 hover:bg-[#222]' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{insumo.nombre}</span>
                  <span className="text-neutral-500 flex items-center gap-1.5">
                    {insumo.unidad_medida}
                    {agregado && <i className="fi fi-rr-check" style={{ color: colorPrimario }}></i>}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function ModalVariaciones({ isOpen, onClose, producto, config }) {
  const { configuracionGlobal } = usePosStore();
  const isDark = (config?.temaFondo || config?.tema_fondo || configuracionGlobal?.temaFondo || 'dark') === 'dark';
  const colorPrimario = config?.colorPrimario || config?.color_primario || configuracionGlobal?.colorPrimario || '#ff5a1f';
  const toast = useToast();

  const [catalogo, setCatalogo] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (isOpen && producto) {
      getCatalogoGlobal().then(res => setCatalogo(res.data));
      // Clonamos las variaciones que ya trae el producto desde la base de datos
      setGrupos(producto.grupos_variacion ? JSON.parse(JSON.stringify(producto.grupos_variacion)) : []);
    }
  }, [isOpen, producto]);

  // ================= ACCIONES DE OPCIONES =================
  const handleAgregarOpcion = (gIndex) => {
    const nuevosGrupos = [...grupos];
    // Agregamos con precio 0 por defecto (el precio real se maneja en el catálogo)
    nuevosGrupos[gIndex].opciones.push({ nombre: '', precio_adicional: 0, ingredientes: [] });
    setGrupos(nuevosGrupos);
  };

  const handleEliminarOpcion = (gIndex, oIndex) => {
    const nuevosGrupos = [...grupos];
    nuevosGrupos[gIndex].opciones.splice(oIndex, 1);
    setGrupos(nuevosGrupos);
  };

  // ================= ACCIONES DE RECETAS =================
  const handleAgregarIngrediente = (gIndex, oIndex, insumo) => {
    const nuevosGrupos = [...grupos];
    nuevosGrupos[gIndex].opciones[oIndex].ingredientes.push({
      insumo: insumo.id,
      nombre_insumo: insumo.nombre,
      unidad_medida: insumo.unidad_medida,
      cantidad_necesaria: 1
    });
    setGrupos(nuevosGrupos);
  };

  const handleCambiarCantidadIngrediente = (gIndex, oIndex, iIndex, valor) => {
    const nuevosGrupos = [...grupos];
    nuevosGrupos[gIndex].opciones[oIndex].ingredientes[iIndex].cantidad_necesaria = valor;
    setGrupos(nuevosGrupos);
  };

  const handleEliminarIngrediente = (gIndex, oIndex, iIndex) => {
    const nuevosGrupos = [...grupos];
    nuevosGrupos[gIndex].opciones[oIndex].ingredientes.splice(iIndex, 1);
    setGrupos(nuevosGrupos);
  };

  // ================= GUARDAR TODO =================
  const handleGuardarTodo = async () => {
    setCargando(true);
    try {
      await actualizarVariacionesProducto(producto.id, grupos);
      toast.success('Recetas de variaciones guardadas correctamente.');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Hubo un error al guardar las variaciones.');
    } finally {
      setCargando(false);
    }
  };

  if (!isOpen || !producto) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-0 sm:p-4 animate-fadeIn">
      <div className={`w-full max-w-4xl h-full sm:h-[85vh] rounded-none sm:rounded-[2.5rem] shadow-2xl border overflow-hidden flex flex-col ${
        isDark ? 'bg-[#0d0d0d] border-[#222]' : 'bg-white border-gray-200'
      }`}>

        {/* CABECERA */}
        <div className={`p-5 md:p-8 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-[#222] bg-[#111]' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ backgroundColor: `${colorPrimario}15`, color: colorPrimario }}>
              <i className="fi fi-rr-list text-xl md:text-2xl mt-1"></i>
            </div>
            <div>
              <h2 className={`text-lg md:text-2xl font-black tracking-tighter line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Variaciones: {producto.nombre}
              </h2>
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-0.5 md:mt-1 text-neutral-500 line-clamp-1">
                Opciones y receta por variante
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
              isDark ? 'border-[#333] text-neutral-500 hover:text-white hover:bg-[#1a1a1a]' : 'border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <i className="fi fi-rr-cross-small"></i>
          </button>
        </div>

        {/* CUERPO SCROLLEABLE */}
        <div className="p-5 md:p-8 overflow-y-auto flex-1 space-y-6">

          {grupos.length === 0 && (
            <div className={`text-center py-16 border-2 border-dashed rounded-3xl ${isDark ? 'border-[#2a2a2a] text-neutral-500' : 'border-gray-200 text-gray-400'}`}>
              <i className={`fi fi-rr-shapes text-3xl mb-3 block ${isDark ? 'text-neutral-600' : 'text-gray-300'}`}></i>
              <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>No hay grupos de variación</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Añade los grupos desde el editor del plato</p>
            </div>
          )}

          {/* RENDERIZADO DE GRUPOS */}
          {grupos.map((grupo, gIndex) => (
            <div key={gIndex} className={`rounded-3xl p-5 md:p-6 border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>

              {/* CABECERA DEL GRUPO */}
              <div className={`mb-5 pb-4 border-b ${isDark ? 'border-[#222]' : 'border-gray-200'}`}>
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Grupo de Variación</p>
                <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: colorPrimario }}>
                  {grupo.nombre}
                </h3>
              </div>

              {/* RENDERIZADO DE OPCIONES DENTRO DEL GRUPO */}
              <div className={`space-y-4 pl-4 border-l-2 ${isDark ? 'border-[#222]' : 'border-gray-200'}`}>
                {grupo.opciones.map((opcion, oIndex) => (
                  <div key={oIndex} className={`rounded-2xl p-4 border ${isDark ? 'bg-[#0a0a0a] border-[#333]' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <span className={`font-bold text-sm uppercase tracking-wide flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorPrimario }}></span>
                        {opcion.nombre}
                      </span>
                      <button
                        onClick={() => handleEliminarOpcion(gIndex, oIndex)}
                        className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                      >
                        <i className="fi fi-rr-trash text-xs"></i>
                      </button>
                    </div>

                    {/* SECCIÓN DE RECETA */}
                    <div className={`pt-4 border-t ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
                      <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <i className="fi fi-rr-book-alt"></i> Insumos que consume esta variante
                      </p>

                      {opcion.ingredientes?.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {opcion.ingredientes.map((ing, iIndex) => (
                            <div key={iIndex} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
                              <span className={`flex-1 text-xs font-bold truncate ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>{ing.nombre_insumo}</span>
                              <input
                                type="number" min="0" step="0.01"
                                value={ing.cantidad_necesaria}
                                onChange={(e) => handleCambiarCantidadIngrediente(gIndex, oIndex, iIndex, e.target.value)}
                                className={`w-16 px-2 py-1 rounded text-center font-mono text-xs font-bold outline-none border ${
                                  isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'
                                }`}
                              />
                              <span className="text-[9px] font-bold uppercase text-neutral-500 w-8 shrink-0">{ing.unidad_medida}</span>
                              <button onClick={() => handleEliminarIngrediente(gIndex, oIndex, iIndex)} className="text-red-500 hover:text-red-400 shrink-0">
                                <i className="fi fi-rr-cross-small"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Buscador para añadir insumos (reemplaza el combobox) */}
                      <SelectorInsumo
                        catalogo={catalogo}
                        ingredientesActuales={opcion.ingredientes || []}
                        onAgregar={(insumo) => handleAgregarIngrediente(gIndex, oIndex, insumo)}
                        isDark={isDark}
                        colorPrimario={colorPrimario}
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => handleAgregarOpcion(gIndex)}
                  className="text-[10px] font-bold text-neutral-500 hover:text-white flex items-center gap-2 mt-2 transition-colors uppercase tracking-widest"
                >
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full ${isDark ? 'bg-[#222]' : 'bg-gray-200'}`}>
                    <i className="fi fi-rr-add text-[9px]"></i>
                  </span>
                  Añadir Opción
                </button>
              </div>
            </div>
          ))}

        </div>

        {/* FOOTER */}
        <div className={`p-5 md:p-8 border-t flex flex-col-reverse sm:flex-row gap-3 shrink-0 ${isDark ? 'border-[#222] bg-[#111]' : 'border-gray-100 bg-gray-50'}`}>
          <button
            onClick={onClose}
            className={`w-full sm:w-1/3 font-bold py-4 rounded-2xl text-base transition-all border flex items-center justify-center gap-2 ${
              isDark ? 'bg-[#1a1a1a] border-[#333] text-neutral-400 hover:bg-[#222] hover:text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <i className="fi fi-rr-cross-small"></i> Cancelar
          </button>
          <button
            onClick={handleGuardarTodo}
            disabled={cargando}
            style={{ backgroundColor: colorPrimario }}
            className="w-full sm:w-2/3 text-white font-black py-4 rounded-2xl text-base transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95"
          >
            <i className="fi fi-rr-disk"></i>
            {cargando ? 'Guardando...' : 'Guardar Recetas'}
          </button>
        </div>

      </div>
    </div>
  );
}
