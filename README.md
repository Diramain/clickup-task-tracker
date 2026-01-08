# ClickUp Task Tracker for Gmail

> 🤖 **Built with AI**: This extension was developed with the assistance of AI (Anthropic Claude) in pair programming sessions.

A Firefox extension to create ClickUp tasks directly from Gmail emails with a rich, modern interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Firefox](https://img.shields.io/badge/Firefox-Compatible-orange.svg)
![ClickUp](https://img.shields.io/badge/ClickUp-API%20v2-7B68EE.svg)
![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red.svg)

---

## ✨ Features

### Task Creation
- **Smart Location Search** - Type to search and auto-select lists with space avatars
- **Assignee Selection** - Search team members with profile avatars
- **Time Tracking** - Set time estimate and track time on creation
- **Date Pickers** - Start and due date selection
- **Email Attachment** - Attach email as HTML file to tasks
- **Gmail Link in Comments** - Automatic comment with link back to the email

### Rich Description Editor
- **WYSIWYG Editor** - Visual editing with formatting toolbar
- **Smart Paste** - Paste HTML content, auto-converts to ClickUp Markdown
- **Markdown Support** - Bold, italic, strikethrough, headings (H1-H4), code blocks, blockquotes, lists
- **Keyboard Shortcuts** - Ctrl+B (bold), Ctrl+I (italic), Ctrl+S (strikethrough), Ctrl+K (link)

### Task Linking
- **Inbox Badges** - Shows linked task IDs in inbox list view
- **Persistence** - Tasks are linked by Gmail Thread ID
- **Smart Search** - Searches ClickUp for linked tasks even after extension reload

### Security (ISO 27001 Compliant)
- **OAuth 2.0** - Secure authentication without storing passwords
- **User-owned Credentials** - Each user creates their own OAuth App
- **CSP-Safe** - No inline scripts, compatible with Gmail's Content Security Policy
- **No Telemetry** - Zero tracking or analytics

---

## 📁 Project Structure

```
clickup-task-tracker/
├── manifest.json              # Firefox WebExtension manifest (Manifest V2)
├── api/
│   └── clickup.js             # ClickUp API v2 wrapper class
├── background/
│   └── background.js          # Service worker: OAuth, message routing, storage
├── content/
│   ├── gmail.js               # Gmail DOM integration, bar injection
│   ├── gmail.css              # Styles for email bar and inbox badges
│   ├── modal.js               # Task creation/attach modal component
│   └── modal.css              # Modal styles with WYSIWYG editor
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup logic and OAuth configuration
│   └── popup.css              # Popup styles
├── assets/                    # Extension icons (16, 32, 48, 128px)
├── README.md                  # This file
├── LICENSE                    # MIT License
└── .gitignore                 # Git ignore rules
```

---

## 🏗️ Technical Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                           GMAIL                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  gmail.js    │───▶│  modal.js    │───▶│ background.js│      │
│  │ (DOM inject) │    │ (UI modal)   │    │ (API bridge) │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Extract email│    │Create/Attach │    │ clickup.js   │      │
│  │ threadId     │    │ task data    │    │ (API wrapper)│      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────┐
                                          │  ClickUp API v2  │
                                          │  api.clickup.com │
                                          └──────────────────┘
```

### Key Components

#### `gmail.js` - Content Script
- Injects ClickUp bar into Gmail email view
- Shows task badges in inbox list
- Extracts email data (threadId, from, subject, HTML body)
- Uses MutationObserver for Gmail's dynamic DOM
- Debounced scanning to optimize performance

#### `modal.js` - UI Component
- Draggable, resizable modal window
- WYSIWYG description editor with toolbar
- Location search with debounced API calls
- Assignee picker with avatar display
- Converts HTML to ClickUp Markdown on paste

#### `background.js` - Service Worker
- OAuth 2.0 flow handler
- Message routing between content scripts and popup
- Email-task mapping storage (`browser.storage.local`)
- Task search for persistence

#### `clickup.js` - API Wrapper
- Clean interface to ClickUp REST API v2
- Methods: `getTeams()`, `getSpaces()`, `createTask()`, `searchTasks()`, `addComment()`, `uploadAttachment()`
- Automatic token management

### Storage Schema

```javascript
// browser.storage.local
{
  "clickupToken": "pk_xxx...",           // OAuth access token
  "clickupRefreshToken": "xxx...",       // OAuth refresh token
  "oauthConfig": {                       // User's OAuth app credentials
    "clientId": "xxx",
    "clientSecret": "xxx"
  },
  "defaultList": "list_id",              // Selected default list
  "emailTaskMappings": {                 // Thread-to-task links
    "threadId123": [
      { "id": "taskId", "name": "Task Name", "url": "https://..." }
    ]
  }
}
```

---

## 🔌 API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/team` | GET | Get authorized workspaces |
| `/team/{id}/space` | GET | Get spaces in workspace |
| `/space/{id}/folder` | GET | Get folders in space |
| `/space/{id}/list` | GET | Get lists in space |
| `/folder/{id}/list` | GET | Get lists in folder |
| `/list/{id}/task` | POST | Create task |
| `/list/{id}/member` | GET | Get list members |
| `/task/{id}` | GET | Get task details |
| `/task/{id}/comment` | POST | Add comment to task |
| `/task/{id}/attachment` | POST | Upload attachment |
| `/team/{id}/task?query=` | GET | Search tasks |

---

## 📦 Installation (Development)

1. Clone or download this repository
2. Open `about:debugging` in Firefox
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select `manifest.json`

## ⚙️ Configuration

### 1. Create OAuth App in ClickUp

1. Go to https://app.clickup.com/settings/integrations
2. Click "Create an App"
3. Name: "Gmail Task Tracker" (or your preferred name)
4. Redirect URL: Copy from the extension popup
5. Copy **Client ID** and **Client Secret**

### 2. Configure the Extension

1. Click the extension icon in Firefox
2. Copy the Redirect URL shown and paste it in your ClickUp OAuth App
3. Enter your Client ID and Client Secret
4. Click "Sign in with ClickUp"
5. Select your default list

---

## 🚀 Publishing to Production

### Option 1: Firefox Add-ons (AMO) with Embedded OAuth

To avoid requiring each user to create their own OAuth app:

1. **Create a Public OAuth App in ClickUp**
   - Go to https://app.clickup.com/settings/integrations
   - Create an app with a generic redirect URL
   - Note: ClickUp may have policies about shared OAuth apps

2. **Embed Credentials (Not Recommended for Security)**
   - Hardcode `clientId` in `popup.js`
   - Use a backend proxy for `clientSecret` (never expose in client code)

3. **Better: Use a Backend Proxy**
   - Create a simple serverless function (Cloudflare Workers, Vercel, etc.)
   - Extension calls your proxy → Proxy handles OAuth with ClickUp
   - Keeps `clientSecret` secure on server

### Option 2: Keep User-Managed OAuth (Current)

This is the **most secure** approach:
- Each user creates their own OAuth app
- No shared credentials
- Users have full control

### Publishing Steps

1. **Prepare for AMO**
   ```bash
   # Create zip for submission
   zip -r clickup-task-tracker.zip . -x "*.git*" -x "*.log"
   ```

2. **Submit to Firefox Add-ons**
   - Go to https://addons.mozilla.org/developers/
   - Create account / Sign in
   - Click "Submit a New Add-on"
   - Upload the zip file
   - Fill in description, screenshots, privacy policy
   - Submit for review

3. **GitHub Repository**
   ```bash
   git init
   git add .
   git commit -m "Initial release"
   git remote add origin https://github.com/YOUR_USER/clickup-gmail-extension.git
   git push -u origin main
   ```

---

## 🙏 Credits

- **Built with AI**: Developed in pair programming sessions with [Anthropic Claude](https://anthropic.com)
- **API**: [ClickUp API v2](https://clickup.com/api) - Official ClickUp REST API
- **Framework**: Pure JavaScript - No external dependencies
- **Icons**: Custom SVG icons

---

## 📄 License

**MIT License** - Free and Open Source

Copyright (c) 2024

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

---

## 🤝 Contributing

Contributions are welcome! This is an open source project.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Notes

- No build step required - pure vanilla JavaScript
- Test in Firefox with `about:debugging`
- Check browser console for `[ClickUp Task Tracker]` logs
- Modal component is large (~1400 lines) - consider splitting if adding features

---

## 📞 Support

- **Issues**: Please open an issue on GitHub
- **Pull Requests**: Contributions welcome!
