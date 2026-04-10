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

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"];

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

  const body = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens: maxTokens },
  };

  let result = "";
  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.error && (d.error.code === 404 || d.error.message?.includes("not found"))) continue;
      if (d.error) throw new Error(d.error.message);
      result = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
      break;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("not found")) continue;
      throw new functions.https.HttpsError("internal", msg);
    }
  }

  if (!result) {
    throw new functions.https.HttpsError("internal", "利用可能なGeminiモデルが見つかりません");
  }

  // 使用量インクリメント
  await usageRef.set(
    { [feature]: admin.firestore.FieldValue.increment(1) },
    { merge: true }
  );

  return { text: result };
});
