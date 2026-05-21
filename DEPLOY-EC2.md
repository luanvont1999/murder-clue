# Deploy Murder Clue lên AWS EC2

Hướng dẫn từng bước: **Ubuntu 22.04**, một máy chạy Node + PM2, **Caddy** làm HTTPS (hoặc HTTP nếu chỉ test bằng IP).

Ước tính: **t3.micro** (free tier 12 tháng) hoặc **t3.small** nếu nhiều người chơi cùng lúc.

---

## Tổng quan

```
Trình duyệt → HTTPS :443 (Caddy) → http://127.0.0.1:4001 (Node + Socket.IO + React build)
```

- App listen cổng **4001** (nội bộ).
- Caddy mở **80** (redirect HTTPS) và **443**.
- Security Group EC2: mở **22, 80, 443** — **không** cần mở 4001 ra internet.

---

## Bước 1: Tạo EC2 trên AWS Console

1. Đăng nhập [AWS Console](https://console.aws.amazon.com/) → **EC2** → **Launch instance**.
2. Gợi ý cấu hình:
   - **Name:** `murder-clue`
   - **AMI:** Ubuntu Server 22.04 LTS (64-bit x86)
   - **Instance type:** `t3.micro` (hoặc `t3.small`)
   - **Key pair:** tạo mới hoặc chọn có sẵn → tải file `.pem`
   - **Network:** cho phép **Public IP**
3. **Security group** (firewall) — thêm Inbound rules:

   | Type | Port | Source | Ghi chú |
   |------|------|--------|---------|
   | SSH | 22 | My IP | Chỉ IP bạn, an toàn hơn `0.0.0.0/0` |
   | HTTP | 80 | 0.0.0.0/0 | Caddy + Let's Encrypt |
   | HTTPS | 443 | 0.0.0.0/0 | App + WebSocket |

4. **Storage:** 8–20 GB gp3 là đủ.
5. **Launch instance**.

### (Khuyên) Gắn Elastic IP

IP public EC2 đổi sau khi stop/start. Để link mời ổn định:

1. **EC2** → **Elastic IPs** → **Allocate** → **Associate** với instance `murder-clue`.
2. Ghi lại IP, ví dụ `3.15.xx.xx`.

### Domain (tuỳ chọn)

Trỏ bản ghi **A** của domain (vd. `game.example.com`) → Elastic IP.  
Nếu không có domain, có thể test tạm bằng IP (chỉ HTTP, xem mục cuối).

---

## Bước 2: SSH vào máy

Trên Mac/Linux (thay đường dẫn key và IP):

```bash
chmod 400 ~/Downloads/murder-clue.pem
ssh -i ~/Downloads/murder-clue.pem ubuntu@3.15.xx.xx
```

Windows: dùng PuTTY hoặc `ssh` trong PowerShell với key đã convert.

---

## Bước 3: Cài Node.js 20, Git, PM2, Caddy

Chạy trên EC2 (user `ubuntu`):

```bash
sudo apt update && sudo apt upgrade -y

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

node -v   # v20.x
npm -v

# PM2 (chạy app nền)
sudo npm install -g pm2

# Caddy (HTTPS reverse proxy)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

---

## Bước 4: Đưa code lên EC2

### Cách A — GitHub (khuyên dùng)

Trên máy local, push repo lên GitHub (private/public đều được).

Trên EC2:

```bash
cd ~
git clone https://github.com/<USER>/<REPO>.git murder-clue
cd murder-clue
```

Nếu repo private: dùng [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) hoặc Personal Access Token.

### Cách B — Copy từ máy local (không cần GitHub)

Trên **máy Mac** (từ thư mục cha của `murder-clue`):

```bash
rsync -avz --exclude node_modules --exclude client/dist \
  -e "ssh -i ~/Downloads/murder-clue.pem" \
  murder-clue/ ubuntu@3.15.xx.xx:~/murder-clue/
```

Rồi SSH vào EC2 và chạy bước 5.

---

## Bước 5: Build và cấu hình app

Trên EC2, trong `~/murder-clue`:

```bash
cd ~/murder-clue
npm run build
```

Sửa `ecosystem.config.cjs` — thay URL public (domain hoặc tạm IP):

**Có domain + HTTPS (khuyên):**

```javascript
CLIENT_ORIGIN: "https://game.example.com",
```

**Chỉ Elastic IP, chưa HTTPS** (test nhanh, link mời dùng `http://`):

```javascript
CLIENT_ORIGIN: "http://3.15.xx.xx",
```

Khởi động PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs murder-clue --lines 30
```

Tự chạy lại sau khi reboot:

```bash
pm2 save
pm2 startup
# Chạy lệnh sudo mà PM2 in ra, rồi:
pm2 save
```

Kiểm tra nội bộ:

```bash
curl -s http://127.0.0.1:4001/health
# {"ok":true}
```

---

## Bước 6: Caddy — HTTPS (có domain)

Thay `game.example.com` bằng domain thật (DNS A record đã trỏ Elastic IP).

```bash
sudo nano /etc/caddy/Caddyfile
```

Nội dung:

```
game.example.com {
  reverse_proxy localhost:4001
}
```

Hoặc copy mẫu trong repo:

```bash
sudo cp ~/murder-clue/deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Áp dụng:

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
```

Caddy tự xin chứng chỉ Let's Encrypt lần đầu (cần port **80/443** mở và DNS đúng).

Mở trình duyệt: **https://game.example.com**

Đảm bảo `CLIENT_ORIGIN` trong `ecosystem.config.cjs` trùng URL HTTPS, rồi:

```bash
pm2 restart murder-clue
```

---

## Bước 6b: Chỉ dùng IP (không domain) — test

Caddy với IP thuần (HTTP, không SSL):

```bash
sudo tee /etc/caddy/Caddyfile <<'EOF'
:80 {
  reverse_proxy localhost:4001
}
EOF
sudo systemctl reload caddy
```

`CLIENT_ORIGIN` = `http://<ELASTIC-IP>` → `pm2 restart murder-clue`.

Mở **http://3.15.xx.xx** (không phải https).

---

## Bước 7: Cập nhật phiên bản mới

```bash
cd ~/murder-clue
git pull          # hoặc rsync lại từ máy local
npm run build
pm2 restart murder-clue
```

---

## Kiểm tra game

1. Mở URL public → nhập tên → **Tạo phòng**.
2. **Copy link mời** — phải chứa `?room=xxxxxxxx` và host đúng `CLIENT_ORIGIN`.
3. Tab/điện thoại khác mở link → vào cùng phòng.
4. Đủ 6 người → **Bắt đầu** → chơi thử.

---

## Xử lý lỗi thường gặp

| Triệu chứng | Cách xử lý |
|-------------|------------|
| `Permission denied (publickey)` | Xem mục **SSH bị từ chối key** bên dưới — file `.pem` không khớp Key pair của instance |
| Không SSH được | Security Group port 22, đúng key `.pem`, user `ubuntu` |
| `502` / trang trắng | `pm2 logs murder-clue`, `curl localhost:4001/health` |
| Socket không kết nối | Dùng HTTPS qua Caddy; không chặn WebSocket; `CLIENT_ORIGIN` đúng scheme (`https://`) |
| Link mời sai host | `pm2 restart` sau khi sửa `CLIENT_ORIGIN` |
| Hết RAM (t3.micro) | `pm2 monit` — nâng `t3.small` hoặc thêm swap |
| Caddy không lấy SSL | DNS A record trỏ đúng IP; port 80 mở; đợi vài phút |

### SSH bị từ chối key (`Permission denied (publickey)`)

Máy **có phản hồi** nhưng **không nhận** `murder-clue.pem` → instance được tạo bằng **Key pair khác**, hoặc bạn **không còn** file `.pem` đúng (AWS chỉ cho tải 1 lần).

**Bước 1 — Xác nhận trên Console**

EC2 → Instances → chọn máy (`47.131.98.82` / Elastic IP) → **Key pair name** (vd. `my-key`, `murder-clue`).

**Bước 2 — Vào máy không cần `.pem` (khuyên dùng)**

1. Chọn instance → **Connect** → tab **EC2 Instance Connect** → **Connect**.
2. Trên terminal trình duyệt (user `ubuntu`), chạy:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

**Bước 3 — Trên Mac, tạo key mới**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/murder-clue-ec2 -N ""
cat ~/.ssh/murder-clue-ec2.pub
```

Copy **một dòng** `ssh-ed25519 AAAA...` dán vào cuối `authorized_keys` trên EC2 (mỗi key một dòng). Lưu file.

Trên EC2:

```bash
chmod 600 ~/.ssh/authorized_keys
```

**Bước 4 — SSH từ Mac**

```bash
chmod 600 ~/.ssh/murder-clue-ec2
ssh -i ~/.ssh/murder-clue-ec2 ubuntu@47.131.98.82
```

---

**Cách khác:** Launch instance **mới**, lúc tạo chọn **Create key pair** → tải `.pem` mới ngay → gắn Elastic IP vào máy mới → `chmod 400` → `ssh -i file-moi.pem ubuntu@IP`.

**Không** dùng file `.pem` copy từ repo/git — phải là file tải từ AWS đúng lần tạo key.

### Xem log

```bash
pm2 logs murder-clue
sudo journalctl -u caddy -f
```

### Firewall trên máy (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## Chi phí gợi ý

- **t3.micro** + 8GB: thường nằm trong free tier 12 tháng (tài khoản mới).
- **Elastic IP** gắn instance đang chạy: miễn phí; IP không gắn instance có thể tính phí nhỏ.
- Traffic: game nhẹ, vài GB/tháng thường rất thấp.

---

## Tóm tắt lệnh (copy nhanh)

```bash
# Trên EC2 sau khi clone repo
cd ~/murder-clue
npm run build
# sửa ecosystem.config.cjs → CLIENT_ORIGIN
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup

# Caddy (có domain)
sudo nano /etc/caddy/Caddyfile
sudo systemctl reload caddy
pm2 restart murder-clue
```

Xem thêm: [DEPLOY.md](./DEPLOY.md) (so sánh Fly, Railway, VPS khác).
