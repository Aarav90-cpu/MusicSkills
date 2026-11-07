/**
 * MusicSkills - External AI Agents Session Manager
 * Orchestrates Claude Code, Codex CLI, and Antigravity runner sessions.
 * Streams stdout/stderr in real-time, monitors generated artifacts,
 * and synchronizes with MusicSkills Studio database (.chats/).
 * Strictly zero-emoji compliant.
 */

import { spawn, execFile, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getChat, saveChat, createChat, getChatsDir } from './chats';
import { loadConfig } from './config';

const execFileAsync = promisify(execFile);

export interface ExternalAgentInfo {
  id: string;
  name: string;
  cliCommand: string;
  installed: boolean;
  path?: string;
  version?: string;
  description: string;
}

export interface AgentSessionLog {
  timestamp: string;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
}

export interface CreatedArtifact {
  type: 'midi' | 'audio' | 'lyrics' | 'lead_sheet' | 'remotion' | 'cover';
  name: string;
  path: string;
}

export interface AgentSession {
  id: string;
  agent: 'claude' | 'codex' | 'antigravity' | 'musicskills';
  status: 'running' | 'completed' | 'error' | 'cancelled';
  task: string;
  chatId?: string;
  logs: AgentSessionLog[];
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
  createdArtifacts: CreatedArtifact[];
  process?: ChildProcess;
}

const activeSessions = new Map<string, AgentSession>();

// Check installed agent binaries
export async function detectExternalAgents(): Promise<ExternalAgentInfo[]> {
  const checkCmd = async (binName: string): Promise<{ installed: boolean; path?: string; version?: string }> => {
    try {
      const whichRes = await execFileAsync('which', [binName]);
      const binPath = whichRes.stdout.trim();
      if (!binPath) return { installed: false };

      try {
        const verRes = await execFileAsync(binPath, ['--version']);
        const firstLine = (verRes.stdout || verRes.stderr).split('\n')[0].trim();
        return { installed: true, path: binPath, version: firstLine };
      } catch {
        return { installed: true, path: binPath };
      }
    } catch {
      return { installed: false };
    }
  };

  const [claudeCheck, codexCheck] = await Promise.all([
    checkCmd('claude'),
    checkCmd('codex'),
  ]);

  return [
    {
      id: 'claude',
      name: 'Claude Code CLI',
      cliCommand: 'claude',
      installed: claudeCheck.installed,
      path: claudeCheck.path,
      version: claudeCheck.version,
      description: 'Anthropic agentic coding CLI with tool use, filesystem manipulation, and terminal execution',
    },
    {
      id: 'codex',
      name: 'Codex CLI',
      cliCommand: 'codex',
      installed: codexCheck.installed,
      path: codexCheck.path,
      version: codexCheck.version,
      description: 'Autonomous software engineering agent CLI running non-interactive task pipelines',
    },
    {
      id: 'antigravity',
      name: 'Google Antigravity Agent',
      cliCommand: 'agy',
      installed: true,
      description: 'Antigravity autonomous agent system with multi-agent orchestration and skills',
    },
    {
      id: 'musicskills',
      name: 'MusicSkills Autonomous Producer',
      cliCommand: 'node bin/musicskills.js',
      installed: true,
      description: 'Built-in algorithmic arrangement, Humanizer engine, and Remotion video visualizer',
    },
  ];
}

