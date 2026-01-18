const socket = io();
let mySocketId = "";

/* ===== GET PARAMS ===== */
const params = new URLSearchParams(window.location.search);
const username = params.get("username");
const room = params.get("room");

if (!username || !room) {
  window.location.href = "/index.html";
}

/* ===== UI ===== */
document.getElementById("roomName").innerText = "Phòng: " + room;

const messages = document.getElementById("messages");
const onlineUsers = document.getElementById("onlineUsers");
const msgInput = document.getElementById("msg");
const imageInput = document.getElementById("imageInput");

/* ===== JOIN ===== */
socket.emit("join", { username, room });
socket.on("connect", () => {
  mySocketId = socket.id;
});
/* ===== RECEIVE MESSAGE ===== */
socket.on("message", (data) => {
  const div = document.createElement("div");

  // system message
  if (data.system) {
    div.className = "system";
    div.innerText = data.text;
    messages.appendChild(div);
    return;
  }

  const isMe = data.socketId === mySocketId;

  div.className = `msg ${isMe ? "me" : "other"}`;

  let html = "";

  if (!isMe && data.user) {
    html += `<b>${data.user}</b><br/>`;
  }

  if (data.system) {
    div.className = "system";
    div.innerText = data.text;
  }

  if (data.text) {
    html += `<div>${data.text}</div>`;
  }

  if (data.image) {
    html += `<img src="${data.image}" />`;
  }

  div.innerHTML = html;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

/* ===== ONLINE USERS ===== */
socket.on("onlineUsers", (list) => {
  onlineUsers.innerHTML = list.map((u) => `<li>${u}</li>`).join("");
});

/* ===== SEND TEXT ===== */
document.getElementById("chatForm").onsubmit = (e) => {
  e.preventDefault();
  if (!msgInput.value) return;

  socket.emit("sendMessage", {
    user: username,
    room,
    text: msgInput.value,
  });

  msgInput.value = "";
};

/* ===== SEND IMAGE ===== */
document.getElementById("imageBtn").onclick = () => imageInput.click();

imageInput.onchange = async () => {
  const file = imageInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  socket.emit("sendMessage", {
    user: username,
    room,
    image: data.imageUrl,
  });

  imageInput.value = "";
};

/* ===== LEAVE ROOM ===== */
document.getElementById("leaveBtn").onclick = () => {
  socket.emit("leaveRoom");
  socket.disconnect();
  window.location.href = "/index.html";
};
