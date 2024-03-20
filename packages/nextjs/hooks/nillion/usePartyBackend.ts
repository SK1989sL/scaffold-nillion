import { useState } from "react";
import usePartySocket from "partysocket/react";

const PARTY_TRACKER = "apollo.wehrenterprises.org:1999";

type BookEntry = {
  handle: string;
  peerid: string;
};
type PhoneBook = { [key: string]: BookEntry };

type RegistrationTicket = { handle: string; peerid: string };
type DefaultAction = { type: "PeerEntered" } | { type: "PeerExit" };
type RegisterAction = { type: "register"; user: RegistrationTicket };
type Action = DefaultAction | RegisterAction;

export const usePartyBackend = () => {
  const [partyState, setPartyState] = useState<PhoneBook | null>(null);

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
      setPartyState(JSON.parse(e.data));
      console.log("message", e.data);
    },
    onClose() {
      console.log("closed");
    },
    onError(e) {
      console.log(`error`);
      console.error(JSON.stringify(e, null, 4));
    },
  });

  const dispatch = (action: Action) => {
    console.log(`sending message to party people`);
    ws.send(JSON.stringify(action));
  };
  return {
    partyState,
    dispatch,
  };
};
