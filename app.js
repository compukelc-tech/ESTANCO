// ============================================================================
// SISTEMA DE INVENTARIO Y POS (ESTANCO) - FRONTEND APP.JS
// ============================================================================

const $ = (id) => document.getElementById(id);
const API_URL = 'https://script.google.com/macros/s/AKfycbw1uQXEyyMSBQUkXmP4RMObLpkdezHwUQAiJCK5cxS9vFfFTRO8KfxJpc_i_Oygg5Nb/exec';

let usuarioActual = null, rolActual = null, correoTemporal = null;
let memoriaProductosPOS = [], carritoPOS = [], memoriaVentas = [], tempBusquedaReab = [], memoriaCartera = [];

// --- CONTROLADOR CENTRAL FETCH ---
async function apiFetch(action, payload = {}, method = 'POST') {
  try {
    const options = { method: method, redirect: 'follow' };
    let url = API_URL;
    if (method === 'POST') {
      options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      options.body = JSON.stringify({ action: action, ...payload });
    } else {
      const q = new URLSearchParams({ action: action, ...payload }).toString();
      url = `${API_URL}?${q}`;
    }
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const json = await response.json();
    if (json.code !== 200) throw new Error(json.data.error || 'Error en servidor');
    return json.data;
  } catch (error) { throw error; }
}

// --- INICIALIZACIÓN ---
window.onload = async function () { 
  mostrarLogin(); 
  await cargarBannerGlobal();
};

async function cargarBannerGlobal() {
  try {
    const res = await apiFetch('verificarEstado', {}, 'GET');
    if (res.aviso) {
      const a = res.aviso;
      $('bannerPublicitarioContainer').innerHTML = `
        <div id="bannerPublicitario" class="aviso-global-banner" style="background-color:${a.color};">
          <div><b>${a.titulo}</b> ${a.mensaje} ${a.url ? `<a href="${a.url}" target="_blank">Ver más</a>` : ''}</div>
          <button class="aviso-close" onclick="document.getElementById('bannerPublicitario').style.display='none'">✕</button>
        </div>`;
    }
  } catch (e) { console.log("Banner no disponible."); }
}

// --- AUTENTICACIÓN ---
async function iniciarSesion() {
  var u = $('loginUsuario').value.trim(), pass = $('loginPassword').value.trim();
  if (!u || !pass) return showPmsg('Rellena las casillas.', 'error');
  try {
    const r = await apiFetch('verificarLogin', { usuario: u, password: pass });
    if (r.requiereCambio) { correoTemporal = r.usuario; ocultarTodosLosFormularios(); $('changePasswordForm').style.display = 'flex'; }
    else if (r.success) { activarSesion(r.nombre, r.rol); }
    else { showPmsg(r.error || 'Credenciales inválidas.', 'error'); }
  } catch (e) { showPmsg('Error de conexión.', 'error'); }
}

function activarSesion(nombre, rol) {
  usuarioActual = nombre; rolActual = rol;
  ocultarTodosLosFormularios();
  $('lockScreen').style.display = 'none';
  $('siName').textContent = nombre; 
  $('siRole').textContent = rol;
  $('sessionInfo').style.display = 'flex';
  configurarDashboard(rol);
  cambiarSeccionTrabajo('DASHBOARD');
}

// --- FUNCIONES CORE (UI/UX) ---
function ocultarTodosLosFormularios() { 
  ['loginForm', 'registerForm', 'forgotPasswordForm', 'changePasswordForm'].forEach(id => $(id).style.display = 'none');
}

function showPmsg(t, c) { 
  var e = $('pmsg'); e.textContent = t; e.className = 'feedback-msg ' + c; e.style.display = 'block'; 
}

function cambiarSeccionTrabajo(modo) {
  ['areaDashboard', 'areaProducto', 'areaPOS', 'areaReportes', 'areaCartera'].forEach(id => { if($(id)) $(id).style.display = 'none'; });
  if (modo === 'DASHBOARD') $('areaDashboard').style.display = 'flex';
  else if (modo === 'ALTA') $('areaProducto').style.display = 'flex';
  else if (modo === 'POS') $('areaPOS').style.display = 'flex';
  else if (modo === 'REPORTES') $('areaReportes').style.display = 'flex';
  else if (modo === 'CARTERA') { $('areaCartera').style.display = 'flex'; cargarCarteraModulo(); }
}

function configurarDashboard(rol) {
  const esAdmin = ['Súper Administrador', 'Administrador'].includes(rol);
  const cont = $('dashboardBotones');
  // ... (Lógica de creación de botones según rol)
}

// --- MÓDULOS POS Y VENTAS ---
async function ejecutarBusquedaPOS() {
  var txt = $('txtBuscarPOS').value;
  if (!txt) return;
  try {
    const arr = await apiFetch('buscarProductos', { crit: txt }, 'GET');
    memoriaProductosPOS = arr;
    $('tbodyResultadosPOS').innerHTML = arr.map((p, i) => `<tr><td>${p.sku}</td><td>${p.nombre}</td><td>$${p.precioFinal}</td><td><button onclick="agregarItemAlCarrito(${i})">🛒</button></td></tr>`).join('');
  } catch(e) { alert("Error de búsqueda."); }
}

function agregarItemAlCarrito(idx) {
  let p = memoriaProductosPOS[idx];
  carritoPOS.push({ ...p, cantidad: 1 });
  renderizarCarritoPOS();
}

function renderizarCarritoPOS() {
  $('tbodyCartPOS').innerHTML = carritoPOS.map((i, idx) => `<tr><td>${i.nombre}</td><td>${i.precio}</td><td><button onclick="quitarDelCarrito(${idx})">✕</button></td></tr>`).join('');
}

// --- MÓDULOS ADICIONALES (Cartera, Usuarios, Reabastecimiento) ---
async function cargarCarteraModulo() {
  const arr = await apiFetch('obtenerCartera', {}, 'GET');
  memoriaCartera = arr;
  $('tbodyCarteraClientes').innerHTML = arr.map(c => `<tr><td>${c.nombre}</td><td>${c.deudaTotal}</td></tr>`).join('');
}

// ... (Incluye aquí las funciones de soporte: cargarSolicitudes, procesarAbonoTotalTicket, etc.)
