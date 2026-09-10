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
  var prefijos = { 1: 's_', 2: 'b_', 3: 't3a_', 4: 'log_', 5: 'f_', 6: 'i_' };
  limpiarCampos(prefijos[num] || '');
  if (num === 3) limpiarCampos('t3b_');
  // Restaurar etiqueta Factura/Traslado segun tipo seleccionado
  if (num === 2) toggleLabelRecepcion();
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
   0B. MAPEO BODEGA → RUTA  (autocompletado dinamico)
   ═════════════════════════════════════════════════════════════════════════════════ */
var MAPPING_BODEGA_RUTA = {
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
  'M18 BUENAVENTURA VALLE DEL CAUCA': 'ZONA VALLE',
  'M180 RIOBLANCO TOLIMA': 'ZONA TOLIMA',
  'M181 ROVIRA TOLIMA': 'ZONA TOLIMA',
  'M182 SAN ANTONIO TOLIMA TOLIMA': 'ZONA TOLIMA',
  'M183 VILLAHERMOSA TOLIMA': 'ZONA TOLIMA',
  'M184 EL TAMBO CAUCA CAUCA': 'ZONA CAUCA SUR',
  'M185 SAN AGUSTIN HUILA HUILA': 'ZONA CAQUETA',
  'M188 PAEZ CAUCA': 'ZONA CAUCA CENTRO',
  'M189 CALDONO CAUCA': 'ZONA CAUCA NORTE',
  'M190 ALMAGUER CAUCA': 'ZONA CAUCA SUR',
  'M193 FLORENCIA CAUCA': 'ZONA CAUCA SUR',
  'M194 GUACHENE CAUCA': 'ZONA CAUCA NORTE',
  'M195 LA SIERRA CAUCA CAUCA': 'ZONA CAUCA SUR',
  'M197 PUERTO TEJADA CAUCA': 'ZONA CAUCA NORTE',
  'M20 JAMUNDI VALLE DEL CAUCA': 'ZONA VALLE',
  'M209 LA VIRGINIA RISARALDA RISARALDA': 'ZONA EJE CAFETERO',
  'M21 CARTAGO VALLE DEL CAUCA': 'ZONA VALLE',
  'M210 GUATICA RISARALDA': 'ZONA EJE CAFETERO',
  'M211 QUINCHIA RISARALDA': 'ZONA EJE CAFETERO',
  'M212 PUEBLO RICO RISARALDA RISARALDA': 'ZONA EJE CAFETERO',
  'M213 CALI VALLE DEL CAUCA': 'ZONA VALLE',
  'M214 PEREIRA CUBA RISARALDA': 'ZONA EJE CAFETERO',
  'M108 DOSQUEBRADAS RISARALDA': 'ZONA EJE CAFETERO',
  'M217 TULUA E.D VALLE DEL CAUCA': 'BODEGA VIRTUAL',
  'M218 SAN SEBASTIAN CAUCA CAUCA': 'ZONA CAUCA SUR',
  'M219 POPAYAN PARQUE INDUSTRIAL CAUCA': 'ZONA CAUCA CENTRO',
  'M223 CALI VALLE DEL CAUCA': 'ZONA VALLE',
  'M225 BUGA VALLE DEL CAUCA': 'ZONA VALLE',
  'SM226 ORTEGA TOLIMA': 'ZONA TOLIMA',
  'M235 POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'M239 PARATEBUENO CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M240 SAN JUAN DEL CESAR GUAJIRA': 'ZONA COSTA NORTE',
  'M241 FONSECA GUAJIRA': 'ZONA COSTA NORTE',
  'M244 TOCANCIPA CUNDINAMARCA': 'ZONA CUNDINAMARCA',
  'M249 PALMIRA VALLE DEL CAUCA': 'ZONA VALLE',
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
  'M286 CHIQUINQUIRA BOYACA': 'ZONA BOYACA',
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
  'M314 GUATEQUE GUATEQUE BOYACA': 'ZONA BOYACA',
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
  'M85 POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'M87 YUMBO VALLE DEL CAUCA': 'ZONA VALLE',
  'M88 GUACARI VALLE DEL CAUCA': 'ZONA VALLE',
  'M89 GINEBRA VALLE DEL CAUCA': 'ZONA VALLE',
  'M90 CERRITO VALLE DEL CAUCA': 'ZONA VALLE',
  'M91 CALIMA VALLE DEL CAUCA': 'ZONA VALLE',
  'M92 CANDELARIA VALLE DEL CAUCA': 'ZONA VALLE',
  'M93 PRADERA VALLE DEL CAUCA': 'ZONA VALLE',
  'M94 CALI VALLE DEL CAUCA': 'ZONA VALLE',
  'M95 POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'M96 SANTANDER CAUCA': 'ZONA CAUCA NORTE',
  'N31 MDF. SURTIDROGAS POPAYAN CAUCA': 'ZONA CAUCA CENTRO',
  'BOD. N40 BOGOTA MEDISFARMA SURTIDROGAS CUNDINAMARCA': 'BODEGA VIRTUAL',
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
  '02M FLORENCIA CAQUETA': 'ZONA CAQUETA',
  'M217 TULUA E.D VALLE DEL CAUCA': 'BODEGA VIRTUAL',
  'CASOS JURIDICOS': 'BODEGA VIRTUAL',
  'BOD. 80 FACTURACION': 'BODEGA VIRTUAL',
  'CENDIS PRINCIPAL TULUA PARQUE INDUSTRIAL': 'BODEGA VALLE',
  'B05 ALTO COSTO': 'BODEGA VALLE',
  'ST28 BODEGA LOGISTICA': 'BODEGA VIRTUAL',
  'URG01 MDF. URGENCIAS TULUA VALLE DEL CAUCA': 'BODEGA VIRTUAL',
  'B9 POPAYAN PARQUE INDUSTRIAL CAUCA': 'BODEGA',
  'M100 TUMACO NARIÑO': 'ZONA NARIÑO',
  'M245 BUCARAMANGA SANTANDER SANTANDER': 'ZONA CUNDINAMARCA',
  'M257 PEREIRA PINARES RISARALDA RISARALDA': 'LOCAL Y ACTIVOS'
};

/** Autocompletar Ruta segun Bodega Destino */
function autocompletarRuta(inputDestinoId, inputRutaId) {
  var destEl = $(inputDestinoId);
  var rutEl = $(inputRutaId);
  if (!destEl || !rutEl) return;
  var val = destEl.value.trim();
  // Busqueda exacta primero, luego parcial
  var ruta = MAPPING_BODEGA_RUTA[val] || '';
  if (!ruta) {
    // Busqueda parcial: coincide inicio del nombre (ej. 'M108' → 'M108 DOSQUEBRADAS...')
    var claves = Object.keys(MAPPING_BODEGA_RUTA);
    for (var i = 0; i < claves.length; i++) {
      if (claves[i].indexOf(val) === 0 || val.indexOf(claves[i]) === 0) {
        ruta = MAPPING_BODEGA_RUTA[claves[i]];
        break;
      }
    }
  }
  rutEl.value = ruta;
}

/* ═════════════════════════════════════════════════════════════════════════════════
   1. CONFIGURACION POR DEFECTO
   ═════════════════════════════════════════════════════════════════════════════════ */
var CONFIG_DEFAULT = {
  api_url: 'https://script.google.com/macros/s/AKfycbw51QDMGOSFM7HA3sWp0hsn-80v9obhoZSBZ7J3TCmhOF2Vsb1FuMMjyujkhbhGB1Oo/exec',
  fileIds: {
    trasladosEntrega: '1tkV0zSCigfxxukJ_Khdl-BYkw3Ex3tcGpiCS8gnGe_o'
  },
  folders: {
    trasladosConsulta: '1u30YFhTsocLuUoFrVUnb6Fk9zwVsT_E_',
    seguridad:        '1I8XfW5vjt5qFkhnd5m6anaUA9ETVHf_N',
    despachos:         '1tUXm2FVVFWBnyeBrzTlRpobYTKxk7OH8',
    asignacion:        '1tUXm2FVVFWBnyeBrzTlRpobYTKxk7OH8',
    logistica:         '1_e8ycbznm0jA4kOBwkJuXM4EVdcwXzYe',
    recepcion:         '1u5aQURkwKw4CqxejzOSxYgeF6dvcj-T0',
    facturacion:       '1hpRjykdlFyU_nsdXb0ttqOJdHNoXcTG-',
    inventario:        '11Iml2ggmvAK8aHeUbDGeWbyhLxCtrPoY',
    rotacion:          '106BTSHLA8giLcW8qkvbJWiqA_7KiDpBi',
    entrega:           '1tUXm2FVVFWBnyeBrzTlRpobYTKxk7OH8',
    backup:            '1HVTZyLasrbZArTN34kmc0lCKaQa2qQ_5'
  },
  perfiles: {
    seguridad:   { file: 'BD_SEGURIDAD_DESPACHOS',         sheet: 'DATOS' },
    despachos:   { file: 'BD_PLANILLA_ENTREGA_DESPACHOS',  sheet: 'DATOS' },
    asignacion:  { file: 'BD_ASIGNACION_DE_TRASLADO',    sheet: 'DATOS' },
    logistica:   { file: 'BD_LOGISTICA_DESPACHOS',        sheet: 'DATOS' },
    recepcion:   { file: 'BD_RECEPCION_TECNICA',          sheet: 'DATOS' },
    facturacion: { file: 'BD_CARGUE_FACTURA_TRANSPORTE',  sheet: 'DATOS' },
    inventario:  { file: 'BD_VERIFICACION_INVENTARIO',    sheet: 'DATOS' },
    novedades:   { file: 'BD_NOVEDADES_MODIFICACIONES',   sheet: 'DATOS' },
    rotacion:    { file: 'BD_ROTACION_DIARIA',            sheet: 'DATOS' },
    entrega:     { fileId: '1xC5Nj2VMNgh6N5XIfMTN-aJ2i8nQExANAEhgthWRNpU', sheet: 'DATOS', gid: 1372653954 }
  },
  conductores: ['DIEGO CASTELLANOS', 'WILFER PEREZ', 'JEFFERSON DAZA', 'CARLOS RINCON', 'JORGE CACERES', 'JHONATAN BUSTOS', 'EDINSON JAIR SANCHEZ', 'ELKIN MAZABUEL', 'ALEX YAIRO ANGUCHO', 'BRAYANT TUMINA', 'JOSE LUIS GIRALDO', 'MARVIN URRUTIA', 'ALEXANDER OSORIO', 'SEBASTIAN MORENO', 'SEBASTIAN BOHORQUEZ', 'YEISON CORRALES', 'JOHN ALEXANDER GUTIERREZ', 'HENRY CORONADO', 'MARCOS MEJIA', 'JULIO MERCADO', 'JULIAN CHAVEZ', 'SANTIAGO MANZANO MEXT', 'DIEGO JARAMILLO MEXT', 'JULIAN GONZALEZ', 'EDITH RIVERA MEXT', 'SEBASTIAN MORALES', 'JESSICA ROLON', 'JENNY SIN INFORMACION CONDUCTOR', 'JORGE JARAMILLO CONDUCTOR EXTERNO', 'RUBEN ELIECER GRISALES CONDUCTOR EXTERNO', 'JUAN DIEGO GARCIA EXT', 'ANULADO', 'SUPERVISORES REVISAR', 'DEIBI ESPITIA EXT', 'GELVER MARIN GRANDA', 'ELKIN DUQUE EXT', 'JOHN RUEDA', 'BRYAN CIFUENTES']
};

