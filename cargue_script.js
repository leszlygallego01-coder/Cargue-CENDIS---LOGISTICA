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
  apiUrl: 'https://script.google.com/macros/s/AKfycbxyQBBPPZVYpuwCtKX1MTPVp4Pkaa6uJQc1xcbh3Tk68mrDFGRc5MQQ034CyOR2okYr/exec',
  modoLocal: false,
  folders: {
    trasladosConsulta: '1u30YFhTsocLuUoFrVUnb6Fk9zwVsT_E_',  // Carpeta TRASLADOS — ORIGEN fija (solo lectura)
    despachos:         '1tUXm2FVVFWBnyeBrzTIRpobYTKxk7OH8',  // Carpeta DESTINO (escritura/guardado)
    logistica:         '1_e8ycbznm0jA4kOBwkJuXM4EVdcwXzYe',
    recepcion:         '1u5aQURkwKw4CqxejzOSxYgeF6dvcj-T0',
    facturacion:       '1hpRjykdlFyU_nsdXb0ttqOJdHNoXcTG-',
    inventario:        '11Iml2ggmvAK8aHeUbDGeWbyhLxCtrPoY',
    backup:            '1HVTZyLasrbZArTN34kmc0lCKaQa2qQ_5'
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
 * 1b. CREDENCIALES DE USUARIO (LOGIN)
 * ------------------------------------------------------------------------- */
const CREDENCIALES = {
  // Perfiles institucionales
  administrador:       'Medis2024Admin',
  lider:              'Medis2024Lider',
  auxiliar_entrega:   'Medis2024Aux',
  recibido_logistica: 'Medis2024Recib',
  planillar_logistica:'Medis2024Plan',
  // Usuarios individuales (Auxiliares — ven T1, T2, T3)
  yuri:    'Yuri2024',
  julio:   'Julio2024',
  hernan:  'Hernan2024',
  diego:   'Diego2024',
  brian:   'Brian2024',
  karina:  'Karina2024',
  jhony:   'Jhony2024',
  natalia: 'Natalia2024',
  manuel:  'Manuel2024',
  claudia: 'Claudia2024',
  daniela: 'Daniela2024',
  juan:    'Juan2024',
  luzl:    'LuzL2024',
  liz:     'Liz2024',
  ana:     'Ana2024',
  leidy:   'Leidy2024',
  bivian:  'Bivian2024',
  vaneza:  'Vaneza2024',
  brayan:  'Brayan2024',
  nicoll:  'Nicoll2024',
  luis:    'Luis2024',
  estefania:'Estefania2024',
  angela:  'Angela2024',
  camila:  'Camila2024',
  angie:   'Angie2024',
  mayra:   'Mayra2024',
  derly:   'Derly2024',
  luisa:   'Luisa2024',
  luzn:    'LuzN2024',
  andrea:  'Andrea2024',
  andres:  'Andres2024',
  diegoe:  'DiegoE2024'
};
const LS_LOGIN = 'MF_LOGIN_OK';

/** Verifica las credenciales y, si son validas, oculta el overlay de login. */
function verificarLogin() {
  const usuario = val('loginUsuario');
  const clave   = val('loginContrasena');
  const errDiv  = $('loginError');

  if (!usuario) {
    errDiv.style.display = 'block';
    errDiv.textContent = 'Seleccione un perfil.'; return;
  }
  if (CREDENCIALES[usuario] && CREDENCIALES[usuario].toLowerCase() === clave.toLowerCase()) {
    const perfilAsignado = obtenerPerfilDeUsuario(usuario);
    localStorage.setItem(LS_LOGIN, perfilAsignado);
    PERFIL_ACTIVO = perfilAsignado;
    localStorage.setItem(LS_PERFIL, perfilAsignado);
    $('pantallaLogin').style.display = 'none';
    document.body.classList.remove('mf-login-activo');
    errDiv.style.display = 'none';
    // Sincronizar selector de perfil en navbar
    const sel = $('selPerfil');
    if (sel) sel.value = perfilAsignado;
    aplicarPerfil();
    toast('Sesion iniciada como <strong>' + PERFILES[perfilAsignado].label + '</strong>', 'success');
  } else {
    errDiv.style.display = 'block';
    errDiv.textContent = 'Usuario o contrasena incorrectos';
    $('loginContrasena').value = '';
    $('loginContrasena').focus();
  }
}

/** Cierra la sesion: borra login, muestra el overlay de nuevo. */
function cerrarSesion() {
  localStorage.removeItem(LS_LOGIN);
  localStorage.removeItem(LS_PERFIL);
  PERFIL_ACTIVO = 'administrador';
  $('pantallaLogin').style.display = 'flex';
  document.body.classList.add('mf-login-activo');
  $('loginUsuario').value = '';
  $('loginContrasena').value = '';
  $('loginError').style.display = 'none';
  toast('Sesion cerrada.', 'info');
}

/* ---------------------------------------------------------------------------
 * 1c. SISTEMA DE PERFILES DE USUARIO
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
  },
  auxiliar: {
    label: 'AUXILIAR',
    icon: '&#128119;',
    color: 'bg-secondary',
    descripcion: 'Personal auxiliar. Puede visualizar y registrar en Tarjetas 1, 2 y 3.',
    tarjetas: ['t1', 't2', 't3'],
    puedeCrearTraslado: false,
    exigePunto: false,
    puntoExcepciones: [],
    puedeAsignarResponsable: false,
    camposObligatorios: {
      t1: ['t1_traslado', 't1_quien_alista'],
      t2: ['t2_traslado'],
      t3: ['t3_traslado']
    },
    bloqueaAlRecibir: false,
    soloLectura: ['t1_responsable_entrega', 't1_recomendado'],
    puedeImprimir: false,
    puedeBackup: false,
    puedeConfig: false
  }
};

/** Perfil activo (persistido en localStorage). */
let PERFIL_ACTIVO = localStorage.getItem(LS_PERFIL) || 'administrador';

/** Usuarios individuales que usan el perfil AUXILIAR (ven T1, T2, T3). */
const USUARIOS_AUXILIAR = [
  'yuri','julio','hernan','diego','brian','karina','jhony','natalia',
  'manuel','claudia','daniela','juan','luzl','liz','ana','leidy',
  'bivian','vaneza','brayan','nicoll','luis','estefania','angela','camila',
  'angie','mayra','derly','luisa','luzn','andrea','andres','diegoe'
];

/** Devuelve el perfil que corresponde a un usuario dado. */
function obtenerPerfilDeUsuario(usuario) {
  if (PERFILES[usuario]) return usuario;  // Perfil institucional directo
  if (USUARIOS_AUXILIAR.includes(usuario)) return 'auxiliar';
  return 'administrador';  // Fallback
}

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

  // Perfiles que pueden ver el boton Validar: todos los que tienen t1
  if (t1Validar) t1Validar.style.display = p.tarjetas.includes('t1') ? '' : 'none';

  // Auxiliar (solo lectura): puede buscar/visualizar traslados pero NO guardar ni crear
  if (PERFIL_ACTIVO === 'auxiliar') {
    if (t1Validar) { t1Validar.style.display = ''; t1Validar.innerHTML = '&#128269; Buscar traslado'; }
    if (t1Guardar) { t1Guardar.style.display = 'none'; }
  // Auxiliar Entrega: puede llamar traslado (validar) Y registrar entrega (guardar)
  } else if (PERFIL_ACTIVO === 'auxiliar_entrega') {
    if (t1Validar) { t1Validar.style.display = ''; t1Validar.innerHTML = '&#128269; Llamar traslado'; }
    if (t1Guardar) { t1Guardar.style.display = ''; t1Guardar.innerHTML = '&#128190; Registrar entrega'; }
  } else if (p.puedeCrearTraslado) {
    if (t1Validar) t1Validar.innerHTML = '&#128269; Validar y traer datos';
    if (t1Guardar) { t1Guardar.style.display = ''; t1Guardar.innerHTML = '&#128190; Guardar en Drive'; }
  } else {
    // Otros perfiles con t1 (planillar_logistica): ven el boton pero con texto generico
    if (t1Validar) { t1Validar.style.display = ''; t1Validar.innerHTML = '&#128269; Llamar traslado'; }
    if (t1Guardar) { t1Guardar.style.display = ''; t1Guardar.innerHTML = '&#128190; Guardar en Drive'; }
  }

  // Auxiliar (solo lectura): ocultar botones de guardar e imprimir en T2/T3
  if (PERFIL_ACTIVO === 'auxiliar') {
    const t2Guardar = $('t2_btnGuardar');
    const t2Imprimir = $('t2_btnImprimir');
    const t3Guardar = $('t3_btnGuardar');
    const t3Imprimir = $('t3_btnImprimir');
    if (t2Guardar) t2Guardar.style.display = 'none';
    if (t2Imprimir) t2Imprimir.style.display = 'none';
    if (t3Guardar) t3Guardar.style.display = 'none';
    if (t3Imprimir) t3Imprimir.style.display = 'none';
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
    const cfg = raw ? Object.assign({}, CONFIG_DEFAULT, JSON.parse(raw)) : Object.assign({}, CONFIG_DEFAULT);
    /* Forzar URL de Web App fija (nunca permitir vacia o distinta) */
    cfg.apiUrl = CONFIG_DEFAULT.apiUrl;
    /* Forzar IDs de carpetas de Drive (valores oficiales) */
    cfg.folders = Object.assign({}, CONFIG_DEFAULT.folders, cfg.folders || {});
    cfg.folders.trasladosConsulta = CONFIG_DEFAULT.folders.trasladosConsulta; // TRASLADOS — ORIGEN fijo (lectura)
    // despachos = carpeta DESTINO (escritura) — editable por el usuario
    cfg.folders.logistica = CONFIG_DEFAULT.folders.logistica;   // 1_e8ycbz...  (carpeta LOGISTICA)
    cfg.folders.recepcion = CONFIG_DEFAULT.folders.recepcion;
    cfg.folders.facturacion = CONFIG_DEFAULT.folders.facturacion;
    cfg.folders.inventario = CONFIG_DEFAULT.folders.inventario;
    cfg.folders.backup = CONFIG_DEFAULT.folders.backup;
    /* Si la URL esta configurada, modo local debe estar desactivado */
    if (cfg.apiUrl && cfg.apiUrl.trim() !== '' && cfg.modoLocal) {
      cfg.modoLocal = false;
    }
    return cfg;
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
  traslado:      ['Documento TRASLADO', 'TRASLADO', 'Numero Traslado', 'Documento de Traslado', 'Traslado', 'TRASLADO'],
  fecha:         ['Fecha', 'FECHA', 'Fecha Traslado', 'Fecha del Traslado'],
  bodegaOrigen:  ['Bodega Origen', 'BODEGA ORIGEN', 'BODEGA ORIGEN DEL TRASLADO', 'Bodega Origen Emisora', 'Bodega Origen Extrema'],
  destino:       ['DESTINO', 'Destino', 'BODEGA DESTINO DEL TRASLADO', 'Bodega Destino', 'Bodega Destino'],
  recibido:      ['Recibido', 'RECIBIDO', 'Recibido Por'],
  codigo:        ['Codigo', 'CODIGO', 'Codigo Producto', 'Cod'],
  descripcion:   ['Descripcion', 'DESCRIPCION', 'Descripcion Producto', 'Producto'],
  unidades:      ['Unidades', 'UNIDADES', 'Cantidad', 'CANTIDAD', 'Cantidad Enviada'],
  usuario:       ['Usuario', 'USUARIO', 'Usuario Registro'],
  lote:          ['Lote', 'LOTE', 'Lote Producto'],
  fechaVencLote: ['Fecha Vencimiento Lote', 'FECHA VENCIMIENTO LOTE', 'Fecha Vencimiento', 'Vencimiento'],
  observaciones: ['Observaciones', 'OBSERVACIONES', 'Observacion'],
  cantidad:      ['Cantidad', 'CANTIDAD', 'Cantidad Enviada', 'Unidades', 'UNIDADES'],
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

/* ==========================================================================
 * MAPA DE BODEGAS → ZONAS (desde archivo BODEGAS Y ZONAS.xlsx)
 * Permite auto-calcular la zona cuando no viene en los datos de Drive
 * pero se conoce la bodega destino.
 * ========================================================================== */
const BODEGA_ZONA_MAP = {
  'M07 UBATE CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M102 IPIALES NARIÑO': 'ZONA NARIÑO',
  'M103 SANDONA NARIÑO': 'ZONA NARIÑO',
  'M104 LEIVA NARIÑO': 'ZONA NARIÑO',
  'M111 PUERTO TEJADA CAUCA': 'ZONA CAUCA NORTE',
  'M112 BOLIVAR CAUCA': 'ZONA CAUCA SUR',
  'M116 TIMBIQUI CAUCA': 'ZONA CAUCA SUR',
  'M117 EL BORDO CAUCA': 'ZONA CAUCA SUR',
  'M118 MERCADERES CAUCA': 'ZONA CAUCA SUR',
  'M119 CORINTO CAUCA': 'ZONA CAUCA NORTE',
  'M120 ROSAS CAUCA': 'ZONA CAUCA SUR',
  'M123 MONIQUIRA BOYACA': 'ZONA BOYACA',
  'M124 CARTAGENA DEL CHAIRA CAQUETA': 'ZONA CAQUETA',
  'M125 SAN VICENTE DEL CAGUAN CAQUETA': 'ZONA CAQUETA',
  'M126 PUERTO RICO CAQUETA': 'ZONA CAQUETA',
  'M130 EL DONCELLO CAQUETA': 'ZONA CAQUETA',
  'M133 SAN JOSE DE FRAGUA CAQUETA': 'ZONA CAQUETA',
  'M137 BALBOA CAUCA': 'ZONA CAUCA SUR',
  'M138 BUENOS AIRES CAUCA CAUCA': 'ZONA CAUCA NORTE',
  'M139 BUENOS AIRES - TIMBA CAUCA': 'ZONA CAUCA NORTE',
  'M140 CAJIBIO CAUCA': 'ZONA CAUCA CENTRO',
  'M141 CAJIBIO ROSARIO CAUCA CAUCA': 'ZONA CAUCA CENTRO',
  'M143 INZA CAUCA': 'ZONA CAUCA CENTRO',
  'M144 VEGA CAUCA': 'ZONA CAUCA SUR',
  'M145 LA VEGA - SAN MIGUEL CAUCA': 'ZONA CAUCA SUR',
  'M146 LOPEZ DE MICAY CAUCA CAUCA': 'ZONA CAUCA SUR',
  'M147 MIRANDA CAUCA': 'ZONA CAUCA NORTE',
  'M148 MORALES CAUCA': 'ZONA CAUCA CENTRO',
  'M149 PADILLA CAUCA': 'ZONA CAUCA NORTE',
  'M15 IBAGUE TOLIMA': 'ZONA TOLIMA',
  'M151 PIENDAMO CAUCA': 'ZONA CAUCA CENTRO',
  'M152 POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'M153 PURACE COCONUCO CAUCA CAUCA': 'ZONA CAUCA CENTRO',
  'M154 PURACE SANTA LETICIA CAUCA CAUCA': 'ZONA CAUCA CENTRO',
  'M156 SANTANDER QUILICHAO CAUCA CAUCA': 'ZONA CAUCA NORTE',
  'M157 SUAREZ CAUCA': 'ZONA CAUCA NORTE',
  'M158 SUCRE CAUCA': 'ZONA CAUCA SUR',
  'M159 TIMBIO CAUCA': 'ZONA CAUCA CENTRO',
  'M16 MEDELLIN ANTIOQUIA': 'ZONA EJE CAFETERO',
  'M160 ALVARADO TOLIMA': 'ZONA TOLIMA',
  'M161 AMBALEMA TOLIMA': 'ZONA TOLIMA',
  'M162 ANZOATEGUI TOLIMA': 'ZONA TOLIMA',
  'M163 ARMERO TOLIMA': 'ZONA TOLIMA',
  'M164 ATACO TOLIMA': 'ZONA TOLIMA',
  'M165 CAJAMARCA TOLIMA': 'ZONA TOLIMA',
  'M166 CARMEN DE APICALA TOLIMA': 'ZONA TOLIMA',
  'M167 CASABIANCA TOLIMA': 'ZONA TOLIMA',
  'M168 CHAPARRAL TOLIMA': 'ZONA TOLIMA',
  'M169 COYAIMA TOLIMA': 'ZONA TOLIMA',
  'M17 ALVERNIA VALLE DEL CAUCA': 'ZONA VALLE',
  'M170 CUNDAY TOLIMA': 'ZONA TOLIMA',
  'M171 GUAMO TOLIMA': 'ZONA TOLIMA',
  'M172 HONDA TOLIMA': 'ZONA TOLIMA',
  'M173 ICONONZO TOLIMA': 'ZONA TOLIMA',
  'M174 LERIDA TOLIMA': 'ZONA TOLIMA',
  'M175 LIBANO TOLIMA': 'ZONA TOLIMA',
  'M176 MARIQUITA TOLIMA': 'ZONA TOLIMA',
  'M177 PALOCABILDO TOLIMA': 'ZONA TOLIMA',
  'M178 PRADO TOLIMA': 'ZONA TOLIMA',
  'M179 PURIFICACION TOLIMA': 'ZONA TOLIMA',
  'M180 RIOBLANCO TOLIMA': 'ZONA TOLIMA',
  'M181 ROVIRA TOLIMA': 'ZONA TOLIMA',
  'M182 SAN ANTONIO TOLIMA TOLIMA': 'ZONA TOLIMA',
  'M183 VILLAHERMOSA TOLIMA': 'ZONA TOLIMA',
  'M184 EL TAMBO CAUCA CAUCA': 'ZONA CAUCA SUR',
  'M188 PAEZ CAUCA': 'ZONA CAUCA CENTRO',
  'M189 CALDONO CAUCA': 'ZONA CAUCA NORTE',
  'M190 ALMAGUER CAUCA': 'ZONA CAUCA SUR',
  'M193 FLORENCIA CAUCA': 'ZONA CAUCA SUR',
  'M194 GUACHENE CAUCA': 'ZONA CAUCA NORTE',
  'M195 LA SIERRA CAUCA CAUCA': 'ZONA CAUCA SUR',
  'M197 PUERTO TEJADA CAUCA': 'ZONA CAUCA NORTE',
  'M21 CARTAGO VALLE DEL CAUCA': 'ZONA VALLE',
  'M211 QUINCHIA RISARALDA': 'ZONA EJE CAFETERO',
  'M212 PUEBLO RICO RISARALDA RISARALDA': 'ZONA EJE CAFETERO',
  'M214 PEREIRA CUBA RISARALDA': 'ZONA EJE CAFETERO',
  'M108 DOSQUEBRADAS RISARALDA': 'ZONA EJE CAFETERO',
  'M218 SAN SEBASTIAN CAUCA CAUCA': 'ZONA CAUCA SUR',
  'M223 CALI VALLE DEL CAUCA': 'ZONA VALLE',
  'M225 BUGA VALLE DEL CAUCA': 'ZONA VALLE',
  'SM226 ORTEGA TOLIMA': 'ZONA TOLIMA',
  'M235 POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'M239 PARATEBUENO CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M240 SAN JUAN DEL CESAR GUAJIRA': 'ZONA COSTA NORTE',
  'M241 FONSECA GUAJIRA': 'ZONA COSTA NORTE',
  'M244 TOCANCIPA CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M250 MITU VAUPES': 'ZONA CUNDINAMARCA',
  'M251 ANAPOIMA CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M253 PURACE CAUCA': 'ZONA CAUCA CENTRO',
  'SM256 MANAURE GUAJIRA': 'ZONA COSTA NORTE',
  'M259 FUSAGASUGA CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M266 PEREIRA RISARALDA': 'ZONA EJE CAFETERO',
  'M267 PEREIRA GARZAS RISARALDA RISARALDA': 'ZONA EJE CAFETERO',
  'M268 URIBIA LA GUAJIRA GUAJIRA': 'ZONA COSTA NORTE',
  'M27 PALMIRA VALLE DEL CAUCA': 'ZONA VALLE',
  'M270 SANTA ROSA CAUCA CAUCA': 'ZONA CAUCA SUR',
  'M283 DUITAMA BOYACA': 'ZONA BOYACA',
  'M286 CHIQUINQUIRÁ BOYACA': 'ZONA BOYACA',
  'M29 FLORIDA VALLE DEL CAUCA': 'ZONA VALLE',
  'M291 LA HERRADURA CAUCA': 'ZONA CAUCA SUR',
  'M292 GARAGOA BOYACA': 'ZONA BOYACA',
  'SM299 MAICAO GUAJIRA': 'ZONA COSTA NORTE',
  'SM300 BARRANCAS GUAJIRA': 'ZONA COSTA NORTE',
  'SM301 HATONUEVO GUAJIRA': 'ZONA COSTA NORTE',
  'SM302 VILLANUEVA GUAJIRA': 'ZONA COSTA NORTE',
  'SM303 URUMITA GUAJIRA': 'ZONA COSTA NORTE',
  'SM304 DIBULLA GUAJIRA': 'ZONA COSTA NORTE',
  'M305 VILLETA CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M306 GUADUAS CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M307 RICAURTE CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M308 BOJACA CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M309 TENJO CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M31 SAN VICENTE TULUA VALLE DEL CAUCA': 'ZONA VALLE',
  'M310 VILLA DE LEYVA BOYACA': 'ZONA BOYACA',
  'M311 GUICAN BOYACA': 'ZONA BOYACA',
  'M313 MIRAFLORES MIRAFLORES BOYACA': 'ZONA BOYACA',
  'M32 PASTO NARIÑO': 'ZONA NARIÑO',
  'M33 CALI VALLE DEL CAUCA': 'ZONA VALLE',
  'M34 TUNJA BOYACA': 'ZONA BOYACA',
  'M42 PEREIRA RISARALDA': 'ZONA EJE CAFETERO',
  'M43 MANIZALES CALDAS': 'ZONA EJE CAFETERO',
  'M46 ARMENIA QUINDIO': 'ZONA EJE CAFETERO',
  'M65 SOATA BOYACA': 'ZONA BOYACA',
  'M73 SOGAMOSO BOYACA': 'ZONA BOYACA',
  'M75 RIOHACHA GUAJIRA': 'ZONA COSTA NORTE',
  'M76 PUERTO BOYACA': 'ZONA BOYACA',
  'M77 SILVIA CAUCA': 'ZONA CAUCA CENTRO',
  'M78 PIENDAMO CAUCA': 'ZONA CAUCA CENTRO',
  'M79 CALOTO CAUCA': 'ZONA CAUCA NORTE',
  'M82 SANTANDER QUILICHAO CAUCA': 'ZONA CAUCA NORTE',
  'M84 POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'M87 YUMBO VALLE DEL CAUCA': 'ZONA VALLE',
  'M88 GUACARI VALLE DEL CAUCA': 'ZONA VALLE',
  'M89 GINEBRA VALLE DEL CAUCA': 'ZONA VALLE',
  'M90 CERRITO VALLE DEL CAUCA': 'ZONA VALLE',
  'M92 CANDELARIA VALLE DEL CAUCA': 'ZONA VALLE',
  'M93 PRADERA VALLE DEL CAUCA': 'ZONA VALLE',
  'M94 CALI VALLE DEL CAUCA': 'ZONA VALLE',
  'M95 POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'M96 SANTANDER CAUCA': 'ZONA CAUCA NORTE',
  'N31 MDF. SURTIDROGAS POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'BOD. N40 BOGOTÁ MEDISFARMA SURTIDROGAS CUNDINAMARCA': 'BODEGA VIRTUAL',
  'M107 BELEN DE UMBRIA RISARALDA': 'ZONA EJE CAFETERO',
  'M209 LA VIRGINIA RISARALDA RISARALDA': 'ZONA EJE CAFETERO',
  'M210 GUATICA RISARALDA': 'ZONA EJE CAFETERO',
  'M231 BOGOTA UNICENTRO CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M243 BOD. NUEVA EPS': 'BODEGA VIRTUAL',
  'BOD. N11 MEDISFARMA SURTIDROGAS CALI VALLE DEL CAUCA': 'ZONA VALLE',
  'B10 BODEGA BOGOTA': 'BODEGA VIRTUAL',
  'M20 JAMUNDI VALLE DEL CAUCA': 'ZONA VALLE',
  'M314 GUATEQUE GUATEQUE BOYACA': 'ZONA BOYACA',
  'M03 NEIVA HUILA': 'ZONA CAQUETA',
  '35 YOPAL CASANARE': 'CERRADA',
  'M217 TULUA E.D VALLE DEL CAUCA': 'BODEGA VIRTUAL',
  'M220 POPAYAN CAUCA': 'CERRADA',
  'M24 POPAYAN CAUCA': 'CERRADA',
  'CASOS JURIDICOS': 'BODEGA VIRTUAL',
  'BOD. 80 FACTURACION': 'BODEGA VIRTUAL',
  'M213 CALI VALLE DEL CAUCA': 'ZONA VALLE',
  'CENDIS PRINCIPAL TULUA PARQUE INDUSTRIAL': 'BODEGA VALLE',
  'B05 ALTO COSTO': 'BODEGA VALLE',
  'ST28 BODEGA LOGISTICA': 'BODEGA VIRTUAL',
  'M155 ROSAS CAUCA (CERRADA)': 'CERRADA',
  'ST07 MDF. POPAYAN SANTA RITA LA VEGA CAUCA': 'CERRADA',
  'M61 PASTO NARIÑO': 'CERRADA',
  'M18 BUENAVENTURA VALLE DEL CAUCA': 'ZONA VALLE',
  'M185 SAN AGUSTIN HUILA HUILA': 'ZONA CAQUETA',
  'M249 PALMIRA VALLE DEL CAUCA': 'ZONA VALLE',
  'M91 CALIMA VALLE DEL CAUCA': 'ZONA VALLE',
  'M337 CARTAGENA DE INDIAS BOLIVAR': 'CERRADA',
  'M85 POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'M219 POPAYAN PARQUE INDUSTRIAL CAUCA': 'ZONA CAUCA CENTRO',
  'M257 PEREIRA PINARES RISARALDA RISARALDA': 'LOCAL Y ACTIVOS',
  'M260 LA MESA CUNDINAMARCA': 'CERRADA',
  '02M FLORENCIA CAQUETA': 'ZONA CAQUETA',
  'B9 POPAYAN PARQUE INDUSTRIAL CAUCA': 'BODEGA',
  'M100 TUMACO NARIÑO': 'ZONA NARIÑO',
  'M245 BUCARAMANGA SANTANDER SANTANDER': 'ZONA CUNDINAMARCA',
  'URG01 MDF. URGENCIAS TULUA VALLE DEL CAUCA': 'BODEGA VIRTUAL',
  /* Entradas adicionales heredadas (compatibilidad con datos historicos) */
  'B1 BODEGA PRINCIPAL POPAYAN CAUCA': 'BODEGA',
  'B2 BODEGA PRINCIPAL CALI VALLE': 'BODEGA VALLE',
  'B3 BODEGA PRINCIPAL PALMIRA VALLE': 'BODEGA VALLE',
  'B4 BODEGA PRINCIPAL TULUA VALLE': 'BODEGA VALLE',
  'B5 BODEGA PRINCIPAL BUGA VALLE': 'BODEGA VALLE',
  'B6 BODEGA PRINCIPAL CARTAGO VALLE': 'BODEGA VALLE',
  'B7 BODEGA PRINCIPAL IBAGUE TOLIMA': 'BODEGA',
  'B8 BODEGA PRINCIPAL MANIZALES CALDAS': 'BODEGA',
  '01M VIRTUAL NACIONAL': 'BODEGA VIRTUAL'
};

/** Lista de todas las zonas unicas para selects/filtros. */
const ZONAS_LISTA = [
  'ZONA CUNDINAMARCA', 'ZONA NARIÑO', 'ZONA CAUCA NORTE', 'ZONA CAUCA SUR',
  'ZONA CAUCA CENTRO', 'ZONA BOYACA', 'ZONA CAQUETA', 'ZONA VALLE',
  'ZONA EJE CAFETERO', 'ZONA TOLIMA', 'ZONA COSTA NORTE', 'BODEGA',
  'BODEGA VALLE', 'BODEGA VIRTUAL', 'CERRADA', 'LOCAL Y ACTIVOS'
];

/** Busca la zona correspondiente a una bodega por nombre parcial o exacto. */
function zonaDeBodega(nombreBodega) {
  if (!nombreBodega) return '';
  const nb = String(nombreBodega).trim();
  // Busqueda exacta
  if (BODEGA_ZONA_MAP[nb]) return BODEGA_ZONA_MAP[nb];
  // Busqueda parcial (normalizada)
  const nbNorm = normalizarCabecera(nb);
  for (const [bodega, zona] of Object.entries(BODEGA_ZONA_MAP)) {
    if (normalizarCabecera(bodega) === nbNorm) return zona;
  }
  // Busqueda por inicio del codigo (e.g. "M111" o "B2")
  for (const [bodega, zona] of Object.entries(BODEGA_ZONA_MAP)) {
    if (bodega.toUpperCase().startsWith(nb.substring(0, 4).toUpperCase())) return zona;
  }
  return '';
}

/* ---------------------------------------------------------------------------
 * 3. CLIENTE API (Google Apps Script Web App)
 * ------------------------------------------------------------------------- */

/** POST JSON via text/plain para evitar preflight CORS en Apps Script. */
async function api(action, payload = {}) {
  if (!CONFIG.apiUrl) throw new Error('No se ha configurado la URL de la Web App.');
  try {
    const res = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ action }, payload))
    });
    /* Si la respuesta es HTML (Google login redirect), detectarlo */
    const ct = res.headers.get('Content-Type') || '';
    if (ct.includes('text/html')) {
      throw new Error('La Web App requiere autenticacion. Redespliegue con acceso "Cualquier usuario" (publico).');
    }
    const data = await res.json();
    if (data.ok === false) throw new Error(data.error || 'Error del backend');
    return data;
  } catch (e) {
    if (e.message && e.message.includes('Failed to fetch')) {
      throw new Error('No se pudo conectar a la Web App. Verifique: 1) La URL es correcta, 2) La Web App esta desplegada como "Cualquier usuario" (acceso publico), 3) No hay redireccion a login de Google.');
    }
    throw e;
  }
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
  // Si es "despachos", el usuario está configurando la carpeta DESTINO (escritura)
  // Validar carpeta Traslados (origen fijo)
  CONFIG.folders[modulo] = id;
  guardarConfig();

  // Sincronizar folder_despachos_t2 si se actualizo despachos
  if (modulo === 'despachos') {
    const t2input = $('folder_despachos_t2');
    if (t2input) { t2input.value = id; }
    const estT2 = $('estado_folder_despachos_t2');
    if (estT2 && est.innerHTML) { estT2.innerHTML = est.innerHTML; }
  }

  if (CONFIG.modoLocal || !CONFIG.apiUrl) {
    est.innerHTML = '<span class="text-secondary">Guardado (modo local, sin verificar en Drive).</span>';
    if (modulo === 'despachos') {
      const estT2b = $('estado_folder_despachos_t2');
      if (estT2b) estT2b.innerHTML = est.innerHTML;
    }
    return;
  }
  est.innerHTML = 'Verificando...';
  try {
    const r = await api('validarCarpeta', { folderId: id });
    est.innerHTML = `<span class="text-success">&#10004; ${r.nombre}</span>`;
    if (modulo === 'despachos') {
      const estT2c = $('estado_folder_despachos_t2');
      if (estT2c) estT2c.innerHTML = est.innerHTML;
    }
  } catch (e) {
    est.innerHTML = `<span class="text-danger">&#10006; ${e.message}</span>`;
    if (modulo === 'despachos') {
      const estT2d = $('estado_folder_despachos_t2');
      if (estT2d) estT2d.innerHTML = est.innerHTML;
    }
  }
}

