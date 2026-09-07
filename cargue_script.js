/************************************************************************************
 * MEDISFARMA - Modulo CARGUE
 * cargue_script.js  — Frontend JavaScript completo
 *
 * ORDEN TARJETAS (v3):
 *   T1 = Seguridad (Guia, Factura, Proveedor, Unidades, Quien Recibe)
 *   T2 = Recepcion Tecnica
 *   T3 = Planilla Entrega Despachos (enriquecida con rotacion + nuevos campos)
 *   T4 = Logistica y Despachos
 *   T5 = Cargue de Factura (Transporte)
 *   T6 = Verificacion de Inventario
 *
 * MODULOS: ['seguridad','recepcion','despachos','logistica','facturacion','inventario']
 ************************************************************************************/

/* ═════════════════════════════════════════════════════════════════════════════════
   0. UTILIDADES GLOBALES
   ═════════════════════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

function showToast(msg, type) {
  var tw = $('toastWrap');
  if (!tw) { tw = document.createElement('div'); tw.id = 'toastWrap'; tw.className = 'mf-toast-wrap'; document.body.appendChild(tw); }
  var d = document.createElement('div');
  var bg = type === 'success' ? 'alert-success' : type === 'danger' ? 'alert-danger' : 'alert-info';
  d.className = 'alert ' + bg + ' shadow-sm py-2 px-3 small';
  d.innerHTML = msg;
  tw.appendChild(d);
  setTimeout(function () { if (d.parentNode) d.remove(); }, 6000);
}

function limpiarCampos(prefijo) {
  document.querySelectorAll('[id^="' + prefijo + '"]').forEach(function (el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
    else if (el.tagName === 'SELECT') el.selectedIndex = 0;
  });
}

function limpiarTarjeta(num) {
  var prefijos = { 1: 's_', 2: 'b_', 3: 't3_', 4: 't4_', 5: 'f_', 6: 'i_' };
  limpiarCampos(prefijos[num] || '');
  showToast('Tarjeta ' + num + ' limpiada.', 'info');
}

function hoy() {
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function ahora() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
    ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
}

function fechaLocal() {
  return new Date().toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/* ═════════════════════════════════════════════════════════════════════════════════
   1. CONFIGURACION POR DEFECTO
   ═════════════════════════════════════════════════════════════════════════════════ */
var CONFIG_DEFAULT = {
  api_url: 'https://script.google.com/macros/s/AKfycbxyQBBPPZVYpuwCtKX1MTPVp4Pkaa6uJQc1xcbh3Tk68mrDFGRc5MQQ034CyOR2okYr/exec',
  folders: {
    trasladosConsulta: '1u30YFhTsocLuUoFrVUnb6Fk9zwVsT_E_',
    seguridad:        '1I8XfW5vjt5qFkhnd5m6anaUA9ETVHf_N',
    despachos:         '1tUXm2FVVFWBnyeBrzTIRpobYTKxk7OH8',
    logistica:         '1_e8ycbznm0jA4kOBwkJuXM4EVdcwXzYe',
    recepcion:         '1u5aQURkwKw4CqxejzOSxYgeF6dvcj-T0',
    facturacion:       '1hpRjykdlFyU_nsdXb0ttqOJdHNoXcTG-',
    inventario:        '11Iml2ggmvAK8aHeUbDGeWbyhLxCtrPoY',
    rotacion:          '1I8XfW5vjt5qFkhnd5m6anaUA9ETVHf_N',
    backup:            '1HVTZyLasrbZArTN34kmc0lCKaQa2qQ_5'
  },
  perfiles: {
    seguridad:   { file: 'BD_SEGURIDAD_DESPACHOS',         sheet: 'DATOS' },
    despachos:   { file: 'BD_PLANILLA_ENTREGA_DESPACHOS',  sheet: 'DATOS' },
    logistica:   { file: 'BD_LOGISTICA_DESPACHOS',        sheet: 'DATOS' },
    recepcion:   { file: 'BD_RECEPCION_TECNICA',          sheet: 'DATOS' },
    facturacion: { file: 'BD_CARGUE_FACTURA_TRANSPORTE',  sheet: 'DATOS' },
    inventario:  { file: 'BD_VERIFICACION_INVENTARIO',    sheet: 'DATOS' },
    novedades:   { file: 'BD_NOVEDADES_MODIFICACIONES',   sheet: 'DATOS' },
    rotacion:    { file: 'BD_ROTACION_DIARIA',            sheet: 'DATOS' }
  },
  conductores: ['DIEGO CASTELLANOS', 'WILFER PEREZ', 'JEFFERSON DAZA', 'CARLOS RINCON', 'JORGE CACERES', 'JHONATAN BUSTOS']
};

/* ═════════════════════════════════════════════════════════════════════════════════
   2. CREDENCIALES Y PERFILES DE ACCESO
   ═════════════════════════════════════════════════════════════════════════════════ */
var CREDENCIALES = {
  administrador: 'Medis2024Admin',
  lider: 'Medis2024Lider',
  auxiliar_entrega: 'Medis2024Aux',
  recibido_logistica: 'Medis2024Recib',
  planillar_logistica: 'Medis2024Plan'
};

/* Nombres de los 32 auxiliares individuales */
var AUXILIARES_INDIVIDUALES = [
  'yuri','julio','hernan','diego','brian','karina','jhony','natalia',
  'manuel','claudia','daniela','juan','luzl','liz','ana','leidy',
  'bivian','vaneza','brayan','nicoll','luis','estefania','angela','camila',
  'angie','mayra','derly','luisa','luzn','andrea','andres','diegoe'
];

var LABELS_PERFIL = {
  administrador: '&#128081; ADMINISTRADOR',
  lider: '&#128104;&#8205;&#128188; LIDER',
  auxiliar_entrega: '&#128230; AUXILIAR ENTREGA',
  recibido_logistica: '&#9989; RECIBIDO LOGISTICA',
  planillar_logistica: '&#128203; PLANILLAR LOGISTICA',
  auxiliar: '&#128119; AUXILIAR'
};

