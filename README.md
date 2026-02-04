# 🌐 Auto Indexer - Web Sitemap Submitter

Submit sitemap URLs ke **Google**, **Bing (IndexNow)**, dan **Naver** secara otomatis dengan satu klik.

![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-7-purple)
![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7)

## ✨ Fitur

- 📥 **Input Sitemap** - Via URL atau upload file XML
- 🔍 **Auto Parse** - Ekstrak semua URL dari sitemap
- 🚀 **Multi-Platform Submit** - Google, Bing, Naver dalam satu proses
- 📊 **Real-time Progress** - Live logs dan status tracking
- 🎨 **Modern Dark UI** - Clean design dengan gradient

## 🔧 Tech Stack

| Frontend | Backend | Deployment |
|----------|---------|------------|
| React 19 | Netlify Functions | Netlify |
| Vite 7 | Node.js | Serverless |
| Lucide Icons | fast-xml-parser | - |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Netlify CLI (`npm install -g netlify-cli`)

### Installation

```bash
# Clone & install
git clone <your-repo-url>
cd autosubmitindexerbysitemap
npm install

# Run locally
netlify dev
```

Buka `http://localhost:8888` di browser.

## ⚙️ Environment Variables

Set di Netlify Dashboard → Site Settings → Environment Variables:

| Variable | Deskripsi | Cara Dapat |
|----------|-----------|------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service Account JSON (satu baris) | [Google Cloud Console](https://console.cloud.google.com/) → IAM → Service Accounts |
| `BING_API_KEY` | API Key untuk IndexNow | [Bing Webmaster Tools](https://www.bing.com/webmasters/) |
| `NAVER_CLIENT_ID` | Client ID Naver | [Naver Search Advisor](https://searchadvisor.naver.com/) |
| `NAVER_CLIENT_SECRET` | Client Secret Naver | [Naver Search Advisor](https://searchadvisor.naver.com/) |

### Google Service Account Setup

1. Buat project di Google Cloud Console
2. Enable **Indexing API**
3. Create Service Account dengan role **Owner**
4. Download JSON key
5. Paste seluruh isi JSON (dalam 1 baris) ke env var

## 📁 Struktur Proyek

```
/project-root
├── /netlify
│   └── /functions
│       ├── fetch-sitemap.js   # CORS proxy untuk fetch sitemap
│       ├── submit-google.js   # Google Indexing API
│       ├── submit-bing.js     # IndexNow API
│       └── submit-naver.js    # Naver API
├── /src
│   ├── App.jsx                # Main UI component
│   ├── parser.js              # XML parser logic
│   └── index.css              # Styles
├── netlify.toml               # Netlify config
└── package.json
```

## 🌍 Deploy ke Netlify

### Via Netlify Dashboard
1. Push code ke GitHub
2. Netlify → Add new site → Import existing project
3. Connect GitHub repo
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Set environment variables
7. Deploy!

### Via CLI
```bash
netlify login
netlify init
netlify deploy --prod
```

## ⚠️ Batasan & Notes

- **Google**: Kuota ~200 URL/hari untuk akun baru
- **Bing**: IndexNow tidak ada limit, tapi rate limit apply
- **Naver**: Implementasi mock (API access terbatas di luar Korea)

## 📝 License

MIT License - Feel free to use and modify!
