# N8N Workflow Documentation

This document provides details on how to set up the n8n workflows that power the RAG tools in this application.

## Overview

The application uses four distinct n8n workflows:

1. **Search Tool**: Performs semantic search in documents
2. **List Documents Tool**: Lists all available documents
3. **Document Retrieval Tool**: Gets full content of a document by ID
4. **Spreadsheet Query Tool**: Retrieves and processes spreadsheet data

## Workflow 1: Search Tool

This workflow performs semantic search through document embeddings stored in your vector database.

### Webhook Setup

1. Create a new n8n workflow
2. Add a **Webhook** node as the trigger
   - Method: POST
   - Authentication: Header Auth
   - Auth Header Name: `etrag` (or your preferred name)
   - Auth Header Value: Generate a secure token

### Required Nodes

1. **Webhook** node (trigger)
2. **Function** node to extract the search query from the request body
3. **PostgreSQL** or **Vector Database** node to perform the semantic search
4. **Set** node to format the response
5. **Respond to Webhook** node to return the results

### Example Configuration

```javascript
// Function node: Extract query
return {
  query: $input.body.query
};

// Set node: Format response
return items.map(item => ({
  content: item.json.document_text,
  metadata: item.json.metadata
}));
```

## Workflow 2: List Documents Tool

This workflow lists all available documents in your knowledge base.

### Webhook Setup

1. Create a new n8n workflow
2. Add a **Webhook** node as the trigger
   - Method: POST
   - Authentication: Header Auth
   - Auth Header Name: `listdocuments` (or your preferred name)
   - Auth Header Value: Generate a secure token

### Required Nodes

1. **Webhook** node (trigger)
2. **PostgreSQL** node to query document metadata
   ```sql
   SELECT DISTINCT metadata->>'file_id' as id, 
          metadata->>'title' as title 
   FROM documents
   ORDER BY title
   ```
3. **Set** node to format response
4. **Respond to Webhook** node to return the results

## Workflow 3: Document Retrieval Tool

This workflow retrieves the full content of a document by its ID.

### Webhook Setup

1. Create a new n8n workflow
2. Add a **Webhook** node as the trigger
   - Method: POST
   - Authentication: Header Auth
   - Auth Header Name: `getfilecontents` (or your preferred name)
   - Auth Header Value: Generate a secure token

### Required Nodes

1. **Webhook** node (trigger)
2. **Function** node to extract the file_id
   ```javascript
   return {
     file_id: $input.body.file_id
   };
   ```
3. **PostgreSQL** node to retrieve document content
   ```sql
   SELECT string_agg(content, ' ') as document_text
   FROM documents
   WHERE metadata->>'file_id' = $1
   GROUP BY metadata->>'file_id'
   ```
4. **Error Handling** node (optional)
5. **Respond to Webhook** node to return the document text

## Workflow 4: Spreadsheet Query Tool

This workflow retrieves structured data from spreadsheet documents.

### Webhook Setup

1. Create a new n8n workflow
2. Add a **Webhook** node as the trigger
   - Method: POST
   - Authentication: Header Auth
   - Auth Header Name: `querydocumentrows` (or your preferred name)
   - Auth Header Value: Generate a secure token

### Required Nodes

1. **Webhook** node (trigger)
2. **Function** node to extract the file_id
3. **PostgreSQL** node to retrieve spreadsheet data
   ```sql
   SELECT json_build_object('row_data', row_to_json(d)) as row_data
   FROM (
     SELECT * FROM spreadsheet_data
     WHERE file_id = $1
   ) d
   ```
4. **Error Handling** node for file not found
5. **Respond to Webhook** node to return the structured data

## Environment Variables

After setting up your n8n workflows, copy the relevant webhook URLs and authentication details into your `.env.local` file:

```
N8N_RAG_TOOL_WEBHOOK_URL=https://yourinstance.n8n.cloud/webhook/your-search-webhook-path
N8N_RAG_TOOL_AUTH_TOKEN=your_search_auth_token
N8N_RAG_TOOL_AUTH_HEADER=etrag

N8N_LIST_DOCS_TOOL_WEBHOOK_URL=https://yourinstance.n8n.cloud/webhook/your-list-docs-webhook-path
N8N_LIST_DOCS_TOOL_AUTH_HEADER=listdocuments
N8N_LIST_DOCS_TOOL_AUTH_TOKEN=your_list_docs_auth_token

N8N_GET_CONTENTS_TOOL_WEBHOOK_URL=https://yourinstance.n8n.cloud/webhook/your-get-contents-webhook-path
N8N_GET_CONTENTS_TOOL_AUTH_HEADER=getfilecontents
N8N_GET_CONTENTS_TOOL_AUTH_TOKEN=your_get_contents_auth_token

N8N_QUERY_ROWS_TOOL_WEBHOOK_URL=https://yourinstance.n8n.cloud/webhook/your-query-rows-webhook-path
N8N_QUERY_ROWS_TOOL_AUTH_HEADER=querydocumentrows
N8N_QUERY_ROWS_TOOL_AUTH_TOKEN=your_query_rows_auth_token
```

## Testing Your Workflows

You can test your workflows using curl or a tool like Postman:

```bash
# Test search workflow
curl -X POST https://yourinstance.n8n.cloud/webhook/your-search-webhook-path \
  -H "etrag: your_search_auth_token" \
  -H "Content-Type: application/json" \
  -d '{"query":"your search query"}'

# Test list documents workflow
curl -X POST https://yourinstance.n8n.cloud/webhook/your-list-docs-webhook-path \
  -H "listdocuments: your_list_docs_auth_token" \
  -H "Content-Type: application/json"

# Test document retrieval workflow
curl -X POST https://yourinstance.n8n.cloud/webhook/your-get-contents-webhook-path \
  -H "getfilecontents: your_get_contents_auth_token" \
  -H "Content-Type: application/json" \
  -d '{"file_id":"your_file_id"}'

# Test spreadsheet query workflow
curl -X POST https://yourinstance.n8n.cloud/webhook/your-query-rows-webhook-path \
  -H "querydocumentrows: your_query_rows_auth_token" \
  -H "Content-Type: application/json" \
  -d '{"file_id":"your_spreadsheet_id"}'
``` 