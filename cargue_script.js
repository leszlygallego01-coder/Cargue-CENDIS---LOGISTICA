/* =================================================================================
 * MEDISFARMA | cargue_script.js
 * Modulo CARGUE: configuracion de Folder ID por tarjeta, lectura dinamica por
 * nombre de cabecera, autocompletado, validaciones, guardado en Drive y
 * generacion del archivo de respaldo de seguridad (XLSX / JSON).
 *
 * PERFILES DE USUARIO:
 *   1. ADMINISTRADOR   — Monta/relaciona traslados, acceso total a todas las tarjetas
 *   2. LIDER            — Registra traslado y asigna responsable (lista plegable),
 *                         captura punto automatico. Para traslados NO CENDIS (243,
 *                         URG, B05, Juridicos) NO exige punto.
 *   3. AUXILIAR ENTREGA — Llama traslado, ve destino, registra unidades/cajas/
 *                         urgencia/quien empaco. Si falta info NO avanza.
 *   4. RECIBIDO LOGISTICA — Llama traslado, registra quien recibe, fecha/hora
 *                         automatica, bloquea al recibir, opcion observacion.
 *   5. PLANILLAR LOGISTICA — Por validar (acceso basico a logistica).
 * ================================================================================= */
'use strict';

/* ---------------------------------------------------------------------------
 * 1. CONFIGURACION PERSISTENTE (localStorage)
 * ------------------------------------------------------------------------- */
const LS_KEY = 'MF_CONFIG_CARGUE';
const LS_DATA = 'MF_DATOS_SESION';
const LS_PERFIL = 'MF_PERFIL_ACTIVO';

const CONFIG_DEFAULT = {
  apiUrl: '',
  modoLocal: true,
  folders: {
    despachos:   '1tUXm2FVVFWBnyeBrzTlRpobYTKxk7OH8',
    logistica:   '1_e8ycbznm0jA4kOBwkJuXM4EVdcwXzYe',
    recepcion:   '1u5aQURkwKw4CqxejzOSxYgeF6dvcj-T0',
    facturacion: '1hpRjykdlFyU_nsdXb0ttqOJdHNoXcTG-',
    inventario:  '11Iml2ggmvAK8aHeUbDGeWbyhLxCtrPoY',
    backup:      '1HVTZyLasrbZArTN34kmc0lCKaQa2qQ_5'
  },
  conductores: ['CONDUCTOR 1 - CAMION', 'CONDUCTOR 2 - FURGON', 'MENSAJERO 1 - MOTO', 'MENSAJERO 2 - MOTO'],
  /* Perfiles de archivos por tarjeta: nombre del archivo y hoja en Drive */
  perfiles: {
    despachos:   { file: 'BD_PLANILLA_ENTREGA_DESPACHOS', sheet: 'DATOS' },
    logistica:   { file: 'BD_LOGISTICA_DESPACHOS',         sheet: 'DATOS' },
    recepcion:   { file: 'BD_RECEPCION_TECNICA',           sheet: 'DATOS' },
    facturacion: { file: 'BD_FACTURA_TRANSPORTE',         sheet: 'DATOS' },
    inventario:  { file: 'BD_VERIFICACION_INVENTARIO',     sheet: 'DATOS' }
  }
};

let CONFIG = cargarConfig();

/** Datos registrados en la sesion; alimentan el backup de seguridad. */
let SESION = cargarSesion();

/** Items en memoria antes de guardar (tarjetas 3 y 5). */
let itemsRecepcion = [];
let itemsInventario = [];

/* ---------------------------------------------------------------------------
 * 1b. SISTEMA DE PERFILES DE USUARIO
 * ------------------------------------------------------------------------- */

/**
 * Definicion de los 5 perfiles del sistema.
 * Cada perfil define:
 *   - label: nombre visible
 *   - icon: emoji/icono
 *   - color: clase CSS para el badge
 *   - tarjetas: array de IDs de tarjeta que puede ver/usar ('t1'..'t5')
 *   - puedeCrearTraslado: si puede montar/relacionar traslados
 *   - exigePunto: si al registrar traslado exige captura automatica del punto
 *   - puntoExcepciones: destinos donde NO se exige el punto (lista normalizada)
 *   - puedeAsignarResponsable: si puede asignar responsable desde lista desplegable
 *   - camposObligatorios: campos adicionales obligatorios para este perfil
 *   - bloqueaAlRecibir: si al registrar recibido se bloquea edicion posterior
 *   - soloLectura: campos que este perfil solo ve (no edita)
 *   - puedeImprimir: si puede imprimir planillas
 *   - puedeBackup: si puede generar archivos de respaldo
 *   - puedeConfig: si puede acceder a configuracion general
 */
