import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { cerrarSesionGlobal } from '../src/api/api';
import { verificarSesionEmpleado, generarPagoSuscripcion, refrescarSesion, marcarIngresoEmpleado, marcarSalidaEmpleado } from '../src/api/api';
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
import ActualizacionDisponible from './components/ActualizacionDisponible';

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
  // Empleado que ya pasó el PIN pero todavía no confirmó su ingreso —
  // mesero/cajero/cocinero no pueden pasar al POS/KDS sin este paso.
  const [pendienteIngreso, setPendienteIngreso] = useState(null);
  const [marcandoIngreso, setMarcandoIngreso] = useState(false);

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

  // Intenta restaurar la sesión de empleado desde la cookie empleado_session.
  // Devuelve true si encontró/manejó una sesión (autenticada o no) y ya no
  // hace falta seguir revisando las otras opciones; false si no hay cookie.
  const intentarRestaurarEmpleado = async () => {
    const res = await verificarSesionEmpleado();
    if (!res.data.autenticado) return false;

    const { rol, sede_id, nombre, empleado_id, negocio_id } = res.data.empleado;
    const vistaDestino = getRolVista(rol);
    if (!vistaDestino) { setVista('sin_permiso'); return true; }

    localStorage.setItem('sede_id',         sede_id);
    localStorage.setItem('empleado_id',     empleado_id);
    localStorage.setItem('empleado_nombre', nombre);
    localStorage.setItem('negocio_id',      negocio_id);
    localStorage.setItem('usuario_rol',     rol);

    const sus = await verificarSuscripcion();
    if (sus && !sus.puede_operar) { setVista('bloqueado'); return true; }

    setSesion({ rol, nombre, sede_id });
    setVista(vistaDestino);
    return true;
  };

  useEffect(() => {
  const verificar = async () => {
    try {
      // 1. ¿Hay sesión de empleado activa? (cookie empleado_session)
      try {
        if (await intentarRestaurarEmpleado()) return;
      } catch (err) {
        // 🛠️ Antes CUALQUIER error acá (incluyendo un timeout de red, o el
        // backend reiniciando a mitad de un deploy) se trataba igual que "no
        // hay sesión" y mandaba de vuelta al PIN — aunque la sesión siguiera
        // viva en el servidor. Eso es justo lo que reportó el mozo: "a veces
        // recargo y me manda al PIN, a veces no". Un 401 sí significa que la
        // sesión ya no es válida; cualquier otra falla puede ser pasajera —
        // se reintenta una vez antes de rendirse.
        if (err?.response?.status !== 401) {
          try {
            await new Promise(r => setTimeout(r, 800));
            if (await intentarRestaurarEmpleado()) return;
          } catch (_) {
            // Sigue fallando — recién ahora se sigue con las demás opciones.
          }
        }
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

          // 🛠️ Si este dispositivo fue configurado como terminal PIN (ver
          // View_Login.jsx → handleSedeSetup), no lo mandamos automáticamente a
          // la vista del dueño solo porque su JWT sigue vivo — ese JWT lo sigue
          // necesitando el empleado para operar (mesas, órdenes, cobrar...), pero
          // la pantalla debe forzar igual el PIN en vez de saltarse directo al ERP.
          if (localStorage.getItem('dispositivo_terminal_pin') === 'true') {
            setVista('login');
            return;
          }

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

    const { rol, nombre, sede_id, suscripcion, id, turno_abierto } = datos;

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

    // Ingreso obligatorio solo para roles operativos (mesero/cajero/cocinero)
    // que entran por PIN — el dueño/admin/staff no marca asistencia.
    // 🛠️ Antes se pedía SIEMPRE, aunque el empleado ya hubiera marcado su
    // ingreso antes y no hubiera marcado su salida — si la sesión se perdía
    // a mitad de turno (cookie vencida, error de red) y volvía a entrar con
    // el PIN, le volvía a aparecer "marca tu ingreso" sin sentido. El login
    // ahora dice si el turno ya está abierto (turno_abierto).
    if (id && !turno_abierto && (vistaDestino === 'terminal' || vistaDestino === 'cocina')) {
      setPendienteIngreso({ id, rol, nombre, sede_id, vistaDestino });
      return;
    }

    setSesion({ rol, nombre, sede_id, id });
    setVista(vistaDestino);
  };

  const confirmarIngreso = async () => {
    if (!pendienteIngreso || marcandoIngreso) return;
    setMarcandoIngreso(true);
    try {
      await marcarIngresoEmpleado(pendienteIngreso.id);
    } catch (_) {
      // No bloqueamos el ingreso al trabajo por un error de red al marcar asistencia.
    } finally {
      setMarcandoIngreso(false);
    }
    const { id, rol, nombre, sede_id, vistaDestino } = pendienteIngreso;
    setSesion({ rol, nombre, sede_id, id });
    setVista(vistaDestino);
    setPendienteIngreso(null);
  };

  // Fin de turno: marca la salida y vuelve al PIN (NO al login del dispositivo —
  // ese vínculo con el negocio/sede ya está hecho y no se toca).
  const handleCerrarTurno = async (empleadoId) => {
    try {
      if (empleadoId) await marcarSalidaEmpleado(empleadoId);
    } catch (_) {
      // Igual dejamos salir aunque falle la marca de salida por red.
    }
    localStorage.removeItem('empleado_id');
    localStorage.removeItem('empleado_nombre');
    localStorage.removeItem('usuario_rol');
    setSesion(null);
    setVista('login');
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

  if (pendienteIngreso) {
    return (
      <div className="bg-[#0a0a0a] h-screen flex flex-col items-center justify-center text-center p-6">
        <div className="w-24 h-24 rounded-3xl bg-[#ff5a1f]/10 flex items-center justify-center mb-6">
          <span className="text-5xl">🕒</span>
        </div>
        <h1 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter">
          {pendienteIngreso.nombre ? `Hola, ${pendienteIngreso.nombre}` : 'Bienvenido'}
        </h1>
        <p className="text-neutral-400 font-bold mb-8 max-w-sm text-sm">
          Antes de empezar tu turno, marca tu ingreso.
        </p>
        <button
          onClick={confirmarIngreso}
          disabled={marcandoIngreso}
          className="px-8 py-4 rounded-2xl bg-[#ff5a1f] text-white font-black uppercase tracking-widest text-sm shadow-lg shadow-orange-900/20 active:scale-95 transition-all disabled:opacity-50"
        >
          {marcandoIngreso ? 'Marcando…' : 'Marcar Ingreso'}
        </button>
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
      {vista === 'terminal' && <PosTerminal rolUsuario={sesion?.rol} onIrAErp={() => setVista('erp')} onCerrarTurno={() => handleCerrarTurno(sesion?.id)} />}
      {vista === 'cocina'   && <KdsView onVolver={() => setVista('login')} onCerrarTurno={() => handleCerrarTurno(sesion?.id)} />}
      {vista === 'erp'      && <ErpDashboard onVolverAlPos={() => setVista('terminal')} rolUsuario={sesion?.rol} />}
      {vista === 'staff'    && <StaffDashboard onLogout={async () => { await cerrarSesionGlobal(); setVista('login'); }} />}
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ActualizacionDisponible />
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