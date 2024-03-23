
export type Config = {
  cluster_id: string;
  bootnodes: string[];
  payments_config: {
    rpc_endpoint: string;
    signer: {
      wallet: {
        "chain_id": number;
      };
    };
    smart_contract_addresses: {
      "blinding_factors_manager": string;
      "payments": string;
    };
  };
};

export type BookEntry = {
  handle: string;
  peerid: string;
};

export type PhoneBook = { [key: string]: NillionConfig | BookEntry };

export type CodePartyStart = {
	peers: string[];
	programid: string;
};

export type Envelope {
	type: string;
	payload: BookEntry | CodePartyStart
};

export type DefaultAction = { type: "PeerEntered" } | { type: "PeerExit" };
export type RegisterAction = { type: "register"; payload: BookEntry };
export type CodePartyAction = { type: "party"; payload: CodePartyStart };

export type Action = DefaultAction | RegisterAction | CodePartyAction;