/* ═════════════════════════════════════════════════════════════════════════════════
   2. CREDENCIALES Y PERFILES DE ACCESO
   ═════════════════════════════════════════════════════════════════════════════════ */
var CREDENCIALES = {
  administrador: 'Medis2024Admin',
  lider: 'Medis2024Lider',
  auxiliar_entrega: 'Medis2024Aux',
  recibido_logistica: 'Medis2024Recib',
  planillar_logistica: 'Medis2024Plan',
  log_diego: 'Medis2024DiegoL',
  log_angelica: 'Medis2024AngelicaL',
  log_lorena: 'Medis2024LorenaL',
  log_jenny: 'Medis2024JennyL'
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
  log_diego: '&#128666; Diego (Logistica)',
  log_angelica: '&#128666; Angelica (Logistica)',
  log_lorena: '&#128666; Lorena (Logistica)',
  log_jenny: '&#128666; Jenny (Logistica)',
  auxiliar: '&#128119; AUXILIAR'
};

/* Perfiles y sus tarjetas visibles (reordenadas) */
var PERFILES = {
  administrador:           { label: 'Administrador',   tarjetas: ['t1','t2','t3','t4','t5','t6'] },
  lider:                  { label: 'Lider',           tarjetas: ['t1','t3'] },
  auxiliar_entrega:       { label: 'Auxiliar Entrega', tarjetas: ['t3'] },
  recibido_logistica:     { label: 'Recibido Log',     tarjetas: ['t4'] },
  planillar_logistica:    { label: 'Planillar Log',    tarjetas: ['t3','t4'] },
  log_diego:              { label: 'Diego Logistica',  tarjetas: ['t4'] },
  log_angelica:           { label: 'Angelica Logistica', tarjetas: ['t4'] },
  log_lorena:             { label: 'Lorena Logistica', tarjetas: ['t4'] },
  log_jenny:              { label: 'Jenny Logistica',  tarjetas: ['t4'] },
  auxiliar:               { label: 'Auxiliar',         tarjetas: ['t1','t2','t3'] }
};

/* Modulos (orden de carpetas/backend) */
var MODULOS = ['seguridad','recepcion','asignacion','entrega','despachos','logistica','facturacion','inventario'];

/* ═════════════════════════════════════════════════════════════════════════════════
   3. CONFIGURACION EN MEMORIA + GUARDADO EN LOCALSTORAGE
   ═════════════════════════════════════════════════════════════════════════════════ */
