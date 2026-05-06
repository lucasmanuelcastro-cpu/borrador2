// --- LÓGICA DE ESTADO Y SINCRONIZACIÓN EL PROFETA ---

const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbw0Pv575CpGioScxe4p5mobDsGPTpnn_K6Ssy1N2rWJd97FeAFlRY8Mz-2de3S555D9Mg/exec";

let clientesHistoricos = [];
let ventasPendientes = [];

function modificarStockDirecto(usuario, estilo, cantidad) {
  setState((prev) => {
    prev.usuarios[usuario].stock[estilo] = Number(cantidad) || 0;
    return prev;
  });
}

function registrarVentaLocal() {
  if (!state.usuarioActivo) return;
  const preview = calcularPreview();
  const totalVenta = Number(state.totalCobradoInput) || 0;
  const alquilerBarril = state.alquilerBarril || "";

  const ventaDatos = {
    cliente: state.clienteNombre || "Consumidor Final",
    estilos: { ...state.ventaActual },
    alquilerBarril: alquilerBarril,
    totalCobrado: totalVenta,
    paraProfeta: preview.paraProfeta,
    comision: preview.comision,
    totalLatas: preview.totalLatas,
    costo: preview.costoTotal,
    ganancia: totalVenta - preview.costoTotal,
    metodoPago: "",
    fecha: new Date().toLocaleDateString("es-AR"),
    vendedor: state.usuarioActivo,
    esCobro: false,
  };

  ventasPendientes.push(ventaDatos);
  localStorage.setItem("ventasPendientes", JSON.stringify(ventasPendientes));
  console.log("📝 Venta registrada. Pendientes:", ventasPendientes.length);

  setState((prev) => {
    const usuario = prev.usuarios[prev.usuarioActivo];
   usuario.ventas.push({
  cliente: ventaDatos.cliente,
  estilos: ventaDatos.estilos,
  totalCobrado: totalVenta,
  paraProfeta: preview.paraProfeta,
  comision: preview.comision,
  metodoPago: "",  // ✅ Vacío por defecto
  fecha: ventaDatos.fecha,
  tipoLata: ventaDatos.tipoLata,
});

    if (prev.clienteNombre && prev.clienteNombre.trim() !== "") {
      const idx = prev.clientesGlobales.findIndex(c => c.nombre.toLowerCase() === prev.clienteNombre.toLowerCase());
      if (idx !== -1) {
        prev.clientesGlobales[idx].deuda += totalVenta;
      } else {
        prev.clientesGlobales.push({ nombre: prev.clienteNombre, deuda: totalVenta, pagado: 0 });
      }
    }

  Object.entries(prev.ventaActual).forEach(([estilo, cant]) => {
  if (prev.tipoLata === 'sinEtiqueta') {
    if (!usuario.stockSinEtiqueta) usuario.stockSinEtiqueta = {};
    usuario.stockSinEtiqueta[estilo] = (usuario.stockSinEtiqueta[estilo] || 0) - (Number(cant) || 0);
  } else {
    usuario.stock[estilo] = (usuario.stock[estilo] || 0) - (Number(cant) || 0);
  }
});

    prev.ventaActual = {};
    prev.clienteNombre = "";
    prev.totalCobradoInput = "";
    prev.alquilerBarril = "";
    return prev;
  });
}

async function guardarVentasPendientesEnSheet() {
  if (!ventasPendientes.length) {
    const guardadas = localStorage.getItem("ventasPendientes");
    if (guardadas) ventasPendientes = JSON.parse(guardadas);
  }

  console.log("📦 Ventas pendientes a enviar:", ventasPendientes.length, JSON.stringify(ventasPendientes));

  if (!ventasPendientes.length) {
    console.warn("⚠️ No hay ventas pendientes para enviar.");
    return;
  }

  const colaActual = [...ventasPendientes];
  ventasPendientes = [];
  localStorage.removeItem("ventasPendientes");

  for (const venta of colaActual) {
    try {
      const payload = { accion: "nuevaVenta", venta: venta };
      console.log("📤 Enviando:", JSON.stringify(payload));
      const resp = await fetch(URL_SCRIPT, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "text/plain" },
        mode: "cors"
      });
      const texto = await resp.text();
      console.log("✅ Respuesta del Sheet:", texto);
    } catch (err) {
      console.error("❌ Error enviando venta:", err);
      ventasPendientes.push(venta);
      localStorage.setItem("ventasPendientes", JSON.stringify(ventasPendientes));
    }
  }
}

