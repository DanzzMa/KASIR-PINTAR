import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

let aiClient: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

export async function getAIInsights(transactions: Transaction[], totalProfit: number) {
  const ai = getAIClient();
  if (!ai) return "API Key Gemini belum dikonfigurasi. Masukkan GEMINI_API_KEY di Settings.";

  try {
    // Ringkas data untuk AI
    const summary = transactions.map(t => ({
      type: t.type,
      amount: t.amount,
      profit: t.profit || 0,
      customer: t.customerName
    })).slice(0, 20);

    const prompt = `
      Anda adalah asisten ahli bisnis untuk aplikasi "KASIR PINTAR".
      Ini adalah data transaksi terakhir: ${JSON.stringify(summary)}
      Total laba bersih saat ini: Rp ${totalProfit}

      Tugas: Berikan 2 kalimat saran bisnis yang singkat, padat, dan memotivasi untuk pemilik toko.
      Gunakan bahasa Indonesia yang santai tapi profesional.
      Fokus pada cara meningkatkan keuntungan atau efisiensi berdasarkan data tersebut.
      Jangan gunakan markdown berat, cukup teks polos atau bold pada kata kunci.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Gagal memproses saran bisnis.";
  } catch (error) {
    console.error("AI Insight Error:", error);
    return "Gagal memuat saran bisnis saat ini.";
  }
}
