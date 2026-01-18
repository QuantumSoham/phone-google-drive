const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const os = require("os");

const app = express();
const PORT = 3000;

// --------------------
// BASE DIRECTORY
// --------------------
const BASE_DIR = path.join(os.homedir(), "express-files");
fs.mkdirSync(BASE_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

// --------------------
// ✅ FIXED UPLOAD STORAGE
// --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BASE_DIR);
  },
  filename: (req, file, cb) => {
    // keep extension + avoid spaces
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, Date.now() + "-" + safeName);
  }
});

const upload = multer({ storage });

// --------------------
// UPLOAD
// --------------------
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  res.json({
    message: "File uploaded",
    filename: req.file.filename,
    original: req.file.originalname
  });
});

// --------------------
// LIST FILES
// --------------------
app.get("/files", (req, res) => {
  fs.readdir(BASE_DIR, (err, files) => {
    if (err) return res.status(500).send(err.message);
    res.json(files);
  });
});

// --------------------
// DOWNLOAD / VIEW FILE
// --------------------
app.get("/files/:name", (req, res) => {
  const name = req.params.name;
  if (name.includes("..")) return res.status(400).send("Invalid filename");

  const filePath = path.join(BASE_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

  res.sendFile(filePath);
});

// --------------------
// STREAM FILE (RANGE SUPPORT)
// --------------------
app.get("/stream/:name", (req, res) => {
  const name = req.params.name;
  const filePath = path.join(BASE_DIR, name);

  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": "application/octet-stream"
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const CHUNK = 1e6;
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK, fileSize - 1);

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": "application/octet-stream"
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

// --------------------
// DELETE FILE
// --------------------
app.delete("/files/:name", (req, res) => {
  const name = req.params.name;
  const filePath = path.join(BASE_DIR, name);

  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

  fs.unlink(filePath, err => {
    if (err) return res.status(500).send(err.message);
    res.json({ message: "File deleted" });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FS server running on port ${PORT}`);
  console.log(`Files stored in ${BASE_DIR}`);
});