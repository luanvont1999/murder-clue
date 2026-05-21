# Murder Clue — Server

Server Node.js dùng [Socket.IO](https://socket.io/) để giao tiếp real-time với client.

## Cài đặt

```bash
cd server
npm install
```

## Chạy

```bash
npm start
```

Chế độ dev (tự reload khi sửa file, Node ≥ 18):

```bash
npm run dev
```

Mặc định lắng nghe cổng **4001**. Đổi cổng:

```bash
PORT=4000 npm start
```

## Biến môi trường

| Biến | Mặc định | Mô tả |
|------|----------|--------|
| `PORT` | `4001` | Cổng HTTP + Socket.IO |
| `CORS_ORIGIN` | `*` | Origin được phép (client web) |
| `CLIENT_ORIGIN` | `http://localhost:5174` | Gốc URL client (dùng khi tạo link mời) |

## Sự kiện Socket.IO

| Sự kiện | Hướng | Mô tả |
|---------|--------|--------|
| `welcome` | server → client | Gửi ngay khi kết nối |
| `create_room` | client → server | Tạo phòng mới (mã 8 ký tự hex), tự join, trả `url` |
| `join_room` | client → server | Vào phòng đã tồn tại (mã 8 ký tự) |
| `leave_room` | client → server | Rời room hiện tại |
| `room:joined` | server → client | Đã vào room + `members` + `url` |
| `room:left` | server → client | Đã rời room |
| `room:user_joined` | server → room | Có người mới vào |
| `room:user_left` | server → room | Có người rời |
| `room:error` | server → client | Lỗi (`ROOM_NOT_FOUND`, …) |
| `ping` | client → server | Kiểm tra kết nối |
| `start_game` | client → server | Chủ phòng bắt đầu (đủ 6 người) |
| `game:started` | server → client | Kết quả chia số (riêng 3 số / người) |
| `room:state` | server → client | Cập nhật trạng thái phòng |
| `message` | client → server | Broadcast trong cùng room |

### Logic game

**`start_game`** — Bộ 24 lá (1–12 ×2): random 1 số/cặp (đáp án ẩn), chia **3 lá** cho mỗi người → `game:started`.

**`submit_answer`** — Người chơi gửi 6 lựa chọn (1 số/cặp). Server tính:
- `correctCount`: số cặp đoán đúng (so với đáp án lúc bắt đầu)
- `elapsedMs`: thời gian từ `startedAt` đến khi nộp

Khi **6/6 nộp** → `game:ended` + bảng xếp hạng (đúng nhiều hơn trước, hòa thì nhanh hơn).

### `create_room`

Payload: `{ clientOrigin?: string }` — client gửi `window.location.origin` để server build link chính xác.

Ack thành công: `{ ok: true, created: true, room, url, members }`

Link mời: `http://localhost:5174/?room=<mã_phòng>`

## Kiểm tra nhanh

```bash
curl http://localhost:4001/health
```

Kết quả: `{"ok":true}`
