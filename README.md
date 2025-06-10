# Echo Tango RAG Application

A production-ready, streamlined RAG (Retrieval-Augmented Generation) application built specifically for Echo Tango. This application provides intelligent conversation capabilities with integrated tool access including Google Calendar, Asana project management, web search, and internal knowledge base search.

## 🚀 Features

### Core RAG Capabilities
- **Advanced AI Conversation**: Powered by multiple language models with intelligent routing
- **Context-Aware Responses**: Retrieval-augmented generation for accurate, sourced answers
- **Real-Time Streaming**: Progressive response generation with word-by-word streaming
- **Memory Management**: Persistent conversation history and context retention

### Integrated Tools
- **🔍 Web Search**: Tavily-powered real-time web search capabilities
- **📅 Google Calendar**: Full calendar integration for scheduling and event management
- **📋 Asana Integration**: Project management and task tracking
- **📚 Internal Knowledge Base**: Search through organizational documents and resources
- **🌤️ Weather Information**: Current weather data and forecasts

### Echo Tango Specialist
- **Dedicated AI Specialist**: Custom-configured `echo-tango-specialist` with optimized parameters
- **Tailored Responses**: Specialized for Echo Tango's specific needs and workflows
- **Enhanced Context**: Deep understanding of organizational terminology and processes

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15 with React 18 and TypeScript
- **Styling**: Tailwind CSS with custom component library
- **AI/ML**: Vercel AI SDK with LangChain integration
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js with multiple providers
- **Deployment**: Optimized for Vercel with edge functions

### System Design
- **Modular Architecture**: Clean separation of concerns with dedicated service layers
- **Streaming-First**: Real-time response generation and tool execution
- **Error Resilience**: Comprehensive error handling and recovery mechanisms
- **Performance Optimized**: Efficient bundling and minimal dependencies

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Required API keys (see Environment Variables)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/quibitai/ET_v1.git
cd ET_v1

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configurations

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Environment Variables
Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# AI/ML Services
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."

# Tool Integrations
TAVILY_API_KEY="tvly-..."
GOOGLE_CALENDAR_CLIENT_ID="..."
GOOGLE_CALENDAR_CLIENT_SECRET="..."
ASANA_ACCESS_TOKEN="..."

# Weather Service
WEATHER_API_KEY="..."
```

## 📁 Project Structure

```
ET_v001/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication routes
│   ├── (chat)/            # Chat interface routes
│   ├── api/               # API endpoints
│   └── components/        # Page components
├── components/            # Reusable UI components
├── lib/                   # Core application logic
│   ├── ai/               # AI/ML related functionality
│   │   ├── tools/        # Tool integrations
│   │   ├── prompts/      # AI prompts and templates
│   │   └── graphs/       # LangGraph workflow definitions
│   ├── db/               # Database layer
│   └── services/         # Business logic services
├── context/              # React context providers
├── hooks/                # Custom React hooks
└── types/                # TypeScript type definitions
```

## 🔧 Key Components

### AI Tools Integration
Located in `lib/ai/tools/`, each tool provides specific functionality:
- **Asana Tools**: Task management, project tracking, team collaboration
- **Google Calendar**: Event scheduling, calendar management
- **Tavily Search**: Real-time web search and information retrieval
- **Weather Tools**: Location-based weather information
- **Knowledge Base**: Internal document search and retrieval

### Chat Interface
- **Real-time Streaming**: Progressive response generation
- **Tool Visualization**: Clear indication of tool usage and results
- **Context Management**: Maintains conversation history and context
- **Error Handling**: Graceful degradation with informative error messages

### Authentication & Security
- **Multi-provider Auth**: Support for multiple authentication methods
- **Session Management**: Secure session handling with NextAuth.js
- **API Security**: Protected routes with proper authorization
- **Data Privacy**: Secure handling of sensitive information

## 🚀 Deployment

### Vercel Deployment (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy to Vercel
vercel

# Set environment variables in Vercel dashboard
# Configure database connection
# Set up domain and SSL
```

### Environment Configuration
- **Production Database**: Configure PostgreSQL connection
- **API Keys**: Set all required service API keys
- **Domain Setup**: Configure custom domain if needed
- **Monitoring**: Set up error tracking and performance monitoring

## 🔍 Usage

### Starting a Conversation
1. Navigate to the chat interface
2. Begin typing your question or request
3. The AI will automatically determine which tools to use
4. View real-time responses with source attribution

### Tool Usage Examples
- **Calendar**: "Schedule a meeting with the team next Tuesday at 2 PM"
- **Asana**: "Show me my current tasks" or "Create a new project for Q4 planning"
- **Web Search**: "What are the latest trends in AI development?"
- **Weather**: "What's the weather like in San Francisco today?"
- **Knowledge Base**: "Find documents about our company policies"

## 🧪 Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run test suite
npm run db:migrate   # Run database migrations
npm run db:studio    # Open database studio
npm run lint         # Run linting
npm run type-check   # TypeScript type checking
```

### Code Quality
- **TypeScript**: Full type safety with strict configuration
- **ESLint**: Code quality and consistency enforcement
- **Prettier**: Automated code formatting
- **Biome**: Fast linting and formatting

## 📈 Performance & Monitoring

### Optimization Features
- **Efficient Bundling**: Minimal dependencies and optimized builds
- **Streaming Responses**: Real-time AI response generation
- **Edge Functions**: Fast response times with Vercel Edge Runtime
- **Database Optimization**: Efficient queries and connection pooling

### Monitoring
- **Error Tracking**: Comprehensive error logging and reporting
- **Performance Metrics**: Response time and resource usage monitoring
- **Usage Analytics**: Tool usage and conversation analytics

## 🤝 Support & Maintenance

### For Echo Tango Team
- **Documentation**: Comprehensive inline documentation and type definitions
- **Error Handling**: Clear error messages and recovery guidance
- **Logging**: Detailed logging for troubleshooting and optimization
- **Updates**: Regular updates and security patches

### Technical Support
- **Issue Tracking**: GitHub issues for bug reports and feature requests
- **Documentation**: Detailed API documentation and usage guides
- **Code Comments**: Extensive inline documentation for maintainability

## 📄 License

Proprietary software developed for Echo Tango. All rights reserved.

---

**Built with ❤️ for Echo Tango** | **Last Updated**: January 2025