/* Perfiles y sus tarjetas visibles (reordenadas) */
var PERFILES = {
  administrador:           { label: 'Administrador',   tarjetas: ['t1','t2','t3','t4','t5','t6'] },
  lider:                  { label: 'Lider',           tarjetas: ['t1','t3'] },
  auxiliar_entrega:       { label: 'Auxiliar Entrega', tarjetas: ['t3'] },
  recibido_logistica:     { label: 'Recibido Log',     tarjetas: ['t4'] },
  planillar_logistica:    { label: 'Planillar Log',    tarjetas: ['t3','t4'] },
  auxiliar:               { label: 'Auxiliar',         tarjetas: ['t1','t2','t3'] }
};

/* Modulos (orden de carpetas/backend) */
var MODULOS = ['seguridad','recepcion','despachos','logistica','facturacion','inventario'];

/* ═════════════════════════════════════════════════════════════════════════════════
   3. CONFIGURACION EN MEMORIA + GUARDADO EN LOCALSTORAGE
   ═════════════════════════════════════════════════════════════════════════════════ */
var CONFIG = {};
function cargarConfig() {
  var saved = localStorage.getItem('MF_CARGUE_CONFIG');
  CONFIG = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(CONFIG_DEFAULT));
  if (!CONFIG.folders.seguridad) CONFIG.folders.seguridad = CONFIG_DEFAULT.folders.seguridad;
  if (!CONFIG.folders.rotacion)  CONFIG.folders.rotacion  = CONFIG_DEFAULT.folders.rotacion;
  if (!CONFIG.conductores || !CONFIG.conductores.length) CONFIG.conductores = CONFIG_DEFAULT.conductores.slice();
  var el = $('cfg_api_url'); if (el) el.value = CONFIG.api_url;
  var fb = $('cfg_folder_backup'); if (fb) fb.value = CONFIG.folders.backup || '';
  var cc = $('cfg_conductores'); if (cc) cc.value = (CONFIG.conductores || []).join('\n');
}
function guardarConfig() {
  var el = $('cfg_api_url'); if (el) CONFIG.api_url = el.value.trim();
  var fb = $('cfg_folder_backup'); if (fb) CONFIG.folders.backup = fb.value.trim();
  var cc = $('cfg_conductores'); if (cc) CONFIG.conductores = cc.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  localStorage.setItem('MF_CARGUE_CONFIG', JSON.stringify(CONFIG));
  showToast('Configuracion guardada en el navegador.', 'success');
}

/* ═════════════════════════════════════════════════════════════════════════════════
   4. SESION Y PERFILES
   ═════════════════════════════════════════════════════════════════════════════════ */
function perfilActivo() {
  return localStorage.getItem('MF_PERFIL_ACTIVO') || 'administrador';
}

function esAdministrador() {
  var p = perfilActivo();
  return p === 'administrador';
}

function nombreUsuario() {
  var p = perfilActivo();
  if (AUXILIARES_INDIVIDUALES.indexOf(p) >= 0) {
    return p.charAt(0).toUpperCase() + p.slice(1);
  }
  return LABELS_PERFIL[p] || p;
}

function aplicarPerfil() {
  var perfil = perfilActivo();
  if (AUXILIARES_INDIVIDUALES.indexOf(perfil) >= 0) perfil = 'auxiliar';
  var def = PERFILES[perfil] || PERFILES.administrador;
  var visibles = def.tarjetas;
  var todas = ['t1','t2','t3','t4','t5','t6'];
  todas.forEach(function (tid) {
    var pane = $(tid);
    var tab = document.querySelector('[data-bs-target="#' + tid + '"]');
    if (visibles.indexOf(tid) >= 0) {
      if (pane) pane.classList.remove('d-none');
      if (tab) { tab.classList.remove('d-none'); tab.style.display = ''; }
    } else {
      if (pane) pane.classList.add('d-none');
      if (tab) { tab.classList.add('d-none'); tab.style.display = 'none'; }
    }
  });
  var badge = $('perfilBadge');
  if (badge) badge.innerHTML = LABELS_PERFIL[perfil] || perfil;
  var sel = $('selPerfil'); if (sel) sel.value = perfilActivo();
  if (esAdministrador()) {
    todas.forEach(function (tid) {
      var pane = $(tid); var tab = document.querySelector('[data-bs-target="#' + tid + '"]');
      if (pane) pane.classList.remove('d-none');
      if (tab) { tab.classList.remove('d-none'); tab.style.display = ''; }
    });
  }
  pintarPerfiles();
}

function seleccionarPerfil(perfil) {
  localStorage.setItem('MF_LOGIN_OK', perfil);
  localStorage.setItem('MF_PERFIL_ACTIVO', perfil);
  aplicarPerfil();
  showToast('Perfil cambiado a <strong>' + (LABELS_PERFIL[perfil] || perfil) + '</strong>', 'success');
}