/* ---------------------------------------------------------------------------
 * 6. TARJETA 1 | PLANILLA ENTREGA DESPACHOS (validacion estricta por perfil)
 * ------------------------------------------------------------------------- */
const CAMPOS_OBLIGATORIOS_DRIVE = ['bodegaOrigen', 'destino', 'zona', 'cantidad', 'tipo', 'urgente'];

/** Busca el traslado en Drive (carpeta TRASLADOS — ORIGEN fija trasladosConsulta) o en la sesion local, y valida su integridad. */
async function t1ValidarTraslado() {
  const traslado = val('t1_traslado');
  const est = $('t1_estadoTraslado');
  $('t1_btnGuardar').disabled = true;
  if (!traslado) { est.innerHTML = '<span class="text-danger">Indique el numero de traslado.</span>'; return; }

  est.innerHTML = 'Consultando Google Drive <small class="text-muted">(carpeta Traslados: ' + (CONFIG.folders.trasladosConsulta || '???').substring(0,8) + '...)</small>...';
  let registro = null;
  try {
    if (CONFIG.modoLocal || !CONFIG.apiUrl) {
      registro = buscarTrasladoLocal('despachos', traslado) || buscarTrasladoLocal('logistica', traslado);
    } else {
      const r = await api('buscarTraslado', {
        folderId: CONFIG.folders.trasladosConsulta,
        modulo: 'despachos', traslado
      });
      registro = r.encontrado ? r.registro : null;
    }
  } catch (e) {
    est.innerHTML = `<span class="text-danger">Error de conexion: ${e.message}</span><br><small class="text-muted">Web App: ${CONFIG.apiUrl ? CONFIG.apiUrl.substring(0,50) + '...' : 'NO CONFIGURADA'} | Carpeta Traslados: ${CONFIG.folders.trasladosConsulta || '(vacia)'}</small>`;
    return;
  }

  if (!registro) {
    est.innerHTML = `<span class="text-danger">&#10006; Traslado <b>${esc(traslado)}</b> NO encontrado en la carpeta de Despachos. Verifique el numero o la base de datos en Drive.</span>`;
    limpiarAutocompletadosT1();
    return;
  }

  // Autocompletado por NOMBRE de cabecera (no por posicion).
  const datos = {
    traslado:     obtenerValorPorNombreColumna(registro, ALIAS.traslado),
    fecha:        obtenerValorPorNombreColumna(registro, ALIAS.fecha),
    bodegaOrigen: obtenerValorPorNombreColumna(registro, ALIAS.bodegaOrigen),
    destino:      obtenerValorPorNombreColumna(registro, ALIAS.destino),
    recibido:     obtenerValorPorNombreColumna(registro, ALIAS.recibido),
    codigo:       obtenerValorPorNombreColumna(registro, ALIAS.codigo),
    descripcion:  obtenerValorPorNombreColumna(registro, ALIAS.descripcion),
    unidades:     obtenerValorPorNombreColumna(registro, ALIAS.unidades),
    usuario:      obtenerValorPorNombreColumna(registro, ALIAS.usuario),
    lote:         obtenerValorPorNombreColumna(registro, ALIAS.lote),
    fechaVenc:    obtenerValorPorNombreColumna(registro, ALIAS.fechaVencLote),
    observaciones:obtenerValorPorNombreColumna(registro, ALIAS.observaciones),
    cantidad:     obtenerValorPorNombreColumna(registro, ALIAS.cantidad),
    tipo:         obtenerValorPorNombreColumna(registro, ALIAS.tipo),
    urgente:      obtenerValorPorNombreColumna(registro, ALIAS.urgente) || 'NO',
    zona:         obtenerValorPorNombreColumna(registro, ALIAS.zona)
  };

  // Auto-calcular zona si no viene en Drive: usar Bodega Destino como clave
  if (!String(datos.zona).trim() && String(datos.destino).trim()) {
    datos.zona = zonaDeBodega(datos.destino);
    if (datos.zona) {
      toast('Zona auto-calculada desde Bodega Destino: <b>' + datos.zona + '</b>', 'info');
    }
  }
  // Si aun no hay zona, intentar con Bodega Origen
  if (!String(datos.zona).trim() && String(datos.bodegaOrigen).trim()) {
    datos.zona = zonaDeBodega(datos.bodegaOrigen);
    if (datos.zona) {
      toast('Zona inferida desde Bodega Origen: <b>' + datos.zona + '</b>', 'warning');
    }
  }

  setVal('t1_traslado_mostrar', datos.traslado);
  setVal('t1_fecha', datos.fecha);
  setVal('t1_bodega_origen', datos.bodegaOrigen);
  setVal('t1_destino', datos.destino);
  setVal('t1_recibido', datos.recibido);
  setVal('t1_codigo', datos.codigo);
  setVal('t1_descripcion', datos.descripcion);
  setVal('t1_unidades', datos.unidades);
  setVal('t1_usuario', datos.usuario);
  setVal('t1_lote', datos.lote);
  setVal('t1_fechaVenc', datos.fechaVenc);
  setVal('t1_observaciones_drive', datos.observaciones);
  setVal('t1_cantidad', datos.cantidad);
  setVal('t1_tipo', datos.tipo);
  setVal('t1_urgente', datos.urgente);
  setVal('t1_zona', datos.zona);

  // Validacion estricta: si falta informacion requerida, NO permite avanzar.
  // Nota: zona se considera completo si se pudo auto-calcular
  const camposAValidar = CAMPOS_OBLIGATORIOS_DRIVE.filter(k => k !== 'zona');
  const faltantes = camposAValidar.filter(k => !String(datos[k]).trim());
  if (faltantes.length) {
    est.innerHTML = `<span class="text-danger">&#10006; Informacion incompleta en Drive (${faltantes.join(', ')}). No es posible continuar.</span>`;
    $('t1_btnGuardar').disabled = true;
    return;
  }
  // Verificar zona por separado: advertir si no se pudo calcular pero no bloquear
  if (!String(datos.zona).trim()) {
    est.innerHTML += ' <span class="text-warning">&#9888; No se pudo determinar la zona. Verifique manualmente.</span>';
  }

  // Perfil LIDER: verificar si el destino exige punto
  const puntoRow = $('t1_punto_row');
  if (PERFILES[PERFIL_ACTIVO].exigePunto) {
    if (puntoRow) puntoRow.style.display = '';
    if (destinoExigePunto(datos.destino)) {
      const puntoAuto = ahora();
      setVal('t1_punto_captura', puntoAuto);
      $('t1_punto_info').innerHTML = '<span class="text-info">&#128205; Punto capturado automaticamente: ' + puntoAuto + '</span>';
    } else {
      setVal('t1_punto_captura', '');
      $('t1_punto_info').innerHTML = '<span class="text-warning">&#9888; Traslado NO CENDIS — punto no exigido.</span>';
    }
  } else {
    if (puntoRow) puntoRow.style.display = 'none';
  }

  $('t1_badgeUrgente').innerHTML =
    normalizarCabecera(datos.urgente) === 'si' ? '<span class="mf-badge-urgente">TRASLADO URGENTE</span>' : '';
  est.innerHTML = '<span class="text-success">&#10004; Traslado valido y completo. Puede continuar.</span>';
  $('t1_btnGuardar').disabled = false;
}

