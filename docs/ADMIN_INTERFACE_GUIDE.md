# Admin Interface Guide - Echo Tango v1.0.0

> **Complete Admin Dashboard with Modern Tabbed Interface**  
> **Last Updated**: January 2025

## 🎯 **Overview**

The Echo Tango admin interface provides a comprehensive, production-ready dashboard for managing all aspects of your RAG system. The interface has been completely redesigned with a modern tabbed layout, consolidating all administrative functions into a single, intuitive interface.

## 🔐 **Access & Authentication**

### **Admin Access Requirements**
Access to the admin interface is restricted to users with admin privileges:

- **Email-based Authentication**: Users with emails containing:
  - `admin` (e.g., `admin@company.com`)
  - `hayden` (e.g., `adam.hayden@company.com`)
  - `adam@quibit.ai` (system administrator)

### **Accessing the Admin Dashboard**
1. **Login** to the system with an admin-authorized email
2. **Navigate** to the admin dashboard via:
   - **Sidebar Menu**: Click "Admin Dashboard" in the user navigation
   - **Direct URL**: Visit `/admin` directly
3. **Dashboard Access**: The interface loads with full administrative capabilities

## 🏗️ **Dashboard Architecture**

### **Consolidated Interface Design**
The admin interface features a modern, tabbed design with three main sections:

```
┌─────────────────────────────────────────────────────────────┐
│  🎛️ Admin Dashboard - Echo Tango                           │
├─────────────────────────────────────────────────────────────┤
│  📊 Overview  │  ⚙️ Configuration  │  📈 Observability     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Tab-specific content with proper scrolling]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### **Tab Structure**
- **📊 Overview**: System metrics, health status, and quick actions
- **⚙️ Configuration**: Client and specialist management
- **📈 Observability**: Analytics, monitoring, and performance metrics

## ⚙️ **Configuration Tab - Enhanced Features**

### **Specialist Management with Visual Tool Selection**

#### **Three-Tab Specialist Editor**
The specialist editor now features a comprehensive interface:

##### **🛠️ Tools & Capabilities Tab**
**NEW**: Visual Tool Selection Interface with 16+ categorized tools:

**Search & Knowledge (3 tools):**
- `searchInternalKnowledgeBase` - Semantic knowledge search
- `getFileContents` - Document retrieval  
- `listDocuments` - Knowledge base exploration

**Document Management (2 tools):**
- `createDocument` - Dynamic document generation
- `updateDocument` - Content modification

**Project Management (7 Asana tools):**
- `asana_get_user_info` - User profile access
- `asana_create_project` - Project creation
- `asana_get_task_details` - Task information
- `asana_list_users` - Team management
- `asana_search_entity` - Cross-entity search
- `asana_list_subtasks` - Hierarchical tasks
- `asana_add_followers` - Collaboration features

**Utilities (3 tools):**
- `tavilyExtract` - Web content extraction
- `getWeatherTool` - Weather information
- `requestSuggestions` - AI suggestions

**Tool Selection Features:**
- ✅ **Visual Checkboxes**: Easy tool selection interface
- 📊 **Category Grouping**: Organized by functionality
- 🔢 **Real-time Counters**: Selected tool count display
- 📝 **Tool Descriptions**: Detailed capability explanations
- 🎯 **Select All/None**: Category-level selection

##### **🤖 AI Persona Tab with AI Enhancement**
**NEW**: AI-Powered Prompt Refinement

The "AI Enhance" button provides intelligent prompt optimization:
- **Context-Aware**: Analyzes selected tools and capabilities
- **Tool Integration**: Incorporates tool-specific instructions
- **Best Practices**: Applies proven prompt engineering techniques
- **Personality Preservation**: Maintains core specialist identity

## 🔧 **Technical Implementation**

### **Component Architecture**
```typescript
AdminDashboard
├── TabsRoot
│   ├── OverviewTab (System metrics and health)
│   ├── ConfigurationTab
│   │   ├── ClientEditor (CRUD operations)
│   │   └── SpecialistEditor
│   │       ├── BasicInfoTab
│   │       ├── ToolsCapabilitiesTab (Visual selection)
│   │       └── AIPersonaTab (AI enhancement)
│   └── ObservabilityTab (Analytics and monitoring)
```

### **New API Endpoints**
- **`/api/admin/refine-prompt`**: AI-powered prompt enhancement
- **Database Operations**: Direct integration with Drizzle ORM
- **Real-time Updates**: Server-side component refresh

### **UI/UX Improvements**
- **Responsive Design**: Mobile-first with proper viewport handling
- **Professional Styling**: Shadcn components with consistent theming
- **Proper Scrolling**: Viewport-constrained with overflow management
- **Accessibility**: Full keyboard navigation and screen reader support

## 🚀 **Usage Workflow**

### **Creating/Editing Specialists**
1. Navigate to Configuration tab
2. Select specialist or create new
3. **Basic Info**: Enter name, description, context ID
4. **Tools Selection**: Use visual checkboxes to select tools
5. **AI Persona**: Write prompt or use "AI Enhance" for optimization
6. Save - changes apply immediately without redeployment

### **AI Enhancement Process**
```
User Prompt → Context Analysis → Tool Integration → Enhanced Prompt
              ↓                  ↓                 ↓
         Current Tools      Capability Mapping   Optimized Instructions
```

## 📚 **Related Documentation**
- **[Architecture Overview](../ARCHITECTURE.md)**: System design
- **[Tool Documentation](TOOLS.md)**: Complete tool reference
- **[Configuration Guide](configuration-json-guide.md)**: Advanced config