function pintarPerfiles() {
  var info = $('perfilesUsuarioInfo');
  if (info) {
    var perfil = perfilActivo();
    var real = AUXILIARES_INDIVIDUALES.indexOf(perfil) >= 0 ? 'auxiliar' : perfil;
    var def = PERFILES[real] || PERFILES.administrador;
    var h = '<strong>Perfil activo:</strong> ' + (LABELS_PERFIL[real] || perfil) + '<br>';
    h += '<strong>Tarjetas visibles:</strong> ' + def.tarjetas.join(', ') + '<br>';
    var nombres = { t1:'Seguridad', t2:'Recepcion Tecnica', t3:'Planilla Entrega', t4:'Logistica y Despachos', t5:'Factura Transporte', t6:'Verificacion Inventario' };
    h += '<strong>Detalle:</strong><ul>';
    def.tarjetas.forEach(function (t) { h += '<li>' + t.toUpperCase() + ' = ' + nombres[t] + '</li>'; });
    h += '</ul>';
    info.innerHTML = h;
  }
  var pf = $('perfilesInfo');
  if (pf) {
    var h2 = '<table class="table table-sm mb-0"><thead><tr><th>Modulo</th><th>Archivo</th><th>Hoja</th></tr></thead><tbody>';
    Object.keys(CONFIG.perfiles || CONFIG_DEFAULT.perfiles).forEach(function (m) {
      var c = (CONFIG.perfiles || CONFIG_DEFAULT.perfiles)[m];
      h2 += '<tr><td>' + m + '</td><td>' + c.file + '</td><td>' + c.sheet + '</td></tr>';
    });
    h2 += '</tbody></table>';
    pf.innerHTML = h2;
  }
  var ids = $('idsCarpetasInfo');
  if (ids) {
    var h3 = '<table class="table table-sm mb-0"><thead><tr><th>Carpeta</th><th>ID</th></tr></thead><tbody>';
    Object.keys(CONFIG.folders).forEach(function (k) {
      h3 += '<tr><td>' + k + '</td><td class="text-break">' + CONFIG.folders[k] + '</td></tr>';
    });
    h3 += '</tbody></table>';
    ids.innerHTML = h3;
  }
}

/* ═════════════════════════════════════════════════════════════════════════════════
   5. API — COMUNICACION CON GOOGLE APPS SCRIPT
   ═════════════════════════════════════════════════════════════════════════════════ */
function apiGet(params) {
  var url = CONFIG.api_url + '?' + new URLSearchParams(params).toString();
  return fetch(url, { redirect: 'follow' }).then(function (r) { return r.json(); });
}

function apiPost(payload) {
  return fetch(CONFIG.api_url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify(payload)
  }).then(function (r) { return r.json(); });
}

function probarApi() {
  apiGet({ action: 'ping' })
    .then(function (r) {
      var e = $('estadoApi');
      if (r && r.ok) {
        if (e) { e.textContent = 'API OK'; e.className = 'badge bg-success'; }
        showToast('Conexion exitosa con Google Drive. <strong>API activa.</strong>', 'success');
      } else {
        if (e) { e.textContent = 'API ERROR'; e.className = 'badge bg-danger'; }
        showToast('Error en la respuesta del servidor.', 'danger');
      }
    })
    .catch(function (err) {
      var e = $('estadoApi');
      if (e) { e.textContent = 'SIN CONEXION'; e.className = 'badge bg-danger'; }
      showToast('No se pudo conectar al servidor: ' + err.message, 'danger');
    });
}

function validarFolder(modulo) {
  var folderId = '';
  var el = $('folder_' + modulo);
  if (el) folderId = el.value.trim();
  if (!folderId && CONFIG.folders[modulo]) folderId = CONFIG.folders[modulo];
  if (!folderId) { showToast('ID de carpeta vacio para ' + modulo, 'danger'); return; }
  apiGet({ action: 'validarCarpeta', folderId: folderId })
    .then(function (r) {
      var e = $('estado_folder_' + modulo);
      if (r && r.ok) {
        if (e) e.innerHTML = '<span class="badge bg-success">&#9989; ' + r.nombre + '</span>';
        showToast('Carpeta <strong>' + r.nombre + '</strong> validada correctamente.', 'success');
      } else {
        if (e) e.innerHTML = '<span class="badge bg-danger">&#10060; Error</span>';
        showToast('Error al validar carpeta: ' + (r.error || ''), 'danger');
      }
    })
    .catch(function (err) {
      showToast('No se pudo validar: ' + err.message, 'danger');
    });
}

/* ═════════════════════════════════════════════════════════════════════════════════
   6. TARJETA 1 — SEGURIDAD (NUEVA)
   ═════════════════════════════════════════════════════════════════════════════════ */
function t1Guardar() {
  var guia = $('s_guia') ? $('s_guia').value.trim() : '';
  var factura = $('s_factura') ? $('s_factura').value.trim() : '';
  var proveedor = $('s_proveedor') ? $('s_proveedor').value.trim() : '';
  var unidades = $('s_unidades') ? $('s_unidades').value.trim() : '';
  var quienRecibe = $('s_quien_recibe') ? $('s_quien_recibe').value : '';
  var observacion = $('s_observacion') ? $('s_observacion').value.trim() : '';

  if (!guia || !factura || !proveedor || !unidades || !quienRecibe) {
    showToast('Complete todos los campos obligatorios (*).', 'danger');
    return;
  }

  var folderId = $('folder_seguridad') ? $('folder_seguridad').value.trim() : CONFIG.folders.seguridad;
  if (!folderId) { showToast('Configure la carpeta Drive de Seguridad.', 'danger'); return; }

  var registro = {
    'Guia': guia,
    'Factura': factura,
    'Proveedor': proveedor,
    'Unidades': unidades,
    'Quien Recibe': quienRecibe,
    'Fecha Registro': hoy(),
    'Hora Registro': ahora(),
    'Observacion': observacion,
    'Perfil': perfilActivo(),
    'Usuario': nombreUsuario()
  };

  apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'seguridad', registro: registro })
    .then(function (r) {
      if (r && r.ok) {
        showToast('&#128190; Registro de <strong>Seguridad</strong> guardado correctamente en Drive.', 'success');
        limpiarCampos('s_');
      } else {
        showToast('Error al guardar Seguridad: ' + (r.error || ''), 'danger');
      }
    })
    .catch(function (err) {
      showToast('Error de conexion al guardar Seguridad: ' + err.message, 'danger');
    });
}

/* ═════════════════════════════════════════════════════════════════════════════════
   7. TARJETA 2 — RECEPCION TECNICA
   ═════════════════════════════════════════════════════════════════════════════════ */
var t2Items = [];

