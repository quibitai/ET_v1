# Google OAuth Setup for Gmail Integration

## Current Issue

The Gmail integration is failing because the Google OAuth client credentials are missing.

## Error Details

```
ERROR:auth.google_auth:OAuth client secrets file not found: [Errno 2] No such file or directory: '/Users/adamhayden/Documents/Apps/Quibit_RAG/ET_v001/mcp-workspace/client_secret.json'
```

## Setup Steps

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Google Drive API
   - Google Calendar API
   - Google Docs API
   - Google Sheets API
   - Google Slides API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Choose "Web application"
6. Add these redirect URIs:
   - `http://localhost:8000/oauth2callback`
   - `http://127.0.0.1:8000/oauth2callback`
7. Download the JSON file

### 2. Configure Credentials

**Option A: Place file in project root (RECOMMENDED)**

- Replace the placeholder `client_secret.json` in the project root with your downloaded credentials
- The file should be in this exact location: `/Users/adamhayden/Documents/Apps/Quibit_RAG/ET_v001/client_secret.json`

**Option B: Set environment variable**

- Add to your `.env.local` file:

```bash
GOOGLE_CLIENT_SECRETS=/path/to/your/client_secret.json
```

### 3. File Structure Expected

The `client_secret.json` should look like:

```json
{
  "web": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "project_id": "your-project-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": [
      "http://localhost:8000/oauth2callback",
      "http://127.0.0.1:8000/oauth2callback"
    ]
  }
}
```

### 4. Credentials Storage

User OAuth tokens will be stored in:

- `.credentials/` directory (created automatically)
- Format: `.credentials/{user_email}.json`

### 5. Test the Setup

After setting up the credentials:

1. Restart the MCP server if needed
2. Try the Gmail search again: "search my gmail for emails from chantel@echotango.co"
3. The system should now trigger the OAuth flow and provide a clickable authorization link

## Security Notes

- Add `client_secret.json` to `.gitignore` to avoid committing credentials
- The `.credentials/` directory should also be in `.gitignore`
- Only store these files locally, never commit them to version control
