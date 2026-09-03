import React, { useState, useEffect } from 'react';
import { getCatalogoGlobal, guardarReceta, getReceta } from '../../api/api';
import { useToast } from '../../context/ToastContext';

export default function ModalConfigurarReceta({ isOpen, onClose, producto, config }) {
  const isDark = (config?.temaFondo || config?.tema_fondo || 'dark') === 'dark';
  const colorPrimario = config?.colorPrimario || config?.color_primario || '#ff5a1f';
  const toast = useToast();

  const [catalogo, setCatalogo] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (isOpen && producto) {
      setCargando(true);
      setBusqueda('');
      Promise.all([
        getCatalogoGlobal(),
        getReceta(producto.id)
      ]).then(([resCatalogo, resReceta]) => {
        setCatalogo(resCatalogo.data);
        setIngredientes(resReceta.data);
      }).catch(err => {
        console.error('Error cargando datos:', err);
      }).finally(() => setCargando(false));
    }
  }, [isOpen, producto]);

  if (!isOpen || !producto) return null;

  const catalogoFiltrado = catalogo.filter(i => i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  const agregarInsumo = (insumo) => {
    if (ingredientes.some(ing => ing.insumo_id === insumo.id)) return;
    setIngredientes([...ingredientes, {
      insumo_id: insumo.id,
      nombre: insumo.nombre,
      unidad: insumo.unidad_medida,
      cantidad_necesaria: 1
    }]);
  };

  const cambiarCantidad = (idx, valor) => {
    const nuevos = [...ingredientes];
    nuevos[idx].cantidad_necesaria = valor;
    setIngredientes(nuevos);
  };

  const quitarIngrediente = (idx) => {
    setIngredientes(ingredientes.filter((_, i) => i !== idx));
  };

  const handleGuardarReceta = async () => {
    setGuardando(true);
    try {
      await guardarReceta(producto.id, { ingredientes });
      toast.success('Receta guardada correctamente.');
      onClose();
    } catch (err) {
      console.error('Error del servidor al guardar receta:', err);
      toast.error('Error al guardar la receta.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-0 sm:p-4 animate-fadeIn">
      <div className={`w-full max-w-4xl h-full sm:h-[85vh] rounded-none sm:rounded-[2.5rem] shadow-2xl border overflow-hidden flex flex-col ${
        isDark ? 'bg-[#0d0d0d] border-[#222]' : 'bg-white border-gray-200'
      }`}>

        {/* CABECERA */}
        <div className={`p-5 md:p-8 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-[#222] bg-[#111]' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ backgroundColor: `${colorPrimario}15`, color: colorPrimario }}>
              <i className="fi fi-rr-book-alt text-xl md:text-2xl mt-1"></i>
            </div>
            <div>
              <h2 className={`text-lg md:text-2xl font-black tracking-tighter line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Receta: {producto.nombre}
              </h2>
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-0.5 md:mt-1 text-neutral-500 line-clamp-1">
                Insumos que consume este plato
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

        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

          {/* CATÁLOGO IZQUIERDA */}
          <div className={`w-full md:w-1/2 p-5 md:p-6 border-b md:border-b-0 md:border-r md:overflow-y-auto shrink-0 md:shrink ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4 px-1 md:px-2">
              Catálogo de Insumos ({catalogo.length})
            </h4>

            {catalogo.length > 0 && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <i className="fi fi-rr-search text-xs text-neutral-500 shrink-0"></i>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar insumo..."
                  className={`flex-1 bg-transparent outline-none text-sm font-bold ${isDark ? 'text-white placeholder:text-neutral-600' : 'text-gray-900 placeholder:text-gray-400'}`}
                />
                {busqueda && (
                  <button onClick={() => setBusqueda('')} className={isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
                    <i className="fi fi-rr-cross-small"></i>
                  </button>
                )}
              </div>
            )}

            {cargando ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: colorPrimario }} />
              </div>
            ) : catalogo.length === 0 ? (
              <div className={`p-6 md:p-8 text-center rounded-2xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <i className={`fi fi-rr-box text-3xl mb-3 block ${isDark ? 'text-neutral-600' : 'text-gray-300'}`}></i>
                <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Aún no hay insumos en tu catálogo</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Créalos primero en el módulo de Inventario</p>
              </div>
            ) : catalogoFiltrado.length === 0 ? (
              <div className={`p-6 md:p-8 text-center rounded-2xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Sin resultados para "{busqueda}"</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {catalogoFiltrado.map(insumo => {
                  const yaAgregado = ingredientes.some(ing => ing.insumo_id === insumo.id);
                  return (
                    <button
                      key={insumo.id}
                      onClick={() => agregarInsumo(insumo)}
                      disabled={yaAgregado}
                      className={`w-full p-3 rounded-xl border text-left flex justify-between items-center transition-all ${
                        yaAgregado
                          ? isDark ? 'bg-[#111] border-[#1a1a1a] opacity-40 cursor-default' : 'bg-gray-50 border-gray-100 opacity-40 cursor-default'
                          : isDark ? 'bg-[#141414] border-[#222] hover:border-[#444]' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div>
                        <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{insumo.nombre}</p>
                        <p className="text-[10px] font-medium text-neutral-500 uppercase mt-0.5">{insumo.unidad_medida}</p>
                      </div>
                      <i className={`fi ${yaAgregado ? 'fi-rr-check' : 'fi-rr-add'} text-sm`} style={{ color: colorPrimario }}></i>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* RECETA (CARRITO) DERECHA */}
          <div className="w-full md:w-1/2 p-5 md:p-6 md:overflow-y-auto shrink-0 md:shrink flex flex-col">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4 px-1 md:px-2">
              Composición del Plato ({ingredientes.length})
            </h4>

            <div className="flex-1">
              {ingredientes.length === 0 ? (
                <div className={`p-6 md:p-8 text-center rounded-2xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                  <i className={`fi fi-rr-shopping-basket text-3xl mb-3 block ${isDark ? 'text-neutral-600' : 'text-gray-300'}`}></i>
                  <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Aún no hay ingredientes</p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Elige insumos del catálogo de la izquierda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ingredientes.map((ing, idx) => (
                    <div key={ing.insumo_id} className={`flex items-center gap-2 p-3 rounded-xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                      <span className={`flex-1 font-bold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{ing.nombre}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ing.cantidad_necesaria}
                        onChange={(e) => cambiarCantidad(idx, e.target.value)}
                        className={`w-20 px-2 py-2 rounded-lg outline-none text-center font-mono font-bold text-sm border ${
                          isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      />
                      <span className="text-[10px] font-bold uppercase text-neutral-500 w-10 shrink-0">{ing.unidad}</span>
                      <button
                        onClick={() => quitarIngrediente(idx)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors shrink-0"
                      >
                        <i className="fi fi-rr-trash text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleGuardarReceta}
              disabled={guardando}
              style={{ backgroundColor: colorPrimario }}
              className="w-full mt-6 py-4 rounded-xl md:rounded-2xl text-white text-sm md:text-base font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
            >
              <i className="fi fi-rr-disk"></i>
              {guardando ? 'Guardando...' : 'Guardar Receta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
