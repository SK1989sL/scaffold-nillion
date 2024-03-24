import { useState } from "react";
import usePartySocket from "partysocket/react";

import type * as Nillion from "~~/types/nillion";

const PARTY_TRACKER = "apollo.wehrenterprises.org:1999";

export const usePartyBackend = () => {
  const [partyState, setPartyState] = useState<Nillion.Baseline | null>(null);
  const [partyQueue, setPartyQueue] = useState<Nillion.CodePartyQueue | null>(
    null,
  );

  const ws = usePartySocket({
    // usePartySocket takes the same arguments as PartySocket.
    host: process.env.NEXT_PUBLIC_SERVER_URL || PARTY_TRACKER,
    room: "default",

    // in addition, you can provide socket lifecycle event handlers
    // (equivalent to using ws.addEventListener in an effect hook)
    onOpen() {
      console.log("usePartyBackend onOpen");
    },
    onMessage(e) {
      console.log(`usePartyBackend onMessage: ${e.data}`);
      let envelope: Nillion.Envelope = JSON.parse(e.data);
      switch (envelope?.type) {
        case "baseline":
          setPartyState(envelope.payload);
          break;
        case "codeparty":
          setPartyQueue(envelope.payload);
          break;
      }
    },

    onClose() {
      console.log("usePartyBackend onClose");
    },
    onError(e) {
      console.log(`usePartyBackend onError`);
      console.error(JSON.stringify(e, null, 4));
    },
  });

  const dispatch = (action: Nillion.Action) => {
    console.log(`usePartyBackend dispatch message to party backend`);
    ws.send(JSON.stringify(action));
  };

  return {
    partyState,
    partyQueue,
    dispatch,
  };
};
