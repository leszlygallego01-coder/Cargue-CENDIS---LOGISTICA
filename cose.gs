/************************************************************************************
 * MEDISFARMA - Unidos por su Salud
 * SISTEMA WEB INTEGRAL DE GESTION LOGISTICA, RECEPCION TECNICA, FACTURACION,
 * TRASLADOS Y CONTROL DE INVENTARIO
 *
 * Code.gs  -> Backend (Google Apps Script Web App)
 *
 * DESPLIEGUE:
 *   1. Crear proyecto en https://script.google.com
 *   2. Pegar este archivo como Code.gs
 *   3. Subir tambien cargue.html / visor.html (y sus css/js embebidos o servidos aparte)
 *   4. Implementar > Nueva implementacion > Aplicacion web
 *        - Ejecutar como: Yo
 *        - Quien tiene acceso: Cualquier usuario de la organizacion (o el requerido)
 *   5. Copiar la URL /exec y pegarla en la configuracion del frontend (API_URL).
 *
 * PRINCIPIO CLAVE:
 *   Toda lectura/escritura se hace por NOMBRE DE CABECERA NORMALIZADO, nunca por
 *   indice de columna. Si el orden de columnas cambia, faltan o se agregan nuevas,
 *   el sistema sigue funcionando.
 ************************************************************************************/

/** Nombres logicos de los archivos de datos por tarjeta (uno por carpeta de Drive). */
var ARCHIVOS = {
  despachos:   { file: 'BD_PLANILLA_ENTREGA_DESPACHOS', sheet: 'DATOS' },
  logistica:   { file: 'BD_LOGISTICA_DESPACHOS',        sheet: 'DATOS' },
  recepcion:   { file: 'BD_RECEPCION_TECNICA',          sheet: 'DATOS' },
  facturacion: { file: 'BD_CARGUE_FACTURA_TRANSPORTE',  sheet: 'DATOS' },
  inventario:  { file: 'BD_VERIFICACION_INVENTARIO',    sheet: 'DATOS' },
  novedades:   { file: 'BD_NOVEDADES_MODIFICACIONES',   sheet: 'DATOS' }
};

/* =================================================================================
 * 1. ENRUTADORES HTTP
 * ================================================================================= */

/**
 * GET: sirve las vistas HTML o responde consultas JSON (?action=...).
 */
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  if (params.action) {
    return _json(_router(params.action, params));
  }
  var page = params.page || 'cargue';
  var file = (page === 'visor') ? 'visor' : 'cargue';
  return HtmlService.createTemplateFromFile(file)
    .evaluate()
    .setTitle('MEDISFARMA | Gestion Logistica')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * POST: recibe payload JSON { action: '...', ...datos }.
 * Se usa text/plain desde el frontend para evitar preflight CORS.
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return _json({ ok: false, error: 'JSON invalido: ' + err.message });
  }
  return _json(_router(body.action, body));
}

/** Router central de acciones. */
function _router(action, p) {
  try {
    switch (action) {
      case 'ping':            return { ok: true, msg: 'MEDISFARMA API activa', now: _ahora() };
      case 'validarCarpeta':  return validarCarpeta(p.folderId);
      case 'leerHoja':        return leerHoja(p.folderId, p.modulo, p.file, p.sheet);
      case 'buscarTraslado':  return buscarTraslado(p.folderId, p.modulo, p.traslado);
      case 'guardarRegistro': return guardarRegistro(p.folderId, p.modulo, p.registro);
      case 'actualizarRegistro': return actualizarRegistro(p.folderId, p.modulo, p.claveCol, p.claveVal, p.cambios);
      case 'marcarImpresion': return marcarImpresion(p.folderId, p.modulo, p.traslado);
      case 'backupRemoto':    return backupRemoto(p.folderIds, p.carpetaBackupId);
      case 'consolidadoVisor':return consolidadoVisor(p.folderIds);
      default: return { ok: false, error: 'Accion no reconocida: ' + action };
    }
  } catch (err) {
    return { ok: false, error: err.message, stack: String(err.stack || '') };
  }
}