var CONFIG = {};
function cargarConfig() {
  var saved = localStorage.getItem('MF_CARGUE_CONFIG');
  CONFIG = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(CONFIG_DEFAULT));
  if (!CONFIG.folders.seguridad) CONFIG.folders.seguridad = CONFIG_DEFAULT.folders.seguridad;
  if (!CONFIG.folders.rotacion)  CONFIG.folders.rotacion  = CONFIG_DEFAULT.folders.rotacion;
  if (!CONFIG.folders.entrega)   CONFIG.folders.entrega   = CONFIG_DEFAULT.folders.entrega;
  if (!CONFIG.folders.asignacion) CONFIG.folders.asignacion = CONFIG_DEFAULT.folders.asignacion;
  if (!CONFIG.perfiles.entrega)  CONFIG.perfiles.entrega  = CONFIG_DEFAULT.perfiles.entrega;
  if (!CONFIG.perfiles.asignacion) CONFIG.perfiles.asignacion = CONFIG_DEFAULT.perfiles.asignacion;
  if (!CONFIG.conductores || !CONFIG.conductores.length) CONFIG.conductores = CONFIG_DEFAULT.conductores.slice();
  if (!CONFIG.fileIds) CONFIG.fileIds = JSON.parse(JSON.stringify(CONFIG_DEFAULT.fileIds));
  if (!CONFIG.fileIds.trasladosEntrega) CONFIG.fileIds.trasladosEntrega = CONFIG_DEFAULT.fileIds.trasladosEntrega;
  /* URL fija — siempre sobreescribir con el valor por defecto */
  CONFIG.api_url = CONFIG_DEFAULT.api_url;
  var el = $('cfg_api_url'); if (el) { el.value = CONFIG.api_url; el.readOnly = true; el.style.opacity = '0.65'; el.title = 'URL fija — no editable'; }
  var fb = $('cfg_folder_backup'); if (fb) fb.value = CONFIG.folders.backup || '';
  var cc = $('cfg_conductores'); if (cc) cc.value = (CONFIG.conductores || []).join('\n');
}
function guardarConfig() {
  /* URL fija — ignorar lo que diga el campo, siempre usar default */
  CONFIG.api_url = CONFIG_DEFAULT.api_url;
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
/* Usar POST para TODAS las llamadas (GET causa CORS redirect en GAS ContentService)
 * doPost en Code.gs soporta las mismas acciones que doGet.
 */
function apiGet(params) {
  return apiPost(params);
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

/** Alterna etiqueta del campo b_traslado: EXTERNA → "Factura", INTERNA → "Traslado" */
function toggleLabelRecepcion() {
  var tipo = document.querySelector('input[name="tipoRecepcion"]:checked');
  var esExterna = tipo && tipo.value === 'EXTERNA';
  var lbl = $('lbl_doc_recepcion');
  var inp = $('b_traslado');
  if (lbl) {
    lbl.textContent = esExterna ? 'Factura *' : 'Traslado *';
    lbl.className = 'form-label rec-doc-label ' + (esExterna ? 'externa' : 'interna');
  }
  if (inp) inp.placeholder = esExterna ? 'Numero de factura' : 'Numero de traslado';
}

function t2AgregarItem() {
  var tipo = document.querySelector('input[name="tipoRecepcion"]:checked');
  tipo = tipo ? tipo.value : 'EXTERNA';
  var esExterna = tipo === 'EXTERNA';
  var docNum = $('b_traslado') ? $('b_traslado').value.trim() : '';
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

  if (!docNum || !codigo || !descripcion || !lote || !vencimiento || !enviada || !recibida || !responsable) {
    var campoFaltante = esExterna ? 'Factura' : 'Traslado';
    showToast('Complete los campos obligatorios de recepcion (incluyendo ' + campoFaltante + ').', 'danger');
    return;
  }

  var item = {
    'Tipo Recepcion': tipo,
    'Documento Recepcion': esExterna ? 'Factura' : 'Traslado',
    'Numero Documento': docNum,
    'Bodega Origen': bodegaOrigen,
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
  var cols = ['Tipo', 'Doc.', 'Codigo', 'Descripcion', 'Lote', 'Venc.', 'Enviada', 'Recibida', 'Dif.', 'Estado', 'Acc'];
  head.innerHTML = cols.map(function (c) { return '<th>' + c + '</th>'; }).join('');
  body.innerHTML = '';
  t2Items.forEach(function (item, idx) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + (item['Tipo Recepcion'] || '') + '</td>' +
      '<td><small class="text-muted">' + (item['Documento Recepcion'] || '') + '</small> ' + (item['Numero Documento'] || '') + '</td>' +
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
   8. TARJETA 3 — PLANILLA ENTREGA DESPACHOS (DOS SECCIONES: A + B)
   ═════════════════════════════════════════════════════════════════════════════════
   Seccion A = Asignacion de Traslado (Paso 1 — Obligatorio)
   Seccion B = Entrega a Logistica   (Paso 2 — Depende de A)
   ═════════════════════════════════════════════════════════════════════════════════ */
var t3aTrasladoValidado = null;  // Seccion A: traslado validado en trasladosConsulta
var t3bTrasladoValidado = null;  // Seccion B: asignacion validada + datos consolidados
var logTrasladoValidado = null;  // Logistica: traslado validado en trasladosConsulta
var t3RotacionHoy = null;

/** Utilidad: seleccionar opcion en un <select> por texto visible */
function seleccionarOpcion(selectId, nombre) {
  var sel = $(selectId);
  if (!sel || !nombre) return;
  var opts = sel.options;
  for (var i = 0; i < opts.length; i++) {
    if (opts[i].textContent.trim() === nombre) { sel.selectedIndex = i; break; }
  }
}

/** Carga la rotacion del dia desde el backend para pre-llenar campos */
function t3CargarRotacion() {
  var folderId = CONFIG.folders.rotacion;
  var fecha = hoy();
  apiGet({ action: 'leerRotacion', folderId: folderId, fecha: fecha })
    .then(function (r) {
      if (r && r.ok && r.asignaciones && r.asignaciones.length) {
        t3RotacionHoy = r.asignaciones;
        t3AplicarRotacionA();
      } else {
        t3RotacionHoy = null;
      }
    })
    .catch(function () { t3RotacionHoy = null; });
}

/** Asigna automaticamente el GRUPO ASIGNADO segun Bodega Origen.
 *  Si Bodega Origen contiene "B05 ALTO COSTO" → Grupo Especial Gris con TODOS sus integrantes.
 *  Si Bodega Origen contiene "CENDIS PRINCIPAL TULUA PARQUE INDUSTRIAL" → Grupo de la Apertura del Dia con sus integrantes.
 *  El campo muestra: "Grupo Color (N) — Nombre1, Nombre2, Nombre3"
 *  Ese mismo texto se persiste en BD_ASIGNACION_DE_TRASLADO.
 */
function t3AplicarRotacionA() {
  var bodega = $('t3a_bodega_origen') ? $('t3a_bodega_origen').value.trim() : '';
  var grupoSelect = $('t3a_grupo_asignado');
  var esB05AltoCosto = bodega.toUpperCase().indexOf('B05 ALTO COSTO') >= 0;
  var esCendis = bodega.toUpperCase().indexOf('CENDIS PRINCIPAL TULUA PARQUE INDUSTRIAL') >= 0;

  if (esB05AltoCosto) {
    // ── Grupo Especial Gris (8) — UNA persona aleatoria del grupo ──
    var grupoGris = GRUPOS_FIJOS_CARGUE.filter(function (g) { return g.nombre === 'Gris'; })[0];
    if (grupoGris) {
      var idx = Math.floor(Math.random() * grupoGris.miembros.length);
      var personaAleatoria = grupoGris.miembros[idx];
      var textoGris = 'Grupo Especial Gris (8) — ' + personaAleatoria;
      // Seleccionar la opcion de Gris en el select y personalizar texto
      if (grupoSelect) {
        // Buscar la opcion de Gris
        for (var i = 0; i < grupoSelect.options.length; i++) {
          if (grupoSelect.options[i].value.indexOf('Gris') >= 0) {
            grupoSelect.options[i].value = textoGris;
            grupoSelect.options[i].textContent = 'Especial Gris (8) — ' + personaAleatoria;
            grupoSelect.selectedIndex = i;
            grupoSelect.style.borderColor = grupoGris.hex;
            grupoSelect.style.color = grupoGris.hex;
            break;
          }
        }
      }
    }
  } else if (esCendis) {
    // ── Grupo de la Apertura del Dia — preseleccionar grupo automaticamente ──
    if (t3RotacionHoy && t3RotacionHoy.length) {
      var gruposNoGris = {};
      t3RotacionHoy.forEach(function (a) {
        if (a.grupo !== 'Gris' && a.grupo) {
          if (!gruposNoGris[a.grupo]) gruposNoGris[a.grupo] = [];
          gruposNoGris[a.grupo].push(a.nombre);
        }
      });
      var grupoNombre = '';
      var claves = Object.keys(gruposNoGris);
      for (var i = 0; i < claves.length; i++) {
        if (gruposNoGris[claves[i]].length >= 3) {
          grupoNombre = claves[i];
          break;
        }
      }
      if (grupoNombre) {
        var grupoInfo = GRUPOS_FIJOS_CARGUE.filter(function (g) { return g.nombre === grupoNombre; })[0];
        if (grupoSelect && grupoInfo) {
          for (var j = 0; j < grupoSelect.options.length; j++) {
            if (grupoSelect.options[j].value.indexOf(grupoNombre) >= 0) {
              grupoSelect.selectedIndex = j;
              grupoSelect.style.borderColor = grupoInfo.hex;
              grupoSelect.style.color = grupoInfo.hex;
              break;
            }
          }
        }
      } else {
        // Fallback: primer grupo no-Gris
        var noGris = t3RotacionHoy.filter(function (a) { return a.grupo !== 'Gris'; });
        if (noGris.length && grupoSelect) {
          var fbGrupo = noGris[0].grupo;
          var fbInfo = GRUPOS_FIJOS_CARGUE.filter(function (g) { return g.nombre === fbGrupo; })[0];
          if (fbInfo) {
            for (var k = 0; k < grupoSelect.options.length; k++) {
              if (grupoSelect.options[k].value.indexOf(fbGrupo) >= 0) {
                grupoSelect.selectedIndex = k;
                grupoSelect.style.borderColor = fbInfo.hex;
                grupoSelect.style.color = fbInfo.hex;
                break;
              }
            }
          }
        }
      }
    }
  } else {
    // Bodega no reconocida — grupo aleatorio como sugerencia
    if (grupoSelect && bodega) {
      var idxRand = 1 + Math.floor(Math.random() * 7); // 1-7 (excluye Gris)
      var opciones = grupoSelect.options;
      for (var m = 1; m < opciones.length - 1; m++) { // saltar placeholder y Gris
        var optGrupo = opciones[m].value;
        var optInfo = GRUPOS_FIJOS_CARGUE.filter(function (g) { return optGrupo.indexOf(g.nombre) >= 0; })[0];
        if (optInfo && optInfo.numero === idxRand) {
          grupoSelect.selectedIndex = m;
          grupoSelect.style.borderColor = optInfo.hex;
          grupoSelect.style.color = optInfo.hex;
          break;
        }
      }
    } else if (grupoSelect) {
      grupoSelect.selectedIndex = 0;
      grupoSelect.style.borderColor = '';
      grupoSelect.style.color = '';
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────────
   7C. GRUPOS FIJOS CARGUE — Definicion de los 8 grupos con miembros
   ───────────────────────────────────────────────────────────────────────────────── */
var GRUPOS_FIJOS_CARGUE = [
  { nombre: 'Rojo',    numero: 1, hex: '#dc3545', miembros: ['Nicoll Trivi\u00f1o', 'Estefania Parra', 'Angie Mar\u00eda Tascon'], lider: 'Angie Mar\u00eda Tascon' },
  { nombre: 'Naranja', numero: 2, hex: '#FF8C00', miembros: ['Daniela Nore\u00f1a', 'Juan David Moreno', 'Kelly Beltran'] },
  { nombre: 'Azul',    numero: 3, hex: '#0d6efd', miembros: ['Karina Riascos', 'Ana Lorena Ortiz', 'Vaneza Escobar'] },
  { nombre: 'Verde',   numero: 4, hex: '#2fb457', miembros: ['Leidy Valencia', 'Bivian Lorena Rivera', 'Brayan Camilo Izquierdo'] },
  { nombre: 'Morado',  numero: 5, hex: '#6f42c1', miembros: ['Jhony Saenz', 'Natalia Galvez', 'Valentina Cano'] },
  { nombre: 'Amarillo',numero: 6, hex: '#ffc107', miembros: ['Liz Karime Valencia', 'Angela Vanessa Aguirre', 'Derly Yulieth Mosquera'] },
  { nombre: 'Fucsia',  numero: 7, hex: '#FF00FF', miembros: ['Manuel David Salazar', 'Luz Nelly Chaves', 'Luis Felipe Marin'], lider: 'Luz Nelly Chaves' },
  { nombre: 'Gris',    numero: 8, hex: '#6c757d', miembros: ['Claudia Echeverry', 'Camila Posada', 'Angela Vera', 'Mayra Alejandra Franco', 'Andrea Vanegas'], lider: 'Andrea Vanegas' }
];

/* ── Listener de cambio en Grupo Asignado — colorea el select al cambiar manualmente ── */
(function initGrupoSelectListener() {
  var gs = $('t3a_grupo_asignado');
  if (!gs) return;
  gs.addEventListener('change', function () {
    var val = this.value || '';
    var hex = '';
    for (var i = 0; i < GRUPOS_FIJOS_CARGUE.length; i++) {
      if (val.indexOf(GRUPOS_FIJOS_CARGUE[i].nombre) >= 0) {
        hex = GRUPOS_FIJOS_CARGUE[i].hex; break;
      }
    }
    this.style.borderColor = hex || '';
    this.style.color = hex || '';
    this.style.fontWeight = hex ? 'bold' : '';
  });
})();

/* ── Auto-asignar grupo aleatorio al cargar la pagina ── */
function autoAsignarGrupoAleatorio() {
  var gs = $('t3a_grupo_asignado');
  if (!gs) return;
  // Elegir grupo aleatorio entre 1 y 8 (incluyendo Gris)
  var numGrupo = 1 + Math.floor(Math.random() * 8);
  var grupoInfo = null;
  for (var i = 0; i < GRUPOS_FIJOS_CARGUE.length; i++) {
    if (GRUPOS_FIJOS_CARGUE[i].numero === numGrupo) { grupoInfo = GRUPOS_FIJOS_CARGUE[i]; break; }
  }
  if (!grupoInfo) return;
  // Para Gris: personalizar con una persona aleatoria
  if (grupoInfo.nombre === 'Gris') {
    var idx = Math.floor(Math.random() * grupoInfo.miembros.length);
    var persona = grupoInfo.miembros[idx];
    var textoGris = 'Grupo Especial Gris (8) \u2014 ' + persona;
    for (var j = 0; j < gs.options.length; j++) {
      if (gs.options[j].value.indexOf('Gris') >= 0) {
        gs.options[j].value = textoGris;
        gs.options[j].textContent = 'Especial Gris (8) \u2014 ' + persona;
        gs.selectedIndex = j;
        gs.style.borderColor = grupoInfo.hex;
        gs.style.color = grupoInfo.hex;
        gs.style.fontWeight = 'bold';
        break;
      }
    }
  } else {
    // Para los demas grupos: seleccionar la opcion correspondiente
    for (var k = 0; k < gs.options.length; k++) {
      if (gs.options[k].value.indexOf(grupoInfo.nombre) >= 0) {
        gs.selectedIndex = k;
        gs.style.borderColor = grupoInfo.hex;
        gs.style.color = grupoInfo.hex;
        gs.style.fontWeight = 'bold';
        break;
      }
    }
  }
  // Mostrar toast informativo
  showToast('Grupo asignado autom\u00e1ticamente: <strong>' + grupoInfo.nombre + '</strong> — Puedes cambiarlo si deseas.', 'info');
}

/* ── Normalizar Grupo Asignado — convierte numero o texto corto al formato completo del select ── */
function normalizarGrupoAsignado(valorRaw) {
  if (!valorRaw) return '';
  var v = String(valorRaw).trim();
  // Si ya tiene el formato completo (contiene "Grupo"), devolverlo tal cual
  if (v.indexOf('Grupo') >= 0) return v;
  // Si es solo un numero (1-8), convertir al formato completo
  var num = parseInt(v, 10);
  if (isNaN(num) || num < 1 || num > 8) return v;
  var grupo = null;
  for (var i = 0; i < GRUPOS_FIJOS_CARGUE.length; i++) {
    if (GRUPOS_FIJOS_CARGUE[i].numero === num) { grupo = GRUPOS_FIJOS_CARGUE[i]; break; }
  }
  if (!grupo) return v;
  // Para Gris (8): agregar una persona aleatoria
  if (grupo.nombre === 'Gris') {
    var idx = Math.floor(Math.random() * grupo.miembros.length);
    var persona = grupo.miembros[idx];
    return 'Grupo Especial Gris (8) \u2014 ' + persona;
  }
  // Para los demas: formato completo con miembros
  return 'Grupo ' + grupo.nombre + ' (' + grupo.numero + ') \u2014 ' + grupo.miembros.join(', ');
}

/* ─────────────────────────────────────────────────────────────────────────────────
   8A. SECCION A — ASIGNACION DE TRASLADO (Paso 1)
   Busca en la carpeta trasladosConsulta, autocompleta campos bloqueados,
   carga la rotacion del dia, y guarda en BD_ASIGNACION_DE_TRASLADO.
   ───────────────────────────────────────────────────────────────────────────────── */
function t3aValidarTraslado() {
  var traslado = $('t3a_traslado') ? $('t3a_traslado').value.trim() : '';
  if (!traslado) { showToast('Ingrese el numero de traslado (completo o ultimos 5 digitos).', 'danger'); return; }
  var folderId = CONFIG.folders.trasladosConsulta;
  var estado = $('t3a_estadoTraslado');
  if (estado) estado.innerHTML = '<span class="badge bg-warning text-dark">Buscando...</span>';

  apiGet({ action: 'buscarTraslado', folderId: folderId, modulo: 'despachos', traslado: traslado })
    .then(function (r) {
      if (r && r.encontrado && r.registro) {
        t3aTrasladoValidado = r.registro;
        var reg = r.registro;
        var tipoMatch = reg.__tipoCoincidencia || 'exacta';
        var numCoincidencias = reg.__coincidencias || 1;
        var numExactas = reg.__coincidenciasExactas || 0;
        var digitosBuscados = reg.__buscadoDigitos || '';

        // Mapeo de cabeceras → campos Seccion A
        // Alias extendidos: la carpeta de traslados usa cabeceras con punto final
        //   Traslado = Documento,  Fecha = Fecha.,  Bodega Origen = Bodega Origen.,  Bodega Destino = Bodega Destino.
        var campos = {
          't3a_traslado_mostrar': ['Traslado', 'Documento', 'Documento Traslado', 'Numero Traslado'],
          't3a_fecha': ['Fecha', 'Fecha.', 'Marca temporal'],
          't3a_bodega_origen': ['Bodega Origen', 'Bodega Origen.', 'Bodega'],
          't3a_destino': ['Bodega Destino', 'Bodega Destino.', 'Destino'],
          't3a_ruta': ['Zona', 'Ruta'],
          't3a_codigo': ['Codigo', 'Codigo Producto'],
          't3a_descripcion': ['Descripcion'],
          't3a_unidades': ['Unidades'],
          't3a_recibido': ['Recibido', 'Quien Recibe'],
          't3a_usuario': ['Usuario', 'Correo'],
          't3a_lote': ['Lote'],
          't3a_fechaVenc': ['Fecha Vencimiento', 'Vencimiento'],
          't3a_observaciones_drive': ['Observacion', 'Observaciones'],
          't3a_concepto': ['Concepto', 'CONCEPTO']
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

        // ── Urgente: marcar automaticamente segun CONCEPTO ──
        // Conceptos que siempre son Urgente: TUTELAS, DESACATO, PQRS, JORNADAS, ORDEN DE ARRESTO, SANCION
        var conceptoVal = $('t3a_concepto') ? $('t3a_concepto').value.trim().toUpperCase() : '';
        var CONCEPTOS_URGENTES = ['TUTELAS', 'DESACATO', 'PQRS', 'JORNADAS', 'ORDEN DE ARRESTO', 'SANCION'];
        var esConceptoUrgente = false;
        for (var ci = 0; ci < CONCEPTOS_URGENTES.length; ci++) {
          if (conceptoVal === CONCEPTOS_URGENTES[ci] || conceptoVal.indexOf(CONCEPTOS_URGENTES[ci]) >= 0) {
            esConceptoUrgente = true;
            break;
          }
        }

        // Urgente: autocompletar select — prioridad: Concepto urgente > campo Urgente del registro > NO
        if (esConceptoUrgente) {
          seleccionarOpcion('t3a_urgente', 'SI');
          if ($('t3a_badgeUrgente')) $('t3a_badgeUrgente').innerHTML = '<span class="badge bg-danger">&#9888; URGENTE (auto por Concepto: ' + conceptoVal + ')</span>';
        } else if (reg['Urgente'] === 'SI' || reg['Urgente'] === 'Si' || reg['Urgente'] === 'si' || reg['urgente'] === 'SI') {
          seleccionarOpcion('t3a_urgente', 'SI');
          if ($('t3a_badgeUrgente')) $('t3a_badgeUrgente').innerHTML = '<span class="badge bg-danger">&#9888; URGENTE</span>';
        } else {
          seleccionarOpcion('t3a_urgente', 'NO');
          if ($('t3a_badgeUrgente')) $('t3a_badgeUrgente').innerHTML = '';
        }
        // Nota: el usuario siempre puede cambiar manualmente el select Urgente despues de la auto-asignacion.

        // Punto de captura — muestra traslado general (completo)
        // Alias: 'Traslado' = 'Documento' en la carpeta de traslados
        var trasladoCompleto = reg['Traslado'] || reg['Documento'] || reg['Documento Traslado'] || reg['Numero Traslado'] || traslado;
        // Actualizar el campo de entrada con el traslado completo
        if ($('t3a_traslado')) $('t3a_traslado').value = trasladoCompleto;
        if ($('t3a_punto_captura')) $('t3a_punto_captura').value = trasladoCompleto;
        if ($('t3a_punto_row')) $('t3a_punto_row').style.display = '';
        if ($('t3a_punto_info')) $('t3a_punto_info').innerHTML = '<span class="badge bg-success">&#9989; Traslado capturado</span>';

        // Autocompletar Ruta segun Bodega Destino
        autocompletarRuta('t3a_destino', 't3a_ruta');

        // Mensaje detallado del tipo de coincidencia
        var msgMatch = '';
        if (tipoMatch === 'exacta') {
          msgMatch = 'Traslado <strong>' + traslado + '</strong> encontrado (coincidencia exacta).';
        } else {
          var digitosInfo = digitosBuscados ? ' Digitos buscados: <strong>' + digitosBuscados + '</strong>.' : '';
          msgMatch = 'Coincidencia numerica parcial (<strong>' + traslado + '</strong>).' + digitosInfo + ' Se selecciono el primer resultado.';
        }
        if (numCoincidencias > 1) {
          msgMatch += ' <span class="text-warning">(' + numCoincidencias + ' coincidencias totales';
          if (numExactas > 0) msgMatch += ', ' + numExactas + ' exacta(s)';
          msgMatch += ')</span>';
        }

        if (estado) estado.innerHTML = '<span class="badge bg-success">&#9989; Encontrado</span>';
        showToast(msgMatch, 'success');

        // Cargar rotacion del dia para pre-llenar Grupo
        t3CargarRotacion();
      } else {
        t3aTrasladoValidado = null;
        if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; No encontrado</span>';
        var msgNo = (r && r.mensaje) ? r.mensaje : 'Traslado no encontrado en la base de datos de origen.';
        // Mensaje diagnostico si hay archivos XLSX que no se pudieron leer
        if (r && r.archivosXlsx && r.archivosXlsx > 0 && r.archivosEscaneados === 0) {
          msgNo += ' La carpeta tiene ' + r.archivosXlsx + ' archivo(s) Excel que NO se pudieron convertir. ' +
            'Verifique que Drive API este habilitado en Recursos > Servicios avanzados > Drive API. ' +
            'El sistema intentara usar SheetJS como alternativa.';
        }
        if (r && r.archivosConError && r.archivosConError.length > 0) {
          msgNo += ' Archivos con error: ' + r.archivosConError.join(', ') + '.';
        }
        showToast(msgNo, 'danger');
      }
    })
    .catch(function (err) {
      t3aTrasladoValidado = null;
      if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; Error</span>';
      showToast('Error al buscar traslado: ' + err.message, 'danger');
    });
}

function t3aGuardarAsignacion() {
  var trasladoInput = $('t3a_traslado') ? $('t3a_traslado').value.trim() : '';
  if (!trasladoInput) { showToast('Primero valide un traslado en la Seccion A.', 'danger'); return; }
  if (!t3aTrasladoValidado) { showToast('Valide el traslado antes de guardar la Asignacion.', 'danger'); return; }
  // Usar el traslado COMPLETO de la API (no solo los digitos que escribio el usuario)
  var trasladoCompletoGuardar = t3aTrasladoValidado['Traslado'] || t3aTrasladoValidado['Documento'] || t3aTrasladoValidado['Documento Traslado'] || t3aTrasladoValidado['Numero Traslado'] || trasladoInput;

  var folderId = $('folder_asignacion') ? $('folder_asignacion').value.trim() : CONFIG.folders.asignacion;
  if (!folderId) { showToast('Configure la carpeta Drive de Asignaci&oacute;n.', 'danger'); return; }

  var urgenteVal = $('t3a_urgente') ? $('t3a_urgente').value : '';
  var concepto = $('t3a_concepto') ? $('t3a_concepto').value.trim() : '';
  var grupoAsignado = $('t3a_grupo_asignado') ? $('t3a_grupo_asignado').value : '';

  if (!grupoAsignado) {
    showToast('No se ha asignado un grupo. Verifique la Bodega Origen.', 'danger'); return;
  }
  if (!urgenteVal) { showToast('Seleccione si es Urgente (SI/NO).', 'danger'); return; }

  // VALIDAR DUPLICADO: verificar que el traslado no exista ya en BD_ASIGNACION_DE_TRASLADO
  var btnGuardar = $('t3a_btnGuardar');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = 'Verificando...'; }

  apiGet({ action: 'buscarAsignacion', folderId: folderId, traslado: trasladoCompletoGuardar })
    .then(function (rExist) {
      if (rExist && rExist.encontrado) {
        showToast('&#9888; El traslado <strong>' + trasladoCompletoGuardar + '</strong> ya tiene una Asignaci&oacute;n guardada. No se puede repetir.', 'danger');
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar en el Drive Asignaci\u00f3n de Traslado'; }
        return null; // senal para no continuar
      }

      var registro = {
        'Documento Traslado': trasladoCompletoGuardar,
        'Fecha': $('t3a_fecha') ? $('t3a_fecha').value : '',
        'Bodega Origen': $('t3a_bodega_origen') ? $('t3a_bodega_origen').value : '',
        'Bodega Destino': $('t3a_destino') ? $('t3a_destino').value : '',
        'Ruta': $('t3a_ruta') ? $('t3a_ruta').value : '',
        'Zona': $('t3a_ruta') ? $('t3a_ruta').value : '',
        'Urgente': urgenteVal,
        'Grupo Asignado': grupoAsignado,
        'Concepto': concepto,
        'Recibido': $('t3a_recibido') ? $('t3a_recibido').value : '',
        'Observacion Drive': $('t3a_observaciones_drive') ? $('t3a_observaciones_drive').value : '',
        'Marca temporal': ahora(),
        'Perfil': perfilActivo(),
        'Usuario': nombreUsuario()
      };

      return apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'asignacion', registro: registro });
    })
    .then(function (r) {
      if (r === null) return; // duplicado, ya se mostro error
      if (r && r.ok) {
        showToast('&#128190; <strong>Asignaci&oacute;n de Traslado</strong> guardada en Drive.', 'success');
        t3aTrasladoValidado = null;
        limpiarSeccionA();
      } else {
        showToast('Error al guardar Asignaci&oacute;n: ' + (r.error || ''), 'danger');
      }
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar en el Drive Asignaci\u00f3n de Traslado'; }
    })
    .catch(function (err) {
      showToast('Error de conexion: ' + err.message, 'danger');
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar en el Drive Asignaci\u00f3n de Traslado'; }
    });
}

function limpiarSeccionA() {
  limpiarCampos('t3a_');
  var ga = $('t3a_grupo_asignado');
  if (ga) {
    ga.style.borderColor = ''; ga.style.color = ''; ga.style.fontWeight = '';
    // Restaurar opcion Gris a su valor/texto por defecto (B05 la modifica dinamicamente)
    for (var i = 0; i < ga.options.length; i++) {
      if (ga.options[i].value.indexOf('Gris') >= 0) {
        ga.options[i].value = 'Grupo Especial Gris (8)';
        ga.options[i].textContent = 'Especial Gris (8) \u2014 Alto Costo';
        break;
      }
    }
    // Reset al placeholder (sin grupo seleccionado)
    ga.selectedIndex = 0;
    ga.style.borderColor = '';
    ga.style.color = '';
    ga.style.fontWeight = '';
  }
  if ($('t3a_punto_row')) $('t3a_punto_row').style.display = 'none';
  if ($('t3a_estadoTraslado')) $('t3a_estadoTraslado').innerHTML = '';
  if ($('t3a_badgeUrgente')) $('t3a_badgeUrgente').innerHTML = '';
  t3aTrasladoValidado = null;
}

/* ─────────────────────────────────────────────────────────────────────────────────
   8B. SECCION B — ENTREGA A LOGISTICA (Paso 2 — Depende de A)
   1. Verifica que el traslado exista en BD_ASIGNACION_DE_TRASLADO (buscarAsignacion).
   2. Si existe, trae los datos de la asignacion (Urgente, Grupo, Concepto).
   3. Luego busca el traslado en la hoja consolidada de despachos para
      autocompletar campos bloqueados.
   4. El usuario completa Responsable Entrega CENDIS, Cantidad, Tipo Carga.
   5. Guarda en BD_ENTREGA_A_LOGISTICA (modulo 'entrega').
   ───────────────────────────────────────────────────────────────────────────────── */
function t3bValidarTraslado() {
  var traslado = $('t3b_traslado') ? $('t3b_traslado').value.trim() : '';
  if (!traslado) { showToast('Ingrese el numero de traslado asignado.', 'danger'); return; }

  var folderId = $('folder_asignacion') ? $('folder_asignacion').value.trim() : CONFIG.folders.asignacion;
  if (!folderId) { showToast('Configure la carpeta Drive de Asignaci&oacute;n.', 'danger'); return; }

  var estado = $('t3b_estadoTraslado');
  if (estado) estado.innerHTML = '<span class="badge bg-warning text-dark">Verificando asignaci&oacute;n...</span>';

  // PASO 1: Verificar que el traslado fue asignado (existe en BD_ASIGNACION_DE_TRASLADO)
  apiGet({ action: 'buscarAsignacion', folderId: folderId, traslado: traslado })
    .then(function (rAsig) {
      if (!rAsig || !rAsig.encontrado || !rAsig.registro) {
        // No se encontro asignacion — bloquear
        t3bTrasladoValidado = null;
        if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; Sin asignaci&oacute;n</span>';
        showToast('El traslado <strong>' + traslado + '</strong> no ha completado el paso de Asignaci&oacute;n de Traslado.', 'danger');
        return;
      }

      // Asignacion encontrada — autocompletar campos bloqueados de Seccion B
      // Alias con punto final: Bodega Origen = Bodega Origen., Bodega Destino = Bodega Destino.
      var asig = rAsig.registro;
      if ($('t3b_bodega_origen')) $('t3b_bodega_origen').value = asig['Bodega Origen'] || asig['Bodega Origen.'] || '';
      if ($('t3b_destino')) $('t3b_destino').value = asig['Bodega Destino'] || asig['Bodega Destino.'] || '';
      if ($('t3b_ruta')) $('t3b_ruta').value = asig['Ruta'] || asig['Zona'] || '';
      if ($('t3b_concepto')) $('t3b_concepto').value = asig['Concepto'] || '';

      // ── Urgente Seccion B: auto segun Concepto ──
      var conceptoValB = $('t3b_concepto') ? $('t3b_concepto').value.trim().toUpperCase() : '';
      var esConceptoUrgenteB = false;
      var CONCEPTOS_URGENTES_B = ['TUTELAS', 'DESACATO', 'PQRS', 'JORNADAS', 'ORDEN DE ARRESTO', 'SANCION'];
      for (var ciB = 0; ciB < CONCEPTOS_URGENTES_B.length; ciB++) {
        if (conceptoValB === CONCEPTOS_URGENTES_B[ciB] || conceptoValB.indexOf(CONCEPTOS_URGENTES_B[ciB]) >= 0) {
          esConceptoUrgenteB = true; break;
        }
      }
      if (esConceptoUrgenteB) {
        if ($('t3b_urgente')) $('t3b_urgente').value = 'SI';
      } else {
        if ($('t3b_urgente')) $('t3b_urgente').value = asig['Urgente'] || 'NO';
      }

      // Formatear Grupo Asignado — normalizar numero o texto corto al formato completo
      var grupoNombreRaw = asig['Grupo Asignado'] || '';
      var grupoNormalizado = normalizarGrupoAsignado(grupoNombreRaw);
      var grupoAsignadoEl = $('t3b_grupo_asignado');
      if (grupoAsignadoEl) {
        grupoAsignadoEl.value = grupoNormalizado;
        // Colorear segun el grupo
        var grupoInfo = null;
        for (var gi = 0; gi < GRUPOS_FIJOS_CARGUE.length; gi++) {
          if (grupoNormalizado.indexOf(GRUPOS_FIJOS_CARGUE[gi].nombre) >= 0) { grupoInfo = GRUPOS_FIJOS_CARGUE[gi]; break; }
        }
        if (grupoInfo) {
          grupoAsignadoEl.style.borderColor = grupoInfo.hex;
          grupoAsignadoEl.style.color = grupoInfo.hex;
          grupoAsignadoEl.style.fontWeight = 'bold';
        } else {
          grupoAsignadoEl.style.borderColor = '';
          grupoAsignadoEl.style.color = '';
          grupoAsignadoEl.style.fontWeight = '';
        }
      }

      // Punto de captura — muestra traslado general (completo)
      var trasladoCompletoB = asig['Traslado'] || asig['Documento'] || asig['Documento Traslado'] || asig['Numero Traslado'] || traslado;
      // Actualizar el campo de entrada con el traslado completo
      if ($('t3b_traslado')) $('t3b_traslado').value = trasladoCompletoB;
      if ($('t3b_punto_captura')) $('t3b_punto_captura').value = trasladoCompletoB;
      if ($('t3b_punto_row')) $('t3b_punto_row').style.display = '';

      if (estado) estado.innerHTML = '<span class="badge bg-success">&#9989; Asignaci&oacute;n verificada</span>';
      showToast('Asignaci&oacute;n de traslado <strong>' + traslado + '</strong> verificada. Complete los datos de entrega.', 'success');

      // Guardar la asignacion como referencia para guardar despues
      t3bTrasladoValidado = asig;

      // PASO 2: Buscar datos adicionales en la hoja consolidada de despachos
      // (para traer Codigo, Descripcion, Unidades, Lote, Fecha Venc, etc.)
      var folderConsulta = CONFIG.folders.trasladosConsulta;
      apiGet({ action: 'buscarTraslado', folderId: folderConsulta, modulo: 'despachos', traslado: traslado })
        .then(function (rConsol) {
          if (rConsol && rConsol.encontrado && rConsol.registro) {
            var reg = rConsol.registro;
            // Completar campos adicionales en Seccion B (no sobreescribir los ya llenos)
            if ($('t3b_punto_captura') && !$('t3b_punto_captura').value) {
              var trasladoCompletoConsol = reg['Traslado'] || reg['Documento Traslado'] || reg['Numero Traslado'] || traslado;
              $('t3b_punto_captura').value = trasladoCompletoConsol;
            }
            // Guardar referencia completa para el guardado
            t3bTrasladoValidado.__consolidado = reg;
          }
        })
        .catch(function () { /* no critico, la asignacion ya es suficiente */ });

    })
    .catch(function (err) {
      t3bTrasladoValidado = null;
      if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; Error</span>';
      showToast('Error al verificar asignaci&oacute;n: ' + err.message, 'danger');
    });
}

function t3bGuardarEntrega() {
  var trasladoInput = $('t3b_traslado') ? $('t3b_traslado').value.trim() : '';
  if (!trasladoInput) { showToast('Primero consulte un traslado en la Secci&oacute;n B.', 'danger'); return; }
  if (!t3bTrasladoValidado) { showToast('Valide la asignaci&oacute;n del traslado antes de guardar.', 'danger'); return; }
  // Usar el traslado COMPLETO de la asignacion validada (no solo los digitos que escribio el usuario)
  var trasladoCompletoGuardarB = t3bTrasladoValidado['Traslado'] || t3bTrasladoValidado['Documento'] || t3bTrasladoValidado['Documento Traslado'] || t3bTrasladoValidado['Numero Traslado'] || trasladoInput;
  var traslado = trasladoCompletoGuardarB;

  var folderId = $('folder_entrega') ? $('folder_entrega').value.trim() : CONFIG.folders.entrega;
  if (!folderId) { showToast('Configure la carpeta Drive de Entrega a Log&iacute;stica.', 'danger'); return; }

  var responsableEntrega = $('t3b_responsable_entrega') ? $('t3b_responsable_entrega').value : '';
  var cantidadVal = $('t3b_cantidad') ? $('t3b_cantidad').value : '';
  var tipoCarga = $('t3b_tipo_carga') ? $('t3b_tipo_carga').value : '';

  if (!responsableEntrega) { showToast('Seleccione el Responsable de Entrega CENDIS.', 'danger'); return; }
  if (!tipoCarga) { showToast('Seleccione el Tipo de Carga.', 'danger'); return; }

  // Validacion Cantidad: entero mayor a 0
  if (cantidadVal === '') { showToast('Ingrese la Cantidad.', 'danger'); return; }
  var cantidadNum = Number(cantidadVal);
  if (isNaN(cantidadNum) || cantidadNum !== Math.floor(cantidadNum) || cantidadNum < 1) {
    showToast('Cantidad debe ser un numero entero mayor a 0.', 'danger'); return;
  }

  // VALIDAR DUPLICADO: verificar que el traslado no exista ya en BD_ENTREGA_A_LOGISTICA
  var btnGuardar = $('t3b_btnGuardar');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = 'Verificando...'; }

  apiGet({ action: 'buscarEntrega', folderId: folderId, traslado: traslado })
    .then(function (rExist) {
      if (rExist && rExist.encontrado) {
        showToast('&#9888; El traslado <strong>' + traslado + '</strong> ya tiene una Entrega a Log&iacute;stica guardada. No se puede repetir.', 'danger');
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar en el Drive Entrega a Log\u00edstica'; }
        return null; // senal para no continuar
      }

      // Datos de la asignacion (paso 1)
      var asig = t3bTrasladoValidado;
      var consol = asig.__consolidado || {};

      var registro = {
        'Documento Traslado': traslado,
        'Fecha': asig['Fecha'] || '',
        'Bodega Origen': $('t3b_bodega_origen') ? $('t3b_bodega_origen').value : '',
        'Bodega Destino': $('t3b_destino') ? $('t3b_destino').value : '',
        'Ruta': $('t3b_ruta') ? $('t3b_ruta').value : '',
        'Zona': $('t3b_ruta') ? $('t3b_ruta').value : '',
        'Urgente': $('t3b_urgente') ? $('t3b_urgente').value : '',
        'Grupo Asignado': $('t3b_grupo_asignado') ? $('t3b_grupo_asignado').value : (asig['Grupo Asignado'] || ''),
        'Concepto': $('t3b_concepto') ? $('t3b_concepto').value : '',
        'Cantidad': $('t3b_cantidad') ? $('t3b_cantidad').value : '',
        'Tipo Carga': tipoCarga,
        'Temperatura': (tipoCarga === 'NEVERA' && $('t3b_temperatura')) ? $('t3b_temperatura').value.trim() : '',
        'Responsable Entrega CENDIS': responsableEntrega,
        'Recibido': asig['Recibido'] || consol['Quien Recibe'] || '',
        'Observacion Drive': asig['Observacion Drive'] || consol['Observacion'] || consol['Observaciones'] || '',
        'Marca temporal': ahora(),
        'Perfil': perfilActivo(),
        'Usuario': nombreUsuario()
      };

      return apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'entrega', registro: registro });
    })
    .then(function (r) {
      if (r === null) return; // duplicado, ya se mostro error
      if (r && r.ok) {
        showToast('&#128190; <strong>Entrega a Log&iacute;stica</strong> guardada en BD_ENTREGA_A_LOGISTICA.', 'success');
        t3bTrasladoValidado = null;
        limpiarSeccionB();
      } else {
        showToast('Error al guardar Entrega: ' + (r.error || ''), 'danger');
      }
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar en el Drive Entrega a Log\u00edstica'; }
    })
    .catch(function (err) {
      showToast('Error de conexion: ' + err.message, 'danger');
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar en el Drive Entrega a Log\u00edstica'; }
    });
}

function limpiarSeccionB() {
  limpiarCampos('t3b_');
  var ga = $('t3b_grupo_asignado');
  if (ga) { ga.style.borderColor = ''; ga.style.color = ''; ga.style.fontWeight = ''; }
  if ($('t3b_punto_row')) $('t3b_punto_row').style.display = 'none';
  if ($('t3b_temp_row')) $('t3b_temp_row').style.display = 'none';
  if ($('t3b_estadoTraslado')) $('t3b_estadoTraslado').innerHTML = '';
  t3bTrasladoValidado = null;
  showToast('Secci&oacute;n B (Entrega a Log&iacute;stica) limpiada.', 'info');
}

/* ═════════════════════════════════════════════════════════════════════════════════
   9. TARJETA 4 — LOGISTICA Y DESPACHOS (2 Secciones)
   ═════════════════════════════════════════════════════════════════════════════════
   Seccion 1: Recepcion y Revision (Paso 1 obligatorio)
   Seccion 2: Despacho y Asignacion de Planilla (Paso 2 dependiente)
   ═════════════════════════════════════════════════════════════════════════════════ */

/* ── Toggle Temperatura en Seccion 1 segun Tipo = NEVERA ── */
function toggleLogTemp() {
  var tipoVal = $('log_tipo') ? $('log_tipo').value.trim().toUpperCase() : '';
  var tempRow = $('log_temp_row');
  if (tempRow) tempRow.style.display = (tipoVal === 'NEVERA') ? '' : 'none';
  if (tipoVal !== 'NEVERA' && $('log_temperatura')) $('log_temperatura').value = '';
}

/* ── Datos temporales de Seccion 2 (tabla de despacho) ── */
var logDatosDespacho = [];
var logFilasSeleccionadas = [];  /* Indices de filas seleccionadas via checkbox */

/* ── Helpers para gestion de checkboxes en tabla de despacho ── */
function logObtenerSeleccion() {
  /* Retorna array de registros (de logDatosDespacho) que estan seleccionados via checkbox */
  var checkboxes = document.querySelectorAll('.log-row-chk');
  var sel = [];
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) {
      var idx = parseInt(checkboxes[i].getAttribute('data-idx'), 10);
      if (idx >= 0 && idx < logDatosDespacho.length) {
        sel.push(logDatosDespacho[idx]);
      }
    }
  }
  return sel;
}

function logActualizarSeleccion() {
  /* Actualiza el estado del checkbox "Seleccionar todos" y contador */
  var checkboxes = document.querySelectorAll('.log-row-chk');
  var chkAll = $('log_chk_all');
  var total = checkboxes.length;
  var checked = 0;
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) checked++;
  }
  /* Sincronizar checkbox all */
  if (chkAll) {
    chkAll.checked = (total > 0 && checked === total);
    chkAll.indeterminate = (checked > 0 && checked < total);
  }
  /* Actualizar badge de seleccion */
  var despachoEstado = $('log_despacho_estado');
  if (despachoEstado && total > 0) {
    despachoEstado.innerHTML = '<span class="badge bg-info">' + checked + '/' + total + ' seleccionados</span>';
  }
  /* Habilitar/deshabilitar boton combinado segun seleccion */
  var btnComb = $('log_btnCombinado'); if (btnComb) btnComb.disabled = (checked === 0);
}

