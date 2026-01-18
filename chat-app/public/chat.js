const socket = io();
let mySocketId = "";

/* ================= GET PARAMS ================= */
const params = new URLSearchParams(window.location.search);
const username = params.get("username");
const room = params.get("room");

if (!username || !room) {
  window.location.href = "/index.html";
}

/* ================= UI ================= */
const roomName = document.getElementById("roomName");
const messages = document.getElementById("messages");
const onlineUsers = document.getElementById("onlineUsers");
const msgInput = document.getElementById("msg");
const imageInput = document.getElementById("imageInput");
const typingEl = document.getElementById("typing");

roomName.innerText = `Phòng: ${room}`;

const messagesMap = new Map();

/* ================= SOCKET CONNECT ================= */
socket.on("connect", () => {
  mySocketId = socket.id;
  socket.emit("join", { username, room });
});

/* ================= CHAT HISTORY ================= */
socket.on("chatHistory", (history) => {
  history.forEach(renderMessage);
});

/* ================= RECEIVE MESSAGE ================= */
socket.on("message", renderMessage);

function renderMessage(data) {
  const div = document.createElement("div");

  // System message
  if (data.system) {
    div.className = "system";
    div.innerText = data.text;
    messages.appendChild(div);
    scrollBottom();
    return;
  }

  const isMe = data.socketId === mySocketId;
  div.className = `msg ${isMe ? "me" : "other"}`;
  div.dataset.id = data.id;

  let html = "";

  if (!isMe && data.user) {
    html += `<b>${data.user}</b><br/>`;
  }

  if (data.text) {
    html += `<div>${data.text}</div>`;
  }

  if (data.image) {
    html += `<img src="${data.image}" />`;
  }

  if (isMe) {
    html += `
      <div class="text-xs opacity-70 status">${data.status || "sent"}</div>
      <button class="text-xs text-red-400" onclick="recallMessage('${data.id}')">
        Thu hồi
      </button>
    `;
  }

  div.innerHTML = html;
  messages.appendChild(div);
  messagesMap.set(data.id, div);
  scrollBottom();
}

/* ================= MESSAGE STATUS ================= */
socket.on("messageStatus", ({ id, status }) => {
  const el = messagesMap.get(id);
  if (!el) return;
  const st = el.querySelector(".status");
  if (st) st.innerText = status;
});

/* ================= RECALL ================= */
function recallMessage(id) {
  socket.emit("recallMessage", id);
}

socket.on("recall", (id) => {
  const el = messagesMap.get(id);
  if (el) {
    el.innerHTML = `<div class="italic text-gray-400">Tin nhắn đã bị thu hồi</div>`;
  }
});

/* ================= TYPING ================= */
let typingTimeout;

msgInput.addEventListener("input", () => {
  socket.emit("typing");
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit("stopTyping");
  }, 800);
});

socket.on("typing", (user) => {
  typingEl.innerText = `${user} đang gõ...`;
});

socket.on("stopTyping", () => {
  typingEl.innerText = "";
});

/* ================= ONLINE USERS ================= */
socket.on("onlineUsers", (list) => {
  onlineUsers.innerHTML = list.map((u) => `<li>${u}</li>`).join("");
});

/* ================= SEND TEXT ================= */
document.getElementById("chatForm").onsubmit = (e) => {
  e.preventDefault();
  if (!msgInput.value.trim()) return;

  socket.emit("sendMessage", {
    text: msgInput.value,
  });

  msgInput.value = "";
};

/* ================= SEND IMAGE ================= */
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
    image: data.imageUrl,
  });

  imageInput.value = "";
};

/* ================= SEEN ================= */
messages.addEventListener("scroll", () => {
  messagesMap.forEach((el, id) => {
    if (isInView(el)) {
      socket.emit("seen", id);
    }
  });
});

function isInView(el) {
  const rect = el.getBoundingClientRect();
  return rect.top >= 0 && rect.bottom <= window.innerHeight;
}

/* ================= LEAVE ROOM ================= */
document.getElementById("leaveBtn").onclick = () => {
  socket.emit("leaveRoom");
  socket.disconnect();
  window.location.href = "/index.html";
};

/* ================= UTIL ================= */
function scrollBottom() {
  messages.scrollTop = messages.scrollHeight;
}
