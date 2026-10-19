import { validateFlow } from '@qc/flow-schema';

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

export class GeminiService {
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
    } = {}
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY belum dikonfigurasi pada .env');
    }

    const model = this.getModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const bodyPayload: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxTokens ?? 4096
      }
    };

    if (options.systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: options.systemInstruction }]
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
    baseUrl: ${params.baseUrl || 'http://localhost:3000'}
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
Target URL/AppId: ${isWeb ? params.baseUrl || 'http://localhost:3000' : params.appId || 'com.example.app'}`;

    const rawReply = await this.callGemini(userPrompt, { systemInstruction, temperature: 0.2 });

    // Ekstrak YAML dari code block jika ada
    let cleanYaml = rawReply.trim();
    const yamlMatch = cleanYaml.match(/```(?:yaml)?\s*([\s\S]*?)```/i);
    if (yamlMatch) {
      cleanYaml = yamlMatch[1].trim();
    }

    // Validasi jika web
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
      const rawJson = await this.callGemini(prompt, { systemInstruction, temperature: 0.1 });
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
