import React, { useState, useEffect } from 'react';
import usePosStore from '../../store/usePosStore';
import { getCatalogoGlobal, actualizarVariacionesProducto } from '../../api/api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';

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

// ============================================================
// SUBCOMPONENTE: mini-modal para armar la receta de UNA opción
// (mismo patrón 2 columnas del modal de Receta simple, pero editando
// estado local — el guardado real lo hace el botón "Guardar Recetas"
// del modal principal)
// ============================================================
function ModalRecetaOpcion({ opcionNombre, catalogo, ingredientes, onAgregar, onCambiarCantidad, onQuitar, onCerrar, isDark, colorPrimario }) {
  const [busqueda, setBusqueda] = useState('');
  const catalogoFiltrado = catalogo.filter(i => i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()));

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[120] p-4 animate-fadeIn"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[85vh] rounded-[2rem] shadow-2xl border overflow-hidden flex flex-col ${
          isDark ? 'bg-[#0d0d0d] border-[#222]' : 'bg-white border-gray-200'
        }`}
      >
        {/* CABECERA */}
        <div className={`p-5 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-[#222] bg-[#111]' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${colorPrimario}15`, color: colorPrimario }}>
              <i className="fi fi-rr-book-alt text-lg mt-1"></i>
            </div>
            <div>
              <h3 className={`text-base font-black tracking-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Receta: {opcionNombre || 'Opción sin nombre'}
              </h3>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 text-neutral-500">Insumos de esta variante</p>
            </div>
          </div>
          <button
            onClick={onCerrar}
            className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
              isDark ? 'border-[#333] text-neutral-500 hover:text-white hover:bg-[#1a1a1a]' : 'border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <i className="fi fi-rr-cross-small"></i>
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
          {/* CATÁLOGO IZQUIERDA */}
          <div className={`w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r md:overflow-y-auto shrink-0 md:shrink ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
              <i className="fi fi-rr-search text-xs text-neutral-500 shrink-0"></i>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar insumo..."
                className={`flex-1 bg-transparent outline-none text-sm font-bold ${isDark ? 'text-white placeholder:text-neutral-600' : 'text-gray-900 placeholder:text-gray-400'}`}
              />
            </div>

            {catalogo.length === 0 ? (
              <p className={`text-xs text-center py-6 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>Sin insumos en el catálogo</p>
            ) : catalogoFiltrado.length === 0 ? (
              <p className={`text-xs text-center py-6 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>Sin resultados para "{busqueda}"</p>
            ) : (
              <div className="space-y-1.5">
                {catalogoFiltrado.map(insumo => {
                  const yaAgregado = ingredientes.some(ing => ing.insumo === insumo.id);
                  return (
                    <button
                      key={insumo.id}
                      onClick={() => !yaAgregado && onAgregar(insumo)}
                      disabled={yaAgregado}
                      className={`w-full p-2.5 rounded-xl border text-left flex justify-between items-center transition-all ${
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
          <div className="w-full md:w-1/2 p-4 md:overflow-y-auto shrink-0 md:shrink">
            {ingredientes.length === 0 ? (
              <div className={`p-6 text-center rounded-2xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <i className={`fi fi-rr-shopping-basket text-2xl mb-2 block ${isDark ? 'text-neutral-600' : 'text-gray-300'}`}></i>
                <p className={`text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Aún no hay ingredientes</p>
                <p className={`text-[11px] mt-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Elige insumos de la izquierda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ingredientes.map((ing, idx) => (
                  <div key={idx} className={`flex items-center gap-2 p-2.5 rounded-xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                    <span className={`flex-1 font-bold text-xs truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{ing.nombre_insumo}</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={ing.cantidad_necesaria}
                      onChange={(e) => onCambiarCantidad(idx, e.target.value)}
                      className={`w-16 px-2 py-1.5 rounded-lg outline-none text-center font-mono font-bold text-xs border ${
                        isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    />
                    <span className="text-[9px] font-bold uppercase text-neutral-500 w-8 shrink-0">{ing.unidad_medida}</span>
                    <button
                      onClick={() => onQuitar(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors shrink-0"
                    >
                      <i className="fi fi-rr-trash text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className={`p-4 border-t shrink-0 ${isDark ? 'border-[#222] bg-[#111]' : 'border-gray-100 bg-gray-50'}`}>
          <button
            onClick={onCerrar}
            style={{ backgroundColor: colorPrimario }}
            className="w-full py-3 rounded-xl text-white text-sm font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: tarjeta de una opción de variación
// ============================================================
function OpcionCard({
  opcion, catalogo, isDark, colorPrimario,
  onCambiarNombre, onCambiarPrecio, onCambiarModo, onEliminar,
  onAgregarIngrediente, onCambiarCantidadIngrediente, onQuitarIngrediente,
  onAbrirReceta,
}) {
  const esUnidad = opcion.modo_stock === 'unidad';
  const ingredientes = opcion.ingredientes || [];
  const catalogoUnidades = catalogo.filter(i => i.unidad_medida === 'unidades');

  return (
    <div className={`rounded-2xl p-4 border ${isDark ? 'bg-[#0a0a0a] border-[#333]' : 'bg-white border-gray-200'}`}>
      {/* Nombre + precio + eliminar */}
      <div className="flex items-start gap-2 mb-3">
        <input
          type="text"
          value={opcion.nombre}
          onChange={(e) => onCambiarNombre(e.target.value)}
          placeholder="Nombre de la opción"
          className={`flex-1 min-w-0 px-3 py-2 rounded-lg outline-none text-sm font-bold border ${
            isDark ? 'bg-[#111] border-[#333] text-white placeholder:text-neutral-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400'
          }`}
        />
        <div className={`flex items-center gap-1 px-2 py-2 rounded-lg border shrink-0 ${isDark ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
          <span className="text-[10px] font-bold text-neutral-500">S/</span>
          <input
            type="number" step="0.01"
            value={opcion.precio_adicional}
            onChange={(e) => onCambiarPrecio(e.target.value)}
            className={`w-14 bg-transparent outline-none text-sm font-mono font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
          />
        </div>
        <button
          onClick={onEliminar}
          className="w-9 h-9 flex items-center justify-center bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors shrink-0"
        >
          <i className="fi fi-rr-trash text-xs"></i>
        </button>
      </div>

      {/* Switch de modo */}
      <div className={`inline-flex rounded-lg p-0.5 mb-3 ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-100'}`}>
        <button
          onClick={() => onCambiarModo('receta')}
          className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${!esUnidad ? 'text-white' : isDark ? 'text-neutral-500' : 'text-gray-500'}`}
          style={!esUnidad ? { backgroundColor: colorPrimario } : {}}
        >
          Receta
        </button>
        <button
          onClick={() => onCambiarModo('unidad')}
          className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-all ${esUnidad ? 'text-white' : isDark ? 'text-neutral-500' : 'text-gray-500'}`}
          style={esUnidad ? { backgroundColor: colorPrimario } : {}}
        >
          Por unidad
        </button>
      </div>

      {/* Cuerpo según modo */}
      {!esUnidad ? (
        <button
          onClick={onAbrirReceta}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors ${
            isDark ? 'bg-[#111] border-[#222] hover:border-[#444]' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
          }`}
        >
          <span className={`text-xs font-bold ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>
            {ingredientes.length > 0
              ? `${ingredientes.length} insumo${ingredientes.length > 1 ? 's' : ''} configurado${ingredientes.length > 1 ? 's' : ''}`
              : 'Sin receta aún'}
          </span>
          <i className="fi fi-rr-book-alt text-xs" style={{ color: colorPrimario }}></i>
        </button>
      ) : ingredientes.length === 0 ? (
        catalogoUnidades.length === 0 ? (
          <p className={`text-[10px] px-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            No hay insumos tipo "unidades" en tu catálogo. Créalos desde Inventario.
          </p>
        ) : (
          <SelectorInsumo
            catalogo={catalogoUnidades}
            ingredientesActuales={[]}
            onAgregar={onAgregarIngrediente}
            isDark={isDark}
            colorPrimario={colorPrimario}
          />
        )
      ) : (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
          <span className={`flex-1 text-xs font-bold truncate ${isDark ? 'text-neutral-300' : 'text-gray-700'}`}>{ingredientes[0].nombre_insumo}</span>
          <input
            type="number" min="0" step="1"
            value={ingredientes[0].cantidad_necesaria}
            onChange={(e) => onCambiarCantidadIngrediente(0, e.target.value)}
            className={`w-14 px-2 py-1 rounded text-center font-mono text-xs font-bold outline-none border ${
              isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'
            }`}
          />
          <span className="text-[9px] font-bold uppercase text-neutral-500 shrink-0">und.</span>
          <button
            onClick={() => onQuitarIngrediente(0)}
            className={`text-[9px] font-black uppercase tracking-wide shrink-0 ${isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Cambiar
          </button>
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
  const confirmar = useConfirm();

  const [catalogo, setCatalogo] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalRecetaOpcion, setModalRecetaOpcion] = useState(null); // { gIndex, oIndex } | null

  useEffect(() => {
    if (isOpen && producto) {
      getCatalogoGlobal().then(res => setCatalogo(res.data));
      // Clonamos las variaciones que ya trae el producto desde la base de datos
      setGrupos(producto.grupos_variacion ? JSON.parse(JSON.stringify(producto.grupos_variacion)) : []);
      setModalRecetaOpcion(null);
    }
  }, [isOpen, producto]);

  // ================= ACCIONES DE OPCIONES =================
  const handleAgregarOpcion = (gIndex) => {
    const nuevosGrupos = [...grupos];
    // Agregamos con precio 0 por defecto (el precio real se maneja en el catálogo)
    nuevosGrupos[gIndex].opciones.push({ nombre: '', precio_adicional: 0, modo_stock: 'receta', ingredientes: [] });
    setGrupos(nuevosGrupos);
  };

  const handleEliminarOpcion = (gIndex, oIndex) => {
    const nuevosGrupos = [...grupos];
    nuevosGrupos[gIndex].opciones.splice(oIndex, 1);
    setGrupos(nuevosGrupos);
  };

  const handleCambiarNombreOpcion = (gIndex, oIndex, valor) => {
    const nuevosGrupos = [...grupos];
    nuevosGrupos[gIndex].opciones[oIndex].nombre = valor;
    setGrupos(nuevosGrupos);
  };

  const handleCambiarPrecioOpcion = (gIndex, oIndex, valor) => {
    const nuevosGrupos = [...grupos];
    nuevosGrupos[gIndex].opciones[oIndex].precio_adicional = valor;
    setGrupos(nuevosGrupos);
  };

  const handleCambiarModoOpcion = async (gIndex, oIndex, nuevoModo) => {
    const opcion = grupos[gIndex].opciones[oIndex];
    if (opcion.modo_stock === nuevoModo) return;

    if (nuevoModo === 'unidad' && (opcion.ingredientes?.length || 0) > 0) {
      const n = opcion.ingredientes.length;
      const ok = await confirmar(`¿Cambiar a modo "Por unidad"? Se perderá la receta actual (${n} insumo${n > 1 ? 's' : ''}).`);
      if (!ok) return;
    }

    const nuevosGrupos = [...grupos];
    const opcionActualizada = { ...nuevosGrupos[gIndex].opciones[oIndex], modo_stock: nuevoModo };
    if (nuevoModo === 'unidad') opcionActualizada.ingredientes = [];
    nuevosGrupos[gIndex].opciones[oIndex] = opcionActualizada;
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

  const opcionEnEdicion = modalRecetaOpcion
    ? grupos[modalRecetaOpcion.gIndex]?.opciones[modalRecetaOpcion.oIndex]
    : null;

  return (
    <>
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

                {/* GRILLA DE TARJETAS DE OPCIONES */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {grupo.opciones.map((opcion, oIndex) => (
                    <OpcionCard
                      key={oIndex}
                      opcion={opcion}
                      catalogo={catalogo}
                      isDark={isDark}
                      colorPrimario={colorPrimario}
                      onCambiarNombre={(valor) => handleCambiarNombreOpcion(gIndex, oIndex, valor)}
                      onCambiarPrecio={(valor) => handleCambiarPrecioOpcion(gIndex, oIndex, valor)}
                      onCambiarModo={(modo) => handleCambiarModoOpcion(gIndex, oIndex, modo)}
                      onEliminar={() => handleEliminarOpcion(gIndex, oIndex)}
                      onAgregarIngrediente={(insumo) => handleAgregarIngrediente(gIndex, oIndex, insumo)}
                      onCambiarCantidadIngrediente={(iIndex, valor) => handleCambiarCantidadIngrediente(gIndex, oIndex, iIndex, valor)}
                      onQuitarIngrediente={(iIndex) => handleEliminarIngrediente(gIndex, oIndex, iIndex)}
                      onAbrirReceta={() => setModalRecetaOpcion({ gIndex, oIndex })}
                    />
                  ))}

                  <button
                    onClick={() => handleAgregarOpcion(gIndex)}
                    className={`rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-6 transition-colors ${
                      isDark ? 'border-[#333] text-neutral-500 hover:text-white hover:border-[#555]' : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full ${isDark ? 'bg-[#222]' : 'bg-gray-100'}`}>
                      <i className="fi fi-rr-add text-xs"></i>
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Añadir Opción</span>
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

      {/* Mini-modal: receta de una opción puntual */}
      {modalRecetaOpcion && opcionEnEdicion && (
        <ModalRecetaOpcion
          opcionNombre={opcionEnEdicion.nombre}
          catalogo={catalogo}
          ingredientes={opcionEnEdicion.ingredientes || []}
          onAgregar={(insumo) => handleAgregarIngrediente(modalRecetaOpcion.gIndex, modalRecetaOpcion.oIndex, insumo)}
          onCambiarCantidad={(iIndex, valor) => handleCambiarCantidadIngrediente(modalRecetaOpcion.gIndex, modalRecetaOpcion.oIndex, iIndex, valor)}
          onQuitar={(iIndex) => handleEliminarIngrediente(modalRecetaOpcion.gIndex, modalRecetaOpcion.oIndex, iIndex)}
          onCerrar={() => setModalRecetaOpcion(null)}
          isDark={isDark}
          colorPrimario={colorPrimario}
        />
      )}
    </>
  );
}