function limpiarAutocompletadosT1() {
  ['t1_traslado_mostrar', 't1_fecha', 't1_bodega_origen', 't1_destino', 't1_recibido',
   't1_codigo', 't1_descripcion', 't1_unidades', 't1_usuario', 't1_lote', 't1_fechaVenc',
   't1_observaciones_drive', 't1_cantidad', 't1_tipo', 't1_urgente', 't1_zona'
  ].forEach(id => setVal(id, ''));
  $('t1_badgeUrgente').innerHTML = '';
}

/** Busqueda local (modo sin conexion) por nombre de columna. */
function buscarTrasladoLocal(modulo, traslado) {
  const objetivo = normalizarCabecera(traslado);
  return (SESION[modulo] || []).find(r =>
    normalizarCabecera(obtenerValorPorNombreColumna(r, ALIAS.traslado)) === objetivo
  ) || null;
}

/** Guarda la planilla de entrega de despachos. */
async function t1Guardar() {
  if (PERFIL_ACTIVO === 'auxiliar') { toast('Su perfil solo permite visualizar, no guardar.', 'warning'); return; }
  const p = PERFILES[PERFIL_ACTIVO];
  // Campos obligatorios segun perfil
  const obligT1 = (p.camposObligatorios && p.camposObligatorios.t1) ||
    ['t1_traslado', 't1_responsable_entrega', 't1_quien_alista', 't1_recomendado'];
  if (!validarObligatorios(obligT1)) return;

  const registro = {
    'Marca temporal': ahora(),
    'Documento TRASLADO': val('t1_traslado'),
    'Bodega Origen': val('t1_bodega_origen'),
    'DESTINO': val('t1_destino'),
    'Cantidad': val('t1_cantidad'),
    'TIPO': val('t1_tipo'),
    'Urgente': val('t1_urgente'),
    'ZONA': val('t1_zona'),
    'RESPONSABLE DE ENTREGA CENDIS': val('t1_responsable_entrega'),
    'QUIEN ALISTA': val('t1_quien_alista'),
    'Recomendado': val('t1_recomendado'),
    'Observaciones': val('t1_observaciones'),
    'SEGUIMIENTO': p.puedeCrearTraslado ? 'ALISTADO EN CENDIS' : 'REGISTRADO POR ' + p.label,
    'PERFIL REGISTRO': p.label
  };

  // LIDER: agregar punto capturado si aplica
  if (p.exigePunto && val('t1_punto_captura')) {
    registro['PUNTO CAPTURA AUTOMATICA'] = val('t1_punto_captura');
  }

  // RECIBIDO LOGISTICA / AUXILIAR: sellar fecha/hora automatica
  if (PERFIL_ACTIVO === 'auxiliar_entrega' || PERFIL_ACTIVO === 'recibido_logistica') {
    registro['FECHA Y HORA REGISTRO PERFIL'] = ahora();
  }

  await persistir('despachos', registro, 't1');
}

