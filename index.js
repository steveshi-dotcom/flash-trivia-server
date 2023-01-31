import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
//import { PeerServer } from 'peer';
//const peerServer = PeerServer({ port: 3003, path: '/flash-trivia' });

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  }
});

app.get('/stevesayshi', (req, res) => {
  res.send('Hello from Steve Shi!')
})

const PORT = process.env.PORT || 4001;
let roomQuestion = {};

io.on('connection', (socket) => {
  console.log("------------------------------------------------------");
  console.log(`A connected user: ${socket.id}`);
  //console.log(Object.keys(roomQuestion).length);

  // Link the question with the room
  socket.on('existing-questions', data => {
    const existing = roomQuestion[`${data.room}`];
    if (existing) {
      socket.emit('existing-questions', [existing, socket.id]);
    } else {
      roomQuestion[`${data.room}`] = data.questions;
      socket.emit('existing-questions', [data.questions, socket.id]);
    }
  });

  // A new player has joined, emit the playerData specifically in that room to inform the others
  socket.on("join-game", (dataChunk) => {
    const { userId, userName, userRoom, userMsg} = dataChunk;

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

    // Send the trivia answer board for result page
    socket.on('obtain-answer-board', roomNum => {
      console.log(roomQuestion[`${roomNum}`]);
      io.emit('obtain-answer-board', roomQuestion[`${roomNum}`]);
    })

    // Inform the other players in the game room that a player has left
    socket.on("disconnect", () => {
      socket.leave(userRoom);

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

      // Delete questions associating with a room if there are no other users in the game, else keep
      const clientsSize = io.sockets.adapter.rooms.get(userRoom);
      if (!clientsSize) {
        delete roomQuestion[`${userRoom}`];
      }
    });
  });

  //------------------------------------------------------
  socket.on('disconnect', (reason) => {
    console.log(`A disconnected user: ${socket.id}`);
  });
});

// Listen on the port
server.listen(PORT, () => {
  console.log("Listening on the server.");
});