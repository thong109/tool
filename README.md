# MKT Software - Studio đa năng tầng

Hệ thống tự động tạo video từ tin tức với AI tóm tắt nội dung.

## 🚀 Tính năng

### Video Creation Platform
- ✅ Chọn nhiều nguồn báo (VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí, VietnamNet...)
- ✅ Lấy tin mới nhất từ RSS feeds thực tế
- ✅ Tóm tắt nội dung bài viết bằng AI
- ✅ Tự động tạo video từ tin tức
- ✅ Azure TTS integration (Text-to-Speech)
- ✅ Kho Audio storage (lưu audio đã tạo)
- ✅ Dark theme UI giống screenshot

### Video Cutter (2 phiên bản)

#### Server Mode (video-cutter.html)
- ✅ Upload video (drag & drop, click)
- ✅ 3 mode cắt: đều, tùy chỉnh, theo khoảng thời gian
- ✅ FFmpeg-powered video processing
- ✅ Download từng đoạn video đã cắt
- ✅ Lưu vào thư mục `cuts/`
- ⚠️ Cần cài FFmpeg trên server

#### WASM Mode (video-cutter-wasm.html) - KHUYẾN NGHỊ
- ✅ Upload video (drag & drop, click)
- ✅ 3 mode cắt: đều, tùy chỉnh, theo khoảng thời gian
- ✅ FFmpeg.wasm từ CDN (không cần cài FFmpeg)
- ✅ Xử lý trong browser (client-side)
- ✅ Privacy: Video không upload lên server
- ✅ Download từng đoạn video đã cắt
- ⚠️ Cần browser hỗ trợ WebAssembly

## 📋 Yêu cầu hệ thống

- Node.js >= 14.x
- npm hoặc yarn

## 🔧 Cài đặt

### ⚡ Cách 1: Setup TỰ ĐỘNG (Khuyến nghị - 1 click)

Chạy script setup để tự động cài đặt tất cả:

**Windows:**
```bash
# Right-click vào file setup.bat
# Chọn "Run as administrator"
# Script sẽ tự động:
# - Cài Node.js dependencies
# - Download và cài FFmpeg
# - Verify installation
```

**macOS/Linux:**
```bash
chmod +x setup.sh
./setup.sh  # macOS
sudo ./setup.sh  # Linux
```

### Cách 2: Cài thủ công

#### 1. Clone hoặc tải project

```bash
cd C:\ThongPhan\tool
```

#### 2. Cài đặt dependencies

```bash
npm install
```

#### 3. Cài đặt FFmpeg

**Windows:**
```bash
# Right-click vào file install-ffmpeg.bat
# Chọn "Run as administrator"
```

**macOS/Linux:**
```bash
chmod +x install-ffmpeg.sh
./install-ffmpeg.sh  # macOS
sudo ./install-ffmpeg.sh  # Linux
```

Hoặc cài thủ công:
- Windows: https://www.gyan.dev/ffmpeg/builds/
- macOS: `brew install ffmpeg`
- Linux: `sudo apt install ffmpeg`

#### 4. Chạy server

```bash
node server.js
```

Server sẽ chạy tại: `http://localhost:3000`

#### 5. Mở trình duyệt

Truy cập: `http://localhost:3000/video-cutter-wasm.html` (WASM mode - không cần FFmpeg)

Hoặc: `http://localhost:3000/video-cutter.html` (Server mode - cần FFmpeg)

## 📁 Cấu trúc project

```
.
├── video-creation-platform.html  # Frontend UI
├── server.js                     # Backend API server
├── package.json                  # Dependencies
└── README.md                     # Hướng dẫn
```

## 🎯 Cách sử dụng

### Bước 1: Chọn nguồn tin
- Click vào các nguồn báo để chọn/bỏ chọn
- Chọn số bài viết cần quét (1-10 bài/nguồn)

### Bước 2: Quét bài viết
- Click nút "Quét bài viết"
- Hệ thống sẽ lấy tin mới nhất từ các nguồn đã chọn
- Bài viết hiển thị với tiêu đề, tóm tắt và link gốc