/* ════════════ SECCION 1: RECEPCION Y REVISION ════════════ */

function logBuscar() {
  var traslado = $('log_traslado') ? $('log_traslado').value.trim() : '';
  if (!traslado) { showToast('Ingrese el numero de traslado (completo o ultimos 5 digitos).', 'danger'); return; }
  /* Seccion 1 busca en BD_ENTREGA_A_LOGISTICA (archivo consolidado de entrega) */
  var fileId = '1xC5Nj2VMNgh6N5XIfMTN-aJ2i8nQExANAEhgthWRNpU';
  var sheetGid = '1372653954';
  var folderId = $('folder_despachos_t4') ? $('folder_despachos_t4').value.trim() : CONFIG.folders.despachos;
  var estado = $('log_estadoTraslado');
  var despachoEstado = $('log_despacho_estado');
  if (estado) estado.innerHTML = '<span class="badge bg-warning text-dark">Buscando...</span>';
  if (despachoEstado) despachoEstado.textContent = '';

  apiGet({ action: 'buscarTraslado', folderId: folderId, modulo: 'entrega', traslado: traslado, fileId: fileId, sheetGid: sheetGid })
    .then(function (r) {
      if (r && r.encontrado) {
        /* --- Multiples coincidencias: mostrar selector --- */
        if (r.multiple && r.registros && r.registros.length > 1) {
          if (estado) estado.innerHTML = '<span class="badge bg-warning text-dark">' + r.registros.length + ' coincidencias</span>';
          logMostrarSelectorMultiples(r.registros, traslado);
          return;
        }
        /* --- Coincidencia unica: auto-fill como antes --- */
        var reg = r.registro;
        if (!reg) { reg = r.registros ? r.registros[0] : null; }
        if (!reg) {
          logTrasladoValidado = null;
          if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; No encontrado</span>';
          showToast('Traslado no encontrado.', 'danger');
          return;
        }
        logLlenarCamposTraslado(reg, traslado, estado);
      } else {
        logTrasladoValidado = null;
        if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; No encontrado</span>';
        var msgNoLog = (r && r.mensaje) ? r.mensaje : 'Traslado no encontrado en la base de datos de origen.';
        if (r && r.archivosXlsx && r.archivosXlsx > 0 && r.archivosEscaneados === 0) {
          msgNoLog += ' La carpeta tiene ' + r.archivosXlsx + ' archivo(s) Excel que NO se pudieron convertir.';
        }
        showToast(msgNoLog, 'danger');
      }
    })
    .catch(function (err) {
      logTrasladoValidado = null;
      if (estado) estado.innerHTML = '<span class="badge bg-danger">&#10060; Error</span>';
      showToast('Error al buscar: ' + err.message, 'danger');
    });
}

