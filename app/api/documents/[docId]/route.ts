import { type NextRequest, NextResponse } from 'next/server';
import { getDocumentContentsTool } from '@/lib/ai/tools/get-document-contents';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  try {
    const { docId } = await params;

    if (!docId) {
      return new NextResponse('Document ID is required', { status: 400 });
    }

    // Use the getDocumentContents tool to fetch the document
    const result = await getDocumentContentsTool.func({ document_id: docId });
    const parsedResult = JSON.parse(result);

    if (!parsedResult.success) {
      return new NextResponse(`Document not found: ${parsedResult.error}`, {
        status: 404,
      });
    }

    const { document, content } = parsedResult;

    // Check if the request wants JSON (API call) or HTML (browser)
    const acceptHeader = request.headers.get('accept') || '';
    const wantsJson = acceptHeader.includes('application/json');

    if (wantsJson) {
      // Return JSON for API calls
      return NextResponse.json({
        success: true,
        document,
        content,
        metadata: parsedResult.metadata,
      });
    }

    // Determine content type and processing
    const fileName = document.title.toLowerCase();
    const isMarkdown =
      fileName.endsWith('.md') || fileName.endsWith('.markdown');
    const isPdf = fileName.endsWith('.pdf');
    const isSpreadsheet =
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.csv') ||
      fileName.endsWith('.ods');
    const isDownloadable =
      isSpreadsheet ||
      fileName.endsWith('.zip') ||
      fileName.endsWith('.rar') ||
      fileName.endsWith('.7z');

    // For PDFs and downloadable files, redirect to source instead of rendering
    if ((isPdf || isDownloadable) && document.url) {
      const response = NextResponse.redirect(document.url);
      // Add strong cache-busting headers for redirects
      response.headers.set(
        'Cache-Control',
        'no-cache, no-store, must-revalidate',
      );
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      return response;
    }

    // If it's a PDF or downloadable file but no URL, show download info
    if (isPdf || isDownloadable) {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 2rem auto;
            padding: 2rem;
            text-align: center;
            background: #f9fafb;
        }
        .download-card {
            background: white;
            padding: 3rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .file-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        .title {
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 1rem;
            color: #1f2937;
        }
        .message {
            color: #6b7280;
            margin-bottom: 2rem;
        }
        .back-link {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
        }
        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="download-card">
        <div class="file-icon">${isPdf ? '📄' : '📊'}</div>
        <h1 class="title">${document.title}</h1>
        <p class="message">
            This file opens in its original application.<br>
            ${document.url ? 'The file should open automatically.' : 'No source URL available.'}
        </p>
        <a href="javascript:history.back()" class="back-link">← Back to Chat</a>
    </div>
</body>
</html>`;

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    let processedContent = content;
    let contentStyles = '';

    if (isMarkdown) {
      // Enhanced markdown processing
      processedContent = content
        // Headers
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
        // Bold and italic
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Code
        .replace(/`(.*?)`/g, '<code>$1</code>')
        // Links
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
        )
        // Lists - handle bullet points
        .replace(/^[\s]*[-*+] (.*$)/gm, '<li>$1</li>')
        // Lists - handle numbered lists
        .replace(/^[\s]*\d+\. (.*$)/gm, '<li>$1</li>')
        // Wrap consecutive list items in ul tags
        .replace(/(<li>.*<\/li>)/gs, (match: string) => {
          return `<ul>${match}</ul>`;
        })
        // Paragraphs - split on double newlines
        .split('\n\n')
        .map((paragraph: string) => {
          if (
            paragraph.includes('<h1>') ||
            paragraph.includes('<h2>') ||
            paragraph.includes('<h3>') ||
            paragraph.includes('<h4>') ||
            paragraph.includes('<ul>')
          ) {
            return paragraph;
          }
          return paragraph.trim()
            ? `<p>${paragraph.replace(/\n/g, '<br>')}</p>`
            : '';
        })
        .join('\n');

      contentStyles = `
        .content h1 { font-size: 2rem; margin: 2rem 0 1rem 0; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
        .content h2 { font-size: 1.5rem; margin: 1.5rem 0 0.75rem 0; color: #374151; }
        .content h3 { font-size: 1.25rem; margin: 1.25rem 0 0.5rem 0; color: #4b5563; }
        .content h4 { font-size: 1.1rem; margin: 1rem 0 0.5rem 0; color: #6b7280; }
        .content ul { margin: 1rem 0; padding-left: 2rem; }
        .content li { margin: 0.5rem 0; }
        .content code { background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px; font-family: 'Monaco', 'Menlo', monospace; font-size: 0.9em; }
        .content strong { font-weight: 600; }
        .content em { font-style: italic; }
        .content a { color: #2563eb; text-decoration: none; }
        .content a:hover { text-decoration: underline; }
        .content p { margin: 1rem 0; }
        .content { white-space: normal; }
      `;
    } else if (isPdf) {
      // For PDFs, preserve formatting and handle paragraphs better
      processedContent = content
        .split('\n\n')
        .map((paragraph: string) =>
          paragraph.trim() ? `<p>${paragraph.replace(/\n/g, '<br>')}</p>` : '',
        )
        .join('\n');

      contentStyles = `
        .content { 
          font-family: 'Times New Roman', serif; 
          white-space: normal;
        }
        .content p { 
          margin: 1rem 0; 
          text-align: justify; 
          text-indent: 1.5em;
        }
        .content p:first-child {
          text-indent: 0;
        }
      `;
    } else {
      // Plain text - preserve line breaks but escape HTML
      processedContent = content
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

      contentStyles = `
        .content { 
          white-space: pre-wrap; 
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.9rem;
        }
      `;
    }

    // Return HTML for browser visits
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
            color: #333;
            background: #fff;
        }
        .header {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }
        .title {
            font-size: 2rem;
            font-weight: bold;
            margin: 0 0 0.5rem 0;
            color: #1f2937;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .content-type-badge {
            display: inline-block;
            background: #e5e7eb;
            color: #374151;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
        }
        .metadata {
            color: #6b7280;
            font-size: 0.875rem;
        }
        .content {
            font-size: 1rem;
            line-height: 1.7;
        }
        .back-link {
            display: inline-block;
            margin-bottom: 1rem;
            color: #3b82f6;
            text-decoration: none;
            font-size: 0.875rem;
        }
        .back-link:hover {
            text-decoration: underline;
        }
        ${contentStyles}
        @media (max-width: 640px) {
            body {
                padding: 1rem;
            }
            .title {
                font-size: 1.5rem;
                flex-direction: column;
                align-items: flex-start;
                gap: 0.5rem;
            }
        }
    </style>
</head>
<body>
    <a href="javascript:history.back()" class="back-link">← Back</a>
    
    <div class="header">
        <h1 class="title">
            ${document.title}
            <span class="content-type-badge">${isPdf ? 'PDF' : isMarkdown ? 'Markdown' : isSpreadsheet ? 'Spreadsheet' : 'Text'}</span>
        </h1>
        <div class="metadata">
            <div>Document ID: ${document.id}</div>
            <div>Created: ${new Date(document.created_at).toLocaleDateString()}</div>
            ${document.url ? `<div>Source: <a href="${document.url}" target="_blank" rel="noopener noreferrer">${document.url}</a></div>` : ''}
            <div>Content Length: ${parsedResult.metadata.content_length} characters</div>
        </div>
    </div>
    
    <div class="content">${processedContent}</div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return new NextResponse('Internal server error while fetching document', {
      status: 500,
    });
  }
}

export async function DELETE(request: NextRequest) {
  // Document deletion functionality has been removed in Phase 1, Task 1.2
  return new NextResponse(
    'Document deletion functionality has been deprecated',
    {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    },
  );
}
