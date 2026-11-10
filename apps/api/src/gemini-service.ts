import { createHash } from 'node:crypto';
import { validateFlow } from '@qc/flow-schema';
import type { CoverageGapItem, Phase1ReconSummary } from './discovery/types.ts';

export interface GeminiConfig {
  configured: boolean;
  model: string;
  keyMasked: string;
}

export interface GeminiConnectionResult {
  success: boolean;
  model: string;
  message: string;
  latencyMs: number;
}

export interface GeneratedFlowResult {
  name: string;
  platform: 'web' | 'android';
  yaml: string;
  explanation: string;
  valid: boolean;
  validationErrors?: string[];
}

export interface FailureDiagnosis {
  rootCause: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionableSteps: string[];
}

export type GeminiEnvAuthSchema = {
  envHints: Record<string, string>;
  roles: string[];
  identifierField: string;
  loginPath: string;
  authEndpoints: string[];
};

export type GeminiGapDiagnosis = {
  id: string;
  summaryId: string;
  likelyCause: string;
  recommendedFix: string;
  ownerRole: 'frontend' | 'backend' | 'mobile' | 'infra';
};

export class GeminiService {
  private static cache = new Map<string, { value: unknown; expiresAt: number }>();

  private static getApiKey(): string {
    return process.env.GEMINI_API_KEY?.trim() || '';
  }

  public static getModel(): string {
    return process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
  }

  public static isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public static getConfig(): GeminiConfig {
    const key = this.getApiKey();
    const masked = key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : (key ? '****' : '');
    return {
      configured: Boolean(key),
      model: this.getModel(),
      keyMasked: masked
    };
  }