/* ---------------------------------------------------------------------------
 * 7. TARJETA 2 | LOGISTICA Y DESPACHOS
 * ------------------------------------------------------------------------- */
async function t2Buscar() {
  const traslado = val('t2_traslado');
  const est = $('t2_estadoTraslado');
  $('t2_btnGuardar').disabled = true;
  $('t2_btnImprimir').disabled = true;
  if (!traslado) { est.innerHTML = '<span class="text-danger">Indique el traslado.</span>'; return; }

  est.innerHTML = 'Consultando informacion de la Tarjeta 1...';
  let registro = null;
  try {
    if (CONFIG.modoLocal || !CONFIG.apiUrl) {
      registro = buscarTrasladoLocal('despachos', traslado);
    } else {
      // T2 lee de la carpeta DESTINO (donde T1 guardó)
      const folderT2 = val('folder_despachos_t2') || CONFIG.folders.despachos;
      const r = await api('buscarTraslado', {
        folderId: folderT2,
        modulo: 'despachos', traslado
      });
      registro = r.encontrado ? r.registro : null;
    }
  } catch (e) { est.innerHTML = `<span class="text-danger">${e.message}</span>`; return; }

  if (!registro) {
    est.innerHTML = '<span class="text-danger">&#10006; El traslado no tiene planilla de entrega registrada.</span>';
    return;
  }
  const t2Destino = obtenerValorPorNombreColumna(registro, ALIAS.destino);
  const t2BodegaOrigen = obtenerValorPorNombreColumna(registro, ALIAS.bodegaOrigen);
  let t2Zona = obtenerValorPorNombreColumna(registro, ALIAS.zona);
  // Auto-calcular zona si no viene en Drive
  if (!String(t2Zona).trim() && String(t2Destino).trim()) {
    t2Zona = zonaDeBodega(t2Destino);
    if (t2Zona) toast('T2 Zona auto-calculada: <b>' + t2Zona + '</b>', 'info');
  }
  if (!String(t2Zona).trim() && String(t2BodegaOrigen).trim()) {
    t2Zona = zonaDeBodega(t2BodegaOrigen);
    if (t2Zona) toast('T2 Zona inferida desde Origen: <b>' + t2Zona + '</b>', 'warning');
  }
  setVal('t2_bodega_origen', t2BodegaOrigen);
  setVal('t2_destino', t2Destino);
  setVal('t2_zona', t2Zona);
  setVal('t2_cantidad', obtenerValorPorNombreColumna(registro, ALIAS.cantidad));
  setVal('t2_urgente', obtenerValorPorNombreColumna(registro, ALIAS.urgente));
  setVal('t2_responsable_entrega', obtenerValorPorNombreColumna(registro, ALIAS.respEntrega));
  setVal('t2_quien_alista', obtenerValorPorNombreColumna(registro, ALIAS.quienAlista));
  setVal('t2_marca_temporal', obtenerValorPorNombreColumna(registro, ALIAS.marcaTemporal));
  est.innerHTML = '<span class="text-success">&#10004; Informacion cargada.</span>';
  $('t2_btnGuardar').disabled = false;
  $('t2_btnImprimir').disabled = !PERFILES[PERFIL_ACTIVO].puedeImprimir;
}

