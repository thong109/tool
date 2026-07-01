# Hướng dẫn Test - MKT Software

## 🧪 Test Backend Server

### 1. Khởi động server

```bash
# Windows
start-server.bat

# Linux/Mac
./deploy.sh

# Hoặc manual
npm start
```

**⚠️ QUAN TRỌNG:** Luôn mở frontend qua server, KHÔNG mở file HTML trực tiếp!

```bash
# ✅ ĐÚNG - Mở qua server
http://localhost:3000/video-creation-platform.html

# ❌ SAI - Không mở trực tiếp
file:///C:/ThongPhan/tool/video-creation-platform.html
```

### 2. Test API endpoints

Mở terminal mới và test:

```bash
# Test health check
curl http://localhost:3000/api/health

# Test lấy danh sách sources
curl http://localhost:3000/api/sources

# Test lấy articles từ VnExpress (3 bài)
curl "http://localhost:3000/api/articles?sources=vnexpress&count=3"

# Test lấy articles từ nhiều nguồn
curl "http://localhost:3000/api/articles?sources=vnexpress,tuoitre,dantri&count=2"
```

### 3. Test bằng browser

Mở trình duyệt và truy cập:
- http://localhost:3000/api/health
- http://localhost:3000/api/sources
- http://localhost:3000/api/articles?sources=vnexpress&count=3

## 🐛 Debug nếu có lỗi

### Xem logs trong terminal

Khi chạy server, bạn sẽ thấy logs như:
```
🚀 Server running at http://localhost:3000
📰 News API available at http://localhost:3000/api/articles
📋 Sources list at http://localhost:3000/api/sources

=== API Request ===
Sources: vnexpress,tuoitre
Count: 3
Fetching articles from vnexpress, tuoitre...

Fetching from VnExpress...
Fetching RSS from: https://vnexpress.net/rss/tin-moi-nhat.rss
Response status: 200
Response length: 45678 chars
Parsed 50 items from RSS
Got 3 items from VnExpress

Fetching from Tuổi Trẻ...
...
```

### Các lỗi thường gặp

#### 1. **Cannot fetch RSS - Network Error**
```
Error fetching RSS from https://vnexpress.net/rss/tin-moi-nhat.rss: getaddrinfo ENOTFOUND vnexpress.net
```

**Nguyên nhân:**
- Không có kết nối internet
- DNS không resolve được

**Giải pháp:**
```bash
# Test kết nối
ping vnexpress.net

# Test RSS URL trực tiếp
curl https://vnexpress.net/rss/tin-moi-nhat.rss
```

#### 2. **RSS Parse Error**
```
Error fetching RSS from ...: Unexpected token < in JSON at position 0
```

**Nguyên nhân:**
- RSS URL trả về HTML thay vì XML
- RSS feed đã thay đổi hoặc không còn hoạt động

**Giải pháp:**
- Kiểm tra RSS URL còn hoạt động không
- Cập nhật RSS URL trong `server.js`

#### 3. **CORS Error**
```
Access to fetch at 'http://localhost:3000/api/articles' has been blocked by CORS policy
```

**Nguyên nhân:**
- Backend server không chạy
- Frontend gọi sai port

**Giải pháp:**
```bash
# Đảm bảo server đang chạy
npm start

# Check port
netstat -ano | findstr :3000
```

#### 4. **Empty articles**
```
Fetched 0 articles total
```

**Nguyên nhân:**
- RSS feed trống
- Parse XML bị lỗi
- HTML entities không được decode đúng

**Giải pháp:**
- Xem logs chi tiết
- Test RSS URL trực tiếp
- Check HTML entity decoding

## 🔍 Debug chi tiết

### Bật debug mode

Thêm vào đầu `server.js`:
```javascript
process.env.DEBUG = '*';
```

Hoặc sử dụng `debug` package:
```bash
npm install debug
```

```javascript
const debug = require('debug')('app');
debug('Fetching articles...');
```

### Test từng bước

#### Step 1: Test axios request
```javascript
// Thêm vào fetchRSSFeed function
console.log('Response data:', response.data.substring(0, 500));
```

#### Step 2: Test XML parsing
```javascript
// Thêm vào fetchRSSFeed function
console.log('Parsed result:', JSON.stringify(result, null, 2));
```

#### Step 3: Test article extraction
```javascript
// Thêm vào extractArticle function
console.log('Extracted article:', article);
```

## 📊 Test Frontend

### ⚠️ CÁCH MỞ ĐÚNG:

**Option 1: Qua server (Khuyến nghị)**
```
http://localhost:3000/video-creation-platform.html
```

**Option 2: Nếu muốn mở file trực tiếp (Chỉ để test)**

