
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

export type PhoneBook = { [key: string]: BookEntry };

export type CodePartyQueue = CodePartyStart;

export type Baseline = {
  config: Config;
  peers: PhoneBook;
};

export type CodePartyStart = {
	peers: string[];
	programid: string;
};

export type Envelope = {
	type: string;
	payload: Baseline | BookEntry | CodePartyStart;
};

export type DefaultAction = { type: "PeerEntered" } | { type: "PeerExit" };
export type RegisterAction = { type: "register"; payload: BookEntry };
export type CodePartyAction = { type: "codeparty"; payload: CodePartyStart };

export type Action = DefaultAction | RegisterAction | CodePartyAction;
