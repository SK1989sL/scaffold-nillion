"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NextPage } from "next";
import CopyToClipboard from "react-copy-to-clipboard";
import CodeMirror from "@uiw/react-codemirror";
import { monokai } from "@uiw/codemirror-theme-monokai";

import { python } from "@codemirror/lang-python";

import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Avatar,
  AvatarGroup,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Center,
  Checkbox,
  Code,
  Divider,
  Flex,
  Heading,
  Input,
  InputGroup,
  InputLeftAddon,
  Link as ChakraLink,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Progress,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Stack,
  Step,
  StepDescription,
  StepIcon,
  StepIndicator,
  StepNumber,
  Stepper,
  StepSeparator,
  StepStatus,
  StepTitle,
  Table,
  TableCaption,
  TableContainer,
  Tag,
  TagLabel,
  Tbody,
  Td,
  Text,
  Tfoot,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useSteps,
  useToast,
} from "@chakra-ui/react";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { useAccount } from "wagmi";
import {
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { Web3 } from "web3";

import * as NillionType from "~~/types/nillion";
import { Address } from "~~/components/scaffold-eth";
import { usePartyBackend } from "~~/hooks/nillion";
import { shortenKeyHelper } from "~~/utils/scaffold-eth";

const backend = process.env.NEXT_PUBLIC_NILLION_BACKEND;

const mkObj = (key, value) => Object.fromEntries([[key, value]]);
const partyResultsColor = (results, peer) => {
  if (!results || (!(peer in results))) return "yellow";
  switch (results[peer].status) {
    case "ok":
      return "green";
    case "error":
      return "red";
    default:
      return "pink";
  }
};

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

const seededRandom = (seedStr, min, max) => {
  let seed = hashString(seedStr);
  seed = (seed * 9301 + 49297) % 233280;
  const rnd = seed / 233280;
  return Math.floor(min + rnd * (max - min));
};

const Home: NextPage = () => {
  const {
    partyState,
    partyQueue,
    partyResults,
    networkContribError,
    setProgramId,
    programId,
    dispatch,
  } = usePartyBackend();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: contribFormIsOpen,
    onOpen: contribFormOnOpen,
    onClose: contribFormOnClose,
  } = useDisclosure();

  const [codePartyBindings, setCodePartyBindings] = useState<
    NillionType.CodePartyBindings | null
  >(null);

  const toast = useToast();

  const onAssignPeerBindings = async () => {
    try {
      const bindingInit: NillionType.CodePartyBindings = Object.keys(
        selectedPeers,
      ).reduce((acc, p) => {
        acc[
          partyState.peers[p].codepartyid
        ] = {
          owner: codeName,
          handle: partyState.peers[p].handle,
          ownercodepartyid: partyState.peers[codeName].codepartyid,
          owneruserid: client.user_id(),
          partyid: partyState.peers[p].partyid,
          programid: programId,
          ...nadaParsed[selectedPeers[p]],
        };
        return acc;
      }, {});

      dispatch({
        type: "codeparty-start",
        payload: {
          peers: bindingInit,
          programid: programId,
        },
      });
      setActiveStep(2);
      setCodePartyBindings(bindingInit);
    } catch (error) {
      console.error("Error posting program: ", error);
      setCodeError(`server error: ${error}`);
      setPartyButtonBusy(undefined);
      return;
    }
  };

  const onSubmitCode = async () => {
    setCodeError(null);
    setPartyButtonBusy(true);

    const url = `${backend}/upload-nada-source/${codeName}-program`;

    // encode nadalang source code so that I don't have serialization issues
    let buffer = new TextEncoder().encode(nadalang);
    let base64EncodedString = btoa(String.fromCharCode.apply(null, buffer));
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ nadalang: base64EncodedString }),
      });
      if (!(response.status === 200)) {
        setCodeError(`server error`);
        return;
      }
      const result = await response.json();
      console.log(`got program response: ${JSON.stringify(result, null, 4)}`);
      if (result?.statusCode !== 200) {
        setCodeError(result?.error);
        return;
      }
      setProgramId(result.programid);
      setActiveStep(1);
    } catch (error) {
      console.error("Error posting program: ", error);
      setCodeError(`server error: ${error}`);
      return;
    } finally {
      setPartyButtonBusy(undefined);
    }
  };

  const onExecuteProgram = async () => {
    // codePartyBindings should match codePartyResults
    /*
    *
    "unusual-copper-tuna": {
        "ownercodepartyid": "c0cfc539-ca36-4657-b863-03d681916163",
        "handle": "unusual-copper-tuna",
        "status": "ok",
        "programid": "eefErRvstMDAq67vbYwDMJSUK8zEx3yCT6ETrQv8NyG8Mn9FXVAU5AdZwa5yZn9qNHBGD3GVzevYMsbUWTLcDaU/unusual-copper-tuna-program"
    },
    "marine-brown-jackal": {
        "ownercodepartyid": "c0cfc539-ca36-4657-b863-03d681916163",
        "handle": "marine-brown-jackal",
        "status": "ok",
        "programid": "eefErRvstMDAq67vbYwDMJSUK8zEx3yCT6ETrQv8NyG8Mn9FXVAU5AdZwa5yZn9qNHBGD3GVzevYMsbUWTLcDaU/unusual-copper-tuna-program"
    }
    */
    console.log(`got all the results back - starting execute!`);

    try {
      setExecButtonBusy(true);
      const bindings = new nillion.ProgramBindings(programId);
      let outputName;
      Object.keys(codePartyBindings).map((i) => {
        console.log(
          `adding input binding: ${codePartyBindings[i].partyname}: ${codePartyBindings[i].partyid
          }`,
        );
        bindings.add_input_party(
          codePartyBindings[i].partyname,
          codePartyBindings[i].partyid,
        );

        if ("output" in codePartyBindings[i]) {
          console.log(
            `adding output binding: ${codePartyBindings[i].output}: ${codePartyBindings[i].partyid
            }`,
          );
          outputName = codePartyBindings[i].output;
          bindings.add_output_party(
            codePartyBindings[i].output,
            codePartyBindings[i].partyid,
          );
        }
      });

      console.log(`computing with store_ids: ${store_ids}`);
      const store_ids = Object.values(partyResults).map((i) => i.storeid);
      const empty_secrets = new nillion.Secrets();
      const public_variables = new nillion.PublicVariables();
      const compute_result_uuid = await client.compute(
        partyState?.config.cluster_id,
        bindings,
        store_ids,
        empty_secrets,
        public_variables,
      );
      console.log(`got compute id: ${compute_result_uuid}`);

      const compute_result = client.compute_result(
        compute_result_uuid,
      );
      const result = compute_result[outputName].toString();
      console.log(`got ${result}`);
    } catch (error) {
      console.error("Error compute: ", error);
      // setContribError(`network error: ${error}`);
      toast({
        title: "Compute Fail",
        description: error,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      setExecButtonBusy(undefined);
    }
  };

  const steps = [
    { title: "First", description: "Upload Program", onClick: onSubmitCode },
    {
      title: "Second",
      description: "Select Peers",
      onClick: onAssignPeerBindings,
    },
    {
      title: "Third",
      description: "Execute Program",
      onClick: onExecuteProgram,
    },
  ];
  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: steps.length,
  });

  const [connectedToSnap, setConnectedToSnap] = useState<boolean>(false);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [codeName, setCodeName] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [contribError, setContribError] = useState<string | null>(null);
  const [contribButtonBusy, setContribButtonBusy] = useState<
    boolean | undefined
  >(
    undefined,
  );
  const [execError, setExecError] = useState<string | null>(null);
  const [execButtonBusy, setExecButtonBusy] = useState<
    boolean | undefined
  >(
    undefined,
  );

  const [partyButtonBusy, setPartyButtonBusy] = useState<boolean | undefined>(
    undefined,
  );
  const [selectedPeers, setSelectedPeers] = useState({});

  const [nadalang, setNadalang] = useState<string>(`
from nada_dsl import *
def nada_main():
    party1 = Party(name="Party1")
    party2 = Party(name="Party2")
    my_int1 = SecretInteger(Input(name="my_int1", party=party1))
    my_int2 = SecretInteger(Input(name="my_int2", party=party2))
    x = my_int1 * my_int2
    output = x.reveal() * Integer(3)
    return [Output(output, "my_output", party1)]
`);

  const [partyContrib, setPartyContrib] = useState<number | string | null>(
    null,
  );
  const [client, setClient] = useState(null);
  const [mmAddress, setMmAddress] = useState<string | null>(null);
  const [dynAddress, setDynAddress] = useState<string | null>(null);
  const [nillion, setNillion] = useState(null);
  const [partyContribComplete, setPartyContribComplete] = useState<boolean>(
    false,
  );
  const [partyContribWait, setPartyContribWait] = useState<boolean>(false);
  const [nadaParsed, setNadaParsed] = useState<
    NillionType.ProgramExtracts | null
  >(null);

  const closeCodeModal = () => {
    setCodeError(null);
    setPartyButtonBusy(null);
    onClose();
  };
  const onNadalangChange = useCallback((val) => {
    setNadalang(val);
  }, []);

  const onPartyContrib = (event) => setPartyContrib(event.target.value);

  const onSubmitContrib = async () => {
    const task = partyQueue;
    try {
      setContribButtonBusy(true);
      console.log(
        `starting submit to Nillion Network: ${JSON.stringify(task, null, 4)}`,
      );
      const binding = new nillion.ProgramBindings(
        task.programid,
      );

      // set the input party to the bindings to specify which party will provide the secret
      const party_id = await client.party_id();
      binding.add_input_party(task.partyname, party_id);

      const userId = client.user_id();
      const my_secrets = new nillion.Secrets();
      const permissions = nillion.Permissions.default_for_user(
        userId,
        task.programid,
      );
      permissions.add_compute_permissions(
        mkObj(task.owneruserid, [task.programid]),
      );

      // PublicInteger
      // SecretInteger
      // Integer
      // PublicUnsignedInteger
      // SecretUnsignedInteger
      // UnsignedInteger
      switch (task.inputs[0].type) {
        case "Integer":
        case "SecretInteger":
        case "PublicInteger":
          console.log(
            `insert new_integer: ${task.inputs[0].name}: ${partyContrib}`,
          );
          my_secrets.insert(
            task.inputs[0].name,
            nillion.Secret.new_integer(partyContrib),
          );
          break;
        case "Integer":
        case "SecretInteger":
        case "PublicInteger":
          console.log(
            `insert new_unsigned_integer: ${task.inputs[0].name
            }: ${partyContrib}`,
          );
          my_secrets.insert(
            task.inputs[0].name,
            nillion.Secret.new_unsigned_integer(partyContrib),
          );
          break;
        default:
          throw new Error(
            `unsupported type for a codeparty: ${task.inputs[0].type}`,
          );
      }
      let result = await client.store_secrets(
        partyState.config.cluster_id,
        my_secrets,
        binding,
        permissions,
      );
      toast({
        title: "Secret stored",
        description: `Store id [${result}]`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      dispatch({
        type: "contrib",
        payload: {
          ownercodepartyid: task?.ownercodepartyid,
          handle: codeName,
          status: "ok",
          storeid: result,
          programid: task.programid,
        },
      });
      setContribButtonBusy(undefined);
      contribFormOnClose();
    } catch (error) {
      console.error("Error storing program secret: ", error);
      // setContribError(`network error: ${error}`);
      toast({
        title: "Contrib Fail",
        description: `Error sending inputs to network ${error}`,
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      setContribButtonBusy(undefined);
      contribFormOnClose();
      dispatch({
        type: "contrib",
        payload: {
          ownercodepartyid: task?.ownercodepartyid,
          handle: codeName,
          status: "error",
          programid: task.programid,
        },
      });
      return;
    }
  };

  const handleRadioChange = (option, peer) => {
    setSelectedPeers((prev) => ({
      ...prev,
      [peer]: option,
    }));
  };

  useEffect(() => {
    if (programId === null) return;
    const nadaextracts = {};
    console.log("ASDASDFASDFAF");
    let match;

    const extractedPartyNames = /(\w+)\s=\s*Party\(\s*name\s*=\s*"(\w+)"/gm;
    while ((match = extractedPartyNames.exec(nadalang)) !== null) {
      nadaextracts[match[1]] = {
        partyname: match[2],
        inputs: [],
      };
    }

    const extractedInputNames =
      /(\w+)\(\s*Input\(\s*name\s*=\s*"(\w+)",\s*party=(\w+)/gm;
    while ((match = extractedInputNames.exec(nadalang)) !== null) {
      nadaextracts[match[3]].inputs.push(
        { type: match[1], name: match[2] },
      );
    }

    const extractedResultParty =
      /Output\(\s*\w+\s*,\s*"(.*?)"\s*,\s*(.*?)\s*\)/gm;
    while ((match = extractedResultParty.exec(nadalang)) !== null) {
      nadaextracts[match[2]].output = match[1];
    }

    console.log(`nada extracts: `);
    console.log(JSON.stringify(nadaextracts, null, 4));
    setNadaParsed(nadaextracts);
  }, [programId, nadalang]);

  useEffect(() => {
    if ((programId === null) || (partyResults === null)) return;
    if (
      Object.keys(partyResults).length === Object.keys(codePartyBindings).length
    ) {
      console.log(`you've collected results!`);
      setPartyContribComplete(true);
    }
  }, [partyResults, programId]);

  useEffect(() => {
    if ((partyQueue === null) || (userKey === null)) return;
    console.log(`you're a selected party member!`);
    contribFormOnOpen();
  }, [partyQueue, userKey]);

  const addAndSwitchNetwork = async () => {
    const myChain = partyState?.chain.chainId;
    if (!myChain) {
      setGlobalError("failed to pull chain from network");
      return;
    }

    try {
      const currentChainId = await window.ethereum.request({
        method: "eth_chainId",
      });
      if (currentChainId === myChain) {
        console.log("Desired network is already active.");
        return;
      }

      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [partyState?.chain],
      });
      toast({
        title: "Metamask Success",
        description: "Network added and switched successfully",
        status: "success",
        duration: 4000,
        isClosable: false,
      });
    } catch (error) {
      console.log(JSON.stringify(error, null, 4));
      toast({
        title: "Metamask Fail",
        description: `Error adding network or switching`,
        status: "error",
        duration: 9000,
        isClosable: false,
      });
      setGlobalError("Metamask network must be testnet");
    }
  };

  useEffect(() => {
    if (!userKey) return;
    const myName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: "-",
      seed: userKey,
    });

    setCodeName(myName);

    (async () => {
      await addAndSwitchNetwork();
      const mm_accounts = await window.ethereum.request({
        "method": "eth_requestAccounts",
      });
      const mm_balance = await window.ethereum.request({
        "method": "eth_getBalance",
        "params": [
          mm_accounts[0],
        ],
      });
      const balanceInEth = Web3.utils.fromWei(mm_balance, "ether");
      const mm_checksumAddr = Web3.utils.toChecksumAddress(mm_accounts[0]);
      setMmAddress(mm_checksumAddr);
      if (parseFloat(balanceInEth) < 0.5) {
        // this wallet needs funding
        toast({
          title: "Auto-faucet",
          description: "Funding your metamask account automatically",
          status: "success",
          duration: 2000,
          isClosable: false,
        });
        console.log(
          `posting dynamic wallet [${mm_checksumAddr}] to faucet webservice`,
        );
        const url = `${backend}/faucet/${mm_checksumAddr}`;
        const response = await fetch(url, {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log(`got faucet response: ${JSON.stringify(result, null, 4)}`);
        if (result?.statusCode !== 200) {
          toast({
            title: "Faucet Fail",
            description: `Error adding funds to address ${mm_accounts[0]}`,
            status: "error",
            duration: 9000,
            isClosable: false,
          });
          setGlobalError("Dynamic wallet must be funded");
          return;
        }
        console.log(`using dynamic wallet in nillion client: ${result.tx}`);
      }
      console.log(
        `mm balance of ${mm_checksumAddr}: ${JSON.stringify(mm_balance, null, 4)
        }`,
      );

      const mm_web3 = new Web3(window.ethereum); // metamask
      const web3 = new Web3(partyState?.config.payments_config.rpc_endpoint); // poa network
      const account = web3.eth.accounts.create();
      setDynAddress(account.address);

      const txSend = {
        to: account.address,
        from: mm_checksumAddr,
        value: web3.utils.toWei("0.5", "ether"),
      };
      console.log(`mm tx: ${JSON.stringify(txSend, null, 4)}`);
      const txHash = await mm_web3.eth.sendTransaction(txSend);

      const _nillion = await import("@nillion/nillion-client-js-browser");
      await _nillion.default();

      const randomInt = seededRandom(userKey, 0, 126); // Generates a number between 0 and 125
      const node_seed = `test-seed-${randomInt}`;
      console.log(`using node seed ${node_seed}`);
      const nodekey = _nillion.NodeKey.from_seed(
        node_seed,
      );
      const _userkey = _nillion.UserKey.from_base58(userKey);
      const payments_config = partyState?.config.payments_config;
      const pkWithout0x = account.privateKey.replace(/^0x/, "");
      payments_config.signer.wallet["private_key"] = pkWithout0x;
      console.log(
        `using payments_config: ${JSON.stringify(payments_config, null, 4)}`,
      );
      const _client = new _nillion.NillionClient(
        _userkey,
        nodekey,
        partyState?.config.bootnodes,
        payments_config,
      );

      const status = await _client.cluster_information(
        partyState?.config.cluster_id,
      );
      console.log(JSON.stringify(
        status,
        null,
        4,
      ));
      setClient(_client);
      setNillion(_nillion);

      dispatch({
        type: "register",
        payload: { handle: myName, partyid: client.party_id },
      });
    })();
  }, [userKey]);

  async function connectAndCallSnap() {
    const nillionSnapId = "npm:nillion-user-key-manager";
    if (window.ethereum) {
      try {
        // Request permission to connect to the Snap.
        await window.ethereum.request({
          // @ts-ignore
          method: "wallet_requestSnaps",
          params: {
            // @ts-ignore
            [nillionSnapId]: {},
          },
        });

        // Invoke the 'read_user_key' method of the Snap
        const response: { user_key: string } = await window.ethereum.request({
          // @ts-ignore
          method: "wallet_invokeSnap",
          params: {
            // @ts-ignore
            snapId: nillionSnapId,
            request: { method: "read_user_key" },
          },
        });

        if (response && response.user_key) {
          setUserKey(response.user_key);
          setConnectedToSnap(true);
        }
      } catch (error) {
        console.error("Error interacting with Snap:", error);
      }
    }
  }

  const peerBindingConflict = new Set(Object.values(selectedPeers)).size !==
    Object.values(selectedPeers).length;

  const peerToPartiesConflict =
    Object.keys(selectedPeers).length !== Object.keys(nadaParsed ?? {}).length;

  // DEBUG OUTPUT
  console.log(`STATE DUMP: `);
  console.log(JSON.stringify(
    {
      codePartyBindings,
      partyContrib,
      partyQueue,
      nadaParsed,
      selectedPeers,
      peerBindingConflict,
      peerToPartiesConflict,
      programId,
      activeStep,
      partyResults,
    },
    null,
    4,
  ));

  const PeerButton = (props) => {
    if (nadaParsed === null) return;
    return (
      <Card maxW="lg">
        <CardHeader>
          <Flex spacing="4">
            <Flex flex="1" gap="4" alignItems="center" flexWrap="wrap">
              <Avatar name={props.peer} />
              <Box>
                <Heading size="sm">
                  {props.peer}
                  {props.peer === codeName ? " (you)" : ""}
                </Heading>
              </Box>
            </Flex>
          </Flex>
        </CardHeader>
        <CardBody>
          <RadioGroup value={selectedPeers[props.peer]}>
            <Stack spacing={2} direction="column">
              {Object.keys(nadaParsed).map((option) => (
                <Radio
                  key={`binding-${props.peer}-${option}`}
                  value={option}
                  onChange={() => handleRadioChange(option, props.peer)}
                >
                  {nadaParsed[option].partyname}
                </Radio>
              ))}
            </Stack>
          </RadioGroup>
        </CardBody>
      </Card>
    );
  };

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <Stack spacing={4} direction={"column"}>
          {globalError && (
            <Alert
              status="error"
              variant="subtle"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
            >
              <AlertIcon />
              <Box>
                <AlertTitle mt={4} mb={1} fontSize="lg">
                  In Error State (restart required)
                </AlertTitle>
                <AlertDescription maxWidth="sm">
                  {globalError}
                </AlertDescription>
              </Box>
            </Alert>
          )}
          <Center>
            <Image
              alt="codeparty logo"
              className="null-pointer"
              width={500}
              height={200}
              src="/codeparty.png"
            />
          </Center>
          {!connectedToSnap && (
            <Center>
              <Button
                onClick={connectAndCallSnap}
              >
                🚀 Connect to Nillion & Fund Session 💸
              </Button>
            </Center>
          )}
        </Stack>

        <div className="px-5">
          <div>
            {userKey && (
              <Box flex="1" py={5}>
                <Card variant={"outline"}>
                  <CardHeader>
                    <Heading size="xs">Waiting Room</Heading>
                  </CardHeader>
                  <CardBody>
                    <AvatarGroup size="md" max={2}>
                      {Object.keys(partyState?.peers).map((peer) => (
                        <Avatar name={peer} />
                      ))}
                    </AvatarGroup>
                  </CardBody>
                  <Divider />

                  <CardFooter justify="right">
                    <Button
                      bgGradient="linear(to-r, red.500, orange.500, yellow.500, green.500, blue.500, purple.500, pink.500)"
                      color="white"
                      onClick={onOpen}
                    >
                      Start a Party
                    </Button>
                  </CardFooter>
                </Card>
              </Box>
            )}

            {partyState && (
              <Modal
                size={"full"}
                isOpen={partyState && isOpen}
                onClose={closeCodeModal}
              >
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>
                    <Stepper size="lg" index={activeStep}>
                      {steps.map((step, index) => (
                        <Step
                          key={index}
                        >
                          <StepIndicator>
                            <StepStatus
                              complete={<StepIcon />}
                              incomplete={<StepNumber />}
                              active={<StepNumber />}
                            />
                          </StepIndicator>

                          <Box flexShrink="0">
                            <StepTitle>{step.title}</StepTitle>
                            <StepDescription>
                              {step.description}
                            </StepDescription>
                          </Box>

                          <StepSeparator />
                        </Step>
                      ))}
                    </Stepper>
                  </ModalHeader>
                  <ModalBody>
                    <Heading as="h4" size="sm">Paste Your Party Code</Heading>
                    <Badge variant="subtle" colorScheme="blue">
                      <ChakraLink
                        href="https://docs.nillion.com/nada-lang"
                        isExternal
                      >
                        [docs]
                      </ChakraLink>
                    </Badge>
                    <Stack spacing={5} direction="column">
                      {(partyButtonBusy || activeStep !== 0) && (
                        <Alert status="warning">
                          <AlertIcon />
                          🔒 Editor Locked 🔒
                        </Alert>
                      )}
                      <CodeMirror
                        value={nadalang}
                        height="300px"
                        extensions={[python()]}
                        readOnly={partyButtonBusy || activeStep !== 0}
                        onChange={onNadalangChange}
                        theme={monokai}
                      />
                      {codeError && (
                        <Alert status="error">
                          <AlertIcon />
                          <Box>
                            <AlertTitle py={4} fontSize="lg">
                              There was an error compiling your program
                            </AlertTitle>
                            <AlertDescription maxWidth="sm">
                              {codeError}
                            </AlertDescription>
                          </Box>
                        </Alert>
                      )}

                      <Accordion index={activeStep - 1}>
                        <AccordionItem isDisabled={activeStep !== 1}>
                          <h2>
                            <AccordionButton>
                              <Box as="span" flex="1" textAlign="left">
                                Select Peers
                              </Box>
                            </AccordionButton>
                          </h2>
                          {activeStep === 1 && (
                            <AccordionPanel pb={4}>
                              {peerBindingConflict &&
                                (
                                  <Box py={2}>
                                    <Alert status="error">
                                      <AlertIcon />
                                      <Box>
                                        Peers can't share party names
                                      </Box>
                                    </Alert>
                                  </Box>
                                )}
                              {peerToPartiesConflict &&
                                (
                                  <Box py={2}>
                                    <Alert status="warning">
                                      <AlertIcon />
                                      <Box>
                                        All parties must be bound to a peer
                                      </Box>
                                    </Alert>
                                  </Box>
                                )}
                              <SimpleGrid
                                spacing={4}
                                templateColumns="repeat(auto-fill, minmax(300px, 1fr))"
                              >
                                {Object.keys(partyState?.peers).map(
                                  (peer, idx) => {
                                    return (
                                      <>
                                        <Stack spacing={2} direction="row">
                                          <PeerButton
                                            key={peer}
                                            peer={peer}
                                            idx={idx}
                                          />
                                        </Stack>
                                      </>
                                    );
                                  },
                                )}
                              </SimpleGrid>
                            </AccordionPanel>
                          )}
                        </AccordionItem>

                        <AccordionItem isDisabled={activeStep !== 2}>
                          <h2>
                            <AccordionButton>
                              <Box as="span" flex="1" textAlign="left">
                                Execute Program
                              </Box>
                            </AccordionButton>
                          </h2>
                          {activeStep === 2 && (
                            <AccordionPanel pb={4}>
                              <Box flex="1" py={5}>
                                <Card variant={"outline"}>
                                  <CardHeader>
                                    <Heading size="xs">
                                      Waiting for peer contribution
                                    </Heading>
                                  </CardHeader>
                                  <CardBody>
                                    <TableContainer>
                                      <Table variant="simple" size={"sm"}>
                                        <Tbody>
                                          {Object.keys(selectedPeers).map(
                                            (peer) => (
                                              <Tr>
                                                <Td>
                                                  <Tag
                                                    size="lg"
                                                    colorScheme={partyResultsColor(
                                                      partyResults,
                                                      peer,
                                                    )}
                                                    borderRadius="full"
                                                  >
                                                    <Avatar
                                                      size="xs"
                                                      name={peer}
                                                      ml={-1}
                                                      mr={2}
                                                    />
                                                    <TagLabel>
                                                      {peer}
                                                    </TagLabel>
                                                  </Tag>
                                                </Td>
                                                <Td>
                                                  {(partyResults &&
                                                    peer in partyResults)
                                                    ? partyResults[peer]
                                                      .status
                                                    : (
                                                      <Progress
                                                        size="md"
                                                        isIndeterminate
                                                      />
                                                    )}
                                                </Td>
                                              </Tr>
                                            ),
                                          )}
                                        </Tbody>
                                      </Table>
                                    </TableContainer>
                                  </CardBody>
                                </Card>
                              </Box>
                            </AccordionPanel>
                          )}
                        </AccordionItem>
                      </Accordion>
                    </Stack>
                  </ModalBody>

                  <ModalFooter>
                    <Button
                      colorScheme="blue"
                      mr={3}
                      isLoading={partyButtonBusy}
                      // isDisabled={peerBindingConflict || peerToPartiesConflict}
                      loadingText="Working..."
                      onClick={steps[activeStep].onClick}
                    >
                      {steps[activeStep].description} »
                    </Button>
                    <Button onClick={onClose} variant="ghost">Abort</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            )}
          </div>

          {partyQueue && (
            <Modal
              size={"3xl"}
              motionPreset={"slideInBottom"}
              isOpen={contribFormIsOpen}
              onClose={contribFormOnClose}
            >
              <ModalOverlay />
              <ModalContent>
                <ModalHeader>
                  Contribute to{"  "}
                  <Text as="span" color="blue.500">
                    {partyQueue.owner}
                    {"'s "}
                  </Text>
                  CodeParty!
                </ModalHeader>
                <ModalBody>
                  <Heading fontFamily="monospace" as="h4" size="sm">
                    You are{" "}
                    <Text as="span" color="blue.500">
                      {partyQueue.partyname}
                      {" "}
                    </Text>
                    of programid{"  "}
                    <Text as="span" color="blue.500">
                      {partyQueue.programid}
                    </Text>
                  </Heading>
                  {contribError && (
                    <Box py={2}>
                      <Alert status="error">
                        <AlertIcon />
                        <Box>
                          <AlertTitle mt={4} mb={1} fontSize="lg">
                            There was an error submitting your input
                          </AlertTitle>
                          <AlertDescription maxWidth="sm">
                            {contribError}
                          </AlertDescription>
                        </Box>
                      </Alert>
                    </Box>
                  )}
                  <Stack spacing={5} direction="column">
                    <InputGroup>
                      <InputLeftAddon>
                        {partyQueue.inputs[0]
                          .type}
                      </InputLeftAddon>

                      {partyQueue.inputs[0]
                        .type === "SecretInteger"
                        ? (
                          <NumberInput>
                            <NumberInputField
                              size="lg"
                              onChange={onPartyContrib}
                            />
                          </NumberInput>
                        )
                        : <Input size="lg" onChange={onPartyContrib} />}
                    </InputGroup>
                  </Stack>
                </ModalBody>

                <ModalFooter>
                  <Button
                    colorScheme="blue"
                    mr={3}
                    isLoading={contribButtonBusy}
                    onClick={onSubmitContrib}
                  >
                    Go!
                  </Button>
                  <Button onClick={contribFormOnClose} variant="ghost">
                    Abort
                  </Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          )}

          {connectedToSnap && (
            <TableContainer py={10}>
              <Table variant="striped">
                <Tbody>
                  <Tr>
                    <Td>Metamask Connected Address</Td>
                    <Td>
                      <Address address={mmAddress} />
                    </Td>
                  </Tr>
                  <Tr>
                    <Td>Dynamic Testnet Address</Td>
                    <Td>
                      <Address address={dynAddress} />
                    </Td>
                  </Tr>
                  <Tr>
                    <Td>Nillion User Key</Td>
                    <Td>
                      {shortenKeyHelper(userKey)}
                      <CopyToClipboard text={userKey}>
                        <DocumentDuplicateIcon
                          className="ml-1.5 text-xl font-normal text-sky-600 h-5 w-5 cursor-pointer"
                          aria-hidden="true"
                        />
                      </CopyToClipboard>
                    </Td>
                  </Tr>
                  <Tr>
                    <Td>Your Code Name</Td>
                    <Td>
                      {codeName}
                      <CopyToClipboard text={codeName}>
                        <DocumentDuplicateIcon
                          className="ml-1.5 text-xl font-normal text-sky-600 h-5 w-5 cursor-pointer"
                          aria-hidden="true"
                        />
                      </CopyToClipboard>
                    </Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </div>

        {!connectedToSnap
          ? (
            <div className="flex-grow bg-base-300 w-full mt-16 px-8 py-12">
              <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
                <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-m rounded-3xl">
                  <MagnifyingGlassIcon className="h-8 w-8 fill-secondary" />
                  <p>
                    To connect with your Nillion user key...
                    <ol className="block my-4">
                      <li>
                        - Download the MetaMask Flask browser extension to get
                        access to MetaMask Snap
                      </li>
                      <li>
                        - Visit{" "}
                        <Link
                          href="https://github.com/nillion-oss/nillion-snap"
                          target="_blank"
                          passHref
                          className="link"
                        >
                          Nillion Key Management UI
                        </Link>{" "}
                        to generate a user key
                      </li>
                      <li>- Come back and connect to the snap</li>
                    </ol>
                  </p>
                </div>
              </div>
            </div>
          )
          : (
            <>
              <Accordion allowToggle>
                <AccordionItem>
                  <h2>
                    <AccordionButton>
                      <Box as="span" flex="1" textAlign="left">
                        Party Baseline Configuration
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h2>
                  <AccordionPanel pb={4}>
                    <Code>
                      You are connected as {codeName} : {userKey}
                    </Code>
                    <Divider py={2} />
                    <Code>
                      {JSON.stringify(partyState, null, 4)}
                    </Code>
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </>
          )}
      </div>
    </>
  );
};

export default Home;
