import React, { useState } from 'react';
import usePosStore from '../../../store/usePosStore';
import VistaQR from './VistaQR';
import VistaEditor from './VistaEditor';
import VistaConfigCarta from './VistaConfigCarta';

// ============================================================
// COMPONENTE PRINCIPAL (ORQUESTADOR)
// ============================================================
export default function DashboardCartaQR() {
  // ── Store Global ──
  const { configuracionGlobal } = usePosStore();
  const colorPrimario = configuracionGlobal?.colorPrimario || '#ff5a1f';
  const temaFondo     = configuracionGlobal?.temaFondo     || 'dark';
  const isDark        = temaFondo === 'dark';

  // ── Roles ──
  const rolUsuario  = localStorage.getItem('usuario_rol')?.toLowerCase() || '';
  const esDueño     = ['dueño', 'admin', 'administrador'].includes(rolUsuario.trim());
  const esDueñoQR   = rolUsuario.trim() === 'dueño';

  // ── Vista activa: 'qr' | 'editor' ──
  const [vista, setVista] = useState('qr');

  // ── Clases compartidas del layout ──
  const cardCls  = isDark ? 'bg-[#141414] border-[#222]' : 'bg-white border-gray-200 shadow-sm';
  const textCls  = isDark ? 'text-white' : 'text-gray-900';
  const labelCls = isDark ? 'text-neutral-500' : 'text-gray-500';

  return (
    <div className="animate-fadeIn space-y-6 pb-10 max-w-7xl mx-auto">
      
      {/* ═══ CABECERA ═══ */}
      <div
        className="flex flex-col md:flex-row justify-between md:items-center gap-6 pt-2 pb-6 border-b"
        style={{ borderColor: isDark ? '#222' : '#e5e7eb' }}
      >
        <div className="flex items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}
          >
            <i className={`fi ${vista === 'qr' ? 'fi-rr-qrcode' : vista === 'editor' ? 'fi-rr-picture' : 'fi-rr-file-pdf'} mt-1`} />
          </div>
          <div>
            <h2 className={`text-2xl font-black tracking-tight ${textCls}`}>
              {vista === 'qr'
                ? <><span style={{ color: colorPrimario }}>Carta</span> Digital QR</>
                : vista === 'editor'
                ? <>Editor de <span style={{ color: colorPrimario }}>Carta Digital</span></>
                : <><span style={{ color: colorPrimario }}>Carta</span> del Bot</>
              }
            </h2>
            <p className={`text-sm mt-1 ${labelCls}`}>
              {vista === 'qr'
                ? (esDueñoQR ? 'Gestiona los códigos QR de todas tus sedes.' : 'Genera los QR para las mesas de tu local.')
                : vista === 'editor'
                ? 'Personaliza el estilo visual que verán tus clientes al escanear el QR.'
                : 'Elige qué le manda el bot de WhatsApp al cliente cuando pide el menú.'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Toggle QR / Editor */}
          <div className={`flex gap-1 p-1.5 rounded-2xl border ${cardCls}`}>
            <button
              onClick={() => setVista('qr')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-transparent ${
                vista === 'qr'
                  ? 'text-white shadow-md'
                  : isDark ? 'text-neutral-500 hover:text-neutral-300 hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              style={vista === 'qr' ? { backgroundColor: colorPrimario } : {}}
            >
              <i className="fi fi-rr-qrcode text-sm" /> QR
            </button>
            {esDueño && (
              <button
                onClick={() => setVista('editor')}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-transparent ${
                  vista === 'editor'
                    ? 'text-white shadow-md'
                    : isDark ? 'text-neutral-500 hover:text-neutral-300 hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
                style={vista === 'editor' ? { backgroundColor: colorPrimario } : {}}
              >
                <i className="fi fi-rr-picture text-sm" /> Editor
              </button>
            )}
            <button
              onClick={() => setVista('config')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border border-transparent ${
                vista === 'config'
                  ? 'text-white shadow-md'
                  : isDark ? 'text-neutral-500 hover:text-neutral-300 hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              style={vista === 'config' ? { backgroundColor: colorPrimario } : {}}
            >
              <i className="fi fi-rr-file-pdf text-sm" /> Carta del Bot
            </button>
          </div>
        </div>
      </div>

      {/* ═══ RENDERIZADO DE MÓDULOS ═══ */}
      {vista === 'qr' ? (
        <VistaQR
          esDueñoQR={esDueñoQR}
          colorPrimario={colorPrimario}
          isDark={isDark}
        />
      ) : vista === 'editor' ? (
        <VistaEditor
          esDueño={esDueño}
          colorPrimario={colorPrimario}
          isDark={isDark}
        />
      ) : (
        <VistaConfigCarta
          esDueño={esDueñoQR}
          colorPrimario={colorPrimario}
          isDark={isDark}
        />
      )}

    </div>
  );
}