/* Llena los campos de Seccion 1 con los datos del registro seleccionado */
function logLlenarCamposTraslado(reg, trasladoOriginal, estado) {
  var tipoMatch = reg.__tipoCoincidencia || 'exacta';
  var numCoincidencias = reg.__coincidencias || 1;
  var numExactas = reg.__coincidenciasExactas || 0;
  var digitosBuscados = reg.__buscadoDigitos || '';

  var trasladoCompletoLog = reg['Traslado'] || reg['Documento'] || reg['Documento Traslado'] || reg['Numero Traslado'] || trasladoOriginal;
  if ($('log_traslado')) $('log_traslado').value = trasladoCompletoLog;
  if ($('log_documento_traslado')) $('log_documento_traslado').value = trasladoCompletoLog;
  if ($('log_bodega_origen')) $('log_bodega_origen').value = reg['Bodega Origen'] || reg['Bodega Origen.'] || reg['Bodega'] || '';
  if ($('log_destino')) $('log_destino').value = reg['Bodega Destino'] || reg['Bodega Destino.'] || reg['Destino'] || '';
  if ($('log_ruta')) $('log_ruta').value = reg['Zona'] || reg['Ruta'] || '';
  if ($('log_concepto') && reg['Concepto']) $('log_concepto').value = reg['Concepto'] || '';

  var conceptoValL = $('log_concepto') ? $('log_concepto').value.trim().toUpperCase() : '';
  var esConceptoUrgenteL = false;
  var CONCEPTOS_URGENTES_L = ['TUTELAS', 'DESACATO', 'PQRS', 'JORNADAS', 'ORDEN DE ARRESTO', 'SANCION'];
  for (var ciL = 0; ciL < CONCEPTOS_URGENTES_L.length; ciL++) {
    if (conceptoValL === CONCEPTOS_URGENTES_L[ciL] || conceptoValL.indexOf(CONCEPTOS_URGENTES_L[ciL]) >= 0) {
      esConceptoUrgenteL = true; break;
    }
  }
  if (esConceptoUrgenteL) {
    if ($('log_urgente')) $('log_urgente').value = 'SI';
  } else if (reg['Urgente']) {
    if ($('log_urgente')) $('log_urgente').value = reg['Urgente'];
  } else {
    if ($('log_urgente')) $('log_urgente').value = 'NO';
  }

  if ($('log_grupo_asignado')) $('log_grupo_asignado').value = reg['Grupo Asignado'] || reg['GRUPO ASIGNADO'] || reg['Grupo'] || '';
  if ($('log_tipo')) $('log_tipo').value = reg['Tipo'] || reg['TIPO'] || reg['Tipo Carga'] || reg['Tipo de Carga'] || '';
  if ($('log_cantidad')) $('log_cantidad').value = reg['Cantidad'] || reg['CANTIDAD'] || reg['Cantidad Enviada'] || reg['Cant.'] || '';
  if ($('log_temperatura')) $('log_temperatura').value = reg['Temperatura'] || '';
  toggleLogTemp();

  var revVal = (reg['Revisado'] || 'NO').toString().toUpperCase();
  var revEl = $('log_revisado');
  if (revEl) {
    if (revVal === 'SI') {
      revEl.value = 'SI';
      revEl.disabled = true;
      revEl.className = 'form-select log-revisado-readonly';
    } else {
      revEl.value = 'NO';
      revEl.disabled = false;
      revEl.className = 'form-select';
    }
  }

  var msgLog = '';
  if (tipoMatch === 'exacta') {
    msgLog = 'Traslado <strong>' + trasladoCompletoLog + '</strong> encontrado (coincidencia exacta).';
  } else {
    var digitosInfo = digitosBuscados ? ' Digitos buscados: <strong>' + digitosBuscados + '</strong>.' : '';
    msgLog = 'Coincidencia numerica parcial (<strong>' + trasladoCompletoLog + '</strong>).' + digitosInfo;
  }

  if (estado) estado.innerHTML = '<span class="badge bg-success">&#9989; Encontrado</span>';
  logTrasladoValidado = reg;
  showToast(msgLog, 'success');
}

