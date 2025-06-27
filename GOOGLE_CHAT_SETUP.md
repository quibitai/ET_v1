# Google Chat API Setup Guide

## 🚨 **Important: Chat App Configuration Required**

Unlike other Google APIs (Gmail, Drive, Calendar), the Google Chat API **requires** a Chat App to be configured and **LIVE** in Google Cloud Console, even when using user authentication (OAuth). This is by design.

## 📋 **Setup Steps**

### 1. **Navigate to Google Cloud Console**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project: `echo-tango-quibit-rag`

### 2. **Enable Google Chat API**

1. Go to **APIs & Services** → **Library**
2. Search for "Google Chat API"
3. Click **Enable** (if not already enabled)

### 3. **Configure the Chat App**

1. Go to **APIs & Services** → **Enabled APIs & Services**
2. Click on **Google Chat API**
3. Click on the **Configuration** tab
4. Fill in the required fields:

   **App Information:**

   - **App name**: `Echo Tango Chat Integration`
   - **Avatar URL**: `https://developers.google.com/chat/images/quickstart-app-avatar.png`
   - **Description**: `Internal integration for Echo Tango workspace automation`

   **Interactive features:**

   - ✅ **Enable interactive features**: `OFF` (we don't need interactive features)

   **Functionality:**

   - ✅ **Receive 1:1 messages**: `OFF`
   - ✅ **Join spaces and group conversations**: `OFF`

   **Connection settings:**

   - Since we're not using interactive features, leave this empty

   **Visibility:**

   - ✅ **Make this Chat app available to specific people and groups in Echo Tango domain**: `ON`
   - Add your email and any other users who need access

5. Click **Save**

### 4. **Verify App Status**

After saving, you should see:

- **Status**: `LIVE` (green indicator)
- This means the Chat App is active and can be used for API calls

## 🔍 **Why This is Required**

From Google's documentation:

> "When authenticated with a service account, to get data about or perform actions in a Chat space, Chat apps must have membership in the space."

Even with **user authentication**, the Google Chat API architecture requires:

1. A Chat App to be configured (provides the API identity)
2. Proper OAuth scopes for user authentication
3. The user to be a member of the spaces they want to access

## 🧪 **Testing the Setup**

After completing the setup, test with:

```bash
curl -X POST http://localhost:3000/api/chat/send-message \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "userEmail": "adam@echotango.co"}'
```

You should now see OAuth authentication flow instead of the "Chat app is inactive" error.

## 📚 **Key Differences from Other Google APIs**

| API      | Requires App Configuration | User Auth Only |
| -------- | -------------------------- | -------------- |
| Gmail    | ❌ No                      | ✅ Yes         |
| Drive    | ❌ No                      | ✅ Yes         |
| Calendar | ❌ No                      | ✅ Yes         |
| **Chat** | ✅ **Yes**                 | ❌ **No**      |

## 🔧 **OAuth Scopes Configured**

Our MCP server is correctly configured with:

- `https://www.googleapis.com/auth/chat.spaces.readonly`
- `https://www.googleapis.com/auth/chat.spaces`
- `https://www.googleapis.com/auth/chat.messages.readonly`
- `https://www.googleapis.com/auth/chat.messages.create`
- `https://www.googleapis.com/auth/chat.messages`

## ✅ **Expected Behavior After Setup**

1. **First API Call**: Will redirect to OAuth consent screen
2. **User Grants Permission**: User authorizes the required scopes
3. **API Calls Work**: `list_spaces`, `send_message`, etc. will work
4. **User-Based Results**: API returns data for the authenticated user, not the Chat App

## 🚫 **What We're NOT Building**

We are **not** building:

- An interactive Chat bot
- A Chat App that receives messages
- A Chat App that responds to @mentions

We **are** building:

- A server-side integration that uses Chat API on behalf of users
- User authentication to access Chat data/send messages
- OAuth-based access to Chat spaces the user is a member of
