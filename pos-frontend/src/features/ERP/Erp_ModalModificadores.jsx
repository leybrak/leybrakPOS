import React, { useState, useEffect } from 'react';

export default function ModalModificadores({ 
  isOpen, 
  onClose, 
  categorias = [], 
  modificadores = [], 
  onGuardar, 
  tema, 
  colorPrimario,
  onRecargar 
}) {
  const isDark = tema === 'dark';
  const [editando, setEditando] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    precio: '',
    categorias_aplicables: []
  });

  useEffect(() => {
    if (!isOpen) {
      setEditando(null);
      setBusqueda('');
      setFormData({ nombre: '', precio: '', categorias_aplicables: [] });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modificadoresFiltrados = modificadores.filter(m => m.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  const manejarSeleccionCategoria = (catId) => {
    setFormData(prev => ({
      ...prev,
      categorias_aplicables: prev.categorias_aplicables.includes(catId)
        ? prev.categorias_aplicables.filter(id => id !== catId)
        : [...prev.categorias_aplicables, catId]
    }));
  };

  const manejarEditar = (mod) => {
    setEditando(mod);
    setFormData({
      id: mod.id,
      nombre: mod.nombre,
      precio: mod.precio || '', 
      categorias_aplicables: Array.isArray(mod.categorias_aplicables) 
        ? mod.categorias_aplicables 
        : []
    });
    
    // Opcional: Hacer scroll suave hacia el formulario en versión móvil
    if (window.innerWidth < 768) {
      document.getElementById('form-modificadores')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const manejarNuevo = () => {
    setEditando(null);
    setFormData({ nombre: '', precio: '', categorias_aplicables: [] });
    
    if (window.innerWidth < 768) {
      document.getElementById('form-modificadores')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const validarYGuardar = async () => {
    if (!formData.nombre.trim()) {
      alert('El nombre del modificador es obligatorio');
      return;
    }

    if (formData.categorias_aplicables.length === 0) {
      alert('Debes seleccionar al menos una categoría');
      return;
    }

    const precioParaEnviar = formData.precio.trim() === '' ? '0.00' : formData.precio;
    const precioNum = parseFloat(precioParaEnviar);

    if (isNaN(precioNum) || precioNum < 0) {
      alert('El precio debe ser un número válido mayor o igual a 0');
      return;
    }

    await onGuardar({
      ...formData,
      precio: precioNum.toFixed(2)
    });

    setEditando(null);
    setFormData({ nombre: '', precio: '', categorias_aplicables: [] });

    if (onRecargar) {
      onRecargar();
    }
    
    // Regresar arriba en móvil tras guardar
    if (window.innerWidth < 768) {
      document.getElementById('contenedor-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    // ✅ MODIFICACIÓN: p-0 en móvil para que ocupe todo, p-4 en pantallas más grandes
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-0 sm:p-4 animate-fadeIn">
      {/* ✅ MODIFICACIÓN: h-full y rounded-none en móvil. 85vh y rounded-[2.5rem] en md */}
      <div className={`w-full max-w-4xl h-full sm:h-[85vh] rounded-none sm:rounded-[2.5rem] shadow-2xl border overflow-hidden flex flex-col ${
        isDark ? 'bg-[#0d0d0d] border-[#222]' : 'bg-white border-gray-200'
      }`}>
        
        {/* CABECERA */}
        <div className={`p-5 md:p-8 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-[#222] bg-[#111]' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ backgroundColor: `${colorPrimario}15`, color: colorPrimario }}>
              <i className="fi fi-rr-settings-sliders text-xl md:text-2xl mt-1"></i>
            </div>
            <div>
              <h2 className={`text-lg md:text-2xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Modificadores Rápidos
              </h2>
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-0.5 md:mt-1 text-neutral-500 line-clamp-1">
                Extras por categoría
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

        {/* ✅ MODIFICACIÓN: En móvil el scroll es general (overflow-y-auto en el padre), en md el scroll se divide */}
        <div id="contenedor-scroll" className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
          
          {/* LISTADO IZQUIERDA */}
          {/* ✅ MODIFICACIÓN: border-b en móvil, border-r en md. Sin height fijo. */}
          <div className={`w-full md:w-1/2 p-5 md:p-6 border-b md:border-b-0 md:border-r md:overflow-y-auto shrink-0 md:shrink ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
            <div className="flex justify-between items-center mb-4 px-1 md:px-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                Existentes ({modificadores.length})
              </h4>
              <button
                onClick={manejarNuevo}
                disabled={!editando}
                style={editando ? { backgroundColor: colorPrimario } : {}}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  editando
                    ? 'text-white shadow-md hover:scale-105'
                    : `cursor-not-allowed ${isDark ? 'bg-[#1a1a1a] text-neutral-600' : 'bg-gray-100 text-gray-400'}`
                }`}
              >
                <i className="fi fi-rr-add"></i> Nuevo
              </button>
            </div>

            {modificadores.length > 0 && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <i className={`fi fi-rr-search text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}></i>
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar modificador..."
                  className={`flex-1 bg-transparent outline-none text-sm font-bold ${isDark ? 'text-white placeholder:text-neutral-600' : 'text-gray-900 placeholder:text-gray-400'}`}
                />
                {busqueda && (
                  <button onClick={() => setBusqueda('')} className={isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
                    <i className="fi fi-rr-cross-small"></i>
                  </button>
                )}
              </div>
            )}

            {modificadores.length === 0 ? (
              <div className={`p-6 md:p-8 text-center rounded-2xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <i className={`fi fi-rr-settings-sliders text-3xl mb-3 block ${isDark ? 'text-neutral-600' : 'text-gray-300'}`}></i>
                <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  Aún no hay modificadores
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                  Crea el primero completando el formulario de la derecha
                </p>
              </div>
            ) : modificadoresFiltrados.length === 0 ? (
              <div className={`p-6 md:p-8 text-center rounded-2xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                  Sin resultados para "{busqueda}"
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {modificadoresFiltrados.map(mod => (
                  <button 
                    key={mod.id}
                    onClick={() => manejarEditar(mod)}
                    className={`w-full p-4 rounded-2xl border text-left flex justify-between items-center transition-all ${
                      editando?.id === mod.id 
                        ? `shadow-lg` 
                        : isDark ? 'bg-[#141414] border-[#222] hover:border-[#444]' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                    }`}
                    style={editando?.id === mod.id ? { 
                      borderColor: colorPrimario, 
                      backgroundColor: `${colorPrimario}05` 
                    } : {}}
                  >
                    <div className="pr-3">
                      <p className={`font-bold text-sm md:text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {mod.nombre}
                      </p>
                      <p className="text-[9px] md:text-[10px] font-medium text-neutral-500 uppercase mt-0.5">
                        {Array.isArray(mod.categorias_aplicables) ? mod.categorias_aplicables.length : 0} Categorías
                      </p>
                    </div>
                    <span className="font-mono font-black shrink-0 text-sm md:text-base" style={{ color: colorPrimario }}>
                      +S/ {parseFloat(mod.precio || 0).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FORMULARIO DERECHA */}
          {/* ✅ MODIFICACIÓN: flex-1 para que se adapte. ID agregado para el scroll en móvil */}
          <div id="form-modificadores" className={`w-full md:flex-1 p-5 md:p-6 md:overflow-y-auto shrink-0 md:shrink ${isDark ? 'bg-black/10' : 'bg-gray-50/50'}`}>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-5 md:mb-6 px-1 md:px-2">
              {editando ? `Editando: ${editando.nombre}` : 'Nuevo Modificador'}
            </h4>
            
            <div className="space-y-5 md:space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2 block px-1 md:px-2">
                  Nombre del Extra *
                </label>
                <input 
                  type="text"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className={`w-full rounded-2xl py-3.5 md:py-4 px-4 md:px-5 font-bold outline-none border-2 transition-all ${
                    isDark 
                      ? 'bg-[#161616] border-[#222] text-white focus:border-[#444]' 
                      : 'bg-white border-gray-100 text-gray-900 focus:border-gray-300'
                  }`}
                  placeholder="Ej. Sin Cebolla, Extra Queso..."
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-2 block px-1 md:px-2">
                  Precio Adicional (S/)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.precio}
                  onChange={e => setFormData({...formData, precio: e.target.value})}
                  placeholder="0.00" 
                  className="w-full rounded-2xl py-3.5 md:py-4 px-4 md:px-5 font-black font-mono text-xl md:text-2xl outline-none border-2 bg-emerald-500/5 border-emerald-500/20 text-emerald-500 focus:border-emerald-500/40 transition-all placeholder:text-emerald-500/30"
                />
                <p className="text-[9px] text-neutral-500 mt-2 px-1 md:px-2 leading-relaxed flex items-start gap-1">
                  <i className="fi fi-rr-info mt-0.5"></i> Si dejas vacío, se guardará como S/ 0.00 (sin costo adicional)
                </p>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 block px-1 md:px-2">
                  ¿A qué categorías aplica? *
                </label>
                {categorias.length === 0 ? (
                  <div className={`p-4 rounded-xl border flex items-start gap-2 ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
                    <i className="fi fi-rr-exclamation text-amber-500 mt-0.5"></i>
                    <p className="text-xs text-neutral-500">
                      No hay categorías disponibles. Crea categorías primero en el menú.
                    </p>
                  </div>
                ) : (
                  // ✅ MODIFICACIÓN: grid-cols-1 en pantallas muy pequeñas, sm:grid-cols-2
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categorias.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => manejarSeleccionCategoria(cat.id)}
                        className={`p-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                          formData.categorias_aplicables.includes(cat.id)
                            ? 'bg-blue-500 border-blue-500 text-white shadow-lg sm:scale-105'
                            : isDark 
                              ? 'bg-[#1a1a1a] border-[#333] text-neutral-500 hover:border-[#444]' 
                              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {cat.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 pb-6 md:pb-0">
                <button
                  onClick={validarYGuardar}
                  style={{ backgroundColor: colorPrimario }}
                  className="w-full py-4 md:py-5 rounded-xl md:rounded-2xl text-white text-sm md:text-base font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className={`fi ${editando ? 'fi-rr-disk' : 'fi-rr-add'}`}></i>
                  {editando ? 'Guardar Cambios' : 'Crear Modificador'}
                </button>

                {editando && (
                  <button
                    onClick={manejarNuevo}
                    className={`w-full py-3.5 md:py-4 mt-3 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${
                      isDark
                        ? 'bg-[#1a1a1a] border-[#333] text-neutral-400 hover:bg-[#222]'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <i className="fi fi-rr-cross-small"></i> Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}