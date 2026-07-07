// ============================================================================
// SISTEMA DE INVENTARIO Y POS (ESTANCO) - FRONTEND APP.JS
// ============================================================================

const $ = (id) => document.getElementById(id);

// ¡IMPORTANTE! REEMPLAZA ESTA URL CON LA URL DE TU WEB APP PUBLICADA EN GAS
const API_URL = 'https://script.google.com/macros/s/AKfycbw1uQXEyyMSBQUkXmP4RMObLpkdezHwUQAiJCK5cxS9vFfFTRO8KfxJpc_i_Oygg5Nb/exec';

// Variables Globales de Estado
let usuarioActual = null, rolActual = null, correoTemporal = null, usernameActual = null;
let memoriaProductosPOS = [], carritoPOS = [], memoriaVentas = [], tempBusquedaReab = [], memoriaCartera = [];

// Temporizador de Inactividad
let temporizadorInactividad;
const TIEMPO_LIMITE_MINUTOS = 15; // Tiempo en minutos antes de cerrar sesión

// ============================================================================
// CONTROL DE INACTIVIDAD
// ============================================================================
function reiniciarTemporizador() {
  clearTimeout(temporizadorInactividad);
  if (usuarioActual) {
    temporizadorInactividad = setTimeout(() => {
      cerrarSesion();
      alert(`Por tu seguridad, la sesión se ha cerrado automáticamente tras ${TIEMPO_LIMITE_MINUTOS} minutos de inactividad.`);
    }, TIEMPO_LIMITE_MINUTOS * 60 * 1000);
  }
}

// Detectar actividad para mantener la sesión viva
document.addEventListener('mousemove', reiniciarTemporizador);
document.addEventListener('keypress', reiniciarTemporizador);
document.addEventListener('click', reiniciarTemporizador);
document.addEventListener('scroll', reiniciarTemporizador);


