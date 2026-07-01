# Hướng dẫn Deploy - MKT Software

## 🚀 Deploy nhanh

### Option 1: Localhost (Testing)
```bash
# Windows
start-server.bat

# Linux/Mac
chmod +x deploy.sh
./deploy.sh
```

### Option 2: VPS/Server (PM2)
```bash
# 1. Upload code lên server
# 2. SSH vào server
ssh user@your-server.com

# 3. Cài đặt
cd /path/to/project
npm install --production

# 4. Cài PM2 (process manager)
npm install -g pm2

# 5. Chạy với PM2
pm2 start server.js --name "mkt-software"

# 6. Auto-start khi reboot
pm2 startup
pm2 save

# 7. Xem logs
pm2 logs mkt-software

# 8. Stop/Restart
pm2 stop mkt-software
pm2 restart mkt-software
```

### Option 3: Heroku
```bash
# 1. Tạo Procfile
echo "web: node server.js" > Procfile

# 2. Deploy
heroku create your-app-name
git push heroku main

# 3. Mở app
heroku open
```

### Option 4: Vercel
```bash
# 1. Tạo vercel.json
{
  "version": 2,
  "builds": [
    { "src": "server.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/server.js" }
  ]
}

# 2. Deploy
vercel --prod
```

### Option 5: Netlify
```bash
# 1. Tạo netlify.toml
[build]
  command = "npm install"
  publish = "."

[functions]
  directory = "."

# 2. Deploy
netlify deploy --prod
```

## 📦 Docker (Recommended for Production)

### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  mkt-software:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: always
    volumes:
      - ./logs:/app/logs
```

### Chạy với Docker
```bash
# Build và chạy
docker-compose up -d

# Xem logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🔧 Environment Variables

Tạo file `.env`:
```env
PORT=3000
NODE_ENV=production

# Optional: Thêm API keys
OPENAI_API_KEY=your_key_here
```

## 📊 Monitoring

### PM2 Monitoring
```bash
pm2 monit
pm2 status
```

### Nginx Reverse Proxy (Production)
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 Security

### 1. Rate Limiting (Thêm vào server.js)
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### 2. Helmet (Security headers)
```bash
npm install helmet
```

```javascript
const helmet = require('helmet');
app.use(helmet());
```

## 🌐 Domain Setup

### 1. Mua domain (Namecheap, GoDaddy, etc.)
### 2. Point DNS đến server IP
### 3. Cấu hình SSL với Let's Encrypt
```bash
# Cài certbot
sudo apt install certbot

# Tạo SSL certificate
sudo certbot --nginx -d yourdomain.com
```

## 📱 Mobile App (Optional)

### PWA (Progressive Web App)
Thêm vào HTML:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#667eea">
```

### Tạo Electron App
```bash
npm install -g electron
```

Tạo `main.js`:
```javascript
const { app, BrowserWindow } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.loadURL('http://localhost:3000/video-creation-platform.html');
}

app.whenReady().then(createWindow);
```

Chạy:
```bash
electron .
```

## 🎯 Quick Deploy Checklist

- [ ] Code đã test local
- [ ] Dependencies đã cài (`npm install --production`)
- [ ] Environment variables đã set
- [ ] Port 3000 đã mở (hoặc đổi port)
- [ ] Domain đã point DNS (nếu có)
- [ ] SSL certificate đã cấu hình (production)
- [ ] PM2/Docker đã setup (production)
- [ ] Monitoring đã active
- [ ] Backup strategy đã plan

## 🆘 Troubleshooting Deploy

### Port đang bị chiếm
```bash
# Tìm process
lsof -i :3000

# Kill process
kill -9 PID

# Hoặc đổi port
PORT=3001 node server.js
```

### Memory issues
```bash
# Tăng memory cho Node
node --max-old-space-size=4096 server.js
```

### RSS feeds không hoạt động
- Check firewall
- Check DNS resolution
- Test RSS URL trực tiếp: `curl https://vnexpress.net/rss/tin-moi-nhat.rss`

## 📞 Support

Nếu gặp vấn đề, check:
1. Server logs: `pm2 logs` hoặc `docker logs`
2. Browser console (F12)
3. Network tab trong DevTools