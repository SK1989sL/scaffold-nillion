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
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Center,
  Checkbox,
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
  Text,
  useDisclosure,
  useSteps,
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

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { partyState, partyQueue, dispatch } = usePartyBackend();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: formIsOpen, onOpen: formOnOpen, onClose: formOnClose } =
    useDisclosure();
  const [programId, setProgramId] = useState<string | null>(null);
  const [codePartyBindings, setCodePartyBindings] = useState<
    NillionType.CodePartyBindings
  >([]);

  const onStartParty = async () => {
    try {
      const partyPeople = Object.keys(selectedPeers).filter((p) =>
        selectedPeers[p]
      );
      console.log(
        `starting this party with ${JSON.stringify(partyPeople, null, 4)}`,
      );

      dispatch({
        type: "codeparty",
        payload: { peers: partyPeople, programid: result.programid },
      });
      closeCodeModal();
    } catch (error) {
      console.error("Error posting program: ", error);
      setCodeError(`server error: ${error}`);
      setPartyButtonBusy(undefined);
      return;
    }
  };

  const onAssignPeerBindings = async () => {
    try {
      const bindingInit: NillionType.CodePartyBindings = Object.keys(
        selectedPeers,
      ).reduce((acc, p) => {
        acc[
          partyState.peers[p].peerid
        ] = {
          peerid: partyState.peers[p].peerid,
          codepartyid: partyState.peers[p].codepartyid,
          programid: programId,
          owner: codeName,
          ...nadaParsed[selectedPeers[p]],
        };
        return acc;
      }, {});

      dispatch({
        type: "codeparty",
        payload: bindingInit,
      });
      setActiveStep(2);
      setCodePartyBindings(bindingInit);
      console.log(
        `starting this party with ${JSON.stringify(partyPeople, null, 4)}`,
      );
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
      setActiveStep(1);
      setProgramId(result.programid);
    } catch (error) {
      console.error("Error posting program: ", error);
      setCodeError(`server error: ${error}`);
      return;
    } finally {
      setPartyButtonBusy(undefined);
    }
  };

  const steps = [
    { title: "First", description: "Upload Program", onClick: onSubmitCode },
    {
      title: "Second",
      description: "Select Peers",
      onClick: onAssignPeerBindings,
    },
    { title: "Third", description: "Execute Program", onClick: null },
  ];
  const { activeStep, setActiveStep } = useSteps({
    index: 0,
    count: steps.length,
  });

  const [connectedToSnap, setConnectedToSnap] = useState<boolean>(false);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [codeName, setCodeName] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [contribError, setContribError] = useState<string | null>(null);

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
  const [nillion, setNillion] = useState(null);
  const [nadaParsed, setNadaParsed] = useState<
    NillionType.ProgramExtracts | null
  >(null);

  // var accounts = await web3.eth.getAccounts();
  // web3.eth.getBalance("0x407d73d8a49eeb85d32cf465507dd71d507100c1")

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
    const task = partyQueue[partyState.peers[codeName].peerid];
    try {
      console.log(
        `starting submit to Nillion Network: ${JSON.stringify(task, null, 4)}`,
      );
      const binding = new nillion.ProgramBindings(
        task.programid,
      );
      const party_id = await client.party_id();
      binding.add_input_party(task.partyname, party_id);

      const my_secrets = new nillion.Secrets();

      if (task.inputs[0].type === "SecretInteger") {
        console.log(
          `storing unsignedinteger`,
        );
        const encoded = await nillion.encode_unsigned_integer_secret(
          task.inputs[0].name,
          { as_string: String(partyContrib) },
        );
        await my_secrets.insert(encoded);
        await client.store_secrets(
          partyState.config.cluster_id,
          my_secrets,
          binding,
        );
      } else {
        console.log(`storing blob`);
        const encoded = await nillion.encode_unsigned_integer_secret(
          task.inputs[0].name,
          { as_string: String(partyContrib) },
        );
        await my_secrets.insert(encoded);
        await client.store_secrets(
          partyState.config.cluster_id,
          my_secrets,
          binding,
        );
      }
      dispatch({
        type: "contrib",
        payload: { peerid: userKey, status: "ok" },
      });
    } catch (error) {
      console.error("Error storing program secret: ", error);
      setContribError(`network error: ${error}`);
      dispatch({
        type: "contrib",
        payload: { peerid: userKey, status: "error" },
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
    const extractedPartyNames = /(\w+)\s=\s*Party\(\s*name\s*=\s*"(\w+)"/gm;
    const nadaextracts = {};
    let match;
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

    console.log(`nada extracts: `);
    console.log(JSON.stringify(nadaextracts, null, 4));
    setNadaParsed(nadaextracts);
  }, [programId, nadalang]);

  useEffect(() => {
    if ((partyQueue === null) || (userKey === null)) return;
    if (userKey in partyQueue) {
      console.log(`you're a selected party member!`);
      formOnOpen();
    }
  }, [partyQueue, userKey]);

  useEffect(() => {
    if (!userKey) return;
    const myName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: "-",
      seed: userKey,
    });

    console.log(`Your codename is : ${myName}`);
    setCodeName(myName);
    console.log(partyState?.config.payments_config.rpc_endpoint);
    const web3 = new Web3(partyState?.config.payments_config.rpc_endpoint);
    const account = web3.eth.accounts.create();

    (async () => {
      console.log(
        `posting dynamic wallet [${account.address}] to faucet webservice`,
      );
      const url = `${backend}/faucet/${account.address}`;
      const response = await fetch(url, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      console.log(`got faucet response: ${JSON.stringify(result, null, 4)}`);
      if (result?.statusCode !== 200) {
        setCodeError(result?.error);
        setPartyButtonBusy(null);
        return;
      }

      console.log(`using dynamic wallet in nillion client`);

      const _nillion = await import("@nillion/nillion-client-js-browser");
      await _nillion.default();

      const nodekey = _nillion.NodeKey.from_seed(
        `test-seed-10`,
      );
      const _userkey = _nillion.UserKey.from_base58(userKey);
      const payments_config = partyState?.config.payments_config;
      const pkWithout0x = account.privateKey.replace(/^0x/, "");
      payments_config.signer.wallet["private_key"] = pkWithout0x;
      console.log(`using payments_config: ${JSON.stringify(payments_config, null, 4)}`);
      const _client = new _nillion.NillionClient(
        _userkey,
        nodekey,
        partyState?.config.bootnodes,
        false,
        payments_config,
      );

      const status = await _client.cluster_information(partyState?.config.cluster_id);
      console.log(JSON.stringify(
        status,
        null,
        4,
      ));
      setClient(_client);
      setNillion(_nillion);

      dispatch({
        type: "register",
        payload: { handle: myName, peerid: userKey },
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

  console.log(`activeStep: ${activeStep}`);
  console.log(`parsed: `);
  console.log(JSON.stringify(nadaParsed, null, 4));
  console.log(`selectedPeers: `);
  console.log(JSON.stringify(selectedPeers, null, 4));

  const peerBindingConflict = new Set(Object.values(selectedPeers)).size !==
    Object.values(selectedPeers).length;

  const peerToPartiesConflict =
    Object.keys(selectedPeers).length !== Object.keys(nadaParsed ?? {}).length;
  console.log(`codeparty init?:`);
  console.log(JSON.stringify(codePartyBindings, null, 4));

  console.log(`codeparty queue?:`);
  console.log(JSON.stringify(partyQueue, null, 4));

  console.log(`codeparty contrib?:`);
  console.log(JSON.stringify(partyContrib, null, 4));

  partyQueue && console.log(
    JSON.stringify(partyQueue[partyState.peers[codeName].peerid], null, 4),
  );

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
        <div className="px-5">
          <h1 className="text-center">
            <Image
              alt="codeparty logo"
              className="null-pointer"
              width={500}
              height={200}
              src="/codeparty.png"
            />
            {!connectedToSnap && (
              <button
                className="btn btn-sm btn-primary mt-4"
                onClick={connectAndCallSnap}
              >
                Connect to Snap
              </button>
            )}
          </h1>

          <div>
            {userKey && (
              <Center>
                <Button onClick={onOpen}>Start a Party</Button>
              </Center>
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
                        href="https://docs.nillion.com/nada-lang-framework"
                        isExternal
                      >
                        [docs]
                      </ChakraLink>
                    </Badge>
                    <Stack spacing={5} direction="column">
                      {(partyButtonBusy || activeStep !== 0) && (
                        <Alert status="warning">
                          <AlertIcon />
                          Editor Locked
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
                            <AlertTitle mt={4} mb={1} fontSize="lg">
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
                                  <Box m={2}>
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
                                  <Box m={2}>
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
                              This is a test
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
                      isDisabled={peerBindingConflict || peerToPartiesConflict}
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
              isOpen={formIsOpen}
              onClose={formOnClose}
            >
              <ModalOverlay />
              <ModalContent>
                <ModalHeader>
                  Contribute to{"  "}
                  <Text as="span" color="blue.500">
                    {partyQueue[partyState.peers[codeName].peerid].owner}
                    {"'s "}
                  </Text>
                  CodeParty!
                </ModalHeader>
                <ModalBody>
                  <Heading fontFamily="monospace" as="h4" size="sm">
                    You are{" "}
                    <Text as="span" color="blue.500">
                      {partyQueue[partyState.peers[codeName].peerid].partyname}
                      {" "}
                    </Text>
                    of programid{"  "}
                    <Text as="span" color="blue.500">
                      {partyQueue[partyState.peers[codeName].peerid].programid}
                    </Text>
                  </Heading>
                  {contribError && (
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
                  )}
                  <Stack spacing={5} direction="column">
                    <InputGroup>
                      <InputLeftAddon>
                        {partyQueue[partyState.peers[codeName].peerid].inputs[0]
                          .type}
                      </InputLeftAddon>

                      {partyQueue[partyState.peers[codeName].peerid].inputs[0]
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
                    onClick={onSubmitContrib}
                  >
                    Go!
                  </Button>
                  <Button onClick={formOnClose} variant="ghost">Abort</Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          )}

          {connectedToSnap && (
            <div>
              <div className="flex justify-center items-center space-x-2">
                <p className="my-2 font-medium">Connected Address:</p>
                <Address address={connectedAddress} />
              </div>

              <div className="flex justify-center items-center space-x-2">
                <p className="my-2 font-medium">Connected Nillion User Key:</p>
                {userKey && (
                  <span className="flex">
                    {shortenKeyHelper(userKey)}
                    <CopyToClipboard text={userKey}>
                      <DocumentDuplicateIcon
                        className="ml-1.5 text-xl font-normal text-sky-600 h-5 w-5 cursor-pointer"
                        aria-hidden="true"
                      />
                    </CopyToClipboard>
                  </span>
                )}
              </div>

              <div className="flex justify-center items-center space-x-2">
                <p className="my-2 font-medium">Code Name:</p>
                {codeName && (
                  <span className="flex">
                    {codeName}
                    <CopyToClipboard text={codeName}>
                      <DocumentDuplicateIcon
                        className="ml-1.5 text-xl font-normal text-sky-600 h-5 w-5 cursor-pointer"
                        aria-hidden="true"
                      />
                    </CopyToClipboard>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
            {!connectedToSnap
              ? (
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
              )
              : (
                <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-m rounded-3xl">
                  Connected as {codeName} : {userKey}
                  <hr />
                  <Text as="kbd" align="left">
                    {JSON.stringify(partyState, null, 4)}
                  </Text>
                </div>
              )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
