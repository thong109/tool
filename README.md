# MKT Software - Studio đa năng tầng

Hệ thống tự động tạo video từ tin tức với AI tóm tắt nội dung.

## 🚀 Tính năng

- ✅ Chọn nhiều nguồn báo (VnExpress, Tuổi Trẻ, Thanh Niên, Dân Trí, VietnamNet...)
- ✅ Lấy tin mới nhất từ RSS feeds thực tế
- ✅ Tóm tắt nội dung bài viết bằng AI
- ✅ Tự động tạo video từ tin tức
- ✅ Dark theme UI giống screenshot

## 📋 Yêu cầu hệ thống

- Node.js >= 14.x
- npm hoặc yarn

## 🔧 Cài đặt

### 1. Clone hoặc tải project

```bash
cd C:\ThongPhan\tool
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Chạy server

```bash
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

### 4. Mở trình duyệt

Truy cập: `http://localhost:3000/video-creation-platform.html`

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

## 📝 License

MIT

## 👨‍💻 Author

MKT Software - Studio đa năng tầng