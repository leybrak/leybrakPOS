import React, { useState, useEffect } from 'react';
import { Building2, Search, Upload, Smartphone, CreditCard, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../../api/api';
import { useToast } from '../../context/ToastContext';

export default function Tab_Perfil({ config, setConfig, isDark, colorPrimario }) {
  const [buscandoRuc, setBuscandoRuc] = useState(false);
  const toast = useToast();

  const consultarSunat = async () => {
    if (!config.ruc || config.ruc.length !== 11) {
      return toast.error('⚠️ El RUC debe tener exactamente 11 dígitos.');
    }
    setBuscandoRuc(true);
    try {
      const response = await api.get(`/negocios/consultar_ruc/${config.ruc}/`);
      const data = response.data;
      if (data.estado !== 'ACTIVO') {
        toast.error(`❌ El RUC se encuentra ${data.estado}.`);
        setConfig({ ...config, razon_social: '' });
      } else {
        setConfig({ ...config, razon_social: data.razon_social });
      }
    } catch {
      toast.error('❌ No se pudo consultar SUNAT. Verifica el RUC o intenta más tarde.');
    } finally {
      setBuscandoRuc(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">

      {/* ========================================== */}
      {/* 🏛️ 1. IDENTIDAD LEGAL Y COMERCIAL          */}
      {/* ========================================== */}
      <div className={`lg:col-span-2 p-6 md:p-8 rounded-[2rem] border shadow-sm ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl border" style={{ backgroundColor: isDark ? '#1a1a1a' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb' }}>
            <Building2 size={20} style={{ color: colorPrimario }} />
          </div>
          <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Identidad Comercial</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* RUC */}
          <div>
            <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>RUC / NIT</label>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength="11"
                value={config.ruc || ''}
                onChange={(e) => setConfig({ ...config, ruc: e.target.value.replace(/\D/g, '') })}
                className="w-full border px-4 py-3 rounded-xl outline-none font-mono font-bold text-sm transition-colors focus:border-current"
                style={{ background: isDark ? '#0a0a0a' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#fff' : '#000' }}
                placeholder="Ej. 20123456789"
              />
              <button
                type="button"
                onClick={consultarSunat}
                disabled={buscandoRuc || !config.ruc}
                style={{ backgroundColor: colorPrimario }}
                className="px-4 py-3 rounded-xl text-white font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
                title="Buscar en SUNAT"
              >
                {buscandoRuc ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} strokeWidth={2.5} />}
              </button>
            </div>
          </div>

          {/* RAZÓN SOCIAL */}
          <div>
            <label className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              Razón Social / Propietario <Lock size={10} />
            </label>
            <input
              type="text"
              disabled
              value={config.razon_social || ''}
              className="w-full border px-4 py-3 rounded-xl outline-none font-bold text-sm cursor-not-allowed opacity-70"
              style={{ background: isDark ? '#1a1a1a' : '#f3f4f6', borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#9ca3af' : '#6b7280' }}
              placeholder="Se completa con SUNAT"
            />
          </div>

          {/* CELULAR DEL DUEÑO */}
          <div>
            <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              Celular del dueño (número principal)
            </label>
            <input
              type="text"
              value={config.telefono_propietario || ''}
              onChange={(e) => setConfig({ ...config, telefono_propietario: e.target.value.replace(/\D/g, '') })}
              className="w-full border px-4 py-3 rounded-xl outline-none font-bold text-sm transition-colors focus:border-current"
              style={{ background: isDark ? '#0a0a0a' : '#f9fafb', borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#fff' : '#000' }}
              placeholder="Ej. 987654321"
            />
          </div>
        </div>

        {/* LOGO */}
        <div>
          <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Logo del Restaurante</label>
          <div className={`border-2 border-dashed rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:justify-start justify-center gap-6 transition-colors ${isDark ? 'border-[#333] hover:border-[#444] bg-[#161616]' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}`}>
            <div className={`w-24 h-24 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0 shadow-inner ${isDark ? 'border-[#444] bg-[#0a0a0a]' : 'border-gray-200 bg-white'}`}>
              {config.logoPreview || (config.logo && typeof config.logo === 'string') ? (
                <img src={config.logoPreview || config.logo} className="w-full h-full object-cover" alt="Logo" />
              ) : (
                <Building2 size={32} className={isDark ? 'text-neutral-700' : 'text-gray-300'} />
              )}
            </div>
            <div className="text-center sm:text-left">
              <label className="px-5 py-2.5 rounded-xl text-xs font-bold border transition-all mb-2 cursor-pointer inline-flex items-center gap-2 hover:opacity-80 shadow-sm"
                style={{ backgroundColor: isDark ? '#222' : '#fff', borderColor: isDark ? '#444' : '#d1d5db', color: isDark ? '#fff' : '#000' }}>
                <Upload size={14} /> Subir nuevo logo
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    if (e.target.files[0]) {
                      setConfig({ ...config, logoFile: e.target.files[0], logoPreview: URL.createObjectURL(e.target.files[0]) });
                    }
                  }}
                />
              </label>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>Formatos: JPG, PNG. Max 2MB.</p>
            </div>
          </div>
        </div>
      </div>

      {/* COLUMNA DERECHA */}
      <div className="space-y-6">

        {/* ========================================== */}
        {/* 📱 2. BILLETERAS DIGITALES                 */}
        {/* ========================================== */}
        <div className={`p-6 md:p-8 rounded-[2rem] border shadow-sm flex flex-col ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl border bg-purple-500/10 border-purple-500/20 text-purple-500">
              <Smartphone size={20} />
            </div>
            <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Billeteras</h3>
          </div>

          <div className="space-y-6 flex-1">
            {/* YAPE */}
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#161616] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
              <label className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                <span className="w-2 h-2 rounded-full bg-[#74089c]"></span> Yape
              </label>
              <input
                type="tel"
                value={config.yape_numero || ''}
                onChange={(e) => setConfig({ ...config, yape_numero: e.target.value })}
                className="w-full border px-4 py-2.5 rounded-xl outline-none font-bold text-sm transition-colors mb-3"
                style={{ background: isDark ? '#0a0a0a' : '#fff', borderColor: isDark ? '#444' : '#d1d5db', color: isDark ? '#fff' : '#000', outlineColor: '#74089c' }}
                placeholder="Número de Yape"
              />
              <label className={`border border-dashed rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${isDark ? 'border-[#444] hover:border-[#74089c] bg-[#0a0a0a]' : 'border-gray-300 hover:border-[#74089c] bg-white'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  if (e.target.files[0]) setConfig({ ...config, yape_qrFile: e.target.files[0], yape_qrPreview: URL.createObjectURL(e.target.files[0]) });
                }} />
                {config.yape_qrPreview || (config.yape_qr && typeof config.yape_qr === 'string') ? (
                  <div className="flex flex-col items-center">
                    <img src={config.yape_qrPreview || config.yape_qr} alt="QR Yape" className="w-16 h-16 object-contain rounded-lg mb-1" />
                    <span className="text-[10px] font-black text-green-500 flex items-center gap-1"><CheckCircle2 size={12} /> QR Cargado</span>
                  </div>
                ) : (
                  <span className={`text-[10px] font-bold ${isDark ? 'text-neutral-500' : 'text-gray-500'} flex items-center gap-1`}><Upload size={14} /> Subir QR Yape</span>
                )}
              </label>
            </div>

            {/* PLIN */}
            <div className={`p-4 rounded-2xl border ${isDark ? 'bg-[#161616] border-[#333]' : 'bg-gray-50 border-gray-200'}`}>
              <label className={`text-[10px] font-black uppercase tracking-widest mb-3 flex items-center gap-2 ${isDark ? 'text-neutral-400' : 'text-gray-600'}`}>
                <span className="w-2 h-2 rounded-full bg-[#00e3a6]"></span> Plin
              </label>
              <input
                type="tel"
                value={config.plin_numero || ''}
                onChange={(e) => setConfig({ ...config, plin_numero: e.target.value })}
                className="w-full border px-4 py-2.5 rounded-xl outline-none font-bold text-sm transition-colors mb-3"
                style={{ background: isDark ? '#0a0a0a' : '#fff', borderColor: isDark ? '#444' : '#d1d5db', color: isDark ? '#fff' : '#000', outlineColor: '#00e3a6' }}
                placeholder="Número de Plin"
              />
              <label className={`border border-dashed rounded-xl p-3 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${isDark ? 'border-[#444] hover:border-[#00e3a6] bg-[#0a0a0a]' : 'border-gray-300 hover:border-[#00e3a6] bg-white'}`}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  if (e.target.files[0]) setConfig({ ...config, plin_qrFile: e.target.files[0], plin_qrPreview: URL.createObjectURL(e.target.files[0]) });
                }} />
                {config.plin_qrPreview || (config.plin_qr && typeof config.plin_qr === 'string') ? (
                  <div className="flex flex-col items-center">
                    <img src={config.plin_qrPreview || config.plin_qr} alt="QR Plin" className="w-16 h-16 object-contain rounded-lg mb-1" />
                    <span className="text-[10px] font-black text-green-500 flex items-center gap-1"><CheckCircle2 size={12} /> QR Cargado</span>
                  </div>
                ) : (
                  <span className={`text-[10px] font-bold ${isDark ? 'text-neutral-500' : 'text-gray-500'} flex items-center gap-1`}><Upload size={14} /> Subir QR Plin</span>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* ⚡ 3. AUTOMATIZACIÓN YAPE / PLIN           */}
        {/* ========================================== */}
        <div className={`p-6 md:p-8 rounded-[2rem] border shadow-sm ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${config.confirmacion_automatica ? 'bg-green-500/10 border-green-500/20 text-green-500' : isDark ? 'bg-[#1a1a1a] border-[#333] text-neutral-400' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                <Smartphone size={20} />
              </div>
              <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Auto-validación</h3>
            </div>
            {/* Toggle */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.confirmacion_automatica || false}
                onChange={(e) => setConfig({ ...config, confirmacion_automatica: e.target.checked })}
              />
              <div
                className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isDark ? 'bg-[#333]' : 'bg-gray-300'}`}
                style={config.confirmacion_automatica ? { backgroundColor: colorPrimario } : {}}
              />
            </label>
          </div>

          <p className={`text-xs mb-4 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
            Activa la validación automática de Yape y Plin mediante la App Leybrak instalada en el celular del negocio.
          </p>

          {config.confirmacion_automatica && (
            <div className={`p-3 rounded-xl ${isDark ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
              <p className={`text-xs ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                ✓ Captura notificaciones push de Yape y Plin<br />
                ✓ Confirmación con un clic en la pantalla del cajero<br />
                ✓ Código de seguridad de 3 dígitos anti-fraude<br />
                ✓ 0% de comisión — el dinero va directo a tu cuenta
              </p>
            </div>
          )}

          {/* Device Token — solo lectura, para configurar la app Android */}
          {config.confirmacion_automatica && config.device_token && (
            <div className="mt-4">
              <label className={`text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
                Token de la App Android <Lock size={10} />
              </label>
              <div className={`flex items-center gap-2 p-3 rounded-xl border font-mono text-xs break-all ${isDark ? 'bg-[#0a0a0a] border-[#333] text-neutral-400' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                {config.device_token}
              </div>
              <p className={`text-[10px] mt-1 ${isDark ? 'text-neutral-600' : 'text-gray-400'}`}>
                Pega este token en la App Leybrak del celular del negocio.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}