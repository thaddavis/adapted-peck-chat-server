// Setup basic express server
var express = require('express');
var app = express();
const Redis = require("ioredis");

const objectHash = require("object-hash");
const events = require("./events");


app.get('/socket', (req, res) => {
  res.send('OK')
})

console.log('process.env.FRONT_END_HOSTNAME', process.env.FRONT_END_HOSTNAME)

var redisClient = new Redis(process.env.REDIS_HOST);
var server = require('http').createServer(app);
var io = require('socket.io')(server, {
  path: "/socket.io",
  cors: {
    origin: [process.env.FRONT_END_HOSTNAME]
  },
  adapter: require("socket.io-redis")({
    pubClient: redisClient,
    subClient: redisClient.duplicate(),
  }),
});

const { RedisSessionStore } = require("./redis/sessionStore");
const sessionStore = new RedisSessionStore(redisClient);
const { RedisMessageStore } = require("./redis/messagesStore");
const messageStore = new RedisMessageStore(redisClient);

// vvv vvv vvv vvv vvv vvv vvv vvv

io.use(async (socket, next) => {
  console.log(new Date().toISOString());

  console.log("middleware -!-!- socket.handshake.auth", socket.handshake.auth);
  console.log("middleware -!-!- socket.handshake", socket.handshake);
  console.log("REDIS_HOST", process.env.REDIS_HOST);

  const sessionID = socket.handshake.auth.sessionID;
  const guestInfo = socket.handshake.auth.guestInfo;

  if (sessionID) {
    const session = await sessionStore.findSession(sessionID, objectHash);

    console.log("FOUND", session);

    if (session) {
      // rooms that guest has joined
      socket.data.rooms = session.rooms;
      socket.data.sessionID = session.sessionID;
      socket.data.socketID = socket.id;
      socket.data.guestInfo = session.guestInfo;
      return next();
    }
  }

  if (!sessionID) {
    return next(new Error("invalid sessionID"));
  }

  socket.data.sessionID = sessionID;
  socket.data.socketID = socket.id;
  socket.data.guestInfo = guestInfo;
  // roomID's will be reproducibled and will be the object hash of
  // all the members sorted in alphabetical order
  socket.data.rooms = [
    {
      name: guestInfo.name || "default",
      roomID: sessionID,
      members: [guestInfo.email],
    },
  ];
  next();
});

io.on("connection", async (socket) => {
  console.log(new Date().toISOString());

  console.log("CONNECTION");
  console.log("CONNECTION");
  console.log("CONNECTION");

  console.log("connection - socket.data", socket.data);

  const sessionID = socket.data.sessionID;
  const socketID = socket.data.socketID;
  const guestInfo = socket.data.guestInfo;
  const roomsGuestHasJoined = socket.data.rooms;

  sessionStore.saveSession(sessionID, {
    roomsGuestHasJoined,
    sessionID,
    socketID,
    guestInfo,
    connected: true,
  });

  // emit session details
  socket.emit("session", {
    sessionID,
    socketID,
    guestInfo,
  });

  // join the default room for this guest
  socket.join(sessionID);

  // fetch rooms info in Redis -> short/medium term state
  const rooms = [];

  const allRooms = await sessionStore.findAllRoomsThatGuestHasJoined(sessionID);
  const messagesPerRoom = await messageStore.findMessagesForRooms(allRooms);

  console.log("-> messagesPerRoom", messagesPerRoom);
  console.log("-> allRooms", allRooms);

  allRooms.forEach((room) => {
    // console.log("looping over sessions", session);

    rooms.push({
      roomID: room.roomID,
      name: room.name,
      members: room.members,
      messages: messagesPerRoom[room.roomID] || [],
    });
  });

  console.log("rooms", rooms);
  socket.emit("rooms", rooms);

  const sockets = await io.of("/").adapter.sockets(new Set());
  console.log("*** sockets *** ->", sockets); // a Set containing all the connected socket ids

  const guestDataForSockets = await sessionStore.findGuestDataForSockets(
    sockets,
    sessionID
  );

  socket.emit("online members", guestDataForSockets);

  // notify existing users
  socket.broadcast.emit("session connected", {
    guestInfo,
    sessionID,
    socketID,
    connected: true,
  });

  events.privateMessage(socket, sessionID, guestInfo, messageStore);
  events.disconnect(io, socket, sessionID, sessionStore);
  events.joinRoom(socket, sessionStore, objectHash, sessionID, io);
  events.deleteRoom(socket, sessionStore, objectHash, sessionID, io);
});
// ^^^ ^^^ ^^^ ^^^ ^^^ ^^^

// FINALLY START SERVER

var port = process.env.PORT || 4000;

server.listen(port, function() {
  console.log('Server listening at port %d', port);
});

setInterval(async () => {
  const sessions = await sessionStore.findAllSessions();
  const rooms = await io.of("/").adapter.allRooms();
}, 3000);

// io.on('connection', function(socket) {
//   console.log('EVENT connection')
//   // console.log('-')
//   var addedUser = false;

//   // when the client emits 'new message', this listens and executes
//   socket.on('new message', function(data) {
//     console.log('EVENT new message')
//     // we tell the client to execute 'new message'
//     socket.broadcast.emit('new message', {
//       username: socket.username,
//       message: data
//     });
//   });

//   socket.on('session', function(data) {
//     console.log('EVENT session')
//   });

//   socket.conn.on('heartbeat', function() {
//     // console.log('EVENT heartbeat')
//     console.log('-')

//     if (!addedUser) {
//       // Don't start upserting until the user has added themselves.
//       return;
//     }

//     Presence.upsert(socket.id, {
//       username: socket.username
//     });
//   });

//   // when the client emits 'add user', this listens and executes
//   socket.on('add user', function(username) {
//     console.log('EVENT add user', username)
//     if (addedUser) {
//       return;
//     }

//     // we store the username in the socket session for this client
//     socket.username = username;
//     Presence.upsert(socket.id, {
//       username: socket.username
//     });
//     addedUser = true;

//     Presence.list(function(users) {
//       console.log('list')

//       socket.emit('login', {
//         numUsers: users.length
//       });

//       // echo globally (all clients) that a person has connected
//       socket.broadcast.emit('user joined', {
//         username: socket.username,
//         numUsers: users.length
//       });
//     });
//   });

//   // when the client emits 'typing', we broadcast it to others
//   socket.on('typing', function() {
//     socket.broadcast.emit('typing', {
//       username: socket.username
//     });
//   });

//   // when the client emits 'stop typing', we broadcast it to others
//   socket.on('stop typing', function() {
//     socket.broadcast.emit('stop typing', {
//       username: socket.username
//     });
//   });

//   // when the user disconnects.. perform this
//   socket.on('disconnect', function() {
//     if (addedUser) {
//       Presence.remove(socket.id);

//       Presence.list(function(users) {
//         // echo globally (all clients) that a person has connected
//         socket.broadcast.emit('user left', {
//           username: socket.username,
//           numUsers: users.length
//         });
//       });
//     }
//   });
// });
