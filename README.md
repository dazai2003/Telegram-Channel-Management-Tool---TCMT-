# Telegram Channel Management Tool (TCMT)

An all-in-one Telegram administration suite for cross-channel member auditing, automated high-speed join request approvals, and coordinated global ban/wipeout protection with a real-time web dashboard.

---

## Key Features

### 1. Member Cross-Purge Studio
* **Duplicate Detection**: Cross-references subscribers in a **Source Paid/VIP Channel** against a **Target Free Group**.
* **One-Click Multi-Member Removal**: Permanently bans overlapping members from free groups to prevent unauthorized access.
* **Safe Ban Pacing & FloodWait Protection**: Configurable delay per removal with automatic pause-and-resume handling when Telegram rate limits are encountered.
* **Admin & Bot Safety Shield**: Automatically exempts administrators, creators, and bots from accidental purging.
* **CSV Export**: Export overlapping member lists with user IDs, names, and handles.

### 2. Auto Join Request Approver
* **Live Applicant Review**: Inspect pending join requests across any administered channel or supergroup.
* **Turbo Approve (1-Click Instant Clear)**: Automatically processes and approves thousands of pending requests across multiple batches until the queue is completely cleared.
* **Hands-Free Auto-Pilot Daemon**: A background worker that continuously monitors incoming join requests and auto-approves them at scheduled intervals.
* **Blacklist Sentinel Intercept**: Automatically detects blacklisted bad actors attempting to join and rejects + bans them instantly.
* **Live SSE Progress Stream**: Real-time terminal logs, live percentage bars, and instant visual feedback.

### 3. Global Ban & Total Wipeout Shield
* **Multi-Channel & Group Exclusion**: Bans bad actors across **ALL** channels and groups where your account is an **Owner OR Admin**.
* **Universal Message Vaporization**: Deletes every past message, photo, link, and reply ever sent by the target across all your administered groups.
* **2-Way Private Chat Erasure (`revoke=True`)**: Completely deletes direct message history from both sides, leaving no conversation trail.
* **Personal Telegram Block & Contact Severing**: Blocks target on your personal account, hides your profile/avatar, and deletes mutual contact synchronization.
* **Invite Link Rotation**: Invalidate active primary invite links across owned channels so any saved links expire immediately.
* **Persistent Blacklist Sentinel**: Local database (`blacklist.json`) ensuring bad actors can never re-enter via join requests.

### 4. Dual-Theme Web Interface
* **Frutiger Aero Glass Theme**: Authentic Windows Vista / 7 aero glass aesthetic with rich gradients, glassy overlays, and glossy buttons.
* **Modern Dark Theme**: Sleek, high-contrast dark dashboard for night operation.
* **Zero Emojis**: Clean, vector SVG icons used throughout the interface and terminal logs.

---

## Technology Stack

* **Backend**: Python 3.10+, [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/)
* **Telegram MTProto Client**: [Telethon](https://github.com/LonamiWebs/Telethon)
* **Real-Time Updates**: Server-Sent Events (SSE) Streaming
* **Frontend**: HTML5, Vanilla CSS (Glassmorphism design tokens), Vanilla JavaScript (No heavy frameworks)
* **Icons**: Pure SVG Vector Icons

---

## Installation & Setup

### 1. Prerequisites
* Python 3.10 or higher installed.
* Telegram API credentials (`api_id` and `api_hash`) from [my.telegram.org](https://my.telegram.org).

### 2. Clone the Repository
```bash
git clone https://github.com/dazai2003/Telegram-Channel-Management-Tool---TCMT-.git
cd Telegram-Channel-Management-Tool---TCMT-
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Start the Application
On Windows, you can simply run:
```bat
run.bat
```
Or start manually via Python:
```bash
python main.py
```

### 5. Access the Web Dashboard
Open your browser and navigate to:
```
http://localhost:8080
```

---

## Configuration

On first launch, you can connect your Telegram account directly from the web dashboard:
1. Click **"Connect Telegram"** in the top header.
2. Enter your phone number in international format (e.g. `+1234567890`).
3. Click **"API ID & Hash Settings"** to enter your credentials from [my.telegram.org](https://my.telegram.org).
4. Enter the verification code (and 2FA password if enabled).

Alternatively, you can copy `config.example.json` to `config.json` and enter your credentials manually:
```json
{
  "api_id": 12345678,
  "api_hash": "your_api_hash_here",
  "phone": "+1234567890",
  "safe_delay_seconds": 1.5
}
```

---

## Security & Privacy Notice

* **100% Local Execution**: All session tokens, encryption keys, and configurations are stored locally on your machine in the `session/` folder and `config.json`.
* **Zero External Telemetry**: No user data, messages, or Telegram credentials are ever transmitted to third-party servers.
* **Git Protection**: `.gitignore` is pre-configured to strictly prevent committing any `.session`, `config.json`, or `blacklist.json` files.

---

## Disclaimer

This software is provided for educational and community administration purposes only. Please adhere to Telegram's [Terms of Service](https://telegram.org/tos) and API usage guidelines. Automated actions should be performed with appropriate rate-limiting delays to prevent account restrictions.
