const express = require("express");
const cors    = require("cors");
const fetch   = require("node-fetch");

const app  = express();
const PORT = process.env.PORT || 3000;

// La API key se configura como variable de entorno en Render
const API_KEY     = process.env.MISTRAL_API_KEY || "TU_KEY_ACA_PARA_USO_LOCAL";
const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";

app.use(cors());
app.use(express.json());

app.get("/", function(req, res) {
  res.send("Servidor El Profeta OK");
});

app.post("/chat", async function(req, res) {
  try {
    var system   = req.body.system;
    var messages = req.body.messages;

    var mistralMessages = [];
    if (system) mistralMessages.push({ role: "system", content: system });
    messages.forEach(function(m) {
      mistralMessages.push({ role: m.role, content: m.content });
    });

    var respuesta = await fetch(MISTRAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + API_KEY
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: mistralMessages,
        max_tokens: 1000
      }),
    });

    var data = await respuesta.json();

    var texto = "Sin respuesta";
    if (data.choices && data.choices[0] && data.choices[0].message) {
      texto = data.choices[0].message.content;
    } else if (data.error) {
      texto = "Error: " + data.error.message;
    }

    res.json({ content: [{ type: "text", text: texto }] });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, function() {
  console.log("Servidor corriendo en puerto " + PORT);
});