/* Muestra modal de seleccion cuando hay multiples coincidencias */
function logMostrarSelectorMultiples(registros, trasladoOriginal) {
  /* Cerrar modal previo si existe */
  var previo = $('log_modal_multiples');
  if (previo) previo.parentNode.removeChild(previo);

  var backdrop = document.createElement('div');
  backdrop.id = 'log_modal_multiples';
  backdrop.className = 'log-modal-multiples-backdrop';

  var modal = document.createElement('div');
  modal.className = 'log-modal-multiples';

  var titulo = document.createElement('div');
  titulo.className = 'log-modal-multiples-titulo';
  titulo.innerHTML = '<strong>&#128269; Se encontraron ' + registros.length + ' traslados</strong><br><small>con los digitos <strong>' + trasladoOriginal + '</strong>. Seleccione el correcto:</small>';
  modal.appendChild(titulo);

  for (var i = 0; i < registros.length; i++) {
    (function (idx) {
      var reg = registros[idx];
      var numDoc = reg['Traslado'] || reg['Documento'] || reg['Documento Traslado'] || reg['Numero Traslado'] || trasladoOriginal;
      var bodegaOrigen = reg['Bodega Origen'] || reg['Bodega Origen.'] || reg['Bodega'] || '';
      var bodegaDestino = reg['Bodega Destino'] || reg['Bodega Destino.'] || reg['Destino'] || '';
      var tipoMatchLabel = (reg.__tipoMatch === 'texto_exacto') ? '<span class="badge bg-success">Exacta</span>' : '<span class="badge bg-warning text-dark">Parcial</span>';

      var tarjeta = document.createElement('div');
      tarjeta.className = 'log-modal-multiples-card';
      tarjeta.innerHTML = '<div class="log-card-numero">' + tipoMatchLabel + ' <strong>' + numDoc + '</strong></div>' +
        '<div class="log-card-detalle">' +
        '<span><i class="bi bi-box-seam"></i> Origen: <strong>' + bodegaOrigen + '</strong></span>' +
        '<span><i class="bi bi-geo-alt"></i> Destino: <strong>' + bodegaDestino + '</strong></span>' +
        '</div>';

      tarjeta.addEventListener('click', function () {
        logLlenarCamposTraslado(reg, trasladoOriginal, $('log_estadoTraslado'));
        /* Cerrar modal */
        var m = $('log_modal_multiples');
        if (m) m.parentNode.removeChild(m);
      });

      modal.appendChild(tarjeta);
    })(i);
  }

  var btnCerrar = document.createElement('button');
  btnCerrar.className = 'btn btn-sm btn-outline-secondary log-modal-multiples-cerrar';
  btnCerrar.innerHTML = '&#10060; Cancelar';
  btnCerrar.addEventListener('click', function () {
    var m = $('log_modal_multiples');
    if (m) m.parentNode.removeChild(m);
    logTrasladoValidado = null;
    var estado = $('log_estadoTraslado');
    if (estado) estado.innerHTML = '<span class="badge bg-secondary">Sin seleccion</span>';
  });
  modal.appendChild(btnCerrar);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
}