/** Respuesta JSON estandar. */
function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Permite incluir css/js parciales dentro del HTML: <?!= include('cargue_styles') ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* =================================================================================
 * 2. NORMALIZACION Y BUSQUEDA DINAMICA DE CABECERAS (independiente del orden)
 * ================================================================================= */

/**
 * Normaliza un nombre de cabecera: minusculas, sin acentos, sin signos,
 * espacios colapsados. Permite que "Fecha Vencimiento", "FECHA  VENCIMIENTO"
 * y "fecha_vencimiento" se consideren la MISMA columna.
 */
function normalizarCabecera(texto) {
  if (texto === null || texto === undefined) return '';
  var s = String(texto)
    .replace(/\u00A0/g, ' ')
    .trim()
    .toLowerCase();
  s = s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s
        .replace(/[áàäâ]/g, 'a').replace(/[éèëê]/g, 'e').replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o').replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n');
  s = s.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

/** Construye { cabeceraNormalizada: indice } a partir de la fila 1. */
function construirMapaCabeceras(filaCabeceras) {
  var mapa = {};
  for (var i = 0; i < filaCabeceras.length; i++) {
    var key = normalizarCabecera(filaCabeceras[i]);
    if (key && mapa[key] === undefined) mapa[key] = i;
  }
  return mapa;
}

/**
 * Obtiene el valor de una fila buscando la columna por NOMBRE.
 * Acepta alias: obtenerValorPorNombreColumna(fila, mapa, ['traslado','documento traslado'])
 */
function obtenerValorPorNombreColumna(fila, mapa, nombreColumna) {
  var candidatos = Array.isArray(nombreColumna) ? nombreColumna : [nombreColumna];
  for (var i = 0; i < candidatos.length; i++) {
    var k = normalizarCabecera(candidatos[i]);
    if (mapa[k] !== undefined) {
      var v = fila[mapa[k]];
      return (v === null || v === undefined) ? '' : v;
    }
  }
  return '';
}

/* =================================================================================
 * 3. ACCESO A DRIVE / SHEETS POR ID DE CARPETA
 * ================================================================================= */

/** Valida que el ID de carpeta exista y sea accesible. */
function validarCarpeta(folderId) {
  if (!folderId) return { ok: false, error: 'ID de carpeta vacio' };
  var f = DriveApp.getFolderById(String(folderId).trim());
  return { ok: true, id: f.getId(), nombre: f.getName(), url: f.getUrl() };
}

/** Devuelve (o crea) el Spreadsheet del modulo dentro de la carpeta indicada. */
function obtenerLibro(folderId, nombreArchivo) {
  var folder = DriveApp.getFolderById(String(folderId).trim());
  var it = folder.getFilesByName(nombreArchivo);
  if (it.hasNext()) return SpreadsheetApp.openById(it.next().getId());
  // No existe: se crea y se mueve a la carpeta destino.
  var ss = SpreadsheetApp.create(nombreArchivo);
  var archivo = DriveApp.getFileById(ss.getId());
  folder.addFile(archivo);
  DriveApp.getRootFolder().removeFile(archivo);
  return ss;
}

/** Devuelve (o crea) la hoja de datos. */
function obtenerHoja(folderId, modulo, fileOverride, sheetOverride) {
  var cfg = ARCHIVOS[modulo] || { file: fileOverride || 'BD_GENERICA', sheet: sheetOverride || 'DATOS' };
  var nombreArchivo = fileOverride || cfg.file;
  var nombreHoja = sheetOverride || cfg.sheet;
  var ss = obtenerLibro(folderId, nombreArchivo);
  var sh = ss.getSheetByName(nombreHoja);
  if (!sh) {
    sh = ss.insertSheet(nombreHoja);
    if (ss.getSheets().length > 1 && ss.getSheets()[0].getName() === 'Hoja 1') {
      try { ss.deleteSheet(ss.getSheets()[0]); } catch (e) {}
    }
  }
  return sh;
}

/* =================================================================================
 * 4. LECTURA DINAMICA
 * ================================================================================= */

/**
 * Lee toda la hoja y devuelve:
 *   headers: cabeceras originales tal cual estan en Drive
 *   rows:    array de objetos { cabeceraOriginal: valor }
 * El frontend vuelve a mapear por nombre, por lo que el orden es irrelevante.
 */
