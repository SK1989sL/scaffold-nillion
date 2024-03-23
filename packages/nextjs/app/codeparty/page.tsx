"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NextPage } from "next";
import CopyToClipboard from "react-copy-to-clipboard";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";

import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Checkbox,
  Heading,
  Link as ChakraLink,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
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

import { InputBase } from "~~/components/scaffold-eth";
import { Address } from "~~/components/scaffold-eth";
import { usePartyBackend } from "~~/hooks/nillion";
import { shortenKeyHelper } from "~~/utils/scaffold-eth";

const backend = process.env.NEXT_PUBLIC_NILLION_BACKEND;

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { partyState, partyQueue, dispatch } = usePartyBackend();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [connectedToSnap, setConnectedToSnap] = useState<boolean>(false);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [codeName, setCodeName] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSubmitted, setCodeSubmitted] = useState<boolean | null>(null);
  const [selectedPeers, setSelectedPeers] = useState({});

  const [nadalang, setNadalang] = useState(`
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

  const [client, setClient] = useState(null);
  const [nillion, setNillion] = useState(null);

  const closeCodeModal = () => {
    setCodeError(null);
    setCodeSubmitted(null);
    onClose();
  };
  const onNadalangChange = useCallback((val, viewUpdate) => {
    setNadalang(val);
  }, []);

  const onStartParty = async () => {
    setCodeSubmitted(true);
    setCodeError(null);
    const partyPeople = Object.keys(selectedPeers).filter((p) =>
      selectedPeers[p]
    );
    console.log(
      `starting this party with ${JSON.stringify(partyPeople, null, 4)}`,
    );

    // await
    // https://ofnzkxpntb.execute-api.eu-west-1.amazonaws.com/testnet-fe/upload-nada-source
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
      if (!response.status === 200) {
        setCodeError(`server error`);
        setCodeSubmitted(null);
        return;
      }
      const result = await response.json();
      console.log(`got program response: ${JSON.stringify(result, null, 4)}`);
      if (result?.statusCode !== 200) {
        setCodeError(result?.error);
        setCodeSubmitted(null);
        return;
      }
      dispatch({
        type: "party",
        payload: { peers: partyPeople, programid: result.programid },
      });
      closeCodeModal();
    } catch (error) {
      console.error("Error posting program: ", error);
    }
  };

  const handleCheckboxChange = (event) => {
    const { name, checked } = event.target;
    setSelectedPeers((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  useEffect(() => {
    if (partyQueue === undefined) return;
    for (let codeparty in partyQueue) {
      if (codeName in codeparty.peers) {
        console.log(`you're a selected party member!`);
      }
    }
  }, [partyQueue, codeName]);
  useEffect(() => {
    if (!userKey) return;
    const myName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: "-",
      seed: userKey,
    });

    console.log(`Your codename is : ${myName}`);
    setCodeName(myName);
    console.log(partyState.config.payments_config.rpc_endpoint);
    const web3 = new Web3(partyState.config.payments_config.rpc_endpoint);
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
        setCodeSubmitted(null);
        return;
      }

      console.log(`using dynamic wallet in nillion client`);

      const _nillion = await import("@nillion/nillion-client-js-browser");
      await _nillion.default();

      const nodekey = _nillion.NodeKey.from_seed(
        `test-seed-${Object.keys(partyState).length}`,
      );
      const _userkey = _nillion.UserKey.from_base58(userKey);
      const payments_config = partyState.config.payments_config;
      payments_config.signer.wallet["private_key"] = account.privateKey;
      const _client = new _nillion.NillionClient(
        _userkey,
        nodekey,
        partyState.config.bootnodes,
        false,
        payments_config,
      );
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
            <Button onClick={onOpen}>Start a Party</Button>

            {partyState && (
              <Modal isOpen={partyState && isOpen} onClose={closeCodeModal}>
                <ModalOverlay />
                <ModalContent>
                  <ModalHeader>Let's Start a Code Party!</ModalHeader>
                  <ModalBody>
                    <Heading as="h4" size="sm">Paste Your Party Code</Heading>
                    <Text as="sub" align="left">
                      <ChakraLink
                        href="https://docs.nillion.com/nada-lang-framework"
                        isExternal
                      >
                        [docs]
                      </ChakraLink>
                    </Text>
                    <Stack spacing={5} direction="column">
                      <CodeMirror
                        value={nadalang}
                        height="200px"
                        extensions={[python()]}
                        onChange={onNadalangChange}
                      // theme={TODO}
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

                      <Heading as="h4" size="sm">
                        Select Your Party Peers
                      </Heading>
                      {Object.keys(partyState).filter((p) =>
                        p !== "config"
                      )
                        .map((
                          p,
                        ) => (
                          <Checkbox
                            key={`checkbox-${p}`}
                            name={p}
                            onChange={handleCheckboxChange}
                          >
                            {p}
                            {p === codeName ? " (you)" : ""}
                          </Checkbox>
                        ))}
                    </Stack>
                  </ModalBody>

                  <ModalFooter>
                    <Button
                      colorScheme="blue"
                      mr={3}
                      isLoading={codeSubmitted}
                      loadingText="Distributing"
                      onClick={onStartParty}
                    >
                      Party On!
                    </Button>
                    <Button onClick={onClose} variant="ghost">Abort</Button>
                  </ModalFooter>
                </ModalContent>
              </Modal>
            )}
          </div>
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
