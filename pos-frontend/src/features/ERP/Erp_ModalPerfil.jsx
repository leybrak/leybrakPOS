import React, { useState } from 'react';
import api from '../../api/api';
import { useToast } from '../../context/ToastContext';

export default function Erp_ModalPerfil({ isOpen, onClose, isDark, colorPrimario, usuarioNombre, usuarioAvatar, onPerfilActualizado }) {
  const toast = useToast();

  const [nombre, setNombre] = useState(usuarioNombre || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(usuarioAvatar || null);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);

  if (!isOpen) return null;

  const handleGuardarPerfil = async () => {
    const negocioId = localStorage.getItem('negocio_id');
    if (!negocioId) return;

    setGuardandoPerfil(true);
    try {
      const formData = new FormData();
      formData.append('nombre_propietario', nombre || '');
      if (avatarFile) formData.append('avatar_propietario', avatarFile);

      const res = await api.patch(`/negocios/${negocioId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const nombreGuardado = res.data.nombre_propietario || nombre;
      const avatarGuardado = res.data.avatar_propietario || avatarPreview;

      localStorage.setItem('usuario_nombre', nombreGuardado);
      if (avatarGuardado) localStorage.setItem('usuario_avatar', avatarGuardado);

      onPerfilActualizado?.({ nombre: nombreGuardado, avatar: avatarGuardado });
      toast.success('Perfil actualizado correctamente.');
    } catch {
      toast.error('No se pudo actualizar el perfil.');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  const handleCambiarPassword = async () => {
    if (!passwordActual || !passwordNueva) {
      return toast.error('Completa tu contraseña actual y la nueva.');
    }
    if (passwordNueva.length < 8) {
      return toast.error('La nueva contraseña debe tener al menos 8 caracteres.');
    }
    if (passwordNueva !== passwordConfirmar) {
      return toast.error('Las contraseñas nuevas no coinciden.');
    }

    setCambiandoPassword(true);
    try {
      await api.post('/negocios/cambiar_password/', {
        password_actual: passwordActual,
        password_nueva: passwordNueva,
      });
      toast.success('Contraseña actualizada correctamente.');
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordConfirmar('');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setCambiandoPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`w-full max-w-md rounded-2xl border p-6 max-h-[90vh] overflow-y-auto ${isDark ? 'bg-[#111] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Mi Perfil</h3>
          <button onClick={onClose} className={isDark ? 'text-neutral-500 hover:text-white' : 'text-gray-400 hover:text-gray-900'}>
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>

        {/* Avatar y nombre */}
        <div className="flex items-center gap-4 mb-6">
          <label className="relative cursor-pointer group shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-white text-2xl shadow-md overflow-hidden"
              style={{ backgroundColor: colorPrimario }}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                (nombre || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <i className="fi fi-rr-camera text-white text-sm"></i>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files[0]) {
                  setAvatarFile(e.target.files[0]);
                  setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                }
              }}
            />
          </label>
          <div className="flex-1 min-w-0">
            <label className={`text-[10px] font-black uppercase tracking-widest mb-1.5 block ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className="w-full border px-3 py-2.5 rounded-xl outline-none font-bold text-sm transition-colors focus:border-current"
              style={{ background: isDark ? '#0a0a0a' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#fff' : '#000' }}
            />
          </div>
        </div>

        <button
          onClick={handleGuardarPerfil}
          disabled={guardandoPerfil}
          style={{ backgroundColor: colorPrimario }}
          className="w-full py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 mb-6"
        >
          {guardandoPerfil ? 'Guardando…' : 'Guardar Perfil'}
        </button>

        <div className={`h-px mb-6 ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-200'}`}></div>

        {/* Cambiar contraseña */}
        <h4 className={`text-xs font-black uppercase tracking-widest mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
          Cambiar contraseña
        </h4>
        <div className="space-y-3 mb-4">
          <input
            type="password"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            placeholder="Contraseña actual"
            className="w-full border px-4 py-2.5 rounded-xl outline-none font-bold text-sm transition-colors focus:border-current"
            style={{ background: isDark ? '#0a0a0a' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#fff' : '#000' }}
          />
          <input
            type="password"
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            className="w-full border px-4 py-2.5 rounded-xl outline-none font-bold text-sm transition-colors focus:border-current"
            style={{ background: isDark ? '#0a0a0a' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#fff' : '#000' }}
          />
          <input
            type="password"
            value={passwordConfirmar}
            onChange={(e) => setPasswordConfirmar(e.target.value)}
            placeholder="Confirmar nueva contraseña"
            className="w-full border px-4 py-2.5 rounded-xl outline-none font-bold text-sm transition-colors focus:border-current"
            style={{ background: isDark ? '#0a0a0a' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#fff' : '#000' }}
          />
        </div>
        <button
          onClick={handleCambiarPassword}
          disabled={cambiandoPassword}
          className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all active:scale-95 disabled:opacity-50 ${isDark ? 'border-[#333] text-neutral-300 hover:bg-[#1a1a1a]' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          {cambiandoPassword ? 'Actualizando…' : 'Cambiar Contraseña'}
        </button>
      </div>
    </div>
  );
}
