import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ConfirmContext = createContext(null);

const CSS = `
@keyframes bpConfirmIn {
  from { transform: scale(0.94); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
`;

function ConfirmDialog({ dialog, onCancelar, onConfirmar }) {
  const peligroso = dialog.peligroso !== false;
  const acento = peligroso ? '#ef4444' : '#3b82f6';
  const icono = dialog.icono || (peligroso ? 'fi-rr-trash' : 'fi-rr-question');

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
            style={{
              flex: 1, padding: '13px 0', borderRadius: 14,
              background: acento, border: 'none', color: '#fff',
              fontWeight: 900, fontSize: 13, cursor: 'pointer',
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
  const resolverRef = useRef(null);

  const confirmar = useCallback((mensaje, opciones = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog(typeof mensaje === 'string' ? { mensaje, ...opciones } : mensaje);
    });
  }, []);

  const resolver = useCallback((resultado) => {
    resolverRef.current?.(resultado);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {dialog && (
        <ConfirmDialog
          dialog={dialog}
          onCancelar={() => resolver(false)}
          onConfirmar={() => resolver(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

// Uso: const confirm = useConfirm(); const ok = await confirm('¿Eliminar esto?');
// Devuelve una Promise<boolean> — true si el usuario confirmó, false si canceló.
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm necesita estar dentro de <ConfirmProvider>');
  return ctx;
}
