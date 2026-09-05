import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { cerrarSesionGlobal } from '../src/api/api';
import { verificarSesionEmpleado, generarPagoSuscripcion, refrescarSesion } from '../src/api/api';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoginView from './views/View_Login';
import PosTerminal from '../src/features/POS/Pos_Terminal';
import KdsView from './views/View_Kds';
import ErpDashboard from './views/View_Erp';
import StaffDashboard from './views/View_Staff';
import PublicMenu from './features/public/PublicMenu';
import api from '../src/api/api';
import usePosStore from './store/usePosStore';

if (typeof window !== 'undefined') {
  window.__getStoreConfig = () => usePosStore.getState().configuracionGlobal;
}
const ROL_A_VISTA = {
  'superadmin':    'staff',
  'dueño':         'erp',
  'admin':         'erp',
  'administrador': 'erp',
  'cocinero':      'cocina',
  'cocina':        'cocina',
  'mesero':        'terminal',
  'cajero':        'terminal',
  'empleado':      'terminal',
};

const getRolVista = (rol) =>
  ROL_A_VISTA[rol?.toLowerCase().trim()] || null;

const VistaInternaPOS = () => {
  const [vista, setVista]             = useState(null);
  const [sesion, setSesion]           = useState(null);
  const [cargando, setCargando]       = useState(true);
  const [suscripcion, setSuscripcion] = useState(null);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState(null);

  // Inicia el pago de la suscripción y redirige a MercadoPago.
  const handlePagarSuscripcion = async () => {
    setProcesandoPago(true);
    setErrorPago(null);
    try {
      const res = await generarPagoSuscripcion();   // usa el plan del negocio
      if (res.data?.init_point) {
        window.location.assign(res.data.init_point);
        return;
      }
      setErrorPago('No se pudo iniciar el pago.');
    } catch (e) {
      const msg = e?.response?.data?.error;
      setErrorPago(msg || 'No se pudo iniciar el pago. Intenta de nuevo.');
    } finally {
      setProcesandoPago(false);
    }
  };

  const verificarSuscripcion = async () => {
    try {
      const res = await api.get('/negocio/estado-suscripcion/');
      setSuscripcion(res.data);
      return res.data;
    } catch {
      return null;
    }
  };

  useEffect(() => {
  const verificar = async () => {
    try {
      // 1. ¿Hay sesión de empleado activa? (cookie empleado_session)
      try {
        const res = await verificarSesionEmpleado();
        if (res.data.autenticado) {
          const { rol, sede_id, nombre, empleado_id, negocio_id } = res.data.empleado;
          const vistaDestino = getRolVista(rol);
          if (!vistaDestino) { setVista('sin_permiso'); return; }

          localStorage.setItem('sede_id',         sede_id);
          localStorage.setItem('empleado_id',     empleado_id);
          localStorage.setItem('empleado_nombre', nombre);
          localStorage.setItem('negocio_id',      negocio_id);
          localStorage.setItem('usuario_rol',     rol);

          const sus = await verificarSuscripcion();
          if (sus && !sus.puede_operar) { setVista('bloqueado'); return; }

          setSesion({ rol, nombre, sede_id });
          setVista(vistaDestino);
          return;
        }
      } catch (_) {
        // No hay sesión de empleado
      }

      // 2. ¿Hay sesión de dueño activa? (cookie JWT) — tiene prioridad sobre tablet
      try {
        let res;
        try {
          res = await api.get('/verificar-sesion/');
        } catch (errVerif) {
          // El access token pudo haber expirado. Si el refresh sigue vigente,
          // lo revivimos UNA vez y reintentamos (evita caer al PIN siendo dueño).
          // verificar-sesion está excluido del refresh automático del interceptor
          // a propósito (para no entrar en bucle de recarga sin sesión).
          if (errVerif.response?.status === 401) {
            try {
              await refrescarSesion();
              res = await api.get('/verificar-sesion/');
            } catch {
              res = null;
            }
          } else {
            throw errVerif;
          }
        }
        if (res?.data?.autenticado) {
          const { rol, negocio_id, nombre, avatar } = res.data.user;
          const vistaDestino = getRolVista(rol);
          if (!vistaDestino) { setVista('sin_permiso'); return; }

          if (negocio_id) localStorage.setItem('negocio_id', negocio_id);
          if (nombre) localStorage.setItem('usuario_nombre', nombre);
          if (avatar) localStorage.setItem('usuario_avatar', avatar);
          else localStorage.removeItem('usuario_avatar');
          setSesion({ rol });

          // El operador de la plataforma no tiene negocio propio — la
          // suscripción no aplica, va directo al panel de staff.
          if (vistaDestino === 'staff') { setVista('staff'); return; }

          const sus = await verificarSuscripcion();
          if (sus && !sus.puede_operar) { setVista('bloqueado'); return; }

          setVista(vistaDestino);
          return;
        }
      } catch (_) {
        // No hay sesión de dueño
      }

      // 3. Recién aquí: si hay sede_id guardada es tablet → forzar PIN
      if (localStorage.getItem('sede_id')) {
        setVista('login');
        return;
      }

      // 4. Sin nada → login
      setVista('login');

      } catch {
        setVista('login');
      } finally {
        setCargando(false);
      }
    };

    verificar();
  }, []);

  const handleAccesoConcedido = async (datosEmpleado) => {
    const datos = typeof datosEmpleado === 'string'
      ? { rol: datosEmpleado, nombre: null, sede_id: null, suscripcion: null }
      : datosEmpleado;

    const { rol, nombre, sede_id, suscripcion } = datos;

    if (suscripcion && !suscripcion.puede_operar) {
      setSuscripcion(suscripcion);
      setVista('bloqueado');
      return;
    }

    const vistaDestino = getRolVista(rol);
    if (!vistaDestino) { setVista('sin_permiso'); return; }

    if (!suscripcion && vistaDestino !== 'staff') {
      const sus = await verificarSuscripcion();
      if (sus && !sus.puede_operar) { setVista('bloqueado'); return; }
    }

    setSesion({ rol, nombre, sede_id });
    setVista(vistaDestino);
  };

  if (cargando || vista === null) {
    return (
      <div className="bg-[#121212] h-screen flex items-center justify-center text-neutral-300 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#ff5a1f] border-t-transparent rounded-full animate-spin" />
          <p className="animate-pulse">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (vista === 'sin_permiso') {
    return (
      <div className="bg-[#0a0a0a] h-screen flex flex-col items-center justify-center text-center p-6">
        <span className="text-7xl mb-6">🔒</span>
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Acceso Denegado</h1>
        <p className="text-neutral-500 font-bold mb-8 max-w-sm">
          No tienes permisos para ver esta sección. Contacta al administrador.
        </p>
        <button
          onClick={async () => { await cerrarSesionGlobal(); setVista('login'); }}
          className="px-8 py-3 rounded-2xl bg-[#ff5a1f] text-white font-black uppercase tracking-widest"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  if (vista === 'bloqueado') {
    const esVencido   = suscripcion?.estado === 'vencido';
    const esBloqueado = suscripcion?.estado === 'bloqueado';
    return (
      <div className="bg-[#0a0a0a] h-screen flex flex-col items-center justify-center text-center p-6">
        <div className="w-24 h-24 rounded-3xl bg-[#ff5a1f]/10 flex items-center justify-center mb-6">
          <span className="text-5xl">{esBloqueado ? '🚫' : '⏰'}</span>
        </div>
        <h1 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter">
          {esBloqueado ? 'Cuenta Suspendida' : 'Periodo de Prueba Vencido'}
        </h1>
        <p className="text-neutral-400 font-bold mb-2 max-w-md text-sm">{suscripcion?.mensaje}</p>
        {esVencido && (
          <p className="text-neutral-600 text-xs mb-8 max-w-sm">
            Plan actual: <span className="text-neutral-400">{suscripcion?.plan_nombre ?? 'Sin plan'}</span>
          </p>
        )}
        {errorPago && (
          <p className="text-red-400 text-xs font-bold mb-3 max-w-sm">{errorPago}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={handlePagarSuscripcion}
            disabled={procesandoPago}
            className="px-8 py-3 rounded-2xl bg-[#ff5a1f] text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-orange-900/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {procesandoPago ? 'Redirigiendo…' : 'Pagar Suscripción →'}
          </button>
          <button
            onClick={async () => { await cerrarSesionGlobal(); setVista('login'); }}
            className="px-8 py-3 rounded-2xl bg-[#1a1a1a] border border-[#333] text-neutral-400 font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const mostrarBannerAlerta = suscripcion?.estado === 'prueba' && suscripcion?.alerta;

  return (
    <div className="bg-[#121212] h-screen text-neutral-100 font-sans flex flex-col relative overflow-hidden">
      {mostrarBannerAlerta && (
        <div className="bg-amber-500 text-black text-xs font-black px-4 py-2 flex items-center justify-between gap-4 z-50 shrink-0">
          <span>
            ⚠️ Tu periodo de prueba vence en {suscripcion.dias_restantes} {suscripcion.dias_restantes === 1 ? 'día' : 'días'}.
            Adquiere un plan para no perder el acceso.
          </span>
          <button
            onClick={handlePagarSuscripcion}
            disabled={procesandoPago}
            className="shrink-0 bg-black text-white px-3 py-1 rounded-lg uppercase tracking-widest hover:bg-neutral-900 transition-all disabled:opacity-50"
          >
            {procesandoPago ? 'Redirigiendo…' : 'Pagar →'}
          </button>
        </div>
      )}

      {vista === 'login'    && <LoginView onAccesoConcedido={handleAccesoConcedido} />}
      {vista === 'terminal' && <PosTerminal rolUsuario={sesion?.rol} onIrAErp={() => setVista('erp')} />}
      {vista === 'cocina'   && <KdsView onVolver={() => setVista('login')} />}
      {vista === 'erp'      && <ErpDashboard onVolverAlPos={() => setVista('terminal')} rolUsuario={sesion?.rol} />}
      {vista === 'staff'    && <StaffDashboard onLogout={async () => { await cerrarSesionGlobal(); setVista('login'); }} />}
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<VistaInternaPOS />} />
            <Route path="/menu/:negocioId/:sedeId/:mesaId" element={<PublicMenu />} />
            <Route path="*" element={
              <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-center p-6">
                <span className="text-8xl mb-4">🏮</span>
                <h1 className="text-4xl font-black text-white mb-2">404</h1>
                <p className="text-neutral-500 font-bold mb-6">Parece que este local no existe o se movió de sitio.</p>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-8 py-3 rounded-2xl bg-[#ff5a1f] text-white font-black uppercase tracking-widest shadow-lg shadow-orange-900/20 active:scale-95 transition-all"
                >
                  Volver al Inicio
                </button>
              </div>
            } />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  );
}