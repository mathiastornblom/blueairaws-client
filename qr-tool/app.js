const typeConfigs = {
  text: {
    fields: [{ id: "text", label: "Text", type: "textarea", required: true }],
    build: (v) => v.text.trim(),
  },
  url: {
    fields: [{ id: "url", label: "URL", type: "text", placeholder: "https://example.com", required: true }],
    build: (v) => v.url.trim(),
  },
  email: {
    fields: [
      { id: "email", label: "E-postadress", type: "email", required: true },
      { id: "subject", label: "Ämne", type: "text" },
      { id: "body", label: "Meddelande", type: "textarea" },
    ],
    build: (v) => {
      const params = new URLSearchParams();
      if (v.subject) params.set("subject", v.subject);
      if (v.body) params.set("body", v.body);
      const q = params.toString();
      return `mailto:${v.email.trim()}${q ? `?${q}` : ""}`;
    },
  },
  phone: {
    fields: [{ id: "phone", label: "Telefonnummer", type: "text", required: true }],
    build: (v) => `tel:${v.phone.trim()}`,
  },
  sms: {
    fields: [
      { id: "phone", label: "Telefonnummer", type: "text", required: true },
      { id: "message", label: "Meddelande", type: "textarea" },
    ],
    build: (v) => `SMSTO:${v.phone.trim()}:${(v.message || "").trim()}`,
  },
  wifi: {
    fields: [
      { id: "ssid", label: "WiFi-namn (SSID)", type: "text", required: true },
      { id: "encryption", label: "Kryptering", type: "select", options: ["WPA", "WEP", "nopass"] },
      { id: "password", label: "Lösenord", type: "text" },
      { id: "hidden", label: "Dolt nätverk", type: "checkbox" },
    ],
    build: (v) => {
      const enc = v.encryption || "WPA";
      const hidden = v.hidden ? "H:true;" : "";
      return `WIFI:T:${enc};S:${escapeWifi(v.ssid)};P:${escapeWifi(v.password || "")};${hidden};`;
    },
  },
};

const contentType = document.getElementById("contentType");
const fieldsContainer = document.getElementById("fields");
const generateBtn = document.getElementById("generateBtn");
const downloadPng = document.getElementById("downloadPng");
const downloadSvg = document.getElementById("downloadSvg");
const statusNode = document.getElementById("status");
const canvas = document.getElementById("qrCanvas");

const sizeInput = document.getElementById("size");
const marginInput = document.getElementById("margin");
const darkColorInput = document.getElementById("darkColor");
const lightColorInput = document.getElementById("lightColor");
const darkSwatch = document.getElementById("darkSwatch");
const lightSwatch = document.getElementById("lightSwatch");
const darkHex = document.getElementById("darkHex");
const lightHex = document.getElementById("lightHex");
const errorCorrectionInput = document.getElementById("errorCorrectionLevel");
const frameTextInput = document.getElementById("frameText");
const logoFileInput = document.getElementById("logoFile");
const removeLogoBtn = document.getElementById("removeLogo");
const logoSizeInput = document.getElementById("logoSize");

let lastPayload = "";
let logoImage = null;
let logoDataUrl = "";

function escapeWifi(value) {
  return (value || "").replace(/[\\;,:\"]/g, "\\$&");
}

function getCheckedValue(name) {
  const selected = document.querySelector(`input[name="${name}"]:checked`);
  return selected ? selected.value : "";
}

function renderFields(type) {
  const config = typeConfigs[type];
  fieldsContainer.innerHTML = "";

  config.fields.forEach((field) => {
    const wrapper = document.createElement("div");
    const label = document.createElement("label");
    label.textContent = field.label;

    let input;

    if (field.type === "textarea") {
      input = document.createElement("textarea");
    } else if (field.type === "select") {
      input = document.createElement("select");
      field.options.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        input.appendChild(opt);
      });
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
    } else {
      input = document.createElement("input");
      input.type = field.type;
      if (field.placeholder) input.placeholder = field.placeholder;
    }

    input.id = field.id;
    input.dataset.required = field.required ? "true" : "false";
    input.addEventListener("input", scheduleGenerate);
    input.addEventListener("change", scheduleGenerate);

    label.appendChild(input);
    wrapper.appendChild(label);
    fieldsContainer.appendChild(wrapper);
  });
}

function getFieldValues(type) {
  const config = typeConfigs[type];
  const values = {};

  for (const field of config.fields) {
    const input = document.getElementById(field.id);
    const isRequired = input.dataset.required === "true";

    if (field.type === "checkbox") {
      values[field.id] = Boolean(input.checked);
      continue;
    }

    const value = (input.value || "").trim();
    if (isRequired && !value) {
      throw new Error(`Fältet '${field.label}' måste fyllas i.`);
    }

    values[field.id] = value;
  }

  return values;
}

function getOptions() {
  const size = Number(sizeInput.value);
  const margin = Number(marginInput.value);

  if (Number.isNaN(size) || size < 128 || size > 1024) {
    throw new Error("Storlek måste vara mellan 128 och 1024 px.");
  }
  if (Number.isNaN(margin) || margin < 0 || margin > 8) {
    throw new Error("Marginal måste vara mellan 0 och 8.");
  }

  return {
    size,
    margin,
    dark: darkColorInput.value,
    light: lightColorInput.value,
    ecl: errorCorrectionInput.value,
    frameStyle: getCheckedValue("frameStyle") || "none",
    dotShape: getCheckedValue("dotShape") || "square",
    frameText: frameTextInput.value.trim() || "SCAN ME",
    logoScale: Number(logoSizeInput.value) / 100,
  };
}