const PERFILES = {
  administrador: {
    label: 'ADMINISTRADOR',
    icon: '&#128081;',
    color: 'bg-danger',
    descripcion: 'Acceso total. Monta o relaciona los traslados en todas las tarjetas.',
    tarjetas: ['t1', 't2', 't3', 't4', 't5'],
    puedeCrearTraslado: true,
    exigePunto: false,
    puntoExcepciones: [],
    puedeAsignarResponsable: true,
    camposObligatorios: {},
    bloqueaAlRecibir: false,
    soloLectura: [],
    puedeImprimir: true,
    puedeBackup: true,
    puedeConfig: true
  },
  lider: {
    label: 'LIDER',
    icon: '&#128104;&#8205;&#128188;',
    color: 'bg-primary',
    descripcion: 'Registra el traslado y le asigna un responsable (lista desplegable). ' +
      'Captura automaticamente el punto. Para traslados NO CENDIS (243, URG, B05, ' +
      'casos juridicos) NO exige el punto.',
    tarjetas: ['t1', 't2'],
    puedeCrearTraslado: true,
    exigePunto: true,
    puntoExcepciones: ['243', 'urg', 'b05', 'juridico', 'juridica', 'caso juridico', 'caso juridica'],
    puedeAsignarResponsable: true,
    camposObligatorios: {
      t1: ['t1_traslado', 't1_responsable_entrega', 't1_quien_alista'],
      t2: ['t2_traslado', 't2_fecha_envio', 't2_conductor', 't2_planilla']
    },
    bloqueaAlRecibir: false,
    soloLectura: [],
    puedeImprimir: true,
    puedeBackup: false,
    puedeConfig: false
  },
  auxiliar_entrega: {
    label: 'AUXILIAR ENTREGA',
    icon: '&#128230;',
    color: 'bg-success',
    descripcion: 'Debe llamar el traslado, la pantalla muestra el destino. ' +
      'Registra unidades, cajas, urgencia y quien empaco. ' +
      'Si no tiene informacion completa NO deja avanzar.',
    tarjetas: ['t1'],
    puedeCrearTraslado: false,
    exigePunto: false,
    puntoExcepciones: [],
    puedeAsignarResponsable: false,
    camposObligatorios: {
      t1: ['t1_traslado', 't1_cantidad', 't1_tipo', 't1_urgente', 't1_quien_alista']
    },
    bloqueaAlRecibir: false,
    soloLectura: ['t1_responsable_entrega', 't1_recomendado'],
    puedeImprimir: false,
    puedeBackup: false,
    puedeConfig: false
  },
  recibido_logistica: {
    label: 'RECIBIDO LOGISTICA',
    icon: '&#9989;',
    color: 'bg-info',
    descripcion: 'Debe llamar el traslado y registrar quien recibe. ' +
      'Una vez le den recibido NO pueden modificarlo. ' +
      'Toma fecha y hora automatico. Opcion de observacion.',
    tarjetas: ['t2'],
    puedeCrearTraslado: false,
    exigePunto: false,
    puntoExcepciones: [],
    puedeAsignarResponsable: false,
    camposObligatorios: {
      t2: ['t2_traslado', 't2_quien_recibe']
    },
    bloqueaAlRecibir: true,
    soloLectura: ['t2_fecha_envio', 't2_conductor', 't2_placa', 't2_planilla'],
    puedeImprimir: false,
    puedeBackup: false,
    puedeConfig: false
  },
  planillar_logistica: {
    label: 'PLANILLAR LOGISTICA',
    icon: '&#128203;',
    color: 'bg-warning text-dark',
    descripcion: 'Por validar. Acceso basico a logistica y despachos.',
    tarjetas: ['t1', 't2'],
    puedeCrearTraslado: false,
    exigePunto: false,
    puntoExcepciones: [],
    puedeAsignarResponsable: false,
    camposObligatorios: {
      t1: ['t1_traslado'],
      t2: ['t2_traslado']
    },
    bloqueaAlRecibir: false,
    soloLectura: [],
    puedeImprimir: true,
    puedeBackup: false,
    puedeConfig: false
  }
};

/** Perfil activo (persistido en localStorage). */
let PERFIL_ACTIVO = localStorage.getItem(LS_PERFIL) || 'administrador';