function t2AgregarItem() {
  var tipo = document.querySelector('input[name="tipoRecepcion"]:checked');
  tipo = tipo ? tipo.value : 'EXTERNA';
  var traslado = $('b_traslado') ? $('b_traslado').value.trim() : '';
  var bodegaOrigen = $('b_bodega_origen') ? $('b_bodega_origen').value : '';
  var destino = $('b_destino') ? $('b_destino').value : '';
  var fechaRecep = $('b_fecha_recepcion') ? $('b_fecha_recepcion').value : '';
  var codigo = $('b_codigo') ? $('b_codigo').value.trim() : '';
  var descripcion = $('b_descripcion') ? $('b_descripcion').value.trim() : '';
  var laboratorio = $('b_laboratorio') ? $('b_laboratorio').value.trim() : '';
  var lote = $('b_lote') ? $('b_lote').value.trim() : '';
  var vencimiento = $('b_vencimiento') ? $('b_vencimiento').value : '';
  var enviada = $('b_enviada') ? $('b_enviada').value : '';
  var recibida = $('b_recibida') ? $('b_recibida').value : '';
  var diferencia = $('b_diferencia') ? $('b_diferencia').value : '';
  var responsable = $('b_responsable') ? $('b_responsable').value.trim() : '';
  var estado = $('b_estado') ? $('b_estado').value : '';
  var observaciones = $('b_observaciones') ? $('b_observaciones').value.trim() : '';

  if (!traslado || !codigo || !descripcion || !lote || !vencimiento || !enviada || !recibida || !responsable) {
    showToast('Complete los campos obligatorios de recepcion.', 'danger');
    return;
  }

  var item = {
    'Tipo Recepcion': tipo, 'Traslado': traslado, 'Bodega Origen': bodegaOrigen,
    'Bodega Destino': destino, 'Fecha Recepcion': fechaRecep, 'Codigo Producto': codigo,
    'Descripcion': descripcion, 'Laboratorio': laboratorio, 'Lote': lote,
    'Fecha Vencimiento': vencimiento, 'Cantidad Enviada': enviada, 'Cantidad Recibida': recibida,
    'Diferencia': diferencia, 'Responsable Recepcion': responsable,
    'Estado Recepcion Tecnica': estado, 'Observaciones': observaciones
  };
  t2Items.push(item);
  t2PintarTabla();
  showToast('Item agregado a la lista de recepcion.', 'success');
}

function t2PintarTabla() {
  var head = $('t2_tablaHead');
  var body = $('t2_tablaBody');
  if (!head || !body) return;
  var cols = ['Tipo', 'Traslado', 'Codigo', 'Descripcion', 'Lote', 'Venc.', 'Enviada', 'Recibida', 'Dif.', 'Estado', 'Acc'];
  head.innerHTML = cols.map(function (c) { return '<th>' + c + '</th>'; }).join('');
  body.innerHTML = '';
  t2Items.forEach(function (item, idx) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + (item['Tipo Recepcion'] || '') + '</td>' +
      '<td>' + (item['Traslado'] || '') + '</td>' +
      '<td>' + (item['Codigo Producto'] || '') + '</td>' +
      '<td>' + (item['Descripcion'] || '') + '</td>' +
      '<td>' + (item['Lote'] || '') + '</td>' +
      '<td>' + (item['Fecha Vencimiento'] || '') + '</td>' +
      '<td>' + (item['Cantidad Enviada'] || '') + '</td>' +
      '<td>' + (item['Cantidad Recibida'] || '') + '</td>' +
      '<td>' + (item['Diferencia'] || '') + '</td>' +
      '<td>' + (item['Estado Recepcion Tecnica'] || '') + '</td>' +
      '<td><button class="btn btn-sm btn-outline-danger" onclick="t2EliminarItem(' + idx + ')">X</button></td>';
    body.appendChild(tr);
  });
}

function t2EliminarItem(idx) {
  t2Items.splice(idx, 1);
  t2PintarTabla();
}

function t2Guardar() {
  if (!t2Items.length) { showToast('Agregue al menos un item antes de guardar.', 'danger'); return; }
  var folderId = $('folder_recepcion') ? $('folder_recepcion').value.trim() : CONFIG.folders.recepcion;
  if (!folderId) { showToast('Configure la carpeta Drive de Recepcion.', 'danger'); return; }
  var okCount = 0;
  var errCount = 0;
  var total = t2Items.length;
  t2Items.forEach(function (item) {
    item['Marca temporal'] = ahora();
    item['Perfil'] = perfilActivo();
    item['Usuario'] = nombreUsuario();
    apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'recepcion', registro: item })
      .then(function (r) {
        if (r && r.ok) okCount++; else errCount++;
        if (okCount + errCount === total) {
          if (errCount === 0) {
            showToast('&#128190; <strong>' + total + '</strong> registros de Recepcion guardados en Drive.', 'success');
            t2Items = []; t2PintarTabla();
          } else {
            showToast('Guardados ' + okCount + '/' + total + '. Errores: ' + errCount, 'danger');
          }
        }
      })
      .catch(function () { errCount++; });
  });
}

/* ═════════════════════════════════════════════════════════════════════════════════
   8. TARJETA 3 — PLANILLA ENTREGA DESPACHOS (ENRIQUECIDA)
   ═════════════════════════════════════════════════════════════════════════════════ */
var t3TrasladoValidado = null;
var t3RotacionHoy = null;

/** Carga la rotacion del dia desde el backend para pre-llenar campos */
function t3CargarRotacion() {
  var folderId = CONFIG.folders.rotacion;
  var fecha = hoy();
  apiGet({ action: 'leerRotacion', folderId: folderId, fecha: fecha })
    .then(function (r) {
      if (r && r.ok && r.asignaciones && r.asignaciones.length) {
        t3RotacionHoy = r.asignaciones;
        t3AplicarRotacion();
      } else {
        t3RotacionHoy = null;
      }
    })
    .catch(function () { t3RotacionHoy = null; });
}

