import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { PeerServer } from 'peer';
const peerServer = PeerServer({
  port: 3003,
  path: '/flash-trivia'
});

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  }
});

const PORT = process.env.PORT || 3001;
let users = [];     // Keep track of all user

const disconnectDuplicate = (newUserId) => {
  const usersCopy = users.filter(curr => {
    return curr.userId === newUserId;
  });
  return usersCopy.length !== 0;
};

io.on('connection', (socket) => {
  console.log("------------------------------------------------------");
  console.log(`A connected user: ${socket.id}`);

  // A new player has joined, emit the playerData specifically in that room to inform the others
  socket.on("join-game", (dataChunk) => {
    console.log(io.engine.clientsCount);
    const { userId, userName, userRoom, userMsg} = dataChunk;

    // if the userId is already contained within the users[], then disconnect the socket
    if (disconnectDuplicate(userId)) {
      io.disconnectSockets(true);
    } else {
      users.push({"userId": userId, "userName": userName, "userRoom": userRoom});
    }

    // Inform the other players in the game room that a player has joined in with them
    socket.join(userRoom);
    io.in(userRoom).emit("new-player", {
      "userId": userId,
      "userName": userName,
      "userMsg": userMsg
    });
    socket.to(userRoom).emit('meet-up', userId);

    // Send message to every player including the sender in the room
    socket.on("chat-message", (playerPostedChat) => {
      const messageBox = {
        "userName": playerPostedChat.userName,
        "userMsg": playerPostedChat.userMsg
      };
      io.in(userRoom).emit("chat-message", messageBox);
    });

    // Sending peer id and other meta info to others in the room so one/one connection can be established with each
    socket.on("meet-up", (peerId) => {
      console.log(peerId);
      io.to(userRoom).emit("meet-up", peerId);
    });

    // Inform the other players in the game room that a player has left
    socket.on("disconnect", () => {
      socket.leave(userRoom);
      users = users.filter(curr => {
        return curr.userId !== userId;
      })

      // msg updating the chatroom that the player has left
      const playerLeavingUpdate = `I have left the game at
        ${new Date().getHours()}:${new Date().getMinutes() < 10 ?
        '0' + new Date().getMinutes()
        : new Date().getMinutes()}`;
      io.in(userRoom).emit("old-player", {  // keep it at old-player :))))
        "userId": userId,
        "userName": userName,
        "userMsg": playerLeavingUpdate
      });
      console.log("Leaving")
    });
  });

  socket.on("Hello", hello => {
    console.log(hello);
  })
  //------------------------------------------------------
  socket.on('disconnect', (reason) => {
    console.log(`A disconnected user: ${socket.id}`);
  });
});

// Listen on the port
server.listen(PORT, () => {
  console.log("Listening on the server.");
});