/** Establece el perfil activo y refresca la interfaz. */
function seleccionarPerfil(clave) {
  if (!PERFILES[clave]) { toast('Perfil no reconocido.', 'danger'); return; }
  PERFIL_ACTIVO = clave;
  localStorage.setItem(LS_PERFIL, clave);
  aplicarPerfil();
  toast('Perfil activo: <strong>' + PERFILES[clave].label + '</strong>', 'success');
}

/**
 * Aplica las restricciones del perfil activo a toda la interfaz:
 *   - Muestra/oculta tarjetas
 *   - Habilita/deshabilita botones
 *   - Pone campos en solo lectura segun el perfil
 *   - Despliega la lista de responsables si el perfil puede asignar
 *   - Muestra info del perfil activo en la barra
 */
function aplicarPerfil() {
  const p = PERFILES[PERFIL_ACTIVO] || PERFILES.administrador;

  // 1. Mostrar/ocultar pestanas de tarjetas
  document.querySelectorAll('#tabsCargue .nav-item').forEach(li => {
    const btn = li.querySelector('.nav-link');
    const target = btn ? btn.getAttribute('data-bs-target') : '';
    const tarjetaId = target.replace('#', '');
    li.style.display = p.tarjetas.includes(tarjetaId) ? '' : 'none';
  });

  // Si la pestana activa no esta permitida, forzar la primera permitida
  const pestanaActiva = document.querySelector('#tabsCargue .nav-link.active');
  if (pestanaActiva) {
    const target = pestanaActiva.getAttribute('data-bs-target');
    const tarjetaId = target.replace('#', '');
    if (!p.tarjetas.includes(tarjetaId)) {
      const primeraPermitida = p.tarjetas[0];
      const tab = document.querySelector('#tabsCargue .nav-link[data-bs-target="#' + primeraPermitida + '"]');
      if (tab) { tab.click(); }
    }
  }

  // 2. Botones segun permisos
  const btnBackupTop = $('btnBackupTop');
  const btnBackupFloat = $('btnBackupFloat');
  const btnConfig = $('btnConfigApi');
  if (btnBackupTop) btnBackupTop.style.display = p.puedeBackup ? '' : 'none';
  if (btnBackupFloat) btnBackupFloat.style.display = p.puedeBackup ? '' : 'none';
  if (btnConfig) btnConfig.style.display = p.puedeConfig ? '' : 'none';

  // Tarjeta 1 — Validar/Crear traslado
  const t1Validar = $('t1_btnValidar');
  const t1Guardar = $('t1_btnGuardar');
  if (t1Validar) t1Validar.style.display = p.puedeCrearTraslado ? '' : 'none';
  // Auxiliar Entrega puede llamar traslado (validar) pero no crear
  if (PERFIL_ACTIVO === 'auxiliar_entrega') {
    if (t1Validar) { t1Validar.style.display = ''; t1Validar.innerHTML = '&#128269; Llamar traslado'; }
    if (t1Guardar) t1Guardar.innerHTML = '&#128190; Registrar entrega';
  } else if (p.puedeCrearTraslado) {
    if (t1Validar) t1Validar.innerHTML = '&#128269; Validar y traer datos';
    if (t1Guardar) t1Guardar.innerHTML = '&#128190; Guardar en Drive';
  }
  if (t1Guardar && !p.puedeCrearTraslado && PERFIL_ACTIVO !== 'auxiliar_entrega') {
    t1Guardar.style.display = 'none';
  }

  // Recibido Logistica: en T2 muestra solo boton de recibido
  if (PERFIL_ACTIVO === 'recibido_logistica') {
    const t2Guardar = $('t2_btnGuardar');
    const t2Imprimir = $('t2_btnImprimir');
    if (t2Guardar) { t2Guardar.innerHTML = '&#9989; Registrar Recibido'; t2Guardar.style.display = ''; }
    if (t2Imprimir) t2Imprimir.style.display = 'none';
  }

  // 3. Campos en solo lectura segun perfil
  (p.soloLectura || []).forEach(id => {
    const el = $(id);
    if (el) { el.readOnly = true; el.classList.add('campo-bloqueado'); }
  });
  // Restaurar campos que NO estan en soloLectura del perfil actual
  Object.values(PERFILES).forEach(pf => {
    (pf.soloLectura || []).forEach(id => {
      if (!(p.soloLectura || []).includes(id)) {
        const el = $(id);
        if (el && !el.id.startsWith('t1_bodega') && !el.id.startsWith('t1_destino') &&
            !el.id.startsWith('t1_zona') && !el.id.startsWith('t1_cantidad') &&
            !el.id.startsWith('t1_tipo') && !el.id.startsWith('t1_urgente') &&
            !el.id.startsWith('t2_bodega') && !el.id.startsWith('t2_destino') &&
            !el.id.startsWith('t2_zona') && !el.id.startsWith('t2_cantidad') &&
            !el.id.startsWith('t2_urgente') && !el.id.startsWith('t2_responsable') &&
            !el.id.startsWith('t2_quien_alista') && !el.id.startsWith('t2_marca')) {
          el.readOnly = false;
          el.classList.remove('campo-bloqueado');
        }
      }
    });
  });

  // 4. Lista desplegable de responsables (si el perfil puede asignar)
  if (p.puedeAsignarResponsable) {
    const sel = $('t1_responsable_entrega');
    if (sel && sel.tagName === 'INPUT') {
      // Convertir input a select si no existe ya
      const parent = sel.parentNode;
      const newSel = document.createElement('select');
      newSel.className = 'form-select';
      newSel.id = 't1_responsable_entrega';
      newSel.innerHTML = '<option value="">Seleccione responsable...</option>' +
        (CONFIG.conductores || []).map(c => '<option>' + esc(c) + '</option>').join('') +
        '<option>OTRO</option>';
      parent.replaceChild(newSel, sel);
    } else if (sel && sel.tagName === 'SELECT') {
      // Ya es select, actualizar opciones
      sel.innerHTML = '<option value="">Seleccione responsable...</option>' +
        (CONFIG.conductores || []).map(c => '<option>' + esc(c) + '</option>').join('') +
        '<option>OTRO</option>';
    }
  }

  // 5. Mostrar panel de perfil activo en la barra
  const badge = $('perfilBadge');
  if (badge) {
    badge.innerHTML = p.icon + ' ' + esc(p.label);
    badge.className = 'badge ' + p.color + ' mf-perfil-badge';
  }

  // 6. Pintar info de perfiles en modal
  pintarPerfiles();
  pintarIdsCarpetas();
  pintarPerfilesUsuario();
}