function drawDot(ctx, x, y, size, shape) {
  if (shape === "dot") {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (shape === "rounded") {
    const r = Math.max(1, size * 0.26);
    roundRect(ctx, x, y, size, size, r);
    ctx.fill();
    return;
  }

  ctx.fillRect(x, y, size, size);
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawFrame(ctx, options) {
  const size = options.size;

  if (options.frameStyle === "border") {
    ctx.strokeStyle = options.dark;
    ctx.lineWidth = Math.max(4, size * 0.02);
    roundRect(ctx, 6, 6, size - 12, size - 12, 20);
    ctx.stroke();
    return 20;
  }

  if (options.frameStyle === "scanme") {
    const bar = Math.max(36, size * 0.14);
    ctx.fillStyle = options.dark;
    roundRect(ctx, 0, 0, size, bar, 16);
    ctx.fill();
    ctx.fillStyle = options.light;
    ctx.font = `700 ${Math.max(14, Math.round(size * 0.06))}px Avenir Next, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(options.frameText, size / 2, bar / 2);
    return bar * 0.75;
  }

  return 0;
}

function renderQr(payload, options) {
  const ecl = logoImage ? "H" : options.ecl;
  const qr = qrcode(0, ecl);
  qr.addData(payload);
  qr.make();

  const moduleCount = qr.getModuleCount();
  canvas.width = options.size;
  canvas.height = options.size;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, options.size, options.size);
  ctx.fillStyle = options.light;
  ctx.fillRect(0, 0, options.size, options.size);

  const frameOffset = drawFrame(ctx, options);
  const drawArea = options.size - frameOffset * 2;
  const totalModules = moduleCount + options.margin * 2;
  const cell = drawArea / totalModules;
  const qrStart = frameOffset + options.margin * cell;

  ctx.fillStyle = options.dark;
  for (let row = 0; row < moduleCount; row += 1) {
    for (let col = 0; col < moduleCount; col += 1) {
      if (!qr.isDark(row, col)) continue;
      const x = qrStart + col * cell;
      const y = qrStart + row * cell;
      drawDot(ctx, x, y, cell, options.dotShape);
    }
  }

  if (logoImage) {
    const safeScale = Math.min(options.logoScale, 0.18);
    const logoSize = options.size * safeScale;
    const logoX = (options.size - logoSize) / 2;
    const logoY = (options.size - logoSize) / 2;
    const pad = Math.max(3, logoSize * 0.06);

    ctx.fillStyle = "#ffffff";
    roundRect(ctx, logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2, 12);
    ctx.fill();

    ctx.save();
    roundRect(ctx, logoX, logoY, logoSize, logoSize, 8);
    ctx.clip();
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }
}

function updateColorMeta() {
  darkSwatch.style.background = darkColorInput.value;
  lightSwatch.style.background = lightColorInput.value;
  darkHex.textContent = darkColorInput.value;
  lightHex.textContent = lightColorInput.value;
}

function buildPayload() {
  const type = contentType.value;
  const values = getFieldValues(type);
  return typeConfigs[type].build(values);
}

function generate() {
  try {
    const payload = buildPayload();
    if (!payload) throw new Error("Ingen data att generera från.");
    const options = getOptions();
    renderQr(payload, options);
    lastPayload = payload;
    statusNode.textContent = logoImage
      ? "QR-kod genererad. Logga-läge använder hög felkorrigering för bättre skanning."
      : "QR-kod genererad.";
  } catch (error) {
    statusNode.textContent = error.message || "Kunde inte generera QR-kod.";
  }
}

let timer;
function scheduleGenerate() {
  clearTimeout(timer);
  timer = setTimeout(generate, 80);
}

function download(filename, href) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function toFilename(type) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `qr-${type}-${stamp}`;
}

downloadPng.addEventListener("click", () => {
  if (!lastPayload) {
    statusNode.textContent = "Generera en QR-kod först.";
    return;
  }
  download(`${toFilename("code")}.png`, canvas.toDataURL("image/png"));
});

downloadSvg.addEventListener("click", () => {
  if (!lastPayload) {
    statusNode.textContent = "Generera en QR-kod först.";
    return;
  }

  const pngData = canvas.toDataURL("image/png");
  const size = canvas.width;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image href="${pngData}" width="${size}" height="${size}"/></svg>`;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  download(`${toFilename("code")}.svg`, url);
  URL.revokeObjectURL(url);
});

logoFileInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    logoDataUrl = await fileToDataURL(file);
    const img = new Image();
    img.src = logoDataUrl;
    await img.decode();
    logoImage = img;
    scheduleGenerate();
  } catch {
    statusNode.textContent = "Kunde inte läsa loggfilen.";
  }
});

removeLogoBtn.addEventListener("click", () => {
  logoImage = null;
  logoDataUrl = "";
  logoFileInput.value = "";
  scheduleGenerate();
});

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

contentType.addEventListener("change", () => {
  renderFields(contentType.value);
  scheduleGenerate();
});

generateBtn.addEventListener("click", generate);

[
  sizeInput,
  marginInput,
  darkColorInput,
  lightColorInput,
  errorCorrectionInput,
  frameTextInput,
  logoSizeInput,
].forEach((el) => {
  el.addEventListener("input", () => {
    updateColorMeta();
    scheduleGenerate();
  });
  el.addEventListener("change", () => {
    updateColorMeta();
    scheduleGenerate();
  });
});

[...document.querySelectorAll('input[name="frameStyle"], input[name="dotShape"]')].forEach((el) => {
  el.addEventListener("change", scheduleGenerate);
});

renderFields(contentType.value);
updateColorMeta();
generate();
