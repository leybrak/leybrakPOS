import React, { useState, useEffect } from 'react';
import { loginAdministrador, loginPinEmpleado, getEstadoCaja, abrirCajaBD, getSedes } from '../api/api';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import { 
  User, Lock, Eye, EyeOff, Loader2, ArrowLeft, 
  MapPin, MonitorSmartphone, ChevronRight, 
  Delete, Wallet, AlertCircle, LayoutDashboard
} from 'lucide-react';

import logoLeybrak from '../assets/logoSinFondoCompacto copy.png';

export default function LoginView({ onAccesoConcedido }) {
  const toast = useToast();

  const tabletConfigurada = !!localStorage.getItem('sede_id');
  const [modo, setModo] = useState(tabletConfigurada ? 'empleado' : 'inicio');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [sedesDisponibles, setSedesDisponibles] = useState([]);
  const [sedeSeleccionada, setSedeSeleccionada] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  const [pin, setPin] = useState('');
  const [horaLocal, setHoraLocal] = useState('');
  const [fechaLocal, setFechaLocal] = useState('');
  const [estadoLocal, setEstadoLocal] = useState('cargando');
  const [negocioNombre, setNegocioNombre] = useState('');
  const [modalApertura, setModalApertura] = useState(false);
  const [fondoCaja, setFondoCaja] = useState('');
  const [empleadoActual, setEmpleadoActual] = useState(null);

  // ── Bloqueo manejado por backend — solo mostramos el countdown ──
  const [bloqueadoSegundos, setBloqueadoSegundos] = useState(0);
  const estaBlockeado = bloqueadoSegundos > 0;

  useEffect(() => {
    if (bloqueadoSegundos <= 0) return;
    const timer = setTimeout(() => setBloqueadoSegundos(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [bloqueadoSegundos]);

  const sedeName = localStorage.getItem('sede_nombre') || 'Sede Principal';

  useEffect(() => {
    const negocioId = localStorage.getItem('negocio_id');
    if (!negocioId) return;
    api.get(`/negocios/${negocioId}/`)
      .then(res => setNegocioNombre(res.data.nombre || ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (modo !== 'empleado') return;

    // Consultar bloqueo activo al cargar
    const sedeId = localStorage.getItem('sede_id');
    if (sedeId) {
      api.get(`/empleados/estado-bloqueo/?sede_id=${sedeId}`)
        .then(res => {
          if (res.data.bloqueado) setBloqueadoSegundos(res.data.segundos_restantes);
        })
        .catch(() => {});
    }

    const verificarCaja = async () => {
      try {
        const res = await getEstadoCaja();
        setEstadoLocal(res.data.estado);
      } catch { console.error('Conectando...'); }
    };
    verificarCaja();
    const intervaloCaja = setInterval(verificarCaja, 5000);
    const timer = setInterval(() => {
      const ahora = new Date();
      setHoraLocal(ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }));
      setFechaLocal(ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }));
    }, 1000);
    return () => { clearInterval(intervaloCaja); clearInterval(timer); };
  }, [modo]);

  const handleLoginSubmit = async (e, destino) => {
    e.preventDefault();
    setLoadingAuth(true);
    try {
      const res = await loginAdministrador({ username: email, password });
      localStorage.setItem('negocio_id', res.data.negocio_id);

      try {
        const resSus = await api.get('/negocio/estado-suscripcion/');
        if (!resSus.data.puede_operar) {
          onAccesoConcedido({ rol: res.data.rol || 'dueño', suscripcion: resSus.data });
          return;
        }
      } catch {}

      if (destino === 'erp') {
        const rolSeguro = res.data.rol || 'Dueño';
        localStorage.setItem('usuario_rol', rolSeguro);
        onAccesoConcedido(rolSeguro);
      } else {
        localStorage.removeItem('empleado_id');
        const sedesRes = await getSedes();
        setSedesDisponibles(sedesRes.data);
        if (sedesRes.data.length > 0) setSedeSeleccionada(sedesRes.data[0].id);
        setModo('setup_sede');
      }
    } catch {
      toast.error('Credenciales incorrectas. Verifica usuario y contraseña.');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSedeSetup = (e) => {
    e.preventDefault();
    const sedeObj = sedesDisponibles.find(s => s.id.toString() === sedeSeleccionada.toString());
    if (sedeObj) {
      localStorage.setItem('sede_id', sedeObj.id);
      localStorage.setItem('sede_nombre', sedeObj.nombre);
      localStorage.removeItem('modo_dispositivo');
      setModo('empleado');
    }
  };

  const presionarTecla = (num) => { if (pin.length < 4) setPin(pin + num); };
  const borrarTecla = () => { setPin(pin.slice(0, -1)); };

  const procesarPin = async (accion) => {
    if (pin.length !== 4) return;
    if (estaBlockeado) {
      toast.error(`Terminal bloqueada. Espera ${bloqueadoSegundos}s.`);
      return;
    }
    try {
      const respuesta = await loginPinEmpleado({ pin, sede_id: localStorage.getItem('sede_id'), accion });
      const empleado = respuesta.data;

      // Éxito — limpiar bloqueo local
      setBloqueadoSegundos(0);
      localStorage.setItem('empleado_nombre', empleado.nombre);
      localStorage.setItem('usuario_rol', empleado.rol);

      try {
        const resSus = await api.get('/negocio/estado-suscripcion/');
        if (!resSus.data.puede_operar) {
          onAccesoConcedido({ rol: empleado.rol, suscripcion: resSus.data });
          return;
        }
      } catch {}

      if (accion === 'asistencia') {
        toast.success(`Asistencia registrada — ${empleado.nombre}`);
        setPin('');
        return;
      }
      if (accion === 'entrar') {
        const rolLimpio = empleado.rol.toLowerCase();
        if (rolLimpio === 'cocinero' || rolLimpio === 'cocina') {
          onAccesoConcedido(empleado); return;
        }
        if (estadoLocal === 'cerrado') {
          if (['administrador', 'cajero', 'admin'].includes(rolLimpio)) {
            setEmpleadoActual(empleado); setModalApertura(true);
          } else {
            toast.warning('La caja está cerrada. Contacta al administrador.'); setPin('');
          }
        } else {
          onAccesoConcedido(empleado);
        }
      }
    } catch (error) {
      const msg = error.response?.data?.error || 'PIN incorrecto.';
      const restantes = error.response?.data?.segundos_restantes;

      if (error.response?.status === 429) {
        // Bloqueo del backend — activar countdown local para UX
        setBloqueadoSegundos(restantes || 120);
        toast.error(msg);
      } else {
        // PIN incorrecto — el backend ya devuelve "Intentos restantes: N"
        toast.error(msg);
      }
      setPin('');
    }
  };

  const abrirLocal = async () => {
    if (fondoCaja === '') { toast.warning('Ingresa el fondo inicial de caja.'); return; }
    try {
      const respuesta = await abrirCajaBD({ empleado_id: empleadoActual.id, fondo_inicial: parseFloat(fondoCaja) });
      localStorage.setItem('sesion_caja_id', respuesta.data.id);
      setEstadoLocal('abierto');
      setModalApertura(false);
      onAccesoConcedido(empleadoActual.rol_nombre);
    } catch {
      toast.error('No se pudo abrir la caja. Verifica la conexión.');
    }
  };

  // ════════════════════════════════════════════════════════════════════════
  // VISTA 1: TERMINAL POS (PIN)
  // ════════════════════════════════════════════════════════════════════════
  if (modo === 'empleado') {
    return (
      <div className="min-h-screen font-sans flex flex-col items-center justify-center bg-[#050505] text-white select-none px-4 relative overflow-hidden">
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#3b82f6] opacity-[0.03] rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-[340px] flex flex-col items-center relative z-10">
          
          <div className="text-center mb-8 w-full">
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="font-black text-2xl text-white tracking-tight">LEYBRAK<span className="text-[#3b82f6]">POS</span></span>
            </div>
            <h2 className="text-gray-300 font-semibold text-sm tracking-wide">{negocioNombre || 'Terminal de Caja'}</h2>
            <p className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mt-1">{sedeName}</p>

            <div className={`mt-5 inline-flex items-center gap-2 px-3 py-1 rounded-md border text-[10px] font-bold uppercase tracking-widest ${
              estadoLocal === 'abierto' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
              estadoLocal === 'cerrado' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-[#121212] border-[#222] text-gray-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${estadoLocal === 'abierto' ? 'bg-green-500 animate-pulse' : estadoLocal === 'cerrado' ? 'bg-red-500' : 'bg-gray-500'}`}/>
              {estadoLocal === 'abierto' ? 'Caja Abierta' : estadoLocal === 'cerrado' ? 'Caja Cerrada' : 'Conectando...'}
            </div>

            <div className="mt-6 mb-2">
              <p className="text-5xl font-light tabular-nums text-white tracking-tight">{horaLocal || '--:--'}</p>
              <p className="text-gray-500 text-xs font-medium mt-2 capitalize">{fechaLocal}</p>
            </div>
          </div>

          {/* PIN Dots */}
          <div className="flex gap-4 mb-8">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${
                estaBlockeado ? 'bg-red-500/50' :
                pin.length > i ? 'bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-[#1a1a1a] border border-[#2a2a2a]'
              }`}/>
            ))}
          </div>

          {/* Alerta de bloqueo */}
          {estaBlockeado && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 w-full justify-center">
              <Lock size={14} className="text-red-400" />
              <span className="text-red-400 text-[11px] font-bold uppercase tracking-widest">
                Bloqueado {bloqueadoSegundos}s
              </span>
            </div>
          )}

          {/* Teclado */}
          <div className="grid grid-cols-3 gap-3 w-full mb-6">
            {[1,2,3,4,5,6,7,8,9].map(num => (
              <button
                key={num} onClick={() => presionarTecla(num.toString())}
                className="h-16 bg-[#121212] border border-[#1e1e1e] hover:bg-[#1a1a1a] hover:border-[#2a2a2a] active:scale-95 text-white text-xl font-medium rounded-xl transition-all"
              >
                {num}
              </button>
            ))}
            <button onClick={borrarTecla} className="h-16 bg-[#121212] border border-[#1e1e1e] hover:bg-red-500/10 hover:border-red-500/20 active:scale-95 text-gray-500 hover:text-red-400 rounded-xl transition-all flex items-center justify-center">
              <Delete size={20} />
            </button>
            <button onClick={() => presionarTecla('0')} className="h-16 bg-[#121212] border border-[#1e1e1e] hover:bg-[#1a1a1a] active:scale-95 text-white text-xl font-medium rounded-xl transition-all">
              0
            </button>
            <button onClick={() => setPin('')} className="h-16 bg-[#121212] border border-[#1e1e1e] hover:bg-[#1a1a1a] active:scale-95 text-gray-500 text-[10px] font-bold rounded-xl transition-all uppercase tracking-widest">
              Limpiar
            </button>
          </div>

          <button
            onClick={() => procesarPin('entrar')} disabled={estaBlockeado || pin.length < 4}
            className="w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            {estaBlockeado ? `Esperar ${bloqueadoSegundos}s...` : 'Ingresar'}
          </button>
        </div>

        {/* Modal Apertura Caja */}
        {modalApertura && (
          <div className="fixed inset-0 bg-[#050505]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-[#121212] border border-[#1e1e1e] rounded-2xl w-full max-w-sm p-8 shadow-2xl">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                  <Wallet size={24} className="text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-white">Apertura de Caja</h3>
                <p className="text-gray-400 text-xs mt-1">Ingresa el fondo inicial del turno</p>
              </div>
              <div className="flex items-center justify-center bg-[#0a0a0a] border border-[#1e1e1e] rounded-xl p-4 mb-6">
                <span className="text-gray-500 text-xl mr-2">S/</span>
                <input
                  type="number" value={fondoCaja} onChange={e => setFondoCaja(e.target.value)}
                  className="bg-transparent w-32 text-white text-3xl font-bold focus:outline-none text-center"
                  placeholder="0.00" autoFocus
                />
              </div>
              <button onClick={abrirLocal} className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white py-3.5 rounded-xl font-bold text-sm transition-colors mb-2">
                Iniciar Turno
              </button>
              <button onClick={() => { setModalApertura(false); setPin(''); }} className="w-full text-gray-500 text-xs font-bold py-3 hover:text-gray-300">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Botón legal */}
        <a
          href="/legal.html"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#121212] border border-[#1e1e1e] hover:border-[#1e1e1e] text-gray-600 hover:text-gray-400 px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
        >
          <AlertCircle size={12} />
          Legal
        </a>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // VISTA 2: WEB LOGIN
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex bg-[#050505] font-sans overflow-hidden text-white">

      {/* PANEL IZQUIERDO */}
      <div className="w-full lg:w-[45%] flex flex-col justify-center px-8 sm:px-16 lg:px-24 relative z-10 bg-[#0a0a0a] border-r border-[#1a1a1a]">
        
        <div className="absolute top-10 left-8 sm:left-16 lg:left-24 flex items-center gap-2">
          <span className="font-black text-xl tracking-tight">LEYBRAK<span className="text-[#3b82f6]">POS</span></span>
          <span className="ml-2 px-2 py-0.5 rounded-md bg-[#121212] border border-[#222] text-[9px] text-gray-500 font-bold uppercase tracking-widest">
            SAAS PLATFORM
          </span>
        </div>

        <div className="w-full max-w-[380px] mx-auto mt-16 lg:mt-0">
          
          {/* INICIO */}
          {modo === 'inicio' && (
            <div className="animate-fadeIn">
              <h1 className="text-3xl font-bold tracking-tight mb-2">Bienvenido</h1>
              <p className="text-gray-400 text-sm mb-8">Selecciona cómo deseas acceder a la plataforma hoy.</p>

              <div className="space-y-4">
                <button onClick={() => setModo('login_erp')} className="w-full bg-[#121212] border border-[#1e1e1e] hover:border-[#3b82f6]/50 hover:bg-[#161616] p-5 rounded-xl flex items-center gap-4 transition-all group text-left">
                  <div className="w-10 h-10 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] flex items-center justify-center text-gray-400 group-hover:text-[#3b82f6] group-hover:border-[#3b82f6]/30 transition-colors">
                    <LayoutDashboard size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">Panel de Control</p>
                    <p className="text-gray-500 text-xs mt-0.5">Gestión, reportes y configuración</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-600 group-hover:text-[#3b82f6] group-hover:translate-x-1 transition-all" />
                </button>

                <button onClick={() => setModo('login_pos')} className="w-full bg-[#121212] border border-[#1e1e1e] hover:border-[#3b82f6]/50 hover:bg-[#161616] p-5 rounded-xl flex items-center gap-4 transition-all group text-left">
                  <div className="w-10 h-10 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] flex items-center justify-center text-gray-400 group-hover:text-[#3b82f6] group-hover:border-[#3b82f6]/30 transition-colors">
                    <MonitorSmartphone size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">Terminal POS</p>
                    <p className="text-gray-500 text-xs mt-0.5">Punto de venta y caja</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-600 group-hover:text-[#3b82f6] group-hover:translate-x-1 transition-all" />
                </button>
              </div>
            </div>
          )}

          {/* LOGIN FORM */}
          {(modo === 'login_erp' || modo === 'login_pos') && (
            <div className="animate-fadeIn">
              <button onClick={() => setModo('inicio')} className="flex items-center gap-2 text-gray-500 hover:text-white text-xs font-semibold mb-8 transition-colors">
                <ArrowLeft size={16} /> Volver
              </button>

              <h1 className="text-3xl font-bold tracking-tight mb-2">Iniciar Sesión</h1>
              <p className="text-gray-400 text-sm mb-8">Ingresa tus credenciales para acceder al sistema.</p>

              <form onSubmit={e => handleLoginSubmit(e, modo === 'login_erp' ? 'erp' : 'pos')} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Usuario / Correo</label>
                  <div className="relative">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text" required value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full bg-[#121212] border border-[#222] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] py-3.5 pl-11 pr-4 rounded-xl text-white focus:outline-none transition-all text-sm placeholder:text-gray-600"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Contraseña</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type={showPass ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                      className="w-full bg-[#121212] border border-[#222] focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] py-3.5 pl-11 pr-11 rounded-xl text-white focus:outline-none transition-all text-sm placeholder:text-gray-600"
                      placeholder="••••••••"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white focus:outline-none transition-colors">
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit" disabled={loadingAuth}
                  className="w-full py-3.5 mt-4 rounded-xl font-bold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 bg-[#3b82f6] hover:bg-[#2563eb]"
                >
                  {loadingAuth ? <><Loader2 size={18} className="animate-spin" /> Verificando...</> : 'Ingresar al sistema'}
                </button>
              </form>
            </div>
          )}

          {/* SETUP SEDE */}
          {modo === 'setup_sede' && (
            <div className="animate-fadeIn">
              <h2 className="text-3xl font-bold tracking-tight mb-2">Configurar Caja</h2>
              <p className="text-gray-400 text-sm mb-8">Selecciona la sucursal para este dispositivo.</p>
              
              <form onSubmit={handleSedeSetup} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">Sede / Local</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
                    <select
                      value={sedeSeleccionada} onChange={e => setSedeSeleccionada(e.target.value)} required
                      className="w-full bg-[#121212] border border-[#222] py-4 pl-11 pr-10 rounded-xl text-white focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] appearance-none font-semibold text-sm cursor-pointer transition-all relative z-0"
                    >
                      {sedesDisponibles.map(sede => (
                        <option key={sede.id} value={sede.id} className="bg-[#121212] text-white">{sede.nombre}</option>
                      ))}
                    </select>
                    <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 rotate-90 pointer-events-none z-10" />
                  </div>
                </div>
                
                <button type="submit" className="w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98] bg-[#3b82f6] hover:bg-[#2563eb]">
                  Vincular Dispositivo
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO */}
      <div className="hidden lg:flex flex-1 relative items-center justify-center bg-[#050505] overflow-hidden">
        
        <div className="absolute w-[800px] h-[800px] bg-[#3b82f6] opacity-[0.02] rounded-full blur-[120px] top-1/4 -right-20 pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] bg-[#3b82f6] opacity-[0.015] rounded-full blur-[100px] bottom-10 left-10 pointer-events-none" />

        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}></div>

        <div className="relative z-10 w-full max-w-lg perspective-1000">
          <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-2xl shadow-2xl p-6 transform rotate-y-[-5deg] rotate-x-[5deg] transition-transform duration-700 hover:rotate-0">
            
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#1e1e1e]">
              <div>
                <div className="h-5 w-32 bg-[#1a1a1a] rounded mb-2"></div>
                <div className="h-3 w-20 bg-[#121212] rounded"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 w-24 bg-[#121212] border border-[#1e1e1e] rounded-lg"></div>
                <div className="h-8 w-8 bg-[#3b82f6] rounded-lg"></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#121212] border border-[#1e1e1e] rounded-xl p-4">
                  <div className="h-2 w-16 bg-[#1a1a1a] rounded mb-3"></div>
                  <div className="h-6 w-24 bg-white/10 rounded mb-2"></div>
                </div>
              ))}
            </div>

            <div className="bg-[#121212] border border-[#1e1e1e] rounded-xl p-4 h-40 flex items-end gap-2">
              {[30, 50, 40, 70, 55, 90, 60, 80, 45, 100].map((h, i) => (
                <div key={i} className="flex-1 bg-[#1a1a1a] rounded-t-sm hover:bg-[#3b82f6]/50 transition-colors" style={{ height: `${h}%` }}></div>
              ))}
            </div>
          </div>

          <div className="absolute -right-8 -bottom-8 bg-[#121212] border border-[#1e1e1e] rounded-xl p-4 w-48 shadow-2xl flex items-center gap-3 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-[#3b82f6]"></div>
            <div className="flex-1">
              <div className="h-2 w-full bg-[#1a1a1a] rounded mb-1"></div>
              <div className="h-2 w-2/3 bg-[#1a1a1a] rounded"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Botón legal */}
      <a
        href="/legal.html"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#121212] border border-[#1e1e1e] hover:border-[#3b82f6]/50 text-gray-500 hover:text-[#3b82f6] px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
      >
        <AlertCircle size={12} />
        Legal
      </a>

    </div>
  );
}