/** Verifica si el destino del traslado exige captura de punto segun el perfil. */
function destinoExigePunto(destino) {
  const p = PERFILES[PERFIL_ACTIVO];
  if (!p.exigePunto) return false; // Admin, Auxiliar, etc. no exigen
  const d = normalizarCabecera(destino);
  return !(p.puntoExcepciones || []).some(exc => d.indexOf(exc) !== -1);
}

function cargarConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? Object.assign({}, CONFIG_DEFAULT, JSON.parse(raw)) : Object.assign({}, CONFIG_DEFAULT);
  } catch (e) { return Object.assign({}, CONFIG_DEFAULT); }
}
function guardarConfig() { localStorage.setItem(LS_KEY, JSON.stringify(CONFIG)); }

function cargarSesion() {
  try {
    const raw = localStorage.getItem(LS_DATA);
    return raw ? JSON.parse(raw) : { despachos: [], logistica: [], recepcion: [], facturacion: [], inventario: [] };
  } catch (e) {
    return { despachos: [], logistica: [], recepcion: [], facturacion: [], inventario: [] };
  }
}
function guardarSesion() { localStorage.setItem(LS_DATA, JSON.stringify(SESION)); }

/* ---------------------------------------------------------------------------
 * 2. LECTURA DINAMICA POR NOMBRE DE CABECERA (nunca por indice)
 * ------------------------------------------------------------------------- */