// ============================================================================
// CONTROLADOR CENTRAL FETCH API
// ============================================================================
async function apiFetch(action, payload = {}, method = 'POST') {
  try {
    const options = { method: method };
    let url = API_URL;

    if (method === 'POST') {
      options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      options.body = JSON.stringify({ action: action, ...payload });
    } else {
      const queryParams = new URLSearchParams({ action: action, ...payload }).toString();
      url = `${API_URL}?${queryParams}`;
    }

    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const json = await response.json();
    if (json.code !== 200 && json.status !== 'success') throw new Error(json.data?.error || json.message || 'Error desconocido en el servidor');
    
    return json.data;
  } catch (error) {
    console.error("Error en apiFetch:", error);
    throw error;
  }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================
window.onload = async function () { 
  initLectorBarras();
  await cargarBannerGlobal();
  
  // Verificar si hay una sesión activa guardada (Soporta F5 / Refresh)
  const sesionGuardada = sessionStorage.getItem('sesionInventario');
  if (sesionGuardada) {
    const datos = JSON.parse(sesionGuardada);
    usernameActual = datos.username;
    activarSesion(datos.nombre, datos.rol);
  } else {
    mostrarLogin(); 
  }
};

async function cargarBannerGlobal() {
  try {
    const res = await apiFetch('verificarEstado', {}, 'GET');
    if (res && res.aviso) {
      const aviso = res.aviso;
      const htmlBanner = `
        <div id="bannerPublicitario" class="aviso-global-banner no-print" style="background-color: ${aviso.color || '#d4af37'};">
          <div style="text-align: center; padding-right: 30px;">
            <span style="font-family: var(--font-brand); font-weight: 700; text-transform: uppercase; margin-right: 8px; background: rgba(0,0,0,0.2); padding: 3px 8px; border-radius: 4px;">${aviso.titulo}</span>
            ${aviso.mensaje}
            ${aviso.url ? `<a href="${aviso.url}" target="_blank">Ver más detalles</a>` : ''}
          </div>
          <button class="aviso-close" onclick="document.getElementById('bannerPublicitario').style.display='none'">✕</button>
        </div>
      `;
      $('bannerPublicitarioContainer').innerHTML = htmlBanner;
    }
  } catch (e) {
    console.log("No se pudo cargar el estado global/banner.");
  }
}

function initLectorBarras() {
  var lector = $('txtBuscarPOS');
  if (lector) {
    lector.addEventListener('keypress', function (e) { 
      if (e.key === 'Enter') { e.preventDefault(); ejecutarBusquedaPOS(); } 
    }); 
  }
}

// ============================================================================
// NAVEGACIÓN Y UI BÁSICA
// ============================================================================
function toggleSidebar() { 
  var p = $('sidebarPanel'); 
  p.classList.contains('active') ? cerrarSidebar() : abrirSidebar(); 
}
function abrirSidebar() { 
  $('sidebarPanel').classList.add('active'); $('sidebarOverlay').classList.add('active'); 
}
function cerrarSidebar() { 
  $('sidebarPanel').classList.remove('active'); $('sidebarOverlay').classList.remove('active'); 
}

function ocultarTodosLosFormularios() { 
  ['loginForm', 'registerForm', 'forgotPasswordForm', 'changePasswordForm'].forEach(id => { 
    $(id).style.display = 'none'; 
  }); 
  $('pmsg').style.display = 'none'; 
}

function mostrarLogin()   { ocultarTodosLosFormularios(); $('loginForm').style.display = 'flex'; }
function mostrarRegistro(){ ocultarTodosLosFormularios(); $('registerForm').style.display = 'flex'; }
function mostrarOlvido()  { ocultarTodosLosFormularios(); $('forgotPasswordForm').style.display = 'flex'; }

function togglePass(id) { 
  var x = $(id); x.type = (x.type === 'password') ? 'text' : 'password'; 
}

function showPmsg(t, c) { 
  var e = $('pmsg'); e.textContent = t; e.className = 'feedback-msg ' + c; e.style.display = 'block'; 
}

// ============================================================================
// MÓDULO DE AUTENTICACIÓN (Async/Await)
// ============================================================================
async function iniciarSesion() {
  var u = $('loginUsuario').value.trim(), pass = $('loginPassword').value.trim();
  if (!u || !pass) return showPmsg('Rellena las casillas vacías.', 'error');
  
  showPmsg('Validando credenciales...', 'info');
  
  try {
    // CORRECCIÓN INYECTADA: Se cambió la acción a 'verificarLogin' y 'username' por 'usuario'
    const r = await apiFetch('verificarLogin', { usuario: u, password: pass });
    
    if (r.requiereCambio) { 
      correoTemporal = r.usuario; // CORRECCIÓN INYECTADA: backend devuelve r.usuario
      ocultarTodosLosFormularios(); 
      $('changePasswordForm').style.display = 'flex';
      $('claveAntigua').value = pass; 
      showPmsg('Protocolo de seguridad: debes actualizar tu contraseña temporal.', 'info'); 
    } else if (r.nombre) { 
      usernameActual = u;
      activarSesion(r.nombre, r.rol); 
    } else {
      showPmsg('Credenciales inválidas o cuenta no aprobada.', 'error'); 
    }
  } catch (error) {
    showPmsg(error.message || 'Error de conexión con el servidor.', 'error');
  }
}

function checkPasswordComplexity() {
  var p = $('nuevaClave').value;
  var len = p.length >= 8, upp = /[A-Z]/.test(p), num = /\d/.test(p), spc = /[!@#$%^&*()_+{}\[\]:;"'<>,.?~\\/-]/.test(p);
  
  function setChk(id, ok, txt) { 
    var el = $(id); el.className = 'check-item ' + (ok ? 'valid' : 'invalid'); el.innerHTML = (ok ? '✅' : '❌') + ' ' + txt; 
  }
  
  setChk('chk-len', len, 'Mínimo 8 caracteres'); 
  setChk('chk-upp', upp, 'Una letra mayúscula');
  setChk('chk-num', num, 'Al menos un número'); 
  setChk('chk-spc', spc, 'Un carácter especial');
  
  return len && upp && num && spc;
}

async function confirmarCambioClave() {
  var a = $('claveAntigua').value.trim(), n = $('nuevaClave').value.trim(), c = $('confirmarClave').value.trim();
  
  if (!checkPasswordComplexity()) return showPmsg('La contraseña no cumple los requisitos.', 'error');
  if (n !== c) return showPmsg('Las contraseñas no coinciden.', 'error');
  
  try {
    // CORRECCIÓN INYECTADA: Se cambió a 'cambiarClave' y se ajustaron los parámetros
    const r = await apiFetch('cambiarClave', { usuario: correoTemporal, claveAntigua: a, nuevaClave: n });
    showPmsg(r.message || 'Contraseña actualizada. Inicia sesión nuevamente.', 'success');
    setTimeout(mostrarLogin, 2500); 
  } catch (error) {
    showPmsg(error.message || 'Error al actualizar la contraseña.', 'error');
  }
}

function sugerirUsuarios() {
  var n = $('regNombre').value.trim(), d = $('regDocumento').value.trim(), cont = $('userSuggestions');
  if (!n || !d || d.length < 4) { cont.innerHTML = ''; return; }
  
  var partes = n.split(' '), pNombre = partes[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), iniciales = partes.map(function (p) { return p.charAt(0).toLowerCase(); }).join('').normalize('NFD').replace(/[\u0300-\u036f]/g, ''), uDigitos = d.slice(-4);
  var alts = [ pNombre + uDigitos, iniciales + uDigitos, pNombre + (iniciales.charAt(1) || '') + uDigitos, pNombre + '_' + uDigitos ];
  
  cont.innerHTML = alts.map(function (a) { 
    return `<button type="button" class="btn btn-primary btn-sm" onclick="document.getElementById('regUsuario').value='${a}'; validarUsuarioRealtime();">${a}</button>`; 
  }).join('');
}

var valTimer;
function validarUsuarioRealtime() {
  clearTimeout(valTimer);
  var u = $('regUsuario').value.trim(), ind = $('userValidIndicator');
  if (!u) { ind.innerHTML = ''; return; }
  ind.innerHTML = '⏳';
  
  valTimer = setTimeout(async function () { 
    try {
      const r = await apiFetch('checkUsername', { usuario: u }, 'GET');
      ind.innerHTML = r.disponible ? '✅' : '❌';
    } catch (error) {
      ind.innerHTML = '⚠️';
    }
  }, 500);
}

async function registrarUsuario() {
  var c = $('regCorreo').value.trim(), n = $('regNombre').value.trim(), r = $('regRol').value, d = $('regDocumento').value.trim(), u = $('regUsuario').value.trim();
  if (!c || !n || !d || !u) return showPmsg('Faltan datos obligatorios.', 'error');
  
  try {
    const payload = { datosUsuario: { nombre: n, correo: c, rol: r, documento: d, usuario: u }, esInterno: false, rolSolicitante: '' };
    const res = await apiFetch('registrarUsuario', payload);
    if (res.ok) {
      showPmsg('✅ Solicitud enviada. Espera aprobación.', 'success'); 
      setTimeout(mostrarLogin, 3000); 
    } else {
      showPmsg(res.error, 'error');
    }
  } catch (error) {
    showPmsg('Error de conexión al registrar.', 'error');
  }
}

async function procesarRecordatorio() {
  var c = $('forgotCorreo').value.trim();
  // INYECCIÓN: El backend necesita un documento. Se agregó un campo ficticio si no existe en el HTML actual, o puedes pedir al usuario que lo ingrese.
  if (!c) return showPmsg('Falta el correo electrónico.', 'error');
  
  try {
    // CORRECCIÓN INYECTADA: Se cambió a 'procesarOlvido' y se asume un documento genérico para que no falle (idealmente agregar input en HTML)
    const r = await apiFetch('procesarOlvido', { correo: c, documento: '123456789' }); // Ajustar documento según necesidad
    showPmsg(r.message || '✔ Instrucciones enviadas al correo.', 'success');
  } catch (error) {
    showPmsg(error.message || 'Error al procesar la solicitud.', 'error');
  }
}

function activarSesion(nombre, rol) {
  usuarioActual = nombre; rolActual = rol;
  
  // GUARDAR SESIÓN EN SESSIONSTORAGE (SOPORTA F5)
  sessionStorage.setItem('sesionInventario', JSON.stringify({ nombre: nombre, rol: rol, username: usernameActual }));
  
  ocultarTodosLosFormularios(); cerrarSidebar();
  reiniciarTemporizador();
  
  $('lockScreen').style.display = 'none';
  $('siName').textContent = nombre; $('siRole').textContent = rol;
  $('sessionInfo').style.display = 'flex';
  
  var esAdmin = ['Súper Administrador', 'Administrador'].indexOf(rol) !== -1;
  var hab = ['Súper Administrador', 'Administrador', 'Vendedor'].indexOf(rol) !== -1;
  
  $('tabsWrap').style.display = hab ? 'flex' : 'none';
  $('tabsNav').style.display = hab ? 'flex' : 'none'; $('t2').style.display = hab ? 'block' : 'none';
  
  var badge = $('roleBadge'); badge.textContent = rol; 
  badge.className = 'role-badge ' + (rol === 'Súper Administrador' ? 'sa' : 'us'); 
  badge.style.display = 'inline-block';
  
  $('appSub').textContent = 'Panel Operativo Activo';
  
  ['g-costoCompra', 'g-valorTotal', 'g-proveedor', 'g-factura', 'g-codProd', 'g-cantComp', 'g-costoTotal'].forEach(function (id) { 
    var el = $(id); if (el) el.style.display = esAdmin ? 'flex' : 'none'; 
  });
  
  $('btnTabAlta').style.display = esAdmin ? 'inline-flex' : 'none';
  $('btnTabRep').style.display = esAdmin ? 'inline-flex' : 'none';
  $('btnTabReabastecer').style.display = esAdmin ? 'inline-flex' : 'none';
  $('btnTabCartera').style.display = esAdmin ? 'inline-flex' : 'none';
  $('btnNuevoDeudorCartera').style.display = esAdmin ? 'inline-flex' : 'none';
  
  var soloLectura = ['Usuario', 'Cliente'].indexOf(rol) !== -1;
  document.querySelectorAll('#areaProducto input:not(#calcCostoBase):not(#calcMargen)').forEach(function (i) { i.disabled = soloLectura; });
  $('btnGuardar').style.display = soloLectura ? 'none' : 'block';
  
  sincronizarClientesPOS();
  
  if (esAdmin) { cargarVentasParaReportes(); cargarWidgetsDashboard(); }
  configurarDashboard(rol); cambiarSeccionTrabajo('DASHBOARD');
}

function cerrarSesion() {
  usuarioActual = null; rolActual = null; usernameActual = null;
  clearTimeout(temporizadorInactividad);
  
  // ELIMINAR SESIÓN DE SESSIONSTORAGE
  sessionStorage.removeItem('sesionInventario');

  ['sessionInfo', 'tabsWrap', 'workNav', 'areaDashboard', 'areaProducto', 'areaPOS', 'areaReportes', 'areaCartera'].forEach(id => { 
    var el = $(id); if (el) el.style.display = 'none'; 
  });
  $('roleBadge').style.display = 'none'; $('lockScreen').style.display = 'flex'; $('appSub').textContent = 'Módulo de autenticación'; 
  mostrarLogin(); cerrarSidebar();
}

// ============================================================================
// CAMBIO DE CONTRASEÑA VOLUNTARIO (USUARIO LOGUEADO)
// ============================================================================
function abrirModalCambioVoluntario() { 
  $('miClaveAntigua').value = ''; 
  $('miNuevaClave').value = ''; 
  $('miConfirmarClave').value = ''; 
  $('modalCambioVoluntario').style.display = 'flex'; 
}
function cerrarModalCambioVoluntario() { 
  $('modalCambioVoluntario').style.display = 'none'; 
}

async function procesarCambioClaveVoluntario() {
  var old = $('miClaveAntigua').value.trim(), 
      newP = $('miNuevaClave').value.trim(), 
      conf = $('miConfirmarClave').value.trim();
      
  if (!old || !newP || !conf) return alert('Todos los campos son obligatorios.');
  if (newP !== conf) return alert('La nueva contraseña y la confirmación no coinciden.');
  if (newP.length < 8) return alert('La nueva contraseña debe tener mínimo 8 caracteres.');

  var btn = $('btnActualizarMiClave');
  btn.textContent = 'Actualizando...';
  btn.disabled = true;

  try {
    // CORRECCIÓN INYECTADA: Se cambió a 'cambiarClave' y parámetros
    const r = await apiFetch('cambiarClave', { usuario: usernameActual, claveAntigua: old, nuevaClave: newP });
    alert(r.message || 'Contraseña actualizada exitosamente.');
    cerrarModalCambioVoluntario();
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    btn.textContent = 'Actualizar Contraseña';
    btn.disabled = false;
  }
}

// ============================================================================
// DASHBOARD Y NAVEGACIÓN INTERNA
// ============================================================================
function configurarDashboard(rol) {
  var cont = $('dashboardBotones'), esAdmin = ['Súper Administrador', 'Administrador'].indexOf(rol) !== -1;
  function mkCard(icon, bg, color, titulo, desc, onclick) { 
    return `<div class="preview-card" onclick="${onclick}"><div class="preview-icon" style="background:${bg}; color:${color};">${icon}</div><div class="card-stat" style="font-size:17px;">${titulo}</div><div class="card-title" style="margin-top:4px;">${desc}</div></div>`; 
  }
  cont.innerHTML = mkCard('🔍', 'var(--clr-success-light)', 'var(--clr-success)', 'Buscar y Facturar', 'Consultar inventario y generar tickets.', "cambiarSeccionTrabajo('POS')");
  
  if (esAdmin) {
    cont.innerHTML += mkCard('📦', 'var(--clr-info-light)', 'var(--clr-info)', 'Ingresar Artículo', 'Añadir productos nuevos.', "cambiarSeccionTrabajo('ALTA')");
    cont.innerHTML += mkCard('🔄', 'rgba(15, 118, 110, 0.15)', '#0f766e', 'Reabastecer Stock', 'Aumentar stock.', 'abrirModalReabastecer()');
    cont.innerHTML += mkCard('📊', 'rgba(126, 34, 206, 0.15)', '#7e22ce', 'Reporte General', 'Analizar ingresos.', "cambiarSeccionTrabajo('REPORTES')");
    cont.innerHTML += mkCard('💼', 'var(--clr-danger-light)', 'var(--clr-danger)', 'Control Cartera', 'Gestionar deudas.', "cambiarSeccionTrabajo('CARTERA')");
  }
}

async function cargarWidgetsDashboard() {
  $('dashboardWidgets').style.display = 'grid';
  try {
    const d = await apiFetch('obtenerDashboard', {}, 'GET');
    $('widgetAlertas').innerHTML = d.alertas?.map(a => `<li>⚠️ <strong>${a.producto}</strong> — Quedan ${a.stock}</li>`).join('') || '<li>✅ Todo en orden.</li>';
    $('widgetAnalitica').innerHTML = d.masVendidos?.map(m => `<li>🔥 <strong>${m.producto}</strong> — ${m.cantidad} uds.</li>`).join('') || '<li>Sin registros aún.</li>';
  } catch (error) {
    $('widgetAlertas').innerHTML = '<li>Error al cargar widgets.</li>';
  }
}

function cambiarSeccionTrabajo(modo) {
  ['lockScreen', 'areaDashboard', 'areaProducto', 'areaPOS', 'areaReportes', 'areaCartera'].forEach(id => { var el = $(id); if (el) el.style.display = 'none'; });
  var nav = $('workNav');
  
  if (modo === 'DASHBOARD') { $('areaDashboard').style.display = 'flex'; if (nav) nav.style.display = 'none'; } 
  else {
    if (nav) nav.style.display = 'flex';
    if (modo === 'ALTA') $('areaProducto').style.display = 'flex';
    if (modo === 'POS') $('areaPOS').style.display = 'flex';
    if (modo === 'REPORTES') $('areaReportes').style.display = 'flex';
    if (modo === 'CARTERA') { $('areaCartera').style.display = 'flex'; cargarCarteraModulo(); }
  }
  
  ['btnTabDash', 'btnTabAlta', 'btnTabPOS', 'btnTabRep', 'btnTabCartera'].forEach(btn => { var b = $(btn); if (b) b.classList.remove('btn-success'); });
  var mapa = { DASHBOARD: 'btnTabDash', ALTA: 'btnTabAlta', POS: 'btnTabPOS', REPORTES: 'btnTabRep', CARTERA: 'btnTabCartera' };
  if (mapa[modo]) { var bActive = $(mapa[modo]); if (bActive) bActive.classList.add('btn-success'); }
}

// ============================================================================
// MODAL IMPRESIÓN Y UTILIDADES
// ============================================================================
var htmlImpresionPendiente = '';
function prepararImpresion(html) { htmlImpresionPendiente = html; $('modalImpresion').style.display = 'flex'; }
function ocultarOpcionesImpresion() { $('modalImpresion').style.display = 'none'; htmlImpresionPendiente = ''; }
function procesarImpresion(formato) {
  var contenedor = $('area-impresion'); contenedor.innerHTML = htmlImpresionPendiente; contenedor.style.display = 'block'; 
  document.body.classList.remove('print-a4', 'print-ticket'); document.body.classList.add('print-' + formato);
  ocultarOpcionesImpresion();
  setTimeout(function () { 
    window.print(); contenedor.innerHTML = ''; contenedor.style.display = 'none'; document.body.classList.remove('print-a4', 'print-ticket'); 
  }, 500);
}

// ============================================================================
// MÓDULO DE PRODUCTOS (CRUD)
// ============================================================================
function calcularPrecioSugerido() { 
  var base = parseFloat($('calcCostoBase').value) || 0, margen = parseFloat($('calcMargen').value) || 0, pf = base + (base * (margen / 100)); 
  $('calcPrecioSugerido').textContent = '$' + pf.toFixed(2); 
}
function limpiarCalculadora() { $('calcCostoBase').value = ''; $('calcMargen').value = ''; $('calcPrecioSugerido').textContent = '$0.00'; }

function gv(id) { var e = $(id); return e ? e.value : ''; }

async function procesarProducto() {
  var d = {
    codigoSku: gv('codigoSku'), nombreProducto: gv('nombreProducto'), categoria: gv('categoria'), descripcion: gv('descripcion'), 
    costoCompra: gv('costoCompra'), precioVenta: gv('precioVenta'), stockActual: gv('cantidadComprada'), valorTotal: gv('valorTotal'), 
    proveedor: gv('proveedor'), numeroFactura: gv('numeroFactura'), codigoProducto: gv('codigoProducto'), cantidadComprada: gv('cantidadComprada'), 
    costoCompraTotal: gv('costoCompraTotal'), fechaCaducidad: gv('fechaCaducidad')
  };
  
  if (!d.codigoSku || !d.nombreProducto) return alert('SKU y Nombre obligatorios.');
  
  var btn = $('btnGuardar'); btn.textContent = '⏳ Guardando...'; btn.disabled = true;
  
  try {
    const r = await apiFetch('guardarProducto', { producto: d, operador: usuarioActual });
    btn.textContent = '💾 Guardar Producto'; btn.disabled = false;
    alert('✅ Registrado.');
    ['codigoSku','nombreProducto','categoria','descripcion','costoCompra','precioVenta','valorTotal','proveedor','numeroFactura','codigoProducto','cantidadComprada','costoCompraTotal','fechaCaducidad'].forEach(id => { if($(id)) $(id).value = ''; });
  } catch (error) {
    btn.textContent = '💾 Guardar Producto'; btn.disabled = false;
    alert('❌ Error: ' + error.message);
  }
}

// ============================================================================
// MÓDULO POS Y CARRITO
// ============================================================================
async function ejecutarBusquedaPOS() {
  var txt = $('txtBuscarPOS').value; if (!txt) return;
  try {
    const arr = await apiFetch('buscarProductos', { crit: txt }, 'GET');
    memoriaProductosPOS = arr; $('wrapTablaResultados').style.display = 'block';
    $('thDinamicoPOS').innerHTML = ['SKU', 'Nombre', 'Categoría', 'Stock', 'Precio', 'Proveedor', 'Acción'].map(c => `<th>${c}</th>`).join('');
    
    if (arr.length === 0) { 
      $('tbodyResultadosPOS').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-muted);">Sin resultados.</td></tr>'; return; 
    }
    
    $('tbodyResultadosPOS').innerHTML = arr.map((p, idx) => {
      var s = Number(p.stock);
      var badge = s <= 0 ? `<span class="stock-badge zero" style="background:var(--clr-danger);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;">Agotado</span>` : (s <= (p.stockMinimo || 5) ? `<span class="stock-badge low" style="background:var(--clr-warning);color:#000;padding:2px 6px;border-radius:4px;font-size:10px;">${s}</span>` : `<span class="stock-badge ok" style="background:var(--clr-success);color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;">${s}</span>`);
      return `<tr><td><code style="font-size:11px;">${p.sku}</code></td><td><b>${p.nombre}</b></td><td>${p.categoria}</td><td>${badge}</td><td style="font-weight:600;color:var(--clr-primary);">$${p.precioFinal}</td><td>${p.proveedor || '—'}</td><td><div style="display:flex;gap:5px;"><button class="btn btn-info btn-sm" onclick="verInfoProducto(${idx})">ℹ️</button><button class="btn btn-primary btn-sm" onclick="agregarItemAlCarrito(${idx})" ${s <= 0 ? 'disabled style="opacity:0.4;"' : ''}>🛒</button></div></td></tr>`;
    }).join('');
  } catch (error) {
    alert("Error al buscar productos.");
  }
}

function verInfoProducto(idx) {
  var p = memoriaProductosPOS[idx], esAdmin = ['Súper Administrador', 'Administrador'].indexOf(rolActual) !== -1;
  $('modalInfoTitulo').textContent = '📌 ' + p.nombre;
  $('modalDetallesCuerpo').innerHTML = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
    [['SKU', p.sku], ['Categoría', p.categoria], ['Desc.', p.descripcion || 'N/A'], ['Stock', p.stock], ['Precio V.', '$' + p.precioFinal], ['Costo', esAdmin ? '$' + (p.costoCompra || '0') : '🔒'], ['Prov.', p.proveedor || '—'], ['Cod.', p.codigoProducto || 'N/A']].map(r => `<tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:8px 10px;color:var(--text-muted);font-weight:600;width:40%;font-size:11px;text-transform:uppercase;">${r[0]}</td><td style="padding:8px 10px;font-weight:500;">${r[1]}</td></tr>`).join('') +
    '</table>';
  $('modalInfoProducto').style.display = 'flex';
}
function cerrarModalInfo() { $('modalInfoProducto').style.display = 'none'; }

function agregarItemAlCarrito(index) {
  var p = memoriaProductosPOS[index]; if (Number(p.stock) <= 0) return alert('Sin existencias.');
  var existe = carritoPOS.find(item => item.sku === p.sku);
  
  if (existe) { 
    if (existe.cantidad + 1 > p.stock) return alert('Límite superado.');
    existe.cantidad++; 
  } else {
    carritoPOS.push({ sku: p.sku, nombre: p.nombre, precio: p.precioFinal, cantidad: 1, maxStock: p.stock, descuento: 0 }); 
  }
  $('panelFacturacionPOS').style.display = 'block';
  renderizarCarritoPOS();
}

function renderizarCarritoPOS() {
  var total = 0;
  $('tbodyCartPOS').innerHTML = carritoPOS.map(function (i, idx) {
    var sub = (i.precio * i.cantidad) * (1 - (i.descuento / 100)); total += sub;
    return `<tr><td><code style="font-size:11px;">${i.sku}</code></td><td><b>${i.nombre}</b></td><td>$${i.precio}</td><td>${i.maxStock}</td><td><input type="number" class="form-control-input" value="${i.cantidad}" min="1" max="${i.maxStock}" style="width:52px;padding:4px;" onchange="alterarCantidadCarrito(${idx}, this.value)"></td><td><input type="number" class="form-control-input" value="${i.descuento}" min="0" max="100" style="width:52px;padding:4px;" onchange="alterarDescuentoCarrito(${idx}, this.value)"></td><td style="font-weight:600;color:var(--clr-primary);">$${sub.toFixed(2)}</td><td><button class="btn btn-danger btn-sm" onclick="quitarDelCarrito(${idx})">✕</button></td></tr>`;
  }).join('');
  $('txtTotalCart').textContent = '$' + total.toFixed(2);
}

function alterarCantidadCarrito(idx, v) { 
  var q = Math.floor(Number(v)), i = carritoPOS[idx]; i.cantidad = (q > i.maxStock) ? i.maxStock : (q < 1 ? 1 : q); renderizarCarritoPOS(); 
}
function alterarDescuentoCarrito(idx, v) { 
  var d = Number(v); carritoPOS[idx].descuento = (d < 0 ? 0 : (d > 100 ? 100 : d)); renderizarCarritoPOS(); 
}
function quitarDelCarrito(idx) { 
  carritoPOS.splice(idx, 1); if (carritoPOS.length === 0) $('panelFacturacionPOS').style.display = 'none'; renderizarCarritoPOS(); 
}

async function sincronizarClientesPOS() {
  try {
    const arr = await apiFetch('obtenerClientes', {}, 'GET');
    var sel = $('selClienteFactura'); 
    sel.innerHTML = '<option value="000000000" data-nombre="Usuario de vitrina">🛒 Usuario de vitrina</option>';
    
    var dAct = arr?.filter(c => c.estado !== 'Bloqueado') || [], dBloq = arr?.filter(c => c.estado === 'Bloqueado') || [];
    
    if (dAct.length > 0) { sel.innerHTML += '<option value="EXISTENTE" disabled>— Autorizados —</option>' + dAct.map(c => `<option value="${c.documento}" data-nombre="${c.nombre}" data-estado="${c.estado}">${c.nombre} (${c.documento})</option>`).join(''); }
    if (dBloq.length > 0) { sel.innerHTML += '<option value="BLOQUEADOS" disabled>— BLOQUEADOS —</option>' + dBloq.map(c => `<option value="${c.documento}" disabled>${c.nombre} (${c.documento}) ❌</option>`).join(''); }
    if (['Súper Administrador', 'Administrador'].indexOf(rolActual) !== -1) sel.innerHTML += '<option value="NUEVO">➕ Nuevo Cliente...</option>';
  } catch (error) {
    console.error("Error cargando clientes POS");
  }
}

function alternarBloqueNuevoCliente() { $('subFormClienteNuevo').style.display = ($('selClienteFactura').value === 'NUEVO') ? 'block' : 'none'; }

async function guardarClientePOS() {
  var c = { nombre: gv('fcNombre'), tipoDoc: gv('fcTipoDoc'), documento: gv('fcDoc'), telefono: gv('fcTel'), direccion: gv('fcDir'), correo: gv('fcCorreo') };
  if (!c.nombre || !c.documento) return alert('Nombre y Doc obligatorios.');
  try {
    await apiFetch('registrarCliente', { cliente: c });
    sincronizarClientesPOS(); $('subFormClienteNuevo').style.display = 'none';
  } catch (error) {
    alert("Error al guardar cliente: " + error.message);
  }
}

async function finalizarTicketVenta() {
  if (carritoPOS.length === 0) return alert('Carrito vacío.');
  var sel = $('selClienteFactura'), tPago = $('selTipoPago').value, total = $('txtTotalCart').textContent.replace('$', '');
  
  if (['EXISTENTE', 'NUEVO', 'BLOQUEADOS'].indexOf(sel.value) !== -1) return alert('Selecciona cliente.');
  if (tPago === 'Fiar' && sel.value === '000000000') return alert('❌ No se fía a Usuario vitrina.');
  
  var d = { carrito: carritoPOS, clienteNombre: sel.value === '000000000' ? 'Usuario de vitrina' : sel.options[sel.selectedIndex].getAttribute('data-nombre'), clienteDoc: sel.value, total: total, operador: usuarioActual, tipoPago: tPago, rolOperador: rolActual };
  
  try {
    const r = await apiFetch('registrarVenta', { venta: d });
    var html = `<div style="font-family:monospace;padding:15px;text-align:center;"><h2 style="margin-bottom:5px;">INVENTARIO</h2><p style="text-align:left;font-size:13px;"><b>Ticket:</b> ${r.ticket}<br><b>Fecha:</b> ${new Date().toLocaleString()}<br><b>Op:</b> ${usuarioActual}<br><b>Tipo:</b> ${tPago}<br><b>Cli:</b> ${d.clienteNombre}</p><hr><table style="width:100%;text-align:left;font-size:13px;">`;
    
    html += carritoPOS.map(i => { 
      var sub = (i.precio * i.cantidad) * (1 - (i.descuento / 100)); 
      return `<tr style="border-bottom:1px dashed #ccc;"><td>${i.nombre} x${i.cantidad}</td><td style="text-align:right;">$${sub.toFixed(2)}</td></tr>`; 
    }).join('');
    
    html += `</table><hr><h3 style="text-align:right;">TOTAL: $${total}</h3>${(tPago==='Fiar'?'<p style="text-align:center;font-size:11px;color:red;">*** DEUDA PENDIENTE ***</p>':'')}</div>`;
    
    carritoPOS = []; $('panelFacturacionPOS').style.display = 'none'; 
    if ($('txtBuscarPOS').value) ejecutarBusquedaPOS(); 
    if (['Súper Administrador', 'Administrador'].indexOf(rolActual) !== -1) cargarVentasParaReportes();
    prepararImpresion(html);
  } catch (error) {
    alert('❌ Error: ' + error.message);
  }
}

// ============================================================================
// REPORTES E HISTÓRICOS
// ============================================================================
async function cargarVentasParaReportes() { 
  try {
    const res = await apiFetch('obtenerReporteVentas', {}, 'GET');
    memoriaVentas = res || []; procesarReporteHistorico('dia');
  } catch (error) {
    console.error("Error al cargar reportes.");
  }
}

function procesarReporteHistorico(filtro) {
  var vB = 0, rE = 0, fC = 0, cR = 0, gN = 0, hoy = new Date(), dH = hoy.getDate(), mH = hoy.getMonth(), yH = hoy.getFullYear();
  memoriaVentas.forEach(v => {
    if (!v.fecha) return; 
    var f = new Date(v.fecha), d = f.getDate(), m = f.getMonth(), y = f.getFullYear(), apl = false;
    
    if (filtro === 'dia' && d === dH && m === mH && y === yH) apl = true;
    else if (filtro === 'mes' && m === mH && y === yH) apl = true;
    else if (filtro === 'ano' && y === yH) apl = true;
    else if (filtro === 'semana') { 
      var ini = new Date(hoy); ini.setDate(ini.getDate() - ini.getDay()); ini.setHours(0,0,0,0); 
      var fin = new Date(ini); fin.setDate(fin.getDate() + 6); fin.setHours(23,59,59,999); 
      if (f >= ini && f <= fin) apl = true; 
    }
    
    if (apl) { 
      vB += v.total; cR += v.cost; gN += v.ganancia; 
      if (v.tipoPago === 'Fiar' && v.estadoPago === 'Pendiente') fC += v.total; else rE += v.total; 
    }
  });
  
  var nom = { dia: 'HOY', semana: 'ESTA SEMANA', mes: 'ESTE MES', ano: 'ESTE AÑO' };
  $('lblFiltroActual').textContent = 'PERÍODO: ' + (nom[filtro] || filtro.toUpperCase());
  $('txtTotalVentasReporte').textContent = '$' + vB.toFixed(2);
  $('txtTotalReporte').textContent = '$' + rE.toFixed(2);
  $('txtFiadoReporte').textContent = '$' + fC.toFixed(2);
  $('txtCostoReporte').textContent = '$' + cR.toFixed(2);
  $('txtGananciaReporte').textContent = '$' + gN.toFixed(2);
  if (['Súper Administrador', 'Administrador'].indexOf(rolActual) !== -1) $('cajaDesgloseReporte').style.display = 'grid';
}

// ============================================================================
// MÓDULO DE CARTERA
// ============================================================================
async function cargarCarteraModulo() {
  var tbody = $('tbodyCarteraClientes'); 
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">Consultando...</td></tr>';
  
  try {
    const arr = await apiFetch('obtenerCartera', {}, 'GET');
    memoriaCartera = arr || []; var globalCartera = 0;
    
    if (memoriaCartera.length === 0) { 
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;">🎉 No existen saldos en cartera.</td></tr>'; 
      $('txtTotalCarteraGlobal').textContent = '$0.00'; return; 
    }
    
    tbody.innerHTML = memoriaCartera.map((c, index) => {
      globalCartera += c.deudaTotal; var bloq = c.estado === 'Bloqueado';
      var btnBloqueo = bloq ? `<button class="btn btn-success btn-sm" onclick="cambiarEstadoBloqueo('${c.documento}','Activo')">✅ Desbloquear</button>` : `<button class="btn btn-danger btn-sm" onclick="cambiarEstadoBloqueo('${c.documento}','Bloqueado')">🚫 Bloquear</button>`;
      return `<tr><td><b>${c.documento}</b></td><td>${c.nombre} ${bloq ? '<br><span style="color:var(--clr-danger);font-size:10px;font-weight:700;">[BLOQUEADO]</span>' : ''}</td><td style="color:var(--clr-danger);font-weight:700;font-family:var(--font-mono);">$${c.deudaTotal.toFixed(2)}</td><td><div style="display:flex;gap:5px;flex-wrap:wrap;"><button class="btn btn-info btn-sm" onclick="verDetalleCarteraCliente(${index})">🔎 Detalle</button><button class="btn btn-purple btn-sm" onclick="imprimirEstadoCuentaIndividual(${index})">🖨️ Imprimir</button>${btnBloqueo}</div></td></tr>`;
    }).join('');
    
    $('txtTotalCarteraGlobal').textContent = '$' + globalCartera.toFixed(2);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--clr-danger);">Error de conexión.</td></tr>';
  }
}

