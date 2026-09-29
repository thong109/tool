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
- `p.desc` (nếu có) → `p.txt02` ngay sau `p.txt01` (bật/tắt bằng checkbox "🧾 Mô tả (p.desc)")
- `<dl>` thứ nhất (`dt` + `dd > span.label`) → `<div class="bot01">` với `<p class="tit">` + `<ul class="course">`
- Các `<dl>` sau (`dt` + `dd > a > span.label`) → `<div class="bot02">` với `<p class="tit">` + `<ul class="area">`; chọn cách gom khi input có nhiều `<dl>` (`취득 자격증` / `취득 수료증`):
  - `each` (mặc định): mỗi `<dl>` thành 1 `.bot02` riêng (giữ `dt` của từng nhóm)
  - `merge`: gộp tất cả vào 1 `ul.area`, `tit` = `dt` của `<dl>` đầu nhóm
  - `last`: chỉ giữ `<dl>` cuối (`취득 수료증`)
- Mỗi môn trong `ul.course` → `<li><a class="popup-click" href="#a" id="detail-888" title="...">...</a></li>` (tuỳ chọn tăng dần id)
- `<div class="btn">` chèn sẵn: `.pc > a.more popup-click` + `.mo > a.view` + `.mo > a.detail popup-click`, `tab` tự lấy `major_tab` từ link trong `p.tit` (mặc định `1`), `id` popup mặc định `5627`
- Bỏ inline `style` (background-image) và href gốc của CMS; hỗ trợ nhiều khối `.subj_cont` cùng lúc, fallback khi input không có wrapper
- Tuple chuyển đổi: copy, tải file `.html`, load file có sẵn, 2 ví dụ mẫu (경ㆍ공매투자, 인공지능 AI có `p.desc` + 3 `<dl>`), tự động xử lý

**Cách dùng:** mở `course02.html` trong trình duyệt, dán HTML `subj_cont` vào ô trái → bấm ⚡ Chuyển đổi → copy kết quả. Hoặc chạy `node test-course02.js` để kiểm thử logic.


## 🧩 Features2 Swiper Converter Tool

Tool chuyển đổi khối `<div class="diff_cont">` (trang giới thiệu khoa: nhiều `<dl>` với `<dt>Features. 01<p>tiêu đề</p></dt>` + `<dd><ul class="dot_list">…</ul><a class="btn01 …more_ic">더보기</a><div class="thumb_img"><img></div></dd>`) thành `<ul class="swiper-wrapper">` gồm các `<li class="swiper-slide">`:
- Mỗi `<dl>` → 1 slide: `<p class="label">Features NN</p>` + `<div class="img"><img src alt></div>` + `<div class="txt">`
- `Features. NN` → `Features NN` (bỏ dấu chấm); tuỳ chọn tiền tố (mặc định `Features`), số bắt đầu (mặc định `1`) và checkbox **tự đánh số NN theo thứ tự slide** (tắt thì giữ số có sẵn trong input, kể cả khi label nằm trong `<span>`)
- `<dt><p>` → `<p class="txt01 line1">` (`<br>` → khoảng trắng, trim + gộp khoảng trắng/`&nbsp;`; checkbox bật/tắt class `line1`)
- `<dd> > ul.dot_list > li` → `<div class="txt02"><ul class="ul-dot cir">…</ul>` (giữ nguyên `<br>`, escape ký tự đặc biệt; `<li>` có block con thì xuống dòng, thụt thêm 1 cấp)
- `div.thumb_img > img` → `<div class="img"><img src alt></div>`, tuỳ chọn **mẫu src ảnh** với `{NN}` (01, 02…) / `{N}` (1, 2…) — để trống thì giữ ảnh gốc
- `<a class="view" href="#a" title="펼쳐보기/접기"><span>펼쳐보기</span><span>접기</span></a>` thêm vào mỗi slide (tuỳ chọn bật/tắt + href)
- `<dl>` không có `ul.dot_list` (vd `<dl class="no_dd">` chỉ có ảnh): mặc định vẫn xuất đủ cấu trúc với `<div class="txt02"></div>` rỗng; bật checkbox thì bỏ luôn `div.txt02` + `a.view` (chỉ giữ ảnh + `p.txt01`)
- Nhiều `<div class="diff_cont">`: mặc định gộp tất cả `<dl>` vào 1 `ul.swiper-wrapper` (số label liên tục); bật checkbox thì mỗi khối 1 wrapper riêng
- Thụt lề theo mẫu trang bằng tab: wrapper 0 tab, `<li class="swiper-slide">` 6 tab, `p.label`/`div.img`/`div.txt` 7 tab, `p.txt01`/`div.txt02` 8 tab, `ul.ul-dot.cir` 9 tab, `<li>` 10 tab
- Bỏ `data-aos`/`aos-init`, `a.btn01…더보기` và href gốc của CMS; fallback khi input chỉ có `<dl>` trần hoặc là cả trang HTML
- Đầy đủ tiện ích: copy, tải file `.html` (`swiper-features.html`), load file có sẵn, ví dụ mẫu thật (4 `<dl>`, có 1 `<dl class="no_dd">`), thống kê (tổng slide / slide thiếu `ul.dot_list` / số wrapper), tự động xử lý khi dán input

**Cách dùng:** mở `features2.html` trong trình duyệt, dán HTML `diff_cont` vào ô trái → bấm ⚡ Chuyển đổi → copy kết quả. Hoặc chạy `node test-features2.js` để kiểm thử logic.


## 🎓 Certificate Converter Tool

