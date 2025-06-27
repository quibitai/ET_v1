# Production Deployment Guide

> **Complete guide for deploying ET_v001 RAG system to Vercel production**  
> **Status**: Ready for deployment after successful Week 1 infrastructure validation  
> **Last Updated**: January 2025  

## 🎯 **Deployment Readiness Status**

### ✅ **Prerequisites Met**
- ✅ Core tool calling and streaming validated
- ✅ MCP integration working (Asana + Google Workspace)
- ✅ Response times optimized (7-17 seconds)
- ✅ No schema validation errors
- ✅ Streaming infrastructure stable
- ✅ Database migrations ready

## 🚀 **Vercel Deployment Steps**

### **Step 1: Install Vercel CLI**
```bash
npm i -g vercel
# or
pnpm add -g vercel
```

### **Step 2: Connect to Vercel**
```bash
vercel login
vercel link
```

### **Step 3: Configure Environment Variables**

In Vercel Dashboard → Settings → Environment Variables, add:

#### **Core Database & Authentication**
```bash
# Database
POSTGRES_URL=postgresql://username:password@host:port/database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
NEXTAUTH_SECRET=your_nextauth_secret_32_chars_min
NEXTAUTH_URL=https://your-domain.vercel.app
```

#### **AI Services**
```bash
# OpenAI (Required)
OPENAI_API_KEY=sk-your_openai_api_key
DEFAULT_MODEL_NAME=gpt-4.1-mini

# Optional AI Services
ANTHROPIC_API_KEY=sk-ant-your_anthropic_key
```

#### **Tool Integrations**
```bash
# Web Search
TAVILY_API_KEY=tvly-your_tavily_api_key

# Asana Integration
ASANA_ACCESS_TOKEN=your_asana_personal_access_token
DEFAULT_WORKSPACE_ID=your_default_asana_workspace_id

# Google Workspace (if using)
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_CLIENT_SECRETS={"web":{"client_id":"...","client_secret":"..."}}
GOOGLE_WORKSPACE_MCP_SERVER_URL=http://localhost:8001

# Google Calendar Integration (if using)
GOOGLE_CALENDAR_WEBHOOK_URL=your_calendar_webhook_url
GOOGLE_CALENDAR_AUTH_TOKEN=your_calendar_auth_token
GOOGLE_CALENDAR_AUTH_HEADER=your_calendar_auth_header
GOOGLE_CALENDAR_TIMEOUT_MS=30000
```

#### **Security & Encryption**
```bash
# Token Encryption
TOKEN_ENCRYPTION_KEY=your_32_character_encryption_key
```

#### **Production Configuration**
```bash
# Environment
NODE_ENV=production

# Logging & Observability
LOG_LEVEL=1
OBSERVABILITY_QUIET=true

# Feature Flags
USE_MODERN_BRAIN_API=true
```

#### **Optional Development/Testing**
```bash
# Only if needed for testing
PLAYWRIGHT_TEST_BASE_URL=https://your-domain.vercel.app
```

### **Step 4: Deploy**
```bash
vercel --prod
```

## 🔧 **Vercel Configuration**

### **Enhanced vercel.json**
```json
{
  "version": 2,
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "app/api/brain/route.ts": {
      "maxDuration": 60
    },
    "app/api/documents/**/route.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ]
}
```

## 🗄️ **Database Setup**

### **PostgreSQL Database**
1. **Create Production Database** (recommended: Supabase, Railway, or Neon)
2. **Run Migrations**:
   ```bash
   pnpm db:migrate
   ```
3. **Verify Schema**:
   ```bash
   pnpm db:studio
   ```

### **Required Tables**
- `users` - User authentication and profiles
- `chats` - Chat sessions
- `messages` - Chat messages
- `documents` - Knowledge base documents
- `clients` - Client configurations
- `conversational_memory` - Memory storage
- `mcp_integrations` - MCP tool configurations

## 🔐 **Security Configuration**

