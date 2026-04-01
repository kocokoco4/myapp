# 曲帳 — 仕様書

**バージョン**: v3.0
**最終更新**: 2026-04-01
**ステータス**: フェーズ3a完了 → 販売準備中

---

## 1. プロダクト概要

| 項目 | 内容 |
|---|---|
| 名称 | 曲帳（きょくちょう） |
| 種別 | SaaS型Webアプリ |
| ターゲット | 個人シンガーソングライター・作曲家 |
| 対応環境 | Chrome / Safari / Edge（PC・スマホ）|
| PWA | 対応（ホーム画面追加でネイティブアプリ風に動作） |
| URL | https://kyokucho-179fa.web.app |
| 所属ブランド | ZooLab（Zooタウンティア） |

---

## 2. 技術スタック

| 要素 | 実装 |
|---|---|
| フレームワーク | React 19 + TypeScript |
| ビルドツール | Vite 8 |
| スタイリング | Tailwind CSS 4 |
| AI | Gemini API（Cloud Functions経由） |
| 認証 | Firebase Auth（Google OAuth） |
| データベース | Firebase Firestore |
| ホスティング | Firebase Hosting |
| 決済 | Stripe Checkout（未開通・モック中） |
| 五線譜 | SVGパス直接描画（VexFlow不使用） |
| 音声 | Web Audio API（OscillatorNode） |
| ピッチ検出 | Web Audio API + Autocorrelation |
| MIDI | バイナリ直接組立（SMF Format 1） |
| アイコン | lucide-react |

---

## 3. ファイル構成

```
kyokucho/
├── index.html              # エントリーHTML（PWA設定含む）
├── firebase.json           # Firebase設定（Hosting + Functions + Firestore）
├── firestore.rules         # Firestoreセキュリティルール
├── firestore.indexes.json  # Firestoreインデックス
├── .firebaserc             # プロジェクトID (kyokucho-179fa)
├── .gitignore              # Git除外設定
├── package.json            # npm依存関係
├── vite.config.ts          # Vite設定
├── tsconfig.json           # TypeScript設定
├── CLAUDE.md               # Claude Code指示書
│
├── public/
│   ├── manifest.json       # PWAマニフェスト
│   ├── sw.js               # Service Worker
│   ├── icon-512.png        # アプリアイコン（1024x1024ソース）
│   ├── icon-192.png        # PWA用（192x192）
│   ├── apple-touch-icon.png # iOS用（180x180）
│   ├── favicon.ico         # ブラウザタブ用（32x32）
│   ├── terms.html          # 利用規約
│   ├── privacy.html        # プライバシーポリシー
│   └── legal.html          # 特定商取引法に基づく表記 ※要記入
│
├── src/
│   ├── main.tsx            # エントリーポイント
│   ├── App.tsx             # メインレイアウト + I18nProvider
│   ├── store.tsx           # 状態管理（Context API + Firestore同期）
│   ├── firebase.ts         # Firebase初期化（Auth, Firestore, Functions）
│   ├── types.ts            # 型定義
│   ├── constants.ts        # 定数（キー、コード、音価、拍子等）
│   ├── index.css           # Tailwind CSS + カスタムテーマ
│   ├── vite-env.d.ts       # Vite型宣言
│   │
│   ├── i18n/
│   │   ├── index.ts        # useI18n() フック + Context
│   │   ├── ja.json         # 日本語
│   │   ├── en.json         # 英語
│   │   ├── ko.json         # 韓国語
│   │   └── zh-TW.json      # 中文
│   │
│   ├── utils/
│   │   ├── audio.ts        # Web Audio API（コード・音符・セクション再生）
│   │   ├── staff.ts        # 五線譜SVGパス描画（全記号SVGパス化済み）
│   │   ├── gemini.ts       # Gemini API呼び出し（Cloud Functions優先 + ローカルフォールバック）
│   │   ├── midi.ts         # MIDI出力（SMF Format 1）
│   │   ├── musicxml.ts     # MusicXML出力
│   │   ├── moodTemplates.ts # 雰囲気ベース伴奏テンプレート
│   │   ├── pitchDetect.ts  # ピッチ検出（鼻歌入力基盤）
│   │   ├── plan.ts         # プラン管理・使用量カウント・Stripeモック
│   │   └── id.ts           # ID生成
│   │
│   └── components/
│       ├── Sidebar.tsx      # 曲一覧サイドバー
│       ├── TopBar.tsx       # タイトル・ステータス・お知らせ・更新・設定
│       ├── TabsBar.tsx      # タブバー（PC用）
│       ├── FAB.tsx          # フローティングアクションボタン（スマホ用）
│       ├── ComposeTab.tsx   # 制作タブ（歌詞+コード+メロディ統合）
│       ├── MoodGenerator.tsx # 雰囲気ベース伴奏生成UI
│       ├── ArrangeTab.tsx   # 伴奏・スコアタブ（AI伴奏+MIDI/MusicXML出力）
│       ├── AIChat.tsx       # AI相談チャット（作曲相談+使い方ガイド）
│       ├── PlanModal.tsx    # プラン選択モーダル
│       ├── LoginScreen.tsx  # ログイン画面
│       └── SettingsModal.tsx # 設定モーダル
│
├── functions/               # Cloud Functions
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts        # callAI（Geminiプロキシ + 使用量カウント + プラン制限）
│
├── docs/
│   ├── specification.md    # 本ファイル（仕様書）
│   └── requirements.md     # 要件定義書
│
└── [レガシーファイル]
    ├── songbook_v5.html    # 旧アプリ（参照用・本番未使用）
    └── migrate.html        # データ移行ツール（参照用・本番未使用）
```