function leerHoja(folderId, modulo, fileOverride, sheetOverride) {
  var sh = obtenerHoja(folderId, modulo, fileOverride, sheetOverride);
  var valores = sh.getDataRange().getDisplayValues();
  if (!valores.length) return { ok: true, headers: [], rows: [] };
  var headers = valores[0];
  var rows = [];
  for (var i = 1; i < valores.length; i++) {
    var fila = valores[i];
    if (fila.join('').trim() === '') continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c]).trim() === '') continue;
      obj[headers[c]] = fila[c];
    }
    obj.__fila = i + 1; // numero real de fila en la hoja
    rows.push(obj);
  }
  return { ok: true, headers: headers, rows: rows, total: rows.length };
}

/**
 * Busca un traslado por cualquiera de sus alias de cabecera y devuelve el registro.
 * Usado por la Tarjeta 1 (validacion estricta) y la Tarjeta 2 (autocompletado).
 */
function buscarTraslado(folderId, modulo, traslado) {
  var alias = ['traslado', 'documento traslado', 'numero traslado', 'no traslado', 'documento de traslado'];
  var sh = obtenerHoja(folderId, modulo, null, null);
  var valores = sh.getDataRange().getDisplayValues();
  if (valores.length < 2) return { ok: true, encontrado: false, registro: null };
  var headers = valores[0];
  var mapa = construirMapaCabeceras(headers);
  var buscado = normalizarCabecera(traslado);
  for (var i = 1; i < valores.length; i++) {
    var val = normalizarCabecera(obtenerValorPorNombreColumna(valores[i], mapa, alias));
    if (val && val === buscado) {
      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        if (String(headers[c]).trim() !== '') obj[headers[c]] = valores[i][c];
      }
      obj.__fila = i + 1;
      return { ok: true, encontrado: true, registro: obj };
    }
  }
  return { ok: true, encontrado: false, registro: null };
}

/* =================================================================================
 * 5. ESCRITURA DINAMICA (crea columnas nuevas si el registro trae campos nuevos)
 * ================================================================================= */

function guardarRegistro(folderId, modulo, registro) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = obtenerHoja(folderId, modulo, null, null);
    var ultimaCol = Math.max(sh.getLastColumn(), 1);
    var headers = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, ultimaCol).getValues()[0] : [];
    headers = headers.filter(function (h) { return String(h).trim() !== ''; });
    var mapa = construirMapaCabeceras(headers);

    // Sello de auditoria si no viene del frontend.
    if (!registro['Marca temporal']) registro['Marca temporal'] = _ahora();
    if (!registro['Direccion de correo electronico'] && !registro['Dirección de correo electrónico']) {
      registro['Dirección de correo electrónico'] = _usuario();
    }

    // Agrega columnas nuevas al final, respetando las existentes.
    Object.keys(registro).forEach(function (k) {
      if (k.indexOf('__') === 0) return;
      var nk = normalizarCabecera(k);
      if (mapa[nk] === undefined) {
        headers.push(k);
        mapa[nk] = headers.length - 1;
      }
    });
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0d6efd').setFontColor('#ffffff');
    sh.setFrozenRows(1);

    // Arma la fila ubicando cada valor en la columna correspondiente por NOMBRE.
    var fila = new Array(headers.length).fill('');
    Object.keys(registro).forEach(function (k) {
      if (k.indexOf('__') === 0) return;
      var idx = mapa[normalizarCabecera(k)];
      if (idx !== undefined) fila[idx] = registro[k];
    });
    sh.appendRow(fila);
    return { ok: true, fila: sh.getLastRow(), headers: headers };
  } finally {
    lock.releaseLock();
  }
}