function logGuardarRecepcion() {
  var trasladoInput = $('log_traslado') ? $('log_traslado').value.trim() : '';
  if (!trasladoInput) { showToast('Ingrese el numero de traslado.', 'danger'); return; }
  var trasladoCompletoLog = (logTrasladoValidado && (logTrasladoValidado['Traslado'] || logTrasladoValidado['Documento'] || logTrasladoValidado['Documento Traslado'] || logTrasladoValidado['Numero Traslado'])) || trasladoInput;
  var quienRecibio = $('log_quien_recibio') ? $('log_quien_recibio').value : '';
  if (!quienRecibio) { showToast('Seleccione quien recibio.', 'danger'); return; }
  var revisadoVal = $('log_revisado') ? $('log_revisado').value : 'NO';
  var folderId = $('folder_logistica') ? $('folder_logistica').value.trim() : CONFIG.folders.logistica;
  if (!folderId) { showToast('Configure la carpeta Drive de Logistica.', 'danger'); return; }

  /* --- Verificar duplicado antes de guardar --- */
  var btnGuardar = $('log_btnGuardar');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verificando...'; }

  apiGet({ action: 'verificarRecepcionDuplicada', folderId: folderId, documentoTraslado: trasladoCompletoLog })
    .then(function (v) {
      if (v && v.duplicado) {
        /* Bloquear guardado si ya existe */
        if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '&#128190; Guardar Recepcion en Drive'; }
        showToast('&#9888;&#65039; <strong>DUPLICADO</strong> — ' + v.mensaje, 'danger');
        return null; /* señal para no continuar */
      }
      /* No es duplicado — proceder a guardar */
      var registro = {
        'Documento Traslado': trasladoCompletoLog,
        'Bodega Origen': $('log_bodega_origen') ? $('log_bodega_origen').value : '',
        'Bodega Destino': $('log_destino') ? $('log_destino').value : '',
        'Ruta': $('log_ruta') ? $('log_ruta').value : '',
        'Zona': $('log_ruta') ? $('log_ruta').value : '',
        'Urgente': $('log_urgente') ? $('log_urgente').value : 'NO',
        'Grupo Asignado': $('log_grupo_asignado') ? $('log_grupo_asignado').value : '',
        'Concepto': $('log_concepto') ? $('log_concepto').value.trim() : '',
        'Tipo': $('log_tipo') ? $('log_tipo').value : '',
        'Cantidad': $('log_cantidad') ? $('log_cantidad').value : '',
        'Temperatura': $('log_temperatura') ? $('log_temperatura').value : '',
        'Quien Recibio': quienRecibio,
        'Revisado': revisadoVal,
        'Observaciones': $('log_observaciones') ? $('log_observaciones').value.trim() : '',
        'Marca temporal': ahora(),
        'Perfil': perfilActivo(),
        'Usuario': nombreUsuario()
      };
      return apiPost({ action: 'guardarRegistro', folderId: folderId, modulo: 'recepcion_log', registro: registro });
    })
    .then(function (r) {
      if (r === null) return; /* duplicado bloqueado */
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '&#128190; Guardar Recepcion en Drive'; }
      if (r && r.ok) {
        showToast('&#128190; <strong>Recepcion</strong> guardada en Drive.', 'success');
        logLimpiar();
      } else {
        showToast('Error al guardar Recepcion: ' + (r.error || ''), 'danger');
      }
    })
    .catch(function (err) {
      if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '&#128190; Guardar Recepcion en Drive'; }
      showToast('Error de conexion: ' + err.message, 'danger');
    });
}

function logLimpiar() {
  var campos = ['log_documento_traslado','log_bodega_origen','log_destino','log_ruta',
    'log_urgente','log_grupo_asignado','log_concepto','log_tipo','log_cantidad','log_temperatura','log_observaciones'];
  for (var i = 0; i < campos.length; i++) {
    var el = $(campos[i]);
    if (el) el.value = '';
  }
  /* Ocultar fila de temperatura */
  var tempRow = $('log_temp_row'); if (tempRow) tempRow.style.display = 'none';
  var sel1 = $('log_quien_recibio'); if (sel1) sel1.selectedIndex = 0;
  var sel2 = $('log_revisado'); if (sel2) { sel2.value = 'NO'; sel2.disabled = false; sel2.className = 'form-select'; }
  var est = $('log_estadoTraslado'); if (est) est.innerHTML = '';
  var despEst = $('log_despacho_estado'); if (despEst) despEst.textContent = '';
  logTrasladoValidado = null;
}

/* ════════════ SECCION 2: DESPACHO Y ASIGNACION DE PLANILLA ════════════ */

/** Poblar select de Conductor (y cualquier otro select de conductores) */
function poblarConductores() {
  var conductores = CONFIG.conductores || [];
  var selects = document.querySelectorAll('select[data-conductores], #log_conductor, #t3b_conductor');
  for (var si = 0; si < selects.length; si++) {
    var sel = selects[si];
    if (!sel) continue;
    // Evitar duplicar: si ya tiene opciones besides placeholder, skip
    if (sel.options.length > 1) continue;
    for (var ci = 0; ci < conductores.length; ci++) {
      var opt = document.createElement('option');
      opt.value = conductores[ci];
      opt.textContent = conductores[ci];
      sel.appendChild(opt);
    }
  }
}

function logConsultarDespacho() {
  var filtroRevisado = $('log_filtro_revisado') ? $('log_filtro_revisado').value : '';
  var filtroRuta = $('log_filtro_ruta') ? $('log_filtro_ruta').value : '';
  var filtroUrgente = $('log_filtro_urgente') ? $('log_filtro_urgente').value : '';
  var planilla = $('log_planilla') ? $('log_planilla').value.trim() : '';
  var folderId = $('folder_logistica') ? $('folder_logistica').value.trim() : CONFIG.folders.logistica;
  if (!folderId) { showToast('Configure la carpeta Drive de Logistica.', 'danger'); return; }

  /* Poblar select de Conductor */
  poblarConductores();

  var consultaEstado = $('log_consulta_estado');
  if (consultaEstado) consultaEstado.innerHTML = '<span class="badge bg-warning text-dark">Consultando...</span>';
  var despachoEstado = $('log_despacho_estado');
  if (despachoEstado) despachoEstado.textContent = '';

  apiGet({
    action: 'consultarDespacho',
    folderId: folderId,
    modulo: 'logistica',
    filtroRevisado: filtroRevisado,
    filtroRuta: filtroRuta,
    filtroUrgente: filtroUrgente
  })
    .then(function (r) {
      var tbody = $('log_tabla_body');
      if (!tbody) return;
      tbody.innerHTML = '';
      logDatosDespacho = [];
      logFilasSeleccionadas = [];

      if (r && r.ok && r.registros && r.registros.length > 0) {
        logDatosDespacho = r.registros;
        for (var i = 0; i < r.registros.length; i++) {
          var reg = r.registros[i];
          var tr = document.createElement('tr');
          /* Checkbox por fila */
          var tdChk = document.createElement('td');
          tdChk.className = 'log-chk-col';
          var chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.className = 'log-row-chk';
          chk.setAttribute('data-idx', i);
          chk.checked = true;  /* seleccionado por defecto */
          chk.addEventListener('change', logActualizarSeleccion);
          tdChk.appendChild(chk);
          tr.appendChild(tdChk);
          /* Datos — solo columnas solicitadas: Revisado, Documento Traslado, Bodega Origen, Cantidad, Tipo, Urgente, Temperatura */
          var tds =
            '<td class="log-revisado-col">' + (function() { var rv = String(reg['Revisado'] || 'NO').toUpperCase().trim(); if (rv === 'SI') return '<span class="badge bg-success log-revisado-fijo" data-idx="' + i + '">&#9989; SI</span>'; else return '<select class="form-select form-select-sm log-revisado-select" data-idx="' + i + '" data-orig="NO"><option value="NO" selected>NO</option><option value="SI">SI</option></select>'; })() + '</td>' +
            '<td>' + (reg['Documento Traslado'] || '') + '</td>' +
            '<td>' + (reg['Bodega Origen'] || '') + '</td>' +
            '<td>' + (reg['Cantidad'] || '') + '</td>' +
            '<td>' + (reg['Tipo'] || reg['Tipo Carga'] || reg['Tipo de Carga'] || '') + '</td>' +
            '<td>' + (reg['Urgente'] || 'NO') + '</td>' +
            '<td class="log-temp-col">' + (reg['Temperatura'] || '') + '</td>';
          tr.innerHTML += tds;
          tbody.appendChild(tr);
        }
        /* Inicializar seleccion y actualizar UI (esto habilita/deshabilita el boton combinado segun seleccion) */
        logActualizarSeleccion();
        if (consultaEstado) consultaEstado.innerHTML = '<span class="badge bg-success">' + r.registros.length + ' registros</span>';
        if (despachoEstado) despachoEstado.innerHTML = '<span class="badge bg-info">' + r.registros.length + ' traslados encontrados</span>';
        showToast(r.registros.length + ' traslados encontrados.', 'success');
      } else {
        if (consultaEstado) consultaEstado.innerHTML = '<span class="badge bg-secondary">0 registros</span>';
        if (despachoEstado) despachoEstado.innerHTML = '<span class="badge bg-warning text-dark">Sin resultados</span>';
        var btnComb3 = $('log_btnCombinado'); if (btnComb3) btnComb3.disabled = true;
        showToast('No se encontraron recepciones con los filtros seleccionados.', 'info');
      }
    })
    .catch(function (err) {
      var consultaEstado2 = $('log_consulta_estado');
      if (consultaEstado2) consultaEstado2.innerHTML = '<span class="badge bg-danger">Error</span>';
      showToast('Error al consultar: ' + err.message, 'danger');
    });
}

