import type * as Party from "partykit/server";


type BookEntry = {
  handle: string;
  peerid: string;
};

type PhoneBook = { [key: string]: BookEntry }

export default class Server implements Party.Server {
  phonebook: PhoneBook = {};

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`,
    );

    conn.send(JSON.stringify(this.phonebook));
  }

  onMessage(message: string, sender: Party.Connection) {
    // let's log the message
    console.log(`connection ${sender.id} sent message: ${message}`);
    let payload = JSON.parse(message);
    // we could use a more sophisticated protocol here, such as JSON
    // in the message data, but for simplicity we just use a string
    if (payload?.type === "register") {
      this.register(payload.user);
    }
  }

  onRequest(req: Party.Request) {
    // response to any HTTP request (any method, any path) with the current
    // phonebook. This allows us to use SSR to give components an initial value

    return new Response(JSON.stringify(this.phonebook));
  }

  register(payload: BookEntry) {
    this.phonebook[payload["handle"]] = payload;
    this.room.broadcast(JSON.stringify(this.phonebook), []);
  }
}

Server satisfies Party.Worker;
