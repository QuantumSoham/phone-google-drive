# 📱 Phone File Server (Express + Termux)

Run a full-featured **Express.js file server on an Android phone** using **Termux**.  
Upload, list, download, stream, and delete files from your phone over HTTP — locally or globally.

This project turns an old Android phone into a **personal server**.

---

## 🧠 What this project does

- Runs **Node.js + Express** inside Termux
- Accepts file uploads via browser or curl
- Stores files on the phone
- Lists available files
- Streams files with HTTP Range support
- Deletes files remotely
- Provides a simple frontend UI

---

## 🛠 Requirements

- Android phone (Android 8+ recommended)
- Stable Wi-Fi
- Another device (laptop/PC) to access the server
- Internet optional (LAN works fine)

---

## 1️⃣ Install Termux (IMPORTANT)

❌ **Do NOT install Termux from Play Store**  
It is deprecated there.

### ✅ Correct way
1. Open **F-Droid**
2. Search for **Termux**
3. Install:
   - `Termux`
   - (Optional later) `Termux:Boot`

---

## 2️⃣ Initial Termux setup

Open **Termux** and run:

```bash
pkg update && pkg upgrade
Install essential tools:

bash
Copy code
pkg install git curl vim tmux openssh nodejs
Verify Node.js:

bash
Copy code
node -v
npm -v
3️⃣ Enable storage access (for shared files)
Run once:

bash
Copy code
termux-setup-storage
Tap Allow when Android asks.

This gives Termux access to:

pgsql
Copy code
/storage/emulated/0   (Internal Storage)
4️⃣ Enable SSH (remote access)
Start SSH server
bash
Copy code
sshd
Termux SSH runs on port 8022 by default.

Find phone IP
bash
Copy code
ip addr
Look for something like:

nginx
Copy code
inet 192.168.0.200
SSH from laptop
bash
Copy code
ssh -p 8022 <termux-username>@192.168.0.200
(Default username is usually your Android username.)

5️⃣ Create the project
bash
Copy code
mkdir ~/upload-server
cd ~/upload-server
Create package.json manually (avoids npm init issues):

bash
Copy code
cat > package.json <<EOF
{
  "name": "phone-file-server",
  "version": "1.0.0",
  "main": "fs-server.js",
  "scripts": {
    "start": "node fs-server.js"
  }
}
EOF
Install dependencies:

bash
Copy code
npm install express multer cors
6️⃣ Backend: Express File Server
Create fs-server.js:

js
Copy code
const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const os = require("os");

const app = express();
const PORT = 3000;

// Base directory for stored files
const BASE_DIR = path.join(os.homedir(), "express-files");
fs.mkdirSync(BASE_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

// Multer storage (preserve filenames + extensions)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BASE_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, Date.now() + "-" + safeName);
  }
});
const upload = multer({ storage });

// Upload
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ message: "Uploaded", filename: req.file.filename });
});

// List files
app.get("/files", (req, res) => {
  fs.readdir(BASE_DIR, (err, files) => {
    if (err) return res.status(500).send(err.message);
    res.json(files);
  });
});

// Download / view
app.get("/files/:name", (req, res) => {
  const name = req.params.name;
  if (name.includes("..")) return res.status(400).send("Invalid filename");

  const filePath = path.join(BASE_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

  res.sendFile(filePath);
});

// Stream with range support
app.get("/stream/:name", (req, res) => {
  const filePath = path.join(BASE_DIR, req.params.name);
  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, { "Content-Length": fileSize });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const CHUNK = 1e6;
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK, fileSize - 1);

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

// Delete
app.delete("/files/:name", (req, res) => {
  const filePath = path.join(BASE_DIR, req.params.name);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

  fs.unlink(filePath, err => {
    if (err) return res.status(500).send(err.message);
    res.json({ message: "Deleted" });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Files stored in ${BASE_DIR}`);
});
7️⃣ Run the server (IMPORTANT: use tmux)
bash
Copy code
tmux new -s server
node fs-server.js
Detach safely:

css
Copy code
Ctrl + B → D
Reattach later:

bash
Copy code
tmux attach -t server
8️⃣ Frontend UI
Create index.html on your laptop:

html
Copy code
<!DOCTYPE html>
<html>
<head>
  <title>📱 Phone File Server</title>
</head>
<body>
<h2>Upload File</h2>
<input type="file" id="fileInput">
<button onclick="upload()">Upload</button>

<h3>Files</h3>
<ul id="list"></ul>

<script>
const API = "http://PHONE_IP:3000";

async function upload() {
  const file = document.getElementById("fileInput").files[0];
  const form = new FormData();
  form.append("file", file);
  await fetch(API + "/upload", { method: "POST", body: form });
  load();
}

async function load() {
  const res = await fetch(API + "/files");
  const files = await res.json();
  const ul = document.getElementById("list");
  ul.innerHTML = "";
  files.forEach(f => {
    ul.innerHTML += `
      <li>
        ${f}
        <a href="${API}/files/${f}" target="_blank">View</a>
        <a href="${API}/stream/${f}" target="_blank">Stream</a>
        <button onclick="del('${f}')">Delete</button>
      </li>`;
  });
}

async function del(name) {
  await fetch(API + "/files/" + name, { method: "DELETE" });
  load();
}

load();
</script>
</body>
</html>
Replace PHONE_IP with your phone’s IP.

Open this file in your laptop browser.

9️⃣ How files are stored
Files are saved in:

swift
Copy code
/data/data/com.termux/files/home/express-files
Access them via:

Termux

SSH / SFTP

Express API

(Android file managers cannot access this folder — by design.)

🔐 Security notes
⚠️ This is a private server.
Do NOT expose it publicly without:

Authentication

Rate limiting

Access control

🚀 Possible upgrades
Authentication (JWT)

Upload limits & validation

Folder support

Media thumbnails

Cloudflare Tunnel (global access)

Auto-start on boot

🧠 Key takeaway
Termux runs real Linux userspace on Android’s Linux kernel, allowing you to run real servers — with some OS restrictions.

📜 License
MIT (use freely, break responsibly)

markdown
Copy code

---
