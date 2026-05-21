# Deploy Murder Clue

**Không cần Docker.** Chỉ cần Node.js 20+ trên máy hoặc trên nền tảng deploy.

Một server vừa chạy Socket.IO vừa phục vụ giao diện React (`client/dist`).

---

## Bước chung (mọi cách)

```bash
# Từ thư mục gốc murder-clue
npm run build    # build client + cài server
npm start        # chạy (mặc định cổng 4001)
```

Biến môi trường:

| Biến | Bắt buộc | Ví dụ |
|------|----------|--------|
| `PORT` | Không (mặc định 4001) | Platform thường tự gán |
| `CLIENT_ORIGIN` | **Có** (production) | `https://ten-app.onrender.com` — URL người chơi mở trình duyệt |
| `CORS_ORIGIN` | Không | `*` (mặc định) |

**Không cần** `VITE_SERVER_URL` khi client và server cùng một domain.

Kiểm tra: `curl https://DOMAIN/health` → `{"ok":true}`

---

## Cách 1: Render.com (không Docker) — dễ nhất trên cloud

1. Push code lên GitHub.
2. [render.com](https://render.com) → **New** → **Web Service** → chọn repo.
3. Cấu hình:
   - **Root Directory**: (để trống = gốc repo)
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Instance**: Free hoặc paid
4. Sau khi có URL (vd. `https://murder-clue-xxxx.onrender.com`), vào **Environment**:
   - `CLIENT_ORIGIN` = URL đó (copy y nguyên, có `https://`)
5. **Manual Deploy** hoặc đợi auto deploy.

Hoặc import file `render.yaml` (Blueprint) trong repo.

---

## Cách 2: Railway (không Docker)

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub.
2. **Settings** → Build: `npm run build`, Start: `npm start`.
3. **Variables**: `CLIENT_ORIGIN` = domain Railway cấp (Settings → Networking → Public URL).
4. Deploy.

---

## Cách 3: VPS / máy Linux (SSH)

```bash
git clone <repo-url> murder-clue && cd murder-clue
npm run build

export PORT=4001
export CLIENT_ORIGIN=https://game.example.com
npm start
```

Chạy nền với **pm2**:

```bash
npm install -g pm2
CLIENT_ORIGIN=https://game.example.com pm2 start server/src/index.js --name murder-clue
pm2 save && pm2 startup
```

HTTPS: đặt **Caddy** hoặc **Nginx** reverse proxy tới `localhost:4001`.

---

## Cách 4: Docker (tuỳ chọn)

Chỉ khi bạn quen Docker — **không bắt buộc**.

```bash
docker build -t murder-clue .
docker run -p 4001:4001 -e CLIENT_ORIGIN=https://DOMAIN murder-clue
```

---

## Cách 5: Tách 2 dịch vụ (phức tạp hơn)

Client Vercel + server Railway riêng → phải set `VITE_SERVER_URL` và `CORS_ORIGIN`. Không khuyên nếu muốn đơn giản.

---

## Dev local (2 terminal)

```bash
# Terminal 1
cd server && npm start

# Terminal 2
cd client && npm run dev
```

Hoặc production một cổng: `npm run build && CLIENT_ORIGIN=http://localhost:4001 npm start`

---

## Lưu ý

- Phòng/game trong **RAM** — restart = mất phòng.
- Free tier (Render/Railway) có thể **sleep** sau vài phút không ai vào.