/** Normaliza cabeceras: minusculas, sin acentos, sin signos, espacios simples. */
function normalizarCabecera(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/\u00A0/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Obtiene un valor de una fila/objeto buscando la columna por NOMBRE.
 * @param {Object|Array} fila  Objeto {cabecera: valor} o arreglo de celdas.
 * @param {string|string[]} nombreColumna Nombre o alias aceptados.
 * @param {Object} [mapa] Mapa {cabeceraNormalizada: indice} si fila es arreglo.
 */
function obtenerValorPorNombreColumna(fila, nombreColumna, mapa) {
  const alias = Array.isArray(nombreColumna) ? nombreColumna : [nombreColumna];
  if (Array.isArray(fila)) {
    for (const a of alias) {
      const idx = mapa ? mapa[normalizarCabecera(a)] : undefined;
      if (idx !== undefined) return fila[idx] ?? '';
    }
    return '';
  }
  // Objeto: se construye un indice normalizado de sus propias claves.
  const indice = {};
  Object.keys(fila || {}).forEach(k => { indice[normalizarCabecera(k)] = fila[k]; });
  for (const a of alias) {
    const k = normalizarCabecera(a);
    if (indice[k] !== undefined && indice[k] !== '') return indice[k];
  }
  return '';
}

/** Construye el mapa de cabeceras de una matriz leida de Sheets. */
function construirMapaCabeceras(headers) {
  const mapa = {};
  (headers || []).forEach((h, i) => {
    const k = normalizarCabecera(h);
    if (k && mapa[k] === undefined) mapa[k] = i;
  });
  return mapa;
}

/* Alias oficiales de cada campo: tolera variaciones de nombre en las hojas. */
const ALIAS = {
  traslado:      ['Documento TRASLADO', 'TRASLADO', 'Numero Traslado', 'Documento de Traslado'],
  bodegaOrigen:  ['Bodega Origen', 'BODEGA ORIGEN', 'BODEGA ORIGEN DEL TRASLADO', 'Bodega Origen Emisora', 'Bodega Origen Extrema'],
  destino:       ['DESTINO', 'Destino', 'BODEGA DESTINO DEL TRASLADO', 'Bodega Destino'],
  cantidad:      ['Cantidad', 'CANTIDAD', 'Cantidad Enviada'],
  tipo:          ['TIPO', 'Tipo'],
  urgente:       ['Urgente', 'URGENTE', 'PRIORIDAD'],
  zona:          ['ZONA', 'Zona'],
  quienAlista:   ['QUIEN ALISTA', 'Responsable de Empacar / Rotular', 'Responsable de Empacar'],
  respEntrega:   ['RESPONSABLE DE ENTREGA CENDIS', 'Responsable de Entrega'],
  marcaTemporal: ['Marca temporal', 'Fecha Inicial', 'Timestamp'],
  fEntregaLog:   ['FECHA ENTREGA LOGISTICA', 'Fecha y Hora de Registro Logistico'],
  fPlanillaEnvio:['FECHA PLANILLA ENVIO LOGISTICA', 'Fecha de Envio del Traslado'],
  fRecibidoPunto:['FECHA RECIBIDO EN PUNTO'],
  conductor:     ['CONDUCTOR', 'Responsable de Envio'],
  planilla:      ['PLANILLA', 'Planilla'],
  seguimiento:   ['SEGUIMIENTO', 'Estado Seguimiento']
};

/* ---------------------------------------------------------------------------
 * 3. CLIENTE API (Google Apps Script Web App)
 * ------------------------------------------------------------------------- */

/** POST JSON via text/plain para evitar preflight CORS en Apps Script. */
async function api(action, payload = {}) {
  if (!CONFIG.apiUrl) throw new Error('No se ha configurado la URL de la Web App.');
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action }, payload))
  });
  const data = await res.json();
  if (data.ok === false) throw new Error(data.error || 'Error del backend');
  return data;
}

/* ---------------------------------------------------------------------------
 * 4. UTILIDADES DE INTERFAZ
 * ------------------------------------------------------------------------- */
const $ = id => document.getElementById(id);
const val = id => ($(id) ? String($(id).value || '').trim() : '');
const setVal = (id, v) => { if ($(id)) $(id).value = (v === undefined || v === null) ? '' : v; };

function ahora() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

function toast(msg, tipo = 'primary') {
  const wrap = $('toastWrap');
  const el = document.createElement('div');
  el.className = `alert alert-${tipo} shadow-sm py-2 px-3 small`;
  el.innerHTML = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/** Marca en rojo los campos obligatorios vacios. Devuelve true si todo esta ok. */
function validarObligatorios(ids) {
  let ok = true;
  ids.forEach(id => {
    const el = $(id);
    if (!el) return;
    if (!String(el.value || '').trim()) { el.classList.add('is-invalid-mf'); ok = false; }
    else el.classList.remove('is-invalid-mf');
  });
  if (!ok) toast('Complete los campos obligatorios resaltados en rojo.', 'danger');
  return ok;
}

/* ---------------------------------------------------------------------------
 * 5. CONFIGURACION DE CARPETAS DE DRIVE POR TARJETA
 * ------------------------------------------------------------------------- */
const MODULOS = ['despachos', 'logistica', 'recepcion', 'facturacion', 'inventario'];

/** Valida contra Drive el ID de carpeta de la tarjeta y lo persiste. */
async function validarFolder(modulo) {
  const id = val('folder_' + modulo);
  const est = $('estado_folder_' + modulo);
  if (!id) { est.innerHTML = '<span class="text-danger">Ingrese el ID de la carpeta.</span>'; return; }
  CONFIG.folders[modulo] = id;
  guardarConfig();
  if (CONFIG.modoLocal || !CONFIG.apiUrl) {
    est.
