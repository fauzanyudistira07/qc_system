import { createHash } from 'node:crypto';
import { lstat, opendir, open, realpath } from 'node:fs/promises';
import path from 'node:path';

export type InventoryPage = {
  id: string;
  path: string;
  title: string;
  url?: string;
  status?: number;
  state: 'observed' | 'candidate' | 'blocked' | 'error';
  elements: Array<{ type: string; name: string; selector?: string; testId?: string; tag?: string; source?: string; confidence?: number }>;
  screenshot?: string;
  source?: string;
  authentication?: string;
  errors?: string[];
  links?: string[];
  network?: Array<{ url: string; status: number; method: string }>;
};

type SourceRoute = { path: string; method: string; source: string };
const limits = { files: 5_000, entries: 25_000, depth: 20, bytes: 512_000, totalBytes: 32_000_000, routes: 5_000, elements: 250 };
const excludedDirectories = /^(?:node_modules|vendor|bower_components|dist|build|out|coverage|artifacts?|screenshots|test-results|playwright-report|storage|logs?|cache|tmp|temp|venv|env|__pycache__|site-packages|target|bin|obj|secrets?|credentials?|certs?|uploads?|media|backups?)$/i;
const excludedFiles = /(?:^\.env|(?:^|[._-])(?:secret|secrets|credential|credentials|private|password|token|dump|backup|config)(?:[._-]|$)|(?:^|[._-])(?:test|spec)(?:[._-]|$)|(?:lock|\.min|\.bundle)\.(?:js|json)$)/i;
const supportedFile = /\.(?:[cm]?[jt]sx?|vue|svelte|php|py|go|html?|dart|kt|java)$/i;