async function cargarClientesHistoricos() {
  try {
    const url = URL_SCRIPT + "?accion=clientesTodos&v=" + Date.now();
    const resp = await fetch(url, { method: "GET", mode: "cors", cache: "no-cache" });
    const texto = await resp.text();
    const datos = JSON.parse(texto.trim().replace(/^\uFEFF/, ""));
    if (datos.clientesTodos && Array.isArray(datos.clientesTodos)) {
      clientesHistoricos = datos.clientesTodos.filter(c => c && c.nombre);
      console.log("✅ Clientes históricos desde ventas:", clientesHistoricos.length);
    }
  } catch (err) {
    console.error("❌ Error cargando clientes históricos:", err);
  }
}

// registrarPagoCliente manejado en ui.js

function borrarHistorialUsuario() {
  if (!state.usuarioActivo) return;
  if (confirm("¿Borrar ventas?")) {
    setState((prev) => {
      prev.usuarios[prev.usuarioActivo].ventas = [];
      return prev;
    });
  }
}

function borrarVentaIndividual(index) {
  if (!state.usuarioActivo) return;
  // El historial se muestra en orden inverso (.reverse()), 
  // así que hay que convertir el índice visual al índice real del array
  const ventas = state.usuarios[state.usuarioActivo].ventas;
  const indiceReal = ventas.length - 1 - index;
  if (confirm("¿Borrar esta venta del historial?")) {
    setState((prev) => {
      prev.usuarios[prev.usuarioActivo].ventas.splice(indiceReal, 1);
      return prev;
    });
  }
}

function transferirStock() {
  setState((prev) => {
    const { transferDesde, transferHacia, transferEstilo, transferCantidad } = prev;
    if (transferDesde === transferHacia) return prev;
    const disponible = prev.usuarios[transferDesde].stock[transferEstilo] || 0;
    if (disponible < transferCantidad) { alert("Stock insuficiente"); return prev; }
    prev.usuarios[transferDesde].stock[transferEstilo] -= Number(transferCantidad);
    prev.usuarios[transferHacia].stock[transferEstilo] = (prev.usuarios[transferHacia].stock[transferEstilo] || 0) + Number(transferCantidad);
    prev.transferCantidad = 0;
    return prev;
  });
}

function swapMetodoPago(nombreUsuario, ventaIndex) {
  setState((prev) => {
    const venta = prev.usuarios[nombreUsuario].ventas[ventaIndex];
    if (!venta) return prev;
    venta.metodoPago = (venta.metodoPago || "efectivo") === "efectivo" ? "transferencia" : "efectivo";
    return prev;
  });
}

