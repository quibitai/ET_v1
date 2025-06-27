# Universal Hyperlink Formatter

## Overview

The `StandardizedResponseFormatter` now includes universal hyperlink conversion that automatically detects and converts common patterns into clickable markdown links. This enhancement improves user experience by making identifiers, URLs, and other references directly clickable in the chat interface.

## Supported Link Types

### 1. Google Chat Space IDs

- **Pattern**: `spaces/XXXXXXXXX`
- **Converts to**: `[spaces/XXXXXXXXX](https://chat.google.com/room/XXXXXXXXX)`
- **Example**: `spaces/AAAATrTB1ag` → `[spaces/AAAATrTB1ag](https://chat.google.com/room/AAAATrTB1ag)`

### 2. Email Addresses

- **Pattern**: `user@domain.com`
- **Converts to**: `[user@domain.com](mailto:user@domain.com)`
- **Example**: `adam@echotango.co` → `[adam@echotango.co](mailto:adam@echotango.co)`

### 3. HTTP/HTTPS URLs

- **Pattern**: `http://` or `https://` URLs
- **Converts to**: `[URL](URL)`
- **Example**: `https://example.com` → `[https://example.com](https://example.com)`

### 4. Google Drive File IDs

- **Pattern**: Long alphanumeric IDs starting with `1` (33+ characters)
- **Converts to**: `[fileId](https://drive.google.com/file/d/fileId/view)`
- **Example**: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms` → `[1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms](https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view)`

### 5. Google Calendar Event IDs

- **Pattern**: `eventId@google.com`
- **Converts to**: `[eventId@google.com](https://calendar.google.com/calendar/event?eid=eventId@google.com)`

### 6. Asana Task URLs

- **Pattern**: `https://app.asana.com/0/PROJECT_ID/TASK_ID`
- **Converts to**: `[Asana Task](URL)`

## Smart Detection Features

### Preservation of Existing Links

The formatter intelligently avoids double-linking content that is already formatted as markdown links:

- ✅ Preserves: `[Example](https://example.com)`
- ❌ Avoids: `[[Example](https://example.com)](https://example.com)`

### Code Block Protection

Content within code blocks (backticks) is preserved without conversion:

- ✅ Preserves: `` `user@example.com` ``
- ❌ Avoids converting to: `` `[user@example.com](mailto:user@example.com)` ``

### Heavy Pre-formatting Detection

If content is already heavily formatted with markdown links (>50% of lines), the formatter skips conversion to preserve intentional formatting.

## Configuration

### Enabling/Disabling Hyperlinks

```typescript
const options: FormattingOptions = {
  contentType: "generic",
  enableHyperlinks: true, // Default: true
};
```

### Disabling Hyperlinks

```typescript
const options: FormattingOptions = {
  contentType: "generic",
  enableHyperlinks: false, // Disables all hyperlink conversion
};
```

## Implementation Details

### Location

- **File**: `lib/ai/services/StandardizedResponseFormatter.ts`
- **Function**: `convertToHyperlinks(content: string): string`
- **Integration**: Called automatically in `applyFinalFormatting()`

### Processing Order

1. Length limits applied first
2. Hyperlink conversion applied second (if enabled)
3. Final formatted content returned

### Performance Considerations

- Regex patterns are optimized for common use cases
- Pre-formatting detection prevents unnecessary processing
- Existing link detection avoids double-processing

## Usage Examples

### Google Chat Integration

When listing Google Chat spaces:

```
Input:  "Available spaces: spaces/AAAATrTB1ag, spaces/hBsJscAAAAE"
Output: "Available spaces: [spaces/AAAATrTB1ag](https://chat.google.com/room/AAAATrTB1ag), [spaces/hBsJscAAAAE](https://chat.google.com/room/hBsJscAAAAE)"
```

### Email Contact Information

When displaying user information:

```
Input:  "Contact: adam@echotango.co"
Output: "Contact: [adam@echotango.co](mailto:adam@echotango.co)"
```

### Mixed Content

When displaying complex results:

```
Input:  "Meeting in spaces/AAAATrTB1ag with adam@echotango.co. Documents at https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view"
Output: "Meeting in [spaces/AAAATrTB1ag](https://chat.google.com/room/AAAATrTB1ag) with [adam@echotango.co](mailto:adam@echotango.co). Documents at [https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view](https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view)"
```

## Benefits

1. **Improved User Experience**: Direct access to Google Chat spaces, email composition, and file viewing
2. **Reduced Manual Work**: No need to manually copy/paste IDs or URLs
3. **Context Preservation**: Smart detection prevents breaking existing formatting
4. **Configurable**: Can be disabled for specific use cases
5. **Universal Application**: Works across all tool results and response types

## Future Enhancements

Potential additions for future versions:

- Google Docs/Sheets/Slides link detection
- Slack workspace/channel links
- GitHub repository/issue links
- Jira ticket links
- Custom domain-specific patterns
