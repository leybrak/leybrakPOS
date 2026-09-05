import React, { useState, useEffect } from 'react';
import { getRendimientoEmpleados } from '../../api/api'; // ← agregar al import
import { 
  Users, MapPin, Plus, Edit2, UserX, UserCheck, 
  Trophy, Star, Shield, Banknote, Utensils, Briefcase,
  ChevronLeft, ChevronRight, TrendingUp, ShoppingBag
} from 'lucide-react';
  function RendimientoTabla({ isDark, colorPrimario, sedeFiltroId, esDueño, sedesReales }) {
    const hoy = new Date();
    const [mes, setMes] = useState(hoy.getMonth() + 1);
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [sedeFiltro, setSedeFiltro] = useState(sedeFiltroId || '');
    const [datos, setDatos] = useState([]);
    const [cargando, setCargando] = useState(true);

    const MESES = [
      'Enero','Febrero','Marzo','Abril','Mayo','Junio',
      'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];

    useEffect(() => {
      setSedeFiltro(sedeFiltroId || '');
    }, [sedeFiltroId]);

    useEffect(() => {
      const cargar = async () => {
        setCargando(true);
        try {
          const params = { mes, anio };
          if (sedeFiltro) params.sede_id = sedeFiltro;
          const res = await getRendimientoEmpleados(params);
          setDatos(res.data.rendimiento || []);
        } catch {
          setDatos([]);
        } finally {
          setCargando(false);
        }
      };
      cargar();
    }, [mes, anio, sedeFiltro]);

    const irMesAnterior = () => {
      if (mes === 1) { setMes(12); setAnio(a => a - 1); }
      else setMes(m => m - 1);
    };

    const irMesSiguiente = () => {
      const esHoy = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();
      if (esHoy) return; // No ir al futuro
      if (mes === 12) { setMes(1); setAnio(a => a + 1); }
      else setMes(m => m + 1);
    };

    const esMesActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();

    return (
      <div className={`rounded-[2rem] p-6 lg:p-8 border transition-all mt-8 ${
        isDark ? 'bg-[#161616] border-[#2a2a2a]' : 'bg-white border-gray-200 shadow-sm'
      }`}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <h4 className={`text-xl font-black flex items-center gap-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Trophy size={24} style={{ color: colorPrimario }} />
            Rendimiento del Equipo
          </h4>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro sede (solo dueño con varias sedes) */}
            {esDueño && sedesReales.length > 1 && (
              <select
                value={sedeFiltro}
                onChange={e => setSedeFiltro(e.target.value)}
                className={`text-xs font-bold px-3 py-2 rounded-xl border outline-none cursor-pointer ${
                  isDark ? 'bg-[#111] border-[#333] text-white' : 'bg-gray-50 border-gray-200 text-gray-800'
                }`}
              >
                <option value="">Todas las sedes</option>
                {sedesReales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}

            {/* Navegador de mes */}
            <div className={`flex items-center gap-1 rounded-xl border px-1 py-1 ${
              isDark ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'
            }`}>
              <button
                onClick={irMesAnterior}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-[#222] text-neutral-400' : 'hover:bg-gray-200 text-gray-500'
                }`}
              >
                <ChevronLeft size={16} />
              </button>
              <span className={`text-xs font-black px-3 min-w-[120px] text-center ${
                isDark ? 'text-white' : 'text-gray-800'
              }`}>
                {MESES[mes - 1]} {anio}
              </span>
              <button
                onClick={irMesSiguiente}
                disabled={esMesActual}
                className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
                  isDark ? 'hover:bg-[#222] text-neutral-400' : 'hover:bg-gray-200 text-gray-500'
                }`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabla */}
        {cargando ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: colorPrimario, borderTopColor: 'transparent' }} />
          </div>
        ) : datos.length === 0 ? (
          <div className={`py-16 text-center rounded-2xl border-2 border-dashed ${
            isDark ? 'border-[#222]' : 'border-gray-200'
          }`}>
            <TrendingUp size={40} className={`mx-auto mb-3 ${isDark ? 'text-neutral-700' : 'text-gray-300'}`} />
            <p className={`font-bold text-sm ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              Sin actividad registrada en {MESES[mes - 1]} {anio}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                  {['#', 'Empleado', 'Rol', 'Sede', 'Órdenes', 'Ingresos Generados', 'Último Ingreso'].map(h => (
                    <th key={h} className={`pb-4 font-black uppercase tracking-widest text-[10px] ${
                      h === 'Ingresos Generados' || h === 'Último Ingreso' ? 'text-right' : 
                      h === 'Órdenes' ? 'text-center' : ''
                    } ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.map((emp, i) => (
                  <tr key={emp.id} className={`border-b transition-colors ${
                    isDark ? 'border-[#222] hover:bg-[#111]' : 'border-gray-100 hover:bg-gray-50'
                  }`}>
                    {/* Posición */}
                    <td className="py-4 w-8">
                      {i === 0
                        ? <Star size={16} className="text-yellow-500 fill-yellow-500" />
                        : <span className={`text-xs font-black ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>{i + 1}</span>
                      }
                    </td>

                    {/* Nombre */}
                    <td className={`py-4 font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {emp.nombre}
                    </td>

                    {/* Rol */}
                    <td className="py-4">
                      <span className={`text-[10px] px-2.5 py-1 rounded-md uppercase font-black tracking-widest border ${
                        isDark ? 'bg-[#1a1a1a] text-neutral-400 border-[#333]' : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {emp.rol}
                      </span>
                    </td>

                    {/* Sede */}
                    <td className={`py-4 text-xs font-bold ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                      {emp.sede}
                    </td>

                    {/* Órdenes */}
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <ShoppingBag size={13} className={isDark ? 'text-neutral-500' : 'text-gray-400'} />
                        <span className={`font-mono font-bold text-sm ${
                          emp.total_ordenes > 0
                            ? (isDark ? 'text-white' : 'text-gray-900')
                            : (isDark ? 'text-neutral-600' : 'text-gray-300')
                        }`}>
                          {emp.total_ordenes}
                        </span>
                      </div>
                    </td>

                    {/* Ingresos */}
                    <td className="py-4 text-right">
                      <span className={`font-black text-sm tracking-wide ${
                        emp.total_ingresos > 0 ? 'text-green-500' : (isDark ? 'text-neutral-600' : 'text-gray-300')
                      }`}>
                        {emp.total_ingresos > 0 ? `S/ ${emp.total_ingresos.toFixed(2)}` : '—'}
                      </span>
                    </td>

                    {/* Último ingreso */}
                    <td className={`py-4 text-right text-xs font-bold ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
                      {emp.ultimo_ingreso
                        ? new Date(emp.ultimo_ingreso).toLocaleDateString('es-PE', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
export default function Erp_Personal({
  config,
  empleadosReales,
  sedesReales,
  onNuevoEmpleado,
  sedeFiltroId, 
  onCambiarSedeFiltro,
  onEditarEmpleado,
  onToggleActivo
}) {

  // ==========================================
  // 🛡️ SEGURIDAD DE ROLES (FRONTEND)
  // ==========================================
  const rolUsuario = localStorage.getItem('usuario_rol')?.toLowerCase() || '';
  const esDueño = rolUsuario === 'dueño'; 
  const sedeActualId = localStorage.getItem('sede_id');

  const isDark = config?.temaFondo === 'dark';
  const colorPrimario = config?.colorPrimario || '#ff5a1f';

  // ==========================================
  // 🧠 MOTOR DE FILTRADO INTELIGENTE
  // ==========================================
  const empleadosFiltrados = empleadosReales.filter(emp => {
    if (!esDueño) {
      // 🔒 REGLA ADMIN: Solo pasa si el empleado pertenece a la sede actual del Admin
      return String(emp.sede) === String(sedeActualId);
    } else {
      // 🌍 REGLA DUEÑO: Pasan los del filtro seleccionado, o todos si no hay filtro
      return sedeFiltroId ? String(emp.sede) === String(sedeFiltroId) : true;
    }
  });

  // Helper para asignar un ícono profesional según el rol
  const getRoleIcon = (rolName) => {
    const name = (rolName || '').toLowerCase();
    if (name.includes('admin')) return <Shield size={22} />;
    if (name.includes('cajer')) return <Banknote size={22} />;
    if (name.includes('cocin')) return <Utensils size={22} />;
    return <Briefcase size={22} />;
  };

  return (
    <div className="animate-fadeIn space-y-6 pb-20">
      
      {/* ========== 🏗️ 1. CABECERA INTEGRADA ========== */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 pt-2 pb-6 border-b" style={{ borderColor: isDark ? '#222' : '#e5e7eb' }}>
        
        {/* ✨ Título e Ícono */}
        <div className="flex items-center gap-5">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}
          >
            <Users size={32} strokeWidth={1.5} />
          </div>
          <div>
            <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Equipo de <span style={{ color: colorPrimario }}>Trabajo</span>
            </h2>
            <p className={`text-sm mt-1 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              {esDueño ? 'Gestiona accesos, edita perfiles y mide el rendimiento global.' : 'Consulta el equipo asignado a tu sede.'}
            </p>
          </div>
        </div>
        
        {/* ✨ CONTROLES DE DUEÑO */}
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full xl:w-auto">
          {esDueño ? (
            sedesReales.length > 1 && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border w-full sm:w-auto transition-colors ${
                isDark ? 'bg-[#111] border-[#333] hover:border-[#444]' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}>
                <MapPin size={18} className={isDark ? 'text-neutral-400' : 'text-gray-400'} />
                <select 
                  value={sedeFiltroId || ''}
                  onChange={(e) => onCambiarSedeFiltro(e.target.value)}
                  className={`bg-transparent outline-none font-bold text-sm w-full cursor-pointer appearance-none pr-4 ${
                    isDark ? 'text-white' : 'text-gray-800'
                  }`}
                >
                  <option value="" className={isDark ? 'bg-[#111]' : ''}>Todas las Sedes</option>
                  {sedesReales.map(s => <option key={s.id} value={s.id} className={isDark ? 'bg-[#111]' : ''}>{s.nombre}</option>)}
                </select>
              </div>
            )
          ) : (
            <div className={`flex items-center px-5 py-3 rounded-xl border shrink-0 ${
              isDark ? 'bg-[#111] border-[#333]' : 'bg-gray-50 border-gray-200'
            }`}>
              <MapPin size={18} className={`mr-2 ${isDark ? 'text-neutral-400' : 'text-gray-400'}`} />
              <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
                Sede Activa: 
                <span className={`ml-2 font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {localStorage.getItem('sede_nombre') || 'Local Principal'}
                </span>
              </span>
            </div>
          )}

          {esDueño && (
            <button 
              onClick={onNuevoEmpleado}
              style={{ backgroundColor: colorPrimario }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus size={16} strokeWidth={3} /> Nuevo Empleado
            </button>
          )}
        </div>
      </div>

      {/* ========== LISTADO DE EMPLEADOS ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {empleadosFiltrados.length === 0 && (
          <div className={`col-span-full py-16 text-center border-2 border-dashed rounded-3xl flex flex-col items-center justify-center ${
            isDark ? 'border-[#222] bg-[#111]' : 'border-gray-200 bg-gray-50'
          }`}>
            <Users size={48} className={`mb-4 ${isDark ? 'text-neutral-700' : 'text-gray-300'}`} />
            <h3 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>Sin personal</h3>
            <p className={isDark ? 'text-neutral-500' : 'text-gray-500'}>
              Aún no hay empleados registrados en esta sede.
            </p>
          </div>
        )}
        
        {empleadosFiltrados.map(emp => (
          <div 
            key={emp.id} 
            className={`p-5 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
              isDark
                ? 'bg-[#161616] border border-[#2a2a2a] hover:border-[#444]'
                : 'bg-white border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md'
            } ${!emp.activo ? 'opacity-50 grayscale hover:grayscale-0' : ''}`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${
                isDark ? 'bg-[#111] border-[#222] text-neutral-300' : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}>
                {getRoleIcon(emp.rol_nombre)}
              </div>
              
              <div>
                <h4 className={`font-black text-lg leading-tight mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'} ${!emp.activo ? 'line-through' : ''}`}>
                  {emp.nombre}
                </h4>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase tracking-widest ${
                    isDark ? 'bg-[#111] text-neutral-300 border-[#333]' : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}>
                    {emp.rol_nombre || 'Sin Rol'}
                  </span>
                  
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase tracking-widest ${
                    emp.activo 
                      ? (isDark ? 'text-green-400 border-green-500/20 bg-green-500/10' : 'text-green-600 border-green-200 bg-green-50')
                      : (isDark ? 'text-red-400 border-red-500/20 bg-red-500/10' : 'text-red-600 border-red-200 bg-red-50')
                  }`}>
                    {emp.activo ? 'ACTIVO' : 'INACTIVO'}
                  </span>

                  {sedesReales.length > 1 && (
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase tracking-widest flex items-center gap-1 ${
                      isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200'
                    }`}>
                      <MapPin size={10} /> {sedesReales.find(s => String(s.id) === String(emp.sede))?.nombre || 'Matriz'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full sm:w-auto flex sm:flex-col justify-between sm:items-end mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-[#2a2a2a] sm:border-transparent">
              
              {/* El registro del propio Dueño (auto-creado por login_movil) no se
                  puede editar/desactivar desde acá — ni tendría sentido (su rol
                  ya no aparece como opción) ni el backend lo permitiría. */}
              {esDueño && emp.rol_nombre?.trim().toLowerCase() !== 'dueño' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditarEmpleado(emp)}
                    className={`p-2 rounded-lg border transition-all ${
                      isDark ? 'bg-[#111] border-[#333] hover:bg-[#222]' : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    style={{ color: colorPrimario }}
                    title="Editar Perfil"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => onToggleActivo(emp)}
                    className={`p-2 rounded-lg border transition-all ${
                      emp.activo 
                        ? (isDark ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100')
                        : (isDark ? 'bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500/20' : 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100')
                    }`}
                    title={emp.activo ? 'Desactivar Usuario' : 'Reactivar Usuario'}
                  >
                    {emp.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ========== TABLA DE RENDIMIENTO ========== */}
      <RendimientoTabla
        isDark={isDark}
        colorPrimario={colorPrimario}
        sedeFiltroId={sedeFiltroId}
        esDueño={esDueño}
        sedesReales={sedesReales}
      />

    </div>
  );
}