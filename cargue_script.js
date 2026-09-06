/* =================================================================================
 * MEDISFARMA | cargue_script.js
 * Modulo CARGUE: configuracion de Folder ID por tarjeta, lectura dinamica por
 * nombre de cabecera, autocompletado, validaciones, guardado en Drive y
 * generacion del archivo de respaldo de seguridad (XLSX / JSON).
 * ================================================================================= */
'use strict';

/* ---------------------------------------------------------------------------
 * 1. CONFIGURACION PERSISTENTE (localStorage)
 * ------------------------------------------------------------------------- */
const LS_KEY = 'MF_CONFIG_CARGUE';
const LS_DATA = 'MF_DATOS_SESION';

const CONFIG_DEFAULT = {
  apiUrl: '',
  modoLocal: true,
  folders: { despachos: '', logistica: '', recepcion: '', facturacion: '', inventario: '', backup: '' },
  conductores: ['CONDUCTOR 1 - CAMION', 'CONDUCTOR 2 - FURGON', 'MENSAJERO 1 - MOTO', 'MENSAJERO 2 - MOTO']
};

let CONFIG = cargarConfig();

/** Datos registrados en la sesion; alimentan el backup de seguridad. */
let SESION = cargarSesion();

/** Items en memoria antes de guardar (tarjetas 3 y 5). */
let itemsRecepcion = [];
let itemsInventario = [];

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
    est.innerHTML = '<span class="text-secondary">Guardado (modo local, sin verificar en Drive).</span>';
    return;
  }
  est.innerHTML = 'Verificando...';
  try {
    const r = await api('validarCarpeta', { folderId: id });
    est.innerHTML = `<span class="text-success">&#10004; ${r.nombre}</span>`;
  } catch (e) {
    est.innerHTML = `<span class="text-danger">&#10006; ${e.message}</span>`;
  }
}

/* ---------------------------------------------------------------------------
 * 6. TARJETA 1 | PLANILLA ENTREGA DESPACHOS (validacion estricta)
 * ------------------------------------------------------------------------- */
const CAMPOS_OBLIGATORIOS_DRIVE = ['bodegaOrigen', 'destino', 'cantidad', 'tipo', 'zona'];

/** Busca el traslado en Drive (o en la sesion local) y valida su integridad. */
async function t1ValidarTraslado() {
  const traslado = val('t1_traslado');
  const est = $('t1_estadoTraslado');
  $('t1_btnGuardar').disabled = true;
  if (!traslado) { est.innerHTML = '<span class="text-danger">Indique el número de traslado.</span>'; return; }

  est.innerHTML = 'Consultando Google Drive...';
  let registro = null;
  try {
    if (CONFIG.modoLocal || !CONFIG.apiUrl) {
      registro = buscarTrasladoLocal('despachos', traslado) || buscarTrasladoLocal('logistica', traslado);
    } else {
      const r = await api('buscarTraslado', {
        folderId: CONFIG.folders.despachos || val('folder_despachos'),
        modulo: 'despachos', traslado
      });
      registro = r.encontrado ? r.registro : null;
    }
  } catch (e) {
    est.innerHTML = `<span class="text-danger">Error de consulta: ${e.message}</span>`;
    return;
  }

  if (!registro) {
    est.innerHTML = '<span class="text-danger">&#10006; El traslado NO existe en la base de Drive. No es posible continuar.</span>';
    limpiarAutocompletadosT1();
    return;
  }

  // Autocompletado por NOMBRE de cabecera (no por posicion).
  const datos = {
    bodegaOrigen: obtenerValorPorNombreColumna(registro, ALIAS.bodegaOrigen),
    destino:      obtenerValorPorNombreColumna(registro, ALIAS.destino),
    cantidad:     obtenerValorPorNombreColumna(registro, ALIAS.cantidad),
    tipo:         obtenerValorPorNombreColumna(registro, ALIAS.tipo),
    urgente:      obtenerValorPorNombreColumna(registro, ALIAS.urgente) || 'NO',
    zona:         obtenerValorPorNombreColumna(registro, ALIAS.zona)
  };
  setVal('t1_bodega_origen', datos.bodegaOrigen);
  setVal('t1_destino', datos.destino);
  setVal('t1_cantidad', datos.cantidad);
  setVal('t1_tipo', datos.tipo);
  setVal('t1_urgente', datos.urgente);
  setVal('t1_zona', datos.zona);

  // Validacion estricta: si falta informacion requerida, NO permite avanzar.
  const faltantes = CAMPOS_OBLIGATORIOS_DRIVE.filter(k => !String(datos[k]).trim());
  if (faltantes.length) {
    est.innerHTML = `<span class="text-danger">&#10006; Información incompleta en Drive (${faltantes.join(', ')}). No es posible continuar.</span>`;
    $('t1_btnGuardar').disabled = true;
    return;
  }

  $('t1_badgeUrgente').innerHTML =
    normalizarCabecera(datos.urgente) === 'si' ? '<span class="mf-badge-urgente">TRASLADO URGENTE</span>' : '';
  est.innerHTML = '<span class="text-success">&#10004; Traslado válido y completo. Puede continuar.</span>';
  $('t1_btnGuardar').disabled = false;
}