// Start an external agent session
export function startAgentSession(params: {
  agent: 'claude' | 'codex' | 'antigravity' | 'musicskills';
  task: string;
  chatId?: string;
  onLogChunk?: (log: AgentSessionLog) => void;
  onArtifactFound?: (artifact: CreatedArtifact) => void;
}): AgentSession {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const chatsDir = getChatsDir();

  // Find or determine project context
  let projectDir = chatsDir;
  let chatName = 'Studio Session';
  if (params.chatId) {
    const res = getChat(params.chatId);
    if (res) {
      projectDir = res.dirPath;
      chatName = res.chat.name;
    }
  }

  const session: AgentSession = {
    id: sessionId,
    agent: params.agent,
    status: 'running',
    task: params.task,
    chatId: params.chatId,
    logs: [],
    startedAt: new Date().toISOString(),
    createdArtifacts: [],
  };

  activeSessions.set(sessionId, session);

  const addLog = (stream: 'stdout' | 'stderr' | 'system', text: string) => {
    const logItem: AgentSessionLog = {
      timestamp: new Date().toISOString(),
      stream,
      text,
    };
    session.logs.push(logItem);
    params.onLogChunk?.(logItem);
  };

  addLog('system', `[Session Started] Initializing ${params.agent} for project "${chatName}"`);
  addLog('system', `Task: "${params.task}"`);
  addLog('system', `Working Directory: ${process.cwd()}`);

  // Build agent prompt with full MusicSkills tool definitions
  const agentPrompt = `You are an autonomous AI Music Producer operating inside the MusicSkills Studio workspace.
Active Project: "${chatName}" (ID: ${params.chatId || 'none'})
Project Folder: ${projectDir}

You have the MusicSkills CLI tool available:
- Run "bin/musicskills new-project --name '<name>' --genre <genre> --bpm <bpm>" to create songs
- Run "bin/musicskills generate --project-id <id> [--genre <genre>]" to compose arrangements & render audio
- Run "bin/musicskills add-lyrics --project-id <id> --text '<lyrics>'" to attach lyrics
- Run "bin/musicskills remotion --project-id <id> --style <style>" to create 3D Remotion animations
- Run "bin/musicskills cover --project-id <id> --section <section> --instruction '<inst>'" to branch variations

USER TASK:
${params.task}

Execute the appropriate CLI commands or output the files directly into the project directory. Keep progress updates concise and adhere strictly to zero-emoji policy.`;

  // Spawn appropriate subprocess
  let command = 'node';
  let cmdArgs: string[] = [];

  if (params.agent === 'claude') {
    command = 'claude';
    cmdArgs = ['-p', agentPrompt, '--dangerously-skip-permissions'];
  } else if (params.agent === 'codex') {
    command = 'codex';
    cmdArgs = ['exec', agentPrompt];
  } else if (params.agent === 'antigravity') {
    command = 'bin/musicskills';
    cmdArgs = ['generate', '--project-id', params.chatId || '', '--notes', params.task];
  } else {
    // Default musicskills autonomous runner
    command = 'bin/musicskills';
    cmdArgs = ['generate', '--project-id', params.chatId || '', '--notes', params.task];
  }

  try {
    const proc = spawn(command, cmdArgs, {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '0', CLAUDE_CODE_SIMPLE: '1' },
      shell: true,
    });

    session.process = proc;

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      addLog('stdout', text);
      checkForArtifacts(text, session, params.onArtifactFound);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      addLog('stderr', text);
    });

    proc.on('close', (code) => {
      session.exitCode = code ?? 0;
      session.completedAt = new Date().toISOString();
      session.status = code === 0 ? 'completed' : 'error';
      addLog('system', `[Session Finished] Process exited with code ${code}`);

      // Final artifact directory sweep
      sweepProjectArtifacts(projectDir, session, params.onArtifactFound);

      // Record assistant message in chat if attached to project
      if (params.chatId) {
        const res = getChat(params.chatId);
        if (res) {
          const summary = session.logs
            .filter(l => l.stream === 'stdout')
            .map(l => l.text)
            .join('')
            .trim()
            .slice(-1000) || `Completed task: ${params.task}`;

          res.chat.messages.push({
            id: `msg-agent-${Date.now()}`,
            role: 'assistant',
            content: `[${params.agent.toUpperCase()} Session Report]\n${summary}`,
            timestamp: new Date().toISOString(),
          });
          res.chat.updatedAt = new Date().toISOString();
          saveChat(res.chat);
        }
      }
    });

    proc.on('error', (err) => {
      session.status = 'error';
      session.completedAt = new Date().toISOString();
      addLog('system', `[Session Error] Failed to execute ${command}: ${err.message}`);
    });

  } catch (err: any) {
    session.status = 'error';
    session.completedAt = new Date().toISOString();
    addLog('system', `[Spawn Exception] ${err.message}`);
  }

  return session;
}

