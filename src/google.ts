import { Readable } from "node:stream";
import { google, sheets_v4 } from "googleapis";
import type { Config } from "./config.js";
import { createGoogleAuth } from "./google-auth.js";

export interface ImageInput {
  bytes: Buffer;
  contentType: string;
  filename: string;
}

export interface SheetRecord {
  date: Date;
  labels: [string, string, string];
  hasSub: boolean;
  remark: string | null;
  images: [ImageInput, ImageInput, ImageInput];
  discordMessageId: string;
}

export class GoogleSheetStore {
  private readonly sheets: sheets_v4.Sheets;
  private readonly drive;

  private constructor(private readonly config: Config, auth: Awaited<ReturnType<typeof createGoogleAuth>>) {
    this.sheets = google.sheets({ version: "v4", auth });
    this.drive = google.drive({ version: "v3", auth });
  }

  static async create(config: Config): Promise<GoogleSheetStore> {
    return new GoogleSheetStore(config, await createGoogleAuth(config));
  }

  async append(record: SheetRecord): Promise<number> {
    const existingRow = await this.findMessageRow(record.discordMessageId);
    if (existingRow !== null) return existingRow;

    const row = await this.findNextRow();
    const uploadedIds: string[] = [];

    try {
      for (const image of record.images) {
        uploadedIds.push(await this.uploadImage(image));
      }

      const dateFormula = this.dateFormula(record.date);
      const imageFormulas = uploadedIds.map(
        (id) => `=IMAGE("https://drive.google.com/uc?export=view&id=${id}",1)`
      );

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: [
            {
              range: `${quoteSheet(this.config.GOOGLE_SHEET_NAME)}!A${row}:G${row}`,
              values: [[
                dateFormula,
                ...record.labels,
                record.hasSub ? "Sub" : "",
                record.remark ?? "",
                record.discordMessageId
              ]]
            },
            {
              range: `${quoteSheet(this.config.GOOGLE_SHEET_NAME)}!B${row + 1}:D${row + 1}`,
              values: [imageFormulas]
            }
          ]
        }
      });

      await this.formatRows(row);
      return row;
    } catch (error) {
      await Promise.allSettled(uploadedIds.map((fileId) => this.drive.files.delete({ fileId })));
      throw error;
    }
  }

  private async findMessageRow(messageId: string): Promise<number | null> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      range: `${quoteSheet(this.config.GOOGLE_SHEET_NAME)}!G${this.config.START_ROW}:G`
    });
    const rows = response.data.values ?? [];
    const index = rows.findIndex((value) => value[0] === messageId);
    return index === -1 ? null : this.config.START_ROW + index;
  }

  private async findNextRow(): Promise<number> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      range: `${quoteSheet(this.config.GOOGLE_SHEET_NAME)}!A${this.config.START_ROW}:A`
    });
    const values = response.data.values ?? [];
    let row = this.config.START_ROW;
    while (values[row - this.config.START_ROW]?.[0]) row += 2;
    return row;
  }

  private async uploadImage(image: ImageInput): Promise<string> {
    const created = await this.drive.files.create({
      requestBody: {
        name: `${Date.now()}-${image.filename}`,
        parents: [this.config.GOOGLE_DRIVE_FOLDER_ID]
      },
      media: { mimeType: image.contentType, body: Readable.from(image.bytes) },
      fields: "id"
    });
    const id = created.data.id;
    if (!id) throw new Error("Google Drive did not return a file ID");

    await this.drive.permissions.create({
      fileId: id,
      requestBody: { role: "reader", type: "anyone" }
    });
    return id;
  }

  private dateFormula(date: Date): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: this.config.TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return `=DATE(${get("year")},${get("month")},${get("day")})`;
  }

  private async formatRows(row: number): Promise<void> {
    const metadata = await this.sheets.spreadsheets.get({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      fields: "sheets.properties",
      includeGridData: false
    });
    const sheet = metadata.data.sheets?.find(
      (item) => item.properties?.title === this.config.GOOGLE_SHEET_NAME
    );
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined || sheetId === null) {
      throw new Error(`Sheet not found: ${this.config.GOOGLE_SHEET_NAME}`);
    }

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.config.GOOGLE_SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 0, endColumnIndex: 1 },
              cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "d/m/yy" } } },
              fields: "userEnteredFormat.numberFormat"
            }
          },
          {
            updateDimensionProperties: {
              range: { sheetId, dimension: "ROWS", startIndex: row, endIndex: row + 1 },
              properties: { pixelSize: this.config.IMAGE_ROW_HEIGHT },
              fields: "pixelSize"
            }
          }
        ]
      }
    });
  }
}

function quoteSheet(name: string): string {
  return `'${name.replaceAll("'", "''")}'`;
}
