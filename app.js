// ============================================================================
// BASE DE DATOS - API RESTFUL
// ============================================================================

const URL_MATRIZ_DATOS = 'https://docs.google.com/spreadsheets/d/1dtf5IPc27qaXuF4A9LRWnSj9GhDzdmuIlnKkzmKCbbc/edit';
const ID_INSTANCIA_INVENTARIO = 'INV-ESTANCO'; 
var idArchivo = '1F1yruUAEWvkenPFXk5ZxM2BQdLbHto1kjjiFZbIU9Cg';

// --- ENRUTADOR GET (Lecturas) ---
function doGet(e) {
  try {
    const action = e.parameter.action;
    let result = {};

    switch (action) {
      case 'verificarEstado':
        result = { estado: verificarEstadoServicio_(), aviso: obtenerAvisoActivo_() };
        break;
      case 'obtenerUsuarios':
        result = obtenerUsuarios(e.parameter.rol);
        break;
      case 'buscarProductos':
        result = buscarProductosEnBase(e.parameter.crit);
        break;
      case 'obtenerDashboard':
        result = obtenerDatosDashboard();
        break;
      case 'obtenerClientes':
        result = obtenerClientes();
        break;
      case 'obtenerReporteVentas':
        result = obtenerReporteVentas();
        break;
      case 'obtenerCartera':
        result = obtenerCarteraClientes();
        break;
      case 'checkUsername':
        result = checkUsernameAvailability(e.parameter.usuario);
        break;
      default:
        return respuestaJSON({ error: "Acción GET no soportada o inexistente" }, 400);
    }
    return respuestaJSON(result);
  } catch (error) {
    return respuestaJSON({ error: error.message }, 500);
  }
}

// --- ENRUTADOR POST (Escrituras) ---
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    let result = {};

    switch (action) {
      case 'verificarLogin':
        result = verificarLogin(data.usuario, data.password);
        break;
      case 'cambiarClave':
        result = cambiarClaveObligatorio(data.usuario, data.claveAntigua, data.nuevaClave);
        break;
      case 'procesarOlvido':
        result = procesarOlvidoContrasena(data.correo, data.documento);
        break;
      case 'registrarUsuario':
        result = registrarNuevoUsuario(data.datosUsuario, data.esInterno, data.rolSolicitante);
        break;
      case 'aprobarUsuario':
        result = { success: aprobarUsuarioConClave(data.userId, data.password, data.rolSolicitante) };
        break;
      case 'modificarUsuario':
        result = { success: modificarCampoUsuario(data.userId, data.col, data.val, data.accionDesc, data.rolSolicitante) };
        break;
      case 'eliminarUsuario':
        result = { success: eliminarUsuarioDefinitivo(data.userId, data.rolSolicitante) };
        break;
      case 'guardarProducto':
        result = { success: guardarProducto(data.producto, data.operador) };
        break;
      case 'editarProducto':
        result = { success: editarProductoExistente(data.producto, data.operador) };
        break;
      case 'actualizarStock':
        result = actualizarStock(data.sku, data.cantidad, data.operador);
        break;
      case 'registrarCliente':
        result = registrarNuevoCliente(data.cliente);
        break;
      case 'cambiarEstadoCliente':
        result = cambiarEstadoClienteCartera(data.docCliente, data.nuevoEstado, data.operador);
        break;
      case 'registrarVenta':
        result = registrarVentaPOS(data.venta);
        break;
      case 'pagarTicket':
        result = pagarTicketCartera(data.ticketId, data.operador);
        break;
      case 'registrarDeudor':
        result = registrarUsuarioDeudor(data.cliente, data.rolSolicitante);
        break;
      case 'guardarInformeDrive':
        result = guardarInformeEnDrive(data.html, data.tipo, data.mes, data.anio);
        break;
      default:
        return respuestaJSON({ error: "Acción POST no soportada: " + (action || 'indefinida') }, 400);
    }
    return respuestaJSON(result);
  } catch (error) {
    return respuestaJSON({ error: error.message }, 500);
  }
}