/**
 * logGuardarYDescargar — Funcion combinada que primero guarda en Drive
 * (archivo consolidado) y luego genera el PDF de la planilla.
 */
function logGuardarYDescargar() {
  if (!logDatosDespacho.length) { showToast('No hay traslados para guardar. Consulte primero.', 'danger'); return; }
  var planilla = $('log_planilla') ? $('log_planilla').value.trim() : '';
  if (!planilla) { showToast('Ingrese el numero de Planilla.', 'danger'); return; }
  var conductor = $('log_conductor') ? $('log_conductor').value : '';
  if (!conductor) { showToast('Seleccione el Conductor.', 'danger'); return; }
  var placa = $('log_placa') ? $('log_placa').value.trim().toUpperCase() : '';
  var folderId = $('folder_logistica') ? $('folder_logistica').value.trim() : CONFIG.folders.logistica;
  if (!folderId) { showToast('Configure la carpeta Drive de Logistica.', 'danger'); return; }

  /* Solo filas seleccionadas */
  var seleccionados = logObtenerSeleccion();
  if (!seleccionados.length) { showToast('Seleccione al menos un traslado en la tabla.', 'danger'); return; }

  var obsGlobal = $('log_obs_planilla') ? $('log_obs_planilla').value.trim() : '';

  /* --- Construir registros para guardado --- */
  var registrosPlanilla = [];
  for (var i = 0; i < seleccionados.length; i++) {
    var reg = seleccionados[i];
    var obsFila = obsGlobal;
    var revisadoFinal = reg['Revisado'] || 'NO';
    /* Buscar indice en datos originales para leer select de Revisado */
    var idxReg = -1;
    for (var f = 0; f < logDatosDespacho.length; f++) {
      if (logDatosDespacho[f]['Documento Traslado'] === reg['Documento Traslado']) { idxReg = f; break; }
    }
    if (idxReg >= 0) {
      var selRev = document.querySelector('.log-revisado-select[data-idx="' + idxReg + '"]');
      if (selRev && selRev.value) revisadoFinal = selRev.value;
      var badgeRev = document.querySelector('.log-revisado-fijo[data-idx="' + idxReg + '"]');
      if (badgeRev) revisadoFinal = 'SI';
    }
    registrosPlanilla.push({
      'Documento Traslado': reg['Documento Traslado'] || '',
      'Bodega Origen': reg['Bodega Origen'] || '',
      'Bodega Destino': reg['Bodega Destino'] || '',
      'Ruta': reg['Ruta'] || reg['Zona'] || '',
      'Cantidad': reg['Cantidad'] || '',
      'Tipo': reg['Tipo'] || reg['Tipo Carga'] || reg['Tipo de Carga'] || '',
      'Temperatura': reg['Temperatura'] || '',
      'Urgente': reg['Urgente'] || 'NO',
      'Quien Recibio': reg['Quien Recibio'] || '',
      'Revisado': revisadoFinal,
      'Observaciones Planilla': obsFila,
      'Planilla': planilla,
      'Conductor': conductor,
      'Placa del Vehiculo': placa,
      'Marca temporal': ahora(),
      'Perfil': perfilActivo(),
      'Usuario': nombreUsuario()
    });
  }

  /* --- Construir registros para PDF (incluye datos de conductor/placa en cada fila) --- */
  var regsPDF = [];
  for (var p = 0; p < seleccionados.length; p++) {
    var regP = seleccionados[p];
    var copia = {};
    for (var k in regP) { if (regP.hasOwnProperty(k)) copia[k] = regP[k]; }
    copia['Conductor'] = conductor;
    copia['Placa del Vehiculo'] = placa;
    var idxP = -1;
    for (var fp = 0; fp < logDatosDespacho.length; fp++) {
      if (logDatosDespacho[fp]['Documento Traslado'] === regP['Documento Traslado']) { idxP = fp; break; }
    }
    if (idxP >= 0) {
      var selRevP = document.querySelector('.log-revisado-select[data-idx="' + idxP + '"]');
      if (selRevP && selRevP.value) copia['Revisado'] = selRevP.value;
      var badgeRevP = document.querySelector('.log-revisado-fijo[data-idx="' + idxP + '"]');
      if (badgeRevP) copia['Revisado'] = 'SI';
    }
    if (!copia['Observaciones Planilla'] && obsGlobal) copia['Observaciones Planilla'] = obsGlobal;
    regsPDF.push(copia);
  }

  /* --- Deshabilitar boton con spinner --- */
  var btnComb = $('log_btnCombinado');
  var btnHtmlOrig = btnComb ? btnComb.innerHTML : '';
  if (btnComb) { btnComb.disabled = true; btnComb.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Procesando...'; }

  /* --- PASO 1: Guardar en Drive (archivo consolidado) --- */
  apiPost({
    action: 'guardarDespacho',
    folderId: folderId,
    modulo: 'logistica',
    planilla: planilla,
    registros: registrosPlanilla
  })
    .then(function (r) {
      if (r && r.ok) {
        /* Mostrar mensaje de exito de guardado */
        var msg = '&#128190; <strong>Despacho</strong> con Planilla ' + planilla + ' guardado (' + registrosPlanilla.length + ' traslados).';
        if (r.archivoUrl) {
          msg += '<br><a href="' + r.archivoUrl + '" target="_blank" class="alert-link">&#128279; Abrir archivo en Drive</a>';
        }
        showToast(msg, 'success');

        /* --- PASO 2: Generar PDF --- */
        apiGet({
          action: 'generarPDFPlanilla',
          folderId: folderId,
          modulo: 'logistica',
          planilla: planilla || 'SIN-PLANILLA',
          registros: JSON.stringify(regsPDF)
        })
          .then(function (r2) {
            if (btnComb) { btnComb.disabled = false; btnComb.innerHTML = btnHtmlOrig; }
            if (r2 && r2.ok && r2.url) {
              window.open(r2.url, '_blank');
              showToast('&#128196; PDF generado correctamente (' + regsPDF.length + ' traslados).', 'success');
            } else {
              showToast('Error al generar PDF: ' + (r2.error || 'Respuesta invalida'), 'danger');
            }
            /* Limpiar tabla y campos tras ambas operaciones */
            logDatosDespacho = [];
            logFilasSeleccionadas = [];
            var tbody = $('log_tabla_body'); if (tbody) tbody.innerHTML = '';
            if (btnComb) btnComb.disabled = true;
            if ($('log_planilla')) $('log_planilla').value = '';
            if ($('log_conductor')) $('log_conductor').selectedIndex = 0;
            if ($('log_placa')) $('log_placa').value = '';
            if ($('log_obs_planilla')) $('log_obs_planilla').value = '';
          })
          .catch(function (err2) {
            if (btnComb) { btnComb.disabled = false; btnComb.innerHTML = btnHtmlOrig; }
            showToast('Error de conexion al generar PDF: ' + err2.message, 'danger');
          });
      } else {
        /* Error al guardar en Drive */
        if (btnComb) { btnComb.disabled = false; btnComb.innerHTML = btnHtmlOrig; }
        var errMsg = 'Error al guardar Despacho: ' + (r.error || '');
        if (r.duplicados && r.duplicados.length > 0) {
          errMsg = '&#9888;&#65039; <strong>Traslados duplicados</strong> — ya existen en la planilla de despacho:<br><strong>' + r.duplicados.join(', ') + '</strong>';
        }
        showToast(errMsg, 'danger');
      }
    })
    .catch(function (err) {
      if (btnComb) { btnComb.disabled = false; btnComb.innerHTML = btnHtmlOrig; }
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
  poblarConductores();
  aplicarPerfil();

  // Botones de tarjeta
  var btn;
  btn = $('t1_btnGuardar'); if (btn) btn.addEventListener('click', t1Guardar);
  btn = $('t2_btnAgregar'); if (btn) btn.addEventListener('click', t2AgregarItem);
  btn = $('t2_btnGuardar'); if (btn) btn.addEventListener('click', t2Guardar);
  btn = $('t3a_btnValidar'); if (btn) btn.addEventListener('click', t3aValidarTraslado);
  btn = $('t3a_btnGuardar'); if (btn) btn.addEventListener('click', t3aGuardarAsignacion);
  btn = $('t3b_btnValidar'); if (btn) btn.addEventListener('click', t3bValidarTraslado);
  btn = $('t3b_btnGuardar'); if (btn) btn.addEventListener('click', t3bGuardarEntrega);
  /* Mostrar/ocultar campo Temperatura cuando Tipo Carga = NEVERA */
  var selTipoCarga = $('t3b_tipo_carga');
  if (selTipoCarga) selTipoCarga.addEventListener('change', function () {
    var tempRow = $('t3b_temp_row');
    if (tempRow) tempRow.style.display = (this.value === 'NEVERA') ? '' : 'none';
    if (this.value !== 'NEVERA' && $('t3b_temperatura')) $('t3b_temperatura').value = '';
  });
  btn = $('log_btnBuscar');  if (btn) btn.addEventListener('click', logBuscar);
  btn = $('log_btnGuardar'); if (btn) btn.addEventListener('click', logGuardarRecepcion);
  /* Mostrar/ocultar campo Temperatura en Seccion 1 cuando Tipo = NEVERA */
  var selLogTipo = $('log_tipo');
  if (selLogTipo) {
    /* Observer: cuando se rellena por autocompletado, disparar toggle */
    var origDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (origDescriptor && origDescriptor.set) {
      Object.defineProperty(selLogTipo, 'value', {
        configurable: true,
        get: function () { return origDescriptor.get.call(this); },
        set: function (v) { origDescriptor.set.call(this, v); toggleLogTemp(); }
      });
    }
    selLogTipo.addEventListener('input', toggleLogTemp);
    selLogTipo.addEventListener('change', toggleLogTemp);
  }
  btn = $('log_btnConsultar'); if (btn) btn.addEventListener('click', logConsultarDespacho);
  btn = $('log_btnCombinado'); if (btn) btn.addEventListener('click', logGuardarYDescargar);
  btn = $('log_btnLimpiar'); if (btn) btn.addEventListener('click', logLimpiar);

  // Checkbox "Seleccionar todos" en tabla de despacho
  var chkAll = $('log_chk_all');
  if (chkAll) chkAll.addEventListener('change', function () {
    var checkboxes = document.querySelectorAll('.log-row-chk');
    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].checked = chkAll.checked;
    }
    logActualizarSeleccion();
  });
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

  // Tipo de Recepcion: alternar etiqueta Factura / Traslado
  var rExt = $('r_externa'), rInt = $('r_interna');
  if (rExt) rExt.addEventListener('change', toggleLabelRecepcion);
  if (rInt) rInt.addEventListener('change', toggleLabelRecepcion);
  toggleLabelRecepcion(); // inicializar

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
