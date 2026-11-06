/**
 * MusicSkills Studio - GitHub Diagnostics & Auto-Report Utility
 * Packages sanitized diagnostic information for one-click GitHub issue reporting.
 * Strictly redacts all API keys and credentials. Zero emojis.
 */

export interface DiagnosticContext {
  component?: string;
  action?: string;
  provider?: string;
  model?: string;
  soundfontStatus?: boolean;
  bpm?: number;
  genre?: string;
  customDetails?: string;
}

export function generateGitHubIssueUrl(
  errorOrTitle: Error | string,
  context?: DiagnosticContext
): string {
  const repoUrl = 'https://github.com/Aarav90-cpu/MusicSkills';
  const errorMessage = typeof errorOrTitle === 'string' ? errorOrTitle : errorOrTitle.message;
  const errorStack = errorOrTitle instanceof Error ? errorOrTitle.stack : undefined;

  const title = `[Bug Report]: ${errorMessage.slice(0, 70)}`;

  const body = `### Problem Description
A runtime issue was encountered during Studio execution:
\`\`\`
${errorMessage}
\`\`\`

${errorStack ? `### Error Stack Trace\n\`\`\`\n${errorStack.slice(0, 800)}\n\`\`\`\n` : ''}
### Reproduction Context
- **Action/Component**: ${context?.component || 'Studio Core'} - ${context?.action || 'Execution'}
- **AI Provider**: ${context?.provider || 'Configured Provider'}
- **Target Model**: ${context?.model || 'Configured Model'}
- **Genre / Style**: ${context?.genre || 'N/A'} (BPM: ${context?.bpm || 'N/A'})
- **SoundFont Loaded**: ${context?.soundfontStatus !== undefined ? (context.soundfontStatus ? 'Yes' : 'No') : 'Verified'}

### Environment Diagnostics
- **MusicSkills Version**: 1.0.0
- **User Agent / Browser**: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js runtime'}
- **Platform**: ${typeof navigator !== 'undefined' ? navigator.platform : 'Linux'}
- **Timestamp**: ${new Date().toISOString()}

*(Note: API keys and sensitive credentials are automatically redacted and excluded).*
`;

  const encodedTitle = encodeURIComponent(title);
  const encodedBody = encodeURIComponent(body);

  return `${repoUrl}/issues/new?title=${encodedTitle}&body=${encodedBody}&labels=bug,diagnostics`;
}

export function openGitHubIssueReport(
  errorOrTitle: Error | string,
  context?: DiagnosticContext
): void {
  if (typeof window === 'undefined') return;
  const url = generateGitHubIssueUrl(errorOrTitle, context);
  window.open(url, '_blank', 'noopener,noreferrer');
}