### Bước 3: Xem và tóm tắt
- Click "🤖 Tóm tắt AI" để xem bản tóm tắt
- Click "🔗 Đọc gốc" để mở bài viết gốc

### Bước 4: Tạo video
- Chọn giọng đọc (TTS) và nhạc nền
- Chọn mẫu video branding
- Click "Tạo & lưu vào kho"

## 🔌 API Endpoints

### GET /api/articles
Lấy danh sách bài viết từ các nguồn

**Parameters:**
- `sources` (required): Danh sách nguồn, phân cách bằng dấu phẩy (vd: `vnexpress,tuoitre,dantri`)
- `count` (optional): Số bài mỗi nguồn (default: 3)

**Example:**
```
http://localhost:3000/api/articles?sources=vnexpress,tuoitre&count=3
```

**Response:**
```json
{
  "success": true,
  "count": 6,
  "articles": [
    {
      "id": "vnexpress-1234567890-abc123",
      "source": "VnExpress",
      "sourceId": "vnexpress",
      "title": "Tiêu đề bài viết...",
      "summary": "Tóm tắt nội dung...",
      "url": "https://vnexpress.net/...",
      "publishedAt": "01/01/2024 10:30:00",
      "content": "Nội dung đầy đủ..."
    }
  ]
}
```

### GET /api/sources
Lấy danh sách các nguồn báo có sẵn

**Example:**
```
http://localhost:3000/api/sources
```

### GET /api/health
Kiểm tra server status

**Example:**
```
http://localhost:3000/api/health
```

## 🛠️ Cấu hình thêm

### Thêm nguồn báo mới

Mở `server.js` và thêm vào object `NEWS_SOURCES`:

```javascript
const NEWS_SOURCES = {
    // ... existing sources
    baomoi: {
        name: 'Báo Mới',
        rss: 'https://baomoi.com/rss/home.rss',
        baseUrl: 'https://baomoi.com'
    }
};
```

### Tích hợp AI API thực

Để tóm tắt AI thực sự, thay thế hàm `generateAISummary()` trong `video-creation-platform.html`:

```javascript
async function generateAISummary(article) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer YOUR_API_KEY`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user", 
                content: `Tóm tắt ngắn gọn bài viết sau: ${article.content}`
            }]
        })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
}
```

## ⚠️ Lưu ý

1. **CORS**: Backend server cần chạy để lấy dữ liệu RSS (tránh CORS restriction)
2. **RSS Feeds**: Một số trang báo có thể thay đổi RSS URL, cần cập nhật thủ công
3. **AI Summary**: Tính năng tóm tắt AI hiện tại dùng extractive summarization đơn giản. Để có tóm tắt chất lượng cao, cần tích hợp API AI (OpenAI, Claude, Gemini...)
4. **Video Generation**: Tính năng tạo video thực tế cần thêm xử lý phức tạp (FFmpeg, video processing...)

## 🐛 Troubleshooting

### Server không chạy được
```bash
# Kiểm tra port 3000 có bị chiếm không
netstat -ano | findstr :3000

# Hoặc đổi port trong server.js
const PORT = 3001; // Thay đổi port
```

### Không lấy được bài viết
- Kiểm tra kết nối internet
- Kiểm tra RSS URL có còn hoạt động không
- Xem console log của server để debug

### CORS error
- Đảm bảo backend server đang chạy
- Frontend đang gọi đúng `http://localhost:3000`

## 🔁 Feature Converter Tool

Tool chuyển đổi HTML khối `diff_cont` (danh sách `<dl><dt><dd>`) thành HTML `depart-feature` mới:
- Features đầu tiên (mặc định 01–03) → `feature-row`, các features còn lại → `feature-column`
- `Features. 01` → `<p class="label">Features 01</p>`
- Tiêu đề `<dt><p>` → `<p class="txt01">`
- `<ul class="dot_list">` → `<ul class="ul-dot cir">`
- `<div class="thumb_img">` → `<div class="img">` (chỉ giữ trong feature-row theo mặc định, có tuỳ chọn giữ trong column)
- Tự chèn link `view` (펼쳐보기/접기) cho mỗi feature