  public static scrubSecrets(raw: string, extraSecrets: string[] = []): string {
    let text = raw || '';
    const envSecrets = Object.entries(process.env)
      .filter(([name, value]) => Boolean(value) && /key|token|secret|password|passwd|auth|private|credential/i.test(name))
      .map(([, value]) => String(value));

    const allSecrets = [...new Set([...envSecrets, ...extraSecrets])]
      .filter((s) => s.length >= 6)
      .sort((a, b) => b.length - a.length);

    for (const secret of allSecrets) {
      text = text.replaceAll(secret, '[REDACTED]');
    }
    text = text
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
      .replace(/((?:password|passwd|token|secret|api_key|apikey|authorization|db_password|app_key)\s*[:=]\s*)(["']?)[^\s"'&\r\n]+\2/gi, '$1[REDACTED]');
    return text;
  }

  private static capPrompt(prompt: string, maxChars = 4000, extraSecrets: string[] = []): string {
    const clean = this.scrubSecrets(prompt, extraSecrets);
    if (clean.length <= maxChars) return clean;
    return `${clean.slice(0, maxChars - 36)}\n...[TRUNCATED_TO_4KB_BUDGET]`;
  }

  private static cacheKey(namespace: string, payload: string): string {
    return createHash('sha256').update(`${namespace}:${this.getModel()}:${payload}`).digest('hex');
  }

  private static getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private static setCached(key: string, value: unknown, ttlMs = 15 * 60_000): void {
    if (this.cache.size > 200) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Mengirim request langsung ke Google Gemini REST API v1beta
   */
  public static async callGemini(
    prompt: string,
    options: {
      systemInstruction?: string;
      temperature?: number;
      maxTokens?: number;
      timeoutMs?: number;
      responseMimeType?: 'text/plain' | 'application/json';
      extraSecrets?: string[];
    } = {}
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY belum dikonfigurasi pada .env');
    }

    const model = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const safePrompt = this.capPrompt(prompt, 6000, options.extraSecrets);

    const generationConfig: Record<string, unknown> = {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxTokens ?? 4096
    };
    if (options.responseMimeType) {
      generationConfig.responseMimeType = options.responseMimeType;
    }

    const bodyPayload: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: safePrompt }]
        }
      ],
      generationConfig
    };

    if (options.systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: this.scrubSecrets(options.systemInstruction, options.extraSecrets) }]
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal
      });

      const data = await response.json().catch(() => null) as any;

      if (!response.ok) {
        const errorMsg = data?.error?.message || `Gemini API HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      const candidateParts = data?.candidates?.[0]?.content?.parts || [];
      const textPart = candidateParts.find((p: any) => typeof p.text === 'string' && p.text.trim().length > 0);
      const text = textPart?.text || candidateParts[0]?.text;
      if (!text) {
        throw new Error('Gemini API mengembalikan respons kosong (tidak ada kandidat teks).');
      }

      return text;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Gemini API request timeout setelah ${options.timeoutMs ?? 30000}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  public static async callGeminiJson<T>(
    namespace: string,
    prompt: string,
    systemInstruction: string,
    fallback: () => T,
    options: { timeoutMs?: number; extraSecrets?: string[] } = {}
  ): Promise<T> {
    if (!this.isConfigured()) return fallback();
    const boundedPrompt = this.capPrompt(prompt, 4000, options.extraSecrets);
    const key = this.cacheKey(namespace, `${systemInstruction}\n${boundedPrompt}`);
    const cached = this.getCached<T>(key);
    if (cached !== undefined) return cached;

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await this.callGemini(boundedPrompt, {
          systemInstruction,
          temperature: 0.1,
          maxTokens: 2048,
          timeoutMs: options.timeoutMs ?? 20_000,
          responseMimeType: 'application/json',
          extraSecrets: options.extraSecrets
        });
        const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned) as T;
        this.setCached(key, parsed);
        return parsed;
      } catch (err) {
        lastError = err;
      }
    }
    void lastError;
    return fallback();
  }

  /**
   * Tes koneksi ke Gemini API
   */
  public static async testConnection(): Promise<GeminiConnectionResult> {
    const start = Date.now();
    try {
      const reply = await this.callGemini('Kirim balasan tepat satu kata: "PONG"', {
        temperature: 0.1,
        maxTokens: 1000,
        timeoutMs: 15000
      });
      return {
        success: true,
        model: this.getModel(),
        message: `Koneksi berhasil terhubung (${reply.trim()})`,
        latencyMs: Date.now() - start
      };
    } catch (error: any) {
      return {
        success: false,
        model: this.getModel(),
        message: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - start
      };
    }
  }

  /**
   * FR-09 Touchpoint 1: Menebak nilai dummy aman untuk env key tak dikenal serta skema auth/role dari potongan kode
   */
  public static async inferEnvAndAuthSchema(input: {
    unknownEnvKeys: string[];
    authSnippets: string[];
    routeSnippets: string[];
    extraSecrets?: string[];
  }): Promise<GeminiEnvAuthSchema> {
    const fallback = (): GeminiEnvAuthSchema => ({
      envHints: {},
      roles: [],
      identifierField: 'email',
      loginPath: '/login',
      authEndpoints: ['/api/login', '/api/v1/login', '/login']
    });

    if (!this.isConfigured() || (input.unknownEnvKeys.length === 0 && input.authSnippets.length === 0)) {
      return fallback();
    }

    const systemInstruction = `Anda adalah arsitek QA & DevOps QC Maestro.
Analisis daftar env key dan cuplikan kode auth/route tanpa kredensial nyata.
Kembalikan JSON persis:
{
  "envHints": { "KEY_NAME": "safe_demo_value" },
  "roles": ["admin", "user"],
  "identifierField": "email" | "username" | "nis" | "phone",
  "loginPath": "/login",
  "authEndpoints": ["/api/login"]
}
Jangan pernah gunakan data sensitif nyata; gunakan placeholder lokal yang valid secara sintaks (contoh port, boolean, URL lokal, string dummy).`;

    const prompt = JSON.stringify({
      unknownEnvKeys: input.unknownEnvKeys.slice(0, 30),
      routeSnippets: input.routeSnippets.slice(0, 20),
      authSnippets: input.authSnippets.slice(0, 8).map((s) => s.slice(0, 350))
    });

    const res = await this.callGeminiJson<Partial<GeminiEnvAuthSchema>>('env-auth-schema', prompt, systemInstruction, fallback, {
      extraSecrets: input.extraSecrets
    });

    return {
      envHints: res.envHints && typeof res.envHints === 'object' ? res.envHints : {},
      roles: Array.isArray(res.roles) ? res.roles.map((r) => String(r).trim().toLowerCase()).filter(Boolean) : [],
      identifierField: typeof res.identifierField === 'string' && res.identifierField.trim() ? res.identifierField.trim() : 'email',
      loginPath: typeof res.loginPath === 'string' && res.loginPath.startsWith('/') ? res.loginPath : '/login',
      authEndpoints: Array.isArray(res.authEndpoints) ? res.authEndpoints.map(String) : []
    };
  }

  /**
   * FR-09 Touchpoint 2: Memberi nama layar dan tab yang ramah manusia dari slug / XML / elemen UI
   */
  public static async labelScreensAndTabs(items: Array<{ id: string; rawPathOrWidget: string; sampleTexts: string[] }>): Promise<Record<string, string>> {
    const fallback = (): Record<string, string> => Object.fromEntries(items.map((i) => [i.id, i.rawPathOrWidget]));
    if (!this.isConfigured() || items.length === 0) return fallback();

    const systemInstruction = `Ubah daftar ID halaman/layar/tab teknis berikut menjadi judul singkat Bahasa Indonesia (2-5 kata) yang jelas untuk laporan QA.
Kembalikan JSON object mapping { "<id>": "<label ramah manusia>" }.`;

    const prompt = JSON.stringify(items.slice(0, 25));
    const result = await this.callGeminiJson<Record<string, string>>('label-screens', prompt, systemInstruction, fallback);
    return result && typeof result === 'object' ? result : fallback();
  }

  /**
   * FR-09 Touchpoint 3: Self-healing selector atau penyelesaian parameter rute dinamis (:id / [id])
   */
  public static async resolveSelfHealingTarget(context: {
    pagePath: string;
    reason: string;
    observedLinks: string[];
    interactiveTexts: string[];
  }): Promise<{ resolvedPath?: string; fallbackSelector?: string; note: string }> {
    const fallback = () => ({ note: 'Menggunakan fallback deterministik tanpa Gemini' });
    if (!this.isConfigured()) return fallback();

    const systemInstruction = `Anda membantu crawler QA mengatasi rute dinamis (mis. /users/:id) atau elemen klik yang berubah.
Kembalikan JSON: { "resolvedPath": "/path/nyata atau kosong", "fallbackSelector": "css selector atau kosong", "note": "alasan singkat" }.`;

    const prompt = JSON.stringify({
      pagePath: context.pagePath,
      reason: context.reason,
      observedLinks: context.observedLinks.slice(0, 20),
      interactiveTexts: context.interactiveTexts.slice(0, 20)
    });

    return await this.callGeminiJson('self-heal-target', prompt, systemInstruction, fallback);
  }

  /**
   * FR-09 Touchpoint 4: Mendiagnosis daftar halaman yang gagal dicek / CoverageGapItem secara batch
   */
  public static async diagnoseCoverageGaps(gaps: CoverageGapItem[]): Promise<Record<string, NonNullable<CoverageGapItem['aiDiagnosis']>>> {
    const fallback = (): Record<string, NonNullable<CoverageGapItem['aiDiagnosis']>> => {
      const out: Record<string, NonNullable<CoverageGapItem['aiDiagnosis']>> = {};
      for (const gap of gaps) {
        out[gap.id] = {
          summaryId: gap.technicalReason || `Halaman ${gap.pagePath} tidak dapat diproses penuh pada fase ${gap.phaseFailed}.`,
          likelyCause: gap.httpStatus === 403
            ? 'Akses ditolak oleh middleware/otorisasi untuk role ini.'
            : gap.httpStatus && gap.httpStatus >= 500
            ? 'Server backend mengembalikan error internal (5xx) atau konfigurasi/migrasi belum lengkap.'
            : gap.category === 'dynamic-param-unresolved'
            ? 'Parameter rute dinamis tidak memiliki data ID sampel di database/halaman daftar.'
            : 'Elemen tujuan tidak ditemukan, timeout, atau terjadi pengalihan rute tak terduga.',
          recommendedFix: gap.httpStatus === 403
            ? 'Periksa role permission / middleware otorisasi dan pastikan rute memang diperbolehkan untuk role tersebut.'
            : gap.httpStatus && gap.httpStatus >= 500
            ? 'Cek log backend, skema tabel database, dan variabel .env yang dibutuhkan endpoint terkait.'
            : 'Tambahkan data seed sampel untuk rute detail atau perbaiki selector/navigasi pada layar terkait.',
          ownerRole: gap.httpStatus && gap.httpStatus >= 500 ? 'backend' : gap.phaseFailed === 'EMULATOR' ? 'mobile' : 'frontend'
        };
      }
      return out;
    };

    if (gaps.length === 0) return {};
    if (!this.isConfigured()) return fallback();

    const systemInstruction = `Anda adalah Senior QA Lead QC Maestro.
Untuk setiap kendala cakupan pengujian (coverage gap) berikut, berikan diagnosis ringkas dalam Bahasa Indonesia agar developer cepat memperbaikinya.
Kembalikan JSON object keyed by gap "id":
{
  "<gap.id>": {
    "summaryId": "Ringkasan 1 kalimat jelas kenapa gagal",
    "likelyCause": "Akar penyebab teknis paling mungkin",
    "recommendedFix": "Langkah perbaikan spesifik",
    "ownerRole": "frontend" | "backend" | "mobile" | "infra"
  }
}`;

    const compactGaps = gaps.slice(0, 20).map((g) => ({
      id: g.id,
      role: g.role,
      pagePath: g.pagePath,
      phaseFailed: g.phaseFailed,
      category: g.category,
      httpStatus: g.httpStatus,
      redirectedTo: g.redirectedTo,
      failedApiCalls: (g.failedApiCalls || []).slice(0, 3),
      errors: (g.consoleOrDeviceErrors || []).slice(0, 2),
      technicalReason: g.technicalReason.slice(0, 220)
    }));

    const parsed = await this.callGeminiJson<Record<string, NonNullable<CoverageGapItem['aiDiagnosis']>>>(
      'diagnose-gaps',
      JSON.stringify(compactGaps),
      systemInstruction,
      fallback
    );

    const fb = fallback();
    const merged: Record<string, NonNullable<CoverageGapItem['aiDiagnosis']>> = {};
    for (const gap of gaps) {
      const item = parsed?.[gap.id];
      merged[gap.id] = item && item.summaryId
        ? {
            summaryId: String(item.summaryId),
            likelyCause: String(item.likelyCause || fb[gap.id].likelyCause),
            recommendedFix: String(item.recommendedFix || fb[gap.id].recommendedFix),
            ownerRole: ['frontend', 'backend', 'mobile', 'infra'].includes(item.ownerRole) ? item.ownerRole : fb[gap.id].ownerRole
          }
        : fb[gap.id];
    }
    return merged;
  }

  public static async summarizePhase1Report(input: {
    projectName: string;
    summary: Phase1ReconSummary;
    coverageGaps: CoverageGapItem[];
  }): Promise<string> {
    const gapCount = input.coverageGaps.length;
    const ssCaptured = input.summary.batch1CapturedCount ?? 0;
    const ssTotal = input.summary.batch1TotalScreenshots ?? 0;
    const videoCaptured = input.summary.batch2RecordedCount ?? 0;
    const videoTotal = input.summary.batch2TotalRoleVideos ?? 0;
    const deterministic = `Audit Fase 1 pada ${input.projectName} (${input.summary.platform.toUpperCase()}) mendeteksi ${input.summary.totalRoles} role dengan ${input.summary.totalPages} halaman unik dan ${input.summary.totalInteractiveFeatures} fitur/tab interaktif. Eksekusi pasca-ACC menghasilkan ${ssCaptured}/${ssTotal} screenshot panjang (full-page) serta ${videoCaptured}/${videoTotal} video perjalanan penuh per role. ${gapCount === 0 ? 'Tidak ada halaman yang terlewati pada cakupan kali ini.' : `Terdapat ${gapCount} halaman/layar yang gagal atau memiliki kendala akses yang tercatat rinci pada bagian Kendala Cakupan.`}`;

    if (!this.isConfigured()) return deterministic;

    try {
      const prompt = JSON.stringify({
        projectName: input.projectName,
        platform: input.summary.platform,
        totalRoles: input.summary.totalRoles,
        totalPages: input.summary.totalPages,
        totalInteractiveFeatures: input.summary.totalInteractiveFeatures,
        ssCaptured,
        ssTotal,
        videoCaptured,
        videoTotal,
        gapCount,
        topGaps: input.coverageGaps.slice(0, 5).map((g) => `${g.role} ${g.pagePath}: ${g.category} (${g.technicalReason.slice(0, 120)})`)
      });
      const text = await this.callGemini(prompt, {
        systemInstruction: 'Tuliskan ringkasan eksekutif 2 paragraf singkat dalam Bahasa Indonesia yang faktual mengenai cakupan halaman, long screenshot, video per role, dan kendala halaman yang tidak bisa dicek.',
        temperature: 0.2,
        maxTokens: 700,
        timeoutMs: 15_000
      });
      return text.trim() || deterministic;
    } catch {
      return deterministic;
    }
  }

  /**
   * Menghasilkan Test Flow (Web Playwright atau Android Maestro) dari prompt natural language
   */
  public static async generateFlowFromPrompt(params: {
    prompt: string;
    platform: 'web' | 'android';
    baseUrl?: string;
    appId?: string;
  }): Promise<GeneratedFlowResult> {
    const isWeb = params.platform === 'web';

    const systemInstruction = isWeb
      ? `Anda adalah spesialis QA Automation QC Maestro.
Tugas Anda: Menghasilkan spesifikasi test flow Playwright Web berbasis format QC Flow YAML yang valid.

Aturan Schema Web:
- name: string (nama skenario)
- target:
    platform: web
    baseUrl: ${params.baseUrl || 'http://127.0.0.1:3000'}
    browser: chromium
- execution:
    timeoutMs: 30000
- steps:
    - action: open
      url: "/"
    - action: click | input | clear | waitFor | assertVisible | assertText | assertUrl | screenshot
      target:
        text: "..." (atau testId, selector, label, placeholder)
      value: "..." (jika input/assertText)

HANYA kembalikan format YAML murni di dalam tag markdown \`\`\`yaml ... \`\`\`. Tidak ada teks pengantar lain di luar code block.`
      : `Anda adalah spesialis QA Automation QC Maestro untuk Android (Maestro).
Tugas Anda: Menghasilkan Maestro YAML flow untuk aplikasi Android.

Format Maestro Android:
appId: ${params.appId || 'com.example.app'}
name: "Nama Skenario"
---
- tapOn:
    text: "..."
- inputText: "..."
- assertVisible:
    text: "..."
- takeScreenshot: "..."

HANYA kembalikan format YAML murni di dalam tag markdown \`\`\`yaml ... \`\`\`. Tidak ada teks pengantar lain di luar code block.`;

    const userPrompt = `Buatkan test flow untuk:
Platform: ${params.platform}
Deskripsi Skenario: ${params.prompt}
Target URL/AppId: ${isWeb ? params.baseUrl || 'http://127.0.0.1:3000' : params.appId || 'com.example.app'}`;

    const rawReply = await this.callGemini(userPrompt, { systemInstruction, temperature: 0.2 });

    let cleanYaml = rawReply.trim();
    const yamlMatch = cleanYaml.match(/```(?:yaml)?\s*([\s\S]*?)```/i);
    if (yamlMatch) {
      cleanYaml = yamlMatch[1].trim();
    }

    let valid = true;
    let validationErrors: string[] = [];
    let flowName = 'Generated AI Flow';

    if (isWeb) {
      const validation = validateFlow(cleanYaml);
      valid = validation.valid;
      if (!validation.valid) {
        validationErrors = validation.errors.map((e) => `${e.path}: ${e.message}`);
      } else if (validation.flow?.name) {
        flowName = validation.flow.name;
      }
    } else {
      const nameMatch = cleanYaml.match(/name:\s*["']?([^"'\n\r]+)["']?/);
      if (nameMatch) {
        flowName = nameMatch[1].trim();
      }
    }

    return {
      name: flowName,
      platform: params.platform,
      yaml: cleanYaml,
      explanation: `Dihasilkan oleh model Gemini (${this.getModel()})`,
      valid,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined
    };
  }

  /**
   * Menganalisis kegagalan run / defect dan memberikan diagnosis cerdas
   */
  public static async diagnoseFailure(context: {
    flowName: string;
    stepName?: string;
    error: string;
    logs?: string[];
    pageUrl?: string;
  }): Promise<FailureDiagnosis> {
    const systemInstruction = `Anda adalah senior QA architect & debugger untuk QC Maestro.
Analisis kegagalan skenario pengujian dan berikan diagnosis dalam format JSON persis seperti berikut:
{
  "rootCause": "Penjelasan singkat akar penyebab kegagalan",
  "recommendation": "Langkah mitigasi atau perbaikan yang direkomendasikan",
  "severity": "low" | "medium" | "high" | "critical",
  "actionableSteps": [
    "Langkah 1",
    "Langkah 2"
  ]
}
HANYA kirimkan JSON murni.`;

    const prompt = `Berikut detail kegagalan:
Flow: ${context.flowName}
Step: ${context.stepName || 'Tidak spesifik'}
Error: ${context.error}
Page/Target: ${context.pageUrl || 'N/A'}
Logs Cuplikan:
${(context.logs || []).slice(-15).join('\n')}`;

    try {
      const rawJson = await this.callGemini(prompt, { systemInstruction, temperature: 0.1, responseMimeType: 'application/json' });
      const cleanJson = rawJson.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        rootCause: parsed.rootCause || 'Tidak dapat mendeteksi akar masalah secara spesifik.',
        recommendation: parsed.recommendation || 'Periksa kembali selector dan ketersediaan backend.',
        severity: ['low', 'medium', 'high', 'critical'].includes(parsed.severity) ? parsed.severity : 'medium',
        actionableSteps: Array.isArray(parsed.actionableSteps) ? parsed.actionableSteps : ['Periksa log eksekusi terminal']
      };
    } catch {
      return {
        rootCause: context.error || 'Terjadi kesalahan saat mengeksekusi step pengujian.',
        recommendation: 'Cek koneksi target sistem, timeout step, dan kesesuaian elemen UI.',
        severity: 'high',
        actionableSteps: ['Verifikasi ketersediaan elemen di halaman', 'Tingkatkan timeout pengujian jika jaringan lambat']
      };
    }
  }

  /**
   * Membuat ringkasan eksekutif laporan kualitas
   */
  public static async summarizeReport(reportData: {
    projectName: string;
    totalRuns: number;
    passed: number;
    failed: number;
    durationMs?: number;
    failures?: Array<{ name: string; error: string }>;
  }): Promise<string> {
    const systemInstruction = `Anda adalah QA Lead yang membuat Ringkasan Eksekutif Uji Mutu untuk stakeholders.
Tuliskan ringkasan 2-3 paragraf singkat, profesional, objektif, dengan menyebutkan tingkat kelulusan, area risiko (jika ada kegagalan), dan kesiapan rilis.`;

    const prompt = `Proyek: ${reportData.projectName}
Total Pengujian: ${reportData.totalRuns}
Lulus: ${reportData.passed}
Gagal: ${reportData.failed}
Tingkat Kelulusan: ${((reportData.passed / (reportData.totalRuns || 1)) * 100).toFixed(1)}%
${reportData.failures && reportData.failures.length > 0 ? `Daftar Kegagalan:\n${reportData.failures.map((f) => `- ${f.name}: ${f.error}`).join('\n')}` : 'Semua skenario pengujian berhasil.'}`;

    return await this.callGemini(prompt, { systemInstruction, temperature: 0.3 });
  }
}
