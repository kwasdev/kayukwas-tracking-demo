'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  Send,
  Mic,
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Code,
  RotateCcw,
  Check,
  Copy,
  Terminal,
  Activity,
  AlertCircle,
  Truck,
  Wrench,
  Loader2,
  Phone,
  UserCheck,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface PresetScenario {
  id: string;
  title: string;
  description: string;
  phone: string;
  input_type: string;
  raw_message: string;
}

interface ReasoningStep {
  step_number: number;
  phase: string;
  detail: string;
}

interface ToolCallRecord {
  tool_name: string;
  input_args: string;
  output_data: string;
}

interface AgentResponse {
  event: string;
  intent: string;
  confidence_score: number;
  user_context?: any;
  extracted_data?: any;
  validation_checks?: {
    is_active_account: boolean;
    is_assigned_to_user: boolean;
    is_within_tolerances: boolean;
    in_house_policy_respected: boolean;
    user_confirmed: boolean;
  };
  reasoning_steps: ReasoningStep[];
  tool_calls: ToolCallRecord[];
  whatsapp_reply: string;
  requires_confirmation: boolean;
  ready_to_commit: boolean;
  escalation_alert?: string;
  draft_payload?: any;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  type?: 'text' | 'voice' | 'vision';
}

export default function AgentParserStudioPage() {
  const [presets, setPresets] = useState<PresetScenario[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('scenario_1');
  const [senderPhone, setSenderPhone] = useState<string>('6281234567890');
  const [inputType, setInputType] = useState<'text' | 'voice' | 'vision'>('text');
  const [inputMessage, setInputMessage] = useState<string>(
    'Pak mandor, SPK 0012 talenan jati sampun rampung 190 iji. Sing 10 pecah serat pas diserut.'
  );

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'agent',
      text: '🤖 Halo! Saya Asisten Agentic AI Kayu KWAS. Silakan kirim laporan produksi (Teks, Voice Note, atau Foto Tally Sheet Kapur).',
      timestamp: '08:00',
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'reasoning' | 'tools' | 'json' | 'guardrails' | 'config'>('reasoning');

  const fetchPresets = async () => {
    try {
      const res = await apiFetch<PresetScenario[]>('/agent/presets');
      if (res.success && res.data) {
        setPresets(res.data);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = presets.find((item) => item.id === presetId);
    if (p) {
      setSenderPhone(p.phone);
      setInputType(p.input_type as any);
      setInputMessage(p.raw_message);
    }
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim()) return;

    const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const newMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: timeNow,
      type: inputType,
    };

    setChatHistory((prev) => [...prev, newMsg]);
    if (!customText) setInputMessage('');
    setLoading(true);

    try {
      const res = await apiFetch<AgentResponse>('/agent/parse', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: senderPhone,
          raw_message: textToSend,
          input_type: inputType,
        }),
      });

      if (res.success && res.data) {
        setAgentResult(res.data);
        const replyMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'agent',
          text: res.data.whatsapp_reply,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        };
        setChatHistory((prev) => [...prev, replyMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'agent',
        text: '⚠️ Terjadi kendala saat menghubungi Agent Engine.',
        timestamp: timeNow,
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmYA = () => {
    handleSendMessage('YA');
  };

  const copyJson = () => {
    if (agentResult) {
      navigator.clipboard.writeText(JSON.stringify(agentResult.extracted_data || agentResult, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-2.5">
            <Bot className="w-7 h-7 text-amber-500" />
            Agentic AI Parsing & Validation Studio
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Engine AI pemroses laporan multi-moda (Teks santai, Voice Note, Foto Tally Kapur) dengan Guardrail & Human-in-the-Loop.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-stone-900/60 border border-stone-800 px-3 py-1.5 rounded-xl text-xs text-amber-400 font-mono">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Nomenklatur: SPK (Manusia) ⇄ Work Order (Sistem)</span>
        </div>
      </div>

      {/* Preset Quick Bar */}
      <div className="bg-stone-900/60 border border-stone-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-500" />
            Pilih Skenario Pengujian Standar (7 Skenario Konsep)
          </span>
          <span className="text-xs text-stone-500 font-mono">Model: Gemini Flash + Whisper STT</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectPreset(p.id)}
              className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                selectedPresetId === p.id
                  ? 'bg-amber-950/50 border-amber-500 text-amber-200 shadow-md'
                  : 'bg-stone-950/60 border-stone-800/80 text-stone-400 hover:border-stone-700 hover:text-stone-200'
              }`}
            >
              <div className="font-bold truncate">{p.title}</div>
              <div className="text-[10px] text-stone-500 line-clamp-1 mt-0.5">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: WhatsApp Simulator vs Deep Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: WhatsApp Chat Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-stone-900/80 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
          {/* WA Top Bar */}
          <div className="bg-[#128C7E] px-4 py-3 flex items-center justify-between text-white shadow">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-stone-900/40 border border-white/20 flex items-center justify-center font-bold text-sm">
                KW
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Kayu KWAS AI Assistant</div>
                <div className="text-[11px] text-emerald-100 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" /> Online (OpenWA Bot)
                </div>
              </div>
            </div>
            <div className="text-right text-[11px] text-emerald-100 font-mono">
              <div>WhatsApp Live Console</div>
              <div className="opacity-80">{senderPhone}</div>
            </div>
          </div>

          {/* Persona & Input Type Selector */}
          <div className="bg-stone-950/90 border-b border-stone-800 p-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-stone-500" />
              <input
                type="text"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                placeholder="No WA Pengirim"
                className="bg-stone-900 border border-stone-800 rounded px-2 py-1 text-stone-200 font-mono text-[11px] w-36 focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-stone-900 p-0.5 rounded border border-stone-800 text-[10px]">
              <button
                type="button"
                onClick={() => setInputType('text')}
                className={`px-2 py-1 rounded transition-all ${
                  inputType === 'text' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400'
                }`}
              >
                Teks
              </button>
              <button
                type="button"
                onClick={() => setInputType('voice')}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${
                  inputType === 'voice' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400'
                }`}
              >
                <Mic className="w-3 h-3" /> Voice
              </button>
              <button
                type="button"
                onClick={() => setInputType('vision')}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${
                  inputType === 'vision' ? 'bg-amber-600 text-stone-950 font-bold' : 'text-stone-400'
                }`}
              >
                <ImageIcon className="w-3 h-3" /> Foto
              </button>
            </div>
          </div>

          {/* WA Chat Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0c1317] bg-opacity-95">
            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-[#005c4b] text-stone-100 rounded-br-none'
                      : 'bg-[#202c33] text-stone-200 rounded-bl-none border border-stone-700/40'
                  }`}
                >
                  {msg.type === 'voice' && (
                    <div className="flex items-center gap-2 mb-1 text-[11px] text-amber-300 font-mono bg-black/20 px-2 py-0.5 rounded">
                      <Mic className="w-3.5 h-3.5 animate-pulse" /> Voice Note Transcribed (Whisper)
                    </div>
                  )}
                  {msg.type === 'vision' && (
                    <div className="flex items-center gap-2 mb-1 text-[11px] text-cyan-300 font-mono bg-black/20 px-2 py-0.5 rounded">
                      <ImageIcon className="w-3.5 h-3.5" /> Vision OCR Tally Detected
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                  <div className="text-[9px] text-right mt-1 text-stone-400 font-mono">
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="bg-[#202c33] text-stone-300 rounded-xl px-3.5 py-2 text-xs flex items-center gap-2 border border-stone-700/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span className="text-[11px]">Asisten sedang menganalisis pesan & data SPK...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Confirmation Action Bar */}
          {agentResult && agentResult.requires_confirmation && (
            <div className="p-2.5 bg-stone-950/90 border-t border-stone-800 flex items-center justify-between gap-2">
              <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                Agen meminta konfirmasi laporan:
              </span>
              <button
                type="button"
                onClick={handleConfirmYA}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-colors shadow flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Balas &quot;YA&quot; (Commit)
              </button>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-stone-950 border-t border-stone-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ketik laporan lapangan bebas..."
              className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500 placeholder:text-stone-600"
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="p-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 rounded-xl transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right: Agent Deep Inspector & Execution Trace (7 cols) */}
        <div className="lg:col-span-7 bg-stone-900/60 border border-stone-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
          {/* Inspector Tabs */}
          <div className="p-3 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('reasoning')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'reasoning'
                    ? 'bg-amber-600 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Reasoning Trace ({agentResult?.reasoning_steps.length || 0})
              </button>

              <button
                onClick={() => setActiveTab('tools')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'tools'
                    ? 'bg-amber-600 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Tool Calls ({agentResult?.tool_calls.length || 0})
              </button>

              <button
                onClick={() => setActiveTab('guardrails')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'guardrails'
                    ? 'bg-amber-600 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Guardrails
              </button>

              <button
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'json'
                    ? 'bg-amber-600 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                JSON
              </button>

              <button
                onClick={() => setActiveTab('config')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'config'
                    ? 'bg-amber-600 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                OpenWA & API Key
              </button>
            </div>

            {agentResult && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded">
                  Score: {(agentResult.confidence_score * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Inspector Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!agentResult ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-500 text-xs text-center p-8">
                <Bot className="w-12 h-12 text-stone-700 mb-3" />
                <p className="font-semibold text-stone-400">Belum Ada Sesi Ekstraksi Aktif</p>
                <p className="text-stone-600 mt-1 max-w-sm">
                  Pilih skenario pengujian di atas atau kirim pesan melalui console chat untuk melihat langkah reasoning, pemanggilan tool, dan output terstruktur secara live.
                </p>
              </div>
            ) : (
              <>
                {/* Escalation Alert Box */}
                {agentResult.escalation_alert && (
                  <div className="p-3.5 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-red-200 uppercase tracking-wider">
                        Mandor Escalation Alert Triggered
                      </div>
                      <div className="mt-1">{agentResult.escalation_alert}</div>
                    </div>
                  </div>
                )}

                {/* Tab: Reasoning Trace */}
                {activeTab === 'reasoning' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                      Tahapan Penalaran Agen AI (Cognitive Steps)
                    </h4>
                    <div className="space-y-2.5">
                      {agentResult.reasoning_steps.map((step) => (
                        <div
                          key={step.step_number}
                          className="bg-stone-950 border border-stone-800 p-3 rounded-xl space-y-1"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-amber-400 font-mono">
                              Step {step.step_number}: {step.phase}
                            </span>
                          </div>
                          <p className="text-xs text-stone-300 leading-relaxed">{step.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab: Tool Calls */}
                {activeTab === 'tools' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                      Internal Function / Tool Calling Log
                    </h4>
                    <div className="space-y-2.5">
                      {agentResult.tool_calls.map((t, idx) => (
                        <div
                          key={idx}
                          className="bg-stone-950 border border-stone-800 p-3 rounded-xl space-y-2 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between text-cyan-400 font-bold">
                            <span>🛠️ {t.tool_name}()</span>
                          </div>
                          <div className="text-[11px] text-stone-400 bg-stone-900/70 p-2 rounded border border-stone-800">
                            <span className="text-stone-500">Args:</span> {t.input_args}
                          </div>
                          {t.output_data && (
                            <div className="text-[11px] text-emerald-400 bg-emerald-950/20 p-2 rounded border border-emerald-900/30">
                              <span className="text-stone-500">Output:</span> {t.output_data}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab: Guardrail Checks */}
                {activeTab === 'guardrails' && agentResult.validation_checks && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                      Pemeriksaan Kebijakan & Guardrail Sistem
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-stone-950 border border-stone-800 p-3 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-stone-400">Akun Aktif & Terverifikasi</span>
                          {agentResult.validation_checks.is_active_account ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {agentResult.validation_checks.is_active_account
                            ? 'Lolos activation barrier'
                            : 'Pengguna PENDING_ACTIVATION'}
                        </div>
                      </div>

                      <div className="bg-stone-950 border border-stone-800 p-3 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-stone-400">Kebijakan 100% In-House</span>
                          {agentResult.validation_checks.in_house_policy_respected ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {agentResult.validation_checks.in_house_policy_respected
                            ? 'Stasiun 4 & 5 aman'
                            : 'Pelanggaran batas mitra di Stasiun 4/5'}
                        </div>
                      </div>

                      <div className="bg-stone-950 border border-stone-800 p-3 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-stone-400">Kesesuaian Toleransi Qty</span>
                          {agentResult.validation_checks.is_within_tolerances ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500">Tidak melebihi batas bahan baku SPK</div>
                      </div>

                      <div className="bg-stone-950 border border-stone-800 p-3 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-stone-400">Konfirmasi Human-in-the-Loop</span>
                          {agentResult.validation_checks.user_confirmed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <span className="text-[10px] text-amber-400 font-mono">Menunggu &quot;YA&quot;</span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500">Mencegah mutasi data diam-diam</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab: Structured JSON Output */}
                {activeTab === 'json' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                        JSON Payload Schema Output
                      </span>
                      <button
                        onClick={copyJson}
                        className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded flex items-center gap-1 border border-stone-700"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" /> Disalin!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Salin JSON
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="bg-stone-950 p-4 rounded-xl border border-stone-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-96">
                      {JSON.stringify(agentResult.extracted_data || agentResult, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Tab: OpenWA & AI Config */}
                {activeTab === 'config' && (
                  <div className="space-y-4">
                    <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                          <Bot className="w-4 h-4 text-amber-500" />
                          Status Integrasi LLM (Google Gemini / OpenAI)
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-mono">
                          Mode: Production Ready
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
                          <div className="text-stone-500 text-[10px] uppercase font-semibold">Active Provider</div>
                          <div className="text-stone-200 font-mono font-bold mt-0.5">Google Gemini (Default) / OpenAI</div>
                        </div>
                        <div className="bg-stone-900/60 p-2.5 rounded-lg border border-stone-800">
                          <div className="text-stone-500 text-[10px] uppercase font-semibold">Model ID</div>
                          <div className="text-stone-200 font-mono font-bold mt-0.5">gemini-1.5-flash</div>
                        </div>
                      </div>

                      <div className="p-3 bg-stone-900/40 rounded-lg border border-stone-800 text-xs text-stone-400 space-y-1">
                        <div className="text-stone-300 font-semibold flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                          Konfigurasi API Key di <code className="text-amber-300">backend/.env</code>:
                        </div>
                        <pre className="text-[11px] font-mono text-stone-300 bg-black/40 p-2 rounded border border-stone-800 overflow-x-auto">
GEMINI_API_KEY=AIzaSy... (Google AI Studio Key)
OPENAI_API_KEY=sk-... (Opsional)
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash
                        </pre>
                        <p className="text-[11px] text-stone-500">
                          *Jika API Key diisi, sistem otomatis memanggil AI Generative dengan System Prompt Woodworking. Jika kosong/timeout, sistem fallback ke high-precision local deterministic engine.
                        </p>
                      </div>
                    </div>

                    <div className="bg-stone-950 border border-stone-800 p-4 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                          <Truck className="w-4 h-4 text-emerald-500" />
                          WhatsApp Gateway Live Connection (OpenWA)
                        </h4>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800 text-blue-300 font-mono">
                          Webhook Receiver Active
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="bg-stone-900/60 p-2.5 rounded-lg border border-stone-800 space-y-1">
                          <div className="text-stone-500 text-[10px] uppercase font-semibold">Webhook Inbound URL</div>
                          <div className="text-amber-300 font-mono text-[11px] select-all bg-black/30 p-1.5 rounded">
                            POST http://localhost:8080/api/v1/webhook/openwa
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-stone-900/60 p-2 rounded border border-stone-800">
                            <span className="text-stone-500">Gateway URL:</span> <span className="text-stone-300 font-mono">http://localhost:8000</span>
                          </div>
                          <div className="bg-stone-900/60 p-2 rounded border border-stone-800">
                            <span className="text-stone-500">HMAC Auth:</span> <span className="text-stone-300 font-mono">X-OpenWA-Signature</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
