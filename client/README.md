# Murder Clue — Client

Ứng dụng React + TypeScript kết nối Socket.IO tới server.

## Yêu cầu

- Node.js ≥ 18
- Server đang chạy (`cd ../server && npm start`)

## Cài đặt & chạy

```bash
cd client
npm install
npm run dev
```

Mở trình duyệt tại **http://localhost:5174**.

## Cấu hình

```bash
cp .env.example .env
```

| Biến | Mặc định | Mô tả |
|------|----------|--------|
| `VITE_SERVER_URL` | `http://localhost:4001` | Địa chỉ server Socket.IO |

Trên server, đặt `CLIENT_ORIGIN` trùng URL client (production).

## Luồng phòng

1. **Tạo phòng mới** — server sinh mã 8 ký tự + link `?room=...`
2. **Copy link** — gửi cho người chơi khác
3. Mở link → tự **vào phòng** (đọc query `?room=`)

## Thử nhanh

1. Tab A: **Tạo phòng mới** → copy link.
2. Tab B: dán link vào trình duyệt → tự vào cùng phòng.
3. Gửi tin nhắn giữa hai tab.
