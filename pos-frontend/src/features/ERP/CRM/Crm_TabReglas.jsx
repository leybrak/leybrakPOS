import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Trash2, Pencil, Save, Package, Bike, Calendar, CreditCard, Users, Moon, Settings } from 'lucide-react';
import api from '../../../api/api';
import { useConfirm } from '../../../context/ConfirmContext';

const DIAS_NOMBRES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const TIPOS_PREDEFINIDOS = [
  { value: 'recargo_llevar', label: 'Recargo por empaque (Llevar)', icon: Package },
  { value: 'delivery_gratis', label: 'Delivery Gratis por Monto', icon: Bike },
  { value: 'descuento_dia', label: 'Descuento por Día Específico', icon: Calendar },
  { value: 'descuento_yape_efectivo', label: 'Descuento Yape/Efectivo', icon: CreditCard },
  { value: 'servicio_grupo_grande', label: 'Recargo Mesa Grande', icon: Users },
  { value: 'recargo_nocturno', label: 'Tarifa Nocturna', icon: Moon },
  { value: 'personalizada', label: 'Regla Personalizada', icon: Settings },
];

const FORM_INICIAL = {
  nombre: '',
  tipo: 'recargo_llevar',
  valor: '',
  es_porcentaje: false,
  monto_minimo_orden: '',
  dia_semana: '',
  condicion_tipo_orden: 'cualquiera',
  condicion_metodo_pago: 'cualquiera',
  condicion_hora_inicio: '',
  condicion_hora_fin: '',
  accion_aplica_a: 'orden',
  accion_es_descuento: false,
  accion_producto: null,
  accion_categoria: null,
  activa: true,
};

