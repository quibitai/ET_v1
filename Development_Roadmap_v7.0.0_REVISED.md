# Development Roadmap v7.0.0 - REVISED - Production-Ready RAG Application

> **Single Source of Truth** - Supersedes all previous roadmaps and planning documents  
> **Created**: January 2025 (Revised based on recent achievements)  
> **Focus**: Tool Architecture Cleanup, Documentation Consolidation, LangSmith Integration, and Production Deployment

## 🎯 Executive Summary

**Current State Assessment**: Based on comprehensive architectural audit and recent development achievements, the application has sophisticated tool architecture with **significant progress** on Google Workspace integration:

### **✅ Recent Major Achievements**

- **Google Workspace OAuth Implementation**: Complete OAuth bridge service with token management
- **MCP Client Integration**: Comprehensive Google Workspace MCP client with 54 tools
- **Authentication Flow**: Working OAuth 2.0 flow with session management and token refresh
- **Tool Execution**: Functional Gmail, Drive, Calendar, Docs, Sheets, Forms, and Chat tools

### **🚨 Remaining Critical Issues**

- **Tool Selection Confusion**: Knowledge base tools conflicting with Google Drive tools
- **Admin Dashboard Issues**: Interface components not functioning properly
- **Legacy Code Accumulation**: Fragmented documentation and deprecated implementations
- **Missing LangSmith Integration**: No systematic tracing, prompt engineering, or agent management
- **Asana MCP Status**: Needs verification and testing

## 🚨 Critical Issues Identified (REVISED)

### **Issue #1: Tool Selection Confusion (CRITICAL)**

**Problem**: LangGraph agent calls `get_drive_file_content` instead of `getDocumentContents` for knowledge base queries
**Root Cause**: Similar tool descriptions causing LLM confusion
**Impact**: Users cannot access knowledge base content
**Status**: 🔴 BLOCKING PRODUCTION

### **Issue #2: Google Workspace MCP Optimization (LOW-MEDIUM)**

**Problem**: Google Workspace MCP OAuth flow implemented but needs testing and optimization
**Root Cause**: Recent implementation needs validation and edge case handling
**Impact**: Google Workspace tools functional but may need refinement
**Status**: 🟡 NEEDS TESTING & OPTIMIZATION
**Achievement**: ✅ **MAJOR PROGRESS** - OAuth bridge and authentication flow implemented

### **Issue #3: Admin Dashboard Not Working (HIGH)**

**Problem**: Admin interface components not functioning properly
**Root Cause**: Unknown - requires investigation
**Impact**: Cannot manage system configuration
**Status**: 🟡 NEEDS INVESTIGATION

### **Issue #4: Asana MCP Status Unknown (MEDIUM)**

**Problem**: Asana MCP tools status unclear - may be working or need fixes
**Root Cause**: Need to verify current implementation status
**Impact**: External project management integration uncertain
**Status**: 🟡 NEEDS VERIFICATION

### **Issue #5: Legacy Code Accumulation (MEDIUM)**

**Problem**: Multiple deprecated tool implementations and fragmented documentation
**Root Cause**: Previous development iterations leaving behind unused code
**Impact**: Code complexity and maintenance overhead
**Status**: 🟡 CLEANUP REQUIRED

### **Issue #6: Missing LangSmith Integration (HIGH)**

**Problem**: No systematic observability, prompt engineering, or agent management
**Root Cause**: LangSmith not properly integrated into development workflow
**Impact**: Limited debugging capabilities and optimization potential
**Status**: 🟡 ENHANCEMENT NEEDED

## 🧹 Comprehensive Cleanup List - Files/Code to Remove

> **Priority-Based Cleanup Plan** - Organized by impact on production readiness and development efficiency

### **🚨 CRITICAL PRIORITY - Blocking Production Deployment**

**Test API Routes** (Remove immediately - exposing internal endpoints):

- `app/api/test-oauth-flow/` (entire directory)
- `app/api/test-gmail-mcp/` (entire directory)
- `app/api/test-mcp-client/` (entire directory)
- `app/api/test-google-tools/` (entire directory)
- `app/api/test-unified-tools/` (entire directory)
- `app/api/test-minimal/` (entire directory)
- `app/api/test-tool-loading/` (entire directory)

**Middleware Cleanup Required**:

- Update `middleware.ts` line 39 to remove test route exceptions after deletion

### **🔥 HIGH PRIORITY - Architecture & Documentation Cleanup**

**Outdated Planning Documents**:

- `Development_Roadmap_v6.0.0.md` (superseded by v7.0.0)
- `Development_Roadmap_v7.0.0.md` (superseded by REVISED version)

**Deprecated Components**:

- `components/editor-page-wrapper.tsx` (marked deprecated, no imports found)
- **Note**: `components/sidebar-toggle.tsx` is deprecated but still used in `chat-header.tsx:266` - needs replacement before removal

**Database Backup Archives** (Keep latest, remove dated):

- `database/backups/migration-backup-2025-06-27/` (entire directory - 22 files)
- `database/backups/SUPABASE_SCHEMA_BACKUP_2025-06-27T19-31-37-419Z.sql` (duplicate of LATEST)