// Helper para emitir respuestas JSON estandarizadas
function respuestaJSON(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify({ code: code, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// FUNCIONES NÚCLEO
// ============================================================================

function leerMatrizCentral_() {
  try {
    return SpreadsheetApp.openByUrl(URL_MATRIZ_DATOS);
  } catch (e) {
    return null;
  }
}

function verificarEstadoServicio_() {
  const ssCentral = leerMatrizCentral_();
  if (!ssCentral) return 'Activo';
  const sheetEmpresas = ssCentral.getSheetByName('Empresas');
  if (!sheetEmpresas) return 'Activo';
  
  const data = sheetEmpresas.getDataRange().getValues();
  const fila = data.find((r,i) => i > 0 && r[0].toString().toUpperCase() === ID_INSTANCIA_INVENTARIO.toUpperCase());
  return fila ? fila[3].toString().trim() : 'No Encontrado';
}

function obtenerAvisoActivo_() {
  try {
    const ssCentral = leerMatrizCentral_();
    if (!ssCentral) return null;
    const sheetAvisos = ssCentral.getSheetByName('config_avisos');
    if (!sheetAvisos) return null;
    
    const data = sheetAvisos.getDataRange().getValues();
    const fechaActual = new Date();
    
    for (let i = data.length - 1; i > 0; i--) {
      const [id, titulo, mensaje, url, color, estadoRaw, fechaRaw] = data[i];
      const estado = (estadoRaw === true || String(estadoRaw).trim().toUpperCase() === 'TRUE');
      const fechaVigencia = fechaRaw ? new Date(new Date(fechaRaw).getTime() + 86400000) : null;
      
      if (estado && fechaVigencia && !isNaN(fechaVigencia) && fechaVigencia >= fechaActual) {
        return { id, titulo, mensaje, url, color: color || '#d4af37' };
      }
    }
    return null;
  } catch(e) {
    return { titulo: 'Error de Conexión', mensaje: 'Fallo al leer matriz: ' + e.message, color: '#e11d48' };
  }
}

function garantizarEstructura() {
  var ss = SpreadsheetApp.openById(idArchivo);
  
  // Cabeceras orientadas al modelo
  [{ name: 'Inventario', headers: ['Código SKU', 'Nombre Producto', 'Categoría', 'Descripción', 'Costo Compra', 'Precio Venta', 'Stock Actual', 'Valor Total', 'Proveedor', 'Fecha', 'N° Factura', 'Código Producto', 'Cantidad Comprada', 'Costo Compra Total', 'Cantidad Vendida', 'Descuento (%)', 'Valor Descontado', 'Precio Venta Final', 'Stock Mínimo', 'Fecha de Caducidad', 'Código de Barras EAN/UPC'] }, 
   { name: 'Usuarios', headers: ['ID Usuario', 'Nombre Completo', 'Correo Electrónico', 'Contraseña', 'Rol', 'Fecha de Registro', 'Estado', 'Requiere Cambio Clave', 'Usuario', 'Documento'] }, 
   { name: 'Clientes', headers: ['ID Cliente', 'Nombre Completo', 'Tipo Documento', 'Documento Identidad', 'Teléfono', 'Dirección', 'Correo Electrónico', 'Fecha Registro', 'Estado Cartera'] }, 
   { name: 'Ventas', headers: ['N° Ticket', 'Fecha y Hora', 'Cliente', 'Documento', 'Detalle Productos', 'Total Pagado', 'Cajero/Operador', 'Costo Base', 'Ganancia', 'Tipo Pago', 'Estado Pago'] }, 
   { name: 'Registro de Actividades', headers: ['Fecha y Hora', 'Usuario', 'Acción', 'Detalles'] }
  ].forEach(function(cfg, i) {
    var sheet = ss.getSheetByName(cfg.name) || (cfg.name === 'Inventario' ? ss.getSheetByName('Hoja 1') : null);
    
    if (!sheet) { 
      sheet = ss.insertSheet(cfg.name, i); 
      sheet.appendRow(cfg.headers).getRange(1, 1, 1, cfg.headers.length).setFontWeight('bold');
    } else {
      if(sheet.getName() === 'Hoja 1') sheet.setName('Inventario');
      
      var cabecerasActuales = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
      if (cabecerasActuales.length < cfg.headers.length) {
        var columnasAInsertar = cfg.headers.filter(function(col) { return cabecerasActuales.indexOf(col) === -1; });
        if(columnasAInsertar.length > 0) {
           sheet.getRange(1, sheet.getLastColumn() + 1, 1, columnasAInsertar.length).setValues([columnasAInsertar]).setFontWeight('bold');
        }
      }
    }
  });
  return ss;
}

function checkUsernameAvailability(username) {
  var datos = garantizarEstructura().getSheetByName('Usuarios').getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0] || !datos[i][8]) continue;
    if (String(datos[i][8]).trim().toLowerCase() === username.trim().toLowerCase()) return { disponible: false };
  }
  return { disponible: true };
}