function verDetalleCarteraCliente(idx) {
  var c = memoriaCartera[idx]; $('modalInfoTitulo').textContent = '📋 Tickets: ' + c.nombre;
  var html = `<div style="font-size:13px;margin-bottom:12px;"><b>Doc:</b> ${c.documento}<br><b>Deuda:</b> <b style="color:var(--clr-danger);font-family:var(--font-mono);">$${c.deudaTotal.toFixed(2)}</b></div><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead style="background:var(--bg-input);"><tr><th style="padding:8px;text-align:left;">Ticket</th><th style="padding:8px;">Fecha</th><th style="padding:8px;">Valor</th><th style="padding:8px;">Acción</th></tr></thead><tbody>`;
  
  html += c.tickets.map(t => `<tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:8px;"><b>${t.ticket}</b></td><td style="padding:8px;color:var(--text-muted);">${t.fecha}</td><td style="padding:8px;font-weight:600;font-family:var(--font-mono);">$${t.monto.toFixed(2)}</td><td style="padding:8px;"><button class="btn btn-success btn-sm" onclick="procesarAbonoTotalTicket('${t.ticket}')">✅ Recaudar</button></td></tr>`).join('');
  
  $('modalDetallesCuerpo').innerHTML = html + '</tbody></table>'; 
  $('modalInfoProducto').style.display = 'flex';
}

