/**
 * 曲帳 Cloud Functions
 *
 * - callAI: Gemini APIプロキシ（ユーザーにAPIキー不要）
 * - 使用量カウント + プラン制限チェック
 *
 * [ZooLab連携ポイント] 将来 API Gateway に統合可能
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// Gemini APIキーはFirebase環境変数で管理
// 設定: firebase functions:config:set gemini.key="AIzaSy..."
// または Secret Manager: firebase functions:secrets:set GEMINI_KEY

// 動的モデル選択の優先順位（gemini-2.0-flash無印は除外）
const MODEL_PRIORITY = ["gemini-2.5-flash", "gemini-2.0-flash-001", "gemini-flash-latest"];
let cachedModel: string | null = null;
let cachedModelTs = 0;
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000;

interface PlanLimits {
  proposals: number; // -1 = unlimited
  accompGen: number;
}

const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { proposals: 3, accompGen: 0 },
  standard: { proposals: 20, accompGen: 5 },
  premium: { proposals: -1, accompGen: -1 },
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * callAI — Gemini APIプロキシ
 * フロントから直接呼ばれる。認証必須。使用量カウント付き。
 */
export const callAI = functions.https.onCall(async (data, context) => {
  // 認証チェック
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "ログインが必要です");
  }
  const uid = context.auth.uid;

  const { systemText, messages, maxTokens = 800, feature = "proposals" } = data;

  if (!systemText || !messages || !Array.isArray(messages)) {
    throw new functions.https.HttpsError("invalid-argument", "systemTextとmessagesが必要です");
  }

  // プラン取得
  const userDoc = await db.doc(`users/${uid}`).get();
  const plan = (userDoc.data()?.plan as string) || "free";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  // 使用量チェック
  const usageRef = db.doc(`users/${uid}/usage/${todayKey()}`);
  const usageSnap = await usageRef.get();
  const currentCount = (usageSnap.data()?.[feature] as number) || 0;

  const limit = limits[feature as keyof PlanLimits];
  if (limit !== -1 && currentCount >= limit) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      `本日の${feature === "proposals" ? "AI提案" : "AI伴奏"}回数の上限に達しました。プランをアップグレードしてください。`
    );
  }

  // Gemini API呼び出し
  // APIキーの取得: 環境変数 > Secret Manager
  const apiKey = process.env.GEMINI_KEY || functions.config()?.gemini?.key;
  if (!apiKey) {
    throw new functions.https.HttpsError("internal", "Gemini APIキーが設定されていません");
  }

  // 動的モデル選択（キャッシュ24h）
  const model = await resolveModelServer(apiKey);
  const isThinking = model.includes("2.5");
  const genConfig: Record<string, unknown> = {
    maxOutputTokens: isThinking ? Math.max(maxTokens, 8192) : maxTokens,
  };
  if (isThinking) {
    genConfig.thinkingConfig = { thinkingBudget: 1024 };
  }

  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: genConfig,
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  let result = "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (d.error) {
      cachedModel = null; // キャッシュクリア
      throw new Error(d.error.message);
    }
    result = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new functions.https.HttpsError("internal", msg);
  }

  if (!result) {
    throw new functions.https.HttpsError("internal", "レスポンスが空です");
  }

  // 使用量インクリメント
  await usageRef.set(
    { [feature]: admin.firestore.FieldValue.increment(1) },
    { merge: true }
  );

  return { text: result };
});

/** 動的モデル選択 — ListModels + テスト呼び出し */
async function resolveModelServer(apiKey: string): Promise<string> {
  if (cachedModel && Date.now() - cachedModelTs < MODEL_CACHE_TTL) {
    return cachedModel;
  }

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const listRes = await fetch(listUrl);
  const listData = await listRes.json() as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const available = (listData.models || [])
    .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
    .map(m => m.name.replace("models/", ""));

  for (const candidate of MODEL_PRIORITY) {
    if (!available.includes(candidate)) continue;
    const isThinking = candidate.includes("2.5");
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`;
    const testBody = {
      contents: [{ role: "user", parts: [{ text: "test" }] }],
      generationConfig: {
        maxOutputTokens: isThinking ? 8192 : 1,
        ...(isThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      },
    };
    try {
      const testRes = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testBody),
      });
      const testData = await testRes.json() as { error?: unknown };
      if (!testData.error) {
        cachedModel = candidate;
        cachedModelTs = Date.now();
        return candidate;
      }
    } catch { /* next */ }
  }

  throw new functions.https.HttpsError("internal", "利用可能なGeminiモデルが見つかりません");
}
