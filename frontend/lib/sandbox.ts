/**
 * Run candidate JavaScript in the browser, isolated from the app.
 *
 * Layers (no server-side execution exists anywhere in InterVu):
 *  1. A hidden <iframe sandbox="allow-scripts"> WITHOUT allow-same-origin. It
 *     gets a unique opaque origin, so its code cannot read the app's
 *     localStorage (where the sign-in token lives), cookies or DOM.
 *  2. A Content-Security-Policy inside that iframe: default-src 'none'. The
 *     code cannot make network requests (fetch, XHR, WebSocket, images,
 *     forms) or load other scripts.
 *  3. The code runs in a Web Worker created inside the iframe, so an infinite
 *     loop never freezes the page, and a hard timeout removes the iframe,
 *     which terminates the worker.
 *  4. Output is size-limited, and messages are only accepted from that
 *     iframe on a random per-run channel.
 *
 * Only JavaScript can be run. Other languages are submitted as code for the
 * AI to review, never executed.
 */

export type LogLine = { level: "log" | "info" | "warn" | "error" | "debug"; text: string };

export type RunResult = {
  output: LogLine[];
  /** Uncaught error or syntax error message, if any. */
  error: string | null;
  timedOut: boolean;
  durationMs: number;
};

export const MAX_CODE_CHARS = 20_000;
const MAX_LOG_LINES = 200;
const MAX_LINE_CHARS = 1_000;
export const DEFAULT_TIMEOUT_MS = 3_000;

/** Runs inside the worker before the candidate's code (kept on ONE line so line numbers stay aligned). */
const WORKER_PRELUDE =
  "(function(){var f=function(a){try{return typeof a==='string'?a:(JSON.stringify(a)===undefined?String(a):JSON.stringify(a))}catch(e){return String(a)}};" +
  "['log','info','warn','error','debug'].forEach(function(k){console[k]=function(){postMessage({t:'log',level:k,text:Array.prototype.map.call(arguments,f).join(' ')})}});" +
  "var n=0,st=self.setTimeout;self.setTimeout=function(fn,ms){n++;var a=Array.prototype.slice.call(arguments,2);return st(function(){n--;fn.apply(null,a)},ms)};" +
  // When pinged (after the script's synchronous run), wait for timers it scheduled, then report done.
  "self.onmessage=function(e){if(e.data&&e.data.t==='ping'){(function c(){if(n===0){postMessage({t:'done'})}else{st(c,10)}})()}};})();";

/** JSON that is safe to embed inside an inline <script> in the iframe document. */
function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function buildSandboxDocument(code: string, channel: string): string {
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; worker-src blob:\">" +
    "</head><body><script>(function(){" +
    `var CH=${embed(channel)};var CODE=${embed(code)};var PRE=${embed(WORKER_PRELUDE)};` +
    "function send(m){m.channel=CH;parent.postMessage(m,'*')}" +
    "try{" +
    "var blob=new Blob([PRE+'\\n'+CODE],{type:'text/javascript'});" +
    "var w=new Worker(URL.createObjectURL(blob));" +
    "w.onmessage=function(e){send(e.data)};" +
    "w.onerror=function(e){e.preventDefault();send({t:'error',text:(e.message||'Error'),line:e.lineno||0});};" +
    // After the synchronous run (and any setTimeout work it scheduled), report done.
    "setTimeout(function poll(){w.postMessage({t:'ping'});},0);" +
    "}catch(err){send({t:'error',text:'Could not start the sandbox: '+String(err&&err.message||err),line:0});send({t:'done'})}" +
    "})();</script></body></html>"
  );
}

/**
 * Executes `code` and resolves with what it printed. Never rejects: failures
 * (syntax error, exception, timeout) are reported in the result.
 */
export function runJavaScript(code: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<RunResult> {
  return new Promise<RunResult>((resolve) => {
    if (typeof document === "undefined") {
      resolve({ output: [], error: "Running code is only available in the browser.", timedOut: false, durationMs: 0 });
      return;
    }
    if (code.length > MAX_CODE_CHARS) {
      resolve({ output: [], error: `Code is too long to run (limit ${MAX_CODE_CHARS} characters).`, timedOut: false, durationMs: 0 });
      return;
    }

    const channel = `run-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const started = performance.now();
    const output: LogLine[] = [];
    let error: string | null = null;
    let finished = false;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts"); // deliberately no allow-same-origin
    iframe.setAttribute("aria-hidden", "true");
    iframe.tabIndex = -1;
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden";

    const finish = (timedOut: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe.remove(); // terminates the worker as well
      resolve({ output, error, timedOut, durationMs: Math.round(performance.now() - started) });
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { channel?: string; t?: string; level?: LogLine["level"]; text?: unknown; line?: number };
      if (!data || data.channel !== channel) return;
      if (data.t === "log") {
        if (output.length < MAX_LOG_LINES) {
          output.push({ level: data.level ?? "log", text: String(data.text ?? "").slice(0, MAX_LINE_CHARS) });
        } else if (output.length === MAX_LOG_LINES) {
          output.push({ level: "warn", text: `(output truncated after ${MAX_LOG_LINES} lines)` });
        }
      } else if (data.t === "error") {
        // The prelude occupies line 1, so the candidate's line N is reported as N + 1.
        const line = data.line && data.line > 1 ? ` (line ${data.line - 1})` : "";
        error = `${String(data.text ?? "Error").slice(0, MAX_LINE_CHARS)}${line}`;
        finish(false);
      } else if (data.t === "done") {
        finish(false);
      }
    };

    const timer = setTimeout(() => {
      error = `Stopped after ${Math.round(timeoutMs / 1000)}s (possible infinite loop).`;
      finish(true);
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    iframe.srcdoc = buildSandboxDocument(code, channel);
    document.body.appendChild(iframe);
  });
}
