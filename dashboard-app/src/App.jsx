import { useState, useRef, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

const enrollmentData = [
  { grade: "Grade 4", enrollment: 427167, schools: 6467, avg: 66 },
  { grade: "Grade 8", enrollment: 435076, schools: 3511, avg: 124 },
];

const assessmentData = [
  { label: "Math · Gr 4", score2019: 234.72, score2022: 230.36, change: -4.36 },
  { label: "Math · Gr 8", score2019: 275.61, score2022: 269.81, change: -5.80 },
  { label: "Read · Gr 4", score2019: 216.48, score2022: 214.39, change: -2.09 },
  { label: "Read · Gr 8", score2019: 258.83, score2022: 258.79, change: -0.04 },
];

const anomalyLogs = [
  { id: 1, run: "2026-03-30 05:01", status: "healthy", failures: 0, tests: 10, details: [] },
  {
    id: 2, run: "2026-03-30 04:00", status: "failed", failures: 2, tests: 8,
    details: [
      { test: "accepted_range · enrollment", explanation: "A numeric field is out of the expected range.", recommendation: "Check for data entry errors or API changes in the source." },
      { test: "not_null · enrollment", explanation: "A required field contains NULL values.", recommendation: "Check the source data and extract logic for missing values." },
    ],
  },
];

const SYSTEM_PROMPT = `You are a data analyst assistant for the elt-pipeline-ai project — a California K-12 education data pipeline built by Rebecca Raezada.

Here is the full dataset context:

ENROLLMENT DATA (California public schools, 2022):
- Grade 4: 427,167 students across 6,467 schools. Average 66 students per school.
- Grade 8: 435,076 students across 3,511 schools. Average 124 students per school.
- Total: 862,243 students across 9,978 schools.

NAEP ASSESSMENT SCORES (California state average, pre vs post pandemic):
- Math Grade 4:    2019 = 234.72,  2022 = 230.36,  change = -4.36  (declined)
- Math Grade 8:    2019 = 275.61,  2022 = 269.81,  change = -5.80  (declined — hardest hit)
- Reading Grade 4: 2019 = 216.48,  2022 = 214.39,  change = -2.09  (declined)
- Reading Grade 8: 2019 = 258.83,  2022 = 258.79,  change = -0.04  (most resilient)

PIPELINE STATUS:
- Last run: 2026-03-30 05:01 UTC — healthy
- dbt tests: 10/10 passing
- Open anomalies: 0

ANOMALY LOG:
- Run 2026-03-30 05:01: healthy, 10 tests passed, 0 failures
- Run 2026-03-30 04:00: failed, 8 tests passed, 2 failures
  - Failure 1: accepted_range · enrollment — a numeric field out of expected range. Recommendation: check for data entry errors or API changes.
  - Failure 2: not_null · enrollment — a required field contains NULL values. Recommendation: check the source data and extract logic.

PIPELINE STACK: PostgreSQL 15, dbt 1.11, Apache Airflow 2.10, Python 3.13, Poetry 2.3, Docker.
DATA SOURCES: Urban Institute CCD API (enrollment), NAEP Data Service API (assessment scores).

Answer questions concisely and factually based on this data. If asked something outside this dataset, say so clearly.`;

const fmt = (n) => n.toLocaleString();
const sign = (n) => (n > 0 ? "+" : "") + n.toFixed(2);

const C = {
  bg:       "#f8f7f4",
  surface:  "#ffffff",
  surface2: "#f4f3f0",
  border:   "#e5e2d9",
  border2:  "#ede9e0",
  text:     "#111110",
  text2:    "#6b7280",
  text3:    "#9ca3af",
  amber:    "#8b6f2a",
  blue:     "#2a5f8b",
  green:    "#16a34a",
  red:      "#dc2626",
  orange:   "#ea580c",
  mono:     "monospace",
  serif:    "'Georgia', 'Times New Roman', serif",
};

const SUGGESTED = [
  "Which subject declined the most?",
  "How many grade 4 schools are there?",
  "What happened in the failed run?",
  "Which grade was most resilient?",
];

export default function K12Dashboard() {
  const [tab, setTab]           = useState("enrollment");
  const [activeLog, setActiveLog] = useState(null);
  const [apiKey, setApiKey]     = useState("");
  const [keyEntered, setKeyEntered] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi Rebecca! Ask me anything about the K-12 pipeline data — enrollment, assessment trends, anomaly reports, or pipeline status." }
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const chatEndRef              = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: question }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const reply = data.content[0].text;
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: C.serif, background: C.bg, minHeight: "100vh", color: C.text }}>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "28px 40px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 10, letterSpacing: "0.18em", color: C.text2, textTransform: "uppercase", fontFamily: C.mono }}>
            elt-pipeline-ai · California K-12
          </p>
          <h1 style={{ margin: "0 0 4px", fontSize: 28, fontWeight: 400, color: C.text, letterSpacing: "-0.02em" }}>
            Education Data Pipeline
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: C.text2, fontStyle: "italic" }}>
            2022 enrollment · NAEP assessment trends 2019–2022
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#f0faf0", border: `1px solid #bbdebb`, borderRadius: 6, padding: "7px 14px", marginBottom: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
            <span style={{ fontSize: 11, fontFamily: C.mono, color: C.green }}>Pipeline healthy</span>
          </div>
          <p style={{ margin: 0, fontSize: 10, color: C.text3, fontFamily: C.mono }}>Last run · 2026-03-30 05:01 UTC</p>
        </div>
      </header>

      {/* KPI Strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${C.border}` }}>
        {[
          { label: "Total students", value: "862,243", sub: "Grades 4 & 8 · 2022" },
          { label: "Public schools", value: "9,978",   sub: "California statewide" },
          { label: "dbt tests",      value: "10 / 10", sub: "All passing" },
          { label: "Open anomalies", value: "0",       sub: "Current run" },
        ].map((k, i) => (
          <div key={i} style={{ padding: "22px 28px", borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.text3, fontFamily: C.mono }}>{k.label}</p>
            <p style={{ margin: "0 0 3px", fontSize: 24, fontWeight: 400, color: C.text, letterSpacing: "-0.02em" }}>{k.value}</p>
            <p style={{ margin: 0, fontSize: 11, color: C.text3, fontStyle: "italic" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Split view */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", minHeight: "calc(100vh - 200px)" }}>

        {/* LEFT — data panels */}
        <div style={{ borderRight: `1px solid ${C.border}` }}>
          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 40px" }}>
            {[
              { id: "enrollment", label: "Enrollment" },
              { id: "assessment", label: "Assessment trends" },
              { id: "anomaly",    label: "Anomaly log" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "16px 0", marginRight: 32,
                fontSize: 12, fontFamily: C.mono, letterSpacing: "0.06em",
                color: tab === t.id ? C.text : C.text2,
                borderBottom: tab === t.id ? `1px solid ${C.amber}` : "1px solid transparent",
                transition: "color 0.15s",
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{ padding: "32px 40px" }}>

            {/* ENROLLMENT */}
            {tab === "enrollment" && (
              <div>
                <p style={{ margin: "0 0 24px", fontSize: 13, color: C.text2, fontStyle: "italic", maxWidth: 480 }}>
                  California public school enrollment for grades 4 and 8, academic year 2022.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
                  {enrollmentData.map((d, i) => (
                    <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "22px 24px", background: C.surface }}>
                      <p style={{ margin: "0 0 16px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.text3, fontFamily: C.mono }}>{d.grade}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                        {[
                          { label: "Students",     value: fmt(d.enrollment) },
                          { label: "Schools",      value: fmt(d.schools) },
                          { label: "Avg / school", value: d.avg },
                        ].map((m, j) => (
                          <div key={j}>
                            <p style={{ margin: "0 0 3px", fontSize: 10, color: C.text3, fontFamily: C.mono }}>{m.label}</p>
                            <p style={{ margin: 0, fontSize: 18, color: C.text, fontWeight: 400 }}>{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.text3, fontFamily: C.mono }}>Total enrollment by grade</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={enrollmentData} barSize={52}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border2} vertical={false} />
                    <XAxis dataKey="grade" tick={{ fill: C.text2, fontSize: 11, fontFamily: C.mono }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.text2, fontSize: 10, fontFamily: C.mono }} axisLine={false} tickLine={false} tickFormatter={v => (v / 1000).toFixed(0) + "k"} />
                    <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.mono, fontSize: 11 }} labelStyle={{ color: C.amber }} formatter={v => [fmt(v), "Students"]} />
                    <Bar dataKey="enrollment" radius={[3, 3, 0, 0]}>
                      <Cell fill={C.amber} />
                      <Cell fill={C.blue} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ASSESSMENT */}
            {tab === "assessment" && (
              <div>
                <p style={{ margin: "0 0 24px", fontSize: 13, color: C.text2, fontStyle: "italic", maxWidth: 480 }}>
                  NAEP average scores before and after the pandemic. Grade 8 math declined the most (-5.80 pts). Reading at grade 8 was the most resilient (-0.04 pts).
                </p>
                <div style={{ marginBottom: 32 }}>
                  {assessmentData.map((d, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 70px 70px 80px", alignItems: "center", gap: 20, padding: "16px 0", borderBottom: `1px solid ${C.border2}` }}>
                      <p style={{ margin: 0, fontSize: 12, fontFamily: C.mono, color: C.text2 }}>{d.label}</p>
                      <div style={{ height: 5, background: C.border2, borderRadius: 3, position: "relative" }}>
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${((d.score2019 - 200) / 90) * 100}%`, background: C.blue, borderRadius: 3, opacity: 0.4 }} />
                        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${((d.score2022 - 200) / 90) * 100}%`, background: C.amber, borderRadius: 3, opacity: 0.8 }} />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: "0 0 2px", fontSize: 9, color: C.text3, fontFamily: C.mono }}>2019</p>
                        <p style={{ margin: 0, fontSize: 14, color: C.blue }}>{d.score2019}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: "0 0 2px", fontSize: 9, color: C.text3, fontFamily: C.mono }}>2022</p>
                        <p style={{ margin: 0, fontSize: 14, color: C.amber }}>{d.score2022}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: "0 0 2px", fontSize: 9, color: C.text3, fontFamily: C.mono }}>change</p>
                        <p style={{ margin: 0, fontSize: 14, color: d.change < -2 ? C.red : C.orange }}>{sign(d.change)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.text3, fontFamily: C.mono }}>Score comparison · 2019 vs 2022</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={assessmentData} barGap={4} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border2} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: C.text2, fontSize: 10, fontFamily: C.mono }} axisLine={false} tickLine={false} />
                    <YAxis domain={[200, 290]} tick={{ fill: C.text2, fontSize: 10, fontFamily: C.mono }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.mono, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: C.mono, color: C.text2 }} />
                    <Bar dataKey="score2019" name="2019" fill={C.blue} radius={[3, 3, 0, 0]} opacity={0.6} />
                    <Bar dataKey="score2022" name="2022" fill={C.amber} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ANOMALY */}
            {tab === "anomaly" && (
              <div>
                <p style={{ margin: "0 0 24px", fontSize: 13, color: C.text2, fontStyle: "italic", maxWidth: 480 }}>
                  Automated dbt test results from each pipeline run. Click a run to view details.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {anomalyLogs.map(log => (
                    <div key={log.id}>
                      <div onClick={() => setActiveLog(activeLog === log.id ? null : log.id)} style={{
                        display: "grid", gridTemplateColumns: "160px 110px 70px 70px 1fr",
                        alignItems: "center", gap: 20, padding: "16px 20px",
                        border: `1px solid ${activeLog === log.id ? C.border : C.border2}`,
                        borderRadius: activeLog === log.id ? "8px 8px 0 0" : 8,
                        background: activeLog === log.id ? C.surface : "transparent",
                        cursor: "pointer", transition: "background 0.15s",
                      }}>
                        <p style={{ margin: 0, fontSize: 11, fontFamily: C.mono, color: C.text2 }}>{log.run}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: log.status === "healthy" ? C.green : C.red }} />
                          <span style={{ fontSize: 11, fontFamily: C.mono, color: log.status === "healthy" ? C.green : C.red }}>{log.status}</span>
                        </div>
                        <div>
                          <p style={{ margin: "0 0 2px", fontSize: 9, color: C.text3, fontFamily: C.mono }}>tests</p>
                          <p style={{ margin: 0, fontSize: 14, color: C.text }}>{log.tests}</p>
                        </div>
                        <div>
                          <p style={{ margin: "0 0 2px", fontSize: 9, color: C.text3, fontFamily: C.mono }}>failures</p>
                          <p style={{ margin: 0, fontSize: 14, color: log.failures > 0 ? C.red : C.green }}>{log.failures}</p>
                        </div>
                        <p style={{ margin: 0, fontSize: 10, color: C.text3, fontFamily: C.mono, textAlign: "right" }}>
                          {activeLog === log.id ? "▲" : "▼"}
                        </p>
                      </div>
                      {activeLog === log.id && (
                        <div style={{ border: `1px solid ${C.border2}`, borderTop: "none", borderRadius: "0 0 8px 8px", background: C.surface2, padding: "16px 20px" }}>
                          {log.details.length === 0
                            ? <p style={{ margin: 0, fontSize: 12, color: C.green, fontFamily: C.mono, fontStyle: "italic" }}>✓ All {log.tests} tests passed.</p>
                            : log.details.map((d, i) => (
                              <div key={i} style={{ marginBottom: i < log.details.length - 1 ? 14 : 0 }}>
                                <p style={{ margin: "0 0 6px", fontSize: 11, fontFamily: C.mono, color: C.red }}>FAILURE {i + 1} · {d.test}</p>
                                <p style={{ margin: "0 0 4px", fontSize: 12, color: C.text2 }}><span style={{ fontSize: 9, color: C.text3, fontFamily: C.mono, textTransform: "uppercase" }}>Explanation · </span>{d.explanation}</p>
                                <p style={{ margin: 0, fontSize: 12, color: C.amber }}><span style={{ fontSize: 9, color: C.text3, fontFamily: C.mono, textTransform: "uppercase" }}>Fix · </span>{d.recommendation}</p>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — chat panel */}
        <div style={{ display: "flex", flexDirection: "column", background: C.surface }}>
          {/* Chat header */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
            <p style={{ margin: "0 0 4px", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.text3, fontFamily: C.mono }}>Ask the data</p>
            <p style={{ margin: 0, fontSize: 12, color: C.text2, fontStyle: "italic" }}>Powered by Claude</p>
          </div>

          {/* API key input */}
          {!keyEntered && (
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: C.text2, fontFamily: C.mono }}>Enter your Anthropic API key to start chatting:</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && apiKey.startsWith("sk-") && setKeyEntered(true)}
                  style={{
                    flex: 1, padding: "8px 12px", fontSize: 12, fontFamily: C.mono,
                    border: `1px solid ${C.border}`, borderRadius: 6,
                    background: C.surface, color: C.text, outline: "none",
                  }}
                />
                <button
                  onClick={() => apiKey.startsWith("sk-") && setKeyEntered(true)}
                  style={{
                    padding: "8px 14px", fontSize: 11, fontFamily: C.mono,
                    border: `1px solid ${C.border}`, borderRadius: 6,
                    background: C.text, color: C.surface, cursor: "pointer",
                  }}
                >Go</button>
              </div>
            </div>
          )}

          {/* Suggested questions */}
          {keyEntered && messages.length <= 1 && (
            <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border2}` }}>
              <p style={{ margin: "0 0 8px", fontSize: 10, color: C.text3, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: "0.1em" }}>Suggested</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SUGGESTED.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} style={{
                    textAlign: "left", background: C.surface2, border: `1px solid ${C.border2}`,
                    borderRadius: 6, padding: "8px 12px", fontSize: 12, color: C.text2,
                    cursor: "pointer", fontFamily: C.serif, transition: "background 0.1s",
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", padding: "10px 14px", borderRadius: 8, fontSize: 13, lineHeight: 1.6,
                  background: m.role === "user" ? C.text : C.surface2,
                  color: m.role === "user" ? C.surface : C.text,
                  border: m.role === "assistant" ? `1px solid ${C.border2}` : "none",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "10px 14px", borderRadius: 8, background: C.surface2, border: `1px solid ${C.border2}`, fontSize: 13, color: C.text3, fontStyle: "italic" }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder={keyEntered ? "Ask about the data..." : "Enter API key above first"}
                value={input}
                disabled={!keyEntered || loading}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                style={{
                  flex: 1, padding: "9px 12px", fontSize: 13,
                  border: `1px solid ${C.border}`, borderRadius: 6,
                  background: keyEntered ? C.surface : C.surface2,
                  color: C.text, outline: "none", fontFamily: C.serif,
                  opacity: keyEntered ? 1 : 0.6,
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!keyEntered || loading || !input.trim()}
                style={{
                  padding: "9px 16px", fontSize: 12, fontFamily: C.mono,
                  border: `1px solid ${C.border}`, borderRadius: 6,
                  background: keyEntered && input.trim() ? C.text : C.surface2,
                  color: keyEntered && input.trim() ? C.surface : C.text3,
                  cursor: keyEntered && input.trim() ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
              >Send</button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 10, fontFamily: C.mono, color: C.text3 }}>elt-pipeline-ai · Rebecca Raezada</p>
        <p style={{ margin: 0, fontSize: 10, fontFamily: C.mono, color: C.text3 }}>PostgreSQL · dbt 1.11 · Airflow 2.10 · Python 3.13</p>
      </footer>
    </div>
  );
}