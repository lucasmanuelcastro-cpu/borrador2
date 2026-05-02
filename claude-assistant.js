// ============================================================
// CLAUDE-ASSISTANT.JS v2 — Asistente IA para El Profeta
// Soporta múltiples acciones por respuesta + acceso completo
// ============================================================

(function () {

  const CSS = `
    #ep-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 58px; height: 58px; border-radius: 50%;
      background: #1e40af; color: white; border: none;
      font-size: 26px; cursor: pointer;
      box-shadow: 0 6px 24px rgba(30,64,175,0.45);
      transition: transform .2s, box-shadow .2s;
      display: flex; align-items: center; justify-content: center;
    }
    #ep-fab:hover { transform: scale(1.09); }
    #ep-panel {
      position: fixed; bottom: 100px; right: 28px; z-index: 9998;
      width: 360px; max-height: 580px;
      background: white; border-radius: 20px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.18);
      display: flex; flex-direction: column;
      overflow: hidden; transition: opacity .2s, transform .2s;
      font-family: 'Segoe UI', sans-serif;
    }
    #ep-panel.ep-hidden { opacity: 0; transform: translateY(16px); pointer-events: none; }
    #ep-header {
      background: #1e40af; color: white;
      padding: 14px 18px; display: flex; align-items: center; gap: 10px;
      flex-shrink: 0;
    }
    #ep-header .ep-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
    }
    #ep-header .ep-title { flex: 1; }
    #ep-header .ep-title strong { display: block; font-size: 14px; }
    #ep-header .ep-title span { font-size: 11px; opacity: .75; }
    #ep-header button { background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; opacity: .8; }
    #ep-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .ep-msg { max-width: 88%; padding: 9px 13px; border-radius: 14px; font-size: 13.5px; line-height: 1.5; animation: epFadeUp .18s ease both; }
    @keyframes epFadeUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    .ep-msg.ep-user { align-self: flex-end; background: #1e40af; color: white; border-radius: 14px 4px 14px 14px; }
    .ep-msg.ep-bot { align-self: flex-start; background: #f1f5f9; color: #1e293b; border-radius: 4px 14px 14px 14px; white-space: pre-wrap; }
    .ep-msg.ep-ok  { background: #ecfdf5; border-left: 3px solid #059669; }
    .ep-msg.ep-err { background: #fff1f2; border-left: 3px solid #ef4444; }
    .ep-typing { display: flex; gap: 4px; align-items: center; padding: 2px 0; }
    .ep-typing span { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; animation: epDot 1.2s infinite ease-in-out; }
    .ep-typing span:nth-child(2) { animation-delay: .2s; }
    .ep-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes epDot { 0%,80%,100% { transform: scale(.7); opacity:.4; } 40% { transform: scale(1); opacity:1; } }
    #ep-suggestions { padding: 0 10px 10px; display: flex; flex-wrap: wrap; gap: 6px; flex-shrink: 0; }
    #ep-suggestions button { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 20px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
    #ep-suggestions button:hover { background: #dbeafe; }
    #ep-input-area { border-top: 1px solid #e5e7eb; padding: 10px 12px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; }
    #ep-input { flex: 1; resize: none; border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 10px; font-family: inherit; font-size: 13.5px; color: #1e293b; background: #f9fafb; line-height: 1.45; min-height: 36px; max-height: 100px; overflow-y: auto; outline: none; }
    #ep-input:focus { border-color: #1e40af; background: white; }
    #ep-send { width: 34px; height: 34px; border-radius: 50%; background: #1e40af; color: white; border: none; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: opacity .15s; }
    #ep-send:hover { opacity: .85; }
    #ep-send:disabled { opacity: .35; cursor: not-allowed; }
    #ep-send svg { width: 15px; height: 15px; }
    @media (max-width: 480px) { #ep-panel { width: calc(100vw - 24px); right: 12px; } #ep-fab { bottom: 16px; right: 16px; } }
  `;

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML("beforeend", `
    <button id="ep-fab" title="Asistente IA">🤖</button>
    <div id="ep-panel" class="ep-hidden">
      <div id="ep-header">
        <div class="ep-avatar">🤖</div>
        <div class="ep-title">
          <strong>Asistente El Profeta</strong>
          <span>Powered by Mistral AI</span>
        </div>
        <button onclick="epToggle()" title="Cerrar">✕</button>
      </div>
      <div id="ep-messages"></div>
      <div id="ep-suggestions">
        <button onclick="epSuggest('Ver todo el stock actual')">📦 Stock</button>
        <button onclick="epSuggest('Ver ventas totales')">💰 Ventas</button>
        <button onclick="epSuggest('Ver deudores')">👥 Deudores</button>
        <button onclick="epSuggest('Guardar datos en Google Sheets')">💾 Guardar</button>
      </div>
      <div id="ep-input-area">
        <textarea id="ep-input" rows="1" placeholder="Ej: Agregá 24 Blonde a Julian y 12 Stout a Matias..."></textarea>
        <button id="ep-send" onclick="epSend()">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 8L14 8M14 8L9 3M14 8L9 13" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  `);

  var epHistory = [];
  var epOpen    = false;

  window.epToggle = function () {
    epOpen = !epOpen;
    document.getElementById("ep-panel").classList.toggle("ep-hidden", !epOpen);
    if (epOpen && epHistory.length === 0) {
      epBotMsg("Hola! Soy el asistente de El Profeta.\n\nPuedo ejecutar VARIAS acciones a la vez. Por ejemplo:\n\"Agregá 24 Blonde y 12 Stout a Julian\"\n\"Reset stock completo de todos los usuarios\"\n\"Registrá venta de 6 IPA por $15000 a Rodrigo con Matias\"\n\"Guardá los datos en Sheets\"");
    }
    if (epOpen) setTimeout(function() { document.getElementById("ep-input").focus(); }, 50);
  };

  document.getElementById("ep-fab").onclick = epToggle;

  document.getElementById("ep-input").addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); epSend(); }
  });

  document.getElementById("ep-input").addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 100) + "px";
  });

  window.epSuggest = function(txt) {
    document.getElementById("ep-input").value = txt;
    epSend();
  };

  function epUserMsg(txt) {
    var div = document.createElement("div");
    div.className = "ep-msg ep-user";
    div.textContent = txt;
    document.getElementById("ep-messages").appendChild(div);
    epScroll();
  }

  function epBotMsg(txt, tipo) {
    var div = document.createElement("div");
    div.className = "ep-msg ep-bot " + (tipo || "");
    div.textContent = txt;
    document.getElementById("ep-messages").appendChild(div);
    epScroll();
    return div;
  }

  function epShowTyping() {
    var div = document.createElement("div");
    div.id = "ep-typing";
    div.className = "ep-msg ep-bot";
    div.innerHTML = '<div class="ep-typing"><span></span><span></span><span></span></div>';
    document.getElementById("ep-messages").appendChild(div);
    epScroll();
  }

  function epHideTyping() {
    var el = document.getElementById("ep-typing");
    if (el) el.remove();
  }

  function epScroll() {
    var m = document.getElementById("ep-messages");
    m.scrollTop = m.scrollHeight;
  }

  // ── Contexto completo del estado ──────────────────────────
  function epGetContexto() {
    var stockLines = Object.keys(state.usuarios).map(function(u) {
      var stocks = estilosBase.map(function(e) { return e + ": " + (state.usuarios[u].stock[e] || 0); }).join(", ");
      return u + " -> " + stocks;
    }).join("\n");

    var deudores = state.clientesGlobales
      .filter(function(c) { return (c.deuda - c.pagado) > 0; })
      .map(function(c) { return c.nombre + ": $" + (c.deuda - c.pagado).toLocaleString(); })
      .join(", ") || "ninguno";

    var totalVentas = Object.values(state.usuarios).flatMap(function(u) { return u.ventas; }).length;
    var efectivo    = getTotalVentasPorMetodo("efectivo");
    var transf      = getTotalVentasPorMetodo("transferencia");

    return "ESTADO ACTUAL:\nUsuario activo: " + (state.usuarioActivo || "ninguno") + "\n\nSTOCK:\n" + stockLines + "\n\nVENTAS: " + totalVentas + " ventas | Efectivo: $" + efectivo.toLocaleString() + " | Transferencia: $" + transf.toLocaleString() + "\n\nDEUDORES: " + deudores;
  }

  // ── System prompt compacto para Mistral ──────────────────
  function epSystemPrompt() {
    return 'Sos el asistente de "El Profeta", app de stock de cervezas. Respondé SIEMPRE con un JSON array de acciones. Si es solo una consulta sin accion, usa [{\"accion\":\"responder\",\"mensaje\":\"tu respuesta aqui\"}]. Para multiples acciones, pone varios objetos en el array.\n\nACCIONES DISPONIBLES:\n- sumarStock: {\"accion\":\"sumarStock\",\"usuario\":\"Julian\",\"estilo\":\"BLONDE\",\"cantidad\":24,\"mensaje\":\"...\"}\n- resetStock: {\"accion\":\"resetStock\",\"usuario\":\"Julian\",\"mensaje\":\"...\"} (pone TODO en 0)\n- registrarVenta: {\"accion\":\"registrarVenta\",\"usuario\":\"Matias\",\"estilos\":{\"BLONDE\":6},\"cliente\":\"Rodrigo\",\"totalCobrado\":15000,\"metodoPago\":\"efectivo\",\"mensaje\":\"...\"}\n- transferirStock: {\"accion\":\"transferirStock\",\"desde\":\"Julian\",\"hacia\":\"Lucas\",\"estilo\":\"HONEY\",\"cantidad\":10,\"mensaje\":\"...\"}\n- registrarPago: {\"accion\":\"registrarPago\",\"cliente\":\"Rodrigo\",\"monto\":5000,\"metodo\":\"efectivo\",\"mensaje\":\"...\"}\n- seleccionarUsuario: {\"accion\":\"seleccionarUsuario\",\"usuario\":\"Julian\",\"mensaje\":\"...\"}\n- guardarSheets: {\"accion\":\"guardarSheets\",\"mensaje\":\"Guardando en Sheets...\"}\n- responder: {\"accion\":\"responder\",\"mensaje\":\"tu texto\"}\n\nREGLAS:\n- Estilos SIEMPRE en mayusculas: BLONDE, IRISH RED, STOUT, SESSION IPA, RED IPA, HONEY\n- Usuarios: Julian, Matias, Lucas\n- Si piden reset de todos, genera una accion resetStock por cada usuario\n- Si piden sumar a varios usuarios, genera una accion por cada uno\n- Responde SOLO con el JSON array, sin texto extra, sin markdown\n\n' + epGetContexto();
  }

  // ── Ejecutar array de acciones ────────────────────────────
  function epEjecutarAcciones(acciones) {
    var mensajes = [];
    var todasOk  = true;

    acciones.forEach(function(cmd) {
      try {
        switch (cmd.accion) {

          case "sumarStock": {
            if (!state.usuarios[cmd.usuario]) throw new Error("Usuario no existe: " + cmd.usuario);
            var actual = state.usuarios[cmd.usuario].stock[cmd.estilo] || 0;
            modificarStockDirecto(cmd.usuario, cmd.estilo, actual + Number(cmd.cantidad));
            mensajes.push("✅ " + (cmd.mensaje || "Stock actualizado"));
            break;
          }

          case "resetStock": {
            if (!state.usuarios[cmd.usuario]) throw new Error("Usuario no existe: " + cmd.usuario);
            setState(function(prev) {
              estilosBase.forEach(function(e) { prev.usuarios[cmd.usuario].stock[e] = 0; });
              return prev;
            });
            mensajes.push("✅ " + (cmd.mensaje || "Stock de " + cmd.usuario + " reseteado"));
            break;
          }

          case "registrarVenta": {
            if (!state.usuarios[cmd.usuario]) throw new Error("Usuario no existe: " + cmd.usuario);
            setState(function(prev) {
              prev.usuarioActivo     = cmd.usuario;
              prev.ventaActual       = cmd.estilos || {};
              prev.clienteNombre     = cmd.cliente || "";
              prev.totalCobradoInput = String(cmd.totalCobrado || 0);
              prev.metodoPago        = cmd.metodoPago || "efectivo";
              return prev;
            });
            registrarVentaLocal();
            if (cmd.metodoPago && cmd.metodoPago !== "efectivo") {
              setState(function(prev) {
                var ventas = prev.usuarios[cmd.usuario].ventas;
                if (ventas.length > 0) ventas[ventas.length - 1].metodoPago = cmd.metodoPago;
                return prev;
              });
            }
            mensajes.push("✅ " + (cmd.mensaje || "Venta registrada"));
            break;
          }

          case "transferirStock": {
            setState(function(prev) {
              prev.transferDesde    = cmd.desde;
              prev.transferHacia    = cmd.hacia;
              prev.transferEstilo   = cmd.estilo;
              prev.transferCantidad = Number(cmd.cantidad);
              return prev;
            });
            transferirStock();
            mensajes.push("✅ " + (cmd.mensaje || "Stock transferido"));
            break;
          }

          case "registrarPago": {
            var idx = state.clientesGlobales.findIndex(function(c) {
              return c.nombre.toLowerCase() === cmd.cliente.toLowerCase();
            });
            if (idx === -1) throw new Error("Cliente no encontrado: " + cmd.cliente);
            var fecha = new Date().toLocaleDateString("es-AR");
            setState(function(prev) {
              var c = prev.clientesGlobales[idx];
              c.pagado += Number(cmd.monto);
              if (!c.pagos) c.pagos = [];
              c.pagos.push({ monto: Number(cmd.monto), metodo: cmd.metodo || "efectivo", fecha: fecha });
              return prev;
            });
            mensajes.push("✅ " + (cmd.mensaje || "Pago registrado"));
            break;
          }

          case "seleccionarUsuario": {
            setState(function(prev) { prev.usuarioActivo = cmd.usuario; return prev; });
            mensajes.push("✅ " + (cmd.mensaje || "Panel de " + cmd.usuario + " abierto"));
            break;
          }

          case "guardarSheets": {
            mensajes.push("⏳ " + (cmd.mensaje || "Guardando..."));
            guardarDatos();
            guardarEnSheets();
            break;
          }

          case "responder": {
            mensajes.push(cmd.mensaje || "");
            break;
          }

          default:
            mensajes.push("⚠️ Acción desconocida: " + cmd.accion);
        }
      } catch(err) {
        todasOk = false;
        mensajes.push("❌ Error: " + err.message);
      }
    });

    return { mensajes: mensajes, ok: todasOk };
  }

  // ── Enviar mensaje ────────────────────────────────────────
  window.epSend = async function() {
    var input = document.getElementById("ep-input");
    var txt   = input.value.trim();
    if (!txt) return;

    input.value = "";
    input.style.height = "auto";
    document.getElementById("ep-send").disabled = true;

    epUserMsg(txt);
    epHistory.push({ role: "user", content: txt });
    epShowTyping();

    try {
      var resp = await fetch("https://elprofetacontrolstock.onrender.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: epSystemPrompt(),
          messages: epHistory,
        }),
      });

      var data = await resp.json();
      epHideTyping();

      var reply = data.content
        ? data.content.filter(function(b) { return b.type === "text"; }).map(function(b) { return b.text; }).join("\n")
        : (data.error ? "Error: " + data.error.message : "Sin respuesta");

      epHistory.push({ role: "assistant", content: reply });

      // Intentar parsear JSON array de acciones
      var parsed = null;
      try {
        // Limpiar posibles markdown fences
        var clean = reply.replace(/```json/g, "").replace(/```/g, "").trim();
        parsed = JSON.parse(clean);
        if (!Array.isArray(parsed)) parsed = [parsed];
      } catch(e) {
        // Si no es JSON, mostrar como texto
        epBotMsg(reply);
        document.getElementById("ep-send").disabled = false;
        input.focus();
        return;
      }

      var resultado = epEjecutarAcciones(parsed);
      var textoFinal = resultado.mensajes.join("\n");
      epBotMsg(textoFinal, resultado.ok ? "ep-ok" : "ep-err");

    } catch(err) {
      epHideTyping();
      epBotMsg("❌ Error de conexión: " + err.message, "ep-err");
    }

    document.getElementById("ep-send").disabled = false;
    input.focus();
  };

})();