/** Pre-llena los campos Quien Alista / Quien Pita / Quien Empaca segun la rotacion del dia */
function t3AplicarRotacion() {
  if (!t3RotacionHoy) return;
  var alistar = t3RotacionHoy.filter(function (a) { return a.rol === 'Alistar'; });
  var pitar = t3RotacionHoy.filter(function (a) { return a.rol === 'Pitar'; });
  var empacar = t3RotacionHoy.filter(function (a) { return a.rol === 'Empacar'; });
  if (alistar.length) {
    var sel = $('t3_quien_alista');
    if (sel) {
      var opts = sel.options;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].textContent.trim() === alistar[0].nombre) { sel.selectedIndex = i; break; }
      }
    }
  }
  if (pitar.length) {
    var sel2 = $('t3_quien_pita');
    if (sel2) {
      var opts2 = sel2.options;
      for (var j = 0; j < opts2.length; j++) {
        if (opts2[j].textContent.trim() === pitar[0].nombre) { sel2.selectedIndex = j; break; }
      }
    }
  }
  if (empacar.length) {
    var sel3 = $('t3_quien_empaca');
    if (sel3) {
      var opts3 = sel3.options;
      for (var k = 0; k < opts3.length; k++) {
        if (opts3[k].textContent.trim() === empacar[0].nombre) { sel3.selectedIndex = k; break; }
      }
    }
  }
}

function t3ValidarTraslado() {
  var traslado = $('t3_traslado') ? $('t3_traslado').value.trim() : '';
  if (!traslado) { showToast('Ingrese el numero de traslado.', 'danger'); return; }
  var folderId = CONFIG.folders.trasladosConsulta;
  var estado = $('t3_estadoTraslado');
  if (estado) estado.innerHTML = '<span class="badge bg-warning text-dark">Buscando...</span>';

  apiGet({ action: 'buscarTraslado', folderId: folderId, modulo: 'despachos', traslado: traslado })
    .then(function (r) {
      if (r && r.encontrado && r.registro) {
        t3TrasladoValidado = r.registro;
        var reg = r.registro;
        var campos = {
          't3_traslado_mostrar': ['Traslado', 'Documento Traslado', 'Numero Traslado'],
          't3_fecha': ['Fecha', 'Marca temporal'],
          't3_bodega_origen': ['Bodega Origen', 'Bodega'],
          't3_destino': ['Bodega Destino', 'Destino'],
          't3_zona': ['Zona'],
          't3_cantidad': ['Cantidad', 'Unidades'],
          't3_tipo': ['Tipo'],
          't3_urgente': ['Urgente'],
          't3_codigo': ['Codigo', 'Codigo Producto'],
          't3_descripcion': ['Descripcion'],
          't3_unidades': ['Unidades'],
          't3_recibido': ['Recibido', 'Quien Recibe'],
          't3_usuario': ['Usuario', 'Correo'],
          't3_lote': ['Lote'],
          't3_fechaVenc': ['Fecha Vencimiento', 'Vencimiento'],
          't3_observaciones_drive': ['Observacion', 'Observaciones']
        };
        Object.keys(campos).forEach(function (elId) {
          var el = $(elId);
          if (el) {
            for (var i = 0; i < campos[elId].length; i++) {
              if (reg[campos[elId][i]] !== undefined && reg[campos[elId][i]] !== '') {
                el.value = reg[campos[elId][i]]; break;
              }
            }
          }
        });

        if ($('t3_punto_captura')) $('t3_punto_captura').value = 'Punto ' + (reg['Punto'] || reg['Punto de Captura'] || traslado);
        if ($('t3_punto_row')) $('t3_punto_row').style.display = '';
        if ($('t3_punto_info')) $('t3_punto_info').innerHTML = '<span class="badge bg-success">&#9989; Punto capturado</span>';

        if (reg['Urgente'] === 'SI' || reg['Urgente'] === 'Si' || reg['Urgente'] === 'si' || reg['urgente'] === 'SI') {
          if ($('t3_badgeUrgente')) $('t3_badgeUrgente').innerHTML = '<span class="badge bg-danger">&#9888; URGENTE</span>';
        } else {
          if ($('t3_badgeUrgente')) $('t3_badgeUrgente').innerHTML = '';
        }

        if (estado) estado.innerHTML = '<span class="badge bg-success">&#9989; Traslado encontrado</span>';
        showToast('Traslado <strong>' + traslado + '</strong> encontrado en Drive.', 'success');

        t3CargarRotacion();
      } else {
        t3TrasladoValidado = null;
        if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; No encontrado</span>';
        showToast('Traslado <strong>' + traslado + '</strong> no encontrado.', 'danger');
      }
    })
    .catch(function (err) {
      t3TrasladoValidado = null;
      if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; Error</span>';
      showToast('Error al buscar traslado: ' + err.message, 'danger');
    });
}