function identity(value: string) { return createHash('sha256').update(value).digest('hex').slice(0, 16); }
function cleanText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}
function routePath(raw: string): string | undefined {
  let value = raw.trim();
  if (!value || value.length > 500 || /^(?:[a-z]+:|\/\/)/i.test(value) || /[\s$`]/.test(value)) return;
  value = value.split(/[?#]/)[0];
  if (!value) return;
  return '/' + value.replace(/^\/+|\/+$/g, '');
}
function titleFor(route: string) { return route === '/' ? 'Home' : route.split('/').filter(Boolean).join(' / '); }
function attr(attributes: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attributes)?.slice(1).find(v => v !== undefined);
}
type PrefixSpan = { start: number; end: number; prefix: string; auth?: string };
function matchingBracket(content: string, opening: number, openChar = '{', closeChar = '}'): number {
  let depth = 0, quote = '', escaped = false;
  for (let index = opening; index < content.length; index++) {
    const char = content[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === openChar) depth++;
    else if (char === closeChar && --depth === 0) return index;
  }
  return content.length;
}
function matchingBrace(content: string, opening: number): number {
  return matchingBracket(content, opening, '{', '}');
}
function laravelPrefixSpans(content: string): PrefixSpan[] {
  const spans: PrefixSpan[] = [];
  const pattern = /\bprefix\s*\(\s*['"]([^'"]+)['"]\s*\)[\s\S]{0,800}?\bgroup\s*\(\s*function\s*\([^)]*\)\s*\{/gi;
  for (const match of content.matchAll(pattern)) {
    const opening = (match.index ?? 0) + match[0].length - 1;
    spans.push({ start: opening, end: matchingBrace(content, opening), prefix: '/' + match[1].replace(/^\/+|\/+$/g, '') });
  }
  return spans;
}
function jsRoutePrefixSpans(content: string): PrefixSpan[] {
  const spans: PrefixSpan[] = [];
  const childRegex = /\bchildren\s*:\s*\[/g;
  for (const match of content.matchAll(childRegex)) {
    const opening = (match.index ?? 0) + match[0].length - 1;
    const end = matchingBracket(content, opening, '[', ']');
    const before = content.slice(Math.max(0, (match.index ?? 0) - 800), match.index ?? 0);
    const pathMatch = [...before.matchAll(/\bpath\s*:\s*['"]([^'"]+)['"]/g)].pop();
    const hasAuth = /(?:requiresAuth\s*:\s*true|auth\s*:\s*true)/i.test(before);
    if (pathMatch && pathMatch[1]) {
      const parentRaw = pathMatch[1].trim();
      const parentPrefix = parentRaw === '/' ? '' : ('/' + parentRaw.replace(/^\/+|\/+$/g, ''));
      spans.push({ start: opening, end, prefix: parentPrefix, auth: hasAuth ? 'auth-required' : undefined });
    }
  }
  return spans;
}
function prefixedRoute(raw: string, prefix: string) {
  const route = raw.startsWith('/') ? raw : '/' + raw;
  return prefix ? prefix + route : route;
}
function dartElements(content: string, source: string): InventoryPage['elements'] {
  const result: InventoryPage['elements'] = [];
  const seen = new Set<string>();

  for (const m of content.matchAll(/(?:ElevatedButton|TextButton|OutlinedButton|FilledButton)\s*(?:\.icon)?\s*\([^)]*?(?:child|label):\s*(?:const\s+)?Text\s*\(\s*['"]([^'"]+)['"]/gi)) {
    const name = m[1].trim();
    const key = `button:${name}`;
    if (!seen.has(key) && result.length < limits.elements) {
      seen.add(key);
      result.push({ type: 'button', name, tag: 'Button', selector: `text:${name}`, source, confidence: 0.8 });
    }
  }

  for (const m of content.matchAll(/(?:TextField|TextFormField)\s*\([^)]*?(?:hintText|labelText|helperText):\s*['"]([^'"]+)['"]/gi)) {
    const name = m[1].trim();
    const key = `input:${name}`;
    if (!seen.has(key) && result.length < limits.elements) {
      seen.add(key);
      result.push({ type: 'input', name, tag: 'TextField', selector: `text:${name}`, source, confidence: 0.8 });
    }
  }

  for (const m of content.matchAll(/ListTile\s*\([^)]*?title:\s*(?:const\s+)?Text\s*\(\s*['"]([^'"]+)['"]/gi)) {
    const name = m[1].trim();
    const key = `tile:${name}`;
    if (!seen.has(key) && result.length < limits.elements) {
      seen.add(key);
      result.push({ type: 'button', name, tag: 'ListTile', selector: `text:${name}`, source, confidence: 0.7 });
    }
  }

  return result;
}

function sourceElements(content: string, source: string): InventoryPage['elements'] {
  const result: InventoryPage['elements'] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/<(button|input|select|textarea|form|a|Link|RouterLink|dialog|nav)\b([^>]{0,2000})>([^<]{0,300})/gi)) {
    if (result.length >= limits.elements) break;
    const tag = match[1].toLowerCase();
    if (tag === 'input' && attr(match[2], 'type') === 'hidden') continue;
    const testId = attr(match[2], 'data-testid');
    const id = attr(match[2], 'id');
    const name = cleanText(attr(match[2], 'aria-label') || attr(match[2], 'placeholder') || attr(match[2], 'name') || match[3] || testId || id || tag);
    const selector = testId ? `[data-testid=${JSON.stringify(testId)}]` : id ? `[id=${JSON.stringify(id)}]` : undefined;
    const key = `${tag}:${name}:${selector ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ type: ['a', 'link', 'routerlink'].includes(tag) ? 'link' : tag, name, tag, testId, selector, source, confidence: selector ? 0.7 : 0.4 });
  }
  return result;
}