/** Guardar de logistica: sella automaticamente FECHA ENTREGA LOGISTICA. */
async function t2Guardar() {
  if (PERFIL_ACTIVO === 'auxiliar') { toast('Su perfil solo permite visualizar, no guardar.', 'warning'); return; }
  const p = PERFILES[PERFIL_ACTIVO];
  const obligT2 = (p.camposObligatorios && p.camposObligatorios.t2) ||
    ['t2_traslado', 't2_fecha_envio', 't2_conductor', 't2_placa', 't2_planilla'];
  if (!validarObligatorios(obligT2)) return;

  // RECIBIDO LOGISTICA: sella automaticamente y bloquea
  const esRecibidoLog = PERFIL_ACTIVO === 'recibido_logistica';

  const registro = {
    'Marca temporal': val('t2_marca_temporal') || ahora(),
    'Documento TRASLADO': val('t2_traslado'),
    'Bodega Origen': val('t2_bodega_origen'),
    'DESTINO': val('t2_destino'),
    'ZONA': val('t2_zona'),
    'Cantidad': val('t2_cantidad'),
    'Urgente': val('t2_urgente'),
    'RESPONSABLE DE ENTREGA CENDIS': val('t2_responsable_entrega'),
    'QUIEN ALISTA': val('t2_quien_alista'),
    'FECHA ENTREGA LOGISTICA': esRecibidoLog ? ahora() : ahora(),
    'QUIEN RECIBE LOGISTICA': val('t2_quien_recibe'),
    'FECHA RECIBIDO LOGISTICA': esRecibidoLog ? ahora() : '',
    'FECHA PLANILLA ENVIO LOGISTICA': val('t2_fecha_envio').replace('T', ' '),
    'CONDUCTOR': val('t2_conductor'),
    'PLACA': val('t2_placa').toUpperCase(),
    'PLANILLA': val('t2_planilla'),
    'Observaciones': val('t2_observaciones'),
    'PERFIL REGISTRO': p.label,
    'mes': new Date().toLocaleDateString('es-CO', { month: 'long' }).toUpperCase()
  };

  if (esRecibidoLog) {
    registro['SEGUIMIENTO'] = 'RECIBIDO LOGISTICA';
    registro['FECHA Y HORA RECIBIDO AUTOMATICO'] = ahora();
    registro['BLOQUEADO'] = 'SI';  // Marca para que no se pueda modificar
    toast('Registro de recibido sellado. Una vez recibido NO se puede modificar.', 'info');
  } else {
    registro['SEGUIMIENTO'] = 'DESPACHADO A LOGISTICA';
  }

  await persistir('logistica', registro, 't2');

  // Si es perfil recibido_logistica, bloquear campos despues de guardar
  if (esRecibidoLog && p.bloqueaAlRecibir) {
    const pane = $('t2');
    if (pane) {
      pane.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.id.indexOf('folder_') === 0) return;
        el.readOnly = true;
        el.disabled = true;
        el.classList.add('campo-bloqueado');
      });
    }
    $('t2_btnGuardar').disabled = true;
    $('t2_estadoTraslado').innerHTML = '<span class="text-secondary">&#128274; Registro bloqueado. No se puede modificar.</span>';
  }
}

