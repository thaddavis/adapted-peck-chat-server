/* abstract */ class MessageStore {
  saveMessage(message) {}
  findMessagesForUser(userID) {}
  findMessagesForRoomsThatGuestHasJoined(sessionID) {}
}

const CONVERSATION_TTL = 24 * 60 * 60;

class RedisMessageStore extends MessageStore {
  constructor(redisClient) {
    super();
    this.redisClient = redisClient;
  }

  saveMessage(message) {
    const value = JSON.stringify(message);
    this.redisClient
      .multi()
      .rpush(`messages:${message.roomID}`, value)
      .expire(`messages:${message.roomID}`, CONVERSATION_TTL)
      .exec();
  }

  // findMessagesForRoom(sessionID) {
  //   return this.redisClient
  //     .lrange(`messages:${sessionID}`, 0, -1)
  //     .then((results) => {
  //       return results.map((result) => JSON.parse(result));
  //     });
  // }

  async findMessagesForRooms(rooms) {
    console.log("findMessagesForRooms", rooms);

    let roomMessages = {};

    for (let i = 0; i < rooms.length; i++) {
      const results = await this.redisClient.lrange(
        `messages:${rooms[i].roomID}`,
        0,
        -1
      );
      // console.log("i i i", results);
      const messages = results.map((result) => JSON.parse(result));
      roomMessages[rooms[i].roomID] = messages;
    }

    // rooms.forEach(async (i) => {
    //   console.log("i i i", i);
    //   const results = await this.redisClient.lrange(
    //     `messages:${i.roomID}`,
    //     0,
    //     -1
    //   );
    //   console.log("i i i", results);
    //   const messages = results.map((result) => JSON.parse(result));
    //   roomMessages[i.roomID] = messages;

    // .then((results) => {
    //   console.log("i i i", results);
    //   const messages = results.map((result) => JSON.parse(result));
    //   roomMessages[i.roomID] = messages;
    // });
    // });

    return roomMessages;
  }
}

module.exports = {
  RedisMessageStore,
};
