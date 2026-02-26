"use client";

import { useState } from "react";

export default function AIAssistant() {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  const askAI = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setReply("");
      } else {
        setReply(data.reply);
        setHistory([...history, { question: input, answer: data.reply }]);
        setInput("");
      }
    } catch (err) {
      setError("Failed to connect to AI service");
      setReply("");
    }

    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    askAI();
  };

  return (
    <div className="min-h-screen bg-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2 flex items-center gap-3">
            AI Auditor Assistant
          </h1>
          <p className="text-gray-700 text-lg">Ask security and audit questions, powered by Gemini AI</p>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-black">
          <form onSubmit={handleSubmit}>
            <label htmlFor="question" className="block text-sm font-semibold text-black mb-3">
              Your Question
            </label>
            <textarea
              id="question"
              rows={5}
              className="w-full px-4 py-3 border-2 border-black rounded-lg focus:ring-2 focus:ring-black focus:border-black resize-none transition"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., What are the risks of SQL injection? How do I implement 2FA?..."
            />
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex-1 bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span> Thinking...
                  </>
                ) : (
                  <>
                    Ask AI
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-white border-2 border-black rounded-lg p-4 mb-6 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-black">Error</p>
              <p className="text-gray-800 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* AI Response Card */}
        {reply && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-black">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-black">AI Response</h2>
            </div>
            <div className="bg-gray-100 border-l-4 border-black p-4 rounded text-black whitespace-pre-wrap leading-relaxed">
              {reply}
            </div>
          </div>
        )}

        {/* Conversation History */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-black">
            <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
              Conversation History
            </h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {history.map((item, idx) => (
                <div key={idx} className="border-b-2 border-gray-300 pb-4 last:border-b-0">
                  <p className="text-sm font-semibold text-black mb-2">
                    Q{idx + 1}: {item.question}
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}