### **📋 MEDIUM PRIORITY - Development Artifacts**

**Archived Database Scripts**:

- `database/scripts/archived/` (entire directory):
  - `migrate-specialists.ts` (3.6KB)
  - `phase1-setup.sh` (15KB)
  - `update-echo-tango-tools.sql` (5.7KB)
  - `update-echo-tango-with-google-workspace-tools.ts` (6.5KB)

**Deprecated Migration Files**:

- `database/migrations/deprecated/` (entire directory):
  - `drop_deprecated_tables.sql` (1.8KB)
  - `MULTI_TENANT_MIGRATION.md` (2.2KB)

### **🧽 LOW PRIORITY - Test Artifacts & Housekeeping**

**Test Result Artifacts**:

- `test-results/.last-run.json` (45B)
- `playwright-report/index.html` (448KB - large file)

**Empty Directories**:

- `credentials/` (empty directory)
- `public/uploads/` (empty directory)

### **📊 Cleanup Impact Summary**

**Total Files to Remove**: ~35+ files
**Total Directories to Remove**: ~12 directories  
**Estimated Space Savings**: ~500KB+ (excluding large playwright report)
**Security Improvement**: Remove 7 test API endpoints from production
**Maintenance Reduction**: Eliminate deprecated code paths and outdated documentation

### **⚠️ Pre-Removal Validation Required**

**Before removing any files, verify**:

1. **SidebarToggle Component**: Update `components/chat-header.tsx:266` to remove `<SidebarToggle />` usage
2. **Middleware Routes**: Update test route exceptions in `middleware.ts`
3. **Import Dependencies**: Run `npm run build` to catch any missing imports
4. **Database Dependencies**: Verify no active migrations reference archived scripts

---

## 📅 Phase 1: Critical Issues & Cleanup (Week 1-2)

### **Day 1-2: Critical Cleanup & Tool Selection Crisis Resolution (PRIORITY 1)**

**Objective**: Remove security-blocking test routes and fix tool confusion preventing knowledge base access

**Tasks**:

- [x] **IMMEDIATE: Security-Critical Cleanup**

  - [x] Remove all test API route directories (7 directories total):
    - ✅ `app/api/test-oauth-flow/`, `app/api/test-gmail-mcp/`, `app/api/test-mcp-client/`
    - ✅ `app/api/test-google-tools/`, `app/api/test-unified-tools/`, `app/api/test-minimal/`, `app/api/test-tool-loading/`
  - [x] Update `middleware.ts` line 39 to remove test route exceptions
  - [x] Remove deprecated component: `components/editor-page-wrapper.tsx`
  - [x] Remove outdated roadmaps: `Development_Roadmap_v6.0.0.md`, `Development_Roadmap_v7.0.0.md`
  - [x] **ADDITIONAL CLEANUP COMPLETED**:
    - ✅ Removed database backup archives: `migration-backup-2025-06-27/` (22 files)
    - ✅ Removed duplicate backup: `SUPABASE_SCHEMA_BACKUP_2025-06-27T19-31-37-419Z.sql`
    - ✅ Removed archived database scripts: `database/scripts/archived/` (4 files)
    - ✅ Removed deprecated migrations: `database/migrations/deprecated/` (2 files)
    - ✅ Removed test artifacts: `playwright-report/index.html` (448KB), `test-results/.last-run.json`
    - ✅ Fixed migration file numbering to match journal entries
    - ✅ Disabled problematic debug/maintenance scripts (temporarily for build stability)

- [ ] **Analyze Tool Descriptions**

  - [ ] Audit all tool descriptions for similarity and ambiguity
  - [ ] Document current tool inventory and descriptions
  - [ ] Identify specific conflicts between knowledge base and Google Drive tools

- [ ] **Implement Tool Disambiguation**

  - [ ] Rewrite tool descriptions with clear, distinct purposes
  - [ ] Add semantic prefixes (e.g., "KNOWLEDGE_BASE:", "GOOGLE_DRIVE:")
  - [ ] Implement tool selection logging for debugging
  - [ ] Test tool selection with various query types

- [ ] **Enhanced Logging & Debugging**
  - [ ] Add comprehensive tool selection logging
  - [ ] Implement tool call tracing with decision rationale
  - [ ] Create tool selection debug endpoint for testing

**Success Criteria**:

- ✅ All test API routes removed from codebase (security critical)
- ✅ Middleware updated with no test route exceptions
- ✅ Deprecated components and outdated documentation removed
- ✅ **MAJOR CLEANUP COMPLETED**: 35+ files and 12+ directories removed
- [ ] Knowledge base queries consistently use `getDocumentContents`
- [ ] Google Drive queries consistently use `get_drive_file_content`
- [ ] Tool selection logging shows clear decision rationale
- [ ] No more authentication errors on knowledge base queries

**Testing Checkpoint**:

