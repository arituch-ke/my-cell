import { authenticate } from "@google-cloud/local-auth";
import { loadConfig } from "./config.js";
import { GOOGLE_SCOPES, saveOAuthCredentials } from "./google-auth.js";

const config = loadConfig();
const client = await authenticate({
  scopes: GOOGLE_SCOPES,
  keyfilePath: config.GOOGLE_OAUTH_CLIENT_FILE
});

await saveOAuthCredentials(
  client,
  config.GOOGLE_OAUTH_CLIENT_FILE,
  config.GOOGLE_OAUTH_TOKEN_FILE
);

console.log(`Google authorization saved to ${config.GOOGLE_OAUTH_TOKEN_FILE}`);
