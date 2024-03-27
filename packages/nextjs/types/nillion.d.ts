export type Chain = {
  chainId: number;
  chainName: string;
  iconUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  },
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

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
  codepartyid: string;
};

export type PhoneBook = { [key: string]: BookEntry };

export type CodePartyBinding = {
  owner: string;
  handle: string;
  ownercodepartyid: string;
  peerid: string;
  programid: string;
  partyname: string | null;
  inputs: NadaInputs[] | null;
};

export type CodePartyBindings = {
  [key: string]: CodePartyBinding;
};

export type CodePartyContrib = {
  ownercodepartyid: string;
  handle: string;
  status: string;
  programid: string;
};

export type CodePartyResults = {
  [key: string]: CodePartyContrib;
};

export type NadaInputs = {
  type: string;
  name: string;
};

export type NadaExtracts = {
  partyname: string;
  inputs: NadaInputs[];
};

export type ProgramExtracts = {
  [key: string]: NadaExtracts;
};

export type CodePartyQueue = CodePartyBinding;

export type Baseline = {
  chain: Chain;
  config: Config;
  peers: PhoneBook;
};

export type CodePartyStart = {
  peers: CodePartyBindings;
  programid: string;
};

export type Envelope = {
  type: string;
  payload: Baseline | BookEntry | CodePartyStart | ContribTask;
};

export type DefaultAction = { type: "PeerEntered" } | { type: "PeerExit" };
export type RegisterAction = { type: "register"; payload: BookEntry };
export type CodePartyStartAction = { type: "codeparty-start"; payload: CodePartyStart };
export type ContribAction = { type: "contrib"; payload: CodePartyContrib };
export type ContribTask = { type: "codeparty-task"; payload: CodePartyBinding };

export type Action = DefaultAction | RegisterAction | CodePartyStartAction | ContribAction;