function verificarLogin(usuario, password) {
  var datos = garantizarEstructura().getSheetByName('Usuarios').getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    var userDB = String(datos[i][8] || datos[i][2]).trim().toLowerCase();
    
    if (userDB === usuario.trim().toLowerCase() && String(datos[i][3]).trim() === password.trim()) {
      var est = String(datos[i][6] || 'Pendiente').trim();
      if (['Bloqueado', 'Pausado', 'Eliminado'].indexOf(est) !== -1) return { success: false, dbEstado: true };
      if (est === 'Pendiente') return { success: false, pendiente: true };
      if (String(datos[i][7]).trim().toUpperCase() === 'TRUE' || datos[i][7] === true) {
         return { success: false, requiereCambio: true, nombre: String(datos[i][1]), usuario: userDB };
      }
      registrarActividad(String(datos[i][1]), 'Inicio de Sesión', 'Rol: ' + String(datos[i][4]));
      return { success: true, nombre: String(datos[i][1]), rol: String(datos[i][4]) };
    }
  }
  return { success: false, error: 'Credenciales inválidas.' };
}

function cambiarClaveObligatorio(usuario, claveAntigua, nuevaClave) {
  var regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;"'<>,.?~\\/-]).{8,}$/;
  if (!regex.test(nuevaClave)) return { success: false, error: 'La contraseña no cumple requisitos.' };
  
  var sheet = garantizarEstructura().getSheetByName('Usuarios'), datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    var userDB = String(datos[i][8] || datos[i][2]).trim().toLowerCase();
    if (userDB === usuario.trim().toLowerCase() && String(datos[i][3]).trim() === claveAntigua.trim()) {
      sheet.getRange(i + 1, 4).setValue(nuevaClave); 
      sheet.getRange(i + 1, 8).setValue(false);
      return { success: true, nombre: String(datos[i][1]), rol: String(datos[i][4]) };
    }
  }
  return { success: false, error: 'Clave temporal no coincide.' };
}

function procesarOlvidoContrasena(correo, documento) {
  try {
    var datos = garantizarEstructura().getSheetByName('Usuarios').getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][2] && datos[i][9] && String(datos[i][2]).trim().toLowerCase() === correo.trim().toLowerCase() && String(datos[i][9]).trim() === documento.trim()) {
        if (['Eliminado', 'Bloqueado'].indexOf(String(datos[i][6])) !== -1) return { success: false, error: 'Cuenta deshabilitada.' };
        if (!datos[i][3]) return { success: false, error: 'Sin clave asignada.' };
        
        MailApp.sendEmail(correo, 'Recuperación de Acceso (Inventario)', 'Hola ' + datos[i][1] + ',\n\nUsuario: ' + datos[i][8] + '\nClave actual: ' + datos[i][3]);
        return { success: true };
      }
    }
    return { success: false, error: 'El correo y/o el documento no coinciden.' };
  } catch (e) {
    return { success: false, error: 'Error de permisos al enviar correo. Autoriza el script ejecutándolo desde el editor.' };
  }
}

function registrarNuevoUsuario(datosUsuario, esInterno, rolSolicitante) {
  var rol = datosUsuario.rol;
  if (rol === 'Súper Administrador') return { ok: false, error: 'Acción denegada. El Súper Administrador debe crearse desde la BD.' };
  var sheet = garantizarEstructura().getSheetByName('Usuarios'), datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    
    if (datos[i][8] && String(datos[i][8]).trim().toLowerCase() === datosUsuario.usuario.trim().toLowerCase()) return { ok: false, error: 'Usuario en uso.' };
    if (datos[i][2] && String(datos[i][2]).trim().toLowerCase() === datosUsuario.correo.trim().toLowerCase()) return { ok: false, error: 'Correo ya registrado.' };
  }
  var nId = 'USR' + String(sheet.getLastRow()).padStart(3, '0');
  sheet.appendRow([nId, datosUsuario.nombre, datosUsuario.correo, "", rol, new Date(), esInterno ? 'Aprobado' : 'Pendiente', true, datosUsuario.usuario, datosUsuario.documento]);
  return { ok: true };
}

