/**
 * UI.JS - Control de la interfaz visual
 */

// ===== ESTADO Y DATOS =====
const estilosBase = ["BLONDE", "IRISH RED", "STOUT", "SESSION IPA", "RED IPA", "HONEY"];
const costoPorLata = 1750;
const costoPorLataSinEtiqueta = 1450;

let state = {
  usuarios: {
    Julian: { stock: {}, stockSinEtiqueta: {}, ventas: [] },
    Matias: { stock: {}, stockSinEtiqueta: {}, ventas: [] },
    Lucas: { stock: {}, stockSinEtiqueta: {}, ventas: [] },
  },
  clientesGlobales: [],
  stockGeneral: {},
  popularidadSheet: {},
  totalIngresadoSheet: null,
  usuarioActivo: "Julian",
  ventaActual: { BLONDE: "", "IRISH RED": "", STOUT: "", "SESSION IPA": "", "RED IPA": "", HONEY: "" },
  metodoPago: "efectivo",
  clienteNombre: "",
  totalCobradoInput: "",
  alquilerBarril: "",
  tipoLata: "conEtiqueta",
  precioUnitario: "",
  transferDesde: "Julian",
  transferHacia: "Matias",
  transferEstilo: "BLONDE",
  transferCantidad: 0,
  historialStock: [],
  historialTransferencias: []
};

function setState(updater) {
  state = typeof updater === "function"? updater(structuredClone(state)) : updater;
  actualizarStockGeneral();
  render();
}

function actualizarStockGeneral() {
  let total = {};
  Object.values(state.usuarios).forEach((u) => {
    Object.entries(u.stock).forEach(([estilo, cant]) => {
      total[estilo] = (total[estilo] || 0) + (Number(cant) || 0);
    });
  });
  state.stockGeneral = total;
}

function calcularPreview() {
  const totalLatas = Object.values(state.ventaActual).reduce((a, b) => a + (Number(b) || 0), 0);
  const totalCobrado = Number(state.totalCobradoInput) || 0;
  const costo = state.tipoLata === "sinEtiqueta"? costoPorLataSinEtiqueta : costoPorLata;
  const costoTotal = totalLatas * costo;
  const gananciaBruta = totalCobrado > costoTotal? totalCobrado - costoTotal : 0;
  const comision = gananciaBruta * 0.5;
  return { costoTotal, comision, paraProfeta: costoTotal + comision, totalLatas, gananciaBruta };
}

function getVentasGenerales() {
  return Object.values(state.usuarios).flatMap((u) => u.ventas);
}

function getTotalVentasDinero() {
  return getTotalVentasPorMetodo("efectivo") + getTotalVentasPorMetodo("transferencia");
}

function getTotalVentasPorMetodo(metodo) {
  const nombresDeudores = new Set(
    state.clientesGlobales.map(c => c.nombre.toLowerCase().trim())
  );

  const ventasAlContado = getVentasGenerales().filter(v =>
    (v.metodoPago || "efectivo") === metodo &&
    (!v.cliente || v.cliente.trim() === "" ||
     v.cliente === "Consumidor Final" ||
    !nombresDeudores.has(v.cliente.toLowerCase().trim()))
  );
  const totalContado = ventasAlContado.reduce((acc, v) => acc + (Number(v.totalCobrado) || 0), 0);

  const cobrosDeuda = state.clientesGlobales.reduce((acc, c) => {
    const pagos = c.pagos || [];
    return acc + pagos
     .filter(p => (p.metodo || "efectivo") === metodo)
     .reduce((s, p) => s + (Number(p.monto) || 0), 0);
  }, 0);

  return totalContado + cobrosDeuda;
}

/** Sheet no envía paraProfeta; es costo + comisión (misma fórmula que Vista Previa). */
function paraProfetaMostrar(v) {
  const p = Number(v.paraProfeta);
  if (!isNaN(p) && p > 0) return p;
  const c = Number(v.costoTotal !== undefined ? v.costoTotal : v.costo) || 0;
  const com = Number(v.comision) || 0;
  return c + com;
}

/** Fiado con cliente: no lista hasta Cobrar en Cartera. Contado / legacy según método y estado. */
function ventaApareceEnHistorialGlobal(v) {
  const est = String(v.estado || "").trim().toUpperCase();
  const mp = String(v.metodoPago || "").trim();
  const cli = String(v.cliente || "").trim();
  if (est === "PAGADO" || est === "COBRADO") return true;
  if (est === "PENDIENTE") {
    if (cli && cli !== "Consumidor Final") return false;
    return mp.length > 0;
  }
  return mp.length > 0;
}

function getGananciaTotalProfeta() {
  return getVentasGenerales().reduce((acc, v) => acc + paraProfetaMostrar(v), 0);
}

function getEstadisticasVentas() {
  const ventas = getVentasGenerales();
  const totalesPorEstilo = {};
  let granTotalLatas = 0;
  ventas.forEach(v => {
    Object.entries(v.estilos || {}).forEach(([estilo, cant]) => {
      const c = Number(cant) || 0;
      if (c > 0) {
        totalesPorEstilo[estilo] = (totalesPorEstilo[estilo] || 0) + c;
        granTotalLatas += c;
      }
    });
  });
  return { totalesPorEstilo, granTotalLatas };
}

/**
 * Cuando la deuda del cliente queda saldada, marca ventas locales como cobradas
 * para que entren en Historial Global (filtro metodoPago) aunque el Sheet tarde.
 */
function marcaVentasLocalesCobradasSiSaldado(nombreCliente, metodo) {
  const norm = (s) => String(s || "").toLowerCase().trim();
  const n = norm(nombreCliente);
  Object.values(state.usuarios).forEach((u) => {
    u.ventas.forEach((v) => {
      if (norm(v.cliente) !== n) return;
      const sinCobrar =
        v.estado === "PENDIENTE" ||
        !v.metodoPago ||
        v.metodoPago === "";
      if (!sinCobrar) return;
      v.metodoPago = metodo;
      v.estado = "COBRADO";
      v.cobradoReal = Number(v.totalCobrado) || 0;
    });
  });
}

function registrarVentaLocal() {
  const usuario = state.usuarios[state.usuarioActivo];
  const totalLatas = Object.values(state.ventaActual).reduce((a, b) => a + (Number(b) || 0), 0);
  if (totalLatas === 0) return alert("Cargá al menos 1 lata");

  const preview = calcularPreview();
  const venta = {
    cliente: state.clienteNombre || 'Consumidor Final',
    estilos: {...state.ventaActual},
    alquilerBarril: state.alquilerBarril,
    tipoLata: state.tipoLata,
    estado: "PENDIENTE",
    metodoPago: "",
    totalCobrado: Number(state.totalCobradoInput) || 0,
    costoTotal: preview.costoTotal,
    comision: preview.comision,
    paraProfeta: preview.paraProfeta,
    fecha: new Date().toLocaleString('es-AR'),
    vendedor: state.usuarioActivo
  };

  usuario.ventas.push(venta);

  Object.entries(state.ventaActual).forEach(([estilo, cant]) => {
    const c = Number(cant) || 0;
    if (c > 0) {
      if (state.tipoLata === 'sinEtiqueta') {
        if (!usuario.stockSinEtiqueta) usuario.stockSinEtiqueta = {};
        usuario.stockSinEtiqueta[estilo] = (usuario.stockSinEtiqueta[estilo] || 0) - c;
      } else {
        usuario.stock[estilo] = (usuario.stock[estilo] || 0) - c;
      }
    }
  });

  if (state.clienteNombre && state.clienteNombre !== 'Consumidor Final') {
    let cliente = state.clientesGlobales.find(c => c.nombre === state.clienteNombre);
    if (!cliente) {
      cliente = { nombre: state.clienteNombre, deuda: 0, pagado: 0, pagos: [] };
      state.clientesGlobales.push(cliente);
    }
    cliente.deuda += Number(state.totalCobradoInput) || 0;
  }

  const ventaParaSheet = {
    cliente: venta.cliente,
    estilos: venta.estilos,
    alquilerBarril: venta.alquilerBarril || "",
    tipoLata: venta.tipoLata,
    totalCobrado: venta.totalCobrado,
    paraProfeta: preview.paraProfeta,
    comision: preview.comision,
    totalLatas: preview.totalLatas,
    costo: preview.costoTotal,
    ganancia: venta.totalCobrado - preview.costoTotal,
    metodoPago: venta.metodoPago,
    fecha: venta.fecha,
    vendedor: venta.vendedor,
    esCobro: false,
  };
  ventasPendientes.push(ventaParaSheet);
  localStorage.setItem("ventasPendientes", JSON.stringify(ventasPendientes));

  state.ventaActual = { BLONDE: "", "IRISH RED": "", STOUT: "", "SESSION IPA": "", "RED IPA": "", HONEY: "" };
  state.clienteNombre = "";
  state.alquilerBarril = "";
  state.precioUnitario = "";
  state.totalCobradoInput = "";

  render();
}