/** Imprime la planilla y registra la fecha y hora REAL de salida a ruta. */
async function t2Imprimir() {
  if (!PERFILES[PERFIL_ACTIVO].puedeImprimir) {
    toast('Su perfil no tiene permiso para imprimir.', 'danger'); return;
  }
  const traslado = val('t2_traslado');
  if (!traslado) { toast('Indique el traslado antes de imprimir.', 'danger'); return; }
  const salida = ahora();

  $('t2_areaImpresion').innerHTML = `
    <div class="text-center mb-3">
      <img src="assets/logo.jpeg" style="height:60px" alt="Medisfarma"><h4>PLANILLA DE ENVIO DE TRASLADO</h4>
    </div>
    <table class="table table-bordered">
      <tr><th>Traslado</th><td>${esc(traslado)}</td><th>Bodega Origen</th><td>${esc(val('t2_bodega_origen'))}</td></tr>
      <tr><th>Destino</th><td>${esc(val('t2_destino'))}</td><th>Zona</th><td>${esc(val('t2_zona'))}</td></tr>
      <tr><th>Cantidad</th><td>${esc(val('t2_cantidad'))}</td><th>Urgente</th><td>${esc(val('t2_urgente'))}</td></tr>
      <tr><th>Conductor</th><td>${esc(val('t2_conductor'))}</td><th>Placa</th><td>${esc(val('t2_placa').toUpperCase())}</td></tr>
      <tr><th>Planilla</th><td>${esc(val('t2_planilla'))}</td><th>Fecha y hora real de salida</th><td>${salida}</td></tr>
      <tr><th>Observaciones</th><td colspan="3">${esc(val('t2_observaciones'))}</td></tr>
    </table>
    <p class="mt-4">Firma quien entrega: ______________________ &nbsp;&nbsp; Firma quien recibe: ______________________</p>`;

  try {
    if (!CONFIG.modoLocal && CONFIG.apiUrl) {
      await api('marcarImpresion', { folderId: CONFIG.folders.logistica, modulo: 'logistica', traslado });
    }
    registrarLocal('logistica', {
      'Documento TRASLADO': traslado,
      'FECHA Y HORA REAL DE SALIDA': salida,
      'SEGUIMIENTO': 'EN RUTA'
    });
    toast('Salida real registrada: ' + salida, 'success');
  } catch (e) { toast('No se pudo registrar la salida en Drive: ' + e.message, 'warning'); }

  window.print();
}

/** Escapa texto para insertarlo como HTML de forma segura. */
function esc(txt) {
  return String(txt === undefined || txt === null ? '' : txt)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------------------------------------------------------------------
 * 8. TARJETA 3 | RECEPCION TECNICA (A: factura proveedor / B: traslado externo)
 * ------------------------------------------------------------------------- */
function tipoRecepcionActual() {
  return document.querySelector('input[name="tipoRecepcion"]:checked').value;
}

function alternarBloquesRecepcion() {
  const esA = tipoRecepcionActual() === 'FACTURA_PROVEEDOR';
  $('bloque_rec_a').classList.toggle('d-none', !esA);
  $('bloque_rec_b').classList.toggle('d-none', esA);
  itemsRecepcion = [];
  pintarTablaItems('t3', itemsRecepcion);
}

/** Construye el registro de recepcion segun la opcion activa. */
function t3ConstruirRegistro() {
  if (tipoRecepcionActual() === 'FACTURA_PROVEEDOR') {
    if (!validarObligatorios(['a_factura', 'a_proveedor', 'a_fecha_recepcion', 'a_codigo', 'a_descripcion',
                              'a_lote', 'a_vencimiento', 'a_cantidad', 'a_recepcionista'])) return null;
    return {
      'Marca temporal': ahora(),
      'Tipo de Recepcion': 'FACTURA PROVEEDOR',
      'Factura': val('a_factura'),
      'Proveedor': val('a_proveedor'),
      'Fecha Recepcion Tecnica': val('a_fecha_recepcion'),
      'Codigo Producto': val('a_codigo'),
      'Descripcion': val('a_descripcion'),
      'Presentacion por Caja': val('a_presentacion'),
      'Laboratorio': val('a_laboratorio'),
      'Registro INVIMA': val('a_invima'),
      'Lote': val('a_lote'),
      'Fecha Vencimiento': val('a_vencimiento'),
      'Cantidad Unidades Recibidas': val('a_cantidad'),
      'Nombre Recepcionista': val('a_recepcionista'),
      'Presenta Novedad': val('a_novedad'),
      'Observaciones': val('a_observaciones'),
      'PERFIL REGISTRO': PERFILES[PERFIL_ACTIVO].label
    };
  }
  // Opcion B: traslado externo
  if (!validarObligatorios(['b_traslado', 'b_origen', 'b_destino', 'b_fecha_recepcion',
                            'b_codigo', 'b_descripcion', 'b_lote', 'b_vencimiento',
                            'b_enviada', 'b_recibida', 'b_responsable'])) return null;
  return {
    'Marca temporal': ahora(),
    'Tipo de Recepcion': 'TRASLADO EXTERNO',
    'Documento TRASLADO': val('b_traslado'),
    'Bodega Origen Emisora': val('b_origen'),
    'Bodega Destino': val('b_destino'),
    'Fecha Recepcion Tecnica': val('b_fecha_recepcion'),
    'Codigo Producto / Molecula': val('b_codigo'),
    'Descripcion': val('b_descripcion'),
    'Laboratorio': val('b_laboratorio'),
    'Lote': val('b_lote'),
    'Fecha Vencimiento': val('b_vencimiento'),
    'Cantidad Enviada': val('b_enviada'),
    'Cantidad Recibida': val('b_recibida'),
    'Diferencia': Number(val('b_recibida') || 0) - Number(val('b_enviada') || 0),
    'Responsable de Recepcion': val('b_responsable'),
    'Estado Recepcion Tecnica': val('b_estado'),
    'Observaciones': val('b_observaciones'),
    'PERFIL REGISTRO': PERFILES[PERFIL_ACTIVO].label
  };
}

/* ---------------------------------------------------------------------------
 * 9. TARJETA 4 | CARGUE DE FACTURA (TRANSPORTE)
 * ------------------------------------------------------------------------- */
function t4Guardar() {
  if (!validarObligatorios(['f_transporte', 'f_guia', 'f_fecha', 'f_factura',
                            'f_proveedor', 'f_orden', 'f_ingreso', 'f_valor'])) return;
  const registro = {
    'Marca temporal': ahora(),
    'Transporte': val('f_transporte'),
    'Guia': val('f_guia'),
    'Fecha': val('f_fecha'),
    'Factura': val('f_factura'),
    'Proveedor': val('f_proveedor'),
    'Orden de Compra': val('f_orden'),
    'Ingreso': val('f_ingreso'),
    'Valor': val('f_valor'),
    'A Quien se Entrega': val('f_entregado_a'),
    'Fecha de Entrega': val('f_fecha_entrega'),
    'Observacion': val('f_observacion'),
    'PERFIL REGISTRO': PERFILES[PERFIL_ACTIVO].label
  };
  return persistir('facturacion', registro, 't4');
}

/* ---------------------------------------------------------------------------
 * 10. TARJETA 5 | VERIFICACION DE INVENTARIO
 * ------------------------------------------------------------------------- */
function calcularDiferenciaInventario() {
  const teorica = Number(val('i_teorica') || 0);
  const fisica = Number(val('i_fisica') || 0);
  const dif = fisica - teorica;
  setVal('i_diferencia', dif);
  setVal('i_estado', dif === 0 ? 'CONFORME' : 'NOVEDAD');
}

function t5ConstruirRegistro() {
  if (!validarObligatorios(['i_bodega', 'i_responsable', 'i_fecha', 'i_molecula',
                            'i_codigo', 'i_lote', 'i_vencimiento', 'i_teorica', 'i_fisica'])) return null;
  return {
    'Marca temporal': ahora(),
    'Bodega (CENDIS / B05)': val('i_bodega'),
    'Responsable Asignado': val('i_responsable'),
    'Fecha Verificacion': val('i_fecha'),
    'Molecula / Medicamento': val('i_molecula'),
    'Codigo Producto': val('i_codigo'),
    'Lote': val('i_lote'),
    'Fecha Vencimiento': val('i_vencimiento'),
    'Cantidad Teorica': val('i_teorica'),
    'Cantidad Fisica': val('i_fisica'),
    'Diferencia': val('i_diferencia'),
    'Estado / Novedad': val('i_estado'),
    'Observaciones': val('i_observaciones'),
    'PERFIL REGISTRO': PERFILES[PERFIL_ACTIVO].label
  };
}

/* ---------------------------------------------------------------------------
 * 11. TABLA DE ITEMS EN MEMORIA
 * ------------------------------------------------------------------------- */
function pintarTablaItems(prefijo, items) {
  const head = $(prefijo + '_tablaHead');
  const body = $(prefijo + '_tablaBody');
  head.innerHTML = ''; body.innerHTML = '';
  if (!items.length) return;
  const cols = Object.keys(items[0]);
  head.innerHTML = cols.map(c => `<th>${esc(c)}</th>`).join('') + '<th>Accion</th>';
  items.forEach((it, i) => {
    const tr = document.createElement('tr');
    cols.forEach(c => {
      const td = document.createElement('td');
      td.textContent = it[c];
      if (normalizarCabecera(c) === 'diferencia') {
        const d = Number(it[c] || 0);
        td.className = d === 0 ? 'mf-dif-cero' : (d < 0 ? 'mf-dif-negativa' : 'mf-dif-positiva');
      }
      tr.appendChild(td);
    });
    const tdA = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-outline-danger';
    btn.textContent = 'Quitar';
    btn.addEventListener('click', () => {
      items.splice(i, 1);
      pintarTablaItems(prefijo, items);
    });
    tdA.appendChild(btn);
    tr.appendChild(tdA);
    body.appendChild(tr);
  });
}

/* ---------------------------------------------------------------------------
 * 12. PERSISTENCIA (Drive + copia local para el backup)
 * ------------------------------------------------------------------------- */
function registrarLocal(modulo, registro) {
  if (!SESION[modulo]) SESION[modulo] = [];
  SESION[modulo].push(registro);
  guardarSesion();
}

/** Guarda un registro (o lista) en Drive y siempre en la sesion local.
 *  Para T1 (despachos) usa CONFIG.folders.despachos = carpeta DESTINO (escritura)
 *  Para T2 (logistica) usa CONFIG.folders.logistica
 *  etc.
 */
async function persistir(modulo, registro, prefijoLimpieza) {
  const lista = Array.isArray(registro) ? registro : [registro];
  const folderId = CONFIG.folders[modulo] || val('folder_' + modulo);

  lista.forEach(r => registrarLocal(modulo, r));

  if (!CONFIG.apiUrl) {
    toast(`⚠ Sin URL de Web App. Dato guardado localmente (${lista.length} registro/s). Configure la URL en Ajustes.`, 'warning');
    if (prefijoLimpieza) limpiarTarjeta(Number(prefijoLimpieza.replace('t', '')));
    return;
  }
  if (CONFIG.modoLocal) {
    toast(`Guardado localmente (${lista.length} registro/s). Desactive \"Modo local\" para sincronizar con Drive.`, 'secondary');
    if (prefijoLimpieza) limpiarTarjeta(Number(prefijoLimpieza.replace('t', '')));
    return;
  }
  if (!folderId) { toast('Configure el ID de carpeta de Drive de esta tarjeta.', 'danger'); return; }

  try {
    for (const r of lista) {
      await api('guardarRegistro', { folderId, modulo, registro: r });
    }
    toast(`&#10004; ${lista.length} registro/s guardado/s en Google Drive.`, 'success');
    if (prefijoLimpieza) limpiarTarjeta(Number(prefijoLimpieza.replace('t', '')));
  } catch (e) {
    toast('Error al guardar en Drive: ' + e.message + '. La informacion quedo respaldada localmente.', 'danger');
  }
}

/** Limpia los campos editables de una tarjeta. */
function limpiarTarjeta(n) {
  const pane = $('t' + n);
  if (!pane) return;
  pane.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.id.indexOf('folder_') === 0 || el.type === 'radio') return;
    el.value = '';
    el.classList.remove('is-invalid-mf');
    // Desbloquear si el perfil lo habia bloqueado
    if (PERFIL_ACTIVO !== 'recibido_logistica') {
      el.readOnly = false;
      el.disabled = false;
      el.classList.remove('campo-bloqueado');
    }
  });
  if (n === 1) {
    $('t1_badgeUrgente').innerHTML = '';
    $('t1_estadoTraslado').innerHTML = '';
    $('t1_btnGuardar').disabled = true;
    const puntoRow = $('t1_punto_row');
    if (puntoRow) puntoRow.style.display = 'none';
    $('t1_punto_info').innerHTML = '';
  }
  if (n === 2) { $('t2_estadoTraslado').innerHTML = ''; $('t2_btnGuardar').disabled = true; $('t2_btnImprimir').disabled = true; }
  if (n === 3) { itemsRecepcion = []; pintarTablaItems('t3', itemsRecepcion); }
  if (n === 5) { itemsInventario = []; pintarTablaItems('t5', itemsInventario); }
}

