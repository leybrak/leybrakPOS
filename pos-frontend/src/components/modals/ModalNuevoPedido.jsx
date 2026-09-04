import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Truck, Building2 } from 'lucide-react';
import { crearOrdenCompra, solicitarOrdenCompra, crearProveedor } from '../../api/api';

const lineaVacia = () => ({ insumo_base: '', cantidad_pedida: '', costo_unitario_referencial: '' });

export default function ModalNuevoPedido({
  isOpen, onClose, onSuccess, config,
  origen, sedes = [], catalogo = [], proveedores = [],
  sedeFija = null, lineasIniciales = null, onProveedorCreado,
}) {
  const colorBtn = config?.colorPrimario || '#ff5a1f';
  const esProveedor = origen === 'proveedor';

  const [proveedorId, setProveedorId] = useState('');
  const [sedeId, setSedeId] = useState(sedeFija ? String(sedeFija) : '');
  const [fechaEstimada, setFechaEstimada] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState([lineaVacia()]);
  const [guardando, setGuardando] = useState(false);

  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const [nuevoProvNombre, setNuevoProvNombre] = useState('');
  const [nuevoProvTelefono, setNuevoProvTelefono] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setProveedorId('');
    setSedeId(sedeFija ? String(sedeFija) : '');
    setFechaEstimada('');
    setNotas('');
    setCreandoProveedor(false);
    setNuevoProvNombre('');
    setNuevoProvTelefono('');
    if (lineasIniciales && lineasIniciales.length > 0) {
      setLineas(lineasIniciales.map(l => ({
        insumo_base: String(l.insumo_base),
        cantidad_pedida: l.cantidad_pedida != null ? String(l.cantidad_pedida) : '',
        costo_unitario_referencial: '',
      })));
    } else {
      setLineas([lineaVacia()]);
    }
  }, [isOpen, sedeFija, lineasIniciales]);

  if (!isOpen) return null;

  const updateLinea = (i, campo, valor) => {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l));
  };
  const addLinea = () => setLineas(prev => [...prev, lineaVacia()]);
  const removeLinea = (i) => setLineas(prev => prev.filter((_, idx) => idx !== i));

  const handleCrearProveedorInline = async () => {
    if (!nuevoProvNombre.trim()) return alert('Ponle un nombre al proveedor.');
    try {
      const res = await crearProveedor({ nombre: nuevoProvNombre, telefono: nuevoProvTelefono });
      onProveedorCreado?.(res.data);
      setProveedorId(String(res.data.id));
      setCreandoProveedor(false);
      setNuevoProvNombre('');
      setNuevoProvTelefono('');
    } catch (err) {
      alert('No se pudo crear el proveedor.');
    }
  };

  const lineasValidas = lineas.filter(l => l.insumo_base && parseFloat(l.cantidad_pedida) > 0);

  const construirPayload = () => ({
    origen,
    proveedor: esProveedor ? (proveedorId || null) : null,
    sede_destino: sedeId || null,
    sede_solicitante: !esProveedor ? (sedeId || null) : null,
    fecha_estimada: fechaEstimada || null,
    notas: notas || null,
    lineas: lineasValidas.map(l => ({
      insumo_base: l.insumo_base,
      cantidad_pedida: l.cantidad_pedida,
      costo_unitario_referencial: l.costo_unitario_referencial || 0,
    })),
  });

  const handleGuardar = async (solicitarInmediato) => {
    if (lineasValidas.length === 0) return alert('Agrega al menos un insumo con cantidad.');
    if (esProveedor && !proveedorId) return alert('Selecciona un proveedor.');
    if (!esProveedor && !sedeId) return alert('Selecciona la sede.');

    setGuardando(true);
    try {
      const res = await crearOrdenCompra(construirPayload());
      if (solicitarInmediato) {
        await solicitarOrdenCompra(res.data.id);
      }
      alert(solicitarInmediato ? '📨 Pedido solicitado.' : '💾 Pedido guardado como borrador.');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Error al guardar el pedido.';
      alert(msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] flex items-center justify-center p-4 md:p-6 animate-fadeIn">
      <div className="bg-[#111] border border-[#222] w-full max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">

        <div className="p-8 border-b border-[#222] flex justify-between items-center bg-[#161616] shrink-0">
          <div>
            <p className="text-[10px] text-[#ff5a1f] font-black uppercase tracking-widest mb-1">
              {esProveedor ? 'Compra a Proveedor' : 'Reabastecimiento Interno'}
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              {esProveedor ? <Truck size={26} /> : <Building2 size={26} />} Nuevo Pedido
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-4xl font-light transition-colors">×</button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {esProveedor ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">Proveedor</label>
                {!creandoProveedor ? (
                  <>
                    <select
                      value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-[#333] px-5 py-4 rounded-2xl text-white font-bold focus:border-[#ff5a1f] outline-none appearance-none cursor-pointer"
                    >
                      <option value="">Selecciona un proveedor...</option>
                      {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <button
                      type="button" onClick={() => setCreandoProveedor(true)}
                      className="text-xs text-neutral-400 hover:text-white font-bold flex items-center gap-1 pl-2"
                    >
                      <Plus size={14} /> Nuevo proveedor
                    </button>
                  </>
                ) : (
                  <div className="bg-[#0a0a0a] border border-[#333] rounded-2xl p-4 space-y-2">
                    <input
                      placeholder="Nombre del proveedor" value={nuevoProvNombre} onChange={(e) => setNuevoProvNombre(e.target.value)}
                      className="w-full bg-[#161616] border border-[#333] px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-[#ff5a1f]"
                    />
                    <input
                      placeholder="WhatsApp (ej. 987654321)" value={nuevoProvTelefono} onChange={(e) => setNuevoProvTelefono(e.target.value)}
                      className="w-full bg-[#161616] border border-[#333] px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-[#ff5a1f]"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={handleCrearProveedorInline} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-xl text-sm">Guardar</button>
                      <button type="button" onClick={() => setCreandoProveedor(false)} className="px-4 text-neutral-400 hover:text-white text-sm">Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">
                {esProveedor ? 'Sede de destino (vacío = Matriz)' : 'Sede'}
              </label>
              <select
                value={sedeId} onChange={(e) => setSedeId(e.target.value)}
                disabled={!!sedeFija}
                className="w-full bg-[#0a0a0a] border border-[#333] px-5 py-4 rounded-2xl text-white font-bold focus:border-[#ff5a1f] outline-none appearance-none cursor-pointer disabled:opacity-60"
              >
                {esProveedor && <option value="">Almacén Central (Matriz)</option>}
                {!esProveedor && <option value="">Selecciona una sede...</option>}
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">Fecha estimada de entrega</label>
              <input
                type="date" value={fechaEstimada} onChange={(e) => setFechaEstimada(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] px-5 py-4 rounded-2xl text-white font-bold focus:border-[#ff5a1f] outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block">Notas</label>
              <input
                value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional"
                className="w-full bg-[#0a0a0a] border border-[#333] px-5 py-4 rounded-2xl text-white font-bold focus:border-[#ff5a1f] outline-none"
              />
            </div>
          </div>

          <div className="bg-[#161616] border border-[#2a2a2a] rounded-[2rem] p-6">
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Insumos a pedir</label>
              <button type="button" onClick={addLinea} className="text-xs text-[#ff5a1f] hover:text-white font-black flex items-center gap-1">
                <Plus size={14} /> Agregar línea
              </button>
            </div>

            <div className="space-y-3">
              {lineas.map((linea, i) => {
                const insumo = catalogo.find(c => String(c.id) === String(linea.insumo_base));
                return (
                  <div key={i} className="flex flex-col md:flex-row gap-2 items-stretch md:items-center bg-[#0a0a0a] border border-[#222] rounded-2xl p-3">
                    <select
                      value={linea.insumo_base} onChange={(e) => updateLinea(i, 'insumo_base', e.target.value)}
                      className="flex-1 bg-[#161616] border border-[#333] px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-[#ff5a1f]"
                    >
                      <option value="">Selecciona insumo...</option>
                      {catalogo.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    <input
                      type="number" min="0" placeholder="Cantidad" value={linea.cantidad_pedida}
                      onChange={(e) => updateLinea(i, 'cantidad_pedida', e.target.value)}
                      className="w-full md:w-32 bg-[#161616] border border-[#333] px-4 py-3 rounded-xl text-white text-sm text-right outline-none focus:border-[#ff5a1f]"
                    />
                    <span className="text-xs text-neutral-500 font-bold w-14 shrink-0">{insumo?.unidad_medida || ''}</span>
                    <button type="button" onClick={() => removeLinea(i)} className="text-neutral-500 hover:text-red-500 shrink-0 p-2">
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[#222] bg-[#161616] shrink-0 flex flex-col md:flex-row justify-end gap-3">
          <button
            onClick={() => handleGuardar(false)} disabled={guardando}
            className="px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-[#1a1a1a] hover:bg-[#222] text-neutral-300 border border-[#333] transition-all disabled:opacity-50"
          >
            Guardar Borrador
          </button>
          <button
            onClick={() => handleGuardar(true)} disabled={guardando}
            style={{ backgroundColor: colorBtn }}
            className="px-8 py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            Solicitar Ahora
          </button>
        </div>
      </div>
    </div>
  );
}