function modificarStockDirecto(usuario, estilo, valor, tipo = 'conEtiqueta') {
  const cantidadNueva = Number(valor) || 0;
  const usuarioObj = state.usuarios[usuario];
  const cantidadAnterior = tipo === 'sinEtiqueta'
   ? (usuarioObj.stockSinEtiqueta?.[estilo] || 0)
    : (usuarioObj.stock[estilo] || 0);

  if (tipo === 'sinEtiqueta') {
    if (!usuarioObj.stockSinEtiqueta) usuarioObj.stockSinEtiqueta = {};
    usuarioObj.stockSinEtiqueta[estilo] = cantidadNueva;
  } else {
    usuarioObj.stock[estilo] = cantidadNueva;
  }

  registrarCargaStock(usuario, estilo, cantidadNueva - cantidadAnterior, tipo);
  encolarActualizarStockEnSheet(usuario);
  render();
}

async function borrarVentaIndividual(index) {
  if (!confirm("¿Borrar esta venta? Se devolverá el stock automáticamente.")) return;

  const venta = state.usuarios[state.usuarioActivo].ventas[index];
  if (!venta) return;

  setState(prev => {
    const usuario = prev.usuarios[prev.usuarioActivo];
    Object.entries(venta.estilos || {}).forEach(([estilo, cant]) => {
      const c = Number(cant) || 0;
      if (c > 0) {
        if (venta.tipoLata === 'sinEtiqueta') {
          if (!usuario.stockSinEtiqueta) usuario.stockSinEtiqueta = {};
          usuario.stockSinEtiqueta[estilo] = (usuario.stockSinEtiqueta[estilo] || 0) + c;
        } else {
          usuario.stock[estilo] = (usuario.stock[estilo] || 0) + c;
        }
      }
    });
    prev.usuarios[prev.usuarioActivo].ventas.splice(index, 1);
    return prev;
  });

  encolarBorrarVentaEnSheet({
    vendedor: venta.vendedor || state.usuarioActivo,
    fecha: venta.fecha,
    cliente: venta.cliente,
    estilos: venta.estilos,
    tipoLata: venta.tipoLata || "conEtiqueta",
  });
  encolarActualizarStockEnSheet(state.usuarioActivo);
}

/** Mismo valor en todos los flujos de cobro (botones y manual). */
function normalizarMetodoPago(metodoRaw) {
  const s = String(metodoRaw || "").toLowerCase().trim();
  return s === "transferencia" ? "transferencia" : "efectivo";
}

/**
 * Cobro en cartera: actualiza estado local, encola envío al Sheet y marca ventas si salda.
 * El POST a Google Sheets ocurre solo al pulsar «Guardar en Sheet» (ver guardarPagosPendientesEnSheet).
 */
function aplicarCobroCartera(index, montoPropuesto, metodoRaw) {
  const metodo = normalizarMetodoPago(metodoRaw);
  const cliente = state.clientesGlobales[index];
  if (!cliente) {
    console.error("❌ Cliente no encontrado en índice:", index);
    return;
  }

  const deudaAntes = cliente.deuda - cliente.pagado;
  if (deudaAntes <= 0) {
    alert(`✅ ${cliente.nombre} no tiene deuda pendiente.`);
    return;
  }

  const monto = Math.min(Math.max(0, Number(montoPropuesto) || 0), deudaAntes);
  if (monto <= 0) return;

  cliente.pagado += monto;
  if (!cliente.pagos) cliente.pagos = [];
  cliente.pagos.push({
    monto: monto,
    metodo: metodo,
    fecha: new Date().toLocaleString("es-AR")
  });

  const deudaRestante = Math.max(0, cliente.deuda - cliente.pagado);
  if (deudaRestante < 1) {
    marcaVentasLocalesCobradasSiSaldado(cliente.nombre, metodo);
  }

  encolarPagoParaSheet(cliente.nombre, monto, metodo);

  const metodoTexto = metodo === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia";
  alert(
    `✅ Registrado cobro $${monto.toLocaleString()} de ${cliente.nombre} (${metodoTexto}). ` +
      `Historial global ya lo muestra como cobrado. ` +
      `Para grabar ventas y cobros en Google Sheets usá «Guardar en Sheet».`
  );

  guardarDatos();
  render();
}

/** Atajos 100% / 50%: verdes = efectivo, azules = transferencia (ver onclick en render). */
function registrarPagoCliente(index, metodo, porcentaje) {
  const cliente = state.clientesGlobales[index];
  if (!cliente) return;
  const deudaActual = cliente.deuda - cliente.pagado;
  if (deudaActual <= 0) {
    alert(`✅ ${cliente.nombre} no tiene deuda pendiente.`);
    return;
  }
  const monto = porcentaje === "100" ? deudaActual : deudaActual * 0.5;
  aplicarCobroCartera(index, monto, metodo);
}

function registrarPagoManual(index) {
  const inputEl = document.getElementById(`pago-manual-${index}`);
  const metodoEl = document.getElementById(`pago-metodo-${index}`);
  if (!inputEl || !metodoEl) {
    console.error("❌ No se encontraron los elementos del DOM");
    return;
  }
  const montoIngresado = Number(inputEl.value);
  const metodo = metodoEl.value;
  if (!montoIngresado || montoIngresado <= 0) {
    alert("⚠️ Ingresá un monto válido mayor a 0");
    return;
  }
  const cliente = state.clientesGlobales[index];
  if (!cliente) return;
  const deudaActual = cliente.deuda - cliente.pagado;
  if (montoIngresado > deudaActual) {
    alert(
      `⚠️ El monto ($${montoIngresado.toLocaleString()}) supera la deuda ($${deudaActual.toLocaleString()}). Se cobrará solo la deuda.`
    );
  }
  inputEl.value = "";
  aplicarCobroCartera(index, montoIngresado, metodo);
}

function registrarCargaStock(usuario, estilo, cantidad, tipo) {
  state.historialStock.push({
    usuario,
    estilo,
    cantidad,
    tipo,
    fecha: new Date().toLocaleString('es-AR')
  });
}