async function cargarDatosDesdeSheet() {
  try {
    const url = URL_SCRIPT + "?v=" + Date.now();
    const respuesta = await fetch(url, { method: "GET", mode: "cors", cache: "no-cache" });
    if (!respuesta.ok) throw new Error("HTTP " + respuesta.status);

    const texto = await respuesta.text();
    const datosCloud = JSON.parse(texto.trim().replace(/^\uFEFF/, ""));
    if (datosCloud.error) throw new Error(datosCloud.error);
    if (!datosCloud.usuarios || typeof datosCloud.usuarios !== "object") return;

    setState((prev) => {
      // 1. POPULARIDAD
      if (datosCloud.popularidad) {
        prev.popularidadSheet = datosCloud.popularidad;
      }

      // 2. STOCK GENERAL
      if (datosCloud.stockGeneral) {
        prev.stockGeneral = {
          "BLONDE": Number(datosCloud.stockGeneral["BLONDE"]) || 0,
          "IRISH RED": Number(datosCloud.stockGeneral["IRISH RED"]) || 0,
          "STOUT": Number(datosCloud.stockGeneral["STOUT"]) || 0,
          "SESSION IPA": Number(datosCloud.stockGeneral["SESSION IPA"]) || 0,
          "RED IPA": Number(datosCloud.stockGeneral["RED IPA"]) || 0,
          "HONEY": Number(datosCloud.stockGeneral["HONEY"]) || 0,
          "LATAS SIN ETIQUETA": Number(datosCloud.stockGeneral["LATAS SIN ETIQUETA"]) || 0
        };
      }

      // 3. SINCRONIZAR STOCK POR USUARIO
      Object.entries(datosCloud.usuarios).forEach(([nombre, datos]) => {
        if (prev.usuarios[nombre]) {
          if (datos.stock) {
            prev.usuarios[nombre].stock = {
              "BLONDE": Number(datos.stock["BLONDE"]) || 0,
              "IRISH RED": Number(datos.stock["IRISH RED"]) || 0,
              "STOUT": Number(datos.stock["STOUT"]) || 0,
              "SESSION IPA": Number(datos.stock["SESSION IPA"]) || 0,
              "RED IPA": Number(datos.stock["RED IPA"]) || 0,
              "HONEY": Number(datos.stock["HONEY"]) || 0,
            };
          }
          if (datos.stockSinEtiqueta) {
            prev.usuarios[nombre].stockSinEtiqueta = {
              "BLONDE": Number(datos.stockSinEtiqueta["BLONDE"]) || 0,
              "IRISH RED": Number(datos.stockSinEtiqueta["IRISH RED"]) || 0,
              "STOUT": Number(datos.stockSinEtiqueta["STOUT"]) || 0,
              "SESSION IPA": Number(datos.stockSinEtiqueta["SESSION IPA"]) || 0,
              "RED IPA": Number(datos.stockSinEtiqueta["RED IPA"]) || 0,
              "HONEY": Number(datos.stockSinEtiqueta["HONEY"]) || 0,
            };
          }
          if (datos.ventas && Array.isArray(datos.ventas) && datos.ventas.length > 0) {
            prev.usuarios[nombre].ventas = datos.ventas.map(venta => ({
              ...venta,
              estado: venta.estado || "PENDIENTE",
              cobradoReal: venta.cobradoReal || 0
            }));
          }
        }
      });

      // 4. SINCRONIZAR CLIENTES
      if (datosCloud.clientes && Array.isArray(datosCloud.clientes) && datosCloud.clientes.length > 0) {
        datosCloud.clientes.forEach(clienteCloud => {
          if (!clienteCloud.nombre || typeof clienteCloud.nombre !== 'string') return;
          const idx = prev.clientesGlobales.findIndex(c => c.nombre && c.nombre.toLowerCase() === clienteCloud.nombre.toLowerCase());
          if (idx !== -1) {
            prev.clientesGlobales[idx].deuda = clienteCloud.deuda;
            prev.clientesGlobales[idx].saldo = clienteCloud.saldo;
            const cloudPagado = Number(clienteCloud.pagado);
            const localPagado = Number(prev.clientesGlobales[idx].pagado) || 0;
            if (clienteCloud.pagado !== undefined && clienteCloud.pagado !== null && !isNaN(cloudPagado)) {
              prev.clientesGlobales[idx].pagado = Math.max(cloudPagado, localPagado);
            }
          } else {
            prev.clientesGlobales.push({
              nombre: clienteCloud.nombre,
              deuda: clienteCloud.deuda || 0,
              pagado: clienteCloud.pagado || 0,
              pagos: []
            });
          }
        });
      }

      console.log("📦 Datos completos del Sheet:", datosCloud);
      console.log("📦 StockGeneral recibido:", datosCloud.stockGeneral);
      
      return prev;
    }); // ✅ Cierra setState

    if (datosCloud.clientesHistoricos) {
      clientesHistoricos = datosCloud.clientesHistoricos;
    }

    console.log("✅ Sync exitosa — stock general, individual y ventas cargados.");
    console.log("Stock General:", datosCloud.stockGeneral);
  } catch (error) {
    console.error("❌ Error de lectura:", error);
  }
}

function agregarStockDirecto(estilo, conEtiqueta) {
  const input = document.querySelector(`[data-agregar="${estilo}"]`);
  if (!input || !input.value || input.value.trim() === "") {
    alert("Ingrese cantidad");
    return;
  }

  const cantidad = Number(input.value);
  if (isNaN(cantidad) || cantidad === 0) {
    alert("Cantidad inválida");
    return;
  }

  setState((prev) => {
    const target = conEtiqueta ? prev.usuarios[prev.usuarioActivo].stock : prev.usuarios[prev.usuarioActivo].stockSinEtiqueta;
    target[estilo] = (target[estilo] || 0) + cantidad;
    return prev;
  });

  input.value = "";
}

// ✅ Envía el stock completo de un usuario al Sheet (carga de stock)
async function sincronizarStockUsuarioEnSheet(usuario) {
  try {
    const u = state.usuarios[usuario];
    const payload = {
      accion: "actualizarStock",
      usuario: usuario,
      stock: { ...u.stock },
      stockSinEtiqueta: { ...(u.stockSinEtiqueta || {}) }
    };
    const resp = await fetch(URL_SCRIPT, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain" },
      mode: "cors"
    });
    const texto = await resp.text();
    console.log("✅ Stock sincronizado para", usuario, ":", texto);
  } catch (err) {
    console.error("❌ Error sincronizando stock:", err);
  }
}
