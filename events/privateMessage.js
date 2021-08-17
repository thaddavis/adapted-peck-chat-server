module.exports = (socket, sessionID, guestInfo, messageStore) => {
  // forward the private message to the right recipient (and to other tabs of the sender)
  socket.on(
    "private message",
    ({ content, fromSessionID, fromGuestInfo, roomID }) => {
      console.log("--- private message ---");
      console.log(content, fromSessionID, fromGuestInfo, roomID);

      const message = {
        content,
        fromSessionID,
        fromGuestInfo,
        roomID,
      };

      socket.to(roomID).emit("private message", message);
      // socket.to(to).to(roomID).emit("private message", message);
      messageStore.saveMessage(message);
    }
  );
};
