module.exports = (io, socket, sessionID, sessionStore) => {
  // notify users upon disconnection
  socket.on("disconnect", async () => {
    console.log("disconnect!");

    const matchingSockets = await io.in(sessionID).allSockets();
    const isDisconnected = matchingSockets.size === 0;
    if (isDisconnected) {
      // notify other users
      socket.broadcast.emit("session disconnected", sessionID);
      // update the connection status of the session

      sessionStore.updateSessionConnectedStatus(sessionID, false);

      // sessionStore.saveSession(sessionID, {
      //   sessionID,
      //   socketID,
      //   guestInfo,
      //   connected: false,
      //   roomsGuestHasJoined: roomsGuestHasJoined,
      // });
    }
  });
};
