import {
  Client,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits,
  type Attachment,
  type Message,
  type PartialMessage
} from "discord.js";
import { loadConfig } from "./config.js";
import { GoogleSheetStore, type ImageInput } from "./google.js";
import { parseMessage, plateLabels } from "./message-parser.js";

const config = loadConfig();
const store = await GoogleSheetStore.create(config);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot ready as ${readyClient.user.tag}`);
  try {
    const channel = await readyClient.channels.fetch(config.DISCORD_CHANNEL_ID);
    if (!channel?.isTextBased()) {
      console.error(`Configured channel ${config.DISCORD_CHANNEL_ID} was not found or is not a text channel`);
      return;
    }
    console.log(`Watching Discord channel: ${"name" in channel ? channel.name : channel.id} (${channel.id})`);
    if ("permissionsFor" in channel) {
      const permissions = channel.permissionsFor(readyClient.user);
      const required = [
        [PermissionFlagsBits.ViewChannel, "View Channel"],
        [PermissionFlagsBits.SendMessages, "Send Messages"],
        [PermissionFlagsBits.ReadMessageHistory, "Read Message History"],
        [PermissionFlagsBits.AddReactions, "Add Reactions"]
      ] as const;
      const missing = required.filter(([flag]) => !permissions?.has(flag)).map(([, name]) => name);
      console.log(missing.length ? `Missing channel permissions: ${missing.join(", ")}` : "Channel permissions: OK");
    }
  } catch (error) {
    console.error(`Cannot access configured Discord channel ${config.DISCORD_CHANNEL_ID}`, error);
  }
});

let processingQueue = Promise.resolve();

client.on(Events.MessageCreate, (message) => enqueueMessage(message, "created"));
client.on(Events.MessageUpdate, async (_oldMessage, updatedMessage) => {
  const message = updatedMessage.partial ? await updatedMessage.fetch() : updatedMessage;
  enqueueMessage(message, "updated");
});

client.on(Events.Error, (error) => console.error("Discord client error", error));
client.on(Events.Warn, (warning) => console.warn("Discord warning", warning));

function enqueueMessage(message: Message | PartialMessage, event: "created" | "updated"): void {
  if (!message.author || message.author.bot) return;
  if (message.channelId !== config.DISCORD_CHANNEL_ID) {
    console.log(`Ignored message ${message.id} from channel ${message.channelId}`);
    return;
  }

  console.log(`Received ${event} message ${message.id} with ${message.attachments.size} attachment(s)`);

  const attachments = [...message.attachments.values()].filter(isImage);
  if (attachments.length !== 3) {
    void message.reply(`กรุณาแนบรูปภาพให้ครบ 3 รูป (พบ ${attachments.length} รูป)`);
    return;
  }

  // Serialize writes so two Discord messages cannot select the same Sheet row.
  processingQueue = processingQueue
    .then(() => processMessage(message as Message, attachments as [Attachment, Attachment, Attachment]))
    .catch((error) => console.error("Unexpected queue failure", error));
}

async function processMessage(
  message: Message,
  attachments: [Attachment, Attachment, Attachment]
): Promise<void> {
  try {
    await message.react("⏳");
    const metadata = parseMessage(message.content);
    const images = await Promise.all(attachments.map(downloadImage)) as [ImageInput, ImageInput, ImageInput];
    const row = await store.append({
      date: message.createdAt,
      labels: plateLabels(metadata.hasSub),
      hasSub: metadata.hasSub,
      remark: metadata.remark,
      images,
      discordMessageId: message.id
    });
    await removeReaction(message, "⏳");
    await message.react("✅");
    await message.reply(`บันทึกลง Google Sheet แถว ${row} เรียบร้อยแล้ว`);
  } catch (error) {
    console.error("Failed to process Discord message", error);
    await removeReaction(message, "⏳");
    await message.react("❌").catch(() => undefined);
    await message.reply("บันทึกไม่สำเร็จ กรุณาตรวจสอบ log ของ bot แล้วลองใหม่อีกครั้ง");
  }
}

function isImage(attachment: Attachment): boolean {
  if (attachment.contentType?.startsWith("image/")) return true;
  return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(attachment.name ?? "");
}

async function downloadImage(attachment: Attachment): Promise<ImageInput> {
  const response = await fetch(attachment.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Image download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 25 * 1024 * 1024) throw new Error("Image is larger than 25 MB");
  return {
    bytes,
    contentType: attachment.contentType ?? "application/octet-stream",
    filename: attachment.name ?? `${attachment.id}.jpg`
  };
}

async function removeReaction(message: Message, emoji: string): Promise<void> {
  await message.reactions.resolve(emoji)?.users.remove(client.user?.id).catch(() => undefined);
}

await client.login(config.DISCORD_TOKEN);
