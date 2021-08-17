module.exports = (socket, sessionStore, objectHash, sessionID, io) => {
  socket.on("join room", async (roomInfo) => {
    // socket.broadcast.emit("kaka1");
    // socket.emit("kaka2");
    console.log("--- room ---", roomInfo);

    for (let i = 0; i < roomInfo.members.length; i++) {
      console.log("iii", roomInfo.members[i].email);

      const currentGuestSessionID = objectHash([
        roomInfo.members[i].email,
      ]).substring(0, 10);

      let roomsThatGuestHasJoined =
        await sessionStore.findAllRoomsThatGuestHasJoined(
          currentGuestSessionID
        );

      console.log("*** roomsThatGuestHasJoined ***", roomsThatGuestHasJoined);

      doesRoomExist = roomsThatGuestHasJoined.find(
        (element) => element.roomID == roomInfo.roomID
      );

      // if room already exists then skip
      if (doesRoomExist) {
        console.log("EXISTS");
      } else {
        console.log("DOES NOT EXIST");

        roomsThatGuestHasJoined.push({
          name: roomInfo.name,
          roomID: roomInfo.roomID,
          members: roomInfo.members,
        });
      }

      const updatedRooms = [...roomsThatGuestHasJoined];

      // Update Rooms In Redis For Each Guest
      await sessionStore.updateRoomsThatGuestHasJoined(
        currentGuestSessionID,
        updatedRooms
      );

      console.log("YERP", currentGuestSessionID, sessionID);
      if (currentGuestSessionID !== sessionID) {
        // notify other members of the room that it has been created
        socket.to(currentGuestSessionID).emit("room connected", roomInfo);
      }

      // Need to find socket id for currentGuestSessionID
      const sockets = await io.of("/").adapter.sockets(new Set());
      const guestDataForSockets = await sessionStore.findGuestDataForSockets(
        sockets,
        sessionID
      );

      console.log("guestDataForSockets", guestDataForSockets);

      currentGuestSessionIDSocketInfo = guestDataForSockets.find((g) => {
        return g.sessionID === currentGuestSessionID;
      });

      try {
        console.log(
          "ADDING to new ROOM socketID",
          currentGuestSessionIDSocketInfo.socketID
        );
        console.log("ADDING to new ROOM roomInfo.roomID", roomInfo.roomID);

        if (
          currentGuestSessionIDSocketInfo &&
          currentGuestSessionIDSocketInfo.socketID
        ) {
          await io
            .of("/")
            .adapter.remoteJoin(
              currentGuestSessionIDSocketInfo.socketID,
              roomInfo.roomID
            );
        } else {
          throw "socketID not found";
        }
      } catch (e) {
        console.error(e);
      }
    }
  });
};