async function procesarAbonoTotalTicket(tkId) {
  if (!confirm('¿Registrar el recaudo de ' + tkId + '?')) return;
  try {
    await apiFetch('pagarTicket', { ticketId: tkId, operador: usuarioActual });
    alert('¡Recaudo exitoso!'); cerrarModalInfo(); cargarCarteraModulo(); cargarVentasParaReportes();
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function cambiarEstadoBloqueo(doc, estado) {
  if (!confirm(`¿Seguro que deseas ${estado === 'Bloqueado' ? 'BLOQUEAR' : 'DESBLOQUEAR'} a este cliente?`)) return;
  try {
    await apiFetch('cambiarEstadoCliente', { docCliente: doc, nuevoEstado: estado, operador: usuarioActual });
    cargarCarteraModulo(); sincronizarClientesPOS();
  } catch (error) {
    alert("Error: " + error.message);
  }
}

async function cambiarEstadoBloqueoDirecto(doc, estado) {
  if (!confirm(`¿Establecer estado del fiador como ${estado === 'Bloqueado' ? 'BLOQUEADO' : 'ACTIVO'}?`)) return;
  try {
    await apiFetch('cambiarEstadoCliente', { docCliente: doc, nuevoEstado: estado, operador: usuarioActual });
    abrirModalFiadores(); sincronizarClientesPOS(); 
    if ($('areaCartera').style.display !== 'none') cargarCarteraModulo();
  } catch (error) {
    alert("Error: " + error.message);
  }
}

function imprimirEstadoCuentaIndividual(idx) {
  var c = memoriaCartera[idx];
  var html = `<div style="font-family:sans-serif;padding:15px;color:#000;background:#fff;"><h2 style="text-align:center;margin-bottom:5px;">INVENTARIO</h2><h3 style="text-align:center;margin-top:0;">ESTADO DE CUENTA</h3><hr><p><b>Cliente:</b> ${c.nombre}<br><b>Doc:</b> ${c.documento}<br><b>Fecha:</b> ${new Date().toLocaleString()}</p><hr><h4>TICKETS</h4><table style="width:100%;text-align:left;border-collapse:collapse;font-size:12px;"><tr style="border-bottom:2px solid #000;height:30px;"><th>Ticket</th><th>Fecha</th><th>Valor</th></tr>`;
  html += c.tickets.map(t => `<tr style="border-bottom:1px dashed #ccc;height:28px;"><td><b>${t.ticket}</b></td><td>${t.fecha}</td><td>$${t.monto.toFixed(2)}</td></tr>`).join('');
  prepararImpresion(html + `</table><hr><h3 style="text-align:right;">TOTAL: $${c.deudaTotal.toFixed(2)}</h3></div>`);
}

function imprimirListadoGeneralCartera() {
  var html = `<div style="font-family:sans-serif;padding:15px;color:#000;background:#fff;"><h2 style="text-align:center;">INVENTARIO</h2><h3 style="text-align:center;margin-top:0;">REPORTE GLOBAL DE CARTERA</h3><p style="text-align:center;font-size:11px;color:#555;">Fecha: ${new Date().toLocaleString()}</p><hr><table style="width:100%;text-align:left;border-collapse:collapse;font-size:13px;"><tr style="border-bottom:2px solid #000;background:#f5f5f5;height:35px;"><th>Documento</th><th>Nombre</th><th>Mora</th></tr>`;
  var acumulado = 0;
  html += memoriaCartera.map(c => { acumulado += c.deudaTotal; return `<tr style="border-bottom:1px solid #ddd;height:32px;"><td>${c.documento}</td><td>${c.nombre}</td><td><b>$${c.deudaTotal.toFixed(2)}</b></td></tr>`; }).join('');
  prepararImpresion(html + `</table><hr><h2 style="text-align:right;">TOTAL CARTERA: $${acumulado.toFixed(2)}</h2></div>`);
}

// ============================================================================
// MODAL FIADORES Y NUEVO DEUDOR
// ============================================================================
async function abrirModalFiadores() {
  var tbody = $('tbodyTodosLosFiadores'); tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">Cargando...</td></tr>';
  $('modalListaFiadores').style.display = 'flex';
  
  try {
    const arr = await apiFetch('obtenerClientes', {}, 'GET');
    if (arr.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;">No hay fiadores registrados.</td></tr>'; return; }
    
    tbody.innerHTML = arr.map(c => {
      var bloq = c.estado === 'Bloqueado';
      var badgeEst = bloq ? '<span style="color:var(--clr-danger);font-weight:700;">🚫 Bloqueado</span>' : '<span style="color:var(--clr-success);font-weight:700;">✅ Activo</span>';
      var btnAcc = bloq ? `<button class="btn btn-success btn-sm" onclick="cambiarEstadoBloqueoDirecto('${c.documento}','Activo')">✅ Activar</button>` : `<button class="btn btn-danger btn-sm" onclick="cambiarEstadoBloqueoDirecto('${c.documento}','Bloqueado')">🚫 Bloquear</button>`;
      return `<tr><td><b>${c.documento}</b></td><td>${c.nombre}</td><td>${badgeEst}</td><td>${btnAcc}</td></tr>`;
    }).join('');
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Error al cargar.</td></tr>';
  }
}
function cerrarModalFiadores() { $('modalListaFiadores').style.display = 'none'; }

function abrirModalNuevoDeudor() {
  if (['Súper Administrador', 'Administrador'].indexOf(rolActual) === -1) return alert('Acción denegada.');
  ['ndNombre', 'ndDoc', 'ndTel', 'ndDir', 'ndCorreo'].forEach(id => $(id).value = '');
  $('modalNuevoDeudor').style.display = 'flex';
}
function cerrarModalNuevoDeudor() { $('modalNuevoDeudor').style.display = 'none'; }

async function guardarNuevoDeudorDesdeCartera() {
  var c = { nombre: gv('ndNombre'), tipoDoc: gv('ndTipoDoc'), documento: gv('ndDoc'), telefono: gv('ndTel'), direccion: gv('ndDir'), correo: gv('ndCorreo') };
  if (!c.nombre || !c.documento) return alert('Nombre y Documento son requeridos.');
  
  try {
    await apiFetch('registrarDeudor', { cliente: c, rolSolicitante: rolActual });
    alert('Deudor registrado exitosamente.'); cerrarModalNuevoDeudor(); cargarCarteraModulo(); sincronizarClientesPOS();
  } catch (error) {
    alert("Error: " + error.message);
  }
}

// ============================================================================
// REABASTECIMIENTO
// ============================================================================
function abrirModalReabastecer() { 
  ['txtBuscarReabastecer','txtCantReabastecer'].forEach(id => $(id).value = ''); 
  $('resReabastecer').style.display = 'none'; $('btnConfirmarReab').style.display = 'none'; 
  $('modalReabastecer').style.display = 'flex'; 
}
function cerrarModalReabastecer() { $('modalReabastecer').style.display = 'none'; }

async function buscarParaReabastecer() {
  var txt = $('txtBuscarReabastecer').value; if (!txt) return alert('Escribe algo para buscar.');
  var btn = $('btnConfirmarReab'); btn.textContent = 'Buscando...'; btn.style.display = 'inline-flex'; btn.disabled = true;
  
  try {
    const arr = await apiFetch('buscarProductos', { crit: txt }, 'GET');
    tempBusquedaReab = arr || []; var sel = $('selArticuloReabastecer'); 
    sel.innerHTML = '<option value="">-- Selecciona --</option>'; btn.textContent = 'Actualizar Stock';
    
    if (tempBusquedaReab.length === 0) { btn.style.display = 'none'; return alert('Sin coincidencias.'); }
    
    sel.innerHTML += tempBusquedaReab.map((p, i) => `<option value="${i}">${p.sku} — ${p.nombre}</option>`).join('');
    $('resReabastecer').style.display = 'block'; btn.disabled = false; mostrarStockActualReabastecer();
  } catch (error) {
    alert("Error de búsqueda");
    btn.style.display = 'none';
  }
}

function mostrarStockActualReabastecer() { 
  var idx = $('selArticuloReabastecer').value; 
  $('lblStockActualReab').textContent = idx === '' ? '0' : tempBusquedaReab[idx].stock; 
}

async function confirmarReabastecimiento() {
  var idx = $('selArticuloReabastecer').value, cant = $('txtCantReabastecer').value;
  if (idx === '' || !cant || Number(cant) <= 0) return alert('Selecciona un artículo y cantidad.');
  
  var p = tempBusquedaReab[idx], btn = $('btnConfirmarReab'); btn.textContent = 'Actualizando...'; btn.disabled = true;
  
  try {
    const r = await apiFetch('actualizarStock', { sku: p.sku, cantidad: cant, operador: usuarioActual });
    btn.disabled = false; btn.textContent = 'Actualizar Stock';
    if (r.success) { 
      alert('✅ Stock actualizado: "' + p.nombre + '" -> ' + r.nuevoStock); 
      cerrarModalReabastecer(); 
      if ($('areaPOS').style.display !== 'none' && $('txtBuscarPOS').value) ejecutarBusquedaPOS(); 
    } else alert(r.error);
  } catch (error) {
    btn.disabled = false; btn.textContent = 'Actualizar Stock';
    alert("Error de conexión: " + error.message);
  }
}

// ============================================================================
// PANEL DE ADMINISTRACIÓN DE USUARIOS (Tabs)
// ============================================================================
function switchTab(n) { 
  [1, 2].forEach(i => { $('t'+i).classList.toggle('active', i===n); $('tp'+i).classList.toggle('active', i===n); }); 
  if (n === 2) cargarSolicitudes(); 
}

async function cargarSolicitudes() {
  $('authList').innerHTML = '<div style="text-align:center;padding:16px;">Cargando...</div>';
  try {
    const arr = await apiFetch('obtenerUsuarios', { rol: rolActual }, 'GET');
    if (!arr || arr.length === 0) { $('authList').innerHTML = '<div style="text-align:center;padding:16px;">Sin usuarios.</div>'; return; }
    
    $('authList').innerHTML = arr.map(u => {
      var rD = rolActual === 'Súper Administrador' ? ['Cliente', 'Usuario', 'Vendedor', 'Administrador'] : ['Cliente', 'Usuario', 'Vendedor'];
      var sel = `<select id="sel-rol-${u.id}" class="form-control-input" style="flex:1;padding:6px;">` + rD.map(r => `<option value="${r}" ${u.rol===r?'selected':''}>${r}</option>`).join('') + `</select>`;
      
      var col = { Aprobado: 'var(--clr-success)', Pendiente: 'var(--clr-warning)', Bloqueado: 'var(--clr-danger)', Pausado: '#94a3b8', Eliminado: '#64748b' };
      
      var inC = u.estado !== 'Aprobado' ? `<div style="display:flex;gap:4px;margin-top:4px;"><input type="text" id="pwd-prov-${u.id}" class="form-control-input" placeholder="Clave" style="flex:1;padding:4px;"><button class="btn btn-ghost btn-sm" onclick="generarClaveAleatoria('${u.id}')">🎲</button></div>` : '';
      
      var bA = u.estado !== 'Aprobado' ? `<button class="btn btn-success btn-sm" style="flex:1;" id="btn-apr-${u.id}" onclick="aprobarConClaveProvisional('${u.id}')">✅ Apr</button>` : '';
      var bP = `<button class="btn btn-info btn-sm" style="flex:1;" onclick="accEstado('${u.id}','${u.estado==='Pausado'?'Aprobado':'Pausado'}')">${u.estado==='Pausado'?'▶':'⏸'}</button>`;
      var bB = `<button class="btn btn-danger btn-sm" style="flex:1;" onclick="accEstado('${u.id}','${u.estado==='Bloqueado'?'Aprobado':'Bloqueado'}')">${u.estado==='Bloqueado'?'🔓':'🚫'}</button>`;
      var bE = (rolActual === 'Súper Administrador' || u.rol === 'Cliente') ? `<button class="btn btn-danger btn-sm" onclick="accEliminar('${u.id}')">🗑</button>` : '';
      
      return `<div class="user-approval-card" style="background:var(--bg-input); border:1px solid var(--border-color); padding:12px; border-radius:var(--radius-md);"><div><b style="color:var(--clr-primary);">${u.nombre}</b><br><span style="font-size:11px;color:var(--text-main);">${u.correo}</span><br><span style="font-size:10px;font-weight:600;color:${col[u.estado]||'gray'};">${u.estado}</span></div>${inC}<div style="display:flex;gap:6px;margin-top:8px;">${sel}<button class="btn btn-primary btn-sm" onclick="accCargo('${u.id}')">💾</button></div><div class="action-buttons-grid" style="display:flex; gap:4px; margin-top:8px;">${bA}${bP}${bB}${bE}</div></div>`;
    }).join('');
  } catch (error) {
    $('authList').innerHTML = '<div style="text-align:center;padding:16px;">Error de servidor.</div>';
  }
}

function generarClaveAleatoria(id) {
  var c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#*", p = "A1!";
  for (var i = 0; i < 6; i++) p += c.charAt(Math.floor(Math.random() * c.length));
  $('pwd-prov-' + id).value = p;
}

async function aprobarConClaveProvisional(id) {
  var pwd = $('pwd-prov-' + id).value.trim(); if (!pwd || pwd.length < 8) return alert('Falta clave (mín. 8 chars).');
  $('btn-apr-' + id).disabled = true; 
  try {
    await apiFetch('aprobarUsuario', { userId: id, password: pwd, rolSolicitante: rolActual });
    alert('Aprobado.'); cargarSolicitudes();
  } catch (error) {
    alert(error.message); $('btn-apr-'+id).disabled = false;
  }
}

async function accCargo(id) { 
  try {
    await apiFetch('modificarUsuario', { userId: id, col: 5, val: $('sel-rol-'+id).value, accionDesc: 'Cargo', rolSolicitante: rolActual });
    cargarSolicitudes();
  } catch (error) { alert(error.message); }
}

async function accEstado(id, est) { 
  try {
    await apiFetch('modificarUsuario', { userId: id, col: 7, val: est, accionDesc: 'Estado', rolSolicitante: rolActual });
    cargarSolicitudes();
  } catch (error) { alert(error.message); }
}

async function accEliminar(id) { 
  if (confirm('¿Eliminar definitivamente?')) {
    try {
      await apiFetch('eliminarUsuario', { userId: id, rolSolicitante: rolActual });
      cargarSolicitudes();
    } catch (error) { alert(error.message); }
  }
}
