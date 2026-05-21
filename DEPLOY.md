# Deploy Murder Clue

**Không bắt buộc Docker** trên máy bạn (VPS dùng Node + pm2). Một server: Socket.IO + giao diện React.

---

## So sánh nhanh (chọn 1)

| Nền tảng | Ổn định | Giá | Độ khó | Ghi chú |
|----------|---------|-----|--------|---------|
| **AWS EC2** | Cao | Free tier / ~$8+ | Trung bình | **[Hướng dẫn chi tiết → DEPLOY-EC2.md](./DEPLOY-EC2.md)** |
| **VPS rẻ** (Hetzner, DigitalOcean) | Cao nhất | ~$4–5/tháng | Trung bình | Giống EC2, rẻ hơn một chút |
| **Fly.io** | Cao | Free credit + ~ vài $/tháng | Dễ | WebSocket tốt, không sleep như Render free |
| **Railway Hobby** | Cao | ~$5/tháng | Dễ | Git push, ít cấu hình |
| **Render free** | Thấp | $0 | Dễ | Hay **ngủ** → mất phòng / ngắt socket |
| **Oracle Cloud Free** | Cao | $0 | Khó | VPS free mãi, setup lâu |

---

## Chuẩn bị (mọi cách)

```bash
cd murder-clue
npm run build
npm start
```

| Biến | Production |
|------|------------|
| `CLIENT_ORIGIN` | URL public (vd. `https://game.example.com`) |
| `PORT` | Platform tự gán hoặc `4001` |

Không cần `VITE_SERVER_URL` khi client + server **cùng domain**.

---

## Khuyên dùng 1: AWS EC2

→ **[DEPLOY-EC2.md](./DEPLOY-EC2.md)** — launch instance, PM2, Caddy HTTPS, Elastic IP.

## Khuyên dùng 2: VPS rẻ (Hetzner, DO, …)

Phù hợp Murder Clue (Socket.IO cần process chạy liên tục).

**Gợi ý nhà cung cấp:** [Hetzner CX22](https://www.hetzner.com/cloud/) (~€3.8/tháng), [DigitalOcean](https://www.digitalocean.com/) ($4/tháng), [Vultr](https://www.vultr.com/).

### Trên VPS (Ubuntu)

```bash
# Cài Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

git clone <repo-url> murder-clue && cd murder-clue
npm run build

# Chạy nền với pm2
sudo npm install -g pm2
# Sửa CLIENT_ORIGIN trong ecosystem.config.cjs trước
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

**HTTPS:** cài Caddy (tự SSL):

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
game.example.com {
  reverse_proxy localhost:4001
}
```

```bash
sudo systemctl reload caddy
```

Đặt `CLIENT_ORIGIN=https://game.example.com` trong `ecosystem.config.cjs` rồi `pm2 restart murder-clue`.

---

## Khuyên dùng 3: Fly.io (không Docker trên máy bạn)

Fly vẫn build bằng Dockerfile trên cloud — bạn chỉ cần CLI, **không cài Docker local**.

1. Đăng ký [fly.io](https://fly.io) + cài `flyctl`.
2. Trong thư mục repo:

```bash
fly launch --no-deploy
# Chọn app name, region sin (Singapore) gần VN
# Không gắn Postgres/Redis
```

3. Sửa `fly.toml` nếu cần; set secret:

```bash
fly secrets set CLIENT_ORIGIN=https://<ten-app>.fly.dev
```

4. Deploy (dùng `Dockerfile.fly`):

```bash
fly deploy --dockerfile Dockerfile.fly
```

5. Mở `https://<ten-app>.fly.dev`

`auto_stop_machines = "off"` trong `fly.toml` giúp máy **không tắt** khi không có traffic (khác Render free).

---

## Khuyên dùng 4: Railway (trả phí, đơn giản)

Free Railway cũng có thể sleep — dùng **Hobby ~$5/tháng** ổn định hơn.

1. [railway.app](https://railway.app) → Deploy GitHub repo.
2. **Build:** `npm run build` · **Start:** `npm start`
3. **Variables:** `CLIENT_ORIGIN` = Public URL Railway cấp.
4. Bật **Public Networking**.

---

## Render free (không khuyên cho game realtime)

Render free **spin down** sau ~15 phút không truy cập → Socket ngắt, phòng RAM mất.

Nếu vẫn dùng: `render.yaml` + set `CLIENT_ORIGIN`. Chấp nhận không ổn định hoặc nâng gói trả phí.

---

## Oracle Cloud Always Free ($0, VPS thật)

1 VM ARM free mãi — ổn định như VPS, nhưng đăng ký/cấu hình firewall phức tạp hơn.

Sau khi có VM: làm giống mục **VPS rẻ** ở trên.

---

## Dev local

```bash
# Hai terminal
cd server && npm start
cd client && npm run dev

# Hoặc một cổng production
npm run build && CLIENT_ORIGIN=http://localhost:4001 npm start
```

---

## Kiểm tra

```bash
curl https://DOMAIN/health
# {"ok":true}
```

---

## Lưu ý

- Phòng/game trong **RAM** — restart process = mất phòng.
- Bất kỳ host nào cũng nên set **`CLIENT_ORIGIN`** đúng URL HTTPS để link mời hoạt động.