**Cách dùng:** mở `feature-converter.html` trong trình duyệt, dán HTML `diff_cont` vào ô trái → bấm ⚡ Chuyển đổi → copy kết quả. Hoặc chạy `node test-feature-converter.js` để kiểm thử logic.

## 🎓 Course Converter Tool

Tool chuyển đổi danh sách môn học thành HTML `<ul class="course">`:
- Nhận nhiều dạng input: HTML chứa `<span class="label">` (tự động quét toàn bộ input, kể cả khi bọc trong `<a href="...">` như `<dd><a href="..."><span class="label">정보처리기사</span></a>...</dd>`) hoặc text thuần (mỗi dòng một môn học)
- Mỗi `<span class="label">...` → `<li><a class="popup-click" href="#a" id="detail-888" title="...">...</a></li>`
- Tự động bỏ `&nbsp;`, trim khoảng trắng và lọc dòng trống
- Tuỳ chọn ID: giữ cố định số bắt đầu (mặc định `888`) hoặc tăng dần theo từng môn
- Tuỳ chọn tuỳ chỉnh `href` (mặc định `#a`), tự động xử lý khi dán input
- Hỗ trợ copy, tải file `.html`, load file có sẵn, ví dụ mẫu

**Cách dùng:** mở `course-converter.html` trong trình duyệt, dán HTML/text môn học vào ô trái → bấm ⚡ Chuyển đổi → copy kết quả. Hoặc chạy `node test-course-converter.js` để kiểm thử logic.

## 🖼️ Swiper Converter Tool

Tool chuyển đổi HTML `<div class="swiper-wrapper">` vào định format mới:
- Tự động quét toàn bộ `<div class="swiper-slide">` trong input
- Bỏ inline `style` (transform/width/margin-right) và class `swiper-slide-active/next`
- Đặt `img alt` và `title` của thẻ `<a>` = text `p.tit` (thay `썸네일` / `새 창으로 열기`) — có tuỳ chọn giữ nguyên giá trị gốc
- Thêm link `<p class="more"><span>View more</span></p>` vào mọi slide — có tuỳ chọn bỏ
- Giữ `href` (bao gồm `&amp;`), `rel`, `target`, `img src`
- Tuple chuyển đổi: copy, tải file `.html`, load file có sẵn, ví dụ mẫu, tự động xử lý

**Cách dùng:** mở `swiper-converter.html` trong trình duyệt, dán HTML `swiper-wrapper` vào ô trái → bấm ⚡ Chuyển đổi → copy kết quả. Hoặc chạy `node test-swiper-converter.js` để kiểm thử logic.

## 🧑‍💼 Career Converter Tool

Tool chuyển đổi HTML `<div class="career_box">` (danh sách `<dl class="col1">`) thành `<div class="swiper-wrapper">` gồm `<div class="swiper-slide">`:
- Mỗi `<dl>` → slide: `<dt>` → `<p class="tit">`, `<dd>` → `<p class="txt">`, `background-image: url(...)` → `<img src>`
- Thêm `<p class="label">Meta tag</p>` vào mọi slide (text có tuỳ chọn, có checkbox bỏ)
- `img alt` = text tit
- Tuỳ chọn chuy đường ảnh: from/to path (mặc định `/ko/img/main/` → `/krsjcu/img/content/`) và `.N` w nazwie pliku → `-N` (`work.01.png` → `work-01.png`)
- Tuỳ chọn chuy `·` → `&amp;middot;` w tit/txt (konwencja strony — khớp mẫu)
- Tuple chuyển đổi: copy, tải file `.html`, load file có sẵn, ví dụ mẫu, tự động xử lý

**Cách dùng:** mở `career-converter.html` trong trình duyệt, dán HTML `career_box` vào ô trái → bấm ⚡ Chuyển đổi → copy kết quả. Hoặc chạy `node test-career-converter.js` để kiểm thử logic.

