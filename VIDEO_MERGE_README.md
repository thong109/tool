# 🎬 Video & Voice Merger Tool

Công cụ tự động gộp video template với file voice/audio, lặp video cho khớp độ dài voice.

## 📋 Yêu cầu

- **Node.js** đã được cài đặt
- **FFmpeg** đã được cài đặt và thêm vào PATH
  - Windows: Tải từ https://ffmpeg.org/download.html
  - Hoặc chạy: `install-ffmpeg.bat`

## 🚀 Cách sử dụng

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Thêm video templates (tùy chọn)

Copy các file video vào thư mục `templates/`:
```bash
templates/
  ├── template1.mp4
  ├── template2.mp4
  └── ...
```

### 3. Khởi động server

```bash
node server.js
```

Server sẽ chạy tại `http://localhost:3000`

### 4. Mở công cụ

Truy cập: `http://localhost:3000/video-merge.html`

## 📝 Hướng dẫn sử dụng

### Chế độ 1: Sử dụng template có sẵn
1. Chọn tab "📁 Template có sẵn"
2. Chọn video template từ danh sách
3. Chọn file voice/audio
4. Click "🚀 Xử lý & Gộp"

### Chế độ 2: Tải video lên
1. Chọn tab "📤 Tải video lên"
2. Upload video template của bạn
3. Chọn file voice/audio
4. Click "🚀 Xử lý & Gộp"

## 🔧 API Endpoints

### GET `/api/templates`
Lấy danh sách video templates có sẵn

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "name": "template1.mp4",
      "path": "/templates/template1.mp4",
      "size": 1024000,
      "sizeFormatted": "1.0 MB"
    }
  ]
}
```

### POST `/api/merge-video`
Gộp video với voice

**Request:** `multipart/form-data`
- `video`: File video (hoặc `videoPath` nếu dùng template có sẵn)
- `voice`: File voice/audio

**Response:**
```json
{
  "success": true,
  "message": "Video merged successfully",
  "data": {
    "filename": "merged_1234567890.mp4",
    "url": "/uploads/merged/merged_1234567890.mp4",
    "size": 2048000,
    "sizeFormatted": "2.0 MB",
    "duration": 120.5
  }
}
```

### GET `/api/health`
Kiểm tra trạng thái server

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "ffmpeg": {
    "installed": true,
    "version": "ffmpeg version 5.1.2 ..."
  },
  "azureTTS": false
}
```

## 🛠️ Cấu trúc thư mục

```
.
├── server.js              # Node.js server với FFmpeg
├── video-merge.html       # Frontend UI
├── templates/             # Video templates (tạo thủ công)
├── uploads/               # Uploaded files
│   └── merged/           # Merged output videos
├── package.json
└── VIDEO_MERGE_README.md
```

## ⚙️ Cấu hình

### Thay đổi thư mục templates
Chỉnh sửa trong `server.js`:
```javascript
const TEMPLATES_DIR = path.join(__dirname, 'templates');
```

### Thay đổi thư mục output
```javascript
const MERGED_DIR = path.join(__dirname, 'uploads', 'merged');
```

### Giới hạn file size
Chỉnh sửa trong `server.js`:
```javascript
limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
```

## 🐛 Troubleshooting

### Lỗi "FFmpeg not found"
- Đảm bảo FFmpeg đã được cài đặt
- Thêm FFmpeg vào PATH
- Test: `ffmpeg -version`

### Lỗi "Cannot connect to server"
- Đảm bảo server đang chạy: `node server.js`
- Kiểm tra port 3000 có bị chiếm không
- Thử truy cập: `http://localhost:3000/api/health`

### Lỗi "No video file provided"
- Kiểm tra file video đã được chọn
- Đảm bảo file không quá 500MB

### Video output bị lỗi
- Kiểm tra định dạng video đầu vào (nên dùng MP4)
- Đảm bảo voice file hợp lệ
- Xem log trong console để debug

## 📊 Cách hoạt động

1. **Upload/Template**: Chọn video template
2. **Analyze**: Server phân tích thời lượng video và voice
3. **Loop**: Tự động lặp video để khớp với độ dài voice
4. **Merge**: Gộp video loop với voice audio
5. **Output**: Trả về video đã gộp

## 🎯 Tính năng

- ✅ Tự động lặp video theo độ dài voice
- ✅ Hỗ trợ nhiều định dạng video (MP4, WebM, AVI, MOV, MKV)
- ✅ Hỗ trợ nhiều định dạng audio (MP3, WAV, M4A, OGG)
- ✅ UI responsive, hỗ trợ mobile
- ✅ Drag & drop file upload
- ✅ Progress bar real-time
- ✅ Log chi tiết quá trình xử lý
- ✅ Tự động cleanup files tạm

## 📝 Notes

- Video output được lưu trong `uploads/merged/`
- Files tạm được tự động xóa sau khi xử lý
- Server có thể xử lý nhiều request cùng lúc
- FFmpeg sử dụng codec H.264 cho video, AAC cho audio

## 🔗 Liên kết

- Server: `http://localhost:3000`
- Video Merge Tool: `http://localhost:3000/video-merge.html`
- API Health Check: `http://localhost:3000/api/health`
- Templates: `http://localhost:3000/templates/`