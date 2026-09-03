import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Switch, ActivityIndicator, Alert, Platform, StatusBar,Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import EncryptedStorage from 'react-native-encrypted-storage';
import api, { getNegocio } from '../../api/api';
import { actualizarNegocio } from '../../api/api';
import useAppStore from '../../store/useAppStore';
import { NativeModules } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
// ─── Colores disponibles ──────────────────────────────────────
const COLORES = [
  '#ff5a1f', '#3b82f6', '#10b981',
  '#eab308', '#8b5cf6', '#ec4899',
];
// ─── Módulos del sistema ──────────────────────────────────────
const MODULOS_META = [
  { id: 'modSalon',       key_plan: null,                icon: 'cutlery',   color: '#f59e0b', title: 'Gestión de Salón',   desc: 'Mapa interactivo de mesas y cuentas.',        badge: null,         badgeColor: null       },
  { id: 'modCocina',      key_plan: 'modulo_kds',        icon: 'fire',      color: '#f59e0b', title: 'Pantalla KDS',       desc: 'Despacho en tiempo real para cocineros.',     badge: 'PRO',        badgeColor: '#f59e0b'  },
  { id: 'modDelivery',    key_plan: 'modulo_delivery',   icon: 'truck',     color: '#8b5cf6', title: 'Módulo Delivery',    desc: 'Gestión de despachos y seguimiento.',         badge: 'PRO',        badgeColor: '#f59e0b'  },
  { id: 'modInventario',  key_plan: 'modulo_inventario', icon: 'cube',      color: '#10b981', title: 'Inventario',         desc: 'Descuenta insumos y genera alertas.',         badge: 'PRO',        badgeColor: '#f59e0b'  },
  { id: 'modCartaQr',     key_plan: 'modulo_carta_qr',   icon: 'qrcode',    color: '#3b82f6', title: 'Menú Digital QR',    desc: 'Carta escaneable en mesas y delivery.',       badge: 'PREMIUM',    badgeColor: '#3b82f6'  },
  { id: 'modBotWsp',      key_plan: 'modulo_bot_wsp',    icon: 'comments',  color: '#22c55e', title: 'Bot WhatsApp',       desc: 'Recibe pedidos automáticamente.',             badge: 'BETA',       badgeColor: '#22c55e'  },
  { id: 'modMl',          key_plan: 'modulo_ml',         icon: 'cogs',      color: '#ec4899', title: 'Predicciones IA',    desc: 'Anticípate a la demanda con IA.',             badge: 'ENTERPRISE', badgeColor: '#ec4899'  },
  { id: 'modClientes',    key_plan: 'modulo_clientes',    icon: 'users',     color: '#3b82f6', title: 'Directorio CRM',    desc: 'Base de datos de clientes.',                  badge: 'PRO',        badgeColor: '#f59e0b'  },
  { id: 'modFacturacion', key_plan: 'modulo_facturacion', icon: 'file-text', color: '#6b7280', title: 'Facturación Elec.', desc: 'Emite boletas y facturas (SUNAT).',           badge: 'PREMIUM',    badgeColor: '#3b82f6'  },
];

// Llave de cada módulo en config.modulos_globales (interruptor único de Leybrak)
const GLOBAL_KEY_MAP = {
  modSalon: 'salon', modCocina: 'cocina', modInventario: 'inventario', modDelivery: 'delivery',
  modClientes: 'clientes', modFacturacion: 'facturacion', modCartaQr: 'cartaQr',
  modBotWsp: 'botWsp', modMl: 'machineLearning',
};