function aprobarUsuarioConClave(userId, passwordProvisional, rolSolicitante) {
  var sheet = garantizarEstructura().getSheetByName('Usuarios'), datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(userId).trim()) {
      sheet.getRange(i + 1, 4).setValue(passwordProvisional); 
      sheet.getRange(i + 1, 7).setValue('Aprobado'); 
      sheet.getRange(i + 1, 8).setValue(true);
      registrarActividad(rolSolicitante || 'Sistema', 'Aprobación Usuario', datos[i][1] + ' aprobado.');
      return true;
    }
  }
  throw new Error("Usuario no encontrado.");
}

function registrarUsuarioDeudor(c, rolSolicitante) {
  if (['Súper Administrador', 'Administrador'].indexOf(rolSolicitante) === -1) throw new Error("Solo administradores pueden registrar usuarios deudores.");
  return registrarNuevoCliente(c);
}

function obtenerUsuarios(rolSolicitante) {
  var datos = garantizarEstructura().getSheetByName('Usuarios').getDataRange().getValues(), res = [];
  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    var dbRol = String(datos[i][4]).trim();
    if (rolSolicitante === 'Administrador' && ['Súper Administrador', 'Administrador'].indexOf(dbRol) !== -1) continue;
    if (rolSolicitante === 'Vendedor' && dbRol !== 'Cliente') continue;
    res.push({ id: datos[i][0], nombre: datos[i][1], correo: datos[i][2], rol: dbRol, estado: String(datos[i][6] || 'Pendiente') });
  }
  return res;
}

function modificarCampoUsuario(userId, col, val, accion, rolSolicitante) {
  var sheet = garantizarEstructura().getSheetByName('Usuarios'), datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(userId).trim()) {
      if (String(datos[i][4]).trim() === 'Súper Administrador' && rolSolicitante !== 'Súper Administrador') throw new Error("Acción denegada.");
      sheet.getRange(i + 1, col).setValue(val);
      registrarActividad(rolSolicitante || 'Sistema', accion, datos[i][1] + ' -> ' + val);
      return true;
    }
  }
  throw new Error("Usuario no encontrado.");
}

function eliminarUsuarioDefinitivo(userId, rolSol) {
  var sheet = garantizarEstructura().getSheetByName('Usuarios'), datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(userId).trim()) {
      if (rolSol !== 'Súper Administrador' && String(datos[i][4]).trim() !== 'Cliente') throw new Error("No autorizado.");
      sheet.deleteRow(i + 1); 
      return true;
    }
  }
  throw new Error("Usuario no encontrado.");
}

function guardarProducto(d, u) {
  var ss = garantizarEstructura();
  var sheet = ss.getSheetByName('Inventario');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var stock = Number(d.cantidadComprada) || 0;
  var valTotal = (Number(d.precioVenta) || 0) * stock;
  
  var rowData = new Array(headers.length);
  var standardMapping = { 'Código SKU': d.codigoSku, 'Nombre Producto': d.nombreProducto, 'Categoría': d.categoria, 'Descripción': d.descripcion, 'Costo Compra': d.costoCompra, 'Precio Venta': d.precioVenta, 'Stock Actual': stock, 'Valor Total': valTotal, 'Proveedor': d.proveedor, 'Fecha': new Date(), 'N° Factura': d.numeroFactura, 'Código Producto': d.codigoProducto, 'Cantidad Comprada': stock, 'Costo Compra Total': (Number(d.costoCompra) || 0) * stock, 'Cantidad Vendida': 0, 'Descuento (%)': 0, 'Valor Descontado': 0, 'Precio Venta Final': d.precioVenta, 'Fecha de Caducidad': d.fechaCaducidad || '' };
  
  for (var i = 0; i < headers.length; i++) {
    rowData[i] = standardMapping.hasOwnProperty(headers[i]) ? standardMapping[headers[i]] : '';
  }
  sheet.appendRow(rowData);
  registrarActividad(u || 'Sistema', 'Alta Producto', 'SKU: ' + d.codigoSku + ' | Cantidad: ' + stock);
  return true;
}