/** Actualiza (o crea) campos de un registro localizado por columna clave = valor. */
function actualizarRegistro(folderId, modulo, claveCol, claveVal, cambios) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = obtenerHoja(folderId, modulo, null, null);
    var valores = sh.getDataRange().getValues();
    if (!valores.length) return { ok: false, error: 'Hoja vacia' };
    var headers = valores[0];
    var mapa = construirMapaCabeceras(headers);
    var aliasClave = Array.isArray(claveCol) ? claveCol : [claveCol];
    var objetivo = normalizarCabecera(claveVal);
    var filaIdx = -1;
    for (var i = 1; i < valores.length; i++) {
      if (normalizarCabecera(obtenerValorPorNombreColumna(valores[i], mapa, aliasClave)) === objetivo) {
        filaIdx = i; break;
      }
    }
    if (filaIdx === -1) {
      // Si no existe, se registra como nuevo para no perder informacion.
      var nuevo = {};
      nuevo[aliasClave[0]] = claveVal;
      Object.keys(cambios).forEach(function (k) { nuevo[k] = cambios[k]; });
      return guardarRegistro(folderId, modulo, nuevo);
    }
    // Agrega columnas faltantes.
    Object.keys(cambios).forEach(function (k) {
      if (mapa[normalizarCabecera(k)] === undefined) {
        headers.push(k);
        mapa[normalizarCabecera(k)] = headers.length - 1;
      }
    });
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    Object.keys(cambios).forEach(function (k) {
      sh.getRange(filaIdx + 1, mapa[normalizarCabecera(k)] + 1).setValue(cambios[k]);
    });
    return { ok: true, fila: filaIdx + 1 };
  } finally {
    lock.releaseLock();
  }
}

/** Boton "Imprimir Planilla": sella la fecha y hora REAL de salida a ruta. */
function marcarImpresion(folderId, modulo, traslado) {
  return actualizarRegistro(
    folderId, modulo || 'logistica',
    ['traslado', 'documento traslado'], traslado,
    { 'FECHA Y HORA REAL DE SALIDA': _ahora(), 'SEGUIMIENTO': 'EN RUTA' }
  );
}

/* =================================================================================
 * 6. RESPALDO REMOTO Y CONSOLIDADO PARA EL VISOR / LOOKER STUDIO
 * ================================================================================= */

/**
 * Copia el contenido de todas las hojas configuradas en un unico libro de respaldo
 * (una pestana por modulo) dentro de la carpeta de backup indicada.
 * folderIds = { despachos:'..', logistica:'..', ... }
 */
function backupRemoto(folderIds, carpetaBackupId) {
  var destino = carpetaBackupId || folderIds.despachos;
  var nombre = 'Backup_Cargue_Logistico_' + _stamp();
  var ss = obtenerLibro(destino, nombre);
  var resumen = {};
  Object.keys(folderIds).forEach(function (modulo) {
    var fid = folderIds[modulo];
    if (!fid) return;
    var data = leerHoja(fid, modulo, null, null);
    var hoja = ss.getSheetByName(modulo) || ss.insertSheet(modulo);
    hoja.clear();
    if (data.headers.length) {
      var matriz = [data.headers];
      data.rows.forEach(function (r) {
        matriz.push(data.headers.map(function (h) { return r[h] === undefined ? '' : r[h]; }));
      });
      hoja.getRange(1, 1, matriz.length, data.headers.length).setValues(matriz);
      hoja.getRange(1, 1, 1, data.headers.length).setFontWeight('bold');
    }
    resumen[modulo] = data.total || 0;
  });
  return { ok: true, archivo: nombre, url: ss.getUrl(), resumen: resumen };
}

/** Devuelve en una sola llamada todas las fuentes que consume el VISOR. */
function consolidadoVisor(folderIds) {
  var out = { ok: true, fuentes: {} };
  Object.keys(folderIds || {}).forEach(function (modulo) {
    if (!folderIds[modulo]) return;
    try {
      out.fuentes[modulo] = leerHoja(folderIds[modulo], modulo, null, null);
    } catch (e) {
      out.fuentes[modulo] = { ok: false, error: e.message, headers: [], rows: [] };
    }
  });
  return out;
}

/* =================================================================================
 * 7. UTILIDADES
 * ================================================================================= */

function _ahora() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function _stamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
}

function _usuario() {
  try { return Session.getActiveUser().getEmail() || 'no-identificado'; }
  catch (e) { return 'no-identificado'; }
}
