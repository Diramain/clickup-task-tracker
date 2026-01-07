# ClickUp Task Tracker for Gmail

A Firefox extension to create ClickUp tasks directly from Gmail emails with a rich, modern interface.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Firefox](https://img.shields.io/badge/Firefox-Compatible-orange.svg)
![ClickUp](https://img.shields.io/badge/ClickUp-API%20v2-7B68EE.svg)

## ✨ Features

### Task Creation
- **Smart Location Search** - Type to search and auto-select lists with space avatars
- **Assignee Selection** - Search team members with profile avatars
- **Time Tracking** - Set time estimate and track time on creation
- **Date Pickers** - Start and due date selection
- **Email Attachment** - Attach email as HTML file to tasks

### Rich Description Editor
- **WYSIWYG Editor** - Visual editing with formatting toolbar
- **Smart Paste** - Paste HTML content, auto-converts to ClickUp Markdown
- **Source View** - View/edit raw Markdown syntax
- **Markdown Support** - Bold, italic, strikethrough, links, lists

### Attach to Existing Task
- **Dynamic Search** - Search tasks by ID or name (min 4 chars)
- **Real-time Results** - Shows up to 10 matching tasks
- **Quick Attach** - Attach email to existing task with one click

### User Interface
- **Non-blocking Modal** - Interact with Gmail while modal is open
- **Draggable & Resizable** - Move and resize the modal window
- **Keyboard Support** - ESC to close
- **Toast Notifications** - Success/error feedback

### Security (ISO 27001 Compliant)
- **OAuth 2.0** - Secure authentication without storing passwords
- **User-owned Credentials** - Each user creates their own OAuth App
- **CSP-Safe** - No inline scripts, compatible with Gmail's security

## 📦 Installation

1. Download or clone this repository
2. Open `about:debugging` in Firefox
3. Click "This Firefox" → "Load Temporary Add-on"
4. Select `manifest.json`

## ⚙️ Configuration

### 1. Create OAuth App in ClickUp

1. Go to https://app.clickup.com/settings/integrations
2. Click "Create an App"
3. Name: "Gmail Task Tracker"
4. Redirect URL: Copy from the extension popup
5. Copy **Client ID** and **Client Secret**

### 2. Configure the Extension

1. Click the extension icon in Firefox
2. Copy the Redirect URL shown and paste it in your ClickUp OAuth App
3. Enter your Client ID and Client Secret
4. Click "Sign in with ClickUp"
5. Select your default list

## 🚀 Usage

### Create New Task
1. Open Gmail and view an email
2. Click "Add to ClickUp" button
3. Select location (list) using the search bar
4. Add assignees, dates, time estimate
5. Edit description with WYSIWYG editor
6. Click "Create Task"

### Attach to Existing Task
1. Open the modal and switch to "Attach to Existing" tab
2. Search by task ID or name (minimum 4 characters)
3. Click on the task from results
4. Click "Attach Email"

## 📁 Project Structure

```
clickup-task-tracker/
├── manifest.json              # Firefox WebExtension manifest
├── background/
│   └── background.js          # OAuth flow, API handlers
├── content/
│   ├── gmail.js               # Gmail integration, bar injection
│   ├── gmail.css              # Email bar styles
│   ├── modal.js               # Task creation modal component
│   └── modal.css              # Modal styles
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── api/
│   └── clickup.js             # ClickUp API wrapper
└── icons/                     # Extension icons
```

## 🔌 API Endpoints Used

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/team` | GET | Get authorized workspaces |
| `/team/{id}/space` | GET | Get spaces in workspace |
| `/space/{id}/folder` | GET | Get folders in space |
| `/space/{id}/list` | GET | Get lists in space |
| `/folder/{id}/list` | GET | Get lists in folder |
| `/list/{id}/task` | POST | Create task |
| `/task/{id}` | GET | Get task details |
| `/task/{id}/comment` | POST | Add comment to task |
| `/task/{id}/attachment` | POST | Upload attachment |
| `/team/{id}/time_entries` | POST | Track time |

## 🙏 Credits

- **Architectural Inspiration**: Gmail view detection patterns inspired by general web extension development practices
- **API**: [ClickUp API v2](https://clickup.com/api) - Official ClickUp REST API
- **Built with**: Vanilla JavaScript, no external dependencies

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

Free for personal and commercial use.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you encounter any issues, please open an issue on GitHub.
