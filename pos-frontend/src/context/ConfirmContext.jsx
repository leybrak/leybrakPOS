import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ConfirmContext = createContext(null);

const CSS = `
@keyframes bpConfirmIn {
  from { transform: scale(0.94); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
`;

function ConfirmDialog({ dialog, valorTexto, setValorTexto, onCancelar, onConfirmar }) {
  const peligroso = dialog.peligroso !== false;
  const acento = peligroso ? '#ef4444' : '#3b82f6';
  const icono = dialog.icono || (peligroso ? 'fi-rr-trash' : 'fi-rr-question');
  const pedirTexto = dialog.pedirTexto;
  const deshabilitado = !!(pedirTexto && pedirTexto.obligatorio !== false && !valorTexto.trim());

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 200, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onCancelar}
    >
      <style>{CSS}</style>
      <div
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#141414',
          border: '1px solid #262626',
          borderRadius: 28,
          padding: 28,
          width: '100%',
          maxWidth: 380,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'bpConfirmIn 0.22s cubic-bezier(.22,.68,0,1.2)',
        }}
      >
        <div
          style={{
            width: 48, height: 48, borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${acento}22`, color: acento, marginBottom: 16,
          }}
        >
          <i className={`fi ${icono}`} style={{ fontSize: 20 }} />
        </div>

        {dialog.titulo && (
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 900, margin: '0 0 6px' }}>
            {dialog.titulo}
          </h3>
        )}
        <p style={{ color: '#a3a3a3', fontSize: 13, fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
          {dialog.mensaje}
        </p>

        {pedirTexto && (
          <input
            autoFocus
            type="text"
            value={valorTexto}
            onChange={(e) => setValorTexto(e.target.value)}
            placeholder={pedirTexto.placeholder || ''}
            maxLength={pedirTexto.maxLength}
            onKeyDown={(e) => { if (e.key === 'Enter' && !deshabilitado) onConfirmar(); }}
            style={{
              width: '100%', marginTop: 16, padding: '12px 14px', borderRadius: 12,
              background: '#1a1a1a', border: '1px solid #333', color: '#fff',
              fontSize: 14, fontWeight: 600, outline: 'none', boxSizing: 'border-box',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            onClick={onCancelar}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              background: '#1a1a1a', border: '1px solid #333', color: '#d4d4d4',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {dialog.textoCancelar || 'Cancelar'}
          </button>
          <button
            onClick={onConfirmar}
            disabled={deshabilitado}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              background: acento, border: 'none', color: '#fff',
              fontWeight: 900, fontSize: 13, cursor: deshabilitado ? 'not-allowed' : 'pointer',
              opacity: deshabilitado ? 0.5 : 1,
            }}
          >
            {dialog.textoConfirmar || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [valorTexto, setValorTexto] = useState('');
  const resolverRef = useRef(null);

  const mostrarDialogo = useCallback((mensaje, opciones = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      const config = typeof mensaje === 'string' ? { mensaje, ...opciones } : mensaje;
      setValorTexto(config?.pedirTexto?.valorInicial || '');
      setDialog(config);
    });
  }, []);

  // Confirmación simple sí/no — Promise<boolean> (true si confirmó, false si canceló).
  // Uso: const confirmar = useConfirm(); const ok = await confirmar('¿Eliminar esto?');
  const confirmar = useCallback((mensaje, opciones) => mostrarDialogo(mensaje, opciones), [mostrarDialogo]);

  // Reemplaza a window.prompt() con el mismo diseño — Promise<string|null>
  // (el texto escrito si confirmó, null si canceló). `opciones.pedirTexto`
  // acepta { placeholder, valorInicial, obligatorio (default true), maxLength }.
  // Uso: const prompt = usePrompt(); const motivo = await prompt('¿Por qué se cancela?', { pedirTexto: { placeholder: 'Motivo...' } });
  const prompt = useCallback((mensaje, opciones = {}) => {
    const base = typeof mensaje === 'string' ? { mensaje, ...opciones } : mensaje;
    return mostrarDialogo({ ...base, pedirTexto: base.pedirTexto || {} });
  }, [mostrarDialogo]);

  const resolver = useCallback((confirmado) => {
    if (dialog?.pedirTexto) {
      resolverRef.current?.(confirmado ? valorTexto.trim() : null);
    } else {
      resolverRef.current?.(confirmado);
    }
    resolverRef.current = null;
    setDialog(null);
    setValorTexto('');
  }, [dialog, valorTexto]);

  return (
    <ConfirmContext.Provider value={{ confirmar, prompt }}>
      {children}
      {dialog && (
        <ConfirmDialog
          dialog={dialog}
          valorTexto={valorTexto}
          setValorTexto={setValorTexto}
          onCancelar={() => resolver(false)}
          onConfirmar={() => resolver(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm necesita estar dentro de <ConfirmProvider>');
  return ctx.confirmar;
}

export function usePrompt() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('usePrompt necesita estar dentro de <ConfirmProvider>');
  return ctx.prompt;
}