function editarProductoExistente(d, u) {
  var ss = garantizarEstructura();
  var sheet = ss.getSheetByName('Inventario');
  var datos = sheet.getDataRange().getValues();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(d.codigoSkuOriginal).trim()) {
      var valTotal = (Number(d.precioVenta) || 0) * (Number(d.stockActual) || 0);
      
      var mapValores = {
        'Nombre Producto': d.nombreProducto,
        'Categoría': d.categoria,
        'Descripción': d.descripcion,
        'Costo Compra': d.costoCompra,
        'Precio Venta': d.precioVenta,
        'Stock Actual': d.stockActual,
        'Valor Total': valTotal,
        'Proveedor': d.proveedor,
        'Código Producto': d.codigoProducto
      };
      
      for (var col = 0; col < headers.length; col++) {
        if (mapValores[headers[col]] !== undefined) {
          sheet.getRange(i + 1, col + 1).setValue(mapValores[headers[col]]);
        }
      }
      
      registrarActividad(u || 'Sistema', 'Edición Producto', 'Se modificó el SKU: ' + d.codigoSkuOriginal);
      return true;
    }
  }
  throw new Error("Producto no encontrado en la base de datos.");
}

function actualizarStock(sku, cantSuma, operador) {
  var ss = garantizarEstructura(), sheet = ss.getSheetByName('Inventario'), datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(sku).trim()) {
      var nuevoStock = (Number(datos[i][6]) || 0) + Number(cantSuma);
      sheet.getRange(i + 1, 7).setValue(nuevoStock);
      sheet.getRange(i + 1, 8).setValue(nuevoStock * (Number(datos[i][4]) || 0)); 
      registrarActividad(operador, 'Reabastecimiento', 'SKU: ' + sku + ' | +' + cantSuma + ' (Total: ' + nuevoStock + ')');
      return { success: true, nuevoStock: nuevoStock };
    }
  }
  return { success: false, error: 'Artículo no encontrado.' };
}

function buscarProductosEnBase(crit) {
  var ss = garantizarEstructura(), sheet = ss.getSheetByName('Inventario');
  if (!sheet) return [];
  
  var datos = sheet.getDataRange().getValues();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idxCaducidad = headers.indexOf("Fecha de Caducidad");
  var res = [];
  
  var terminos = crit.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/);
  
  for (var i = 1; i < datos.length; i++) {
    var sku = String(datos[i][0]).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var nombre = String(datos[i][1]).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    var codProd = String(datos[i][11]).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    var textoBuscable = sku + " " + nombre + " " + codProd;
    
    var coincide = terminos.every(function(t) { 
      return textoBuscable.indexOf(t) !== -1; 
    });
    
    if (coincide) {
      var fCad = (idxCaducidad !== -1 && datos[i][idxCaducidad]) ? datos[i][idxCaducidad] : ''; 
      if (fCad instanceof Date) { fCad = fCad.toLocaleDateString(); }
      res.push({ sku: datos[i][0], nombre: datos[i][1], categoria: datos[i][2], descripcion: datos[i][3], costoCompra: datos[i][4], precioVenta: datos[i][5], stock: datos[i][6], proveedor: datos[i][8], codigoProducto: datos[i][11], precioFinal: datos[i][17] || datos[i][5], fechaCaducidad: fCad });
    }
  }
  return res;
}

