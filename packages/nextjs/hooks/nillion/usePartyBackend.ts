import { useState } from "react";
import usePartySocket from "partysocket/react";

import type * as Nillion from "~~/types/nillion";

const PARTY_TRACKER = "apollo.wehrenterprises.org:1999";

export const usePartyBackend = () => {
  const [partyState, setPartyState] = useState<Nillion.PhoneBook | null>(null);
  const [partyQueue, setPartyQueue] = useState<Nillion.PartyQueue | null>(null);

  const ws = usePartySocket({
    // usePartySocket takes the same arguments as PartySocket.
    host: process.env.NEXT_PUBLIC_SERVER_URL || PARTY_TRACKER,
    room: "default",

    // in addition, you can provide socket lifecycle event handlers
    // (equivalent to using ws.addEventListener in an effect hook)
    onOpen() {
      console.log("connected");
    },
    onMessage(e) {
      console.log("message", e.data);
      let envelope: Nillion.Envelope = JSON.parse(e.data);
      switch (envelope?.type) {
        case "codeparty":
          setPartyQueue([...partyQueue, envelope.payload]);
          break;
        default:
          setPartyState(envelope);
      }
    },

    onClose() {
      console.log("closed");
    },
    onError(e) {
      console.log(`error`);
      console.error(JSON.stringify(e, null, 4));
    },
  });

  const dispatch = (action: Nillion.Action) => {
    console.log(`sending message to party people`);
    ws.send(JSON.stringify(action));
  };
  return {
    partyState,
    partyQueue,
    dispatch,
  };
};
