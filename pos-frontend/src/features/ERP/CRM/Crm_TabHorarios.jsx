import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, Trash2, Pencil, Search, ShoppingBag, Check, CalendarDays, X, Save, Eye, Percent, Gift, DollarSign } from 'lucide-react';
import api from '../../../api/api';
import { useConfirm } from '../../../context/ConfirmContext';

const DIAS = [
  { id: 0, l: 'Lun' }, { id: 1, l: 'Mar' }, { id: 2, l: 'Mié' },
  { id: 3, l: 'Jue' }, { id: 4, l: 'Vie' }, { id: 5, l: 'Sáb' }, { id: 6, l: 'Dom' }
];

const TIPO_LABELS = {
  visibilidad: { icon: Eye, label: 'Solo Visibilidad' },
  precio_especial: { icon: DollarSign, label: 'Precio Especial' },
  porcentaje: { icon: Percent, label: 'Descuento %' },
  nx_y: { icon: Gift, label: 'Compra X Lleva Y' },
};

// ── Selector de productos tipo grid ──────────────────────────
function SelectorProducto({ productosReales, categoriasReales, isDark, colorPrimario, valor, onChange, label }) {
  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('todas');
  const [abierto, setAbierto] = useState(false);

  const productoSeleccionado = productosReales.find(p => String(p.id) === String(valor));
  const filtrados = productosReales.filter(p => {
    const matchCat = catFiltro === 'todas' || String(p.categoria) === String(catFiltro);
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBusq && !p.es_combo;
  });

  if (!abierto) {
    return (
      <div>
        {label && <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">{label}</label>}
        <button onClick={() => setAbierto(true)}
          className={`w-full px-3 py-2.5 rounded-xl border text-left text-sm font-bold transition-colors ${
            isDark ? 'bg-[#0a0a0a] border-[#333] text-white hover:border-[#555]' : 'bg-white border-gray-200 text-gray-900 hover:border-gray-300'
          }`}>
          {productoSeleccionado ? productoSeleccionado.nombre : <span className="text-neutral-500">Selecciona un producto...</span>}
        </button>
      </div>
    );
  }

  return (
    <div>
      {label && <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">{label}</label>}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#0a0a0a] border-[#333]' : 'bg-white border-gray-200'}`}>
        <div className={`p-3 border-b space-y-2 ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
            <Search size={12} className="text-neutral-500 shrink-0" />
            <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="flex-1 bg-transparent outline-none text-xs font-bold placeholder:text-neutral-600"
              style={{ color: isDark ? 'white' : '#111' }} autoFocus />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            <button onClick={() => setCatFiltro('todas')}
              className="shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all"
              style={catFiltro === 'todas' ? { backgroundColor: colorPrimario, color: 'white' } : { backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6', color: isDark ? '#666' : '#9ca3af' }}>
              Todas
            </button>
            {categoriasReales.map(cat => (
              <button key={cat.id} onClick={() => setCatFiltro(String(cat.id))}
                className="shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all"
                style={catFiltro === String(cat.id) ? { backgroundColor: colorPrimario, color: 'white' } : { backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6', color: isDark ? '#666' : '#9ca3af' }}>
                {cat.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 max-h-48 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2">
            {filtrados.map(p => {
              const sel = String(p.id) === String(valor);
              return (
                <button key={p.id} onClick={() => { onChange(p.id); setAbierto(false); }}
                  className={`rounded-xl border overflow-hidden text-left transition-all ${sel ? 'ring-2' : isDark ? 'border-[#2a2a2a] hover:border-[#444]' : 'border-gray-200 hover:border-gray-300'}`}
                  style={sel ? { borderColor: colorPrimario } : {}}>
                  <div className={`h-12 flex items-center justify-center relative ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-50'}`}>
                    {p.imagen ? <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" /> : <ShoppingBag size={16} className="opacity-20" />}
                    {sel && <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: colorPrimario + '33' }}><Check size={14} style={{ color: colorPrimario }} strokeWidth={3} /></div>}
                  </div>
                  <div className="p-1.5">
                    <p className={`text-[9px] font-bold truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>{p.nombre}</p>
                    <p className="text-[8px] font-bold" style={{ color: colorPrimario }}>S/ {parseFloat(p.precio_base).toFixed(2)}</p>
                    {(p.requiere_seleccion || p.tiene_variaciones) && (
                      <p className="text-[7px] text-blue-400 font-bold">Con opciones</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className={`p-2 border-t ${isDark ? 'border-[#222]' : 'border-gray-100'}`}>
          <button onClick={() => setAbierto(false)} className="w-full text-[9px] font-black uppercase tracking-widest text-neutral-500 hover:text-neutral-300 py-1">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-selector de opciones/presentaciones ───────────────────
function SelectorOpcion({ producto, isDark, colorPrimario, valorOpcion, onChangeOpcion }) {
  if (!producto) return null;
  const tieneOpciones = (producto.requiere_seleccion || producto.tiene_variaciones) &&
    producto.grupos_variacion?.length > 0;
  if (!tieneOpciones) return null;

  const todasLasOpciones = producto.grupos_variacion.flatMap(g =>
    (g.opciones || []).map(o => ({ ...o, grupo_nombre: g.nombre }))
  );

  return (
    <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
      <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
        Presentación / Variación que aplica
      </p>

      {/* Todas las presentaciones */}
      <button onClick={() => onChangeOpcion(null)}
        className={`w-full px-3 py-2.5 rounded-xl border-2 text-left text-xs font-bold transition-all flex items-center justify-between ${
          valorOpcion === null ? '' : isDark ? 'border-[#333] hover:border-[#555]' : 'border-gray-200 hover:border-gray-300'
        }`}
        style={valorOpcion === null ? { borderColor: colorPrimario, backgroundColor: colorPrimario + '15' } : {}}>
        <span style={valorOpcion === null ? { color: colorPrimario } : { color: isDark ? 'white' : '#111' }}>
          Todas las presentaciones
        </span>
        {valorOpcion === null && <Check size={13} style={{ color: colorPrimario }} />}
      </button>

      {/* Opciones específicas */}
      <div className="grid grid-cols-2 gap-2">
        {todasLasOpciones.map(opcion => {
          const sel = String(valorOpcion) === String(opcion.id);
          return (
            <button key={opcion.id} onClick={() => onChangeOpcion(opcion.id)}
              className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                sel ? '' : isDark ? 'border-[#333] hover:border-[#555]' : 'border-gray-200 hover:border-gray-300'
              }`}
              style={sel ? { borderColor: colorPrimario, backgroundColor: colorPrimario + '15' } : {}}>
              <p className="text-[10px] font-bold" style={sel ? { color: colorPrimario } : { color: isDark ? 'white' : '#111' }}>
                {opcion.nombre}
              </p>
              <p className={`text-[8px] ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                {opcion.grupo_nombre}
                {parseFloat(opcion.precio_adicional) > 0 && ` · +S/${parseFloat(opcion.precio_adicional).toFixed(2)}`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Formulario de Happy Hour ──────────────────────────────────
function FormHappyHour({ hh, isDark, colorPrimario, productosReales, sedesReales, categoriasReales, onGuardar, onCancelar, guardando }) {
  const [form, setForm] = useState({
    nombre: hh?.nombre ?? '',
    tipo_promo: hh?.tipo_promo ?? 'visibilidad',
    producto: hh?.producto ?? null,
    categoria: hh?.categoria ?? null,
    opcion_variacion: hh?.opcion_variacion ?? null,
    sede: hh?.sede ?? null,
    aplica_a: hh ? (hh.producto ? 'producto' : 'categoria') : 'producto',
    precio_especial: hh?.precio_especial ?? '',
    porcentaje_descuento: hh?.porcentaje_descuento ?? '',
    compra_x: hh?.compra_x ?? 2,
    lleva_y: hh?.lleva_y ?? 1,
    hora_inicio: hh?.hora_inicio ?? '',
    hora_fin: hh?.hora_fin ?? '',
    dias_permitidos: hh?.dias_permitidos ?? [],
    se_repite_semanalmente: hh?.se_repite_semanalmente ?? true,
    rangos_fechas: hh?.rangos_fechas ?? [],
    activa: hh?.activa ?? true,
  });

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const productoSeleccionado = productosReales.find(p => String(p.id) === String(form.producto));
  const productoTieneOpciones = productoSeleccionado &&
    (productoSeleccionado.requiere_seleccion || productoSeleccionado.tiene_variaciones) &&
    productoSeleccionado.grupos_variacion?.length > 0;

  const handleCambiarProducto = (id) => {
    setForm(f => ({ ...f, producto: id, opcion_variacion: null }));
  };

  const toggleDia = (id) => setForm(f => ({
    ...f,
    dias_permitidos: f.dias_permitidos.includes(id)
      ? f.dias_permitidos.filter(d => d !== id)
      : [...f.dias_permitidos, id]
  }));

  const agregarRango = () => {
    if (!fechaInicio) return;
    const fin = fechaFin || fechaInicio;
    setForm(f => ({ ...f, rangos_fechas: [...f.rangos_fechas, { inicio: fechaInicio, fin }] }));
    setFechaInicio(''); setFechaFin('');
  };

  const handleGuardar = () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio.');
    if (form.aplica_a === 'producto' && !form.producto) return alert('Selecciona un producto.');
    if (form.aplica_a === 'categoria' && !form.categoria) return alert('Selecciona una categoría.');
    if (form.tipo_promo === 'nx_y') {
      if (form.compra_x > 6) return alert('Compra X no puede ser mayor a 6.');
      if (form.lleva_y >= form.compra_x) return alert('Lleva Y debe ser menor que Compra X.');
    }
    const payload = {
      nombre: form.nombre,
      tipo_promo: form.tipo_promo,
      sede: form.sede || null,
      producto: form.aplica_a === 'producto' ? form.producto : null,
      categoria: form.aplica_a === 'categoria' ? form.categoria : null,
      opcion_variacion: (form.aplica_a === 'producto' && productoTieneOpciones)
        ? form.opcion_variacion
        : null,
      precio_especial: form.tipo_promo === 'precio_especial' ? form.precio_especial || null : null,
      porcentaje_descuento: form.tipo_promo === 'porcentaje' ? form.porcentaje_descuento || null : null,
      compra_x: form.compra_x,
      lleva_y: form.lleva_y,
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      dias_permitidos: form.dias_permitidos,
      se_repite_semanalmente: form.se_repite_semanalmente,
      rangos_fechas: form.se_repite_semanalmente ? [] : form.rangos_fechas,
      activa: form.activa,
    };
    onGuardar(payload);
  };

  return (
    <div className={`p-6 rounded-2xl border space-y-5 ${isDark ? 'bg-[#161616] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
      <h4 className={`font-black uppercase tracking-widest text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
        {hh ? 'Editar Happy Hour' : 'Nueva Happy Hour'}
      </h4>

      <div>
        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">Nombre *</label>
        <input type="text" placeholder="Ej: 2x1 Cervezas Martes" value={form.nombre}
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
          className={`w-full px-4 py-3 rounded-xl outline-none text-sm font-bold border ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white focus:border-[#ff5a1f]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#ff5a1f]'}`} />
      </div>

      <div>
        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">Tipo de Oferta</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(TIPO_LABELS).map(([key, val]) => {
            const IconTipo = val.icon;
            return (
              <button key={key} onClick={() => setForm(f => ({ ...f, tipo_promo: key }))}
                className={`p-3 rounded-xl border-2 text-left transition-all ${form.tipo_promo === key ? '' : isDark ? 'border-[#333] hover:border-[#555]' : 'border-gray-200 hover:border-gray-300'}`}
                style={form.tipo_promo === key ? { borderColor: colorPrimario, backgroundColor: colorPrimario + '15' } : {}}>
                <IconTipo size={18} style={form.tipo_promo === key ? { color: colorPrimario } : { color: isDark ? '#666' : '#999' }} />
                <p className="text-[9px] font-black uppercase tracking-wide mt-1.5" style={form.tipo_promo === key ? { color: colorPrimario } : { color: isDark ? '#888' : '#666' }}>
                  {val.label}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {form.tipo_promo === 'nx_y' && (
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">Compra X (máx 6)</label>
            <input type="number" min={2} max={6} value={form.compra_x}
              onChange={e => setForm(f => ({ ...f, compra_x: parseInt(e.target.value) || 2 }))}
              className={`w-full px-4 py-3 rounded-xl outline-none text-sm font-black border font-mono ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
          </div>
          <div className="flex-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">Lleva Y (gratis)</label>
            <input type="number" min={1} max={form.compra_x - 1} value={form.lleva_y}
              onChange={e => setForm(f => ({ ...f, lleva_y: parseInt(e.target.value) || 1 }))}
              className={`w-full px-4 py-3 rounded-xl outline-none text-sm font-black border font-mono ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
          </div>
          <div className={`pb-3 text-xs font-black shrink-0 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            = paga {form.compra_x - form.lleva_y}
          </div>
        </div>
      )}

      {form.tipo_promo === 'precio_especial' && (
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">Precio especial (S/)</label>
          <input type="number" placeholder="Ej: 15.00" value={form.precio_especial}
            onChange={e => setForm(f => ({ ...f, precio_especial: e.target.value }))}
            className={`w-full px-4 py-3 rounded-xl outline-none text-base font-black font-mono border ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
        </div>
      )}

      {form.tipo_promo === 'porcentaje' && (
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">Descuento (%)</label>
          <input type="number" min={1} max={100} placeholder="Ej: 20" value={form.porcentaje_descuento}
            onChange={e => setForm(f => ({ ...f, porcentaje_descuento: e.target.value }))}
            className={`w-full px-4 py-3 rounded-xl outline-none text-base font-black font-mono border ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
        </div>
      )}

      <div>
        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">Aplica a</label>
        <div className="flex gap-2 mb-3">
          {['producto', 'categoria'].map(op => (
            <button key={op}
              onClick={() => setForm(f => ({ ...f, aplica_a: op, producto: null, categoria: null, opcion_variacion: null }))}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide border transition-all ${form.aplica_a === op ? 'text-white' : isDark ? 'border-[#333] text-neutral-500' : 'border-gray-200 text-gray-500'}`}
              style={form.aplica_a === op ? { backgroundColor: colorPrimario, borderColor: colorPrimario } : {}}>
              {op === 'producto' ? 'Producto' : 'Categoría'}
            </button>
          ))}
        </div>

        {form.aplica_a === 'producto' ? (
          <div className="space-y-3">
            <SelectorProducto
              productosReales={productosReales}
              categoriasReales={categoriasReales}
              isDark={isDark}
              colorPrimario={colorPrimario}
              valor={form.producto}
              onChange={handleCambiarProducto}
              label=""
            />
            {productoTieneOpciones && (
              <SelectorOpcion
                producto={productoSeleccionado}
                isDark={isDark}
                colorPrimario={colorPrimario}
                valorOpcion={form.opcion_variacion}
                onChangeOpcion={(id) => setForm(f => ({ ...f, opcion_variacion: id }))}
              />
            )}
          </div>
        ) : (
          <select value={form.categoria || ''} onChange={e => setForm(f => ({ ...f, categoria: e.target.value || null }))}
            className={`w-full px-4 py-3 rounded-xl outline-none text-sm font-bold border ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
            <option value="">Selecciona categoría...</option>
            {categoriasReales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5 flex items-center gap-1">
            <Clock size={10} /> Hora inicio
          </label>
          <input type="time" value={form.hora_inicio} onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))}
            className={`w-full px-4 py-3 rounded-xl outline-none text-sm font-bold border text-center ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
        </div>
        <div>
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5 flex items-center gap-1">
            <Clock size={10} /> Hora fin
          </label>
          <input type="time" value={form.hora_fin} onChange={e => setForm(f => ({ ...f, hora_fin: e.target.value }))}
            className={`w-full px-4 py-3 rounded-xl outline-none text-sm font-bold border text-center ${isDark ? 'bg-[#0a0a0a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
        </div>
      </div>
        {/* Sede */}
      <div>
        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5">
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
      <div>
        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-2">Días permitidos</label>
        <div className="flex flex-wrap gap-2">
          {DIAS.map(dia => {
            const activo = form.dias_permitidos.includes(dia.id);
            return (
              <button key={dia.id} onClick={() => toggleDia(dia.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${activo ? 'text-white' : isDark ? 'border-[#333] text-neutral-500' : 'border-gray-200 text-gray-500'}`}
                style={activo ? { backgroundColor: colorPrimario, borderColor: colorPrimario } : {}}>
                {dia.l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setForm(f => ({ ...f, se_repite_semanalmente: !f.se_repite_semanalmente }))}
          className={`w-10 h-5 rounded-full transition-colors relative flex items-center shrink-0 ${form.se_repite_semanalmente ? 'bg-green-500' : isDark ? 'bg-neutral-600' : 'bg-gray-300'}`}>
          <div className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-transform ${form.se_repite_semanalmente ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
        <span className={`text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
          {form.se_repite_semanalmente ? 'Se repite semanalmente' : 'Solo en fechas específicas'}
        </span>
      </div>

      {!form.se_repite_semanalmente && (
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2 mb-3">
            <CalendarDays size={11} /> Rangos de fechas
          </label>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border outline-none ${isDark ? 'bg-[#1a1a1a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
            <input type="date" value={fechaFin} min={fechaInicio} onChange={e => setFechaFin(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border outline-none ${isDark ? 'bg-[#1a1a1a] border-[#333] text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
            <button onClick={agregarRango}
              className="px-4 py-2 rounded-lg font-black text-white text-xs flex items-center gap-1 active:scale-95"
              style={{ backgroundColor: colorPrimario }}>
              <Plus size={12} /> Añadir
            </button>
          </div>
          {form.rangos_fechas.map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-bold mb-1 ${isDark ? 'bg-[#1a1a1a] border-[#2a2a2a] text-neutral-300' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              <span>{r.inicio === r.fin ? r.inicio : `${r.inicio} → ${r.fin}`}</span>
              <button onClick={() => setForm(f => ({ ...f, rangos_fechas: f.rangos_fechas.filter((_, idx) => idx !== i) }))} className="text-red-400"><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancelar}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors ${isDark ? 'bg-[#222] text-white hover:bg-[#333]' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
          Cancelar
        </button>
        <button onClick={handleGuardar} disabled={guardando}
          className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-md active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-40"
          style={{ backgroundColor: colorPrimario }}>
          <Save size={13} strokeWidth={3} />
          {guardando ? 'Guardando...' : hh ? 'Actualizar' : 'Crear Happy Hour'}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function Crm_TabHorarios({ isDark, colorPrimario, productosReales = [], categoriasReales = [], sedesReales = [] }) {
  const confirmar = useConfirm();
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const { data } = await api.get('/happy-hours/');
      setLista(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando happy hours:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = async (payload) => {
    try {
      setGuardando(true);
      if (editando) {
        await api.put(`/happy-hours/${editando.id}/`, payload);
      } else {
        await api.post('/happy-hours/', payload);
      }
      setFormularioAbierto(false);
      setEditando(null);
      setGuardando(false);
      setTimeout(() => cargar(), 100);
    } catch (err) {
      setGuardando(false);
      const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Error desconocido';
      alert(`Error: ${msg}`);
    }
  };

  const handleToggle = async (hh) => {
    try {
      await api.patch(`/happy-hours/${hh.id}/`, { activa: !hh.activa });
      await cargar();
    } catch (err) { console.error('Error toggling:', err); }
  };

  const handleEliminar = async (id) => {
    if (!(await confirmar('¿Eliminar esta happy hour?', { titulo: 'Eliminar happy hour', peligroso: true }))) return;
    try {
      await api.delete(`/happy-hours/${id}/`);
      await cargar();
    } catch (err) { console.error('Error eliminando:', err); }
  };

  const abrirNuevo = () => { setEditando(null); setFormularioAbierto(true); };
  const abrirEdicion = (hh) => { setEditando(hh); setFormularioAbierto(true); };

  return (
    <div className={`rounded-[2rem] p-6 md:p-8 border ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8 pb-6 border-b border-dashed" style={{ borderColor: isDark ? '#333' : '#e5e7eb' }}>
        <div>
          <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Happy Hours & Ofertas</h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            Programa 2x1, precios especiales o visibilidad por horas y fechas.
          </p>
        </div>
        {!formularioAbierto && (
          <button onClick={abrirNuevo}
            className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-md active:scale-95 transition-transform flex items-center gap-2 shrink-0"
            style={{ backgroundColor: colorPrimario }}>
            <Plus size={16} strokeWidth={3} /> Nueva Oferta
          </button>
        )}
      </div>

      {formularioAbierto ? (
        <FormHappyHour
          hh={editando}
          isDark={isDark}
          colorPrimario={colorPrimario}
          productosReales={productosReales}
          categoriasReales={categoriasReales}
          sedesReales={sedesReales}
          onGuardar={handleGuardar}
          onCancelar={() => { setFormularioAbierto(false); setEditando(null); }}
          guardando={guardando}
        />
      ) : cargando ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: colorPrimario }} />
        </div>
      ) : lista.length === 0 ? (
        <div className={`text-center py-14 border-2 border-dashed rounded-2xl ${isDark ? 'border-[#333] text-neutral-500' : 'border-gray-200 text-gray-400'}`}>
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold">Sin ofertas configuradas.</p>
          <p className="text-xs mt-1">Crea happy hours para impulsar ventas en horas bajas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(hh => {
            const tipo = TIPO_LABELS[hh.tipo_promo] ?? { icon: Clock, label: hh.tipo_promo };
            const IconItem = tipo.icon;
            const objetivo = hh.producto_nombre || hh.categoria_nombre || '—';
            const diasLabel = hh.dias_permitidos?.length > 0
              ? hh.dias_permitidos.map(d => DIAS.find(x => x.id === d)?.l).join(', ')
              : 'Todos los días';

            return (
              <div key={hh.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors ${isDark ? 'bg-[#161616] border-[#333] hover:border-[#444]' : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-[#222]' : 'bg-gray-100'}`}
                    style={{ color: colorPrimario }}>
                    <IconItem size={18} />
                  </div>
                  <div>
                    <h5 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{hh.nombre}</h5>
                    <p className={`text-xs mt-0.5 flex flex-wrap gap-2 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                      <span style={{ color: colorPrimario }} className="font-bold">{tipo.label}</span>
                      <span>→ {objetivo}</span>
                      {hh.opcion_variacion && <span className="text-blue-400">· Presentación específica</span>}
                      <span>• {diasLabel}</span>
                      {hh.hora_inicio && <span>• {hh.hora_inicio} – {hh.hora_fin || 'cierre'}</span>}
                      {hh.tipo_promo === 'nx_y' && <span>• Compra {hh.compra_x} lleva {hh.lleva_y}</span>}
                      {hh.tipo_promo === 'precio_especial' && <span>• S/ {hh.precio_especial}</span>}
                      {hh.tipo_promo === 'porcentaje' && <span>• {hh.porcentaje_descuento}% off</span>}
                      
                      {/* 👈 Agrega esto al final */}
                      {hh.sede_nombre 
                        ? <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isDark ? 'bg-[#222] text-neutral-400' : 'bg-gray-100 text-gray-500'}`}>
                            📍 {hh.sede_nombre}
                          </span>
                        : <span className={`text-[9px] font-bold ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                            · Todas las sedes
                          </span>
                      }
                    </p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-0 flex items-center justify-end gap-3 shrink-0">
                  <button onClick={() => handleToggle(hh)}
                    className={`w-10 h-5 rounded-full transition-colors relative flex items-center ${hh.activa ? 'bg-green-500' : isDark ? 'bg-neutral-600' : 'bg-gray-300'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-transform ${hh.activa ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                  <button onClick={() => abrirEdicion(hh)} className={`p-2 transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'}`}>
                    <Pencil size={16} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => handleEliminar(hh.id)} className="text-red-500 hover:text-red-400 p-2">
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}