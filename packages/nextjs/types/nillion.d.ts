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
  codepartyid: string;
  peerid: string;
  programid: string;
  partyname: string | null;
  codename: string;
  inputs: NadaInputs[] | null;
};

export type CodePartyBindings = {
  [key: string]: CodePartyBinding;
};

export type CodePartyResult = {
  peerid: string;
  status: string;
  programid: string;
};

export CodePartyResults = {
  [key: string]: CodePartyResult;
}
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

export type CodePartyQueue = CodePartyStart;

export type Baseline = {
  chain: Chain;
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
