const app = require("express")();
const server = require("http").createServer(app);
const cors = require("cors");
const formidable = require("formidable");
const fs = require("fs");
const config = require("./config");
const { ExpressPeerServer } = require("peer");
const path = require("path");
const nodemailer = require("nodemailer");

const peerServer = ExpressPeerServer(server, {
  debug: true,
  expire_timeout: 600000,
  alive_timeout: 600000,
});

app.use(cors());

app.use("/peerjs", peerServer);

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(require("express").json());

const PORT = process.env.PORT || 3001;

app.get("/", (req, res) => {
  res.send("server is running");
});

app.post("/", (req, res) => {
  res.send("server is running");
});

app.post("/upload", (req, res) => {
  let form = new formidable.IncomingForm({
    uploadDir: path.join(__dirname, config.default.vault),
    keepExtensions: true,
  });

  const userID = req.header("user-id");

  form.parse(req, function (error, fields, file) {
    let filepath = file.file.filepath;
    let dir = path.join(__dirname, config.default.vault, userID);
    let newpath = path.join(dir, "Resume");

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.rename(filepath, newpath, function () {
      res.write("File Upload Success!");
      res.end();
    });
  });
});

app.get("/resume/:userID", (req, res) => {
  let filePath = path.join(
    __dirname,
    config.default.vault,
    req.param("userID"),
    "Resume"
  );
  // if (fs.(filePath)) {
  var file = fs.createReadStream(filePath);
  var stat = fs.statSync(filePath);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=Resume.pdf");
  file.pipe(res);
  // }
});

const exportAll = (userListByRoomID, messagesByRoomID) => {
  let interviewer = {};
  let interviewee = {};
  for (const key in userListByRoomID) {
    const user = userListByRoomID[user];
    if (user.isInterviewer) interviewer = user;
    else interviewee = user;
  }

  const sender = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "noreplyintervieweasy@gmail.com",
      pass: "JustF0rFun",
    },
  });

  var mail = {
    from: "no-reply-interview-easy@gmail.com",
    to: interviewer.email,
    subject: `Interview with ${interviewee.userName}`,
    attachments: [
      {
        filename: "Resume.pdf",
        path: path.join(
          __dirname,
          config.default.vault,
          intervieweeUID,
          "Resume"
        ),
        cid: "Resume.pdf",
      },
    ],
    text: "Attached the details of the interview",
  };

  sender.sendMail(mail, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent successfully: " + info.response);
    }
  });
};

const userListByRoomID = {};
const messagesByRoomID = {};

io.on("connection", (socket) => {
  socket.emit("registered", socket.id);

  socket.on("room-is-ready", (roomId, peerID, userInfo) => {
    if (!userListByRoomID[roomId]) {
      userListByRoomID[roomId] = {};
    }

    userListByRoomID[roomId][`${userInfo.userName}${userInfo.email}`] =
      userInfo;

    socket.join(roomId);
    socket.to(roomId).emit("user-joined", peerID, userInfo);
    io.in(roomId).emit("list-of-users", userListByRoomID[roomId]);
    io.in(roomId).emit("list-of-messages", messagesByRoomID[roomId]);

    socket.on("disconnect-user", () => {
      socket.to(roomId).emit("user-disconnected", userInfo);
      socket.to(roomId).emit("on-screen-sharing", false);
      // exportAll(userListByRoomID[roomId], messagesByRoomID[roomId]);
      delete userListByRoomID[roomId][`${userInfo.userName}${userInfo.email}`];
      io.in(roomId).emit("list-of-users", userListByRoomID[roomId]);
    });

    socket.on("new-message", (newMessage, userName) => {
      if (!messagesByRoomID[roomId]) {
        messagesByRoomID[roomId] = [];
      }
      const newMessageObj = { message: newMessage, userName: userName };
      messagesByRoomID[roomId].push(newMessageObj);
      io.in(roomId).emit("list-of-messages", messagesByRoomID[roomId]);
    });

    socket.on("on-update-code", (newCode) => {
      socket.to(roomId).emit("on-code-updated", newCode);
    });

    socket.on("on-screen-sharing", (roomID, status) => {
      socket.to(roomId).emit("on-screen-sharing", status);
    });
  });
});

server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