function t3Guardar() {
  var traslado = $('t3_traslado') ? $('t3_traslado').value.trim() : '';
  if (!traslado) { showToast('Primero valide un traslado.', 'danger'); return; }
  if (!t3TrasladoValidado) { showToast('Valide el traslado antes de guardar.', 'danger'); return; }

  var folderId = $('folder_despachos') ? $('folder_despachos').value.trim() : CONFIG.folders.despachos;
  if (!folderId) { showToast('Configure la carpeta Drive de Destino.', 'danger'); return; }

  var responsableEntrega = $('t3_responsable_entrega') ? $('t3_responsable_entrega').value.trim() : '';
  var quienAlista = $('t3_quien_alista') ? $('t3_quien_alista').value : '';
  var quienPita = $('t3_quien_pita') ? $('t3_quien_pita').value : '';
  var quienEmpaca = $('t3_quien_empaca') ? $('t3_quien_empaca').value : '';
  var tipoCarga = $('t3_tipo_carga') ? $('t3_tipo_carga').value : '';
  var concepto = $('t3_concepto') ? $('t3_concepto').value.trim() : '';
  var recomendado = $('t3_recomendado') ? $('t3_recomendado').value.trim() : '';

  if (!responsableEntrega) { showToast('Ingrese el Responsable de Entrega.', 'danger'); return; }
  if (!quienAlista || !quienPita || !quienEmpaca) { showToast('Seleccione Quien Alista, Quien Pita y Quien Empaca.', 'danger'); return; }
  if (!tipoCarga) { showToast('Seleccione el Tipo de Carga.', 'danger'); return; }

  var registro = {
    'Documento Traslado': traslado,
    'Fecha': $('t3_fecha') ? $('t3_fecha').value : '',
    'Bodega Origen': $('t3_bodega_origen') ? $('t3_bodega_origen').value : '',
    'Bodega Destino': $('t3_destino') ? $('t3_destino').value : '',
    'Zona': $('t3_zona') ? $('t3_zona').value : '',
    'Cantidad': $('t3_cantidad') ? $('t3_cantidad').value : '',
    'Tipo': $('t3_tipo') ? $('t3_tipo').value : '',
    'Urgente': $('t3_urgente') ? $('t3_urgente').value : '',
    'Codigo': $('t3_codigo') ? $('t3_codigo').value : '',
    'Descripcion': $('t3_descripcion') ? $('t3_descripcion').value : '',
    'Unidades': $('t3_unidades') ? $('t3_unidades').value : '',
    'Lote': $('t3_lote') ? $('t3_lote').value : '',
    'Fecha Vencimiento': $('t3_fechaVenc') ? $('t3_fechaVenc').value : '',
    'Recibido': $('t3_recibido') ? $('t3_recibido').value : '',
    'Responsable Entrega CENDIS': responsableEntrega,
    'Quien Alisto': quienAlista,
    'Quien Pito': quienPita,
    'Quien Empaco': quienEmpaca,
    'Tipo Carga': tipoCarga,
    'Concepto': concepto,
    'Recomendado': recomendado,
    'Observacion Drive': $('t3_observaciones_drive') ? $('t3_observaciones_drive').value : '',
    'Marca temporal': ahora(),
    'Perfil': perfilActivo(),
    'Usuario': nombreUsuario()
  };

  apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'despachos', registro: registro })
    .then(function (r) {
      if (r && r.ok) {
        showToast('&#128190; <strong>Planilla Entrega</strong> guardada en Drive (con datos de rotacion).', 'success');
        t3TrasladoValidado = null;
        limpiarCampos('t3_');
        if ($('t3_punto_row')) $('t3_punto_row').style.display = 'none';
        if ($('t3_estadoTraslado')) $('t3_estadoTraslado').innerHTML = '';
      } else {
        showToast('Error al guardar Planilla: ' + (r.error || ''), 'danger');
      }
    })
    .catch(function (err) {
      showToast('Error de conexion: ' + err.message, 'danger');
    });
}

/* ═════════════════════════════════════════════════════════════════════════════════
   9. TARJETA 4 — LOGISTICA Y DESPACHOS
   ═════════════════════════════════════════════════════════════════════════════════ */
function t4Buscar() {
  var traslado = $('t4_traslado') ? $('t4_traslado').value.trim() : '';
  if (!traslado) { showToast('Ingrese el numero de traslado.', 'danger'); return; }
  var folderId = CONFIG.folders.trasladosConsulta;
  var estado = $('t4_estadoTraslado');
  if (estado) estado.innerHTML = '<span class="badge bg-warning text-dark">Buscando...</span>';

  apiGet({ action: 'buscarTraslado', folderId: folderId, modulo: 'despachos', traslado: traslado })
    .then(function (r) {
      if (r && r.encontrado && r.registro) {
        var reg = r.registro;
        if ($('t4_bodega_origen')) $('t4_bodega_origen').value = reg['Bodega Origen'] || reg['Bodega'] || '';
        if ($('t4_destino')) $('t4_destino').value = reg['Bodega Destino'] || reg['Destino'] || '';
        if ($('t4_zona')) $('t4_zona').value = reg['Zona'] || '';
        if (estado) estado.innerHTML = '<span class="badge bg-success">&#9989; Encontrado</span>';
        showToast('Traslado <strong>' + traslado + '</strong> encontrado.', 'success');
      } else {
        if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; No encontrado</span>';
        showToast('Traslado no encontrado.', 'danger');
      }
    })
    .catch(function (err) {
      if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; Error</span>';
      showToast('Error al buscar: ' + err.message, 'danger');
    });
}

function t4Guardar() {
  var traslado = $('t4_traslado') ? $('t4_traslado').value.trim() : '';
  if (!traslado) { showToast('Ingrese el numero de traslado.', 'danger'); return; }
  var folderId = $('folder_logistica') ? $('folder_logistica').value.trim() : CONFIG.folders.logistica;
  if (!folderId) { showToast('Configure la carpeta Drive de Logistica.', 'danger'); return; }

  var registro = {
    'Documento Traslado': traslado,
    'Bodega Origen': $('t4_bodega_origen') ? $('t4_bodega_origen').value : '',
    'Bodega Destino': $('t4_destino') ? $('t4_destino').value : '',
    'Zona': $('t4_zona') ? $('t4_zona').value : '',
    'Fecha Envio': $('t4_fecha_envio') ? $('t4_fecha_envio').value : '',
    'Conductor / Mensajero': $('t4_conductor') ? $('t4_conductor').value : '',
    'Placa': $('t4_placa') ? $('t4_placa').value : '',
    'Planilla': $('t4_planilla') ? $('t4_planilla').value : '',
    'Quien Recibe': $('t4_quien_recibe') ? $('t4_quien_recibe').value.trim() : '',
    'Observacion': $('t4_observacion') ? $('t4_observacion').value.trim() : '',
    'Marca temporal': ahora(),
    'Perfil': perfilActivo(),
    'Usuario': nombreUsuario()
  };

  apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'logistica', registro: registro })
    .then(function (r) {
      if (r && r.ok) {
        showToast('&#128190; <strong>Logistica</strong> guardada en Drive.', 'success');
        limpiarCampos('t4_');
      } else {
        showToast('Error al guardar Logistica: ' + (r.error || ''), 'danger');
      }
    })
    .catch(function (err) {
      showToast('Error de conexion: ' + err.message, 'danger');
    });
}