function registrarTransferenciaHistorial(desde, hacia, estilo, cantidad, tipo) {
  state.historialTransferencias.push({
    desde,
    hacia,
    estilo,
    cantidad,
    tipo,
    fecha: new Date().toLocaleString('es-AR')
  });
}

function guardarDatos() {
  const data = { usuarios: state.usuarios, clientes: state.clientesGlobales };
  localStorage.setItem("elProfetaData", JSON.stringify(data));
}

function cargarDatos() {
  const dataRaw = localStorage.getItem("elProfetaData");
  if (dataRaw) {
    const data = JSON.parse(dataRaw);
    state.usuarios = data.usuarios || state.usuarios;
    state.clientesGlobales = data.clientes || [];
    actualizarStockGeneral();
  }
}

async function guardarEnSheets() {
  let nVentas = 0;
  let nPagos = 0;
  let nStock = 0;
  let nBorrar = 0;
  try {
    const vRaw = localStorage.getItem("ventasPendientes");
    if (vRaw) nVentas = JSON.parse(vRaw).length;
  } catch (e) {}
  try {
    const pRaw = localStorage.getItem("pagosPendientes");
    if (pRaw) nPagos = JSON.parse(pRaw).length;
  } catch (e) {}
  try {
    const sRaw = localStorage.getItem("stockPendienteUsuarios");
    if (sRaw) nStock = JSON.parse(sRaw).length;
  } catch (e) {}
  try {
    const bRaw = localStorage.getItem("borrarVentasPendientes");
    if (bRaw) nBorrar = JSON.parse(bRaw).length;
  } catch (e) {}

  if (nVentas === 0 && nPagos === 0 && nStock === 0 && nBorrar === 0) {
    alert("No hay nada pendiente de enviar al Sheet.");
    return;
  }

  try {
    await guardarVentasPendientesEnSheet();
    await guardarPagosPendientesEnSheet();
    await guardarBorrarVentasPendienteEnSheet();
    await guardarStockPendienteEnSheet();
    await cargarDatosDesdeSheet();
    alert("✅ Todo pendiente se envió a Google Sheets.");
  } catch (err) {
    alert("❌ Error al guardar: " + err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  cargarDatos();
  render();
  try {
    await cargarDatosDesdeSheet();
    await cargarClientesHistoricos();
    render();
  } catch(e) {
    console.warn("No se pudo sincronizar con Sheets al inicio:", e);
  }
});

function render() {
  renderStockGeneral();
  renderVentasGeneral();
  renderClientesGlobales();
  renderTransferencia();
  renderUsuarios();
  renderPanelUsuario();
}

function renderStockGeneral() {
  const container = document.getElementById("stock-general-section");
  if (!container) return;
  const stats = getEstadisticasVentas();
  container.innerHTML = `
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="card">
        <div class="flex space-between">
          <h2>Stock General (Disponible)</h2>
          <button onclick="mostrarHistorialStock()" style="background:#7c3aed; padding:6px 12px; font-size:0.85em;">📜 Historial</button>
        </div>
        <table style="width:100%; border-collapse: collapse; margin-top:10px;">
          <thead>
            <tr style="border-bottom: 2px solid #e5e7eb; text-align: left;">
              <th style="padding: 8px 4px; font-size: 0.9em;">Estilo</th>
              <th style="padding: 8px 4px; text-align: center; font-size: 0.9em; color: #3b82f6;">Con Etiq</th>
              <th style="padding: 8px 4px; text-align: center; font-size: 0.9em; color: #6b7280;">Sin Etiq</th>
              <th style="padding: 8px 4px; text-align: center; font-size: 0.9em;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${estilosBase.map(e => {
              const conEtiq = Object.values(state.usuarios).reduce((sum, u) => sum + (u.stock[e] || 0), 0);
              const sinEtiq = Object.values(state.usuarios).reduce((sum, u) => sum + ((u.stockSinEtiqueta && u.stockSinEtiqueta[e]) || 0), 0);
              const total = conEtiq + sinEtiq;
              return `
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 4px; font-weight: 500;">${e}</td>
                <td style="padding: 6px 4px; text-align: center;">${conEtiq}</td>
                <td style="padding: 6px 4px; text-align: center;">${sinEtiq}</td>
                <td style="padding: 6px 4px; text-align: center; font-weight: bold; color: ${total < 0? '#ef4444' : '#1f2937'};">${total}</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="border-top: 2px solid #3b82f6; background: #eff6ff;">
              <td style="padding: 8px 4px; font-weight: bold;">TOTAL</td>
              <td style="padding: 8px 4px; text-align: center; font-weight: bold; color: #3b82f6;">
                ${estilosBase.reduce((sum, e) => sum + Object.values(state.usuarios).reduce((s, u) => s + (u.stock[e] || 0), 0), 0)}
              </td>
              <td style="padding: 8px 4px; text-align: center; font-weight: bold; color: #6b7280;">
                ${estilosBase.reduce((sum, e) => sum + Object.values(state.usuarios).reduce((s, u) => s + ((u.stockSinEtiqueta && u.stockSinEtiqueta[e]) || 0), 0), 0)}
              </td>
              <td style="padding: 8px 4px; text-align: center; font-weight: bold; color: #1e40af;">
                ${estilosBase.reduce((sum, e) => sum + Object.values(state.usuarios).reduce((s, u) => s + (u.stock[e] || 0) + ((u.stockSinEtiqueta && u.stockSinEtiqueta[e]) || 0), 0), 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="card" style="background: #f8fafc; border: 1px solid #e2e8f0;">
        <h2>Popularidad (% Ventas)</h2>
        ${(() => {
          const tieneSheet = Object.keys(state.popularidadSheet || {}).length > 0;
          if (tieneSheet) {
            const entradas = Object.entries(state.popularidadSheet)
              .sort((a, b) => (b[1].cantidad || 0) - (a[1].cantidad || 0));
            const totalLatas = entradas.reduce((s, [, v]) => s + (v.cantidad || 0), 0);
            return entradas.map(([estilo, v]) => `
              <div class="flex space-between" style="padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
                <span>${estilo}</span>
                <span style="color:#64748b; font-size:0.85em; margin-right:8px;">${v.cantidad} latas</span>
                <span style="color: #3b82f6; font-weight: bold;">${v.porcentaje}%</span>
              </div>`).join("") +
              `<div style="margin-top: 15px; text-align: right;">
                <small style="color: #64748b;">Total latas vendidas: <b>${totalLatas}</b></small>
              </div>`;
          }
          if (Object.entries(stats.totalesPorEstilo).length === 0)
            return '<p style="color:gray; font-size: 0.9em;">Esperando primeras ventas...</p>';
          return Object.entries(stats.totalesPorEstilo)
            .sort((a, b) => b[1] - a[1])
            .map(([estilo, cant]) => {
              const porcentaje = ((cant / stats.granTotalLatas) * 100).toFixed(0);
              return `
                <div class="flex space-between" style="padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
                  <span>${estilo}</span>
                  <span style="color: #3b82f6; font-weight: bold;">${porcentaje}%</span>
                </div>`;
            }).join("") +
            `<div style="margin-top: 15px; text-align: right;">
              <small style="color: #64748b;">Total latas vendidas: <b>${stats.granTotalLatas}</b></small>
            </div>`;
        })()}
      </div>
    </div>`;
}

function renderVentasGeneral() {
  const container = document.getElementById("ventas-general-section");
  if (!container) return;
  const dineroEfectivo = getTotalVentasPorMetodo("efectivo");
  const dineroTransferencia = getTotalVentasPorMetodo("transferencia");
  const dineroTotal = getTotalVentasDinero();
  const totalProfeta = getGananciaTotalProfeta();
  const todasLasVentas = getVentasGenerales().filter(
    v => (Number(v.totalCobrado) || 0) > 0 && ventaApareceEnHistorialGlobal(v)
  );
  
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div class="card" style="border-left: 4px solid #059669;">
        <h2>💵 Dinero Ingresado (Efectivo)</h2>
        <p class="big-number" style="color: #059669;">$${dineroEfectivo.toLocaleString()}</p>
        <small>Ventas cobradas en efectivo</small>
      </div>
      <div class="card" style="border-left: 4px solid #2563eb;">
        <h2>🏦 Dinero Ingresado (Transferencia)</h2>
        <p class="big-number" style="color: #2563eb;">$${dineroTransferencia.toLocaleString()}</p>
        <small>Ventas cobradas por transferencia</small>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
      <div class="card" style="border-left: 4px solid #3b82f6;">
        <h2>💰 Total Ingresado</h2>
        <p class="big-number" style="color: #3b82f6;">$${(state.totalIngresadoSheet != null ? state.totalIngresadoSheet : dineroTotal).toLocaleString()}</p>
        <small>${state.totalIngresadoSheet != null ? '📊 Desde hoja Venta de Latas y Barriles (D1)' : 'Efectivo + Transferencia'}</small>
      </div>
      <div class="card">
        <h2>👑 Para El Profeta (Total)</h2>
        <p class="big-number" style="color: #059669;">$${totalProfeta.toLocaleString()}</p>
        <small>Costo + 50% Ganancia generada</small>
      </div>
    </div>

    <div class="card" style="margin-top: 20px; border-left: 4px solid #7c3aed;">
      <h2>📋 Historial Global (${todasLasVentas.length} ventas)</h2>
      <p style="color:#64748b; font-size:0.85em; margin:0 0 8px 0;">Solo ventas ya cobradas (tras «Cobrar» en Cartera). La venta en cuenta aparece primero en Cartera de Deudores. Sheet: botón «Guardar en Sheet».</p>
      <div style="max-height: 300px; overflow-y: auto; margin-top: 10px;">
        ${todasLasVentas.length === 0
          ? '<p style="color:gray;">No hay ventas cobradas aún. Registrá el cobro en Cartera de Deudores.</p>'
          : [...todasLasVentas].reverse().map(v => {
              const vendedor = v.vendedor || Object.keys(state.usuarios).find(u =>
                state.usuarios[u].ventas.some(vv => vv === v)
              ) || '—';
              return `
              <div style="border-bottom: 1px solid #f3f4f6; padding: 8px 0; font-size: 0.88em;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
                  <span><b>👤 ${v.cliente || 'Consumidor Final'}</b>
                    <span style="margin-left:8px; background:#ede9fe; color:#7c3aed; border-radius:6px; padding:1px 7px; font-size:0.85em;">
                      ${vendedor}
                    </span>
                  </span>
                  <small style="color:#64748b;">📅 ${v.fecha || ''}</small>
                </div>
                <div style="color:#555; margin: 3px 0;">
                  ${Object.entries(v.estilos || {}).filter(([,c]) => Number(c) > 0).map(([e,c]) => `${c} ${e}`).join(', ') || '—'}
                  <b style="color:#1e40af; margin-left:6px;">(${Object.values(v.estilos || {}).reduce((a,b) => a+(Number(b)||0), 0)} latas)</b>
                  <span style="margin-left:6px; padding:1px 8px; border-radius:10px; font-size:0.82em; font-weight:600; background:${v.tipoLata === 'sinEtiqueta' ? '#dbeafe' : '#fef9c3'}; color:${v.tipoLata === 'sinEtiqueta' ? '#1e40af' : '#92400e'};">${v.tipoLata === 'sinEtiqueta' ? '📦 Sin etiqueta' : '🏷️ Con etiqueta'}</span>
                </div>
                <div style="display:flex; gap:12px; flex-wrap:wrap; color:#374151; align-items:center;">
                  <span>💵 $${(v.totalCobrado||0).toLocaleString()}</span>
                  ${(() => {
                    const est = String(v.estado || "").trim().toUpperCase();
                    const mp = String(v.metodoPago || "").trim().toLowerCase();
                    if (est === "PENDIENTE" && !mp)
                      return '<span style="padding:1px 8px; border-radius:6px; font-size:0.85em; font-weight:600; background:#fef3c7; color:#92400e;">⏳ Fiado (pendiente)</span>';
                    if (mp === "transferencia")
                      return '<span style="padding:1px 8px; border-radius:6px; font-size:0.85em; font-weight:600; background:#dbeafe; color:#1e40af;">🏦 Transferencia</span>';
                    return '<span style="padding:1px 8px; border-radius:6px; font-size:0.85em; font-weight:600; background:#dcfce7; color:#166534;">💵 Efectivo</span>';
                  })()}
                  <span>Comisión: $${(v.comision||0).toLocaleString()}</span>
                  <span>👑 Profeta: $${paraProfetaMostrar(v).toLocaleString()}</span>
                </div>
              </div>`;
            }).join("")
        }
      </div>
    </div>`;
}
function renderClientesGlobales() {
  const container = document.getElementById("clientes-section");
  if (!container) return;
  const deudores = state.clientesGlobales.filter(c => (c.deuda - c.pagado) > 0);
  const deudaTotal = deudores.reduce((acc, c) => acc + (c.deuda - c.pagado), 0);
  
  container.innerHTML = `
    <div class="card" style="border-left: 5px solid #ef4444;">
      <div class="flex space-between">
        <h2>👥 Cartera de Clientes (Deudores)</h2>
        <b style="color: #ef4444;">Deuda Total: $${deudaTotal.toLocaleString()}</b>
      </div>
      <div style="max-height: 250px; overflow-y: auto; margin-top: 10px;">
        ${deudores.length === 0 ? '<p>No hay deudas pendientes</p>' :
          deudores.map((c) => {
            const idx = state.clientesGlobales.indexOf(c);
            const deuda = c.deuda - c.pagado;
            return `
            <div style="padding: 10px 0; border-bottom: 1px solid #eee;">
              <div class="flex space-between" style="flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom:6px;">
                <span><b>${c.nombre}</b> (Debe: $${deuda.toLocaleString()})</span>
                <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                  <button onclick="registrarPagoCliente(${idx}, 'efectivo', '100')" style="background:#059669; padding:4px 8px; font-size:0.8em;">💵 100%</button>
                  <button onclick="registrarPagoCliente(${idx}, 'efectivo', '50')" style="background:#10b981; padding:4px 8px; font-size:0.8em;">💵 50%</button>
                  <button onclick="registrarPagoCliente(${idx}, 'transferencia', '100')" style="background:#2563eb; padding:4px 8px; font-size:0.8em;">🏦 100%</button>
                  <button onclick="registrarPagoCliente(${idx}, 'transferencia', '50')" style="background:#3b82f6; padding:4px 8px; font-size:0.8em;">🏦 50%</button>
                </div>
              </div>
              <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                <input id="pago-manual-${idx}" type="number" placeholder="Monto manual..." min="1"
                  style="width:140px; padding:5px 8px; border:1px solid #d1d5db; border-radius:8px; font-size:0.85em; margin:0;" />
                <select id="pago-metodo-${idx}" style="padding:5px 8px; border:1px solid #d1d5db; border-radius:8px; font-size:0.85em; margin:0;">
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="transferencia">🏦 Transferencia</option>
                </select>
                <button onclick="registrarPagoManual(${idx})" style="background:#7c3aed; padding:5px 12px; font-size:0.85em; border-radius:8px;">✔ Cobrar</button>
              </div>
            </div>`;
          }).join("")}
      </div>
    </div>`;
}

function renderPanelUsuario() {
  const container = document.getElementById("panel-usuario-container");
  if (!container) return;
  if (!state.usuarioActivo) { container.innerHTML = ""; return; }
  const usuario = state.usuarios[state.usuarioActivo];
  const preview = calcularPreview();
  const totalLatas = Object.values(state.ventaActual).reduce((a, b) => a + (Number(b) || 0), 0);
  const precioUnitario = state.precioUnitario || "";
  const totalCobrado = totalLatas > 0 && precioUnitario ? totalLatas * Number(precioUnitario) : 0;

  container.innerHTML = `
    <div class="panel-usuario card">
      <h1 style="border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Panel de ${state.usuarioActivo}</h1>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
        <div>
          <h3>📦 Stock Propio</h3>
          <table style="width:100%; border-collapse: collapse; margin-top:10px; background: #f8fafc; border-radius: 8px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e7eb; text-align: left;">
                <th style="padding: 6px 4px; font-size: 0.85em;">Estilo</th>
                <th style="padding: 6px 4px; text-align: center; font-size: 0.85em; color: #3b82f6;">C/E</th>
                <th style="padding: 6px 4px; text-align: center; font-size: 0.85em; color: #6b7280;">S/E</th>
                <th style="padding: 6px 4px; text-align: center; font-size: 0.85em;">Tot</th>
              </tr>
            </thead>
            <tbody>
              ${estilosBase.map(e => {
                const conEtiq = usuario.stock[e] || 0;
                const sinEtiq = (usuario.stockSinEtiqueta && usuario.stockSinEtiqueta[e]) || 0;
                const total = conEtiq + sinEtiq;
                return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 5px 4px; font-size: 0.9em;">${e}</td>
                  <td style="padding: 5px 4px; text-align: center;">${conEtiq}</td>
                  <td style="padding: 5px 4px; text-align: center;">${sinEtiq}</td>
                  <td style="padding: 5px 4px; text-align: center; font-weight: bold; color: ${total < 0 ? '#ef4444' : '#1e40af'};">${total}</td>
                </tr>`;
              }).join("")}
            </tbody>
            <tfoot>
              <tr style="border-top: 2px solid #3b82f6; background: #eff6ff;">
                <td style="padding: 6px 4px; font-weight: bold; font-size: 0.9em;">TOTAL</td>
                <td style="padding: 6px 4px; text-align: center; font-weight: bold; color: #3b82f6;">
                  ${estilosBase.reduce((sum, e) => sum + (usuario.stock[e] || 0), 0)}
                </td>
                <td style="padding: 6px 4px; text-align: center; font-weight: bold; color: #6b7280;">
                  ${estilosBase.reduce((sum, e) => sum + ((usuario.stockSinEtiqueta && usuario.stockSinEtiqueta[e]) || 0), 0)}
                </td>
                <td style="padding: 6px 4px; text-align: center; font-weight: bold; color: #1e40af;">
                  ${estilosBase.reduce((sum, e) => sum + (usuario.stock[e] || 0) + ((usuario.stockSinEtiqueta && usuario.stockSinEtiqueta[e]) || 0), 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div>
          <h3>➕ Agregar Stock</h3>
          ${estilosBase.map(e => `
            <div class="flex space-between" style="margin-bottom: 5px; align-items: center;">
              <span style="font-size: 0.9em;">${e}</span>
              <input type="number" data-agregar="${e}" placeholder="0" style="width: 70px; margin-bottom:0; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px;">
            </div>`).join("")}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 12px;">
            <button id="btn-agregar-stock" style="background:#059669; padding: 10px; font-size: 0.9em;">✅ Con Etiqueta</button>
            <button id="btn-agregar-stock-sin-etiqueta" style="background:#6b7280; padding: 10px; font-size: 0.9em;">📦 Sin Etiqueta</button>
          </div>
          <button id="btn-reset-stock" style="width:100%; margin-top:6px; background:#ef4444; padding: 10px;">Reset Stock Total</button>
          <div style="margin-top:15px; padding-top:15px; border-top:2px solid #e5e7eb;">
            <h4 style="margin:0 0 8px 0; font-size:0.9em;">🔄 Convertir Stock Propio</h4>
            <select id="transfer-estilo" style="width:100%; margin-bottom:6px; padding:6px; font-size:0.85em;">
              ${estilosBase.map(e => `<option value="${e}">${e}</option>`).join("")}
            </select>
            <input type="number" id="transfer-cantidad" placeholder="Cantidad" style="width:100%; margin-bottom:6px; padding:6px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
              <button id="btn-ce-a-se" style="background:#60a5fa; padding:8px; font-size:0.8em;">C/E → S/E</button>
              <button id="btn-se-a-ce" style="background:#f59e0b; padding:8px; font-size:0.8em;">S/E → C/E</button>
            </div>
          </div>
        </div>
        <div>
          <h3>🛒 Registrar Venta</h3>
          <div style="position: relative; margin-bottom: 10px;">
            <input type="text" id="cliente-nombre" placeholder="Nombre Cliente (Opcional)"
              value="${state.clienteNombre}" autocomplete="off" style="margin-bottom: 0; width: 100%;">
            <div id="sugerencias-cliente" style="
              position: absolute; top: 100%; left: 0; right: 0;
              background: white; border: 1px solid #d1d5db; border-top: none;
              border-radius: 0 0 8px 8px; max-height: 160px; overflow-y: auto;
              z-index: 999; display: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            "></div>
          </div>
          ${estilosBase.map(e => `
            <div class="flex space-between" style="margin-bottom: 5px;">
              <span>${e}</span>
              <input type="number" data-venta="${e}" value="${state.ventaActual[e] || ""}" placeholder="0" style="width: 80px;">
            </div>`).join("")}
          <input type="text" id="alquiler-barril" placeholder="Alquiler barril (ej: HONEY 30Lts)"
            value="${state.alquilerBarril || ""}" style="margin-top: 6px;">
          <div style="margin-top: 10px; background: #1e293b; border-radius: 10px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <span style="color: #94a3b8; font-size: 0.9em;">Total latas:</span>
              <b style="color: #f1f5f9; font-size: 1.4em;">${totalLatas}</b>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
              <button onclick="setState(p => { p.tipoLata = 'conEtiqueta'; return p; })"
                style="flex:1; padding: 8px 4px; border-radius: 8px;
                       border: 2px solid ${state.tipoLata !== 'sinEtiqueta' ? '#f59e0b' : '#334155'};
                       background: ${state.tipoLata !== 'sinEtiqueta' ? '#f59e0b' : '#0f172a'};
                       color: ${state.tipoLata !== 'sinEtiqueta' ? '#1e293b' : '#64748b'};
                       font-weight: bold; font-size: 0.8em; cursor: pointer; line-height: 1.4;">
                🏷️ Con Etiqueta<br><span style="font-size:0.85em; font-weight:normal;">$1.750</span>
              </button>
              <button onclick="setState(p => { p.tipoLata = 'sinEtiqueta'; return p; })"
                style="flex:1; padding: 8px 4px; border-radius: 8px;
                       border: 2px solid ${state.tipoLata === 'sinEtiqueta' ? '#60a5fa' : '#334155'};
                       background: ${state.tipoLata === 'sinEtiqueta' ? '#60a5fa' : '#0f172a'};
                       color: ${state.tipoLata === 'sinEtiqueta' ? '#1e293b' : '#64748b'};
                       font-weight: bold; font-size: 0.8em; cursor: pointer; line-height: 1.4;">
                📦 Sin Etiqueta<br><span style="font-size:0.85em; font-weight:normal;">$1.450</span>
              </button>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <label style="color: #94a3b8; font-size: 0.9em; white-space: nowrap;">Precio unitario $</label>
              <input type="number" id="precio-unitario" value="${precioUnitario}"
                placeholder="ej: 2400"
                style="flex:1; background:#0f172a; color:#f1f5f9; border:1px solid #334155;
                       border-radius:6px; padding:6px 10px; font-size:1em; margin-bottom:0;">
            </div>
            <div style="text-align: right; margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155;">
              <span style="color: #94a3b8; font-size: 0.85em;">Total a cobrar:</span>
              <b style="color: #34d399; font-size: 1.3em; margin-left: 8px;" data-total-display>
                $${totalCobrado > 0 ? totalCobrado.toLocaleString() : "—"}
              </b>
            </div>
          </div>
          <div style="background:#fef3c7; border: 1px solid #f59e0b; border-radius: 10px; padding: 12px; margin-top: 10px;">
            <h4 style="margin: 0 0 8px 0; color: #92400e;">📊 Vista Previa Profeta</h4>
            <div style="display:flex; justify-content:space-between; margin: 4px 0; font-size:0.9em;">
              <span style="color:#78350f;">Costo (${state.tipoLata === 'sinEtiqueta' ? 'sin etiqueta' : 'con etiqueta'}):</span>
              <b style="color:#92400e;">$${preview.costoTotal.toLocaleString()}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin: 4px 0; font-size:0.9em;">
              <span style="color:#78350f;">Comisión (50%):</span>
              <b style="color:${preview.comision > 0 ? '#059669' : '#92400e'};">
                ${preview.comision > 0 ? '$' + preview.comision.toLocaleString() : '— (ingresá precio)'}
              </b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f59e0b;">
              <span style="color:#78350f; font-weight:bold;">Total a Rendir:</span>
              <b style="color:#b45309; font-size:1.1em;">$${preview.paraProfeta.toLocaleString()}</b>
            </div>
            ${preview.gananciaBruta > 0 ? `<div style="margin-top:6px; font-size:0.8em; color:#78350f; text-align:right;">Ganancia bruta: $${preview.gananciaBruta.toLocaleString()}</div>` : ''}
          </div>
          <button id="btn-registrar" style="width:100%; margin-top:10px; background:#1e40af;">
            ✅ Registrar Venta
          </button>
        </div>
      </div>
      <hr>
      <div class="flex space-between">
        <h3>📜 Historial de Ventas</h3>
        <div>
          <button id="btn-guardar" style="background:#059669;">💾 Guardar en Sheet</button>
        </div>
      </div>
      <div id="historial-lista" style="margin-top: 15px;">
        ${usuario.ventas.length === 0 ? '<p>No hay ventas registradas</p>' :
          [...usuario.ventas].reverse().map((v, i) => `
          <div style="border-bottom:1px solid #eee; padding:10px 0; font-size: 0.9em;">
            <div class="flex space-between" style="align-items: flex-start;">
              <div style="flex:1;">
                <div class="flex space-between">
                  <b>👤 ${v.cliente || 'Consumidor Final'}</b>
                  <small>📅 ${v.fecha || ''}</small>
                </div>
                <div style="color: #666; margin: 4px 0;">
                  ${Object.entries(v.estilos || {}).filter(([,c]) => Number(c) > 0).map(([e,c]) => `${c} ${e}`).join(", ") || '—'}
                  <b style="color:#1e40af;">(${Object.values(v.estilos || {}).reduce((a,b) => a+(Number(b)||0),0)} latas)</b>
                  <span style="margin-left:6px; padding:1px 8px; border-radius:10px; font-size:0.82em; font-weight:600; background:${v.tipoLata === 'sinEtiqueta' ? '#dbeafe' : '#fef9c3'}; color:${v.tipoLata === 'sinEtiqueta' ? '#1e40af' : '#92400e'};">${v.tipoLata === 'sinEtiqueta' ? '📦 Sin etiqueta' : '🏷️ Con etiqueta'}</span>
                </div>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                  <span>💵 $${(v.totalCobrado||0).toLocaleString()}</span>
                  <span style="color:#059669;">Comisión: $${(v.comision||0).toLocaleString()}</span>
                  <span style="color:#b45309;">👑 Profeta: $${paraProfetaMostrar(v).toLocaleString()}</span>
                </div>
              </div>
              <button onclick="borrarVentaIndividual(${usuario.ventas.length - 1 - i})" title="Borrar esta venta"
                style="margin-left:12px; background:#ef4444; padding:4px 10px; font-size:0.85em; border-radius:6px; flex-shrink:0; cursor:pointer;">
                🗑️
              </button>
            </div>
          </div>`).join("")}
      </div>
    </div>`;

  bindPanelEventos();
  bindAutocompletadoCliente();
  bindPrecioUnitario();
}
function bindPrecioUnitario() {
  const input = document.getElementById("precio-unitario");
  if (!input) return;
  input.addEventListener("input", () => {
    const precio = Number(input.value) || 0;
    state.precioUnitario = input.value;
    const totalLatas = Object.values(state.ventaActual).reduce((a, b) => a + (Number(b) || 0), 0);
    const total = totalLatas * precio;
    state.totalCobradoInput = total > 0 ? String(total) : "";
    const display = document.querySelector("[data-total-display]");
    if (display) display.textContent = total > 0 ? "$" + total.toLocaleString() : "$—";
  });
}

function bindAutocompletadoCliente() {
  const input = document.getElementById("cliente-nombre");
  const sugerencias = document.getElementById("sugerencias-cliente");
  if (!input || !sugerencias) return;

  input.addEventListener("input", () => {
    const val = input.value.trim().toLowerCase();
    state.clienteNombre = input.value;
    if (val.length < 1) { sugerencias.style.display = "none"; return; }

    const nombresGlobales = state.clientesGlobales.map(c => c.nombre);
    const nombresHistoricos = (clientesHistoricos || []).map(c => c.nombre || c).filter(Boolean);
    const todosUnicos = [...new Set([...nombresGlobales, ...nombresHistoricos])];
    const empiezan = todosUnicos.filter(n => n.toLowerCase().startsWith(val));
    const contienen = todosUnicos.filter(n => !n.toLowerCase().startsWith(val) && n.toLowerCase().includes(val));
    const filtrados = [...empiezan, ...contienen].slice(0, 10);

    if (!filtrados.length) { sugerencias.style.display = "none"; return; }

    sugerencias.innerHTML = filtrados.map(nombre => {
      const cliente = state.clientesGlobales.find(c => c.nombre === nombre);
      const deuda = cliente ? (cliente.deuda - cliente.pagado) : 0;
      return `
      <div onclick="seleccionarCliente('${nombre.replace(/'/g, "\\'")}')"
        style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; font-size: 0.9em;"
        onmouseover="this.style.background='#eff6ff'"
        onmouseout="this.style.background='white'">
        👤 ${nombre} ${deuda > 0 ? `<span style="color:#dc2626; font-size:0.8em;">(Debe $${deuda.toLocaleString()})</span>` : ''}
      </div>`;
    }).join("");
    sugerencias.style.display = "block";
  });

  input.addEventListener("blur", () => setTimeout(() => { sugerencias.style.display = "none"; }, 200));
  input.addEventListener("focus", () => { if (input.value.trim().length > 0) input.dispatchEvent(new Event("input")); });
}

function seleccionarCliente(nombre) {
  state.clienteNombre = nombre;
  const input = document.getElementById("cliente-nombre");
  if (input) input.value = nombre;
  const sugerencias = document.getElementById("sugerencias-cliente");
  if (sugerencias) sugerencias.style.display = "none";

  const ventas = Object.values(state.usuarios).flatMap(u => u.ventas);
  const ventasCliente = ventas.filter(v => v.cliente && v.cliente.toLowerCase() === nombre.toLowerCase());
  if (ventasCliente.length > 0) {
    const ultima = ventasCliente[ventasCliente.length - 1];
    setState(p => { p.ventaActual = { ...ultima.estilos }; return p; });
  }
}

function bindPanelEventos() {
  document.querySelectorAll("[data-stock]").forEach(i =>
    i.onchange = (e) => modificarStockDirecto(state.usuarioActivo, e.target.dataset.stock, e.target.value));

  document.querySelectorAll("[data-venta]").forEach(i =>
    i.onchange = (e) => {
      setState(p => { p.ventaActual[e.target.dataset.venta] = e.target.value; return p; });
    });

  const clienteInput = document.getElementById("cliente-nombre");
  if (clienteInput) clienteInput.oninput = (e) => { state.clienteNombre = e.target.value; };

  const barrilInput = document.getElementById("alquiler-barril");
  if (barrilInput) barrilInput.oninput = (e) => { state.alquilerBarril = e.target.value; };

  const btnRegistrar = document.getElementById("btn-registrar");
  if (btnRegistrar) btnRegistrar.onclick = () => {
    const precio = Number(state.precioUnitario) || 0;
    const totalLatas = Object.values(state.ventaActual).reduce((a, b) => a + (Number(b) || 0), 0);
    if (precio > 0 && totalLatas > 0) {
      state.totalCobradoInput = String(totalLatas * precio);
    }
    registrarVentaLocal();
    state.precioUnitario = "";
  };

  const btnGuardar = document.getElementById("btn-guardar");
  if (btnGuardar) btnGuardar.onclick = async function() {
    this.disabled = true;
    this.textContent = "⏳ Guardando...";
    guardarDatos();
    await guardarEnSheets();
    this.disabled = false;
    this.textContent = "💾 Guardar en Sheet";
  };

  const btnAgregarStock = document.getElementById("btn-agregar-stock");
  if (btnAgregarStock) btnAgregarStock.onclick = async () => {
    document.querySelectorAll("[data-agregar]").forEach(input => {
      const estilo = input.dataset.agregar;
      const cantidad = Number(input.value);
      if (!isNaN(cantidad) && input.value.trim() !== "" && cantidad !== 0) {
        modificarStockDirecto(state.usuarioActivo, estilo, (state.usuarios[state.usuarioActivo].stock[estilo] || 0) + cantidad, 'conEtiqueta');
        input.value = "";
      }
    });
    encolarActualizarStockEnSheet(state.usuarioActivo);
  };

  const btnAgregarStockSin = document.getElementById("btn-agregar-stock-sin-etiqueta");
  if (btnAgregarStockSin) btnAgregarStockSin.onclick = async () => {
    document.querySelectorAll("[data-agregar]").forEach(input => {
      const estilo = input.dataset.agregar;
      const cantidad = Number(input.value);
      if (!isNaN(cantidad) && input.value.trim() !== "" && cantidad !== 0) {
        setState((prev) => {
          const usuario = prev.usuarios[prev.usuarioActivo];
          if (!usuario.stockSinEtiqueta) {
            usuario.stockSinEtiqueta = {
              "BLONDE": 0, "IRISH RED": 0, "STOUT": 0,
              "SESSION IPA": 0, "RED IPA": 0, "HONEY": 0
            };
          }
          usuario.stockSinEtiqueta[estilo] = (usuario.stockSinEtiqueta[estilo] || 0) + cantidad;
          return prev;
        });
        registrarCargaStock(state.usuarioActivo, estilo, cantidad, 'sinEtiqueta');
        input.value = "";
      }
    });
    encolarActualizarStockEnSheet(state.usuarioActivo);
  };

  const btnReset = document.getElementById("btn-reset-stock");
  if (btnReset) btnReset.onclick = () => {
    if (confirm("¿Resetear todo el stock a 0?")) {
      setState(p => {
        estilosBase.forEach(e => {
          p.usuarios[p.usuarioActivo].stock[e] = 0;
          if (p.usuarios[p.usuarioActivo].stockSinEtiqueta) {
            p.usuarios[p.usuarioActivo].stockSinEtiqueta[e] = 0;
          }
        });
        return p;
      });
      encolarActualizarStockEnSheet(state.usuarioActivo);
    }
  };

  const btnCeSe = document.getElementById("btn-ce-a-se");
  if (btnCeSe) btnCeSe.onclick = () => {
    const estilo = document.getElementById("transfer-estilo").value;
    const cantidad = Number(document.getElementById("transfer-cantidad").value);
    if (cantidad > 0) {
      setState(p => {
        const u = p.usuarios[p.usuarioActivo];
        if (!u.stockSinEtiqueta) u.stockSinEtiqueta = {};
        u.stock[estilo] = (u.stock[estilo] || 0) - cantidad;
        u.stockSinEtiqueta[estilo] = (u.stockSinEtiqueta[estilo] || 0) + cantidad;
        return p;
      });
      registrarCargaStock(state.usuarioActivo, estilo, -cantidad, 'conEtiqueta');
      registrarCargaStock(state.usuarioActivo, estilo, cantidad, 'sinEtiqueta');
      document.getElementById("transfer-cantidad").value = "";
      encolarActualizarStockEnSheet(state.usuarioActivo);
    }
  };

  const btnSeCe = document.getElementById("btn-se-a-ce");
  if (btnSeCe) btnSeCe.onclick = () => {
    const estilo = document.getElementById("transfer-estilo").value;
    const cantidad = Number(document.getElementById("transfer-cantidad").value);
    if (cantidad > 0) {
      setState(p => {
        const u = p.usuarios[p.usuarioActivo];
        if (!u.stockSinEtiqueta) u.stockSinEtiqueta = {};
        u.stockSinEtiqueta[estilo] = (u.stockSinEtiqueta[estilo] || 0) - cantidad;
        u.stock[estilo] = (u.stock[estilo] || 0) + cantidad;
        return p;
      });
      registrarCargaStock(state.usuarioActivo, estilo, -cantidad, 'sinEtiqueta');
      registrarCargaStock(state.usuarioActivo, estilo, cantidad, 'conEtiqueta');
      document.getElementById("transfer-cantidad").value = "";
      encolarActualizarStockEnSheet(state.usuarioActivo);
    }
  };
}

function renderUsuarios() {
  const container = document.getElementById("usuarios-section");
  if (!container) return;
  container.innerHTML = Object.keys(state.usuarios).map(u => `
    <button onclick="setState(p => { p.usuarioActivo = '${u}'; return p; })"
      style="background: ${state.usuarioActivo === u ? '#1e40af' : '#3b82f6'}; margin: 5px;">
      Panel ${u}
    </button>`).join("");
}

function renderTransferencia() {
  const container = document.getElementById("transferencia-section");
  if (!container) return;
  container.innerHTML = `
    <div class="card">
      <div class="flex space-between">
        <h2>📦 Transferencia de Stock entre Usuarios</h2>
        <button onclick="mostrarHistorialTransferencias()" style="background:#7c3aed; padding:6px 12px; font-size:0.85em;">📜 Historial</button>
      </div>
      <div class="flex" style="flex-wrap: wrap; gap: 10px; align-items: center;">
        <select onchange="setState(p => { p.transferDesde = this.value; return p; })" style="width: auto; padding: 8px; border-radius: 6px;">
          ${Object.keys(state.usuarios).map(u => `<option ${state.transferDesde === u ? 'selected' : ''} value="${u}">${u}</option>`).join("")}
        </select>
        <span style="font-weight: bold; color: #3b82f6;">→</span>
        <select onchange="setState(p => { p.transferHacia = this.value; return p; })" style="width: auto; padding: 8px; border-radius: 6px;">
          ${Object.keys(state.usuarios).map(u => `<option ${state.transferHacia === u ? 'selected' : ''} value="${u}">${u}</option>`).join("")}
        </select>
      </div>
      <div style="margin-top: 15px;">
        ${estilosBase.map(e => `
          <div class="flex space-between" style="margin-bottom: 5px; align-items: center;">
            <span style="font-size: 0.9em;">${e}</span>
            <input type="number" data-transfer="${e}" placeholder="0" style="width: 80px; margin-bottom:0; padding: 4px; border: 1px solid #d1d5db; border-radius: 4px;">
          </div>`).join("")}
      </div>
      <div style="display:flex; gap:8px; margin-top:15px;">
        <button id="btn-transferir-con" style="flex:1; background:#059669; padding:10px; font-size:0.9em;">✅ Transferir Con Etiqueta</button>
        <button id="btn-transferir-sin" style="flex:1; background:#6b7280; padding:10px; font-size:0.9em;">📦 Transferir Sin Etiqueta</button>
      </div>
    </div>`;

  function ejecutarTransferencia(tipo) {
    const desde = state.transferDesde;
    const hacia = state.transferHacia;
    if (desde === hacia) { alert("No podés transferir al mismo usuario"); return; }
    document.querySelectorAll("[data-transfer]").forEach(input => {
      const estilo = input.dataset.transfer;
      const cantidad = Number(input.value);
      if (!isNaN(cantidad) && cantidad > 0) {
        setState((prev) => {
          const usuarioDesde = prev.usuarios[desde];
          const usuarioHacia = prev.usuarios[hacia];
          if (tipo === 'con') {
            usuarioDesde.stock[estilo] = (usuarioDesde.stock[estilo] || 0) - cantidad;
            usuarioHacia.stock[estilo] = (usuarioHacia.stock[estilo] || 0) + cantidad;
          } else {
            if (!usuarioDesde.stockSinEtiqueta) usuarioDesde.stockSinEtiqueta = {};
            if (!usuarioHacia.stockSinEtiqueta) usuarioHacia.stockSinEtiqueta = {};
            usuarioDesde.stockSinEtiqueta[estilo] = (usuarioDesde.stockSinEtiqueta[estilo] || 0) - cantidad;
            usuarioHacia.stockSinEtiqueta[estilo] = (usuarioHacia.stockSinEtiqueta[estilo] || 0) + cantidad;
          }
          return prev;
        });
        registrarTransferenciaHistorial(desde, hacia, estilo, cantidad, tipo === 'con' ? 'conEtiqueta' : 'sinEtiqueta');
        input.value = "";
      }
    });
    encolarActualizarStockEnSheet(desde);
    encolarActualizarStockEnSheet(hacia);
  }

  const btnCon = document.getElementById("btn-transferir-con");
  if (btnCon) btnCon.onclick = () => ejecutarTransferencia('con');
  const btnSin = document.getElementById("btn-transferir-sin");
  if (btnSin) btnSin.onclick = () => ejecutarTransferencia('sin');
}

function mostrarHistorialStock() {
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";

  modal.innerHTML = `
    <div style="background:white; border-radius:12px; padding:24px; max-width:700px; width:100%; max-height:80vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="margin:0;">📜 Historial de Cargas de Stock</h2>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="background:#ef4444; padding:8px 16px;">✕ Cerrar</button>
      </div>
      <div>
        ${state.historialStock.length === 0 ? '<p style="color:gray;">No hay cargas registradas</p>' :
          [...state.historialStock].reverse().map(h => `
          <div style="border-bottom:1px solid #e5e7eb; padding:10px 0; font-size:0.9em;">
            <div style="display:flex; justify-content:space-between;">
              <span><b>${h.usuario}</b> - ${h.estilo}</span>
              <small style="color:#64748b;">${h.fecha}</small>
            </div>
            <div style="margin-top:4px;">
              <span style="background:${h.cantidad > 0 ? '#dcfce7' : '#fee2e2'}; color:${h.cantidad > 0 ? '#166534' : '#991b1b'}; padding:2px 8px; border-radius:4px; font-weight:600;">
                ${h.cantidad > 0 ? '+' : ''}${h.cantidad}
              </span>
              <span style="margin-left:8px; color:#6b7280;">${h.tipo === 'conEtiqueta' ? '🏷️ Con Etiqueta' : '📦 Sin Etiqueta'}</span>
            </div>
          </div>`).join("")}
      </div>
    </div>`;

  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function mostrarHistorialTransferencias() {
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";

  modal.innerHTML = `
    <div style="background:white; border-radius:12px; padding:24px; max-width:700px; width:100%; max-height:80vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="margin:0;">🚚 Historial de Transferencias</h2>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="background:#ef4444; padding:8px 16px;">✕ Cerrar</button>
      </div>
      <div>
        ${state.historialTransferencias.length === 0 ? '<p style="color:gray;">No hay transferencias registradas</p>' :
          [...state.historialTransferencias].reverse().map(h => `
          <div style="border-bottom:1px solid #e5e7eb; padding:10px 0; font-size:0.9em;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span><b>${h.desde}</b> → <b>${h.hacia}</b></span>
              <small style="color:#64748b;">${h.fecha}</small>
            </div>
            <div>
              <span style="background:#ede9fe; color:#7c3aed; padding:2px 8px; border-radius:4px; font-weight:600;">
                ${h.cantidad} ${h.estilo}
              </span>
              <span style="margin-left:8px; color:#6b7280;">${h.tipo === 'conEtiqueta' ? '🏷️ Con Etiqueta' : '📦 Sin Etiqueta'}</span>
            </div>
          </div>`).join("")}
      </div>
    </div>`;

  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

function mostrarTodosLosClientes() {
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px;";

  const todosLosClientes = state.clientesGlobales.sort((a, b) => a.nombre.localeCompare(b.nombre));

  modal.innerHTML = `
    <div style="background:white; border-radius:12px; padding:24px; max-width:600px; width:100%; max-height:80vh; overflow-y:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="margin:0;">👥 Todos los Clientes (${todosLosClientes.length})</h2>
        <button onclick="this.closest('div[style*=fixed]').remove()" style="background:#ef4444; padding:8px 16px;">✕ Cerrar</button>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:8px;">
        ${todosLosClientes.map(cliente => {
          const deuda = cliente.deuda - cliente.pagado;
          return `
          <div style="padding:10px; border:1px solid #e5e7eb; border-radius:8px; ${deuda > 0 ? 'background:#fef2f2; border-color:#fecaca;' : 'background:#f9fafb;'}">
            <div style="font-weight:600; font-size:0.9em;">${cliente.nombre}</div>
            ${deuda > 0 ? `<div style="color:#dc2626; font-size:0.8em; margin-top:4px;">Debe: $${deuda.toLocaleString()}</div>` : '<div style="color:#059669; font-size:0.8em; margin-top:4px;">Sin deuda</div>'}
          </div>`;
        }).join("")}
      </div>
    </div>`;

  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}