## 🎞️ Lect Converter Tool

Tool chuyển đổi HTML bài giảng dạng `<div class="pre_lect">` (gồm các block `<div class="lect_cont">`) thành `<div class="swiper-wrapper">`:
- Mỗi `.lect_cont` chuyển thành 1 slide: `<div class="swiper-slide"><div class="item">...</div></div>` (indent bằng tab)
- **Video YouTube** (iframe `youtube.com/embed/...` hoặc link `shorts`, `watch?v=`, `youtu.be`):
  - Tách video ID và xuất `<div class="img video-container" data-video="ID"></div>` — bỏ iframe, bỏ thumbnail ảnh (tuỳ chọn `optKeepThumb` để giữ `<a><img>` bên trong container)
  - Nếu input đã có `data-video` sẵn thì giữ nguyên ID (convert lại vẫn đúng)
- **Video iframe không phải YouTube** (Vimeo, ...): giữ `<div class="img video-container"><span class="fr-video fr-fvc fr-dvi fr-draggable"><iframe ...></iframe></span></div>`
  - Loại bỏ thuộc tính `sandbox`
  - Tự động gán `title` của iframe bằng nội dung tiêu đề `p.tit`
  - Bổ sung `data-gtm-yt-inspected-10="true"` (chuẩn tracking theo mẫu)
- **Ảnh / Liên kết khác:**
  - Chuyển vào `<div class="img"><a href="..." target="_blank" rel="noopener"><img src="..."></a></div>`
  - Giữ nguyên thuộc tính `style` kích thước (width, border-radius, height)
- **Tiêu đề:** Chuyển `<div class="text_wrap"><p class="tit">` thành `<div class="txt"><p class="txt01">`
- Đầy đủ tính năng: Dán mẫu, Copy, Tải file HTML, Đọc file, Tự động chuyển đổi khi nhập liệu.

**Cách dùng:** mở `lect-converter.html` trong trình duyệt hoặc chạy `node test-lect-converter.js` để kiểm thử logic.

## 📦 Course02 Box Converter Tool

Tool chuyển đổi khối `<div class="subj_cont">` (trang giới thiệu khoa: `p.tit` + 2 `<dl><dt>/<dd>`) thành `<div class="box">` theo template mới:
- `p.tit` → `p.txt01` (bỏ `<br>` và nút bọc trong `<a>` như "과정 상세보기"), `p.cat` = `Course NN` (tuỳ chọn số, mặc định `03`, tự tăng khi input có nhiều block)
- `<dl>` thứ nhất (`dt` + `dd > span.label`) → `<div class="bot01">` với `<p class="tit">` + `<ul class="course">`
- `<dl>` thứ hai (`dt` + `dd > a > span.label`) → `<div class="bot02">` với `<p class="tit">` + `<ul class="area">`
- Mỗi môn trong `ul.course` → `<li><a class="popup-click" href="#a" id="detail-888" title="...">...</a></li>` (tuỳ chọn tăng dần id)
- `<div class="btn">` chèn sẵn: `.pc > a.more popup-click` + `.mo > a.view` + `.mo > a.detail popup-click`, `tab` tự lấy `major_tab` từ link trong `p.tit` (mặc định `1`), `id` popup mặc định `5627`
- Bỏ inline `style` (background-image) và href gốc của CMS; hỗ trợ nhiều khối `.subj_cont` cùng lúc, fallback khi input không có wrapper
- Tuple chuyển đổi: copy, tải file `.html`, load file có sẵn, ví dụ mẫu, tự động xử lý

**Cách dùng:** mở `course02.html` trong trình duyệt, dán HTML `subj_cont` vào ô trái → bấm ⚡ Chuyển đổi → copy kết quả. Hoặc chạy `node test-course02.js` để kiểm thử logic.


## 📝 License

MIT

## 👨‍💻 Author

MKT Software - Studio đa năng tầng