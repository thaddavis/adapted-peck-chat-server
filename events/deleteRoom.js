module.exports = (socket, sessionStore, objectHash, sessionID, io) => {
  socket.on("delete room", async (roomToDelete) => {
    console.log("--- roomToDelete ---", roomToDelete);

    for (let i = 0; i < roomToDelete.members.length; i++) {
      console.log("iii", roomToDelete.members[i].email);

      const currentGuestSessionID = objectHash([
        roomToDelete.members[i].email,
      ]).substring(0, 10);

      let roomsThatGuestHasJoined =
        await sessionStore.findAllRoomsThatGuestHasJoined(
          currentGuestSessionID
        );

      console.log("roomsThatGuestHasJoined", roomsThatGuestHasJoined);

      for (j = 0; j < roomsThatGuestHasJoined.length; j++) {
        if (roomsThatGuestHasJoined[j].roomID === roomToDelete.roomID) {
          roomsThatGuestHasJoined = [
            ...roomsThatGuestHasJoined.slice(0, j),
            ...roomsThatGuestHasJoined.slice(j + 1),
          ];
          break;
        } else {
          continue;
        }
      }

      console.log(
        "roomsThatGuestHasJoined after DELETING ROOM",
        roomsThatGuestHasJoined
      );

      const updatedRooms = [...roomsThatGuestHasJoined];

      // Update Rooms In Redis For Each Guest
      await sessionStore.updateRoomsThatGuestHasJoined(
        currentGuestSessionID,
        updatedRooms
      );

      if (currentGuestSessionID !== sessionID) {
        // notify other members of the room that it has been deleted
        socket
          .to(currentGuestSessionID)
          .emit("room disconnected", roomToDelete);
      }

      // Need to find socket id for currentGuestSessionID
      const sockets = await io.of("/").adapter.sockets(new Set());
      const guestDataForSockets = await sessionStore.findGuestDataForSockets(
        sockets,
        sessionID
      );

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
            .adapter.remoteLeave(
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