---

## 4. 機能一覧

### 4.1 曲管理
- 曲の作成・削除（確認ダイアログ付き）
- タイトル・ステータス（アイデア/作詞中/作曲中/録音中/完成）
- KEY・BPM・拍子（4/4, 3/4, 5/4, 6/8等 + カスタム入力）
- 複数曲管理（サイドバー一覧）

### 4.2 歌詞
- セクション別歌詞入力（イントロ/Aメロ/Bメロ/サビ/アウトロ等）
- 歌詞メモ・フリーメモ
- 歌詞×メロディ連携（シラブル自動割当）

### 4.3 コード進行
- セクション別コード入力
- コードピッカー（画面中央モーダル）
- 1小節内に複数コード（自由分割、最大8分割）
- クイック進行ボタン（王道/小室/カノン等）
- コードタップ再生

### 4.4 メロディ入力
- ボタンモード / 鍵盤モード（切替可能）
- 鍵盤UIにスケール音ハイライト
- 音価: 全音符/2分/4分/8分/16分/3連4分/3連8分
- 休符入力
- 三連符ブラケット表示（五線譜上）
- 臨時記号（#/b）対応

### 4.5 五線譜表示
- SVGパス直接描画（フォント依存ゼロ）
- ト音記号・ヘ音記号・拍子記号をSVGパスで描画
- 動的SVG高さ（音域に応じて自動拡張）
- 加線対応（オクターブ3等の低音域）
- 連桁（ビーミング）
- シラブル表示（五線譜下）

### 4.6 再生
- セクション再生（メロディ+コード同時再生）
- 通し再生（全セクション連結）
- BPM連動
- 拍子連動
- 再生中ハイライト（音符バッジ点灯）
- 1小節内複数コード対応（均等分割再生）

### 4.7 雰囲気ベース伴奏生成
- 4カテゴリ選択（感情/景色/テンション/関係性）
- 数式UI演出（○ × ○ × ○ × ○ = ?）
- テンプレートからBPM・KEY・コード進行を自動生成
- 選択結果をそのまま曲タイトルに反映

### 4.8 AI伴奏生成
- 楽器選択（ピアノ/ベース/ギター/ドラム）
- Gemini APIでコード進行に基づく伴奏JSON生成
- 大譜表表示（ピアノ）、単一譜表（ベース/ギター）、ドラム譜

### 4.9 出力
- MusicXML出力（LogicPro連携）
- MIDI出力（GarageBand連携、SMF Format 1）

### 4.10 AI相談
- 作曲相談モード（コード提案/アレンジ助言/歌詞相談）
- 使い方ガイドモード（FAQ/操作説明）
- サジェスションボタン（モード連動）

### 4.11 お知らせ
- Firestoreのannouncementsコレクションから取得
- TopBarにベルアイコン（未読バッジ付き）
- 最新5件表示