function BotonPermisoNotificaciones({ t, color }) {
  const [tienePermiso, setTienePermiso] = useState(false);

  useEffect(() => {
    const verificar = async () => {
      if (NativeModules.NotificationModule) {
        const permiso = await NativeModules.NotificationModule.tienePermisoNotificaciones();
        setTienePermiso(permiso);
      }
    };
    verificar();
  }, []);

  return (
    <View style={{ marginTop: 12 }}>
      {tienePermiso ? (
        <View style={[s.alertBoxSuccess, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
          <Icon name="check-circle" size={14} color="#10b981" />
          <Text style={s.alertTextSuccess}>Permiso de notificaciones activo</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[{ backgroundColor: `${color}15`, borderColor: `${color}40`, borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center' }]}
          onPress={() => NativeModules.NotificationModule?.abrirConfiguracionPermisos()}
          activeOpacity={0.8}
        >
          <Icon name="bell" size={16} color={color} style={{ marginBottom: 6 }} />
          <Text style={{ color, fontSize: 13, fontWeight: '800' }}>ACTIVAR LECTURA DE NOTIFICACIONES</Text>
          <Text style={{ color: t.textSec, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
            Necesario para detectar pagos de Yape/Plin automáticamente
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
// ─── Hook de tema ─────────────────────────────────────────────
const useTema = (temaFondo, colorPrimario) => {
  const isDark = temaFondo !== 'light';
  return {
    isDark,
    color:     colorPrimario || '#3b82f6',
    bg:        isDark ? '#050505' : '#f0f0f0',
    bgCard:    isDark ? '#111111' : '#ffffff',
    bgInput:   isDark ? '#0a0a0a' : '#f9fafb',
    bgInput2:  isDark ? '#161616' : '#f3f4f6',
    border:    isDark ? '#1e1e1e' : '#e5e7eb',
    border2:   isDark ? '#222222' : '#d1d5db',
    textPrim:  isDark ? '#ffffff' : '#111111',
    textSec:   isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#4b5563' : '#9ca3af',
    tabBg:     isDark ? '#0a0a0a' : '#ffffff',
  };
};

// ─── Tarjeta base ─────────────────────────────────────────────
const Tarjeta = ({ titulo, icono, color, t, children, extra }) => (
  <View style={[s.tarjeta, { backgroundColor: t.bgCard, borderColor: t.border }]}>
    <View style={s.tarjetaHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={[s.tarjetaIcono, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
          <Icon name={icono} size={16} color={color} />
        </View>
        <Text style={[s.tarjetaTitulo, { color: t.textPrim }]}>{titulo}</Text>
      </View>
      {extra}
    </View>
    <View style={s.tarjetaContenido}>{children}</View>
  </View>
);



// ─── Tab Perfil ───────────────────────────────────────────────
function TabPerfil({ config, setConfig, t , subirQr}) {
  const [buscando, setBuscando] = useState(false);

  const consultarSunat = () => {
    if (!config.ruc) return;
    setBuscando(true);
    setTimeout(() => {
      setConfig({ ...config, razon_social: 'EMPRESA DE PRUEBA S.A.C.' });
      setBuscando(false);
    }, 1500);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

      {/* IDENTIDAD */}
      <Tarjeta titulo="Identidad Comercial" icono="building" color={t.color} t={t}>
        <Text style={[s.label, { color: t.textMuted }]}>RUC / NIT</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[s.input, { flex: 1, backgroundColor: t.bgInput, borderColor: t.border2, color: t.textPrim }]}
            value={config.ruc || ''}
            onChangeText={(v) => setConfig({ ...config, ruc: v.replace(/\D/g, '') })}
            placeholder="20123456789"
            placeholderTextColor={t.textMuted}
            keyboardType="numeric"
            maxLength={11}
          />
          <TouchableOpacity
            style={[s.btnBuscar, { backgroundColor: t.color }]}
            onPress={consultarSunat}
            disabled={buscando || !config.ruc}
          >
            {buscando ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="search" size={16} color="#fff" />}
          </TouchableOpacity>
        </View>

        <Text style={[s.label, { color: t.textMuted, marginTop: 12 }]}>RAZÓN SOCIAL</Text>
        <TextInput
          style={[s.input, { backgroundColor: t.bgInput2, borderColor: t.border, color: t.textSec, opacity: 0.7 }]}
          value={config.razon_social || ''}
          editable={false}
          placeholder="Se completa con SUNAT"
          placeholderTextColor={t.textMuted}
        />

        <Text style={[s.label, { color: t.textMuted, marginTop: 12 }]}>LOGO</Text>
        <TouchableOpacity style={[s.uploadBox, { borderColor: t.border2, backgroundColor: t.bgInput }]} activeOpacity={0.7}>
          <View style={[s.uploadBoxInner, { backgroundColor: t.bgInput2, borderColor: t.border }]}>
            <Icon name="building" size={24} color={t.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={[s.uploadBtn, { backgroundColor: t.border2 }]}>
              <Icon name="upload" size={12} color={t.textPrim} style={{ marginRight: 6 }} />
              <Text style={{ color: t.textPrim, fontSize: 12, fontWeight: '700' }}>Subir nuevo logo</Text>
            </View>
            <Text style={[s.uploadDesc, { color: t.textMuted }]}>Formatos: JPG, PNG. Max 2MB.</Text>
          </View>
        </TouchableOpacity>
      </Tarjeta>

      {/* BILLETERAS */}
      <Tarjeta titulo="Billeteras Digitales" icono="mobile-phone" color="#a855f7" t={t}>
        {/* YAPE */}
        <View style={[s.billeteraCard, { backgroundColor: t.bgInput2, borderColor: t.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={[s.billeteraDot, { backgroundColor: '#74089c' }]} />
            <Text style={[s.billeteraLabel, { color: t.textSec }]}>YAPE</Text>
          </View>
          <TextInput
            style={[s.input, { backgroundColor: t.bgInput, borderColor: '#74089c50', color: t.textPrim }]}
            value={config.yape_numero || ''}
            onChangeText={(v) => setConfig({ ...config, yape_numero: v.replace(/\D/g, '') })}
            placeholder="Número de Yape"
            placeholderTextColor={t.textMuted}
            keyboardType="phone-pad"
            maxLength={9}
          />
          <TouchableOpacity
              style={[s.uploadQrBox, { borderColor: t.border2, backgroundColor: t.bgInput }]}
              onPress={() => subirQr('yape')}
              activeOpacity={0.7}
            >
  <Icon name="upload" size={14} color={t.textMuted} />
  <Text style={[s.uploadQrText, { color: t.textMuted }]}>Subir QR Yape</Text>
          </TouchableOpacity>
          {config.yape_qr ? (
            <Image
              source={{ uri: config.yape_qr }}
              style={{ width: 80, height: 80, borderRadius: 8, marginTop: 8, alignSelf: 'center' }}
              resizeMode="contain"
            />
          ) : null}
        </View>

        {/* PLIN */}
        <View style={[s.billeteraCard, { backgroundColor: t.bgInput2, borderColor: t.border, marginTop: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={[s.billeteraDot, { backgroundColor: '#00e3a6' }]} />
            <Text style={[s.billeteraLabel, { color: t.textSec }]}>PLIN</Text>
          </View>
          <TextInput
            style={[s.input, { backgroundColor: t.bgInput, borderColor: '#00e3a650', color: t.textPrim }]}
            value={config.plin_numero || ''}
            onChangeText={(v) => setConfig({ ...config, plin_numero: v.replace(/\D/g, '') })}
            placeholder="Número de Plin"
            placeholderTextColor={t.textMuted}
            keyboardType="phone-pad"
            maxLength={9}
          />
          <TouchableOpacity
            style={[s.uploadQrBox, { borderColor: t.border2, backgroundColor: t.bgInput }]}
            onPress={() => subirQr('plin')}
            activeOpacity={0.7}
          >
            <Icon name="upload" size={14} color={t.textMuted} />
            <Text style={[s.uploadQrText, { color: t.textMuted }]}>Subir QR Plin</Text>
          </TouchableOpacity>
          {config.plin_qr ? (
            <Image
              source={{ uri: config.plin_qr }}
              style={{ width: 80, height: 80, borderRadius: 8, marginTop: 8, alignSelf: 'center' }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Tarjeta>

      {/* AUTO-VALIDACIÓN */}
      <Tarjeta
        titulo="Auto-validación"
        icono="check-circle"
        color={config.confirmacion_automatica ? '#10b981' : t.textMuted}
        t={t}
        extra={
          <Switch
            value={config.confirmacion_automatica || false}
            onValueChange={(v) => setConfig({ ...config, confirmacion_automatica: v })}
            trackColor={{ false: t.border2, true: `${t.color}50` }}
            thumbColor={config.confirmacion_automatica ? t.color : t.textMuted}
          />
        }
      >
        <Text style={[s.descText, { color: t.textSec }]}>
          Activa la validación automática de Yape y Plin mediante la App instalada en el celular del negocio.
        </Text>
        {config.confirmacion_automatica && (
          <>
            <View style={s.alertBoxSuccess}>
              <Text style={s.alertTextSuccess}>✓ Captura notificaciones push en tiempo real</Text>
              <Text style={s.alertTextSuccess}>✓ 0% de comisión — dinero directo a tu cuenta</Text>
            </View>

            {/* ✅ Botón para activar permiso de notificaciones */}
            <BotonPermisoNotificaciones t={t} color={t.color} />
          </>
        )}
        {config.confirmacion_automatica && config.device_vinculado && (
          <View style={[s.alertBoxSuccess, { marginTop: 8 }]}>
            <Text style={s.alertTextSuccess}>✓ Dispositivo vinculado correctamente</Text>
          </View>
        )}
      </Tarjeta>

    </ScrollView>
  );
}

// ─── Tab Módulos ──────────────────────────────────────────────
function TabModulos({ config, setConfig, t }) {
  const planDetalles = config.plan_detalles || {};

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

      {/* APARIENCIA */}
      <Tarjeta titulo="Personalización Visual" icono="paint-brush" color={t.color} t={t}>
        <Text style={[s.label, { color: t.textMuted }]}>TEMA BASE</Text>
        <View style={s.temaGrid}>
          {[{ id: 'dark', label: '🌙 Oscuro' }, { id: 'light', label: '☀️ Claro' }].map(tema => (
            <TouchableOpacity
              key={tema.id}
              style={[
                s.temaBtn,
                { backgroundColor: t.bgInput, borderColor: t.border2 },
                config.temaFondo === tema.id && { borderColor: t.color, backgroundColor: t.bgCard },
              ]}
              onPress={() => setConfig({ ...config, temaFondo: tema.id })}
              activeOpacity={0.8}
            >
              <Text style={[s.temaBtnText, { color: config.temaFondo === tema.id ? t.color : t.textMuted }]}>
                {tema.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.label, { color: t.textMuted, marginTop: 20 }]}>COLOR DE ACENTOS</Text>
        <View style={s.coloresGrid}>
          {COLORES.map(color => (
            <TouchableOpacity
              key={color}
              style={[s.colorBtn, { backgroundColor: color }, config.colorPrimario === color && { borderWidth: 3, borderColor: t.textPrim }]}
              onPress={() => setConfig({ ...config, colorPrimario: color })}
              activeOpacity={0.8}
            >
              {config.colorPrimario === color && <Icon name="check" size={14} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>
      </Tarjeta>

      {/* MÓDULOS */}
      <Tarjeta
        titulo="Módulos del Sistema"
        icono="th-large"
        color={t.color}
        t={t}
        extra={
          <View style={[s.badgeModulos, { backgroundColor: `${t.color}15` }]}>
            <Text style={[s.badgeModulosText, { color: t.color }]}>
              {MODULOS_META.filter(m => config[m.id]).length} / {MODULOS_META.length}
            </Text>
          </View>
        }
      >
        <Text style={[s.descText, { color: t.textSec, marginBottom: 12 }]}>
          Activa o desactiva los módulos que usa tu negocio.
        </Text>
        <View style={s.modulosGrid}>
          {MODULOS_META.map(mod => {
            const enPlan  = mod.key_plan === null ? true : planDetalles[mod.key_plan] === true;
            // Interruptor único de Leybrak: si está apagado, se oculta en
            // TODOS los negocios sin importar su plan ni lo que el dueño
            // haya activado.
            const habilitadoGlobalmente = config.modulos_globales?.[GLOBAL_KEY_MAP[mod.id]] ?? true;
            const activo  = config[mod.id] === true;
            const bloq    = !enPlan || !habilitadoGlobalmente;
            return (
              <View
                key={mod.id}
                style={[
                  s.moduloCard,
                  { backgroundColor: t.bgInput, borderColor: t.border },
                  activo && !bloq && { borderColor: t.border2, backgroundColor: t.bgInput2 },
                  bloq && { opacity: 0.6 },
                ]}
              >
                {activo && !bloq && <View style={[s.moduloStripe, { backgroundColor: mod.color }]} />}
                <View style={[s.moduloIconoWrapper, { backgroundColor: activo && !bloq ? `${mod.color}20` : t.bgInput2 }]}>
                  <Icon name={mod.icon} size={14} color={activo && !bloq ? mod.color : t.textMuted} />
                </View>
                <View style={s.moduloInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={[s.moduloTitulo, { color: t.textPrim }]}>{mod.title}</Text>
                    {mod.badge && (
                      <View style={[s.moduloBadge, { backgroundColor: `${mod.badgeColor}20`, borderColor: `${mod.badgeColor}40` }]}>
                        <Text style={[s.moduloBadgeText, { color: mod.badgeColor }]}>{mod.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[s.moduloDesc, { color: t.textSec }]} numberOfLines={2}>{mod.desc}</Text>
                  {bloq && (
                    <View style={s.moduloBloqAviso}>
                      <Icon name="lock" size={10} color="#f59e0b" />
                      <Text style={s.moduloBloqText}>
                        {!habilitadoGlobalmente ? 'Próximamente' : 'No incluido en tu plan'}
                      </Text>
                    </View>
                  )}
                </View>
                {bloq ? (
                  <Icon name="lock" size={16} color={t.textMuted} style={{ alignSelf: 'center' }} />
                ) : (
                  <Switch
                    value={activo}
                    onValueChange={(v) => setConfig({ ...config, [mod.id]: v })}
                    trackColor={{ false: t.border2, true: `${mod.color}50` }}
                    thumbColor={activo ? mod.color : t.textMuted}
                    style={{ alignSelf: 'center' }}
                  />
                )}
              </View>
            );
          })}
        </View>
      </Tarjeta>

    </ScrollView>
  );
}

// ─── Tab Plan ─────────────────────────────────────────────────
function TabPlan({ config, t }) {
  const plan      = config.plan_detalles || {};
  const maxSedes  = plan.max_sedes || 1;
  const pctSedes  = Math.min((1 / maxSedes) * 100, 100);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

      <View style={[s.planHeroCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
        <View style={s.planHeroHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[s.planHeroIcon, { backgroundColor: `${t.color}20` }]}>
              <Icon name="rocket" size={24} color={t.color} />
            </View>
            <View>
              <Text style={[s.planHeroSub, { color: t.textMuted }]}>PLAN ACTUAL</Text>
              <Text style={[s.planHeroTitulo, { color: t.textPrim }]}>{plan.nombre || 'Sin Plan'}</Text>
            </View>
          </View>
          <View style={s.badgeActivo}>
            <Text style={s.badgeActivoText}>ACTIVO</Text>
          </View>
        </View>

        <View style={s.planHeroPriceRow}>
          <Text style={[s.planHeroPrice, { color: t.textPrim }]}>S/ {parseFloat(plan.precio_mensual || 0).toFixed(2)}</Text>
          <Text style={[s.planHeroPeriod, { color: t.textSec }]}>/mes</Text>
        </View>

        <Text style={[s.label, { color: t.textMuted, marginBottom: 12 }]}>MÓDULOS INCLUIDOS</Text>
        <View style={s.planChipsGrid}>
          {MODULOS_META.slice(1).map(mod => {
            const incluido = plan[mod.key_plan] === true;
            return (
              <View
                key={mod.id}
                style={[
                  s.planChip,
                  { borderColor: incluido ? `${mod.color}30` : t.border, backgroundColor: incluido ? `${mod.color}15` : t.bgInput2, opacity: incluido ? 1 : 0.5 },
                ]}
              >
                <Icon name={mod.icon} size={12} color={incluido ? mod.color : t.textMuted} />
                <Text style={[s.planChipText, { color: incluido ? mod.color : t.textMuted, flex: 1 }]} numberOfLines={1}>{mod.title}</Text>
                <Icon name={incluido ? 'check-circle' : 'times-circle'} size={12} color={incluido ? mod.color : t.textMuted} />
              </View>
            );
          })}
        </View>
      </View>

      <Tarjeta titulo="Uso de Recursos" icono="pie-chart" color={t.color} t={t}>
        <View style={[s.usoBarContainer, { backgroundColor: t.bgInput, borderColor: t.border }]}>
          <View style={s.usoBarHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="building" size={12} color={t.color} />
              <Text style={[s.usoBarLabel, { color: t.textMuted }]}>SEDES ACTIVAS</Text>
            </View>
            <Text style={[s.usoBarCount, { color: t.textPrim }]}>1 / {maxSedes}</Text>
          </View>
          <View style={[s.usoBarTrack, { backgroundColor: t.border2 }]}>
            <View style={[s.usoBarFill, { width: `${pctSedes}%`, backgroundColor: t.color }]} />
          </View>
        </View>
      </Tarjeta>

      <TouchableOpacity
        style={[s.upgradeBanner, { borderColor: `${t.color}40`, backgroundColor: `${t.color}10` }]}
        activeOpacity={0.8}
      >
        <Icon name="star" size={24} color={t.color} style={{ marginBottom: 8 }} />
        <Text style={[s.upgradeBannerTitulo, { color: t.textPrim }]}>¿Quieres más potencia?</Text>
        <Text style={[s.upgradeBannerDesc, { color: t.textSec }]}>Desbloquea todos los módulos, más sedes y herramientas avanzadas.</Text>
        <View style={[s.upgradeBtn, { backgroundColor: t.color }]}>
          <Text style={s.upgradeBtnText}>Ver planes disponibles</Text>
        </View>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ─── Pantalla principal ───────────────────────────────────────
const TABS = [
  { id: 'perfil',  label: 'Perfil y Cobros',  icono: 'id-badge'  },
  { id: 'plan',    label: 'Plan y Límites',    icono: 'rocket'    },
  { id: 'modulos', label: 'Módulos y Diseño',  icono: 'th-large'  },
];

export default function ConfiguracionScreen() {
  const { configuracionGlobal, setConfiguracionGlobal } = useAppStore();
  const { NotificationModule } = NativeModules;
  const [tabActiva, setTabActiva] = useState('perfil');
  const [config, setConfig]       = useState({});
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando]   = useState(true);

  const subirQr = async (tipo) => {
    launchImageLibrary(
      { mediaType: 'photo', quality: 0.8 },
      async (response) => {
        if (response.didCancel || response.errorCode) return;
        const asset = response.assets?.[0];
        if (!asset) return;

        try {
          const negocioId = await EncryptedStorage.getItem('negocio_id');
          console.warn('Subiendo QR:', tipo, asset.uri);

          const formData = new FormData();
          formData.append(tipo === 'yape' ? 'yape_qr' : 'plin_qr', {
            uri:  asset.uri,
            type: asset.type || 'image/jpeg',
            name: `qr_${tipo}.jpg`,
          });

          // ✅ Usar actualizarNegocio que ya tiene multipart/form-data
          const res = await actualizarNegocio(negocioId, formData);
          console.warn('RESPUESTA:', res.data.yape_qr, res.data.plin_qr);

          const urlQr = tipo === 'yape' ? res.data.yape_qr : res.data.plin_qr;
          setConfig(prev => ({
            ...prev,
            [tipo === 'yape' ? 'yape_qr' : 'plin_qr']: urlQr,
          }));
          Alert.alert('✅ Listo', `QR de ${tipo.toUpperCase()} guardado.`);

        } catch (e) {
          console.warn('ERROR status:', e?.response?.status);
          console.warn('ERROR data:', JSON.stringify(e?.response?.data));
          console.warn('ERROR msg:', e?.message);
          Alert.alert('Error', e?.message || 'No se pudo subir el QR.');
        }
      }
    );
  };
  // ✅ Tema dinámico desde el store
  const t = useTema(
    config.temaFondo || configuracionGlobal.temaFondo,
    config.colorPrimario || configuracionGlobal.colorPrimario
  );

  const cargar = useCallback(async () => {
    try {
      const negocioId = await EncryptedStorage.getItem('negocio_id');
      const res = await getNegocio(negocioId);
      const d   = res.data;
      setConfig({
        nombre:                  d.nombre                  || '',
        ruc:                     d.ruc                     || '',
        razon_social:            d.razon_social            || '',
        yape_numero:             d.yape_numero             || '',
        yape_qr:                 d.yape_qr                 || '',
        plin_numero:             d.plin_numero             || '',
        plin_qr:                 d.plin_qr                 || '',
        confirmacion_automatica: d.confirmacion_automatica || false,
        device_vinculado:        !!d.device_token,
        colorPrimario:           d.color_primario          || '#3b82f6',
        temaFondo:               d.tema_fondo              || 'dark',
        plan_detalles:           d.plan_detalles           || null,
        // Interruptor global de Leybrak (ver TabModulos: "Próximamente")
        modulos_globales:        d.modulos_globales        || {},
        modSalon:       d.mod_salon_activo       ?? true,
        modCocina:      d.mod_cocina_activo      ?? false,
        modInventario:  d.mod_inventario_activo  ?? false,
        modDelivery:    d.mod_delivery_activo    ?? false,
        modClientes:    d.mod_clientes_activo    ?? false,
        modFacturacion: d.mod_facturacion_activo ?? false,
        modCartaQr:     d.mod_carta_qr_activo    ?? false,
        modBotWsp:      d.mod_bot_wsp_activo     ?? false,
        modMl:          d.mod_ml_activo          ?? false,
      });
      if (d.device_token && NativeModules.NotificationModule?.setDeviceToken) {
        NativeModules.NotificationModule.setDeviceToken(d.device_token);
        console.warn('✅ Device token seteado:', d.device_token);
      }
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo cargar la configuración.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const negocioId = await EncryptedStorage.getItem('negocio_id');

      // JSON en vez de FormData — más confiable en React Native
      const payload = {
        nombre:                   config.nombre          || '',
        ruc:                      config.ruc             || '',
        yape_numero:              config.yape_numero     || '',
        plin_numero:              config.plin_numero     || '',
        color_primario:           config.colorPrimario   || '#3b82f6',
        tema_fondo:               config.temaFondo       || 'dark',
        confirmacion_automatica:  config.confirmacion_automatica || false,
        mod_salon_activo:         config.modSalon       ?? true,
        mod_cocina_activo:        config.modCocina      ?? false,
        mod_inventario_activo:    config.modInventario  ?? false,
        mod_delivery_activo:      config.modDelivery    ?? false,
        mod_clientes_activo:      config.modClientes    ?? false,
        mod_facturacion_activo:   config.modFacturacion ?? false,
        mod_carta_qr_activo:      config.modCartaQr     ?? false,
        mod_bot_wsp_activo:       config.modBotWsp      ?? false,
        mod_ml_activo:            config.modMl          ?? false,
      };

      await api.patch(`/negocios/${negocioId}/`, payload);

      // ✅ Actualizar store global — aplica cambios en toda la app inmediatamente
      const plan = config.plan_detalles || {};
      const g    = config.modulos_globales || {};
      setConfiguracionGlobal({
        ...configuracionGlobal,
        colorPrimario:           config.colorPrimario,
        temaFondo:               config.temaFondo,
        confirmacion_automatica: config.confirmacion_automatica,
        negocio_id:              negocioId,
        yape_numero:             config.yape_numero,
        plin_numero:             config.plin_numero,
        modulos: {
          salon:           (config.modSalon       ?? true)  && (g.salon           ?? true),
          cocina:          config.modCocina      && (plan.modulo_kds        ?? false) && (g.cocina          ?? true),
          delivery:        config.modDelivery    && (plan.modulo_delivery   ?? false) && (g.delivery        ?? true),
          inventario:      config.modInventario  && (plan.modulo_inventario ?? false) && (g.inventario      ?? true),
          clientes:        (config.modClientes    ?? false) && (g.clientes        ?? true),
          facturacion:     (config.modFacturacion ?? false) && (g.facturacion     ?? true),
          cartaQr:         config.modCartaQr     && (plan.modulo_carta_qr   ?? false) && (g.cartaQr         ?? true),
          botWsp:          config.modBotWsp      && (plan.modulo_bot_wsp    ?? false) && (g.botWsp          ?? true),
          machineLearning: config.modMl          && (plan.modulo_ml         ?? false) && (g.machineLearning ?? true),
        },
      });

      Alert.alert('✅ Guardado', 'Configuración actualizada correctamente.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo guardar. Verifica tu conexión.');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <View style={[s.loader, { backgroundColor: t.bg }]}>
        <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.bg} />
        <ActivityIndicator size="large" color={t.color} />
      </View>
    );
  }

  const tabProps = { config, setConfig, t , subirQr};
  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <StatusBar barStyle={t.isDark ? 'light-content' : 'dark-content'} backgroundColor={t.tabBg} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: t.tabBg, borderBottomColor: t.border }]}>
        <View style={[s.headerIcono, { backgroundColor: `${t.color}15`, borderColor: `${t.color}30` }]}>
          <Icon name="briefcase" size={26} color={t.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.headerTitulo, { color: t.textPrim }]}>
            Mi Negocio y <Text style={{ color: t.color }}>Suscripción</Text>
          </Text>
          <Text style={[s.headerSub, { color: t.textSec }]}>
            Administra la identidad de tu marca, plan y módulos.
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[s.tabsWrapper, { backgroundColor: t.tabBg, borderBottomColor: t.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
          {TABS.map(tab => {
            const activo = tabActiva === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[s.tab, activo && { borderBottomColor: t.color }]}
                onPress={() => setTabActiva(tab.id)}
                activeOpacity={0.8}
              >
                <Icon name={tab.icono} size={14} color={activo ? t.color : t.textMuted} style={{ marginRight: 8 }} />
                <Text style={[s.tabLabel, { color: activo ? t.color : t.textSec }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Contenido */}
      <View style={{ flex: 1 }}>
        {tabActiva === 'perfil'  && <TabPerfil  {...tabProps} />}
        {tabActiva === 'plan'    && <TabPlan    {...tabProps} />}
        {tabActiva === 'modulos' && <TabModulos {...tabProps} />}
      </View>

      {/* FAB Guardar */}
      <View style={[s.fabContainer, { paddingBottom: Platform.OS === 'ios' ? 34 : 16, backgroundColor: t.isDark ? 'rgba(5,5,5,0.9)' : 'rgba(240,240,240,0.95)' }]}>
        <TouchableOpacity
          style={[s.guardarBtn, { backgroundColor: t.color, shadowColor: t.color }, guardando && { opacity: 0.6 }]}
          onPress={guardar}
          disabled={guardando}
          activeOpacity={0.8}
        >
          {guardando
            ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
            : <Icon name="save" size={16} color="#fff" style={{ marginRight: 10 }} />
          }
          <Text style={s.guardarBtnText}>{guardando ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Estilos estáticos ────────────────────────────────────────
const s = StyleSheet.create({
  container:        { flex: 1 },
  loader:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent:    { padding: 16, paddingBottom: 120 },

  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16, paddingBottom: 20, gap: 16, borderBottomWidth: 1 },
  headerIcono:      { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitulo:     { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  headerSub:        { fontSize: 11, marginTop: 4, lineHeight: 16 },

  tabsWrapper:      { borderBottomWidth: 1 },
  tabsScroll:       { paddingHorizontal: 16 },
  tab:              { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, marginRight: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:         { fontSize: 13, fontWeight: '700' },

  tarjeta:          { borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1 },
  tarjetaHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  tarjetaIcono:     { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1 },
  tarjetaTitulo:    { fontSize: 18, fontWeight: '900' },
  tarjetaContenido: { gap: 12 },

  label:            { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  input:            { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: '600' },
  btnBuscar:        { width: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  descText:         { fontSize: 12, lineHeight: 18 },
  descTextSmall:    { fontSize: 10, marginTop: 6 },

  uploadBox:        { borderWidth: 2, borderStyle: 'dashed', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  uploadBoxInner:   { width: 64, height: 64, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  uploadBtn:        { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  uploadDesc:       { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  billeteraCard:    { borderRadius: 16, padding: 16, borderWidth: 1 },
  billeteraLabel:   { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  billeteraDot:     { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  uploadQrBox:      { marginTop: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadQrText:     { fontSize: 11, fontWeight: '700' },

  alertBoxSuccess:  { backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', borderRadius: 14, padding: 12, marginTop: 12, gap: 4 },
  alertTextSuccess: { color: '#10b981', fontSize: 11, fontWeight: '600' },
  tokenBox:         { borderWidth: 1, borderRadius: 12, padding: 14 },
  tokenText:        { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  temaGrid:         { flexDirection: 'row', gap: 12 },
  temaBtn:          { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 16, paddingVertical: 16 },
  temaBtnText:      { fontSize: 13, fontWeight: '800' },
  coloresGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorBtn:         { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  badgeModulos:     { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeModulosText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  modulosGrid:      { gap: 10 },
  moduloCard:       { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  moduloStripe:     { position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  moduloIconoWrapper:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  moduloInfo:       { flex: 1, marginRight: 8 },
  moduloTitulo:     { fontSize: 13, fontWeight: '800' },
  moduloBadge:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  moduloBadgeText:  { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  moduloDesc:       { fontSize: 11, marginTop: 3, lineHeight: 15 },
  moduloBloqAviso:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  moduloBloqText:   { fontSize: 10, fontWeight: '800', color: '#f59e0b' },

  planHeroCard:     { borderRadius: 32, padding: 24, marginBottom: 20, borderWidth: 1, overflow: 'hidden' },
  planHeroHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  planHeroIcon:     { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  planHeroSub:      { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },
  planHeroTitulo:   { fontSize: 24, fontWeight: '900' },
  badgeActivo:      { backgroundColor: 'rgba(16,185,129,0.15)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeActivoText:  { color: '#10b981', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  planHeroPriceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 20 },
  planHeroPrice:    { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  planHeroPeriod:   { fontSize: 14, fontWeight: '700', paddingBottom: 6 },
  planChipsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, width: '48%' },
  planChipText:     { fontSize: 10, fontWeight: '800', flex: 1 },

  usoBarContainer:  { padding: 16, borderRadius: 16, borderWidth: 1 },
  usoBarHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  usoBarLabel:      { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  usoBarCount:      { fontSize: 12, fontWeight: '900' },
  usoBarTrack:      { height: 8, borderRadius: 4, overflow: 'hidden' },
  usoBarFill:       { height: '100%', borderRadius: 4 },

  upgradeBanner:    { padding: 24, borderRadius: 24, borderWidth: 1, marginTop: 8, alignItems: 'flex-start' },
  upgradeBannerTitulo: { fontSize: 16, fontWeight: '900', marginBottom: 4 },
  upgradeBannerDesc:{ fontSize: 12, marginBottom: 16, lineHeight: 18 },
  upgradeBtn:       { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  upgradeBtnText:   { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  fabContainer:     { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16 },
  guardarBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 20, paddingVertical: 18, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10 },
  guardarBtnText:   { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});