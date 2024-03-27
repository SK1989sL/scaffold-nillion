import { useState } from "react";
import usePartySocket from "partysocket/react";

import type * as Nillion from "~~/types/nillion";

const PARTY_TRACKER = "apollo.wehrenterprises.org:1999";

export const usePartyBackend = () => {
  const [programId, setProgramId] = useState<string | null>(null);
  const [networkContribError, setNetworkContribError] = useState<string | null>(
    null,
  );
  const [partyState, setPartyState] = useState<Nillion.Baseline | null>(null);
  const [partyQueue, setPartyQueue] = useState<Nillion.CodePartyQueue | null>(
    null,
  );
  const [partyResults, setPartyResults] = useState<
    Nillion.CodePartyResults | null
  >(
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
        case "codeparty-task":
          console.log(`got a program task assignment`);
          setPartyQueue(envelope.payload);
          break;
        case "contrib":
          if (envelope.payload.programid !== programId) {
            console.log(`this broadcast is not for my program`);
          } else if (envelope.payload.status === "error") {
            setNetworkContribError(envelope.payload.peerid);
          } else {
            setPartyResults((prev) => ({
              ...prev,
              [envelope.payload.peerid]: envelope.payload,
            }));
          }
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
    programId,
    setProgramId,
    partyState,
    partyQueue,
    partyResults,
    dispatch,
  };
};