function obtenerDatosDashboard() {
  var ss = garantizarEstructura(), sheetInv = ss.getSheetByName('Inventario'), sheetVentas = ss.getSheetByName('Ventas');
  var datosInv = sheetInv.getDataRange().getValues();
  var datosVentas = sheetVentas.getDataRange().getValues();
  var alertas = [], ventasHoy = {};
  
  for (var i = 1; i < datosInv.length; i++) {
    if (!datosInv[i][0]) continue;
    var nombre = String(datosInv[i][1]), stock = Number(datosInv[i][6]) || 0;
    if (stock < 5) alertas.push({ producto: nombre, stock: stock });
  }

  var hoyStr = new Date().toDateString();
  for (var j = 1; j < datosVentas.length; j++) {
    if (!datosVentas[j][1]) continue;
    var fechaVenta = new Date(datosVentas[j][1]);
    
    if (fechaVenta.toDateString() === hoyStr) {
      var detalles = String(datosVentas[j][4]).split(', ');
      detalles.forEach(function(det) {
        var match = det.match(/(.*) \(x(\d+)\)/);
        if (match) {
          var prod = match[1].trim(), cant = Number(match[2]);
          ventasHoy[prod] = (ventasHoy[prod] || 0) + cant;
        }
      });
    }
  }

  var masVendidos = [];
  for (var p in ventasHoy) {
    if (ventasHoy[p] > 10) {
      masVendidos.push({ producto: p, cantidad: ventasHoy[p] });
    }
  }
  masVendidos.sort((a, b) => b.cantidad - a.cantidad);

  return { alertas: alertas.slice(0, 6), masVendidos: masVendidos.slice(0, 6) };
}

function obtenerClientes() {
  var datos = garantizarEstructura().getSheetByName('Clientes').getDataRange().getValues(), l = [];
  for (var i = 1; i < datos.length; i++) {
    if(datos[i][0]) l.push({ id: datos[i][0], nombre: datos[i][1], tipoDoc: datos[i][2], documento: datos[i][3], telefono: datos[i][4], direccion: datos[i][5], correo: datos[i][6], estado: datos[i][8] || 'Activo' });
  }
  return l;
}

function registrarNuevoCliente(c) {
  var sheet = garantizarEstructura().getSheetByName('Clientes'), nId = 'CLI' + String(sheet.getLastRow()).padStart(4, '0');
  sheet.appendRow([nId, c.nombre, c.tipoDoc, c.documento, c.telefono, c.direccion, c.correo, new Date(), 'Activo']); 
  return { success: true, id: nId, nombre: c.nombre };
}

function cambiarEstadoClienteCartera(docCliente, nuevoEstado, operador) {
  var sheet = garantizarEstructura().getSheetByName('Clientes'), datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][3]).trim() === String(docCliente).trim()) {
      sheet.getRange(i + 1, 9).setValue(nuevoEstado);
      registrarActividad(operador, 'Cambio Estado Cliente', 'Documento: ' + docCliente + ' es ' + nuevoEstado);
      return { success: true };
    }
  }
  return { success: false, error: 'No se encontró al cliente.' };
}

function registrarVentaPOS(dv) {
  var ss = garantizarEstructura(), hProd = ss.getSheetByName('Inventario'), hVent = ss.getSheetByName('Ventas');
  var db = hProd.getDataRange().getValues(), det = [], costoBaseTotal = 0, tipoPago = dv.tipoPago || 'Efectivo', estadoPago = (tipoPago === 'Fiar') ? 'Pendiente' : 'Pagado';
  
  if (tipoPago === 'Fiar') {
    if (dv.clienteDoc === '000000000') throw new Error("No se puede fiar a un 'Usuario de vitrina'.");
    var dbCli = ss.getSheetByName('Clientes').getDataRange().getValues(), clienteBloqueado = false;
    for (var c = 1; c < dbCli.length; c++) {
      if (String(dbCli[c][3]).trim() === String(dv.clienteDoc).trim() && String(dbCli[c][8]).trim() === 'Bloqueado') { clienteBloqueado = true; break; }
    }
    if (clienteBloqueado) throw new Error("Este cliente se encuentra BLOQUEADO para créditos.");
  }
  
  dv.carrito.forEach(function(item) {
    for (var j = 1; j < db.length; j++) {
      if (String(db[j][0]).trim() === String(item.sku).trim()) {
        var nCant = Number(db[j][6]) - Number(item.cantidad);
        if (nCant < 0) throw new Error("Stock insuficiente: " + item.nombre);
        hProd.getRange(j + 1, 7).setValue(nCant);
        hProd.getRange(j + 1, 15).setValue((Number(db[j][14]) || 0) + Number(item.cantidad));
        hProd.getRange(j + 1, 8).setValue(Number(db[j][4]) * nCant); 
        costoBaseTotal += ((Number(db[j][4]) || 0) * Number(item.cantidad));
        break;
      }
    }
    det.push(item.nombre + " (x" + item.cantidad + ")");
  });
  
  var tk = 'TK' + String(hVent.getLastRow()).padStart(5, '0'), totalCobrado = Number(dv.total), gananciaNeta = totalCobrado - costoBaseTotal;
  hVent.appendRow([tk, new Date(), dv.clienteNombre, dv.clienteDoc, det.join(', '), totalCobrado, dv.operador, costoBaseTotal, gananciaNeta, tipoPago, estadoPago]);
  registrarActividad(dv.operador, 'Venta POS (' + tipoPago + ')', 'Ticket: ' + tk + ' | Estado: ' + estadoPago); 
  return { success: true, ticket: tk };
}

