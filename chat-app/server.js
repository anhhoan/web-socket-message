const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

const users = new Map(); // socket.id => { username, room }

/* ===== UPLOAD IMAGE ===== */
const storage = multer.diskStorage({
  destination: "public/uploads",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("image"), (req, res) => {
  res.json({ imageUrl: "/uploads/" + req.file.filename });
});

/* ===== SOCKET ===== */
io.on("connection", (socket) => {
  socket.on("join", ({ username, room }) => {
    // 1️⃣ Lưu thông tin vào socket (BẮT BUỘC)
    socket.username = username;
    socket.room = room;

    // 2️⃣ Lưu vào map online
    users.set(socket.id, { username, room });

    // 3️⃣ Join room
    socket.join(room);

    // 4️⃣ Gửi system message đúng chuẩn
    io.to(room).emit("message", {
      system: true,
      text: `${username} đã tham gia phòng`,
    });

    // 5️⃣ Cập nhật danh sách online
    updateOnline(room);
  });

  socket.on("sendMessage", ({ text, image }) => {
    io.to(socket.room).emit("message", {
      user: socket.username, // 👈 KHÔNG BAO GIỜ undefined
      text,
      image,
      socketId: socket.id, // 👈 phân biệt mình/người khác
    });
  });

  socket.on("leaveRoom", () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);
    socket.leave(user.room);

    io.to(user.room).emit("message", {
      user: "System",
      text: `${user.username} đã rời khỏi phòng`,
    });

    updateOnline(user.room);
  });

  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);

    io.to(user.room).emit("message", {
      user: "System",
      text: `${user.username} đã offline`,
    });

    updateOnline(user.room);
  });
});

function updateOnline(room) {
  const list = [];
  users.forEach((u) => {
    if (u.room === room) list.push(u.username);
  });
  io.to(room).emit("onlineUsers", list);
}

server.listen(3000, () => {
  console.log("✅ http://localhost:3000");
});
