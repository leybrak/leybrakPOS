import React from 'react';
import {
  Armchair, Users, FileText, ChefHat, Truck,
  Package, QrCode, Bot, BrainCircuit, Lock, ArrowRight
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Definición de módulos
// key_config  → campo en config (mod_*_activo) que se guarda en Django
// key_plan    → campo en plan_detalles que indica si el plan lo incluye
//               null = módulo base, siempre disponible
// ─────────────────────────────────────────────────────────────
const MODULOS = [
  {
    key_config: 'mod_salon_activo',
    key_plan:   null,
    icon:       Armchair,
    color:      '#f59e0b',
    title:      'Gestión de Salón',
    desc:       'Mapa interactivo de mesas y control de cuentas en tiempo real.',
  },
  {
    key_config: 'mod_clientes_activo',
    key_plan:   null,
    icon:       Users,
    color:      '#3b82f6',
    title:      'Directorio CRM',
    desc:       'Base de datos de clientes para fidelización y seguimiento.',
  },
  {
    key_config: 'mod_facturacion_activo',
    key_plan:   null,
    icon:       FileText,
    color:      '#6b7280',
    title:      'Facturación Electrónica',
    desc:       'Emite boletas y facturas electrónicas válidas ante SUNAT.',
  },
  {
    key_config: 'mod_cocina_activo',
    key_plan:   'modulo_kds',
    badge:      'PRO',
    badgeColor: '#f59e0b',
    icon:       ChefHat,
    color:      '#f59e0b',
    title:      'Pantalla KDS',
    desc:       'Despacho en tiempo real para cocineros. Sin papel, sin confusiones.',
  },
  {
    key_config: 'mod_delivery_activo',
    key_plan:   'modulo_delivery',
    badge:      'PRO',
    badgeColor: '#f59e0b',
    icon:       Truck,
    color:      '#8b5cf6',
    title:      'Módulo Delivery',
    desc:       'Gestión completa de despachos externos y seguimiento.',
  },
  {
    key_config: 'mod_inventario_activo',
    key_plan:   'modulo_inventario',
    badge:      'PRO',
    badgeColor: '#f59e0b',
    icon:       Package,
    color:      '#10b981',
    title:      'Control de Inventario',
    desc:       'Descuenta insumos automáticamente y genera alertas de stock bajo.',
  },
  {
    key_config: 'mod_carta_qr_activo',
    key_plan:   'modulo_carta_qr',
    badge:      'PREMIUM',
    badgeColor: '#3b82f6',
    icon:       QrCode,
    color:      '#3b82f6',
    title:      'Menú Digital QR',
    desc:       'Carta digital escaneable en mesas y para pedidos de delivery.',
  },
  {
    key_config: 'mod_bot_wsp_activo',
    key_plan:   'modulo_bot_wsp',
    badge:      'BETA',
    badgeColor: '#22c55e',
    icon:       Bot,
    color:      '#22c55e',
    title:      'Bot WhatsApp',
    desc:       'Recibe y gestiona pedidos automáticamente por WhatsApp.',
  },
  {
    key_config: 'mod_ml_activo',
    key_plan:   'modulo_ml',
    badge:      'ENTERPRISE',
    badgeColor: '#ec4899',
    icon:       BrainCircuit,
    color:      '#ec4899',
    title:      'Predicciones IA',
    desc:       'Anticípate a la demanda con Machine Learning sobre tus ventas.',
  },
];

const COLORES_PRESET = [
  '#ff5a1f', '#3b82f6', '#10b981',
  '#eab308', '#8b5cf6', '#ec4899',
];

// Mantiene sincronía entre snake_case (Tab_Modulos) y camelCase (manejarGuardarConfig)
const SYNC_MAP = {
  mod_salon_activo:       'modSalon',
  mod_cocina_activo:      'modCocina',
  mod_inventario_activo:  'modInventario',
  mod_delivery_activo:    'modDelivery',
  mod_clientes_activo:    'modClientes',
  mod_facturacion_activo: 'modFacturacion',
  mod_carta_qr_activo:    'modCartaQr',
  mod_bot_wsp_activo:     'modBotWsp',
  mod_ml_activo:          'modMl',
};

// Llave de cada módulo en config.modulos_globales (interruptor único de Leybrak)
const GLOBAL_KEY_MAP = {
  mod_salon_activo:       'salon',
  mod_cocina_activo:      'cocina',
  mod_inventario_activo:  'inventario',
  mod_delivery_activo:    'delivery',
  mod_clientes_activo:    'clientes',
  mod_facturacion_activo: 'facturacion',
  mod_carta_qr_activo:    'cartaQr',
  mod_bot_wsp_activo:     'botWsp',
  mod_ml_activo:          'machineLearning',
};

// ─────────────────────────────────────────────────────────────
// Toggle switch reutilizable
// ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled, color }) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <div
        className={`w-11 h-6 rounded-full transition-colors peer
          after:content-[''] after:absolute after:top-[2px] after:left-[2px]
          after:bg-white after:border after:border-gray-300 after:rounded-full
          after:h-5 after:w-5 after:transition-all
          peer-checked:after:translate-x-full
          ${disabled ? 'opacity-30' : ''}
          bg-[#333]`}
        style={checked && !disabled ? { backgroundColor: color } : {}}
      />
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// Tarjeta de módulo
// ─────────────────────────────────────────────────────────────
function TarjetaModulo({ mod, config, setConfig, isDark, colorPrimario }) {
  // ¿El plan incluye este módulo? (null = base, siempre sí)
  const enPlan    = mod.key_plan === null
    ? true
    : config.plan_detalles?.[mod.key_plan] === true;

  // Interruptor único de Leybrak: si está apagado, se oculta en TODOS los
  // negocios sin importar su plan ni lo que el dueño haya activado.
  const habilitadoGlobalmente = config.modulos_globales?.[GLOBAL_KEY_MAP[mod.key_config]] ?? true;

  const isActive  = config[mod.key_config] === true;
  const Icon      = mod.icon;
  const bloqueado = !enPlan || !habilitadoGlobalmente;

  const handleToggle = () => {
    if (bloqueado) return;
    const nuevoValor = !isActive;
    const camelKey   = SYNC_MAP[mod.key_config];
    setConfig({
      ...config,
      [mod.key_config]: nuevoValor,
      ...(camelKey ? { [camelKey]: nuevoValor } : {}),
    });
  };

  return (
    <div
      className={`relative flex items-start justify-between gap-4 p-5 rounded-2xl border transition-all ${
        bloqueado
          ? isDark
            ? 'bg-[#0f0f0f] border-[#222] opacity-60'
            : 'bg-gray-50/50 border-gray-100 opacity-60'
          : isActive
            ? isDark
              ? 'bg-[#1a1a1a] border-[#2a2a2a]'
              : 'bg-white border-gray-200 shadow-sm'
            : isDark
              ? 'bg-[#161616] border-[#2a2a2a]'
              : 'bg-gray-50 border-gray-200'
      }`}
    >
      {/* Franja de color activa */}
      {isActive && !bloqueado && (
        <div
          className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full"
          style={{ backgroundColor: mod.color }}
        />
      )}

      <div className="flex items-start gap-3 flex-1 min-w-0">
        {/* Ícono */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{
            backgroundColor: (isActive && !bloqueado) ? mod.color + '20' : isDark ? '#222' : '#f3f4f6',
            color: (isActive && !bloqueado) ? mod.color : isDark ? '#555' : '#9ca3af',
          }}
        >
          <Icon size={16} />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {mod.title}
            </h4>
            {mod.badge && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest border"
                style={{ color: mod.badgeColor, backgroundColor: mod.badgeColor + '20', borderColor: mod.badgeColor + '40' }}
              >
                {mod.badge}
              </span>
            )}
          </div>
          <p className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
            {mod.desc}
          </p>

          {/* Aviso: apagado por Leybrak (prioridad) o no incluido en el plan */}
          {bloqueado && (
            <div className="flex items-center gap-1.5 mt-2">
              <Lock size={10} className="text-amber-500 shrink-0" />
              <p className="text-[10px] font-black text-amber-500">
                {!habilitadoGlobalmente ? 'Próximamente' : 'No incluido en tu plan actual'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Toggle o ícono bloqueado */}
      {bloqueado ? (
        <Lock size={15} className="text-neutral-600 shrink-0 mt-1" />
      ) : (
        <Toggle
          checked={isActive}
          onChange={handleToggle}
          disabled={false}
          color={mod.color}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
export default function Tab_Modulos({ config, setConfig, isDark, colorPrimario }) {
  // Módulos que el plan actual desbloquea (para el banner de upgrade).
  // Los que están apagados por el interruptor global de Leybrak NO entran
  // acá: subir de plan no los reactiva, así que "Ver planes" sería engañoso.
  const modulosBloqueados = MODULOS.filter(
    m => m.key_plan !== null
      && !config.plan_detalles?.[m.key_plan]
      && (config.modulos_globales?.[GLOBAL_KEY_MAP[m.key_config]] ?? true)
  );

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* ══════════════════════════════════════════════════════
          🎨 PERSONALIZACIÓN VISUAL
      ══════════════════════════════════════════════════════ */}
      <div className={`p-6 md:p-8 rounded-[2rem] border shadow-sm ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-base font-black mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Personalización Visual
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Tema */}
          <div>
            <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              Tema Base
            </label>
            <div className="flex gap-3">
              {[
                { value: 'dark',  label: '🌙 Oscuro' },
                { value: 'light', label: '☀️ Claro'  },
              ].map(({ value, label }) => {
                const activo = config.temaFondo === value || config.tema_fondo === value;
                return (
                  <button
                    key={value}
                    onClick={() => setConfig({ ...config, temaFondo: value, tema_fondo: value })}
                    className="flex-1 py-3.5 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-2 transition-all"
                    style={activo
                      ? { borderColor: colorPrimario, color: isDark ? '#fff' : '#111', backgroundColor: isDark ? '#1a1a1a' : '#fff' }
                      : { borderColor: isDark ? '#333' : '#e5e7eb', color: isDark ? '#555' : '#9ca3af' }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color primario */}
          <div>
            <label className={`text-[10px] font-black uppercase tracking-widest mb-3 block ${isDark ? 'text-neutral-500' : 'text-gray-500'}`}>
              Color de Acentos
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              {COLORES_PRESET.map(hex => (
                <button
                  key={hex}
                  onClick={() => setConfig({ ...config, colorPrimario: hex, color_primario: hex })}
                  className="w-10 h-10 rounded-full border-[3px] transition-all hover:scale-110 active:scale-95 flex items-center justify-center shadow-sm"
                  style={{
                    backgroundColor: hex,
                    borderColor: config.colorPrimario === hex || config.color_primario === hex
                      ? '#fff'
                      : 'transparent',
                    boxShadow: config.colorPrimario === hex || config.color_primario === hex
                      ? `0 0 0 2px ${hex}`
                      : undefined,
                  }}
                >
                  {(config.colorPrimario === hex || config.color_primario === hex) && (
                    <i className="fi fi-rr-check text-white text-xs drop-shadow-md mt-1"></i>
                  )}
                </button>
              ))}

              {/* Color personalizado */}
              <label
                className="w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-all hover:scale-110"
                style={{ borderColor: isDark ? '#444' : '#d1d5db' }}
                title="Color personalizado"
              >
                <input
                  type="color"
                  className="opacity-0 absolute w-px h-px"
                  value={config.colorPrimario || config.color_primario || '#ff5a1f'}
                  onChange={(e) => setConfig({ ...config, colorPrimario: e.target.value, color_primario: e.target.value })}
                />
                <i className="fi fi-rr-palette text-xs mt-1" style={{ color: isDark ? '#666' : '#9ca3af' }}></i>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          🔧 MÓDULOS DEL SISTEMA
      ══════════════════════════════════════════════════════ */}
      <div className={`p-6 md:p-8 rounded-[2rem] border shadow-sm ${isDark ? 'bg-[#111] border-[#222]' : 'bg-white border-gray-200'}`}>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Módulos del Sistema
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-neutral-500' : 'text-gray-400'}`}>
              Activa o desactiva los módulos que usa tu negocio día a día.
            </p>
          </div>

          {/* Resumen activos */}
          <div
            className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
            style={{ backgroundColor: colorPrimario + '15', color: colorPrimario }}
          >
            {MODULOS.filter(m => config[m.key_config]).length} / {MODULOS.length} activos
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODULOS.map(mod => (
            <TarjetaModulo
              key={mod.key_config}
              mod={mod}
              config={config}
              setConfig={setConfig}
              isDark={isDark}
              colorPrimario={colorPrimario}
            />
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          🔒 BANNER UPGRADE (solo si hay módulos bloqueados)
      ══════════════════════════════════════════════════════ */}
      {modulosBloqueados.length > 0 && (
        <div
          className="p-6 rounded-[2rem] border flex items-center gap-5"
          style={{
            background: isDark
              ? `linear-gradient(135deg, ${colorPrimario}12 0%, #111 100%)`
              : `linear-gradient(135deg, ${colorPrimario}08 0%, #fff 100%)`,
            borderColor: colorPrimario + '30',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: colorPrimario + '20', color: colorPrimario }}
          >
            <Lock size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {modulosBloqueados.length} {modulosBloqueados.length === 1 ? 'módulo bloqueado' : 'módulos bloqueados'} por tu plan actual
            </p>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-neutral-400' : 'text-gray-500'}`}>
              {modulosBloqueados.map(m => m.title).join(', ')}
            </p>
          </div>
          <button
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
            style={{ backgroundColor: colorPrimario }}
            onClick={() => {
              // Navegar al tab de plan — sube al padre
              window.dispatchEvent(new CustomEvent('erp:cambiar-tab', { detail: 'plan' }));
            }}
          >
            Ver planes <ArrowRight size={12} />
          </button>
        </div>
      )}

    </div>
  );
}