function obtenerReporteVentas() {
  var datos = garantizarEstructura().getSheetByName('Ventas').getDataRange().getValues(), ventas = [];
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] && datos[i][1]) {
      ventas.push({ 
        fecha: (datos[i][1] instanceof Date) ? datos[i][1].getTime() : new Date(datos[i][1]).getTime(), 
        total: Number(datos[i][5]) || 0, cost: Number(datos[i][7]) || 0, 
        ganancia: Number(datos[i][8]) || 0, tipoPago: datos[i][9] || 'Efectivo', 
        estadoPago: datos[i][10] || 'Pagado', detalles: String(datos[i][4]) 
      });
    }
  }
  return ventas;
}

function obtenerCarteraClientes() {
  var ss = garantizarEstructura(), datos = ss.getSheetByName('Ventas').getDataRange().getValues(), dbCli = ss.getSheetByName('Clientes').getDataRange().getValues(), estadosClientes = {}, deudores = {};
  for (var c = 1; c < dbCli.length; c++) if(dbCli[c][3]) estadosClientes[String(dbCli[c][3])] = dbCli[c][8] || 'Activo';
  
  for (var i = 1; i < datos.length; i++) {
    if ((datos[i][9] || 'Efectivo') === 'Fiar' && (datos[i][10] || 'Pagado') === 'Pendiente') {
      var doc = String(datos[i][3]), total = Number(datos[i][5]) || 0;
      if (!deudores[doc]) deudores[doc] = { documento: doc, nombre: String(datos[i][2]), deudaTotal: 0, estado: estadosClientes[doc] || 'Activo', tickets: [] };
      deudores[doc].deudaTotal += total; 
      deudores[doc].tickets.push({ ticket: String(datos[i][0]), fecha: (datos[i][1] instanceof Date) ? datos[i][1].toLocaleString() : new Date(datos[i][1]).toLocaleString(), monto: total });
    }
  }
  return Object.keys(deudores).map(k => deudores[k]);
}

function pagarTicketCartera(ticketId, operador) {
  var sheet = garantizarEstructura().getSheetByName('Ventas'), datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).trim() === String(ticketId).trim()) {
      sheet.getRange(i + 1, 11).setValue('Pagado');
      registrarActividad(operador, 'Abono Cartera', 'Ticket ' + ticketId + ' liquidado en efectivo.');
      return { success: true };
    }
  }
  return { success: false, error: 'Ticket no encontrado.' };
}

function registrarActividad(u, a, d) { 
  try { 
    var h = SpreadsheetApp.openById(idArchivo).getSheetByName('Registro de Actividades'); 
    if (h) h.appendRow([new Date(), u, a, d]); 
  } catch (e) {} 
}

function guardarInformeEnDrive(html, tipo, mes, anio) {
  try {
    var archivoBd = DriveApp.getFileById(idArchivo);
    var carpetaRaiz = archivoBd.getParents().next();
    
    var carpetasAnio = carpetaRaiz.getFoldersByName(String(anio));
    var carpetaAnio = carpetasAnio.hasNext() ? carpetasAnio.next() : carpetaRaiz.createFolder(String(anio));
    
    var nombreArchivo = tipo + " - " + mes + " - " + anio + ".pdf";
    
    var archivosExistentes = carpetaAnio.getFilesByName(nombreArchivo);
    while (archivosExistentes.hasNext()) {
      archivosExistentes.next().setTrashed(true);
    }
    
    var blob = Utilities.newBlob(html, MimeType.HTML).getAs(MimeType.PDF);
    blob.setName(nombreArchivo);
    var nuevoPdf = carpetaAnio.createFile(blob);
    
    return { success: true, url: nuevoPdf.getUrl() };
  } catch(e) {
    return { success: false, error: e.message };
  }
}
