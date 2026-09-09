import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2, Layers, UploadCloud, Save, CalendarDays,
  Plus, X, ChevronRight, Check, ShoppingBag, Search,
  AlertCircle, ChevronDown
} from 'lucide-react';
import api from '../../../api/api';
import { useConfirm } from '../../../context/ConfirmContext';

// ============================================================
// HELPERS
// ============================================================
const formatearRango = (inicio, fin) =>
  inicio === fin ? inicio : `${inicio} → ${fin}`;

const getPrecioMostrado = (producto) => {
  if (producto.requiere_seleccion) {
    const precios = producto.grupos_variacion
      ?.flatMap(g => g.opciones?.map(o => parseFloat(o.precio_adicional)) ?? []) ?? [];
    if (!precios.length) return 'S/ 0.00';
    const min = Math.min(...precios);
    const max = Math.max(...precios);
    return min === max ? `S/ ${min.toFixed(2)}` : `S/ ${min.toFixed(2)} – ${max.toFixed(2)}`;
  }
  if (producto.tiene_variaciones) {
    const vars = producto.variaciones ?? [];
    if (!vars.length) return `S/ ${parseFloat(producto.precio_base).toFixed(2)}`;
    const precios = vars.map(v => parseFloat(v.precio));
    return `S/ ${Math.min(...precios).toFixed(2)} – ${Math.max(...precios).toFixed(2)}`;
  }
  return `S/ ${parseFloat(producto.precio_base).toFixed(2)}`;
};

