# Discord → Google Sheet Bot

Bot นี้รับข้อความ Discord พร้อมรูปภาพ **3 รูป** แล้วเพิ่มข้อมูลลง Google Sheet ตาม layout นี้:

- แถวข้อมูล: `A=Date`, `B-D=29/30/31`, `E=Sub`, `F=Remark`
- แถวถัดไป: รูปที่ 1–3 ใน `B-D` ตามลำดับที่แนบใน Discord
- ค่าเริ่มต้นใน `B-D` คือ `29/30/31`; ทุกครั้งที่มีคำว่า `Sub` ตัวเลขทั้งสามจะเพิ่มจากค่าล่าสุดทีละ 1 และรายการถัดไปจะใช้ค่าล่าสุดต่อเนื่อง
- ถ้ามี `Remark=...` หรือ `Remark: ...` ค่าจะถูกใส่ในคอลัมน์ F
- คอลัมน์ G เก็บ Discord Message ID เพื่อป้องกันรายการซ้ำ สามารถซ่อนคอลัมน์นี้ได้

ตัวอย่างข้อความ:

```text
Sub, Remark=T-75
```

## 1. เตรียม Discord

1. สร้าง Application และ Bot ที่ Discord Developer Portal
2. เปิด **Message Content Intent** ในหน้า Bot
3. เชิญ Bot เข้า Server พร้อมสิทธิ์ View Channel, Read Message History, Send Messages และ Add Reactions
4. เปิด Developer Mode ใน Discord แล้ว Copy Channel ID ที่ต้องการให้ Bot อ่าน

## 2. เตรียม Google สำหรับ Gmail/Google Drive ส่วนตัว

1. สร้าง Google Cloud project และเปิด **Google Sheets API** กับ **Google Drive API**
2. ใน Google Cloud เปิด **Google Auth Platform** แล้วตั้งค่า Branding/Audience โดยเลือก External และเพิ่ม Gmail ของตัวเองเป็น Test user
3. ไปที่ **Clients** แล้วสร้าง OAuth Client โดยเลือก Application type เป็น **Desktop app**
4. ดาวน์โหลด JSON, เปลี่ยนชื่อเป็น `oauth-client.json` แล้ววางไว้ที่ root โปรเจกต์
5. ตั้ง `GOOGLE_AUTH_MODE=oauth` ใน `.env`
6. รัน `npm run google-auth` หนึ่งครั้ง Browser จะเปิดให้ล็อกอิน Gmail และอนุญาตสิทธิ์
7. เมื่อสำเร็จจะมี `google-token.json` ซึ่ง Bot ใช้กับ Sheets และ Drive; ห้ามส่งไฟล์ OAuth ทั้งสองไฟล์ให้ผู้อื่น

OAuth ใช้บัญชี Gmail เจ้าของไฟล์โดยตรง จึงไม่ต้องแชร์ Sheet หรือโฟลเดอร์ให้ Service Account ส่วนรูปในโฟลเดอร์จะถูกตั้งเป็น “Anyone with the link can view” เพื่อให้สูตร `IMAGE()` ใน Sheet โหลดรูปได้ ห้ามใช้โฟลเดอร์ที่มีรูปซึ่งต้องเป็นความลับ

Sheet ต้องมีหัวตารางตามรูป และ bot จะเริ่มเขียนที่แถว 3 จากนั้นใช้แถว 3/4, 5/6, 7/8 ไปเรื่อย ๆ

## 3. ตั้งค่าและรัน

ต้องใช้ Node.js 20 ขึ้นไป

```bash
npm install
cp .env.example .env
```

กรอกค่าใน `.env`:

- `DISCORD_TOKEN`: token ของ Discord bot
- `DISCORD_CHANNEL_ID`: channel ที่ให้ bot เฝ้าดู
- `GOOGLE_SPREADSHEET_ID`: ID ระหว่าง `/d/` และ `/edit` ใน URL ของ Sheet
- `GOOGLE_SHEET_NAME`: ชื่อ tab เช่น `Sheet1`
- `GOOGLE_DRIVE_FOLDER_ID`: ID ของโฟลเดอร์ Drive ที่เก็บรูป
- `GOOGLE_AUTH_MODE`: ใช้ `oauth` สำหรับ Gmail/Google Drive ส่วนตัว
- `GOOGLE_OAUTH_CLIENT_FILE`: ปกติใช้ `./oauth-client.json`
- `GOOGLE_OAUTH_TOKEN_FILE`: ปกติใช้ `./google-token.json`
- `TIME_ZONE`: ค่าเริ่มต้น `Asia/Bangkok`
- `START_ROW`: ค่าเริ่มต้น `3`
- `IMAGE_ROW_HEIGHT`: ความสูงแถวรูป ค่าเริ่มต้น `300`

รันสำหรับใช้งาน:

```bash
npm run build
npm start
```

หรือระหว่างพัฒนา:

```bash
npm run dev
```

เมื่อสำเร็จ bot จะตอบเลขแถวและใส่ ✅ ถ้าจำนวนรูปไม่ใช่ 3 จะยังไม่บันทึก

## 4. รันด้วย Docker Compose

ต้องล็อกอิน Google ด้วย `npm run google-auth` บนเครื่องให้สำเร็จก่อน เพื่อให้มี `google-token.json` จากนั้น build และเปิด Bot:

```bash
docker compose up -d --build
```

Docker image ใช้ esbuild สำหรับ bundle ตัว Bot เพื่อลดเวลาและหน่วยความจำในการ build บน VM ขนาดเล็ก ส่วน `npm run typecheck` และ `npm test` ยังใช้ตรวจโค้ดก่อน deploy ตามปกติ

Compose จะ override path ของ OAuth ให้เป็น `/app/oauth-client.json` และ `/app/google-token.json` ภายใน container ดังนั้นค่า path ใน `.env` จะเป็น absolute path บน macOS หรือ relative path ก็ได้

ดู log:

```bash
docker compose logs -f bot
```

หยุดและลบ container (ข้อมูลใน Google Drive/Sheet และไฟล์ credentials บนเครื่องไม่ถูกลบ):

```bash
docker compose down
```

ไฟล์ `.env`, `oauth-client.json` และ `google-token.json` จะไม่ถูกใส่ใน Docker image โดย Compose จะ mount ไฟล์ OAuth สองไฟล์เข้า container แบบ read-only
