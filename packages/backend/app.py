import base64
import json
import os
import py_nillion_client
import serverless_wsgi
import subprocess
import tempfile
from waterbear import Bear

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
    config = Bear(**config)

app = Flask(__name__)
CORS(app)


@app.route("/upload-nada-source/<program_name>", methods=["POST"])
async def upload_nada_source(program_name):
    data = request.get_json()
    base64_nadasource = data["nadalang"]
    source = base64.b64decode(base64_nadasource).decode("utf-8")

    with tempfile.NamedTemporaryFile(
        mode="w", dir="/tmp", suffix=".py", delete=False
    ) as temp_file:
        temp_file.write(source)

    target_dir = os.path.dirname(temp_file.name)
    try:
        result = subprocess.run(
            [BIN_PYNADAC, "--target-dir", target_dir, temp_file.name],
            capture_output=True,
            text=True,
        )
        if "failed" in result.stderr.lower():
            raise Exception("|".join([result.stderr, result.stdout]))
    except Exception as e:
        error_message = f"pynadac execution failed: [{e}]"
        return jsonify({"statusCode": 400, "error": error_message})

    only_file_name = os.path.basename(temp_file.name)
    compiled_name = os.path.splitext(only_file_name)[0] + ".nada.bin"
    compiled_program = os.path.join(target_dir, compiled_name)

    payments_config = py_nillion_client.PaymentsConfig(
        config.payments_config.rpc_endpoint,
        NILLION_SERVICE_PK,
        int(config.payments_config.signer.wallet.chain_id),
        config.payments_config.smart_contract_addresses.payments,
        config.payments_config.smart_contract_addresses.blinding_factors_manager,
    )

    nodekey = py_nillion_client.NodeKey.from_seed(NILLION_NODE_SEED)
    userkey = py_nillion_client.UserKey.generate()
    client = py_nillion_client.NillionClient(
        nodekey,
        config.bootnodes,
        py_nillion_client.ConnectionMode.relay(),
        userkey,
        payments_config,
    )

    result = await client.store_program(
        config.cluster_id, program_name, compiled_program
    )
    return jsonify({"statusCode": 200, "programid": result})


@app.route("/faucet/<address>", methods=["POST"])
def faucet(address):

    print(f"starting faucet for address {address}")
    try:
        result = subprocess.run(
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
            shell=True,
        )
        if "failed" in result.stderr.lower():
            raise Exception("|".join([result.stderr, result.stdout]))
    except Exception as e:
        error_message = f"pynadac execution failed: {e}"
        return jsonify({"statusCode": 400, "error": error_message})

    return jsonify({"statusCode": 200, "message": "OK"})


def handler(event, context):
    return serverless_wsgi.handle_request(app, event, context)
