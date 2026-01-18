const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

/* ================= STATIC ================= */
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

/* ================= DATA ================= */
const users = new Map(); // socket.id => { username, room }
const messagesByRoom = new Map(); // room => [messages]

/* ================= UPLOAD IMAGE ================= */
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

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
  /* ===== JOIN ROOM ===== */
  socket.on("join", ({ username, room }) => {
    socket.username = username;
    socket.room = room;

    users.set(socket.id, { username, room });
    socket.join(room);

    // gửi lịch sử chat
    const history = messagesByRoom.get(room) || [];
    socket.emit("chatHistory", history);

    io.to(room).emit("message", {
      system: true,
      text: `${username} đã tham gia phòng`,
    });

    updateOnline(room);
  });

  /* ===== SEND MESSAGE ===== */
  socket.on("sendMessage", ({ text, image }) => {
    if (!socket.room) return;

    const message = {
      id: Date.now() + "-" + socket.id,
      user: socket.username,
      socketId: socket.id,
      text: text || "",
      image: image || null,
      status: "sent",
      recalled: false,
      time: Date.now(),
    };

    if (!messagesByRoom.has(socket.room)) {
      messagesByRoom.set(socket.room, []);
    }

    messagesByRoom.get(socket.room).push(message);

    io.to(socket.room).emit("message", message);
  });

  /* ===== TYPING ===== */
  socket.on("typing", () => {
    socket.to(socket.room).emit("typing", socket.username);
  });

  socket.on("stopTyping", () => {
    socket.to(socket.room).emit("stopTyping");
  });

  /* ===== SEEN MESSAGE ===== */
  socket.on("seen", (messageId) => {
    const msgs = messagesByRoom.get(socket.room) || [];
    const msg = msgs.find((m) => m.id === messageId);

    if (msg && msg.status !== "seen") {
      msg.status = "seen";
      io.to(socket.room).emit("messageStatus", {
        id: messageId,
        status: "seen",
      });
    }
  });

  /* ===== RECALL MESSAGE ===== */
  socket.on("recallMessage", (messageId) => {
    const msgs = messagesByRoom.get(socket.room) || [];
    const msg = msgs.find((m) => m.id === messageId);

    if (msg && msg.socketId === socket.id) {
      msg.text = "Tin nhắn đã bị thu hồi";
      msg.image = null;
      msg.recalled = true;

      io.to(socket.room).emit("recall", messageId);
    }
  });

  /* ===== LEAVE ROOM ===== */
  socket.on("leaveRoom", () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);
    socket.leave(user.room);

    io.to(user.room).emit("message", {
      system: true,
      text: `${user.username} đã rời khỏi phòng`,
    });

    updateOnline(user.room);
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);

    io.to(user.room).emit("message", {
      system: true,
      text: `${user.username} đã offline`,
    });

    updateOnline(user.room);
  });
});

/* ================= ONLINE USERS ================= */
function updateOnline(room) {
  const list = [];
  users.forEach((u) => {
    if (u.room === room) list.push(u.username);
  });
  io.to(room).emit("onlineUsers", list);
}

/* ================= START ================= */
server.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