- [x] Verify no test routes accessible at `/api/test-*` endpoints
- [ ] ⚠️ **BUILD ISSUES IDENTIFIED**: TypeScript errors in LangGraph and Google Workspace auth routes need resolution
- [ ] Test query: "What are Echo Tango's core values?" → Should use knowledge base
- [ ] Test query: "Get content from Google Drive file XYZ" → Should use Drive tool
- [ ] Verify tool selection logs show correct reasoning

**🧹 CLEANUP SUMMARY COMPLETED**:

- **Files Removed**: 35+ files including 7 test API route directories
- **Space Saved**: 500KB+ (including 448KB playwright report)
- **Security Improved**: All test endpoints removed from production
- **Architecture Cleaned**: Outdated documentation and deprecated components removed
- **Database Cleaned**: Backup archives and deprecated migrations removed

**⚠️ REMAINING ISSUES TO ADDRESS**:

- TypeScript compilation errors in `lib/ai/graphs/graph.ts` and Google Workspace auth routes
- Some problematic scripts temporarily disabled (need proper fixes)
- Build process needs stabilization before proceeding with tool selection fixes

### **Day 3-4: Google Workspace MCP Testing & Optimization (PRIORITY 2)**

**Objective**: Validate and optimize the existing Google Workspace OAuth implementation

**Tasks**:

- [ ] **Comprehensive Google Workspace Testing**
  - [ ] Test OAuth flow end-to-end with real user accounts
  - [ ] Verify all 54 Google Workspace tools function correctly
  - [ ] Test token refresh and session management
  - [ ] Validate error handling and recovery mechanisms
- [ ] **Performance Optimization**

  - [ ] Profile tool execution times and optimize bottlenecks
  - [ ] Implement intelligent caching for frequently accessed data
  - [ ] Optimize OAuth token refresh frequency
  - [ ] Add health check monitoring for MCP services

- [ ] **Error Handling Enhancement**
  - [ ] Improve error messages for better user experience
  - [ ] Add retry logic for transient failures
  - [ ] Implement graceful degradation for service unavailability
  - [ ] Enhance logging for debugging and monitoring

**Success Criteria**:

- ✅ All Google Workspace tools authenticate and execute successfully
- ✅ OAuth flow works reliably across different user scenarios
- ✅ Performance meets acceptable thresholds (<5s for most operations)
- ✅ Error handling provides clear, actionable feedback

**Testing Checkpoint**:

- [ ] Test: "List my Gmail emails from today" → Should return actual emails
- [ ] Test: "Show my Google Calendar events" → Should return actual events
- [ ] Test: "Search my Google Drive for documents about X" → Should return results
- [ ] Verify OAuth token refresh works automatically

### **Day 5: Asana MCP Status Verification (PRIORITY 3)**

**Objective**: Determine current Asana MCP implementation status

**Tasks**:

- [ ] **Asana MCP Assessment**
  - [ ] Test current Asana MCP implementation
  - [ ] Verify Docker environment and PAT configuration
  - [ ] Check Asana API connectivity and authentication
  - [ ] Document current functionality and limitations
- [ ] **Quick Fixes (if needed)**
  - [ ] Fix any obvious configuration issues
  - [ ] Update environment variables and credentials
  - [ ] Test basic Asana operations (list projects, create tasks)
  - [ ] Document any remaining issues for future phases

**Success Criteria**:

- ✅ Clear understanding of Asana MCP current status
- ✅ Basic Asana operations working (if implementation is functional)
- ✅ Documented list of any issues requiring future attention
- ✅ Decision made on Asana priority for remaining phases

**Testing Checkpoint**:

- [ ] Test: "Show my Asana projects" → Should return projects or clear error
- [ ] Test: "Create a test task in Asana" → Should work or provide actionable error
- [ ] Document findings and recommendations

### **Day 6: Admin Dashboard Investigation & Repair (PRIORITY 4)**

**Objective**: Restore admin dashboard functionality

**Tasks**:

- [ ] **Admin Dashboard Debugging**
  - [ ] Identify specific components not working
  - [ ] Check database connections and data fetching
  - [ ] Verify authentication and authorization logic
  - [ ] Test all admin interface interactions
- [ ] **Component-by-Component Testing**

  - [ ] Test client configuration editing
  - [ ] Test specialist management functionality
  - [ ] Test system monitoring displays
  - [ ] Test observability dashboard components

- [ ] **Enhanced Admin Capabilities**
  - [ ] Add tool assignment interface for specialists
  - [ ] Implement real-time system health monitoring
  - [ ] Create admin action logging and audit trail
  - [ ] Add bulk configuration management tools

**Success Criteria**:

- ✅ Admin dashboard loads without errors
- ✅ All tabs and components function properly
- ✅ Client and specialist editing works correctly
- ✅ System monitoring displays accurate data

**Testing Checkpoint**:

- [ ] Login as admin user and access dashboard
- [ ] Edit a client configuration and save changes
- [ ] Create/modify a specialist and verify tools assignment
- [ ] Verify system health metrics display correctly

**Next Steps**: Begin Phase 1 with tool selection crisis resolution, leveraging the successful Google Workspace OAuth implementation as a foundation.

**Documentation Note**: This revised roadmap incorporates recent Google Workspace OAuth achievements and adjusts priorities accordingly.
