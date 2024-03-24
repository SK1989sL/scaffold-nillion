import type * as Party from "partykit/server";
import type * as Nillion from "../types/nillion";

export default class Server implements Party.Server {
  config: Nillion.Config = {
    cluster_id: "f592f8ea-7651-4ab8-b692-ef149b783dc9",
    bootnodes: [
      "/dns/node-1.testnet-fe.nillion-network.nilogy.xyz/tcp/14211/wss/p2p/12D3KooWNbB2dobuVpH5qetmWnamsKr1G9rC5Sbvj2UsMt3jvQxK",
    ],
    payments_config: {
      rpc_endpoint: "https://rpc-endpoint.testnet-fe.nilogy.xyz",
      signer: {
        wallet: { chain_id: 22255222 },
      },
      smart_contract_addresses: {
        blinding_factors_manager: "0xf66cb23aa5857ae1d34a23ce385fa78495c50c69",
        payments: "0xc166ce8bfc56e4493ffd43a99db234a9f0413443",
      },
    },
  };

  phonebook: Nillion.PhoneBook = {};

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // A websocket just connected!
    console.log(
      `Connected:
  id: ${conn.id}
  room: ${this.room.id}
  url: ${new URL(ctx.request.url).pathname}`,
    );

    conn.send(JSON.stringify(this.baseline));
  }

  baseline: Nillion.Envelope = {
      type: "baseline",
      payload: {
        config: this.config,
        peers: this.phonebook,
      }
  }

  onMessage(message: string, sender: Party.Connection) {
    // let's log the message
    console.log(`connection ${sender.id} sent message: ${message}`);
    let envelope: Nillion.Envelope = JSON.parse(message);
    // we could use a more sophisticated protocol here, such as JSON
    // in the message data, but for simplicity we just use a string
    switch (envelope?.type) {
      case "register":
        this.register(envelope.payload);
        break;
      case "codeparty":
        this.codeparty(envelope.payload);
        break;
    }
  }

  onRequest(req: Party.Request) {
    // response to any HTTP request (any method, any path) with the current
    // phonebook. This allows us to use SSR to give components an initial value
    console.log(req);

    return new Response(JSON.stringify(this.baseline));
  }

  register(payload: Nillion.BookEntry) {
    this.phonebook[payload["handle"]] = payload;
    this.room.broadcast(JSON.stringify(this.baseline), []);
  }

  codeparty(payload: Nillion.CodePartyStart) {
    const codeparty: Nillion.Envelope = {
      type: "codeparty",
      payload,
    };
    this.room.broadcast(JSON.stringify(codeparty), []);
  }
}

Server satisfies Party.Worker;