Chrome:
```bash
# Windows
chrome.exe --disable-web-security --user-data-dir="C:\temp\chrome"

# Mac
open -na "Google Chrome" --args --disable-web-security --user-data-dir=/tmp/chrome
```

Edge:
```bash
# Windows
msedge.exe --disable-web-security --user-data-dir="C:\temp\edge"
```

Firefox:
- Vào `about:config`
- Tìm `security.fileuri.strict_origin_policy`
- Set thành `false`

### 1. Mở browser console (F12)

Khi click "Quét bài viết", bạn sẽ thấy:
- Network requests đến `http://localhost:3000/api/articles`
- Response data với danh sách articles

### 2. Check Network tab

- Status code phải là 200
- Response phải có format:
```json
{
  "success": true,
  "count": 6,
  "articles": [...]
}
```

### 3. Common frontend errors

#### Error: "Lỗi khi lấy bài viết. Kiểm tra backend server."

**Nguyên nhân:**
- Backend không chạy
- CORS error
- Network error

**Giải pháp:**
1. **Check backend đang chạy:** `http://localhost:3000/api/health`
2. **Check browser console (F12)** để xem chi tiết lỗi
3. **Check network tab** để xem request/response
4. **Đảm bảo mở đúng cách:** `http://localhost:3000/video-creation-platform.html` (KHÔNG mở file trực tiếp)

#### Error: CORS policy: No 'Access-Control-Allow-Origin' header

**Nguyên nhân:**
- Mở file HTML trực tiếp (`file://` protocol)
- Backend chưa fix CORS

**Giải pháp:**
1. **Cách 1 (Khuyến nghị):** Mở qua server
   ```
   http://localhost:3000/video-creation-platform.html
   ```

2. **Cách 2:** Restart server sau khi đã fix CORS
   ```bash
   # Stop server (Ctrl+C)
   # Start lại
   npm start
   ```

3. **Cách 3:** Chạy browser với disabled web security (chỉ để test)
   ```bash
   # Chrome
   chrome.exe --disable-web-security --user-data-dir="C:\temp\chrome"
   ```

## 🛠️ Troubleshooting Tools

### 1. Postman/Thunder Client
Test API endpoints:
```
GET http://localhost:3000/api/articles?sources=vnexpress&count=3
```

### 2. Browser DevTools
- Console: Xem errors
- Network: Xem requests
- Application: Xem localStorage

### 3. Terminal logs
Backend logs rất chi tiết, bao gồm:
- RSS fetch status
- Parse results
- Article count
- Errors

## ✅ Checklist

- [ ] Server đang chạy (port 3000)
- [ ] `npm install` đã chạy thành công
- [ ] Health check trả về 200: http://localhost:3000/api/health
- [ ] Sources list có data: http://localhost:3000/api/sources
- [ ] Articles API trả về data (không phải error)
- [ ] Frontend có thể kết nối đến backend
- [ ] Browser console không có CORS errors
- [ ] Articles hiển thị đúng trong UI

## 📝 Test Scenarios

### Scenario 1: Single source
```
URL: http://localhost:3000/api/articles?sources=vnexpress&count=3
Expected: 3 articles from VnExpress
```

### Scenario 2: Multiple sources
```
URL: http://localhost:3000/api/articles?sources=vnexpress,tuoitre,dantri&count=2
Expected: 6 articles total (2 from each source)
```

### Scenario 3: Invalid source
```
URL: http://localhost:3000/api/articles?sources=invalid&count=3
Expected: Empty array or error message
```

### Scenario 4: Missing parameter
```
URL: http://localhost:3000/api/articles
Expected: 400 error - Missing sources parameter
```

## 🚀 Quick Test Command

Chạy tất cả tests:
```bash
# Test health
curl http://localhost:3000/api/health

# Test sources
curl http://localhost:3000/api/sources | jq .

# Test articles
curl "http://localhost:3000/api/articles?sources=vnexpress&count=3" | jq .

# Test multiple sources
curl "http://localhost:3000/api/articles?sources=vnexpress,tuoitre&count=2" | jq .
```

## 📞 Nếu vẫn lỗi

1. **Check Node.js version:**
```bash
node --version  # Should be >= 14.x
```

2. **Check dependencies:**
```bash
npm list
```

3. **Clear cache:**
```bash
rm -rf node_modules package-lock.json
npm install
```

4. **Check firewall:**
```bash
# Windows
netsh advfirewall firewall add rule name="Node.js" dir=in action=allow protocol=TCP localport=3000

# Linux
sudo ufw allow 3000
```

5. **Test RSS feeds manually:**
```bash
curl https://vnexpress.net/rss/tin-moi-nhat.rss | head -50