function t4Imprimir() {
  var traslado = $('t4_traslado') ? $('t4_traslado').value.trim() : '';
  if (!traslado) { showToast('Busque un traslado primero.', 'danger'); return; }
  var folderId = $('folder_despachos_t4') ? $('folder_despachos_t4').value.trim() : CONFIG.folders.despachos;

  apiPost({ action: 'marcarImpresion', folderId: folderId, modulo: 'logistica', traslado: traslado })
    .then(function (r) {
      if (r && r.ok) {
        showToast('&#128424; Planilla impresa y marcada EN RUTA.', 'success');
        window.print();
      } else {
        showToast('Error al marcar impresion: ' + (r.error || ''), 'danger');
      }
    })
    .catch(function (err) {
      showToast('Error de conexion: ' + err.message, 'danger');
    });
}

/* ═════════════════════════════════════════════════════════════════════════════════
   10. TARJETA 5 — CARGUE DE FACTURA
   ═════════════════════════════════════════════════════════════════════════════════ */
function t5Guardar() {
  var transporte = $('f_transporte') ? $('f_transporte').value.trim() : '';
  var guia = $('f_guia') ? $('f_guia').value.trim() : '';
  var fecha = $('f_fecha') ? $('f_fecha').value : '';
  var factura = $('f_factura') ? $('f_factura').value.trim() : '';
  var proveedor = $('f_proveedor') ? $('f_proveedor').value.trim() : '';
  if (!transporte || !guia || !fecha || !factura || !proveedor) {
    showToast('Complete los campos obligatorios de Factura.', 'danger'); return;
  }
  var folderId = $('folder_facturacion') ? $('folder_facturacion').value.trim() : CONFIG.folders.facturacion;
  if (!folderId) { showToast('Configure la carpeta Drive de Facturacion.', 'danger'); return; }

  var registro = {
    'Transporte': transporte, 'Guia': guia, 'Fecha': fecha, 'Factura': factura,
    'Proveedor': proveedor, 'Orden de Compra': $('f_orden') ? $('f_orden').value.trim() : '',
    'Ingreso': $('f_ingreso') ? $('f_ingreso').value.trim() : '',
    'Valor': $('f_valor') ? $('f_valor').value : '',
    'A Quien se Entrega': $('f_entregado_a') ? $('f_entregado_a').value.trim() : '',
    'Fecha de Entrega': $('f_fecha_entrega') ? $('f_fecha_entrega').value : '',
    'Observacion': $('f_observacion') ? $('f_observacion').value.trim() : '',
    'Marca temporal': ahora(), 'Perfil': perfilActivo(), 'Usuario': nombreUsuario()
  };

  apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'facturacion', registro: registro })
    .then(function (r) {
      if (r && r.ok) {
        showToast('&#128190; <strong>Factura</strong> guardada en Drive.', 'success');
        limpiarCampos('f_');
      } else {
        showToast('Error al guardar Factura: ' + (r.error || ''), 'danger');
      }
    })
    .catch(function (err) {
      showToast('Error de conexion: ' + err.message, 'danger');
    });
}

/* ═════════════════════════════════════════════════════════════════════════════════
   11. TARJETA 6 — VERIFICACION DE INVENTARIO
   ═════════════════════════════════════════════════════════════════════════════════ */
var t6Items = [];

function t6AgregarItem() {
  var bodega = $('i_bodega') ? $('i_bodega').value : '';
  var responsable = $('i_responsable') ? $('i_responsable').value.trim() : '';
  var fecha = $('i_fecha') ? $('i_fecha').value : '';
  var molecula = $('i_molecula') ? $('i_molecula').value.trim() : '';
  var codigo = $('i_codigo') ? $('i_codigo').value.trim() : '';
  var lote = $('i_lote') ? $('i_lote').value.trim() : '';
  var vencimiento = $('i_vencimiento') ? $('i_vencimiento').value : '';
  var teorica = $('i_teorica') ? $('i_teorica').value : '';
  var fisica = $('i_fisica') ? $('i_fisica').value : '';

  if (!bodega || !responsable || !fecha || !molecula || !lote || !teorica || !fisica) {
    showToast('Complete los campos obligatorios de Inventario.', 'danger'); return;
  }

  var dif = Number(fisica) - Number(teorica);
  var estado = dif === 0 ? 'CONFORME' : 'NOVEDAD';

  var item = {
    'Bodega': bodega, 'Responsable': responsable, 'Fecha Verificacion': fecha,
    'Molecula': molecula, 'Codigo': codigo, 'Lote': lote,
    'Fecha Vencimiento': vencimiento, 'Cantidad Teorica': teorica,
    'Cantidad Fisica': fisica, 'Diferencia': dif, 'Estado Verificacion': estado
  };
  t6Items.push(item);
  t6PintarTabla();
  showToast('Item de inventario agregado.', 'success');
}

function t6PintarTabla() {
  var head = $('t6_tablaHead');
  var body = $('t6_tablaBody');
  if (!head || !body) return;
  var cols = ['Bodega', 'Molecula', 'Lote', 'Venc.', 'Teorica', 'Fisica', 'Dif.', 'Estado', 'Acc'];
  head.innerHTML = cols.map(function (c) { return '<th>' + c + '</th>'; }).join('');
  body.innerHTML = '';
  t6Items.forEach(function (item, idx) {
    var tr = document.createElement('tr');
    var cls = item['Estado Verificacion'] === 'NOVEDAD' ? 'table-danger' : '';
    tr.className = cls;
    tr.innerHTML =
      '<td>' + item['Bodega'] + '</td>' +
      '<td>' + item['Molecula'] + '</td>' +
      '<td>' + item['Lote'] + '</td>' +
      '<td>' + item['Fecha Vencimiento'] + '</td>' +
      '<td>' + item['Cantidad Teorica'] + '</td>' +
      '<td>' + item['Cantidad Fisica'] + '</td>' +
      '<td>' + item['Diferencia'] + '</td>' +
      '<td>' + item['Estado Verificacion'] + '</td>' +
      '<td><button class="btn btn-sm btn-outline-danger" onclick="t6EliminarItem(' + idx + ')">X</button></td>';
    body.appendChild(tr);
  });
}

