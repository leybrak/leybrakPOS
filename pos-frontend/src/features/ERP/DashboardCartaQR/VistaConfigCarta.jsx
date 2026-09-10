import React, { useState, useEffect, useRef } from 'react';
import { getSedes, actualizarSede } from '../../../api/api';
import Notificacion from '../../../components/common/Notificacion';

const OPCIONES = [
  {
    valor: 'propia',
    icon: 'fi-rr-picture',
    titulo: 'Nuestra Carta Digital',
    desc: 'El bot manda el link de la carta que armas en la pestaña Editor — la misma que ven tus clientes al escanear el QR.',
  },
  {
    valor: 'pdf',
    icon: 'fi-rr-file-pdf',
    titulo: 'PDF Propio',
    desc: 'Sube tu carta ya diseñada en PDF — el bot se la manda directo al cliente por WhatsApp.',
  },
  {
    valor: 'link',
    icon: 'fi-rr-link',
    titulo: 'Link Externo',
    desc: 'Pega un link a tu menú en Canva, Drive, Instagram, o donde lo tengas — el bot manda ese link.',
  },
];

export default function VistaConfigCarta({ esDueño, colorPrimario, isDark }) {
  const cardCls  = isDark ? 'bg-[#141414] border-[#222]' : 'bg-white border-gray-200 shadow-sm';
  const textCls  = isDark ? 'text-white' : 'text-gray-900';
  const labelCls = isDark ? 'text-neutral-500' : 'text-gray-500';
  const inputCls = isDark ? 'bg-[#1a1a1a] border-[#333] text-white outline-none' : 'bg-gray-50 border-gray-200 text-gray-900 outline-none';

  const sedeAsignada = localStorage.getItem('sede_id');
  const negocioId = localStorage.getItem('negocio_id');

  const [sedes, setSedes] = useState([]);
  const [sedeSeleccionada, setSedeSeleccionada] = useState(
    esDueño ? (localStorage.getItem('memoria_sede_carta_config') || '') : sedeAsignada
  );
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [notificacion, setNotificacion] = useState(null);

  const [modo, setModo] = useState('propia');
  const [linkExterno, setLinkExterno] = useState('');
  const [pdfActual, setPdfActual] = useState('');
  const [pdfNuevo, setPdfNuevo] = useState(null);
  const pdfRef = useRef(null);

  useEffect(() => {
    if (esDueño && sedeSeleccionada) {
      localStorage.setItem('memoria_sede_carta_config', sedeSeleccionada);
    }
  }, [sedeSeleccionada, esDueño]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await getSedes();
        if (!isMounted) return;
        setSedes(res.data);
        if (esDueño && res.data.length > 0) {
          setSedeSeleccionada(prev => prev ? prev : res.data[0].id);
        }
      } catch (error) {
        console.error('Error al cargar sedes:', error);
      } finally {
        if (isMounted) setCargando(false);
      }
    })();
    return () => { isMounted = false; };
  }, [esDueño]);

  useEffect(() => {
    const sede = sedes.find(s => String(s.id) === String(sedeSeleccionada));
    if (!sede) return;
    setModo(sede.carta_modo || 'propia');
    setLinkExterno(sede.enlace_carta_virtual || '');
    setPdfActual(sede.carta_pdf || '');
    setPdfNuevo(null);
  }, [sedeSeleccionada, sedes]);

  const guardar = async () => {
    if (!sedeSeleccionada) return;
    setGuardando(true);
    try {
      const form = new FormData();
      form.append('carta_modo', modo);
      if (modo === 'link') form.append('enlace_carta_virtual', linkExterno || '');
      if (modo === 'pdf' && pdfNuevo) form.append('carta_pdf', pdfNuevo);

      const res = await actualizarSede(sedeSeleccionada, form);
      setSedes(prev => prev.map(s => String(s.id) === String(sedeSeleccionada) ? res.data : s));
      setPdfNuevo(null);
      if (pdfRef.current) pdfRef.current.value = '';
      setNotificacion({ mensaje: '¡Carta actualizada!', tipo: 'success' });
    } catch (error) {
      console.error('Error al guardar la carta:', error);
      setNotificacion({ mensaje: 'No se pudo guardar. Intenta de nuevo.', tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const linkPropia = sedeSeleccionada
    ? `${window.location.origin}/menu/${negocioId}/${sedeSeleccionada}/0`
    : '';

  if (cargando) {
    return <div className={`text-sm ${labelCls}`}>Cargando…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {notificacion && (
        <Notificacion mensaje={notificacion.mensaje} tipo={notificacion.tipo} onClose={() => setNotificacion(null)} />
      )}

      {/* Selector de sede del dueño */}
      {esDueño && sedes.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className={`text-[10px] font-black uppercase tracking-widest ${labelCls}`}>Sede</span>
          <select
            value={sedeSeleccionada || ''}
            onChange={e => setSedeSeleccionada(e.target.value)}
            className={`w-full sm:w-64 text-xs font-bold px-4 py-2.5 rounded-xl border outline-none cursor-pointer ${inputCls}`}
          >
            {sedes.map(s => (
              <option key={s.id} value={s.id}>📍 {s.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Selector de modo */}
      <div className="space-y-3">
        <span className={`text-[10px] font-black uppercase tracking-widest ${labelCls}`}>
          ¿Qué le manda el bot al cliente cuando pide la carta?
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OPCIONES.map(op => {
            const activo = modo === op.valor;
            return (
              <button
                key={op.valor}
                onClick={() => setModo(op.valor)}
                className={`text-left p-4 rounded-2xl border transition-all ${cardCls} ${
                  activo ? 'ring-2' : 'opacity-70 hover:opacity-100'
                }`}
                style={activo ? { borderColor: colorPrimario, ['--tw-ring-color']: colorPrimario } : {}}
              >
                <i className={`fi ${op.icon} text-xl`} style={{ color: activo ? colorPrimario : undefined }} />
                <p className={`text-sm font-black mt-2 ${textCls}`}>{op.titulo}</p>
                <p className={`text-xs mt-1 leading-relaxed ${labelCls}`}>{op.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle según modo */}
      <div className={`p-5 rounded-2xl border ${cardCls}`}>
        {modo === 'propia' && (
          <div className="space-y-1">
            <span className={`text-[10px] font-black uppercase tracking-widest ${labelCls}`}>El bot va a mandar este link</span>
            <p className={`text-sm font-mono break-all ${textCls}`}>{linkPropia}</p>
          </div>
        )}

        {modo === 'link' && (
          <div className="space-y-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${labelCls}`}>Link de tu carta</span>
            <input
              type="url"
              value={linkExterno}
              onChange={e => setLinkExterno(e.target.value)}
              placeholder="https://..."
              className={`w-full text-sm px-4 py-2.5 rounded-xl border ${inputCls}`}
            />
          </div>
        )}

        {modo === 'pdf' && (
          <div className="space-y-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${labelCls}`}>Archivo PDF</span>
            {pdfActual && !pdfNuevo && (
              <a
                href={pdfActual}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold underline block"
                style={{ color: colorPrimario }}
              >
                Ver carta actual
              </a>
            )}
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf"
              onChange={e => setPdfNuevo(e.target.files?.[0] || null)}
              className={`w-full text-xs ${labelCls}`}
            />
          </div>
        )}
      </div>

      <button
        onClick={guardar}
        disabled={guardando || !sedeSeleccionada}
        className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-md disabled:opacity-50"
        style={{ backgroundColor: colorPrimario }}
      >
        {guardando ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}