### **Domain Restriction (echotango.co)**
Update `app/(auth)/auth.config.ts`:
```typescript
export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          hd: "echotango.co" // Restrict to echotango.co domain
        }
      }
    })
  ],
  callbacks: {
    signIn({ user, account, profile }) {
      // Verify user is from echotango.co domain
      if (user.email?.endsWith('@echotango.co')) {
        return true;
      }
      return false;
    }
  }
}
```

### **Environment Security**
- Use Vercel's encrypted environment variables
- Rotate API keys regularly
- Use separate keys for production vs development
- Enable Vercel's security headers

## 🔧 **MCP Server Configuration**

### **Option 1: Disable MCP for Initial Deployment**
For a simpler initial deployment, you can disable MCP integration:
```bash
# In Vercel environment variables, leave these unset:
# ASANA_ACCESS_TOKEN
# GOOGLE_CLIENT_SECRETS
```

### **Option 2: Deploy with MCP (Advanced)**
If you want full MCP functionality in production:

1. **Deploy MCP servers separately** (e.g., Railway, Render)
2. **Update MCP server URLs** in environment variables
3. **Ensure network connectivity** between Vercel and MCP servers

## 📊 **Monitoring & Observability**

### **Production Logging**
```bash
LOG_LEVEL=1                    # Minimal logging for production
OBSERVABILITY_QUIET=true       # Reduce verbose output
NODE_ENV=production            # Production optimizations
```

### **Health Checks**
The application includes health check endpoints:
- `GET /api/ping` - Basic health check
- `GET /api/brain` - Brain API health check

### **Performance Monitoring**
- Monitor response times (target: <10 seconds for most queries)
- Track error rates through Vercel Analytics
- Monitor database connection pool usage

## 🧪 **Pre-Deployment Testing**

### **Local Production Build**
```bash
pnpm build
pnpm start
```

### **Environment Variable Validation**
```bash
# Test with production environment variables locally
cp .env.local .env.production.local
# Update with production values
pnpm build && pnpm start
```

### **Critical Test Cases**
1. **Authentication**: Login with echotango.co email
2. **Knowledge Base**: List documents, search functionality
3. **Tool Integration**: Test core tools work properly
4. **Streaming**: Verify response streaming works
5. **MCP Integration**: Test Asana tools (if enabled)

## 🚨 **Deployment Checklist**

### **Pre-Deployment**
- [ ] All environment variables configured in Vercel
- [ ] Database migrations applied
- [ ] Domain restriction configured
- [ ] Security headers enabled
- [ ] Production build tested locally

### **Post-Deployment**
- [ ] Health check endpoints responding
- [ ] Authentication working with domain restriction
- [ ] Knowledge base queries working
- [ ] Tool calling functional
- [ ] Streaming responses working
- [ ] Error monitoring active

### **Optional (MCP Integration)**
- [ ] Asana MCP tools working
- [ ] Google Workspace integration functional
- [ ] MCP server health checks passing

## 🔄 **Rollback Plan**

### **Quick Rollback**
```bash
vercel rollback [deployment-url]
```

### **Environment Rollback**
1. Revert environment variables in Vercel dashboard
2. Redeploy with previous configuration
3. Verify functionality

## 📞 **Support & Troubleshooting**

### **Common Issues**
1. **Database Connection**: Verify POSTGRES_URL format
2. **Authentication**: Check NEXTAUTH_SECRET and domain restriction
3. **API Keys**: Verify all required API keys are set
4. **MCP Integration**: Check server URLs and network connectivity

### **Debug Mode**
For troubleshooting, temporarily enable:
```bash
LOG_LEVEL=3
OBSERVABILITY_QUIET=false
```

### **Logs Access**
```bash
vercel logs [deployment-url]
```

## 🎯 **Success Metrics**

### **Performance Targets**
- Response time: <10 seconds for 95% of queries
- Uptime: >99.9%
- Error rate: <1%

### **Functionality Validation**
- ✅ User authentication with domain restriction
- ✅ Knowledge base search and retrieval
- ✅ Tool calling and streaming
- ✅ Chat history persistence
- ✅ MCP integration (if enabled)

---

> **Ready for Production**: This guide reflects the stable infrastructure achieved in Week 1 of the development roadmap. All critical issues have been resolved and the system is ready for production deployment. 