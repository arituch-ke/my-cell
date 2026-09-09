import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DISCORD_TOKEN: z.string().trim().min(1),
  DISCORD_CHANNEL_ID: z.string().trim().min(1),
  GOOGLE_SPREADSHEET_ID: z.string().trim().min(1),
  GOOGLE_SHEET_NAME: z.string().trim().min(1).default("Sheet1"),
  GOOGLE_DRIVE_FOLDER_ID: z.string().trim().min(1),
  GOOGLE_AUTH_MODE: z.enum(["oauth", "service_account"]).default("service_account"),
  GOOGLE_SERVICE_ACCOUNT_FILE: z.string().trim().min(1).default("./service-account.json"),
  GOOGLE_OAUTH_CLIENT_FILE: z.string().trim().min(1).default("./oauth-client.json"),
  GOOGLE_OAUTH_TOKEN_FILE: z.string().trim().min(1).default("./google-token.json"),
  TIME_ZONE: z.string().trim().min(1).default("Asia/Bangkok"),
  START_ROW: z.coerce.number().int().positive().default(3),
  IMAGE_ROW_HEIGHT: z.coerce.number().int().min(40).max(1000).default(300)
});

export type Config = z.infer<typeof schema>;

export function loadConfig(): Config {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}`);
  }
  return result.data;
}
