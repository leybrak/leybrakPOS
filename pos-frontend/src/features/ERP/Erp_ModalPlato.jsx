import React, { useState, useRef } from 'react';
import usePosStore from '../../store/usePosStore';

export default function ModalFormularioPlato({
  isOpen,
  onClose,
  formPlato,
  setFormPlato,
  pasoModal,
  setPasoModal,
  categorias,
  manejarGuardarPlato,
  subiendoImagenPlato,
  guardandoPlato
}) {
  const { configuracionGlobal } = usePosStore();
  const tema = configuracionGlobal?.temaFondo || 'dark';
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';

  const [dropdownCatModalAbierto, setDropdownCatModalAbierto] = useState(false);
  const inputImagenRef = useRef(null);

  if (!isOpen) return null;

  const hayImagen = !!(formPlato.imagenFile || formPlato.imagenPreview);

  const onSeleccionarImagen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFormPlato({ ...formPlato, imagenFile: file, imagenPreview: URL.createObjectURL(file) });
  };

  const onQuitarImagen = () => {
    setFormPlato({ ...formPlato, imagenFile: null, imagenPreview: null, mejorarConIA: false });
    if (inputImagenRef.current) inputImagenRef.current.value = '';
  };

  // Estado combinado para bloquear el botón de guardar y evitar múltiples clicks
  const procesando = guardandoPlato || subiendoImagenPlato;
  const colorBotonGuardar = tema === 'dark' ? '#3a3a3a' : '#d1d5db';
  const textoBotonGuardar = subiendoImagenPlato
    ? 'PROCESANDO IMAGEN...'
    : guardandoPlato
      ? (formPlato.id ? 'GUARDANDO...' : 'CREANDO...')
      : (formPlato.id ? 'GUARDAR CAMBIOS' : 'CREAR PLATO');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-0 sm:p-4 animate-fadeIn">
      <div className={`w-full max-w-4xl h-full sm:h-[85vh] rounded-none sm:rounded-[2.5rem] shadow-2xl border overflow-hidden flex flex-col ${
        tema === 'dark' ? 'bg-[#0d0d0d] border-[#222]' : 'bg-white border-gray-200'
      }`}>

        {/* Cabecera */}
        <div className={`p-5 md:p-8 border-b flex justify-between items-center shrink-0 ${tema === 'dark' ? 'border-[#222] bg-[#111]' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3 md:gap-4">
            {pasoModal === 2 && (
              <button onClick={() => setPasoModal(1)} className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${tema === 'dark' ? 'text-neutral-500 hover:text-white bg-[#1a1a1a]' : 'text-gray-500 hover:text-gray-900 bg-gray-200'}`}>
                <i className="fi fi-rr-angle-left"></i>
              </button>
            )}
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ backgroundColor: `${colorPrimario}15`, color: colorPrimario }}>
              <i className="fi fi-rr-restaurant text-xl md:text-2xl mt-1"></i>
            </div>
            <div>
              <h3 className={`text-lg md:text-2xl font-black tracking-tighter ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {formPlato.id ? 'Editar Plato' : 'Nuevo Plato'}
              </h3>
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-0.5 md:mt-1 text-neutral-500 line-clamp-1">
                {pasoModal === 2 ? 'Presentaciones y opciones' : 'Datos básicos del plato'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
              tema === 'dark' ? 'border-[#333] text-neutral-500 hover:text-white hover:bg-[#1a1a1a]' : 'border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <i className="fi fi-rr-cross-small"></i>
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto">

          {/* ======================= PANTALLA 1: DATOS BÁSICOS ======================= */}
          {pasoModal === 1 && (
            <div className="space-y-6 animate-fadeIn">
              {/* Nombre, Precio y Categoría */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="col-span-1 md:col-span-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>Nombre del Plato</label>
                  <input 
                    type="text" 
                    value={formPlato.nombre}
                    onChange={(e) => setFormPlato({...formPlato, nombre: e.target.value})}
                    className={`w-full border rounded-xl px-4 py-3 outline-none transition-colors ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333] text-white focus:border-[#ff5a1f]' : 'bg-white border-gray-300 text-gray-900 focus:border-[#ff5a1f]'}`}
                    style={{ '--tw-ring-color': colorPrimario }}
                    onFocus={(e) => e.target.style.borderColor = colorPrimario}
                    onBlur={(e) => e.target.style.borderColor = tema === 'dark' ? '#333' : '#d1d5db'}
                    placeholder="Ej. Pizza Hawaiana" 
                  />
                </div>
                <div>
                  <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>Precio Base (S/)</label>
                  <input 
                    type="number" 
                    step="0.10"
                    value={formPlato.precio_base}
                    onChange={(e) => setFormPlato({...formPlato, precio_base: e.target.value})}
                    disabled={formPlato.requiere_seleccion} 
                    className={`w-full border rounded-xl px-4 py-3 outline-none disabled:opacity-30 disabled:cursor-not-allowed transition-all ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333] text-white focus:border-[#ff5a1f]' : 'bg-white border-gray-300 text-gray-900 focus:border-[#ff5a1f]'}`}
                    style={{ '--tw-ring-color': colorPrimario }}
                    onFocus={(e) => e.target.style.borderColor = colorPrimario}
                    onBlur={(e) => e.target.style.borderColor = tema === 'dark' ? '#333' : '#d1d5db'}
                    placeholder="0.00" 
                  />
                </div>
                {/* SELECT PERSONALIZADO DE CATEGORÍAS */}
                <div className="col-span-1 md:col-span-3 relative">
                  <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>Categoría</label>
                  
                  <button
                    type="button"
                    onClick={() => setDropdownCatModalAbierto(!dropdownCatModalAbierto)}
                    className={`w-full flex items-center justify-between border rounded-xl px-4 py-3 outline-none transition-all text-left ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333] hover:border-[#444] text-white focus:border-[#ff5a1f]' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 focus:border-[#ff5a1f]'}`}
                    onFocus={(e) => e.target.style.borderColor = colorPrimario}
                    onBlur={(e) => e.target.style.borderColor = tema === 'dark' ? '#333' : '#d1d5db'}
                  >
                    <span className={!formPlato.categoria_id ? (tema === 'dark' ? "text-neutral-500" : "text-gray-400") : (tema === 'dark' ? "text-white font-bold" : "text-gray-900 font-bold")}>
                      {formPlato.categoria_id 
                        ? (categorias.find(c => String(c.id) === String(formPlato.categoria_id))?.nombre || "Categoría desconocida")
                        : "Seleccione una categoría..."}
                    </span>
                    <span className={`transition-transform duration-300 ${dropdownCatModalAbierto ? 'rotate-180' : ''} ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}>
                      ▼
                    </span>
                  </button>

                  {dropdownCatModalAbierto && (
                    <div className={`absolute z-[60] mt-2 w-full border rounded-xl shadow-2xl overflow-hidden animate-fadeIn ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
                      <div className="max-h-48 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setFormPlato({...formPlato, categoria_id: ''});
                            setDropdownCatModalAbierto(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm font-bold transition-all border-b ${!formPlato.categoria_id ? '' : (tema === 'dark' ? 'text-neutral-400 hover:bg-[#222] hover:text-white border-[#222]' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 border-gray-100')}`}
                          style={!formPlato.categoria_id ? { backgroundColor: colorPrimario + '1A', color: colorPrimario, borderColor: tema === 'dark' ? '#222' : '#f3f4f6' } : {}}
                        >
                          Ninguna / Quitar selección
                        </button>
                        
                        {categorias.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              setFormPlato({...formPlato, categoria_id: cat.id});
                              setDropdownCatModalAbierto(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm font-bold transition-all border-b last:border-0 ${String(formPlato.categoria_id) === String(cat.id) ? '' : (tema === 'dark' ? 'text-neutral-300 hover:bg-[#222] hover:text-white border-[#222]' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-gray-100')}`}
                            style={String(formPlato.categoria_id) === String(cat.id) ? { backgroundColor: colorPrimario + '1A', color: colorPrimario, borderColor: tema === 'dark' ? '#222' : '#f3f4f6' } : {}}
                          >
                            {cat.nombre}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Foto del plato (opcional) */}
              <div className={`border rounded-2xl p-4 space-y-3 ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                <h4 className={`font-bold text-sm border-b pb-2 ${tema === 'dark' ? 'text-white border-[#333]' : 'text-gray-900 border-gray-200'}`}>Foto del Plato (opcional)</h4>

                <div className="flex items-center gap-4">
                  <div className={`w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 ${tema === 'dark' ? 'border-[#444] bg-[#111]' : 'border-gray-300 bg-white'}`}>
                    {formPlato.imagenPreview
                      ? <img src={formPlato.imagenPreview} alt="Vista previa" className="w-full h-full object-cover" />
                      : <i className="fi fi-rr-picture text-2xl text-gray-400"></i>
                    }
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => inputImagenRef.current.click()}
                        className="px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all"
                        style={{ borderColor: colorPrimario, color: colorPrimario }}
                      >
                        {hayImagen ? 'Cambiar Foto' : 'Subir Foto'}
                      </button>
                      {hayImagen && (
                        <button
                          type="button"
                          onClick={onQuitarImagen}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${tema === 'dark' ? 'border-[#333] text-neutral-400 hover:border-red-500 hover:text-red-500' : 'border-gray-200 text-gray-500 hover:border-red-500 hover:text-red-500'}`}
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <input ref={inputImagenRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={onSeleccionarImagen} />
                    <p className={`text-[11px] ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>
                      Puedes agregarla ahora o después desde Carta QR → Fotos Platos.
                    </p>
                  </div>
                </div>

                {/* Mejorar con IA (solo tiene sentido si hay una foto para procesar) */}
                {formPlato.imagenFile && (
                  <label className="flex items-center gap-3 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formPlato.mejorarConIA}
                      onChange={(e) => setFormPlato({ ...formPlato, mejorarConIA: e.target.checked })}
                    />
                    <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${tema === 'dark' ? 'bg-[#333]' : 'bg-gray-300'}`} style={formPlato.mejorarConIA ? { backgroundColor: '#a855f7' } : {}}>
                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 shadow-md transition-transform duration-300 ease-in-out ${formPlato.mejorarConIA ? 'translate-x-full' : ''}`}></div>
                    </div>
                    <div>
                      <p className={`font-bold text-sm flex items-center gap-1.5 ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        <i className="fi fi-rr-magic-wand" style={{ color: '#a855f7' }}></i> Mejorar automáticamente con IA
                      </p>
                      <p className={`text-[11px] ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>La IA reilumina la foto tipo estudio al guardar.</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Comportamiento (Switches) - ✨ LÓGICA DE NEGOCIO CORREGIDA ✨ */}
              <div className={`border rounded-2xl p-4 space-y-4 ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                <h4 className={`font-bold text-sm mb-2 border-b pb-2 ${tema === 'dark' ? 'text-white border-[#333]' : 'text-gray-900 border-gray-200'}`}>Comportamiento en POS</h4>
                
                {/* 1. Venta Rápida */}
                <div className="flex items-center justify-between">
                  <div className={formPlato.tiene_variaciones ? 'opacity-50' : ''}>
                    <p className={`font-bold text-sm ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>Venta Rápida (Directo al carrito)</p>
                    <p className={`text-[11px] ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>Sin ventanas extra. Bloqueado si tiene variaciones.</p>
                  </div>
                  <label className={`relative inline-flex items-center ${formPlato.tiene_variaciones ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formPlato.es_venta_rapida} 
                      disabled={formPlato.tiene_variaciones}
                      onChange={(e) => setFormPlato({...formPlato, es_venta_rapida: e.target.checked})} 
                    />
                    <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none transition-colors ${tema === 'dark' ? 'bg-[#333]' : 'bg-gray-300'} peer-disabled:opacity-50`} style={formPlato.es_venta_rapida ? { backgroundColor: colorPrimario } : {}}>
                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${formPlato.es_venta_rapida ? 'translate-x-full' : ''}`}></div>
                    </div>
                  </label>
                </div>

                {/* 2. Requiere Selección */}
                <div className="flex items-center justify-between transition-opacity">
                  <div>
                    <p className={`font-bold text-sm ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>Requiere Selección (Presentaciones)</p>
                    <p className={`text-[11px] ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>Ej. Personal o Familiar. Obliga a elegir.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formPlato.requiere_seleccion} 
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormPlato({
                          ...formPlato, 
                          requiere_seleccion: checked,
                          // Si se enciende "Selección", se apaga "Variaciones" automáticamente
                          tiene_variaciones: checked ? false : formPlato.tiene_variaciones,
                          precio_base: checked ? '0.00' : formPlato.precio_base
                        });
                      }} 
                    />
                    <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none transition-colors ${tema === 'dark' ? 'bg-[#333]' : 'bg-gray-300'} peer-disabled:opacity-50`} style={formPlato.requiere_seleccion ? { backgroundColor: colorPrimario } : {}}>
                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${formPlato.requiere_seleccion ? 'translate-x-full' : ''}`}></div>
                    </div>
                  </label>
                </div>

                {/* 3. Tiene Variaciones */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-bold text-sm ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>Tiene Variaciones (Extras Opcionales)</p>
                    <p className={`text-[11px] ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>Ej. Extra Queso. Apaga Venta Rápida y Selección.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={formPlato.tiene_variaciones} 
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormPlato({
                          ...formPlato, 
                          tiene_variaciones: checked,
                          // Si se enciende "Variaciones", se apagan las otras dos automáticamente
                          requiere_seleccion: checked ? false : formPlato.requiere_seleccion,
                          es_venta_rapida: checked ? false : formPlato.es_venta_rapida
                        });
                      }} 
                    />
                    <div className={`w-11 h-6 rounded-full peer peer-focus:outline-none transition-colors ${tema === 'dark' ? 'bg-[#333]' : 'bg-gray-300'} peer-disabled:opacity-50`} style={formPlato.tiene_variaciones ? { backgroundColor: colorPrimario } : {}}>
                      <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-transform ${formPlato.tiene_variaciones ? 'translate-x-full' : ''}`}></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* BOTONES DEL PASO 1 */}
              {(formPlato.requiere_seleccion || formPlato.tiene_variaciones) ? (
                <button onClick={() => {
                  if (formPlato.grupos_variacion.length === 0) {
                    setFormPlato({...formPlato, grupos_variacion: [{ nombre: 'Opciones', obligatorio: formPlato.requiere_seleccion, seleccion_multiple: false, opciones: [] }]});
                  }
                  setPasoModal(2);
                }} className="w-full bg-[#2463EB] hover:bg-blue-500 text-white py-4 rounded-xl font-black shadow-lg transition-all flex justify-center items-center gap-2 active:scale-[0.98]">
                  {formPlato.id ? 'EDITAR OPCIONES / PRECIOS →' : 'SIGUIENTE: DEFINIR OPCIONES →'}
                </button>
              ) : (
                <button
                  onClick={manejarGuardarPlato}
                  disabled={!formPlato.nombre || !formPlato.precio_base || procesando}
                  className="w-full text-white py-4 rounded-xl font-black shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                  style={procesando
                    ? { backgroundColor: colorBotonGuardar, boxShadow: 'none', color: tema === 'dark' ? '#888' : '#6b7280' }
                    : { backgroundColor: colorPrimario, boxShadow: `0 4px 15px ${colorPrimario}4D` }}
                >
                  {textoBotonGuardar}
                </button>
              )}
            </div>
          )}

          {/* ======================= PANTALLA 2: LAS SELECCIONES / VARIACIONES ======================= */}
          {pasoModal === 2 && (
            <div className="space-y-6 animate-fadeIn">
              
              <div className="flex justify-between items-center mb-2">
                <h4 className={`font-bold text-sm ${tema === 'dark' ? 'text-white' : 'text-gray-900'}`}>Grupos de Opciones</h4>
                <button onClick={() => {
                  setFormPlato({...formPlato, grupos_variacion: [...formPlato.grupos_variacion, { nombre: 'Nuevo Grupo', obligatorio: false, seleccion_multiple: true, opciones: [] }]});
                }} className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors hover:brightness-110" style={{ color: colorPrimario, backgroundColor: colorPrimario + '1A' }}>
                  + Añadir Grupo
                </button>
              </div>

              <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {formPlato.grupos_variacion.map((grupo, gIndex) => (
                  <div key={gIndex} className={`border rounded-2xl p-4 relative ${tema === 'dark' ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                    
                    {/* Botón eliminar grupo */}
                    <button onClick={() => {
                      const nuevos = formPlato.grupos_variacion.filter((_, i) => i !== gIndex);
                      setFormPlato({...formPlato, grupos_variacion: nuevos});
                    }} className={`absolute top-4 right-4 transition-colors ${tema === 'dark' ? 'text-neutral-500 hover:text-red-500' : 'text-gray-400 hover:text-red-500'}`}>🗑️</button>

                    {/* Nombre y Reglas del Grupo */}
                    <div className="space-y-3 mb-4 pr-8">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: colorPrimario }}>Nombre del Grupo</label>
                        <input type="text" value={grupo.nombre} onChange={(e) => {
                          const nuevosGrupos = [...formPlato.grupos_variacion];
                          nuevosGrupos[gIndex].nombre = e.target.value;
                          setFormPlato({...formPlato, grupos_variacion: nuevosGrupos});
                        }} className={`w-full border rounded-xl px-4 py-2 font-bold outline-none text-sm transition-colors ${tema === 'dark' ? 'bg-[#111] text-white' : 'bg-white text-gray-900'}`} style={{ borderColor: colorPrimario + '4D' }} onFocus={(e) => e.target.style.borderColor = colorPrimario} onBlur={(e) => e.target.style.borderColor = colorPrimario + '4D'} placeholder="Ej. Elige tu crema" />
                      </div>
                    </div>

                    <div className={`h-px w-full mb-4 ${tema === 'dark' ? 'bg-[#333]' : 'bg-gray-200'}`}></div>

                    {/* Lista de Opciones */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className={`text-[10px] font-black uppercase tracking-widest ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>Opciones y Precios (+S/)</label>
                        <button onClick={() => {
                          const nuevosGrupos = [...formPlato.grupos_variacion];
                          nuevosGrupos[gIndex].opciones.push({ nombre: '', precio_adicional: '' });
                          setFormPlato({...formPlato, grupos_variacion: nuevosGrupos});
                        }} className="text-xs font-bold hover:underline" style={{ color: colorPrimario }}>
                          + Añadir Opción
                        </button>
                      </div>

                      <div className="space-y-2 w-full overflow-hidden">
                        {grupo.opciones.map((opcion, oIndex) => (
                          <div key={oIndex} className="grid grid-cols-[1fr_80px_40px] sm:grid-cols-[1fr_100px_40px] gap-2 items-center">
                            <input type="text" placeholder="Ej. Sin Cebolla" value={opcion.nombre} onChange={(e) => {
                              const nuevosGrupos = [...formPlato.grupos_variacion];
                              nuevosGrupos[gIndex].opciones[oIndex].nombre = e.target.value;
                              setFormPlato({...formPlato, grupos_variacion: nuevosGrupos});
                            }} className={`w-full border rounded-xl px-3 py-2.5 outline-none text-sm transition-colors ${tema === 'dark' ? 'bg-[#111] border-[#333] text-white focus:border-white' : 'bg-white border-gray-300 text-gray-900 focus:border-gray-500'}`} />
                            
                            <input type="number" placeholder="0.00" value={opcion.precio_adicional} onChange={(e) => {
                              const nuevosGrupos = [...formPlato.grupos_variacion];
                              nuevosGrupos[gIndex].opciones[oIndex].precio_adicional = e.target.value;
                              setFormPlato({...formPlato, grupos_variacion: nuevosGrupos});
                            }} className={`w-full border rounded-xl px-3 py-2.5 outline-none text-right text-sm transition-colors ${tema === 'dark' ? 'bg-[#111] border-[#333] text-white focus:border-white' : 'bg-white border-gray-300 text-gray-900 focus:border-gray-500'}`} />
                            
                            <button onClick={() => {
                              const nuevosGrupos = [...formPlato.grupos_variacion];
                              nuevosGrupos[gIndex].opciones = nuevosGrupos[gIndex].opciones.filter((_, i) => i !== oIndex);
                              setFormPlato({...formPlato, grupos_variacion: nuevosGrupos});
                            }} className="w-full h-[42px] flex items-center justify-center text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl transition-colors font-bold">✕</button>
                          </div>
                        ))}
                        {grupo.opciones.length === 0 && (
                          <p className={`text-xs italic ${tema === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}>Añade opciones para este grupo.</p>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>

              {/* BOTÓN FINAL DE GUARDAR */}
              <button
                onClick={manejarGuardarPlato}
                disabled={procesando}
                className="w-full text-white py-4 rounded-xl font-black shadow-lg mt-8 disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                style={procesando
                  ? { backgroundColor: colorBotonGuardar, boxShadow: 'none', color: tema === 'dark' ? '#888' : '#6b7280' }
                  : { backgroundColor: colorPrimario, boxShadow: `0 4px 15px ${colorPrimario}4D` }}
              >
                {subiendoImagenPlato
                  ? 'PROCESANDO IMAGEN...'
                  : guardandoPlato
                    ? (formPlato.id ? 'GUARDANDO...' : 'CREANDO...')
                    : (formPlato.id ? 'GUARDAR CAMBIOS' : 'CREAR PLATO')}
              </button>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}