function limpiarAutocompletadosT1() {
  ['t1_bodega_origen', 't1_destino', 't1_cantidad', 't1_tipo', 't1_urgente', 't1_zona'].forEach(id => setVal(id, ''));
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
  if (!validarObligatorios(['t1_traslado', 't1_responsable_entrega', 't1_quien_alista', 't1_recomendado'])) return;
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
    'SEGUIMIENTO': 'ALISTADO EN CENDIS'
  };
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

  est.innerHTML = 'Consultando información de la Tarjeta 1...';
  let registro = null;
  try {
    if (CONFIG.modoLocal || !CONFIG.apiUrl) {
      registro = buscarTrasladoLocal('despachos', traslado);
    } else {
      const r = await api('buscarTraslado', {
        folderId: CONFIG.folders.despachos || val('folder_despachos'),
        modulo: 'despachos', traslado
      });
      registro = r.encontrado ? r.registro : null;
    }
  } catch (e) { est.innerHTML = `<span class="text-danger">${e.message}</span>`; return; }

  if (!registro) {
    est.innerHTML = '<span class="text-danger">&#10006; El traslado no tiene planilla de entrega registrada.</span>';
    return;
  }
  setVal('t2_bodega_origen', obtenerValorPorNombreColumna(registro, ALIAS.bodegaOrigen));
  setVal('t2_destino', obtenerValorPorNombreColumna(registro, ALIAS.destino));
  setVal('t2_zona', obtenerValorPorNombreColumna(registro, ALIAS.zona));
  setVal('t2_cantidad', obtenerValorPorNombreColumna(registro, ALIAS.cantidad));
  setVal('t2_urgente', obtenerValorPorNombreColumna(registro, ALIAS.urgente));
  setVal('t2_responsable_entrega', obtenerValorPorNombreColumna(registro, ALIAS.respEntrega));
  setVal('t2_quien_alista', obtenerValorPorNombreColumna(registro, ALIAS.quienAlista));
  setVal('t2_marca_temporal', obtenerValorPorNombreColumna(registro, ALIAS.marcaTemporal));
  est.innerHTML = '<span class="text-success">&#10004; Información cargada.</span>';
  $('t2_btnGuardar').disabled = false;
  $('t2_btnImprimir').disabled = false;
}

/** Guardar de logistica: sella automaticamente FECHA ENTREGA LOGISTICA. */
async function t2Guardar() {
  if (!validarObligatorios(['t2_traslado', 't2_fecha_envio', 't2_conductor', 't2_placa', 't2_planilla'])) return;
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
    'FECHA ENTREGA LOGISTICA': ahora(),
    'QUIEN RECIBE LOGISTICA': val('t2_quien_recibe'),
    'FECHA PLANILLA ENVIO LOGISTICA': val('t2_fecha_envio').replace('T', ' '),
    'CONDUCTOR': val('t2_conductor'),
    'PLACA': val('t2_placa').toUpperCase(),
    'PLANILLA': val('t2_planilla'),
    'Observaciones': val('t2_observaciones'),
    'SEGUIMIENTO': 'DESPACHADO A LOGISTICA',
    'mes': new Date().toLocaleDateString('es-CO', { month: 'long' }).toUpperCase()
  };
  await persistir('logistica', registro, 't2');
}

/** Imprime la planilla y registra la fecha y hora REAL de salida a ruta. */
async function t2Imprimir() {
  const traslado = val('t2_traslado');
  if (!traslado) { toast('Indique el traslado antes de imprimir.', 'danger'); return; }
  const salida = ahora();

  $('t2_areaImpresion').innerHTML = `
    <div class="text-center mb-3">
      <img src="assets/logo.jpeg" style="height:60px" alt="Medisfarma"><h4>PLANILLA DE ENVÍO DE TRASLADO</h4>
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
      'Tipo de Recepcion': 'FACTURA PROVEEDOR / MEDICAMENTOS',
      'Factura': val('a_factura'),
      'Proveedor': val('a_proveedor'),
      'Fecha Recepcion Tecnica': val('a_fecha_recepcion'),
      'Codigo Producto / Molecula': val('a_codigo'),
      'Descripcion': val('a_descripcion'),
      'Presentacion por Caja': val('a_presentacion'),
      'Laboratorio': val('a_laboratorio'),
      'Registro INVIMA': val('a_invima'),
      'Lote': val('a_lote'),
      'Fecha Vencimiento': val('a_vencimiento'),
      'Cantidad Recibida': val('a_cantidad'),
      'Responsable de Recepcion': val('a_recepcionista'),
      'Presenta Novedad': val('a_novedad'),
      'Estado Recepcion Tecnica': val('a_novedad') === 'SI' ? 'NOVEDAD' : 'CONFORME',
      'Observaciones': val('a_observaciones')
    };
  }
  if (!validarObligatorios(['b_traslado', 'b_origen', 'b_destino', 'b_fecha_recepcion', 'b_codigo',
                            'b_descripcion', 'b_lote', 'b_vencimiento', 'b_enviada', 'b_recibida', 'b_responsable'])) return null;
  const dif = Number(val('b_recibida') || 0) - Number(val