function FormRegla({ regla, isDark, colorPrimario, onGuardar, onCancelar, guardando }) {
  const [form, setForm] = useState(regla ? {
    ...FORM_INICIAL,
    ...regla,
    dia_semana: regla.dia_semana !== null && regla.dia_semana !== undefined ? regla.dia_semana : '',
    valor: regla.valor ?? '',
    monto_minimo_orden: regla.monto_minimo_orden ?? '',
  } : { ...FORM_INICIAL });

  const [avanzado, setAvanzado] = useState(false);

  const esPersonalizada = form.tipo === 'personalizada';

  const handleGuardar = () => {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio.');
    if (!form.valor && form.tipo !== 'delivery_gratis') return alert('El valor es obligatorio.');
    const payload = {
      nombre: form.nombre,
      tipo: form.tipo,
      valor: parseFloat(form.valor) || 0,
      es_porcentaje: form.es_porcentaje,
      monto_minimo_orden: parseFloat(form.monto_minimo_orden) || 0,
      dia_semana: form.dia_semana !== '' ? parseInt(form.dia_semana) : null,
      condicion_tipo_orden: form.condicion_tipo_orden,
      condicion_metodo_pago: form.condicion_metodo_pago,
      condicion_hora_inicio: form.condicion_hora_inicio || null,
      condicion_hora_fin: form.condicion_hora_fin || null,
      accion_aplica_a: form.accion_aplica_a,
      accion_es_descuento: form.accion_es_descuento,
      accion_producto: form.accion_producto || null,
      accion_categoria: form.accion_categoria || null,
      activa: form.activa,
    };
    onGuardar(payload);
  };

  const inputClass = `w-full px-4 py-3 rounded-xl outline-none text-sm font-bold border transition-colors ${
    isDark ? 'bg-[#0a0a0a] border-[#333] text-white focus:border-[#ff5a1f]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#ff5a1f]'
  }`;

  const labelClass = "text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-1.5";

  return (
    <div className={`p-6 rounded-2xl border animate-fadeIn space-y-5 ${isDark ? 'bg-[#161616] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
      <h4 className={`font-black uppercase tracking-widest text-xs ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
        {regla ? 'Editar Regla' : 'Nueva Regla de Negocio'}
      </h4>

      {/* Nombre */}
      <div>
        <label className={labelClass}>Nombre de la regla *</label>
        <input type="text" placeholder="Ej: Recargo para llevar S/2" value={form.nombre}
          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
          className={inputClass} />
      </div>

      {/* Tipo */}
      <div>
        <label className={labelClass}>Tipo de regla</label>
        <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={inputClass}>
          {TIPOS_PREDEFINIDOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Valor + porcentaje */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelClass}>
            {form.accion_es_descuento ? 'Valor a descontar' : 'Valor a cobrar'}{form.es_porcentaje ? ' (%)' : ' (S/)'}
          </label>
          <input type="number" min={0} placeholder={form.es_porcentaje ? 'Ej: 10' : 'Ej: 2.50'} value={form.valor}
            onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
            className={inputClass} />
        </div>
        <div className="flex flex-col justify-end pb-1 gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setForm(f => ({ ...f, es_porcentaje: !f.es_porcentaje }))}
              className={`w-8 h-4 rounded-full transition-colors relative flex items-center ${form.es_porcentaje ? 'bg-green-500' : isDark ? 'bg-neutral-600' : 'bg-gray-300'}`}>
              <div className={`w-3 h-3 bg-white rounded-full absolute transition-transform ${form.es_porcentaje ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-wide ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>%</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setForm(f => ({ ...f, accion_es_descuento: !f.accion_es_descuento }))}
              className={`w-8 h-4 rounded-full transition-colors relative flex items-center ${form.accion_es_descuento ? 'bg-blue-500' : isDark ? 'bg-neutral-600' : 'bg-gray-300'}`}>
              <div className={`w-3 h-3 bg-white rounded-full absolute transition-transform ${form.accion_es_descuento ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-wide ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Descuento</span>
          </label>
        </div>
      </div>

      {/* Monto mínimo y día */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Monto mínimo de orden (S/)</label>
          <input type="number" min={0} placeholder="0 = sin mínimo" value={form.monto_minimo_orden}
            onChange={e => setForm(f => ({ ...f, monto_minimo_orden: e.target.value }))}
            className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Día específico (opcional)</label>
          <select value={form.dia_semana} onChange={e => setForm(f => ({ ...f, dia_semana: e.target.value }))} className={inputClass}>
            <option value="">Todos los días</option>
            {DIAS_NOMBRES.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Condiciones avanzadas */}
      <button onClick={() => setAvanzado(v => !v)}
        className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-gray-400 hover:text-gray-600'}`}>
        {avanzado ? '▲' : '▼'} Condiciones avanzadas
        {(form.condicion_tipo_orden !== 'cualquiera' || form.condicion_metodo_pago !== 'cualquiera' || form.condicion_hora_inicio) && (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-black text-white" style={{ backgroundColor: colorPrimario }}>
            Activas
          </span>
        )}
      </button>

      {avanzado && (
        <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tipo de orden</label>
              <select value={form.condicion_tipo_orden} onChange={e => setForm(f => ({ ...f, condicion_tipo_orden: e.target.value }))} className={inputClass}>
                <option value="cualquiera">Cualquier tipo</option>
                <option value="salon">Solo Salón</option>
                <option value="llevar">Solo Para Llevar</option>
                <option value="delivery">Solo Delivery</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Método de pago</label>
              <select value={form.condicion_metodo_pago} onChange={e => setForm(f => ({ ...f, condicion_metodo_pago: e.target.value }))} className={inputClass}>
                <option value="cualquiera">Cualquier método</option>
                <option value="yape">Solo Yape</option>
                <option value="plin">Solo Plin</option>
                <option value="efectivo">Solo Efectivo</option>
                <option value="tarjeta">Solo Tarjeta</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Hora desde</label>
              <input type="time" value={form.condicion_hora_inicio}
                onChange={e => setForm(f => ({ ...f, condicion_hora_inicio: e.target.value }))}
                className={`${inputClass} text-center`} />
            </div>
            <div>
              <label className={labelClass}>Hora hasta</label>
              <input type="time" value={form.condicion_hora_fin}
                onChange={e => setForm(f => ({ ...f, condicion_hora_fin: e.target.value }))}
                className={`${inputClass} text-center`} />
            </div>
          </div>

          <div>
            <label className={labelClass}>La regla aplica a</label>
            <div className="flex gap-2">
              {[
                { value: 'orden', label: 'Toda la orden' },
                { value: 'categoria', label: 'Categoría' },
                { value: 'producto', label: 'Producto' },
              ].map(op => (
                <button key={op.value} onClick={() => setForm(f => ({ ...f, accion_aplica_a: op.value }))}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${form.accion_aplica_a === op.value ? 'text-white' : isDark ? 'border-[#333] text-neutral-500' : 'border-gray-200 text-gray-500'}`}
                  style={form.accion_aplica_a === op.value ? { backgroundColor: colorPrimario, borderColor: colorPrimario } : {}}>
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {(form.accion_aplica_a === 'categoria' || form.accion_aplica_a === 'producto') && (
            <p className={`text-[10px] italic ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
              La selección de {form.accion_aplica_a} se configura desde el módulo de menú.
            </p>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={onCancelar}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors ${isDark ? 'bg-[#222] text-white hover:bg-[#333]' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}>
          Cancelar
        </button>
        <button onClick={handleGuardar} disabled={guardando}
          className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-md active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-40"
          style={{ backgroundColor: colorPrimario }}>
          <Save size={13} strokeWidth={3} />
          {guardando ? 'Guardando...' : regla ? 'Actualizar' : 'Guardar Regla'}
        </button>
      </div>
    </div>
  );
}

export default function Crm_TabReglas({ isDark, colorPrimario }) {
  const confirmar = useConfirm();
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [editando, setEditando] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      const { data } = await api.get('/reglas-negocio-v2/');
      setLista(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando reglas:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = async (payload) => {
    try {
      setGuardando(true);
      if (editando) {
        await api.put(`/reglas-negocio-v2/${editando.id}/`, payload);
      } else {
        await api.post('/reglas-negocio-v2/', payload);
      }
      await cargar();
      setFormularioAbierto(false);
      setEditando(null);
    } catch (err) {
      console.error('Error guardando regla:', err);
      const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Error desconocido';
      alert(`Error: ${msg}`);
    } finally {
      setGuardando(false);
    }
  };

  const handleToggle = async (regla) => {
    try {
      await api.patch(`/reglas-negocio-v2/${regla.id}/`, { activa: !regla.activa });
      await cargar();
    } catch (err) {
      console.error('Error toggling regla:', err);
    }
  };

  const handleEliminar = async (id) => {
    if (!(await confirmar('¿Eliminar esta regla de negocio?', { titulo: 'Eliminar regla', peligroso: true }))) return;
    try {
      await api.delete(`/reglas-negocio-v2/${id}/`);
      await cargar();
    } catch (err) {
      console.error('Error eliminando regla:', err);
    }
  };

  const abrirNuevo = () => { setEditando(null); setFormularioAbierto(true); };
  const abrirEdicion = (regla) => { setEditando(regla); setFormularioAbierto(true); };

  const describir = (regla) => {
    const partes = [];
    if (regla.accion_es_descuento) partes.push('Descuento');
    else partes.push('Recargo');
    partes.push(regla.es_porcentaje ? `${regla.valor}%` : `S/ ${regla.valor}`);
    if (regla.condicion_tipo_orden !== 'cualquiera') partes.push(`en ${regla.condicion_tipo_orden}`);
    if (regla.condicion_metodo_pago !== 'cualquiera') partes.push(`pago ${regla.condicion_metodo_pago}`);
    if (parseFloat(regla.monto_minimo_orden) > 0) partes.push(`desde S/ ${regla.monto_minimo_orden}`);
    if (regla.dia_semana !== null && regla.dia_semana !== undefined) partes.push(`los ${DIAS_NOMBRES[regla.dia_semana]}`);
    return partes.join(' · ');
  };

  return (
    <div className={`rounded-[2rem] p-6 md:p-8 border ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200 shadow-sm'}`}>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8 pb-6 border-b border-dashed" style={{ borderColor: isDark ? '#333' : '#e5e7eb' }}>
        <div>
          <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Reglas de Negocio</h3>
          <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            Configura recargos, descuentos y condiciones automáticas.
          </p>
        </div>
        {!formularioAbierto && (
          <button onClick={abrirNuevo}
            className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-md active:scale-95 transition-transform flex items-center gap-2"
            style={{ backgroundColor: colorPrimario }}>
            <Plus size={16} strokeWidth={3} /> Nueva Regla
          </button>
        )}
      </div>

      {formularioAbierto ? (
        <FormRegla
          regla={editando}
          isDark={isDark}
          colorPrimario={colorPrimario}
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
          <Truck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-bold">Sin reglas configuradas.</p>
          <p className="text-xs mt-1">Crea reglas para automatizar cobros y descuentos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(regla => {
            const tipo = TIPOS_PREDEFINIDOS.find(t => t.value === regla.tipo);
            const IconRegla = tipo?.icon ?? Settings;
            return (
              <div key={regla.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors ${isDark ? 'bg-[#161616] border-[#333] hover:border-[#444]' : 'bg-white border-gray-200 shadow-sm hover:border-gray-300'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-[#222]' : 'bg-gray-100'}`}
                    style={{ color: colorPrimario }}>
                    <IconRegla size={18} />
                  </div>
                  <div>
                    <h5 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {regla.nombre || tipo?.label || regla.tipo}
                    </h5>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                      {describir(regla)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 sm:mt-0 flex items-center justify-end gap-3 shrink-0">
                  <button onClick={() => handleToggle(regla)}
                    className={`w-10 h-5 rounded-full transition-colors relative flex items-center ${regla.activa ? 'bg-green-500' : isDark ? 'bg-neutral-600' : 'bg-gray-300'}`}>
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute transition-transform ${regla.activa ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                  <button onClick={() => abrirEdicion(regla)} className={`p-2 transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'}`}>
                    <Pencil size={16} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => handleEliminar(regla.id)} className="text-red-500 hover:text-red-400 p-2">
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