/* ---------------------------------------------------------------------------
 * 13. ARCHIVO DE RESPALDO DE SEGURIDAD (BACKUP)
 * ------------------------------------------------------------------------- */
async function generarBackup(formato = 'xlsx') {
  if (!PERFILES[PERFIL_ACTIVO].puedeBackup) {
    toast('Su perfil no tiene permiso para generar respaldos.', 'danger'); return;
  }
  const consolidado = {};
  MODULOS.forEach(m => { consolidado[m] = (SESION[m] || []).slice(); });

  if (!CONFIG.modoLocal && CONFIG.apiUrl) {
    toast('Descargando informacion remota de Drive para el respaldo...', 'primary');
    for (const m of MODULOS) {
      const fid = CONFIG.folders[m];
      if (!fid) continue;
      try {
        const r = await api('leerHoja', { folderId: fid, modulo: m });
        (r.rows || []).forEach(row => { delete row.__fila; consolidado[m].push(row); });
      } catch (e) { /* se conserva al menos la informacion local */ }
    }
  }

  const nombreBase = `Backup_Cargue_Logistico_${stamp()}`;

  if (formato === 'json') {
    const blob = new Blob([JSON.stringify({
      empresa: 'MEDISFARMA', generado: ahora(), carpetas: CONFIG.folders, perfil: PERFILES[PERFIL_ACTIVO].label, datos: consolidado
    }, null, 2)], { type: 'application/json' });
    descargarBlob(blob, nombreBase + '.json');
    toast('Respaldo JSON generado.', 'success');
    return;
  }

  const wb = XLSX.utils.book_new();
  const HOJAS = {
    despachos: 'PLANILLA DESPACHOS', logistica: 'LOGISTICA', recepcion: 'RECEPCION TECNICA',
    facturacion: 'FACTURA TRANSPORTE', inventario: 'INVENTARIO'
  };
  let totalFilas = 0;
  MODULOS.forEach(m => {
    const filas = consolidado[m];
    const cabeceras = [];
    filas.forEach(f => Object.keys(f).forEach(k => { if (!cabeceras.includes(k)) cabeceras.push(k); }));
    const matriz = [cabeceras.length ? cabeceras : ['Sin registros']];
    filas.forEach(f => matriz.push(cabeceras.map(c => (f[c] !== undefined ? f[c] : ''))));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matriz), HOJAS[m]);
    totalFilas += filas.length;
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['MEDISFARMA - Respaldo de seguridad del modulo de Cargue'],
    ['Generado', ahora()], ['Total registros', totalFilas],
    [], ['Modulo', 'ID Carpeta Drive'],
    ...MODULOS.map(m => [m, CONFIG.folders[m] || '(sin configurar)'])
  ]), 'RESUMEN');

  XLSX.writeFile(wb, nombreBase + '.xlsx');
  toast(`&#10004; Respaldo generado: ${nombreBase}.xlsx (${totalFilas} registros).`, 'success');

  if (!CONFIG.modoLocal && CONFIG.apiUrl && CONFIG.folders.backup) {
    try {
      const r = await api('backupRemoto', { folderIds: CONFIG.folders, carpetaBackupId: CONFIG.folders.backup });
      toast('Copia remota creada en Drive: ' + r.archivo, 'success');
    } catch (e) { toast('No se pudo crear la copia remota: ' + e.message, 'warning'); }
  }
}

