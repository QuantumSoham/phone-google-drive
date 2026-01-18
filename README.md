# 📱 Phone File Server (Express + Termux)

Turn an old Android phone into a **personal file server** using **Node.js, Express, and Termux**.
Upload, download, stream, and manage files over HTTP — all from your phone.

---

## ✨ Features

- 📦 File uploads (browser / curl)
- 📂 File listing
- ⬇️ Download & inline viewing
- 🎬 Media streaming (HTTP Range support)
- 🗑️ Remote deletion
- 🌐 LAN or internet access
- 🖥️ Simple frontend UI
- 🧠 Runs fully on Android via Termux

---

## 🛠 Requirements

- Android 8+ device
- Stable Wi‑Fi (LAN works perfectly)
- Laptop / PC / another phone
- Internet optional

---

## 1️⃣ Install Termux (IMPORTANT)

❌ **Do NOT use Play Store** (deprecated)

### ✅ Correct method

1. Install **F‑Droid**
2. Install:
   - `Termux`
   - (Optional) `Termux:Boot`

---

## 2️⃣ Initial Termux Setup

```bash
pkg update && pkg upgrade
pkg install git curl vim tmux openssh nodejs
```

Verify:

```bash
node -v
npm -v
```

---

## 3️⃣ Enable Storage Access

```bash
termux-setup-storage
```

Gives access to:

```
/storage/emulated/0
```

---

## 4️⃣ Enable SSH (Optional but Recommended)

```bash
sshd
```

- Default port: **8022**

Find phone IP:

```bash
ip addr
```

SSH from laptop:

```bash
ssh -p 8022 <username>@<phone-ip>
```

---

## 5️⃣ Create Project

```bash
mkdir ~/upload-server
cd ~/upload-server
```

### package.json

```json
{
  "name": "phone-file-server",
  "version": "1.0.0",
  "main": "fs-server.js",
  "scripts": {
    "start": "node fs-server.js"
  }
}
```

Install dependencies:

```bash
npm install express multer cors
```

---

## 6️⃣ Backend (fs-server.js)

```js
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const os = require("os");

const app = express();
const PORT = 3000;

const BASE_DIR = path.join(os.homedir(), "express-files");
fs.mkdirSync(BASE_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, BASE_DIR),
  filename: (_, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_"))
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  res.json({ message: "Uploaded", file: req.file.filename });
});

app.get("/files", (_, res) => {
  res.json(fs.readdirSync(BASE_DIR));
});

app.get("/files/:name", (req, res) => {
  res.sendFile(path.join(BASE_DIR, req.params.name));
});

app.get("/stream/:name", (req, res) => {
  const filePath = path.join(BASE_DIR, req.params.name);
  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, { "Content-Length": stat.size });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + 1e6, stat.size - 1);

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

app.delete("/files/:name", (req, res) => {
  fs.unlinkSync(path.join(BASE_DIR, req.params.name));
  res.json({ message: "Deleted" });
});

app.listen(PORT, "0.0.0.0", () =>
  console.log("Server running on port", PORT)
);
```

---

## 7️⃣ Run Server (tmux)

```bash
tmux new -s server
node fs-server.js
```

Detach:

```
Ctrl + B → D
```

---

## 8️⃣ Frontend UI (index.html)

Replace `PHONE_IP` with your phone IP.

```html
<!DOCTYPE html>
<html>
<body>
<h2>📱 Phone File Server</h2>

<input type="file" id="f">
<button onclick="up()">Upload</button>

<ul id="list"></ul>

<script>
const API = "http://PHONE_IP:3000";

async function up() {
  const fd = new FormData();
  fd.append("file", f.files[0]);
  await fetch(API + "/upload", { method: "POST", body: fd });
  load();
}

async function load() {
  const r = await fetch(API + "/files");
  const files = await r.json();
  list.innerHTML = files.map(f =>
    `<li>${f}
      <a href="${API}/files/${f}">View</a>
      <a href="${API}/stream/${f}">Stream</a>
      <button onclick="del('${f}')">Delete</button>
    </li>`
  ).join("");
}

async function del(f) {
  await fetch(API + "/files/" + f, { method: "DELETE" });
  load();
}

load();
</script>
</body>
</html>
```

---

## 📁 Storage Location

```
/data/data/com.termux/files/home/express-files
```

Accessible via:

- Termux
- SSH / SFTP
- Express API

---

## 🔐 Security Warning

⚠️ **Do NOT expose publicly without:**

- Authentication
- Rate limiting
- HTTPS
- Access control

---

## 🚀 Future Upgrades

- JWT authentication
- Folder support
- Upload limits
- Media thumbnails
- Cloudflare Tunnel
- Auto‑start on boot

---

## 📜 License

MIT — use freely, break responsibly.
