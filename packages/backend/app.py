import json
import os
import py_nillion_client
import serverless_wsgi
import subprocess
import tempfile

from flask import Flask, jsonify, request
from flask_cors import CORS


NILLION_CLUSTER_CONFIG = "/var/task/remote.json"
BIN_CAST = "/root/.foundry/bin/cast"
BIN_PYNADAC = "/var/task/pynadac"

NILLION_FAUCET_PK = os.environ["NILLION_FAUCET_PK"]
NILLION_SERVICE_PK = os.environ["NILLION_SERVICE_PK"]
NILLION_NODE_SEED = os.environ.get("NILLION_NODE_SEED", "test-seed-0")

with open(NILLION_CLUSTER_CONFIG, "r") as fp:
    config = json.load(fp)
    config["payments_config"]["signer"]["wallet"]["private_key"] = NILLION_SERVICE_PK

app = Flask(__name__)
CORS(app)


@app.route("/upload-nada-source/<program_name>", methods=["POST"])
async def upload_nada_source(program_name):
    source = request.data.decode("utf-8")

    with tempfile.NamedTemporaryFile(
        mode="w", dir="/tmp", suffix=".py", delete=False
    ) as temp_file:
        temp_file.write(source)

    try:
        subprocess.run([BIN_PYNADAC, temp_file.name], capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        error_message = f"pynadac execution failed: {e.returncode}, {e.stderr}"
        return jsonify({"statusCode": 500, "body": {"error": error_message}})

    compiled_program = os.path.splitext(temp_file.name)[0] + ".nada.bin"

    nodekey = py_nillion_client.NodeKey.from_seed(NILLION_NODE_SEED)
    userkey = py_nillion_client.UserKey.generate()
    client = py_nillion_client.NillionClient(
        nodekey,
        config.bootnodes,
        py_nillion_client.ConnectionMode.relay(),
        userkey,
        config.payments_config,
    )

    result = await client.store_program(
        config.cluster_id, program_name, compiled_program
    )
    return jsonify({"statusCode": 200, "body": {"message": result}})


@app.route("/faucet/<address>", methods=["POST"])
def faucet(address):

    try:
        subprocess.run(
            [
                BIN_CAST,
                "send",
                "--private-key",
                NILLION_FAUCET_PK,
                "--rpc-url",
                "https://rpc-endpoint.testnet-fe.nilogy.xyz",
                address,
                "--value",
                "10ether",
            ],
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        error_message = f"pynadac execution failed: {e.returncode}, {e.stderr}"
        return jsonify({"statusCode": 500, "body": {"error": error_message}})

    return jsonify({"statusCode": 200, "body": {"message": "OK"}})


def handler(event, context):
    return serverless_wsgi.handle_request(app, event, context)