Tool chuyển đổi khối `<div class="dept_section dept_licn">` (trang 자격증: `<p class="sec_subtit">` + nhiều `<div class="licn_wrap">`, trong mỗi wrap có các `<div class="licn_box">` gồm `div.thumb_img > img` + `div.text_wrap` chứa `p.tit` / `p.desc` / `a.text_btn`) thành `<div class="swiper-wrapper">` gồm các `<div class="swiper-slide">`:
- Mỗi `div.licn_box` → 1 slide: `<p class="cat">…</p>` + `<div class="img"><img src alt></div>` + `<div class="txt">` (`p.txt01` + `p.txt02` + `a.view.popup-click`). **Toàn bộ** `licn_box` của mọi `licn_wrap` (kể cả nhiều khối `dept_licn` dán cùng lúc) được gộp vào **một** `<div class="swiper-wrapper">` duy nhất theo đúng thứ tự tài liệu, `tab` đánh liên tục 1…n
- `p.cat` lấy từ ô nhập **Category** (mặc định `국가자격증`) — đổi thành `민간자격증` cho slide 민간자격 (vd 골프코스관리사). Nếu input có `<p class="tit">` đứng **ngoài** `licn_box` ngay trước `licn_wrap` (tiêu đề nhóm, vd `<국방안보 및 리더십, 영상판독 자격>`, `<병영생활전문상담관>`, `<드론 전문가>`) thì `p.cat` của các slide ngay sau đó = tiêu đề nhóm (tự bỏ dấu `<` `>` bao ngoài và `&lt;`/`&gt;`, bỏ `p.tit` rỗng chỉ có `<br>`, `p.sec_subtit` không bị tính); box đứng trước tiêu đề nhóm đầu tiên vẫn dùng ô Category; input **không có** tiêu đề nhóm nào → mọi slide dùng `국가자격증` (hoặc đúng giá trị nhập vào ô Category); tắt checkbox **p.cat = `p.tit` nhóm** để mọi slide dùng chung ô Category
- `div.thumb_img > img` → `<div class="img"><img src alt></div>`; `alt` mặc định = tiêu đề slide (tắt checkbox thì giữ `alt` gốc); ô **Đường dẫn ảnh mới** thay `src` theo thứ tự slide (`{n}` = số thứ tự slide 1-based, mặc định `/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_{n}.jpg`) — xoá trống ô này để giữ `src` gốc của `thumb_img`
- `p.tit` → `<p class="txt01">` với **chuẩn hoá tiêu đề** (checkbox mặc định bật): `조경기사자격증` → `조경기사/조경산업기사 자격증`, `자연생태복원기사자격증` → `자연생태복원기사/자연생태복원산업기사 자격증`, `골프코스관리사자격증` → `골프코스관리사 자격증`, `…자격증 소개` → `…자격증`; tiêu đề đã có `/` (vd `조경기사/조경산업기사 자격증 소개`) thì chỉ bỏ `소개`; `<br>` → khoảng trắng, trim + gộp khoảng trắng/`&nbsp;`
- `p.desc` (trong `div.text_wrap`) → `<p class="txt02">` — lấy **nguyên văn** từ input, nên slide nào cần mô tả dài hơn (vd lấy từ trang 취득과정) thì sửa lại trong output/CMS; box không có mô tả vẫn giữ `<p class="txt02"></p>` (tuỳ chọn **bỏ `p.txt02` khi rỗng**)
- `<a class="view popup-click" href id tab title>취득과정 전체보기</a>` thêm vào cuối `div.txt`, dính liền sau `</p>` của `p.txt02` như mẫu trang: tuỳ chỉnh `href` (mặc định `#a`), `id` popup (mặc định `detail-1000`, giống nhau ở mọi slide như trang thật), `tab` bắt đầu (mặc định `1`, tự tăng theo slide hoặc giữ nguyên — khớp `major_tab=0…3` của `a.text_btn`) và text/title (mặc định `취득과정 전체보기`)
- Box rỗng (không có ảnh + tiêu đề + mô tả): mặc định bỏ khỏi output nhưng vẫn đếm trong thống kê; tắt checkbox thì vẫn xuất slide đủ cấu trúc
- Thụt lề theo mẫu trang bằng tab: wrapper 0 tab, `<div class="swiper-slide">` 6 tab, `p.cat`/`div.img`/`div.txt` 7 tab, `p.txt01`/`p.txt02` (+`a.view`) 8 tab, `</div>` cuối wrapper 5 tab
- Bỏ `p.sec_subtit`, `a.text_btn`, `data-aos`/`aos-init`, comment HTML và href gốc của CMS; fallback khi input chỉ có các `.licn_box` trần (không cần `div.dept_licn` bao ngoài), `div.dept_licn` không có `licn_box` con, hoặc là cả trang HTML
- Đầy đủ tiện ích: copy, tải file `.html` (`swiper-certificate.html`), load file có sẵn, ví dụ mẫu thật (4 `licn_box` của `dept_licn`: 조경기사 / 자연생태복원기사 / 식물보호기사 / 골프코스관리사), thống kê (số box / tổng slide / box rỗng bị bỏ / bytes), tự động xử lý khi dán input

**Cách dùng:** mở `certificate.html` trong trình duyệt, dán HTML `dept_section dept_licn` vào ô trái → bấm ⚡ Chuyển đổi → copy kết quả. Hoặc chạy `node test-certificate.js` để kiểm thử logic.


## 📝 License

MIT

## 👨‍💻 Author

MKT Software - Studio đa năng tầng