// Inspect logs for created files
function checkForArtifacts(
  text: string,
  session: AgentSession,
  onArtifactFound?: (a: CreatedArtifact) => void
) {
  const patterns = [
    { type: 'midi' as const, regex: /(?:Saved|MIDI|generated)\s*:?\s*(\S+\.mid)/i },
    { type: 'audio' as const, regex: /(?:MP3|Audio|rendered)\s*:?\s*(\S+\.mp3)/i },
    { type: 'lead_sheet' as const, regex: /(?:Lead Sheet)\s*:?\s*(\S+\_lead_sheet\.md)/i },
    { type: 'lyrics' as const, regex: /(?:LRC|Synced)\s*:?\s*(\S+\.lrc)/i },
    { type: 'remotion' as const, regex: /(?:Remotion|Video)\s*:?\s*(\S+RemotionComposition\.tsx)/i },
  ];

  for (const p of patterns) {
    const match = text.match(p.regex);
    if (match && match[1]) {
      const artPath = match[1].trim();
      const existing = session.createdArtifacts.find(a => a.path === artPath);
      if (!existing) {
        const artifact: CreatedArtifact = {
          type: p.type,
          name: path.basename(artPath),
          path: artPath,
        };
        session.createdArtifacts.push(artifact);
        onArtifactFound?.(artifact);
      }
    }
  }
}

// Sweep project directory for recent artifacts
function sweepProjectArtifacts(
  dir: string,
  session: AgentSession,
  onArtifactFound?: (a: CreatedArtifact) => void
) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir);
  for (const file of entries) {
    const fullPath = path.join(dir, file);
    if (file.endsWith('.mid')) {
      registerArtifact('midi', file, fullPath, session, onArtifactFound);
    } else if (file.endsWith('.mp3')) {
      registerArtifact('audio', file, fullPath, session, onArtifactFound);
    } else if (file.endsWith('.lrc')) {
      registerArtifact('lyrics', file, fullPath, session, onArtifactFound);
    } else if (file.endsWith('lead_sheet.md')) {
      registerArtifact('lead_sheet', file, fullPath, session, onArtifactFound);
    }
  }

  // Check video directory
  const videoDir = path.join(dir, 'video');
  if (fs.existsSync(videoDir)) {
    const videoFiles = fs.readdirSync(videoDir);
    for (const vf of videoFiles) {
      if (vf.endsWith('.tsx') || vf.endsWith('.ts')) {
        registerArtifact('remotion', vf, path.join(videoDir, vf), session, onArtifactFound);
      }
    }
  }
}

function registerArtifact(
  type: CreatedArtifact['type'],
  name: string,
  fullPath: string,
  session: AgentSession,
  onArtifactFound?: (a: CreatedArtifact) => void
) {
  const existing = session.createdArtifacts.find(a => a.path === fullPath);
  if (!existing) {
    const artifact: CreatedArtifact = { type, name, path: fullPath };
    session.createdArtifacts.push(artifact);
    onArtifactFound?.(artifact);
  }
}

export function getAgentSession(sessionId: string): AgentSession | null {
  return activeSessions.get(sessionId) || null;
}

export function cancelAgentSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (session && session.process && session.status === 'running') {
    try {
      session.process.kill('SIGTERM');
      session.status = 'cancelled';
      session.completedAt = new Date().toISOString();
      return true;
    } catch (_) {}
  }
  return false;
}
