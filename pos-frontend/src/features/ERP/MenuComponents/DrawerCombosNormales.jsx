import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../api/api';
import { useToast } from '../../../context/ToastContext';
import { useConfirm } from '../../../context/ConfirmContext';

// ============================================================
// HELPERS
// ============================================================
const getPrecioMostrado = (producto) => {
  if (producto.requiere_seleccion) {
    const precios = producto.grupos_variacion
      ?.flatMap(g => g.opciones?.map(o => parseFloat(o.precio_adicional)) ?? []) ?? [];
    if (!precios.length) return 'S/ 0.00';
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    return min === max ? `S/ ${min.toFixed(2)}` : `S/ ${min.toFixed(2)} – ${max.toFixed(2)}`;
  }
  return `S/ ${parseFloat(producto.precio_base || 0).toFixed(2)}`;
};

// ============================================================
// SUBCOMPONENTE: Modal selección de opcion (requiere_seleccion)
// ============================================================
function ModalSeleccionOpcion({ producto, isDark, colorPrimario, onConfirmar, onCerrar }) {
  const [seleccionadas, setSeleccionadas] = useState({});

  const toggleOpcion = (grupoId, opcionId) => {
    const grupo = producto.grupos_variacion.find(g => g.id === grupoId);
    if (!grupo) return;
    if (grupo.seleccion_multiple) {
      setSeleccionadas(prev => {
        const actual = prev[grupoId] ?? [];
        return { ...prev, [grupoId]: actual.includes(opcionId) ? actual.filter(id => id !== opcionId) : [...actual, opcionId] };
      });
    } else {
      setSeleccionadas(prev => ({ ...prev, [grupoId]: opcionId }));
    }
  };

  const puedeConfirmar = producto.grupos_variacion.every(g => {
    if (!g.obligatorio) return true;
    const sel = seleccionadas[g.id];
    return sel && (Array.isArray(sel) ? sel.length > 0 : true);
  });

  const confirmar = () => {
    const opcionId = Object.values(seleccionadas).find(v => !Array.isArray(v));
    onConfirmar({ opcion_seleccionada_id: opcionId ?? null });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCerrar} />
      <div className={`relative z-10 rounded-3xl w-full max-w-md shadow-2xl border ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}>
        <div className="p-6 border-b" style={{ borderColor: isDark ? '#222' : '#f0f0f0' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Elige presentación</p>
              <h3 className={`text-lg font-black mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{producto.nombre}</h3>
            </div>
            <button onClick={onCerrar} className="text-neutral-500 hover:text-white transition-colors"><i className="fi fi-rr-cross-small text-lg"></i></button>
          </div>
        </div>
        <div className="p-6 space-y-5 max-h-[50vh] overflow-y-auto">
          {producto.grupos_variacion?.map(grupo => (
            <div key={grupo.id}>
              <p className={`text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {grupo.nombre}
                {grupo.obligatorio && <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Requerido</span>}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {grupo.opciones?.map(opcion => {
                  const sel = seleccionadas[grupo.id];
                  const isSelected = Array.isArray(sel) ? sel.includes(opcion.id) : sel === opcion.id;
                  return (
                    <button key={opcion.id} onClick={() => toggleOpcion(grupo.id, opcion.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${isSelected ? '' : isDark ? 'border-[#333] hover:border-[#555]' : 'border-gray-200 hover:border-gray-300'}`}
                      style={isSelected ? { borderColor: colorPrimario, backgroundColor: colorPrimario + '22' } : {}}>
                      <p className="text-sm font-bold" style={isSelected ? { color: colorPrimario } : { color: isDark ? 'white' : '#111' }}>{opcion.nombre}</p>
                      {parseFloat(opcion.precio_adicional) > 0 && (
                        <p className="text-xs text-neutral-500 mt-0.5">+S/ {parseFloat(opcion.precio_adicional).toFixed(2)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 border-t" style={{ borderColor: isDark ? '#222' : '#f0f0f0' }}>
          <button onClick={confirmar} disabled={!puedeConfirmar}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-40 active:scale-95"
            style={{ backgroundColor: colorPrimario }}>
            Añadir al combo
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: Modal variaciones (tiene_variaciones)
// ============================================================
function ModalVariaciones({ producto, isDark, colorPrimario, onConfirmar, onCerrar }) {
  const [seleccionadas, setSeleccionadas] = useState({});

  const toggleOpcion = (grupoId, opcionId) => {
    const grupo = producto.grupos_variacion.find(g => g.id === grupoId);
    if (!grupo) return;
    if (grupo.seleccion_multiple) {
      setSeleccionadas(prev => {
        const actual = prev[grupoId] ?? [];
        return { ...prev, [grupoId]: actual.includes(opcionId) ? actual.filter(id => id !== opcionId) : [...actual, opcionId] };
      });
    } else {
      setSeleccionadas(prev => ({ ...prev, [grupoId]: opcionId }));
    }
  };

  const haySeleccion = Object.keys(seleccionadas).length > 0;

  const confirmar = () => {
    const opcionId = Object.values(seleccionadas).find(v => !Array.isArray(v));
    onConfirmar({ opcion_seleccionada_id: opcionId ?? null, variacion_seleccionada_id: null });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCerrar} />
      <div className={`relative z-10 rounded-3xl w-full max-w-md shadow-2xl border ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}>
        <div className="p-6 border-b" style={{ borderColor: isDark ? '#222' : '#f0f0f0' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Elige variación</p>
              <h3 className={`text-lg font-black mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{producto.nombre}</h3>
            </div>
            <button onClick={onCerrar} className="text-neutral-500 hover:text-white transition-colors"><i className="fi fi-rr-cross-small text-lg"></i></button>
          </div>
        </div>
        <div className="p-6 space-y-5 max-h-[50vh] overflow-y-auto">
          {producto.grupos_variacion?.map(grupo => (
            <div key={grupo.id}>
              <p className={`text-xs font-black uppercase tracking-widest mb-3 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>{grupo.nombre}</p>
              <div className="grid grid-cols-2 gap-2">
                {grupo.opciones?.map(opcion => {
                  const sel = seleccionadas[grupo.id];
                  const isSelected = Array.isArray(sel) ? sel.includes(opcion.id) : sel === opcion.id;
                  return (
                    <button key={opcion.id} onClick={() => toggleOpcion(grupo.id, opcion.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${isSelected ? '' : isDark ? 'border-[#333] hover:border-[#555]' : 'border-gray-200 hover:border-gray-300'}`}
                      style={isSelected ? { borderColor: colorPrimario, backgroundColor: colorPrimario + '22' } : {}}>
                      <p className="text-sm font-bold" style={isSelected ? { color: colorPrimario } : { color: isDark ? 'white' : '#111' }}>{opcion.nombre}</p>
                      {parseFloat(opcion.precio_adicional) > 0 && (
                        <p className="text-xs text-neutral-500">+S/ {parseFloat(opcion.precio_adicional).toFixed(2)}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 border-t" style={{ borderColor: isDark ? '#222' : '#f0f0f0' }}>
          <button onClick={confirmar} disabled={!haySeleccion}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-40 active:scale-95"
            style={{ backgroundColor: colorPrimario }}>
            Añadir variante al combo
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: Card de producto para el selector
// ============================================================
function ProductCardSelector({ producto, isDark, colorPrimario, onClickCard, onClickVariaciones, yaAgregado }) {
  const esConVariaciones = producto.tiene_variaciones && producto.grupos_variacion?.length > 0;

  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all ${
      yaAgregado ? 'ring-2' : isDark ? 'border-[#2a2a2a] hover:border-[#444]' : 'border-gray-200 hover:border-gray-300'
    }`} style={yaAgregado ? { borderColor: colorPrimario } : {}}>

      <div className="w-full h-24 flex items-center justify-center relative cursor-pointer"
        style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
        onClick={() => onClickCard(producto)}>
        {producto.imagen
          ? <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover" />
          : <i className="fi fi-rr-shopping-bag text-2xl opacity-20"></i>
        }
        {yaAgregado && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: colorPrimario + '33' }}>
            <i className="fi fi-rr-check text-2xl" style={{ color: colorPrimario }}></i>
          </div>
        )}
      </div>

      <div className="p-2.5 cursor-pointer" onClick={() => onClickCard(producto)}>
        <p className={`text-xs font-bold leading-tight line-clamp-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>{producto.nombre}</p>
        <p className="text-[11px] font-black mt-1" style={{ color: colorPrimario }}>{getPrecioMostrado(producto)}</p>
        {producto.requiere_seleccion && producto.grupos_variacion?.length > 0 && (
          <span className="text-[10px] text-blue-400 font-bold">Elige presentación</span>
        )}
      </div>

      {esConVariaciones && (
        <button
          onClick={(e) => { e.stopPropagation(); onClickVariaciones(producto); }}
          className={`w-full text-[10px] font-black uppercase tracking-widest py-1.5 border-t transition-colors ${
            isDark ? 'border-[#2a2a2a] text-purple-400 hover:bg-[#222]' : 'border-gray-100 text-purple-500 hover:bg-purple-50'
          }`}>
          Variaciones ↕
        </button>
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: Formulario de combo (panel derecho)
// ============================================================
function FormularioCombo({ combo, isDark, colorPrimario, productosReales, categoriasReales, onGuardar, onCancelar, guardando }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nombre: combo?.nombre ?? '',
    precio: combo?.precio_base ?? '',
    items: combo?.items_combo?.map(i => ({
        producto_hijo_id: i.producto_hijo,
        cantidad: i.cantidad,
        opcion_seleccionada_id: i.opcion_seleccionada ?? null,
        variacion_seleccionada_id: i.variacion_seleccionada ?? null,
        _nombre: i.producto_hijo_nombre ?? '',
    })) ?? [],
  });

  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [modalOpcion, setModalOpcion] = useState(null);
  const [modalVariacion, setModalVariacion] = useState(null);

  const productosFiltrados = productosReales.filter(p => {
    if (p.es_combo) return false;
    const matchCat = categoriaFiltro === 'todas' || String(p.categoria) === String(categoriaFiltro);
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBusq;
  });

  const handleClickCard = (producto) => {
    if (producto.requiere_seleccion && producto.grupos_variacion?.length > 0) {
      setModalOpcion(producto);
    } else {
      agregarProducto(producto, {});
    }
  };

  const handleClickVariaciones = (producto) => setModalVariacion(producto);

  const agregarProducto = (producto, extras) => {
    const tieneOpcion = extras.opcion_seleccionada_id ?? null;
    const tieneVariacion = extras.variacion_seleccionada_id ?? null;

    setForm(f => {
        // Buscar si ya existe el mismo producto con la misma opción/variación
        const idx = f.items.findIndex(it =>
        String(it.producto_hijo_id) === String(producto.id) &&
        it.opcion_seleccionada_id === tieneOpcion &&
        it.variacion_seleccionada_id === tieneVariacion
        );

        if (idx >= 0) {
        // Ya existe → incrementar cantidad
        return {
            ...f,
            items: f.items.map((it, i) =>
            i === idx ? { ...it, cantidad: it.cantidad + 1 } : it
            )
        };
        }

        // No existe → agregar nuevo
        return {
        ...f,
        items: [...f.items, {
            producto_hijo_id: producto.id,
            cantidad: 1,
            opcion_seleccionada_id: tieneOpcion,
            variacion_seleccionada_id: tieneVariacion,
            _nombre: producto.nombre,
        }]
        };
    });

    setModalOpcion(null);
    setModalVariacion(null);
    };

  const quitarItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const cambiarCantidad = (idx, delta) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, cantidad: Math.max(1, it.cantidad + delta) } : it) }));

  const handleGuardar = () => {
    if (!form.nombre.trim()) return toast.warning('El nombre es obligatorio.');
    if (!form.precio || parseFloat(form.precio) <= 0) return toast.warning('El precio debe ser mayor a 0.');
    if (form.items.length === 0) return toast.warning('Agrega al menos un producto al combo.');
    onGuardar({ nombre: form.nombre, precio: parseFloat(form.precio), items: form.items });
  };
  const precioRealEstimado = form.items.reduce((total, item) => {
    const prod = productosReales.find(p => String(p.id) === String(item.producto_hijo_id));
    if (!prod) return total;
    let precio = parseFloat(prod.precio_base) || 0;
    if (precio === 0 && prod.grupos_variacion?.length > 0) {
        const precios = prod.grupos_variacion
            .flatMap(g => g.opciones?.map(o => parseFloat(o.precio_adicional)) ?? [])
            .filter(p => p > 0);
        if (precios.length > 0) precio = Math.min(...precios);
    }
    return total + precio * item.cantidad;
}, 0);

  const textoBoton = guardando
    ? (combo ? 'Guardando...' : 'Creando...')
    : (combo ? 'Guardar Cambios' : 'Crear Combo');

  return (
    <>
      <div className="flex flex-col h-full md:overflow-hidden">
        {/* Título */}
        <div className="px-1 md:px-2 pt-1 pb-4 shrink-0">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
            {combo ? `Editando: ${combo.nombre}` : 'Nuevo Combo'}
          </h4>
        </div>

        {/* Campos nombre y precio */}
        <div className="px-1 md:px-2 pb-4 border-b shrink-0 space-y-3" style={{ borderColor: isDark ? '#1e1e1e' : '#f0f0f0' }}>
            <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1">Nombre *</label>
                <input type="text" placeholder="Ej: Combo Familiar" value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className={`w-full px-3 py-2.5 rounded-xl outline-none text-sm font-bold border ${isDark ? 'bg-[#111] border-[#333] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
            </div>

            <div className="flex gap-3 items-end">
                <div className="flex-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1">Tu precio (S/) *</label>
                <input type="number" placeholder="0.00" value={form.precio}
                    onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                    className={`w-full px-3 py-2.5 rounded-xl outline-none text-base font-black font-mono border ${isDark ? 'bg-[#111] border-[#333] text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
                </div>
                {/* Precio referencia */}
                {precioRealEstimado > 0 && (
                <div className={`px-3 py-2.5 rounded-xl border text-right shrink-0 ${isDark ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Costo real</p>
                    <p className={`text-base font-black font-mono ${
                    parseFloat(form.precio) < precioRealEstimado ? 'text-red-400' : 'text-green-400'
                    }`}>
                    S/ {precioRealEstimado.toFixed(2)}
                    </p>
                </div>
                )}
            </div>

            {/* Indicador margen */}
            {precioRealEstimado > 0 && parseFloat(form.precio) > 0 && (
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold ${
                parseFloat(form.precio) >= precioRealEstimado
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-red-500/10 text-red-400'
                }`}>
                <span className="flex items-center gap-1.5">
                    <i className={`fi ${parseFloat(form.precio) >= precioRealEstimado ? 'fi-rr-check' : 'fi-rr-exclamation'}`}></i>
                    {parseFloat(form.precio) >= precioRealEstimado ? 'Precio con ganancia' : 'Precio por debajo del costo'}
                </span>
                <span>
                    {parseFloat(form.precio) >= precioRealEstimado ? '+' : ''}
                    S/ {(parseFloat(form.precio) - precioRealEstimado).toFixed(2)}
                </span>
                </div>
            )}
            </div>

        {/* Items seleccionados */}
        <div className="px-1 md:px-2 py-3 border-b shrink-0" style={{ borderColor: isDark ? '#1e1e1e' : '#f0f0f0' }}>
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-2">
            Productos del combo ({form.items.length})
          </p>
          {form.items.length === 0 ? (
            <p className={`text-xs italic ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Sin productos aún</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {form.items.map((item, idx) => (
                <div key={idx} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
                  <span className={`text-xs font-bold flex-1 truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{item._nombre}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => cambiarCantidad(idx, -1)} className={`w-5 h-5 rounded font-black text-[10px] ${isDark ? 'bg-[#222] text-white' : 'bg-gray-200 text-gray-700'}`}>−</button>
                    <span className={`text-xs font-black w-4 text-center ${isDark ? 'text-white' : 'text-gray-800'}`}>{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(idx, 1)} className={`w-5 h-5 rounded font-black text-[10px] ${isDark ? 'bg-[#222] text-white' : 'bg-gray-200 text-gray-700'}`}>+</button>
                  </div>
                  <button onClick={() => quitarItem(idx)} className="text-red-400 hover:text-red-300 shrink-0"><i className="fi fi-rr-cross-small"></i></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selector de productos */}
        <div className="flex flex-col flex-1 md:overflow-hidden">
          {/* Búsqueda */}
          <div className="px-1 md:px-2 py-3 space-y-2 border-b shrink-0" style={{ borderColor: isDark ? '#1e1e1e' : '#f0f0f0' }}>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
              <i className="fi fi-rr-search text-xs text-neutral-500 shrink-0"></i>
              <input type="text" placeholder="Buscar producto..." value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="flex-1 bg-transparent outline-none text-xs font-bold placeholder:text-neutral-600"
                style={{ color: isDark ? 'white' : '#111' }} />
            </div>
            {/* Categorías */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button onClick={() => setCategoriaFiltro('todas')}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all`}
                style={categoriaFiltro === 'todas' ? { backgroundColor: colorPrimario, color: 'white' } : { backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6', color: isDark ? '#666' : '#9ca3af' }}>
                Todas
              </button>
              {categoriasReales.map(cat => (
                <button key={cat.id} onClick={() => setCategoriaFiltro(String(cat.id))}
                  className="shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all"
                  style={categoriaFiltro === String(cat.id) ? { backgroundColor: colorPrimario, color: 'white' } : { backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6', color: isDark ? '#666' : '#9ca3af' }}>
                  {cat.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Grid productos */}
          <div className="flex-1 md:overflow-y-auto py-3">
            {productosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <i className={`fi fi-rr-exclamation text-2xl opacity-20 mb-2 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}></i>
                <p className={`text-xs font-bold ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Sin productos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {productosFiltrados.map(p => {
                  const yaAgregado = form.items.some(it => String(it.producto_hijo_id) === String(p.id));
                  return (
                    <ProductCardSelector
                      key={p.id}
                      producto={p}
                      isDark={isDark}
                      colorPrimario={colorPrimario}
                      yaAgregado={yaAgregado}
                      onClickCard={handleClickCard}
                      onClickVariaciones={handleClickVariaciones}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer guardar */}
        <div className="pt-4 shrink-0">
          <button onClick={handleGuardar} disabled={guardando}
            className="w-full py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40"
            style={{ backgroundColor: colorPrimario }}>
            <i className={`fi ${combo ? 'fi-rr-disk' : 'fi-rr-add'}`}></i>
            {textoBoton}
          </button>

          {combo && (
            <button
              onClick={onCancelar}
              className={`w-full py-3 mt-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${
                isDark ? 'bg-[#1a1a1a] border-[#333] text-neutral-400 hover:bg-[#222]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <i className="fi fi-rr-cross-small"></i> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Modales sobre el formulario */}
      {modalOpcion && (
        <ModalSeleccionOpcion producto={modalOpcion} isDark={isDark} colorPrimario={colorPrimario}
          onConfirmar={(extras) => agregarProducto(modalOpcion, extras)}
          onCerrar={() => setModalOpcion(null)} />
      )}
      {modalVariacion && (
        <ModalVariaciones producto={modalVariacion} isDark={isDark} colorPrimario={colorPrimario}
          onConfirmar={(extras) => agregarProducto(modalVariacion, extras)}
          onCerrar={() => setModalVariacion(null)} />
      )}
    </>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL: Modal de Combos (dos columnas, estilo Modificadores)
// ============================================================
export default function DrawerCombosNormales({ isOpen, onClose, isDark, colorPrimario, productosReales = [], categoriasReales = [] }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [combos, setCombos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [comboEditando, setComboEditando] = useState(null);
  const [busquedaCombo, setBusquedaCombo] = useState('');

  const cargarCombos = useCallback(async () => {
    try {
      setCargando(true);
      // Los combos normales son Productos con es_combo=true
      const { data } = await api.get('/productos/', { params: { es_combo: true } });
      setCombos(Array.isArray(data) ? data.filter(p => p.es_combo) : []);
    } catch (err) {
      console.error('Error cargando combos normales:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) { cargarCombos(); setComboEditando(null); setBusquedaCombo(''); }
  }, [isOpen, cargarCombos]);

  if (!isOpen) return null;

  const combosFiltrados = combos.filter(c => c.nombre.toLowerCase().includes(busquedaCombo.trim().toLowerCase()));

  const handleGuardar = async (formData) => {
    try {
      setGuardando(true);
      const negocioId = localStorage.getItem('negocio_id');

      if (comboEditando) {
        // Actualizar nombre y precio
        await api.patch(`/productos/${comboEditando.id}/`, {
          nombre: formData.nombre,
          precio_base: formData.precio,
        });
        // Reemplazar items
        await api.post(`/productos/${comboEditando.id}/actualizar_items_combo/`, {
          items: formData.items,
        });
      } else {
        // Crear el producto combo
        const { data: nuevoProd } = await api.post('/productos/', {
          negocio: negocioId,
          nombre: formData.nombre,
          precio_base: formData.precio,
          es_combo: true,
          disponible: true,
        });
        // Guardar sus items
        await api.post(`/productos/${nuevoProd.id}/actualizar_items_combo/`, {
          items: formData.items,
        });
      }

      await cargarCombos();
      toast.success(comboEditando ? 'Combo actualizado correctamente.' : 'Combo creado correctamente.');
      setComboEditando(null);
      if (window.innerWidth < 768) {
        document.getElementById('contenedor-scroll-combo')?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error guardando combo normal:', err);
      toast.error('Error al guardar el combo.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id) => {
    if (!(await confirmar('¿Eliminar este combo del menú?'))) return;
    try {
      await api.patch(`/productos/${id}/`, { activo: false });
      if (comboEditando?.id === id) setComboEditando(null);
      await cargarCombos();
    } catch (err) {
      console.error('Error eliminando combo:', err);
      toast.error('Error al eliminar el combo.');
    }
  };

  const abrirNuevo = () => {
    setComboEditando(null);
    if (window.innerWidth < 768) {
      document.getElementById('form-combo')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const abrirEdicion = (combo) => {
    setComboEditando(combo);
    if (window.innerWidth < 768) {
      document.getElementById('form-combo')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[110] p-0 sm:p-4 animate-fadeIn">
      <div className={`w-full max-w-6xl h-full sm:h-[88vh] rounded-none sm:rounded-[2.5rem] shadow-2xl border overflow-hidden flex flex-col ${
        isDark ? 'bg-[#0d0d0d] border-[#222]' : 'bg-white border-gray-200'
      }`}>

        {/* CABECERA */}
        <div className={`p-5 md:p-8 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-[#222] bg-[#111]' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ backgroundColor: `${colorPrimario}15`, color: colorPrimario }}>
              <i className="fi fi-rr-layers text-xl md:text-2xl mt-1"></i>
            </div>
            <div>
              <h2 className={`text-lg md:text-2xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Combos del Menú
              </h2>
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-0.5 md:mt-1 text-neutral-500 line-clamp-1">
                Arma promociones con tus platos
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

        <div id="contenedor-scroll-combo" className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

          {/* LISTADO IZQUIERDA */}
          <div className={`w-full md:w-2/5 p-5 md:p-6 border-b md:border-b-0 md:border-r md:overflow-y-auto shrink-0 md:shrink ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
            <div className="flex justify-between items-center mb-4 px-1 md:px-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                Existentes ({combos.length})
              </h4>
              <button
                onClick={abrirNuevo}
                disabled={!comboEditando}
                style={comboEditando ? { backgroundColor: colorPrimario } : {}}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  comboEditando
                    ? 'text-white shadow-md hover:scale-105'
                    : `cursor-not-allowed ${isDark ? 'bg-[#1a1a1a] text-neutral-600' : 'bg-gray-100 text-gray-400'}`
                }`}
              >
                <i className="fi fi-rr-add"></i> Nuevo
              </button>
            </div>

            {combos.length > 0 && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <i className="fi fi-rr-search text-xs text-neutral-500 shrink-0"></i>
                <input type="text" placeholder="Buscar combo..." value={busquedaCombo}
                  onChange={e => setBusquedaCombo(e.target.value)}
                  className={`flex-1 bg-transparent outline-none text-sm font-bold ${isDark ? 'text-white placeholder:text-neutral-600' : 'text-gray-900 placeholder:text-gray-400'}`} />
                {busquedaCombo && (
                  <button onClick={() => setBusquedaCombo('')} className={isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'}>
                    <i className="fi fi-rr-cross-small"></i>
                  </button>
                )}
              </div>
            )}

            {cargando ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: colorPrimario }} />
              </div>
            ) : combos.length === 0 ? (
              <div className={`p-6 md:p-8 text-center rounded-2xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <i className={`fi fi-rr-layers text-3xl mb-3 block ${isDark ? 'text-neutral-600' : 'text-gray-300'}`}></i>
                <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Sin combos creados</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Crea el primero completando el formulario de la derecha</p>
              </div>
            ) : combosFiltrados.length === 0 ? (
              <div className={`p-6 md:p-8 text-center rounded-2xl border ${isDark ? 'bg-[#141414] border-[#222]' : 'bg-gray-50 border-gray-100'}`}>
                <p className={`text-sm font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>Sin resultados para "{busquedaCombo}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {combosFiltrados.map(combo => {
                  const seleccionado = comboEditando?.id === combo.id;
                  return (
                    <div
                      key={combo.id}
                      onClick={() => abrirEdicion(combo)}
                      className={`rounded-2xl border overflow-hidden cursor-pointer transition-all ${
                        seleccionado ? '' : isDark ? 'bg-[#141414] border-[#222] hover:border-[#444]' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                      }`}
                      style={seleccionado ? { borderColor: colorPrimario, backgroundColor: `${colorPrimario}0d` } : {}}
                    >
                      <div className={`h-20 flex items-center justify-center relative ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-100'}`}>
                        {combo.imagen
                          ? <img src={combo.imagen} alt={combo.nombre} className="w-full h-full object-cover" />
                          : <i className="fi fi-rr-layers text-2xl opacity-20"></i>
                        }
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEliminar(combo.id); }}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/50 text-white/80 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                          title="Eliminar combo"
                        >
                          <i className="fi fi-rr-trash text-[10px]"></i>
                        </button>
                      </div>
                      <div className="p-2.5">
                        <p className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{combo.nombre}</p>
                        <p className="text-[11px] font-black mt-0.5" style={{ color: colorPrimario }}>
                          S/ {parseFloat(combo.precio_base).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FORMULARIO DERECHA */}
          <div id="form-combo" className="w-full md:w-3/5 p-5 md:p-6 md:overflow-hidden shrink-0 md:shrink flex flex-col min-h-0">
            <FormularioCombo
              key={comboEditando?.id ?? 'nuevo'}
              combo={comboEditando}
              isDark={isDark}
              colorPrimario={colorPrimario}
              productosReales={productosReales}
              categoriasReales={categoriasReales}
              onGuardar={handleGuardar}
              onCancelar={abrirNuevo}
              guardando={guardando}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
