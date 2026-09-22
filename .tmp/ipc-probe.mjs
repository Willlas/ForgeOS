import { readFileSync } from "node:fs";
import { IpcClient } from "../packages/cli/dist/ipc-client.js";
import { IPCCommand } from "@aer/runtime-lib";

const [command, payloadFile] = process.argv.slice(2);
const payload = payloadFile ? JSON.parse(readFileSync(payloadFile, "utf8")) : undefined;

const client = new IpcClient();
try {
  await client.connect();
  console.log("session handshake OK, session:", client.session);
  const resp = await client.call(IPCCommand[command] ?? command, payload);
  console.log(JSON.stringify(resp, null, 2));
} catch (err) {
  console.log("REJECTED:", JSON.stringify(err, null, 2));
  process.exitCode = 1;
} finally {
  client.disconnect();
}