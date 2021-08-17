/* abstract */ class RoomStore {}

const SESSION_TTL = 24 * 60 * 60;
const mapSession = ([connected, sessionID, socketID, guestInfo]) =>
  sessionID
    ? {
        connected: connected === "true",
        sessionID,
        socketID,
        guestInfo: JSON.parse(guestInfo),
      }
    : undefined;

const mapSessionForGuestInfo = ([guestInfo, socketID, sessionID]) =>
  guestInfo
    ? {
        guestInfo: JSON.parse(guestInfo),
        sessionID,
        socketID,
      }
    : undefined;

const mapRoom = ({ roomID, name }) => {
  console.log("mapRoom ->", roomID, name);

  return roomID
    ? {
        roomID,
        name,
      }
    : undefined;
};

class RedisRoomStore extends RoomStore {
  constructor(redisClient) {
    super();
    this.redisClient = redisClient;
  }

  findSession(id) {
    return this.redisClient
      .hmget(
        `session:${id}`,
        "connected",
        "roomID",
        "socketID",
        "guestInfo",
        "rooms"
      )
      .then(mapSession);
  }

  saveSession(
    id,
    { guestInfo, connected, sessionID, socketID, roomsGuestHasJoined }
  ) {
    console.log("saveSession", guestInfo, JSON.stringify(guestInfo));

    this.redisClient
      .multi()
      .hset(
        `session:${id}`,
        "connected",
        connected,
        "sessionID",
        sessionID,
        "socketID",
        socketID,
        "rooms",
        JSON.stringify(roomsGuestHasJoined),
        "guestInfo",
        JSON.stringify(guestInfo)
      )
      .expire(`room:${id}`, SESSION_TTL)
      .exec();
  }

  async findAllRooms() {
    const keys = new Set();
    let nextIndex = 0;
    do {
      const [nextIndexAsStr, results] = await this.redisClient.scan(
        nextIndex,
        "MATCH",
        "session:*",
        "COUNT",
        "100"
      );
      nextIndex = parseInt(nextIndexAsStr, 10);
      results.forEach((s) => keys.add(s));
    } while (nextIndex !== 0);
    const commands = [];
    keys.forEach((key) => {
      commands.push([
        "hmget",
        key,
        "connected",
        "sessionID",
        "socketID",
        "guestInfo",
      ]);
    });
    return this.redisClient
      .multi(commands)
      .exec()
      .then((results) => {
        console.log("*##*##* results *##*##*", results);

        return results
          .map(([err, session]) => (err ? undefined : mapSession(session)))
          .filter((v) => !!v);
      });
  }

  async findAllRoomsThatGuestHasJoined(sessionID) {
    console.log("sessionID ->->->", sessionID);

    return this.redisClient
      .hget(`session:${sessionID}`, "rooms")
      .then((results) => {
        console.log("results", results);

        const rooms = JSON.parse(results);

        console.log("rooms after JSON.parse", rooms);

        return rooms.map((room) => mapRoom(room)).filter((v) => !!v);

        // return results
        //   .map(([err, rooms]) => (err ? undefined : mapRoom(room)))
        //   .filter((v) => !!v);
      });
  }

  async findGuestDataForSockets(sockets, sessionID) {
    console.log("findGuestDataForSockets ->", sockets);

    let guestDataForSockets = [];

    // guestDataForSocket
    const keys = new Set();
    let nextIndex = 0;
    do {
      const [nextIndexAsStr, results] = await this.redisClient.scan(
        nextIndex,
        "MATCH",
        "session:*",
        "COUNT",
        "100"
      );
      nextIndex = parseInt(nextIndexAsStr, 10);
      results.forEach((s) => keys.add(s));
    } while (nextIndex !== 0);
    const commands = [];
    keys.forEach((key) => {
      commands.push(["hmget", key, "guestInfo", "socketID", "sessionID"]);
    });
    const guestInfo = await this.redisClient
      .multi(commands)
      .exec()
      .then((results) => {
        console.log("*##*##* results *##*##*", results);

        return results
          .map(([err, session]) =>
            err ? undefined : mapSessionForGuestInfo(session)
          )
          .filter((v) => !!v);
      });

    console.log("guestInfo ->", guestInfo);

    guestInfo.forEach(async (i) => {
      if (sockets.has(i.socketID)) {
        guestDataForSockets.push({
          ...i,
          connected: true,
          self: i.sessionID === sessionID,
        });
      } else {
        guestDataForSockets.push({
          ...i,
          connected: false,
          self: i.sessionID === sessionID,
        });
      }
    });

    console.log("guestDataForSockets ->", guestDataForSockets);

    return guestDataForSockets;
  }
}
module.exports = {
  RedisRoomStore,
};