### 4.12 設定
- テーマ切替（ダーク/ライト）
- 言語切替（日本語/English/한국어/中文）
- プラン管理（無料/スタンダード/プレミアム）
- 使用量表示
- バックアップ（JSON手動エクスポート）
- ログアウト
- 利用規約/プライバシー/特商法表記へのリンク
- 詳細設定（開発者向け: APIキー/データ引継ぎ → 販売時に非表示化）

### 4.13 PWA
- manifest.json（スタンドアロン、ポートレイト）
- Service Worker（Network First + オフラインキャッシュ）
- ホーム画面追加でネイティブアプリ風

---

## 5. プラン設計

| | 無料 (¥0) | スタンダード (¥500/月) | プレミアム (¥980/月) |
|---|---|---|---|
| 曲数 | 3曲まで | 無制限 | 無制限 |
| 雰囲気テンプレ伴奏 | 1日2回 | 無制限 | 無制限 |
| AI提案（チャット） | 1日3回 | 1日20回 | 無制限 |
| AI伴奏カスタマイズ | 不可 | 1日5回 | 無制限 |
| MIDI/MusicXML出力 | 不可 | 無制限 | 無制限 |
| カスタム拍子 | 不可 | 無制限 | 無制限 |
| 自動バックアップ | なし | なし | 週1回 |
| 優先サポート | なし | なし | あり |

---

## 6. データ設計（Firestore）

```
users/{uid}
  ├── plan: 'free' | 'standard' | 'premium'
  ├── curId: string (現在選択中の曲ID)
  ├── songs/{songId}     # 曲データ（サブコレクション）
  │   ├── id, title, status, key, tempo, timeSig
  │   ├── lyrics, memo
  │   ├── sections[]     # セクション配列
  │   │   ├── id, name, lyrics
  │   │   └── measures[] # 小節配列
  │   │       ├── id, chord
  │   │       └── melNotes[] # メロディ音符配列
  │   │           ├── pitch, duration, startBeat, syllable?
  │   ├── selInstrs[], accomp
  │   ├── createdAt, updatedAt
  └── usage/{date}       # 日別使用量
      ├── proposals: number
      └── accompGen: number

announcements/{id}       # お知らせ（管理者が投稿）
  ├── title, body, date
```

---

## 7. 外部サービス連携

| サービス | 用途 | 状態 |
|---|---|---|
| Firebase Auth | Google OAuth認証 | 稼働中 |
| Firebase Firestore | データ保存 | 稼働中 |
| Firebase Hosting | 静的ファイル配信 | 稼働中 |
| Firebase Cloud Functions | Geminiプロキシ + 使用量管理 | コード完成・デプロイ待ち |
| Gemini API | AI機能（伴奏生成/チャット） | 稼働中（ローカルキー） |
| Stripe | サブスク決済 | モック中（未開通） |

---

## 8. 多言語対応（i18n）

| 言語 | コード | フォント | 状態 |
|---|---|---|---|
| 日本語 | ja | Noto Sans JP | 完了（デフォルト） |
| 英語 | en | Inter / Space Mono | JSON完了・テキスト適用段階的 |
| 韓国語 | ko | Noto Sans KR | JSON完了・テキスト適用段階的 |
| 中文 | zh-TW | Noto Sans TC | JSON完了・テキスト適用段階的 |

---

## 9. セキュリティ

- Firebase Auth必須（未ログインは利用不可）
- Firestoreルールでuidベースのアクセス制御
- APIキーはCloud Functions環境変数で管理（ユーザーに非公開）
- Stripe決済情報は当方で保持しない
- HTTPS強制（Firebase Hosting）

---

## 10. バックアップ・コード管理

| 項目 | 状態 |
|---|---|
| Gitリポジトリ | https://github.com/kocokoco4/myapp.git |
| ブランチ | main |
| 最終コミット | c1f538e（フェーズ2時点） |
| 未コミット | **フェーズ3の全作業がコミット待ち** |
| Firebase設定 | .firebasercでプロジェクトID管理 |
| 本番環境 | https://kyokucho-179fa.web.app |

**注意**: フェーズ3の大量の変更が未コミットです。至急コミット+pushが必要。

---

## 11. レガシーファイル

| ファイル | 説明 | 状態 |
|---|---|---|
| songbook_v5.html | 旧アプリ（HTML単体版） | 参照用・本番未使用 |
| migrate.html | データ移行ツール | 参照用・本番未使用 |

これらは削除しても問題ないが、参考資料として残置している。