// ============================================================
// SUBCOMPONENTE: Modal de selección de opciones (requiere_seleccion)
// ============================================================
function ModalSeleccionOpcion({ producto, isDark, colorPrimario, onConfirmar, onCerrar }) {
  const [seleccionadas, setSeleccionadas] = useState({});

  const toggleOpcion = (grupoId, opcionId) => {
    const grupo = producto.grupos_variacion.find(g => g.id === grupoId);
    if (!grupo) return;
    if (grupo.seleccion_multiple) {
      setSeleccionadas(prev => {
        const actual = prev[grupoId] ?? [];
        return {
          ...prev,
          [grupoId]: actual.includes(opcionId)
            ? actual.filter(id => id !== opcionId)
            : [...actual, opcionId]
        };
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
    // Recoger todas las opciones seleccionadas (una por grupo obligatorio simple)
    const opcionId = Object.values(seleccionadas).find(v => !Array.isArray(v));
    onConfirmar({ opcionSeleccionadaId: opcionId ?? null });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCerrar} />
      <div className={`relative z-10 rounded-3xl w-full max-w-md shadow-2xl border ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}>
        <div className="p-6 border-b" style={{ borderColor: isDark ? '#222' : '#f0f0f0' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Elige presentación</p>
              <h3 className={`text-lg font-black mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{producto.nombre}</h3>
            </div>
            <button onClick={onCerrar} className="text-neutral-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
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
                    <button
                      key={opcion.id}
                      onClick={() => toggleOpcion(grupo.id, opcion.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? 'border-opacity-100 text-white'
                          : isDark ? 'border-[#333] hover:border-[#555]' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={isSelected ? { borderColor: colorPrimario, backgroundColor: colorPrimario + '22' } : {}}
                    >
                      <p className={`text-sm font-bold ${isSelected ? '' : isDark ? 'text-white' : 'text-gray-800'}`}
                         style={isSelected ? { color: colorPrimario } : {}}>
                        {opcion.nombre}
                      </p>
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
          <button
            onClick={confirmar}
            disabled={!puedeConfirmar}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            style={{ backgroundColor: colorPrimario }}
          >
            Añadir al combo
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: Modal de variaciones (tiene_variaciones)
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
    onConfirmar({ opcionSeleccionadaId: opcionId ?? null, variacionSeleccionadaId: null });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCerrar} />
      <div className={`relative z-10 rounded-3xl w-full max-w-md shadow-2xl border ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}>
        <div className="p-6 border-b" style={{ borderColor: isDark ? '#222' : '#f0f0f0' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-neutral-500">Elige variación</p>
              <h3 className={`text-lg font-black mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{producto.nombre}</h3>
            </div>
            <button onClick={onCerrar} className="text-neutral-500 hover:text-white transition-colors"><X size={20} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {producto.grupos_variacion?.map(grupo => (
            <div key={grupo.id}>
              <p className={`text-xs font-black uppercase tracking-widest mb-3 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                {grupo.nombre}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {grupo.opciones?.map(opcion => {
                  const sel = seleccionadas[grupo.id];
                  const isSelected = Array.isArray(sel) ? sel.includes(opcion.id) : sel === opcion.id;
                  return (
                    <button
                      key={opcion.id}
                      onClick={() => toggleOpcion(grupo.id, opcion.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected ? '' : isDark ? 'border-[#333] hover:border-[#555]' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={isSelected ? { borderColor: colorPrimario, backgroundColor: colorPrimario + '22' } : {}}
                    >
                      <p className="text-sm font-bold" style={isSelected ? { color: colorPrimario } : { color: isDark ? 'white' : '#111' }}>
                        {opcion.nombre}
                      </p>
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
          <button
            onClick={confirmar}
            disabled={!haySeleccion}
            className="w-full py-3.5 rounded-xl font-black text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            style={{ backgroundColor: colorPrimario }}
          >
            Añadir variante al combo
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: ProductCard para el selector
// ============================================================
function ProductCardSelector({ producto, isDark, colorPrimario, onClickCard, onClickVariaciones, yaAgregado }) {
  const esConVariaciones = producto.tiene_variaciones && producto.grupos_variacion?.length > 0;

  return (
    <div className={`relative rounded-2xl border overflow-hidden transition-all ${
      yaAgregado ? 'ring-2' : isDark ? 'border-[#2a2a2a] hover:border-[#444]' : 'border-gray-200 hover:border-gray-300'
    }`}
    style={yaAgregado ? { borderColor: colorPrimario } : {}}
    >
      {/* Imagen */}
      <div
        className="w-full h-20 flex items-center justify-center relative cursor-pointer"
        style={{ backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5' }}
        onClick={() => onClickCard(producto)}
      >
        {producto.imagen
          ? <img src={producto.imagen} alt={producto.nombre} className="w-full h-full object-cover" />
          : <ShoppingBag size={24} className="opacity-20" />
        }
        {yaAgregado && (
          <div className="absolute inset-0 flex items-center justify-center"
               style={{ backgroundColor: colorPrimario + '33' }}>
            <Check size={22} style={{ color: colorPrimario }} strokeWidth={3} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2 cursor-pointer" onClick={() => onClickCard(producto)}>
        <p className={`text-xs font-bold leading-tight truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>
          {producto.nombre}
        </p>
        <p className="text-[10px] font-bold mt-0.5" style={{ color: colorPrimario }}>
          {getPrecioMostrado(producto)}
        </p>
        {producto.requiere_seleccion && producto.grupos_variacion?.length > 0 && (
          <span className="text-[9px] text-blue-400 font-bold">Elige presentación</span>
        )}
      </div>

      {/* Botón variaciones — solo para tiene_variaciones */}
      {esConVariaciones && (
        <button
          onClick={(e) => { e.stopPropagation(); onClickVariaciones(producto); }}
          className={`w-full text-[9px] font-black uppercase tracking-widest py-1.5 border-t transition-colors ${
            isDark ? 'border-[#2a2a2a] text-purple-400 hover:bg-[#222] hover:text-purple-300' : 'border-gray-100 text-purple-500 hover:bg-purple-50'
          }`}
        >
          Variaciones ↕
        </button>
      )}
    </div>
  );
}

// ============================================================
// SUBCOMPONENTE: Modal principal de combo
// ============================================================
function ModalCombo({ combo, isDark, colorPrimario, productosReales, sedesReales, categoriasReales, onGuardar, onCerrar, guardando }) {
  const [paso, setPaso] = useState('info'); // 'info' | 'productos'
  const [form, setForm] = useState({
    nombre: combo?.nombre ?? '',
    precio: combo?.precio ?? '',
    sede: combo?.sede ?? null,
    rangos_fechas: combo?.rangos_fechas ?? [],
    items: combo?.items?.map(i => ({
      productoId: i.producto,
      cantidad: i.cantidad,
      opcionSeleccionadaId: i.opcion_seleccionada ?? null,
      variacionSeleccionadaId: i.variacion_seleccionada ?? null,
      _nombre: i.producto_detalle?.nombre ?? '',
    })) ?? [],
  });
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [modalOpcion, setModalOpcion] = useState(null);   // producto que requiere selección
  const [modalVariacion, setModalVariacion] = useState(null); // producto con variaciones

  const agregarRango = () => {
    if (!fechaInicio) return;
    const fin = fechaFin || fechaInicio;
    if (new Date(fin) < new Date(fechaInicio)) return;
    setForm(f => ({ ...f, rangos_fechas: [...f.rangos_fechas, { inicio: fechaInicio, fin }] }));
    setFechaInicio(''); setFechaFin('');
  };

  const eliminarRango = (idx) =>
    setForm(f => ({ ...f, rangos_fechas: f.rangos_fechas.filter((_, i) => i !== idx) }));

  const productosFiltrados = productosReales.filter(p => {
    // Excluir combos de la selección
    if (p.es_combo) return false;
    const matchCat = categoriaFiltro === 'todas' || String(p.categoria) === String(categoriaFiltro);
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBusq;
  });

  const handleClickCard = (producto) => {
  if (producto.requiere_seleccion && producto.grupos_variacion?.length > 0) {
    setModalOpcion(producto);
  } else {
    // Normal y tiene_variaciones → añade base directo
    agregarProductoAlCombo(producto, {});
  }
};

  const handleClickVariaciones = (producto) => {
    setModalVariacion(producto);
  };

  const agregarProductoAlCombo = (producto, extras) => {
    const nuevoItem = {
      productoId: producto.id,
      cantidad: 1,
      opcionSeleccionadaId: extras.opcionSeleccionadaId ?? null,
      variacionSeleccionadaId: extras.variacionSeleccionadaId ?? null,
      _nombre: producto.nombre,
    };
    setForm(f => ({ ...f, items: [...f.items, nuevoItem] }));
    setModalOpcion(null);
    setModalVariacion(null);
  };

  const quitarItem = (idx) =>
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const cambiarCantidad = (idx, delta) =>
    setForm(f => ({
      ...f,
      items: f.items.map((it, i) =>
        i === idx ? { ...it, cantidad: Math.max(1, it.cantidad + delta) } : it
      )
    }));

  const validarInfo = () => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio.';
    if (!form.precio || parseFloat(form.precio) <= 0) return 'El precio debe ser mayor a 0.';
    if (form.rangos_fechas.length === 0) return 'Agrega al menos un rango de fechas.';
    return null;
  };

  const handleGuardar = () => {
    if (form.items.length === 0) return alert('Agrega al menos un producto al combo.');
    onGuardar({
      nombre: form.nombre,
      precio: parseFloat(form.precio),
      sede: form.sede || null,
      rangos_fechas: form.rangos_fechas,
      items: form.items,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCerrar} />
        <div className={`relative z-10 rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl border overflow-hidden ${isDark ? 'bg-[#0d0d0d] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
               style={{ borderColor: isDark ? '#1e1e1e' : '#f0f0f0' }}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                {combo ? 'Editando campaña' : 'Nueva campaña'}
              </p>
              <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {form.nombre || 'Sin nombre'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Steps */}
              <div className="flex items-center gap-1 text-xs font-bold">
                <button
                  onClick={() => setPaso('info')}
                  className="px-3 py-1.5 rounded-lg transition-all"
                  style={paso === 'info' ? { backgroundColor: colorPrimario, color: 'white' } : { color: isDark ? '#666' : '#aaa' }}
                >
                  1. Info
                </button>
                <ChevronRight size={12} className="text-neutral-600" />
                <button
                  onClick={() => { const err = validarInfo(); if (err) return alert(err); setPaso('productos'); }}
                  className="px-3 py-1.5 rounded-lg transition-all"
                  style={paso === 'productos' ? { backgroundColor: colorPrimario, color: 'white' } : { color: isDark ? '#666' : '#aaa' }}
                >
                  2. Productos
                </button>
              </div>
              <button onClick={onCerrar} className="text-neutral-500 hover:text-white transition-colors ml-2">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

            {/* ======================== */}
            {/* PASO 1: INFO             */}
            {/* ======================== */}
            {paso === 'info' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block mb-2">
                      Nombre de la campaña *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Especial Día de la Madre"
                      value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                      className={`w-full px-4 py-3 rounded-xl outline-none text-sm font-bold border ${
                        isDark ? 'bg-[#111] border-[#333] text-white focus:border-[#ff5a1f]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-[#ff5a1f]'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block mb-2">
                      Precio del combo (S/) *
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={form.precio}
                      onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                      className={`w-full px-4 py-3 rounded-xl outline-none text-lg font-black font-mono border ${
                        isDark ? 'bg-[#111] border-[#333] text-white focus:border-green-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-green-500'
                      }`}
                    />
                  </div>
                </div>
                {/* Sede */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block mb-2">
                    Aplica en
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setForm(f => ({ ...f, sede: null }))}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-all ${
                        form.sede === null ? 'text-white' : isDark ? 'border-[#333] text-neutral-500' : 'border-gray-200 text-gray-500'
                      }`}
                      style={form.sede === null ? { backgroundColor: colorPrimario, borderColor: colorPrimario } : {}}>
                      Todas las sedes
                    </button>
                    {sedesReales.map(sede => (
                      <button key={sede.id}
                        onClick={() => setForm(f => ({ ...f, sede: sede.id }))}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-all ${
                          String(form.sede) === String(sede.id) ? 'text-white' : isDark ? 'border-[#333] text-neutral-500' : 'border-gray-200 text-gray-500'
                        }`}
                        style={String(form.sede) === String(sede.id) ? { backgroundColor: colorPrimario, borderColor: colorPrimario } : {}}>
                        {sede.nombre}
                      </button>
                    ))}
                  </div>
                </div>      
                {/* Fechas */}
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2 mb-4">
                    <CalendarDays size={13} /> Rangos de fechas *
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <div className="flex-1">
                      <p className={`text-[9px] font-bold uppercase mb-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Desde</p>
                      <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold border outline-none ${isDark ? 'bg-[#1a1a1a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-[9px] font-bold uppercase mb-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Hasta (opcional)</p>
                      <input type="date" value={fechaFin} min={fechaInicio} onChange={e => setFechaFin(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-bold border outline-none ${isDark ? 'bg-[#1a1a1a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                    </div>
                    <div className="flex items-end">
                      <button onClick={agregarRango}
                        className="h-[34px] px-4 rounded-lg font-black text-white text-xs flex items-center gap-1 active:scale-95 transition-transform"
                        style={{ backgroundColor: colorPrimario }}>
                        <Plus size={14} /> Añadir
                      </button>
                    </div>
                  </div>

                  {form.rangos_fechas.length === 0 ? (
                    <p className="text-xs text-center italic text-neutral-500 py-3">Sin fechas configuradas</p>
                  ) : (
                    <div className="space-y-2">
                      {form.rangos_fechas.map((r, i) => (
                        <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-bold ${isDark ? 'bg-[#1a1a1a] border-[#2a2a2a] text-neutral-300' : 'bg-white border-gray-200 text-gray-700'}`}>
                          <span>{formatearRango(r.inicio, r.fin)}</span>
                          <button onClick={() => eliminarRango(i)} className="text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => { const err = validarInfo(); if (err) return alert(err); setPaso('productos'); }}
                    className="px-6 py-3 rounded-xl font-black text-sm text-white flex items-center gap-2 active:scale-95 transition-all"
                    style={{ backgroundColor: colorPrimario }}
                  >
                    Siguiente → Armar combo
                  </button>
                </div>
              </div>
            )}

            {/* ======================== */}
            {/* PASO 2: PRODUCTOS        */}
            {/* ======================== */}
            {paso === 'productos' && (
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {/* Columna izquierda: items seleccionados */}
                <div className={`w-full md:w-[280px] shrink-0 border-r flex flex-col ${isDark ? 'border-[#1e1e1e]' : 'border-gray-100'}`}>
                  <div className="p-4 border-b shrink-0" style={{ borderColor: isDark ? '#1e1e1e' : '#f0f0f0' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                      Productos del combo ({form.items.length})
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {form.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center py-10">
                        <ShoppingBag size={32} className="opacity-20 mb-3" />
                        <p className={`text-xs font-bold ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                          Selecciona productos<br />desde el panel derecho
                        </p>
                      </div>
                    ) : (
                      form.items.map((item, idx) => {
                        const prod = productosReales.find(p => String(p.id) === String(item.productoId));
                        return (
                          <div key={idx} className={`flex items-center gap-2 p-2 rounded-xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{item._nombre}</p>
                              {item.opcionSeleccionadaId && (
                                <p className="text-[10px] text-blue-400">Con opción seleccionada</p>
                              )}
                              {item.variacionSeleccionadaId && (
                                <p className="text-[10px] text-purple-400">Variación específica</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => cambiarCantidad(idx, -1)}
                                className={`w-6 h-6 rounded-lg font-black text-xs transition-colors ${isDark ? 'bg-[#222] text-white hover:bg-[#333]' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                −
                              </button>
                              <span className={`text-xs font-black w-5 text-center ${isDark ? 'text-white' : 'text-gray-800'}`}>{item.cantidad}</span>
                              <button onClick={() => cambiarCantidad(idx, 1)}
                                className={`w-6 h-6 rounded-lg font-black text-xs transition-colors ${isDark ? 'bg-[#222] text-white hover:bg-[#333]' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                +
                              </button>
                            </div>
                            <button onClick={() => quitarItem(idx)} className="text-red-400 hover:text-red-300 shrink-0">
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Botón guardar */}
                  <div className="p-4 border-t shrink-0" style={{ borderColor: isDark ? '#1e1e1e' : '#f0f0f0' }}>
                    <button
                      onClick={handleGuardar}
                      disabled={guardando || form.items.length === 0}
                      className="w-full py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: colorPrimario }}
                    >
                      <Save size={15} strokeWidth={3} />
                      {guardando ? 'Guardando...' : combo ? 'Actualizar' : 'Guardar combo'}
                    </button>
                  </div>
                </div>

                {/* Columna derecha: selector de productos */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Búsqueda */}
                  <div className="p-3 space-y-2 border-b shrink-0" style={{ borderColor: isDark ? '#1e1e1e' : '#f0f0f0' }}>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
                      <Search size={14} className="text-neutral-500 shrink-0" />
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        className="flex-1 bg-transparent outline-none text-xs font-bold text-white placeholder:text-neutral-600"
                      />
                    </div>

                    {/* Filtro categorías */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      <button
                        onClick={() => setCategoriaFiltro('todas')}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                          categoriaFiltro === 'todas'
                            ? 'text-white'
                            : isDark ? 'bg-[#1a1a1a] text-neutral-500 hover:bg-[#222]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                        style={categoriaFiltro === 'todas' ? { backgroundColor: colorPrimario } : {}}
                      >
                        Todas
                      </button>
                      {categoriasReales.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setCategoriaFiltro(String(cat.id))}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                            categoriaFiltro === String(cat.id)
                              ? 'text-white'
                              : isDark ? 'bg-[#1a1a1a] text-neutral-500 hover:bg-[#222]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                          style={categoriaFiltro === String(cat.id) ? { backgroundColor: colorPrimario } : {}}
                        >
                          {cat.nombre}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid de productos */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {productosFiltrados.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <AlertCircle size={28} className="opacity-20 mb-2" />
                        <p className={`text-xs font-bold ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>Sin productos</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                        {productosFiltrados.map(p => {
                          const yaAgregado = form.items.some(it => String(it.productoId) === String(p.id));
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: requiere_seleccion */}
      {modalOpcion && (
        <ModalSeleccionOpcion
          producto={modalOpcion}
          isDark={isDark}
          colorPrimario={colorPrimario}
          onConfirmar={(extras) => agregarProductoAlCombo(modalOpcion, extras)}
          onCerrar={() => setModalOpcion(null)}
        />
      )}

      {/* Modal: tiene_variaciones */}
      {modalVariacion && (
        <ModalVariaciones
          producto={modalVariacion}
          isDark={isDark}
          colorPrimario={colorPrimario}
          onConfirmar={(extras) => agregarProductoAlCombo(modalVariacion, extras)}
          onCerrar={() => setModalVariacion(null)}
        />
      )}
    </>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Crm_TabCombos({ isDark, colorPrimario, productosReales = [],sedesReales = [] ,categoriasReales = [] }) {
  const confirmar = useConfirm();
  const [combos, setCombos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [comboEditando, setComboEditando] = useState(null);
  
  // ── Carga inicial ──
  const cargarCombos = useCallback(async () => {
    try {
      setCargando(true);
      const { data } = await api.get('/combos-promocionales/');
      setCombos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando combos:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarCombos(); }, [cargarCombos]);

  // ── Guardar (crear o actualizar) ──
  const handleGuardar = async (formData) => {
    try {
      setGuardando(true);
      const payload = {
        nombre: formData.nombre,
        precio: formData.precio,
        sede: formData.sede || null,
        rangos_fechas: formData.rangos_fechas,
        items: formData.items.map(it => ({
          productoId: it.productoId,
          cantidad: it.cantidad,
          opcionSeleccionadaId: it.opcionSeleccionadaId ?? null,
          variacionSeleccionadaId: it.variacionSeleccionadaId ?? null,
        })),
      };

      if (comboEditando) {
        await api.put(`/combos-promocionales/${comboEditando.id}/`, payload);
      } else {
        await api.post('/combos-promocionales/', payload);
      }

      // 👈 Cerrar primero, recargar después
      setModalAbierto(false);
      setComboEditando(null);
      setGuardando(false);
      setTimeout(() => cargarCombos(), 100);

    } catch (err) {
      setGuardando(false);
      console.error('Error guardando combo:', err);
      alert('Hubo un error al guardar el combo. Intenta de nuevo.');
    }
    // 👈 Sin finally
  };

  // ── Eliminar ──
  const handleEliminar = async (id) => {
    if (!(await confirmar('Esta acción no se puede deshacer.', { titulo: '¿Eliminar esta campaña?', peligroso: true }))) return;
    try {
      await api.delete(`/combos-promocionales/${id}/`);
      await cargarCombos();
    } catch (err) {
      console.error('Error eliminando combo:', err);
    }
  };

  const abrirNuevo = () => { setComboEditando(null); setModalAbierto(true); };
  const abrirEdicion = (combo) => { setComboEditando(combo); setModalAbierto(true); };

  return (
    <div className={`rounded-[2rem] p-6 md:p-8 border ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200 shadow-sm'}`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-dashed" style={{ borderColor: isDark ? '#333' : '#e5e7eb' }}>
        <div>
          <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Combos Promocionales</h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            Crea paquetes estacionales y programa sus fechas de disponibilidad.
          </p>
        </div>
        <button
          onClick={abrirNuevo}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm text-white active:scale-95 transition-all shadow-lg"
          style={{ backgroundColor: colorPrimario }}
        >
          <Plus size={16} strokeWidth={3} /> Nuevo combo
        </button>
      </div>

      {/* Lista de combos */}
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: colorPrimario }} />
        </div>
      ) : combos.length === 0 ? (
        <div className={`text-center py-16 border-2 border-dashed rounded-3xl ${isDark ? 'border-[#2a2a2a] text-neutral-500' : 'border-gray-200 text-gray-400'}`}>
          <Layers size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold mb-1">No hay combos activos.</p>
          <p className="text-xs">Crea tu primer combo promocional.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {combos.map(combo => (
            <div
              key={combo.id}
              className={`rounded-2xl border overflow-hidden transition-all hover:border-opacity-80 ${isDark ? 'bg-[#0d0d0d] border-[#2a2a2a]' : 'bg-gray-50 border-gray-200'}`}
            >
              {/* Imagen */}
              <div className={`h-28 flex items-center justify-center ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-100'}`}>
                {combo.imagen
                  ? <img src={combo.imagen} alt={combo.nombre} className="w-full h-full object-cover" />
                  : <Layers size={32} className="opacity-20" />
                }
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className={`font-black text-sm leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{combo.nombre}</h4>
                  <span className="text-sm font-black shrink-0" style={{ color: colorPrimario }}>
                    S/ {parseFloat(combo.precio).toFixed(2)}
                  </span>
                </div>

                {/* Fechas */}
                <div className="space-y-1 mb-3">
                  {combo.rangos_fechas?.map((r, i) => (
                    <div key={i} className={`text-[10px] font-bold flex items-center gap-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                      <CalendarDays size={10} /> {formatearRango(r.inicio, r.fin)}
                    </div>
                  ))}
                </div>
                <div className={`text-[10px] font-bold ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                  {combo.sede_nombre ? `📍 ${combo.sede_nombre}` : 'Todas las sedes'}
                </div>
                {/* Items */}
                <div className={`text-[10px] font-bold mb-4 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                  {combo.items?.length ?? 0} producto{(combo.items?.length ?? 0) !== 1 ? 's' : ''}
                </div>

                {/* Acciones */}
                <div className="flex gap-2">
                  <button
                    onClick={() => abrirEdicion(combo)}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-colors ${isDark ? 'bg-[#1a1a1a] text-white hover:bg-[#222]' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminar(combo.id)}
                    className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <ModalCombo
          combo={comboEditando}
          isDark={isDark}
          colorPrimario={colorPrimario}
          productosReales={productosReales}
          categoriasReales={categoriasReales}
          onGuardar={handleGuardar}
          sedesReales={sedesReales}
          onCerrar={() => { setModalAbierto(false); setComboEditando(null); }}
          guardando={guardando}
        />
      )}
    </div>
  );
}