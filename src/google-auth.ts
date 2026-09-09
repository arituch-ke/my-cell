import { readFile, writeFile } from "node:fs/promises";
import { google } from "googleapis";
import type { Config } from "./config.js";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive"
];

export async function createGoogleAuth(config: Config) {
  if (config.GOOGLE_AUTH_MODE === "service_account") {
    return new google.auth.GoogleAuth({
      keyFile: config.GOOGLE_SERVICE_ACCOUNT_FILE,
      scopes: GOOGLE_SCOPES
    });
  }

  try {
    const token = JSON.parse(await readFile(config.GOOGLE_OAUTH_TOKEN_FILE, "utf8"));
    if (!token.client_id || !token.client_secret || !token.refresh_token) {
      throw new Error(`Invalid Google OAuth token file: ${config.GOOGLE_OAUTH_TOKEN_FILE}`);
    }
    const client = new google.auth.OAuth2(token.client_id, token.client_secret);
    client.setCredentials({ refresh_token: token.refresh_token });
    return client;
  } catch (error) {
    if (isMissingFile(error)) {
      throw new Error(
        `Google OAuth token not found at ${config.GOOGLE_OAUTH_TOKEN_FILE}. Run: npm run google-auth`
      );
    }
    throw error;
  }
}

export async function saveOAuthCredentials(
  client: { credentials: { refresh_token?: string | null } },
  clientFile: string,
  tokenFile: string
): Promise<void> {
  const source = JSON.parse(await readFile(clientFile, "utf8"));
  const credentials = source.installed ?? source.web;
  if (!credentials?.client_id || !credentials?.client_secret) {
    throw new Error("OAuth client JSON is invalid; create a Desktop app OAuth client in Google Cloud");
  }
  if (!client.credentials.refresh_token) {
    throw new Error("Google did not return a refresh token; revoke the app grant and authorize again");
  }

  await writeFile(
    tokenFile,
    JSON.stringify({
      type: "authorized_user",
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: client.credentials.refresh_token
    }, null, 2),
    { mode: 0o600 }
  );
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