function descargarBlob(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------------------------------------------------------------------
 * 14. INICIALIZACION Y EVENTOS
 * ------------------------------------------------------------------------- */
function pintarConfig() {
  MODULOS.forEach(m => {
    setVal('folder_' + m, CONFIG.folders[m] || '');
    if (m === 'despachos') {
      const t2input = $('folder_despachos_t2');
      if (t2input) t2input.value = CONFIG.folders[m] || '';
    }
  });
  // Mostrar carpeta de consulta (origen) fija en la UI
  const consultaEl = $('folder_traslados_consulta');
  if (consultaEl) consultaEl.value = CONFIG.folders.trasladosConsulta || '';
  const consultaEst = $('estado_folder_traslados_consulta');
  if (consultaEst) consultaEst.innerHTML = '<span class="text-info">&#128218; Carpeta Traslados (lectura fija)</span>';

  setVal('cfg_api_url', CONFIG.apiUrl);
  setVal('cfg_folder_backup', CONFIG.folders.backup || '');
  setVal('cfg_conductores', (CONFIG.conductores || []).join('\n'));
  $('cfg_modo_local').checked = !!CONFIG.modoLocal;

  const sel = $('t2_conductor');
  sel.innerHTML = '<option value="">Seleccione...</option>' +
    (CONFIG.conductores || []).map(c => `<option>${esc(c)}</option>`).join('');

  $('estadoApi').className = 'badge ' + (CONFIG.modoLocal ? 'bg-secondary' : 'bg-light text-dark');
  $('estadoApi').textContent = CONFIG.modoLocal ? 'Modo local' : (CONFIG.apiUrl ? 'API configurada' : 'API sin configurar');

  pintarPerfiles();
  pintarIdsCarpetas();
}

/** Muestra los perfiles de archivos configurados para cada tarjeta. */
function pintarPerfiles() {
  const perfiles = CONFIG.perfiles || {};
  const MODULOS_LABEL = {
    despachos: 'Tarjeta 1 — Planilla Entrega Despachos',
    logistica: 'Tarjeta 2 — Logistica y Despachos',
    recepcion: 'Tarjeta 3 — Recepcion Tecnica',
    facturacion: 'Tarjeta 4 — Factura Transporte',
    inventario: 'Tarjeta 5 — Verificacion de Inventario'
  };
  const cont = $('perfilesInfo');
  if (!cont) return;
  cont.innerHTML = MODULOS.map(m => {
    const p = perfiles[m] || {};
    return '<div class="row g-1 mb-1">' +
      '<div class="col-md-4"><strong>' + esc(MODULOS_LABEL[m]) + '</strong></div>' +
      '<div class="col-md-4"><span class="text-muted">Archivo:</span> ' + esc(p.file || '(sin asignar)') + '</div>' +
      '<div class="col-md-4"><span class="text-muted">Hoja:</span> ' + esc(p.sheet || '(sin asignar)') + '</div>' +
      '</div>';
  }).join('');
}

/** Muestra un resumen visual de los IDs de carpeta ya configurados. */
function pintarIdsCarpetas() {
  const cont = $('idsCarpetasInfo');
  if (!cont) return;
  const MODULOS_LABEL = {
    trasladosConsulta: 'T1 — Traslados (lectura)',
    despachos:         'T1 — Destino (escritura)',
    logistica:         'Tarjeta 2',
    recepcion:         'Tarjeta 3',
    facturacion:       'Tarjeta 4',
    inventario:        'Tarjeta 5',
    backup:            'Respaldos'
  };
  cont.innerHTML = Object.keys(CONFIG.folders).map(k => {
    const id = CONFIG.folders[k] || '';
    const ok = id ? 'text-success' : 'text-danger';
    const icon = id ? '&#10004;' : '&#10006;';
    const extra = k === 'trasladosConsulta' ? ' <span class="text-info">&#128218; fija</span>' :
    return '<div class="row g-1 mb-1">' +
      '<div class="col-md-3"><strong>' + esc(MODULOS_LABEL[k] || k) + '</strong></div>' +
      '<div class="col-md-9"><span class="' + ok + '">' + icon + ' ' + esc(id || '(sin configurar)') + '</span>' + extra + '</div>' +
      '</div>';
  }).join('');
}

/** Pinta la seccion de perfiles de usuario en el modal. */
function pintarPerfilesUsuario() {
  const cont = $('perfilesUsuarioInfo');
  if (!cont) return;
  cont.innerHTML = Object.keys(PERFILES).map(k => {
    const pf = PERFILES[k];
    const activo = k === PERFIL_ACTIVO;
    const borde = activo ? 'border-primary' : 'border-light';
    const check = activo ? '&#10004; ACTIVO' : '';
    return '<div class="row g-1 mb-1 border ' + borde + ' rounded p-1">' +
      '<div class="col-md-2"><span class="badge ' + pf.color + '">' + pf.icon + ' ' + esc(pf.label) + '</span></div>' +
      '<div class="col-md-7"><small>' + esc(pf.descripcion) + '</small></div>' +
      '<div class="col-md-2"><small>Tarjetas: ' + pf.tarjetas.map(t => t.replace('t','')).join(',') + '</small></div>' +
      '<div class="col-md-1">' + (activo ? '<span class="text-primary fw-bold">' + check + '</span>' : '') + '</div>' +
      '</div>';
  }).join('');
}

async function verificarApi() {
  if (!CONFIG.apiUrl) {
    $('estadoApi').className = 'badge bg-warning text-dark';
    $('estadoApi').textContent = 'Sin URL configurada';
    return;
  }
  if (CONFIG.modoLocal) return;
  try {
    await api('ping');
    $('estadoApi').className = 'badge bg-success';
    $('estadoApi').textContent = 'Conectado a Drive';
  } catch (e) {
    $('estadoApi').className = 'badge bg-danger';
    $('estadoApi').textContent = 'Sin conexion';
    console.error('Error verificacion API:', e.message);
    toast('Error de conexion: ' + e.message, 'danger');
  }
}

async function probarConexion() {
  const btn = $('btnProbarApi');
  const badge = $('estadoApi');
  if (btn) { btn.disabled = true; btn.innerHTML = '&\#8987; Probando...'; }
  badge.className = 'badge bg-warning text-dark';
  badge.textContent = 'Probando conexion...';
  try {
    await api('ping');
    badge.className = 'badge bg-success';
    badge.textContent = 'Conectado a Drive';
    toast('Conexion exitosa con Google Drive', 'success');
  } catch (e) {
    badge.className = 'badge bg-danger';
    badge.textContent = 'Sin conexion';
    let msg = e.message || 'Error desconocido';
    if (msg.includes('Failed to fetch') || msg.includes('No se pudo conectar')) {
      msg = 'La Web App requiere acceso publico. Vaya a Apps Script > Implementar > Nueva implementacion > Quien tiene acceso: Cualquier usuario.';
    }
    toast('Error: ' + msg, 'danger');
    console.error('Prueba de conexion fallida:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '&\#127760; Probar Conexion'; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // ----- SISTEMA DE LOGIN -----
  // Si ya inicio sesion, ocultar el overlay; si no, mostrarlo y bloquear scroll
  const loginPrevio = localStorage.getItem(LS_LOGIN);
  if (loginPrevio) {
    const perfilPrevio = PERFILES[loginPrevio] ? loginPrevio : obtenerPerfilDeUsuario(loginPrevio);
    PERFIL_ACTIVO = perfilPrevio;
    localStorage.setItem(LS_PERFIL, perfilPrevio);
    $('pantallaLogin').style.display = 'none';
    document.body.classList.remove('mf-login-activo');
  } else {
    $('pantallaLogin').style.display = 'flex';
    document.body.classList.add('mf-login-activo');
  }

  // Eventos del login
  $('btnLogin').addEventListener('click', verificarLogin);
  $('loginContrasena').addEventListener('keydown', e => { if (e.key === 'Enter') verificarLogin(); });
  $('btnCerrarSesion').addEventListener('click', cerrarSesion);
  if ($('btnProbarApi')) $('btnProbarApi').addEventListener('click', probarConexion);

  pintarConfig();
  verificarApi();

  // Alerta si no hay URL de Web App configurada
  if (!CONFIG.apiUrl) {
    const alerta = document.createElement('div');
    alerta.id = 'alertaNoApi';
    alerta.className = 'alert alert-warning alert-dismissible fade show position-fixed';
    alerta.style.cssText = 'top:10px;left:50%;transform:translateX(-50%);z-index:99999;max-width:90vw;font-size:14px;';
    alerta.innerHTML = '⚠ <strong>Sin conexion a Drive</strong> — Configure la URL de la Web App en <em>Ajustes</em> para guardar datos en Google Drive. <a href="#" onclick="document.getElementById(\'t6\').click();this.closest(\'.alert\').remove();return false;">Ir a Ajustes</a> <button type="button" class="btn-close" data-bs-dismiss="alert"></button>';
    document.body.appendChild(alerta);
    setTimeout(() => { if (alerta.parentNode) alerta.remove(); }, 15000);
  }

  // Aplicar perfil activo al cargar
  aplicarPerfil();

  // Selector de perfil en la barra
  $('selPerfil').addEventListener('change', () => {
    seleccionarPerfil($('selPerfil').value);
  });

  // Configuracion general
  $('cfg_guardar').addEventListener('click', () => {
    CONFIG.apiUrl = val('cfg_api_url');
    CONFIG.folders.backup = val('cfg_folder_backup');
    CONFIG.modoLocal = $('cfg_modo_local').checked;
    CONFIG.conductores = val('cfg_conductores').split('\n').map(s => s.trim()).filter(Boolean);
    guardarConfig();
    pintarConfig();
    verificarApi();
    aplicarPerfil();
    toast('Configuracion guardada.', 'success');
  });

  // Persistencia inmediata del Folder ID al escribirlo
  MODULOS.forEach(m => {
    const el = $('folder_' + m);
    if (el) el.addEventListener('change', () => {
      CONFIG.folders[m] = el.value.trim();
      guardarConfig();
      // Sincronizar folder_despachos_t2
      if (m === 'despachos') {
        const t2inp = $('folder_despachos_t2');
        if (t2inp) t2inp.value = el.value.trim();
      }
    });
  });
  // Sincronizar folder_despachos_t2 -> despachos cuando se edita desde T2
  const t2f = $('folder_despachos_t2');
  if (t2f) {
    t2f.addEventListener('change', () => {
      CONFIG.folders.despachos = t2f.value.trim();
      const t1inp = $('folder_despachos');
      if (t1inp) t1inp.value = t2f.value.trim();
      guardarConfig();
    });
  }

  // Tarjeta 1
  $('t1_btnValidar').addEventListener('click', t1ValidarTraslado);
  $('t1_traslado').addEventListener('keydown', e => { if (e.key === 'Enter') t1ValidarTraslado(); });
  $('t1_btnGuardar').addEventListener('click', t1Guardar);

  // Tarjeta 2
  $('t2_btnBuscar').addEventListener('click', t2Buscar);
  $('t2_traslado').addEventListener('keydown', e => { if (e.key === 'Enter') t2Buscar(); });
  $('t2_btnGuardar').addEventListener('click', t2Guardar);
  $('t2_btnImprimir').addEventListener('click', t2Imprimir);

  // Tarjeta 3
  document.querySelectorAll('input[name="tipoRecepcion"]').forEach(r =>
    r.addEventListener('change', alternarBloquesRecepcion));
  ['b_enviada', 'b_recibida'].forEach(id => $(id).addEventListener('input', () => {
    setVal('b_diferencia', Number(val('b_recibida') || 0) - Number(val('b_enviada') || 0));
  }));
  $('t3_btnAgregar').addEventListener('click', () => {
    const r = t3ConstruirRegistro();
    if (!r) return;
    itemsRecepcion.push(r);
    pintarTablaItems('t3', itemsRecepcion);
    toast('Item agregado a la lista de recepcion.', 'primary');
  });
  $('t3_btnGuardar').addEventListener('click', async () => {
    if (PERFIL_ACTIVO === 'auxiliar') { toast('Su perfil solo permite visualizar, no guardar.', 'warning'); return; }
    let lista = itemsRecepcion.slice();
    if (!lista.length) {
      const r = t3ConstruirRegistro();
      if (!r) return;
      lista = [r];
    }
    await persistir('recepcion', lista, 't3');
  });

  // Tarjeta 4
  $('t4_btnGuardar').addEventListener('click', t4Guardar);

  // Tarjeta 5
  ['i_teorica', 'i_fisica'].forEach(id => $(id).addEventListener('input', calcularDiferenciaInventario));
  $('t5_btnAgregar').addEventListener('click', () => {
    const r = t5ConstruirRegistro();
    if (!r) return;
    itemsInventario.push(r);
    pintarTablaItems('t5', itemsInventario);
    toast('Item agregado al conteo de inventario.', 'primary');
  });
  $('t5_btnGuardar').addEventListener('click', async () => {
    let lista = itemsInventario.slice();
    if (!lista.length) {
      const r = t5ConstruirRegistro();
      if (!r) return;
      lista = [r];
    }
    await persistir('inventario', lista, 't5');
  });

  // Respaldo de seguridad
  const backup = () => generarBackup('xlsx');
  $('btnBackupTop').addEventListener('click', backup);
  $('btnBackupFloat').addEventListener('click', backup);
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'j') { e.preventDefault(); generarBackup('json'); }
  });
});
