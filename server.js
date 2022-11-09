const app = require("express")();
const server = require("http").createServer(app);
const cors = require("cors");
const { ExpressPeerServer } = require("peer");
const peerServer = ExpressPeerServer(server, {
  debug: true,
  expire_timeout: 600000,
  alive_timeout: 600000
});

app.use(cors());
app.use("/peerjs", peerServer);

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// app.use(cors());

const PORT = process.env.PORT || 3001;

app.get("/", (req, res) => {
  res.send("server is running");
});

const userListByRoomID = {};
const messagesByRoomID = {};

io.on("connection", (socket) => {
  socket.emit("registered", socket.id);

  socket.on("room-is-ready", (roomId, peerID, userInfo) => {
    if (!userListByRoomID[roomId]) {
      userListByRoomID[roomId] = {};
    }

    userListByRoomID[roomId][userInfo.userName] = userInfo.email;

    socket.join(roomId);
    socket.to(roomId).emit("user-joined", peerID, userInfo);
    // socket.to(roomID).emit("on-screen-sharing", false);
    io.in(roomId).emit("list-of-users", userListByRoomID[roomId]);
    io.in(roomId).emit("list-of-messages", messagesByRoomID[roomId]);

    socket.on("disconnect-user", () => {
      socket.to(roomId).emit("user-disconnected", userInfo);
      delete userListByRoomID[roomId][userInfo.userName];
      io.in(roomId).emit("list-of-users", userListByRoomID[roomId]);
    });

    socket.on("new-message", (newMessage, userName) => {
      if (!messagesByRoomID[roomId]) {
        messagesByRoomID[roomId] = [];
      }
      const newMessageObj = { message: newMessage, userName: userName };
      console.log("onNewMessage", newMessageObj);
      messagesByRoomID[roomId].push(newMessageObj);
      io.in(roomId).emit("list-of-messages", messagesByRoomID[roomId]);
    });

    socket.on("on-screen-sharing", (roomID, status) => {
      socket.to(roomID).emit("on-screen-sharing", status);
    });
  });
});

server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
