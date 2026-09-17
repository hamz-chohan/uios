"use client";

import { useState } from "react";

type Role = "admin" | "editor" | "reviewer";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<Role>("editor");
  const [loginError, setLoginError] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"studio" | "library" | "export" | "settings">("studio");
  const [prompt, setPrompt] = useState<string>("Draft an executive summary on operational clinical metrics for Q3.");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-lite");
  const [outputContent, setOutputContent] = useState<string>(
    "### Executive Summary: Q3 Clinical Operations\n\n- **Study Velocity**: Accrual targets met across 94% of active sites.\n- **Protocol Compliance**: Deviations decreased by 18% following targeted site monitor training.\n- **Data Completeness**: 99.2% of electronic case report forms (eCRFs) locked within the standard 5-day SLA."
  );
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "demo") {
      setIsAuthenticated(true);
      setLoginError("");
    } else {
      setLoginError("Invalid password. Use 'demo' to sign in.");
    }
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setOutputContent((prev) =>
        prev +
        "\n\n#### Additional Insights (Mock Mode):\n- Enhanced cross-functional alignment observed between data management and clinical trial managers.\n- Recommended next step: Schedule risk-based monitoring audit for Tier 1 trial hubs."
      );
      setIsGenerating(false);
    }, 800);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20 text-xl">
              UI
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">UIOS Content Studio</h1>
            <p className="mt-1 text-sm text-slate-400">Sign in with a workspace role</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Workspace Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="admin">Administrator (Full Access)</option>
                <option value="editor">Editor (Author & Refine)</option>
                <option value="reviewer">Reviewer (Audit & Approve)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter password (hint: demo)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              {loginError && <p className="mt-1 text-xs text-rose-400">{loginError}</p>}
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 active:scale-[0.99]"
            >
              Sign In to Studio
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-400">
            Demo credentials: Password is <span className="font-mono text-blue-400">demo</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-3 flex items-center justify-between backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white shadow-md">
              UI
            </span>
            <span className="font-bold tracking-tight text-white">UIOS Content Studio</span>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            MODEL_MODE=mock
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Role:</span>
            <span className="capitalize font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded">
              {selectedRole}
            </span>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <button
            onClick={() => setActiveTab("studio")}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "studio"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <span>✍️</span>
            <span>Content Studio</span>
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "library"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <span>📚</span>
            <span>Library Ground</span>
          </button>
          <button
            onClick={() => setActiveTab("export")}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "export"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <span>📄</span>
            <span>Document Export</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === "settings"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`}
          >
            <span>⚙️</span>
            <span>Configuration</span>
          </button>
        </aside>

        {/* Workspace Panels */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-950">
          {activeTab === "studio" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* Prompt & Controls */}
              <div className="flex flex-col space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
                  <h2 className="text-base font-semibold text-white">Prompt & Generation</h2>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Select Model</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast / Mock)</option>
                      <option value="claude-opus-4-8">claude-opus-4-8 (Deep Reasoning / Mock)</option>
                      <option value="skill-edit-model">skill-edit-model (Specialized)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Instruction / Prompt</label>
                    <textarea
                      rows={5}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs text-slate-500">Local mock generation active</span>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50"
                    >
                      {isGenerating ? "Synthesizing..." : "Generate Content"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-4 text-xs text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">💡 Mock Mode Active</div>
                  <div>No Google Cloud Project or API credentials required for local testing.</div>
                </div>
              </div>

              {/* Output Preview */}
              <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h2 className="text-base font-semibold text-white">Generated Content Preview</h2>
                  <span className="text-xs text-slate-400 font-mono">Markdown / Live Preview</span>
                </div>
                <div className="mt-4 flex-1 rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-sm text-slate-300 whitespace-pre-wrap overflow-y-auto">
                  {outputContent}
                </div>
              </div>
            </div>
          )}

          {activeTab === "library" && (
            <div className="max-w-4xl space-y-4">
              <h2 className="text-xl font-bold text-white">Library Ground (Context Retrieval)</h2>
              <p className="text-sm text-slate-400">
                Ground your generations with standard operating procedures (SOPs), clinical guidelines, and protocol documentation.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {[
                  { name: "SOP-CLIN-401: Data Monitoring Plans", size: "1.2 MB", type: "PDF" },
                  { name: "ICH-GCP Guidelines (E6 R2)", size: "2.8 MB", type: "PDF" },
                  { name: "Q3 Operational KPI Definitions", size: "480 KB", type: "DOCX" },
                  { name: "Safety Endpoint Classification Guide", size: "950 KB", type: "Markdown" },
                ].map((doc, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm text-slate-200">{doc.name}</h3>
                      <p className="text-xs text-slate-500">{doc.type} • {doc.size}</p>
                    </div>
                    <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-300 font-medium">
                      Indexed
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "export" && (
            <div className="max-w-3xl space-y-6">
              <h2 className="text-xl font-bold text-white">Document Export</h2>
              <p className="text-sm text-slate-400">
                Render and export your studio content into distribution-ready formats using integrated document engines.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
                  <div className="text-2xl">📝</div>
                  <h3 className="font-semibold text-white">DOCX Export</h3>
                  <p className="text-xs text-slate-400">Export formatted Word document utilizing <code className="text-blue-400">docx 9.5</code>.</p>
                  <button className="w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                    Export .docx
                  </button>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
                  <div className="text-2xl">📑</div>
                  <h3 className="font-semibold text-white">PDF Export</h3>
                  <p className="text-xs text-slate-400">Generate publication-quality PDF via headless <code className="text-blue-400">puppeteer</code>.</p>
                  <button className="w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">
                    Export .pdf
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="max-w-3xl space-y-6">
              <h2 className="text-xl font-bold text-white">Studio Configuration</h2>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                <h3 className="font-semibold text-slate-200">Current Execution Mode</h3>
                <div className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-300 space-y-1">
                  <div>MODEL_MODE=mock</div>
                  <div>PORT=3001</div>
                  <div>NEXT_TELEMETRY_DISABLED=1</div>
                </div>

                <h4 className="font-semibold text-sm text-slate-300 pt-2">Switching to Live Vertex AI</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  To connect with Google Cloud Vertex AI:
                </p>
                <ol className="list-decimal list-inside text-xs text-slate-400 space-y-1">
                  <li>Set <code className="text-blue-400">MODEL_MODE=live</code> and <code className="text-blue-400">GOOGLE_CLOUD_PROJECT=your-project</code> in <code className="text-slate-300">.env.local</code>.</li>
                  <li>Run <code className="text-blue-400">gcloud auth application-default login</code> in your terminal.</li>
                  <li>Restart <code className="text-blue-400">npm run dev</code>.</li>
                </ol>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