function t6EliminarItem(idx) {
  t6Items.splice(idx, 1);
  t6PintarTabla();
}

function t6Guardar() {
  if (!t6Items.length) { showToast('Agregue al menos un item de inventario.', 'danger'); return; }
  var folderId = $('folder_inventario') ? $('folder_inventario').value.trim() : CONFIG.folders.inventario;
  if (!folderId) { showToast('Configure la carpeta Drive de Inventario.', 'danger'); return; }
  var okCount = 0, errCount = 0, total = t6Items.length;
  t6Items.forEach(function (item) {
    item['Marca temporal'] = ahora();
    item['Perfil'] = perfilActivo();
    item['Usuario'] = nombreUsuario();
    apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'inventario', registro: item })
      .then(function (r) {
        if (r && r.ok) okCount++; else errCount++;
        if (okCount + errCount === total) {
          if (errCount === 0) {
            showToast('&#128190; <strong>' + total + '</strong> registros de Inventario guardados.', 'success');
            t6Items = []; t6PintarTabla();
          } else {
            showToast('Guardados ' + okCount + '/' + total + '. Errores: ' + errCount, 'danger');
          }
        }
      })
      .catch(function () { errCount++; });
  });
}

/* ═════════════════════════════════════════════════════════════════════════════════
   12. BACKUP / DESCARGA DE ARCHIVO DE SEGURIDAD
   ═════════════════════════════════════════════════════════════════════════════════ */
function generarBackup() {
  var backupLocal = { _meta: { generado: ahora(), perfil: perfilActivo(), version: '3.0' } };
  MODULOS.forEach(function (m) {
    backupLocal[m] = { folder: CONFIG.folders[m], registros: [] };
  });
  if (typeof XLSX !== 'undefined') {
    var wb = XLSX.utils.book_new();
    MODULOS.forEach(function (m) {
      var data = [['Marca temporal', 'Perfil', 'Usuario', 'Modulo', 'Datos...']];
      var ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, m);
    });
    XLSX.writeFile(wb, 'Backup_MEDISFARMA_' + hoy() + '.xlsx');
    showToast('&#128190; Archivo de seguridad XLSX descargado.', 'success');
  } else {
    showToast('Libreria XLSX no cargada. Intente mas tarde.', 'danger');
  }
}

/* ═════════════════════════════════════════════════════════════════════════════════
   13. INICIALIZACION
   ═════════════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  cargarConfig();
  aplicarPerfil();

  // Botones de tarjeta
  var btn;
  btn = $('t1_btnGuardar'); if (btn) btn.addEventListener('click', t1Guardar);
  btn = $('t2_btnAgregar'); if (btn) btn.addEventListener('click', t2AgregarItem);
  btn = $('t2_btnGuardar'); if (btn) btn.addEventListener('click', t2Guardar);
  btn = $('t3_btnValidar'); if (btn) btn.addEventListener('click', t3ValidarTraslado);
  btn = $('t3_btnGuardar'); if (btn) btn.addEventListener('click', t3Guardar);
  btn = $('t4_btnBuscar');  if (btn) btn.addEventListener('click', t4Buscar);
  btn = $('t4_btnGuardar'); if (btn) btn.addEventListener('click', t4Guardar);
  btn = $('t4_btnImprimir'); if (btn) btn.addEventListener('click', t4Imprimir);
  btn = $('t5_btnGuardar'); if (btn) btn.addEventListener('click', t5Guardar);
  btn = $('t6_btnAgregar'); if (btn) btn.addEventListener('click', t6AgregarItem);
  btn = $('t6_btnGuardar'); if (btn) btn.addEventListener('click', t6Guardar);

  // API / config
  btn = $('btnProbarApi'); if (btn) btn.addEventListener('click', probarApi);
  btn = $('cfg_guardar'); if (btn) btn.addEventListener('click', guardarConfig);
  btn = $('btnBackupTop'); if (btn) btn.addEventListener('click', generarBackup);
  btn = $('btnBackupFloat'); if (btn) btn.addEventListener('click', generarBackup);

  // Perfil selector
  var sel = $('selPerfil');
  if (sel) sel.addEventListener('change', function () { seleccionarPerfil(sel.value); });

  // Conductores dropdown
  var condSel = $('t4_conductor');
  if (condSel) {
    condSel.innerHTML = '<option value="">Seleccione...</option>';
    (CONFIG.conductores || CONFIG_DEFAULT.conductores).forEach(function (c) {
      condSel.innerHTML += '<option>' + c + '</option>';
    });
  }

  // Diferencia automatica en Recepcion
  var bEnv = $('b_enviada'), bRec = $('b_recibida'), bDif = $('b_diferencia');
  function calcDif() { if (bDif) bDif.value = Number(bRec.value || 0) - Number(bEnv.value || 0); }
  if (bEnv) bEnv.addEventListener('input', calcDif);
  if (bRec) bRec.addEventListener('input', calcDif);

  // Diferencia automatica en Inventario
  var iT = $('i_teorica'), iF = $('i_fisica'), iD = $('i_diferencia'), iE = $('i_estado');
  function calcInv() {
    if (iD) iD.value = Number(iF.value || 0) - Number(iT.value || 0);
    if (iE) iE.value = (Number(iF.value || 0) === Number(iT.value || 0)) ? 'CONFORME' : 'NOVEDAD';
  }
  if (iT) iT.addEventListener('input', calcInv);
  if (iF) iF.addEventListener('input', calcInv);

  // Probar API al inicio
  probarApi();
});
