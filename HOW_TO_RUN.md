# Hướng dẫn chạy MKT Software

## Video Cutter - 2 Phiên bản

### Phiên bản 1: Server Mode (video-cutter.html)
Cần cài FFmpeg trên server.

#### Cài đặt FFmpeg TỰ ĐỘNG (Khuyến nghị):

**Windows:**
```bash
# Right-click vào file install-ffmpeg.bat
# Chọn "Run as administrator"
# Script sẽ tự động:
# 1. Download FFmpeg
# 2. Extract vào C:\ffmpeg
# 3. Thêm vào PATH
# 4. Verify installation
```

**macOS/Linux:**
```bash
# macOS
chmod +x install-ffmpeg.sh
./install-ffmpeg.sh

# Linux
chmod +x install-ffmpeg.sh
sudo ./install-ffmpeg.sh
```

#### Cài đặt FFmpeg THỦ CÔNG:

**Windows:**
1. Download: https://www.gyan.dev/ffmpeg/builds/
2. Extract vào `C:\ffmpeg`
3. Thêm `C:\ffmpeg\bin` vào PATH
4. Verify: `ffmpeg -version`

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

### Phiên bản 2: WASM Mode (video-cutter-wasm.html) - KHUYẾN NGHỊ
✅ **Không cần cài FFmpeg** - Sử dụng FFmpeg.wasm từ CDN!

#### Ưu điểm:
- ✅ Không cần cài đặt gì thêm
- ✅ Xử lý trong browser (client-side)
- ✅ Privacy: Video không upload lên server
- ✅ Nhanh và tiết kiệm bandwidth

#### Cách sử dụng:
1. Mở: `http://localhost:3000/video-cutter-wasm.html`
2. FFmpeg.wasm sẽ tự động load từ CDN (lần đầu mất 5-10s)
3. Upload video và cắt như bình thường

#### Lưu ý:
- Cần browser hỗ trợ WebAssembly (Chrome, Firefox, Edge mới)
- Lần đầu load sẽ download FFmpeg.wasm (~25MB) từ CDN
- Video được xử lý hoàn toàn trong browser

## Cài đặt Dependencies

```bash
npm install
```

## Cấu hình Azure TTS (Optional - cho Tạo Video)

Tính năng TTS sử dụng **Azure Cognitive Services** (có free tier 5 triệu ký tự/tháng).

### Cách lấy Azure TTS Key (MIỄN PHÍ):

1. **Tạo Azure Account** (miễn phí):
   - Truy cập: https://portal.azure.com
   - Đăng ký tài khoản mới (cần thẻ Visa/Mastercard để xác minh, nhưng không bị charge nếu dùng free tier)

2. **Tạo Speech Service**:
   - Tìm "Speech" trong Azure Portal
   - Click "Create Speech service"
   - Chọn region: **East Asia** (gần Việt Nam nhất)
   - Chọn pricing tier: **Free F0** (5 triệu ký tự/tháng miễn phí)
   - Click "Create"

3. **Lấy API Key**:
   - Sau khi tạo xong, vào resource vừa tạo
   - Click "Keys and Endpoint" ở menu bên trái
   - Copy **Key 1** hoặc **Key 2**
   - Copy **Location/Region** (ví dụ: `eastasia`)

4. **Chạy server với Azure TTS**:

**Option A: Set Environment Variables (Khuyến nghị)**
```bash
# Windows PowerShell
$env:AZURE_TTS_KEY="your-api-key-here"
$env:AZURE_TTS_REGION="eastasia"
node server.js

# Windows CMD
set AZURE_TTS_KEY=your-api-key-here
set AZURE_TTS_REGION=eastasia
node server.js
```

**Option B: Tạo file .env**
```bash
# Tạo file .env trong thư mục project
AZURE_TTS_KEY=your-api-key-here
AZURE_TTS_REGION=eastasia

# Chạy server
node server.js
```

## Chạy Backend Server

```bash
node server.js
```

Bạn sẽ thấy thông báo:
```
🚀 Server running at http://localhost:3000
📰 News API available at http://localhost:3000/api/articles
📋 Sources list at http://localhost:3000/api/sources
✂️ Video Cutter API available at http://localhost:3000/api/cut-video
```

## Mở Browser

```
http://localhost:3000
```

## Các trang có sẵn:

### Không cần backend server:
- ✅ CSS Minify Tool (`index.html`)
- ✅ JS Formatter (`js-formatter-ui.html`)
- ✅ Novel Writing Tool (`novel-writing-tool/index.html`)
- ✅ Video Merge (`video-merge.html`)
- ✅ Video Merge UI (`video-merge-ui.html`)
- ✅ Shopee Affiliate Tool (`affiliate-tool/index.html`)

### Cần backend server:
- ⚠️ Video Creation Platform (`video-creation-platform.html`)
- ⚠️ Video Cutter (`video-cutter.html`)

## Tính năng Video Cutter

### 1. Upload Video
- Drag & drop hoặc click để chọn file
- Hỗ trợ: MP4, AVI, MOV, MKV
- Max size: 500MB

### 2. Cắt video theo 3 mode:

**Mode 1: Cắt đều**
- Chia video thành N đoạn bằng nhau
- Ví dụ: Video 10 phút → 3 đoạn 3:20 mỗi đoạn

**Mode 2: Cắt tùy chỉnh**
- Nhập thời gian từng đoạn
- Format: `start-end` (ví dụ: `0:00-0:30`, `0:30-1:00`)

**Mode 3: Cắt theo khoảng thời gian**
- Cắt mỗi X giây
- Ví dụ: Mỗi 30s → Video 2 phút → 4 đoạn

### 3. Lưu video
- Tất cả video cắt được lưu trong thư mục `cuts/`
- Tên file: `segment_1.mp4`, `segment_2.mp4`, ...
- Có thể tải xuống từ UI

## Troubleshooting

### Lỗi "FFmpeg not found"
**Nguyên nhân:** FFmpeg chưa cài đặt hoặc chưa thêm vào PATH

**Giải pháp:**
1. Cài FFmpeg theo hướng dẫn ở trên
2. Restart terminal
3. Chạy `ffmpeg -version` để verify

### Lỗi "Lỗi khi lấy bài viết"
**Giải pháp:**
1. Chạy `node server.js`
2. Mở `http://localhost:3000`
3. Đảm bảo có kết nối internet

### Lỗi "Cannot find module"
**Giải pháp:**
```bash
npm install
```

### Lỗi "TTS service not configured"
**Giải pháp:**
1. Lấy Azure TTS key từ portal.azure.com
2. Set environment variable `AZURE_TTS_KEY`
3. Restart server

## Azure TTS Free Tier

- **5 triệu ký tự/tháng** MIỄN PHÍ
- Đủ cho ~100-150 audio files (mỗi audio ~30-50k characters)
- Chất lượng giọng đọc cao (neural voices)
- Hỗ trợ tiếng Việt: `vi-VN-HoaiAnNeural` (giọng nữ)

## Liên hệ

Nếu gặp vấn đề, kiểm tra console log trong browser (F12) để xem chi tiết lỗi.