"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NextPage } from "next";
import CopyToClipboard from "react-copy-to-clipboard";
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

import { Address } from "~~/components/scaffold-eth";
import { usePartyBackend } from "~~/hooks/nillion";
import { shortenKeyHelper } from "~~/utils/scaffold-eth";

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ background: "white", padding: 20 }}>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const { partyState, dispatch } = usePartyBackend();

  const [connectedToSnap, setConnectedToSnap] = useState<boolean>(false);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [codeName, setCodeName] = useState<string | null>(null);
  const [client, setClient] = useState(null);
  const [nillion, setNillion] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(true);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
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
    // privateKey, address
    console.log(`TODO: posting [${account.address}] to faucet webservice`);
    console.log(`TODO: using [${account.privateKey}] in nillion client`);

    (async () => {
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

      dispatch({ type: "register", user: { handle: myName, peerid: userKey } });
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
                  <pre>{JSON.stringify(partyState, null, 4)}</pre>
                </div>
              )}
          </div>
        </div>
      </div>
      <div>
        <button onClick={openModal}>Open Modal</button>
        <Modal isOpen={isModalOpen} onClose={closeModal}>
          <p>This is the modal content!</p>
        </Modal>
      </div>
    </>
  );
};

export default Home;
