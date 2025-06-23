from fastapi import FastAPI, Request, HTTPException
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import os

app = FastAPI()

# Extract the necessary scopes from the original project.
# This ensures we use the same permissions.
SCOPES = [
    # Base user info
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",

    # Calendar
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",

    # Drive
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file", # Create/modify files created by the app

    # Gmail
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.labels",

    # Docs
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/documents",

    # Chat
    "https://www.googleapis.com/auth/chat.messages.readonly",
    "https://www.googleapis.com/auth/chat.spaces.readonly",
    "https://www.googleapis.com/auth/chat.memberships.readonly",
    "https://www.googleapis.com/auth/chat.messages", # Full access to messages

    # Sheets
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/spreadsheets",

    # Forms
    "https://www.googleapis.com/auth/forms.body",
    "https://www.googleapis.com/auth/forms.body.readonly",
    "https://www.googleapis.com/auth/forms.responses.readonly",

    # Slides
    "https://www.googleapis.com/auth/presentations.readonly",
    "https://www.googleapis.com/auth/presentations",
]

def get_credentials_from_request(request: Request) -> Credentials:
    """Extracts token from Authorization header and creates a Credentials object."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing or invalid")

    token = auth_header.split(" ", 1)[1]
    
    # These are needed to create a valid Credentials object that can be used
    # by the googleapiclient, even though we aren't refreshing the token here.
    client_id = os.getenv("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Server is missing Google OAuth client configuration")

    return Credentials(
        token=token,
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )

@app.post("/gdrive/list_files")
async def list_drive_files(request: Request):
    """Lists files in the user's Google Drive."""
    try:
        credentials = get_credentials_from_request(request)
        service = build('drive', 'v3', credentials=credentials)
        
        results = service.files().list(
            pageSize=20, # Limit results for this example
            fields="nextPageToken, files(id, name, mimeType, webViewLink)"
        ).execute()
        
        files = results.get('files', [])
        return {"files": files}
    except HTTPException as e:
        raise e # Re-raise our own HTTP exceptions
    except Exception as e:
        # Catch potential errors from the Google API client, like an expired token
        return HTTPException(status_code=400, detail=f"Error calling Google Drive API: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "ok"} 