/** Bounded, static heuristics only: never imports or executes repository code. */
export async function scanSource(sourceDir: string): Promise<{
  pages: InventoryPage[]; routes: SourceRoute[]; api: SourceRoute[]; filesScanned: number; warnings: string[];
}> {
  const rootInput = path.resolve(sourceDir);
  const rootStat = await lstat(rootInput);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Source root must be a real directory, not a symbolic link.');
  const root = await realpath(rootInput);
  const routes: SourceRoute[] = [], api: SourceRoute[] = [];
  const pages = new Map<string, InventoryPage>();
  const routeKeys = new Set<string>(), warnings = new Set<string>();
  const templates = new Map<string, { elements: InventoryPage['elements']; title?: string; source: string }>();
  const templateReferences: Array<{ route: string; template: string }> = [];
  let filesScanned = 0, entries = 0, totalBytes = 0;
  const warn = (message: string) => { if (warnings.size < 100) warnings.add(message); };
  function addRoute(raw: string, method: string, source: string, elements: InventoryPage['elements'] = [], auth?: string, isApi = false) {
    const route = routePath(raw);
    if (!route) return;
    if (routeKeys.size >= limits.routes) { warn('Route limit reached; inventory is partial.'); return; }
    const key = `${method}:${route}:${source}`;
    if (!routeKeys.has(key)) {
      routeKeys.add(key);
      const record = { path: route, method, source };
      routes.push(record);
      if (isApi || /^\/api(?:\/|$)/i.test(route) || method !== 'GET') api.push(record);
    }
    if (method !== 'GET' || isApi || /^\/api(?:\/|$)/i.test(route)) return;
    const existing = pages.get(route);
    if (!existing) pages.set(route, { id: identity(route), path: route, title: titleFor(route), state: 'candidate', source, elements: [...elements], authentication: auth || 'unknown' });
    else {
      const known = new Set(existing.elements.map(e => `${e.type}:${e.name}:${e.selector}`));
      for (const element of elements) {
        if (existing.elements.length >= limits.elements) break;
        if (!known.has(`${element.type}:${element.name}:${element.selector}`)) existing.elements.push(element);
      }
      if (auth) existing.authentication = auth;
    }
  }
  function inspect(content: string, source: string) {
    // Comments cannot establish routes or UI evidence. Preserve newlines for useful source hints.
    const code = content.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, '').replace(/^\s*(?:\/\/|#).*$/gm, '');
    const elements = sourceElements(code, source);
    const auth = /(?:middleware\s*\([^)]*['"]auth|login_required|permission_required|IsAuthenticated|@can\b|@auth\b|\b(?:RequireAuth|ProtectedRoute)\b)/i.test(code) ? 'source-auth-hint' : undefined;
    if (auth || /(?:\b(?:permission|roles?|authorize|Gate::|can\()|@permission\b)/i.test(code)) warn(`Permission hints in ${source}; verify roles at runtime.`);
    if (/(?:^|\/)(?:migrations?|seeders?|seeds?|factories)(?:\/|\.)/i.test(source)) {
      warn(`Test-data ${/seed|factor/i.test(source) ? 'seeder/factory' : 'migration'} found: ${source}; not executed by discovery.`);
      return;
    }
    const isApiFile = /(?:^|\/)(?:api)(?:\/|\.)/i.test(source);
    const prefixSpans = laravelPrefixSpans(code);
    const prefixAt = (position: number) => prefixSpans
      .filter(span => position >= span.start && position <= span.end)
      .sort((a, b) => a.start - b.start)
      .map(span => span.prefix)
      .join('');
    const scopedRoute = (raw: string, position: number) => {
      const scoped = prefixedRoute(raw, prefixAt(position));
      return isApiFile && !scoped.startsWith('/api') ? '/api' + scoped : scoped;
    };
    // Laravel routes; group prefixes/middleware require runtime verification.
    for (const m of code.matchAll(/Route::(get|post|put|patch|delete|options|head|any|view|redirect)\s*\(\s*['"]([^'"]*)['"]([^;\n]*)/gi)) {
      const method = /view|redirect/i.test(m[1]) ? 'GET' : m[1].toUpperCase();
      const route = scopedRoute(m[2] || '/', m.index ?? 0);
      addRoute(route, method, source, [], auth, isApiFile);
      const template = /(?:view\s*\(\s*|^\s*,\s*)['"]([\w./-]+)['"]/.exec(m[3])?.[1];
      if (template && method === 'GET') templateReferences.push({ route: routePath(route)!, template });
    }
    for (const m of code.matchAll(/Route::(?:apiResource|resource)\s*\(\s*['"]([^'"]+)['"]/g)) {
      const resource = scopedRoute(m[1], m.index ?? 0);
      for (const [suffix, method] of [['', 'GET'], ['', 'POST'], ['/{id}', 'GET'], ['/{id}', 'PUT'], ['/{id}', 'DELETE']]) addRoute(resource + suffix, method, source, [], auth, isApiFile);
      if (!isApiFile && !m[0].includes('apiResource')) for (const suffix of ['/create', '/{id}/edit']) addRoute(resource + suffix, 'GET', source, [], auth);
    }
    if (/(?:Route::prefix|->prefix\s*\(|Route::group|include\s*\(|include_router\s*\(|\brouter\.use\s*\()/i.test(code)) warn(`Nested route prefixes in ${source} are heuristic; verify the mounted URL at runtime.`);
    // Express and Go routers (Gin/Echo/chi); FastAPI/Flask decorators handled separately.
    for (const m of code.matchAll(/\b([A-Za-z_]\w*)\.(get|post|put|patch|delete|options|head|GET|POST|PUT|PATCH|DELETE|HandleFunc|Handle)\s*\(\s*['"]([^'"]*)['"]/g)) {
      if (!/\.go$/.test(source) && !/^(?:app|router|server|route|r)$/i.test(m[1])) continue;
      if (/\.py$/.test(source)) continue;
      const raw = m[3], embedded = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+)$/.exec(raw);
      const method = embedded?.[1] ?? (/^Handle/.test(m[2]) ? 'GET' : m[2].toUpperCase());
      addRoute(embedded?.[2] ?? (raw || '/'), method, source, [], auth, isApiFile);
      if (/^Handle/.test(m[2]) && !embedded) warn(`Go handler method unspecified in ${source}; GET is only a candidate.`);
    }
    for (const m of code.matchAll(/@\w+\.(route|get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]*)['"]([^\n]*)/g)) {
      const declared = /methods\s*=\s*\[([^\]]+)\]/.exec(m[3]);
      const methods = declared ? [...declared[1].matchAll(/['"]([A-Z]+)['"]/g)].map(v => v[1]) : [m[1] === 'route' ? 'GET' : m[1].toUpperCase()];
      const isApi = /\b(?:FastAPI|APIRouter)\s*\(/.test(code);
      for (const method of methods) addRoute(m[2] || '/', method, source, [], auth, isApi);
    }
    for (const m of code.matchAll(/\b(path|re_path)\s*\(\s*['"]([^'"]*)['"]/g)) {
      if (!/\.py$/.test(source)) continue;
      if (m[1] === 're_path') { warn(`Regex Django route in ${source} needs a concrete URL.`); continue; }
      addRoute(m[2] || '/', 'GET', source, [], auth, isApiFile);
    }
    // React Router and Vue route records.
    const jsSpans = jsRoutePrefixSpans(code);
    for (const m of code.matchAll(/<Route\b[^>]*\bpath\s*=\s*(?:\{\s*)?['"]([^'"]+)['"]|\bpath\s*:\s*['"]([^'"]+)['"]/g)) {
      const raw = m[1] || m[2];
      const pos = m.index ?? 0;
      let finalPath = raw;
      const activeSpan = jsSpans.filter(s => pos >= s.start && pos <= s.end).pop();
      if (!raw.startsWith('/')) {
        if (activeSpan && activeSpan.prefix) {
          finalPath = activeSpan.prefix + '/' + raw.replace(/^\/+/, '');
        } else {
          finalPath = '/' + raw.replace(/^\/+/, '');
        }
      }
      const nearbyCode = code.slice(pos, Math.min(code.length, pos + 300));
      const routeAuth = /(?:requiresAuth\s*:\s*true|auth\s*:\s*true)/i.test(nearbyCode)
        ? 'auth-required'
        : (activeSpan?.auth || (finalPath.startsWith('/landing-page') || finalPath.startsWith('/kebijakan') || finalPath.startsWith('/syarat') ? 'public' : auth));
      addRoute(finalPath, 'GET', source, [], routeAuth);
    }
    // Next app router: route groups and parallel slots do not contribute URL segments.
    const app = /(?:^|\/)app\/(.*?)\/(page|route)\.[jt]sx?$/.exec(source) || /(?:^|\/)app\/(page|route)\.[jt]sx?$/.exec(source)?.map((v, i) => i === 1 ? '' : v);
    const appFile = /(?:^|\/)app\/(.*?)(?:\/)?(page|route)\.[jt]sx?$/.exec(source);
    if (appFile) {
      const segments = appFile[1].split('/').filter(s => s && !/^\(.*\)$|^@/.test(s));
      if (segments.some(s => /^\(/.test(s))) warn(`Next intercepting route in ${source} needs runtime verification.`);
      else {
        const route = '/' + segments.join('/');
        if (appFile[2] === 'page') addRoute(route, 'GET', source, elements, auth);
        else for (const m of code.matchAll(/export\s+(?:async\s+)?(?:function\s+|const\s+)(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) addRoute(route, m[1], source, [], auth, true);
      }
    }
    const pagesFile = /(?:^|\/)pages\/(.+)\.(?:[jt]sx?|vue)$/.exec(source);
    if (pagesFile && !pagesFile[1].split('/').some(s => s.startsWith('_'))) {
      const route = '/' + pagesFile[1].replace(/(?:^|\/)index$/, '');
      addRoute(route, 'GET', source, elements, auth, pagesFile[1].startsWith('api/'));
    }
    if (/\.html?$/.test(source)) {
      const route = '/' + source.replace(/^(?:public|static|www|wwwroot)\//, '').replace(/(?:^|\/)index\.html?$/, '');
      addRoute(route || '/', 'GET', source, elements, auth);
    }
    if (/\.blade\.php$/.test(source)) {
      const template = source.replace(/^.*?resources\/views\//, '').replace(/\.blade\.php$/, '').replace(/\//g, '.');
      templates.set(template, { elements, source, title: cleanText(/<title[^>]*>([^<]*)<\/title>/i.exec(code)?.[1] || '') || undefined });
    }
    for (const m of code.matchAll(/<(?:a|Link|RouterLink)\b[^>]*\b(?:href|to)\s*=\s*['"]([^'"]+)['"]/gi)) if (m[1].startsWith('/') && !m[1].startsWith('//')) addRoute(m[1], 'GET', source);
    const title = cleanText(/<title[^>]*>([^<]*)<\/title>/i.exec(code)?.[1] || '');
    // Flutter / Dart Screen & Navigation Detection
    if (/\.dart$/i.test(source)) {
      const isScreen = /(?:^|\/)(?:screens?|pages?|tabs?|views?)\//i.test(source) || /(?:_screen|_page|_tab|_view)\.dart$/i.test(source);
      const classMatch = /class\s+(\w+(?:Screen|Page|Tab|View|Shell|StatefulWidget|StatelessWidget))\b/.exec(code);
      if (isScreen || classMatch) {
        const baseName = path.basename(source, '.dart').replace(/_/g, ' ');
        const screenTitle = (classMatch?.[1] ? classMatch[1].replace(/(?:Screen|Page|Tab|View|StatefulWidget|StatelessWidget)$/, '').replace(/([A-Z])/g, ' $1').trim() : baseName) || baseName;
        const route = '/' + path.basename(source, '.dart').replace(/_/g, '-');
        const elements = dartElements(code, source);
        addRoute(route, 'GET', source, elements, auth);
        const existing = pages.get(route);
        if (existing) {
          existing.title = screenTitle.charAt(0).toUpperCase() + screenTitle.slice(1);
        }
      }
      // Named routes in MaterialApp: routes = { '/home': (context) => HomeScreen() }
      for (const m of code.matchAll(/['"](\/[a-zA-Z0-9_\-\/]*)['"]\s*:\s*\([^)]*\)\s*=>/g)) {
        addRoute(m[1], 'GET', source, dartElements(code, source), auth);
      }
    }

    if (elements.length && ![...pages.values()].some(p => p.source === source)) warn(`UI component/template found in ${source}; elements need a confirmed page association.`);
  }
  async function walk(directory: string, depth: number): Promise<void> {
    if (depth > limits.depth) { warn('Directory depth limit reached; inventory is partial.'); return; }
    const dir = await opendir(directory);
    for await (const entry of dir) {
      if (++entries > limits.entries || filesScanned >= limits.files || totalBytes >= limits.totalBytes) { warn('Source scan budget reached; inventory is partial.'); break; }
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const absolute = path.join(directory, entry.name);
      const source = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (excludedDirectories.test(entry.name)) continue;
        try {
          const stat = await lstat(absolute);
          if (stat.isSymbolicLink()) continue;
          const actual = await realpath(absolute);
          if (!actual.startsWith(root + path.sep)) { warn('Skipped a directory outside the source root.'); continue; }
          await walk(absolute, depth + 1);
        } catch { warn(`Cannot read source directory: ${source}`); }
        continue;
      }
      if (!entry.isFile() || !supportedFile.test(entry.name) || excludedFiles.test(entry.name)) continue;
      try {
        const stat = await lstat(absolute);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        if (stat.size > limits.bytes) { warn(`Oversized source file skipped: ${source}`); continue; }
        const actual = await realpath(absolute);
        if (!actual.startsWith(root + path.sep)) continue;
        const handle = await open(absolute, 'r');
        let content: string;
        try {
          const opened = await handle.stat();
          if (opened.ino !== stat.ino || opened.dev !== stat.dev || !opened.isFile()) continue;
          const buffer = Buffer.alloc(limits.bytes + 1);
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
          if (bytesRead > limits.bytes) { warn(`Growing source file skipped: ${source}`); continue; }
          totalBytes += bytesRead;
          content = buffer.subarray(0, bytesRead).toString('utf8');
        } finally { await handle.close(); }
        if (content.includes('\0')) continue;
        filesScanned++;
        inspect(content, source);
      } catch { warn(`Cannot read source file: ${source}`); }
    }
  }
  await walk(root, 0);
  for (const reference of templateReferences) {
    const template = templates.get(reference.template);
    const page = pages.get(reference.route);
    if (!page || !template) continue;
    page.elements = template.elements;
    if (template.title) page.title = template.title;
  }
  warn('Static discovery is heuristic: dynamic routes, nested mounts, permissions and component composition require runtime verification.');
  return { pages: [...pages.values()].sort((a, b) => a.path.localeCompare(b.path)), routes, api, filesScanned, warnings: [...warnings] };
}
