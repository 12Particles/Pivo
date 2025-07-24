import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { eventBus } from "@/lib/events/EventBus";
import { terminalApi } from "@/services/api";
import { TerminalSession } from "@/types";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  taskAttemptId: string;
  workingDirectory?: string;
  onSessionCreated?: (session: TerminalSession) => void;
  className?: string;
}

export function Terminal({ 
  taskAttemptId, 
  workingDirectory = ".",
  onSessionCreated,
  className = "" 
}: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [session, setSession] = useState<TerminalSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm
    const xterm = new XTerm({
      theme: {
        background: "#1e1e1e",
        foreground: "#cccccc",
        cursor: "#cccccc",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      convertEol: true,
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // Open terminal
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    setIsReady(true);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (session) {
        terminalApi.resize(session.id, xterm.rows, xterm.cols).catch(console.error);
      }
    });
    resizeObserver.observe(terminalRef.current);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
    };
  }, []);

  // Create terminal session
  useEffect(() => {
    if (!isReady || !xtermRef.current || session) return;

    const createSession = async () => {
      try {
        const rows = xtermRef.current!.rows;
        const cols = xtermRef.current!.cols;
        
        const newSession = await terminalApi.createSession(
          taskAttemptId,
          rows,
          cols,
          workingDirectory
        );
        
        setSession(newSession);
        onSessionCreated?.(newSession);
        
        xtermRef.current?.writeln(`\r\nTerminal session started in ${workingDirectory}\r\n`);
      } catch (error) {
        console.error("Failed to create terminal session:", error);
        xtermRef.current?.writeln(`\r\nError: Failed to create terminal session: ${error}\r\n`);
      }
    };

    createSession();
  }, [isReady, taskAttemptId, workingDirectory, onSessionCreated]);

  // Listen for terminal output
  useEffect(() => {
    if (!isReady || !xtermRef.current || !session) return;

    const unsubscribe = eventBus.subscribe(
      "terminal-output",
      (payload: { session_id: string; data: string }) => {
        if (payload.session_id === session.id) {
          xtermRef.current?.write(payload.data);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isReady, session]);

  // Handle input
  useEffect(() => {
    if (!isReady || !xtermRef.current || !session) return;

    const disposable = xtermRef.current.onData((data) => {
      // Send input to terminal session
      terminalApi.write(session.id, data).catch(console.error);
    });

    return () => {
      disposable.dispose();
    };
  }, [isReady, session]);

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      if (session) {
        terminalApi.close(session.id).catch(console.error);
      }
    };
  }, [session]);

  return (
    <div 
      ref={terminalRef} 
      className={`w-full h-full bg-[#1e1e1e] ${className}`}
      style={{ padding: "8px" }}
    />
  );
}