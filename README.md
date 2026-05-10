# XNH_WEBAPP_SVG-Conv
https://xenoah.github.io/XNH_WEBAPP_SVG-Conv/

ブラウザだけで完結する画像 → SVG コンバーター。
画像はネットワークに送信せず、すべてあなたのブラウザの中で処理されます。

> ラスター画像（PNG / JPEG / WebP / BMP / GIF / AVIF）をドロップして、
> モノクロ・線画・カラーのいずれかでベクター化します。
> ビルドツールもサーバー側処理も使っていません。

---

## このリポジトリの魅力

- **完全ローカル処理**
  画像は `<canvas>` と `Web Worker` で処理され、外部に一切送信されません。
  オフラインの PWA として動かせるので、機密ロゴや社内データの SVG 化にも安心です。

- **ビルドステップなし**
  `index.html` と ES Modules だけで動く、いわゆる "no-build" 構成です。
  クローンしたディレクトリを静的サーバーに置くだけで起動します。
  `node_modules` も `vite` も必要ありません。

- **依存ゼロのトレースエンジン**
  Potrace や ImageTracer の WASM/JS 移植を vendor として同梱せず、
  境界エッジ抽出 → Douglas-Peucker → Catmull-Rom 風ベジェ平滑化を
  `js/engine/` 配下に自前実装しています。読む / 改造する / 学ぶことが容易です。

- **左右分割ライブプレビュー**
  原画とトレース結果を並べて表示し、Before/After スライダで重ね比較もできます。
  ズーム・パン・フィットはマウス / トラックパッド / タッチ / キー（`+ / - / 0`）すべて対応。

- **i18n / ダークモード / モバイル UI まで**
  日本語・英語の辞書同梱、`prefers-color-scheme` 連動のダークモード、
  狭画面では上下分割に自動切替。Service Worker で将来的にオフライン動作も可能です。

---

## クイックスタート

ビルド不要。任意の静的サーバーから配信するだけです。

```sh
git clone https://github.com/Xenoah/XNH_WEBAPP_SVG-Conv.git
cd XNH_WEBAPP_SVG-Conv

# 例: Python 同梱の簡易サーバー
python -m http.server 5173
# → http://localhost:5173/ をブラウザで開く
```

> **注意**: Service Worker は `https://` または `http://localhost` でなければ動きません。
> `file://` 直開きでは PWA 機能が無効になるので、必ずローカル HTTP サーバー越しに開いてください。

---

## 使い方

1. **画像を投入する**
   - ドラッグ＆ドロップ
   - 「画像を開く」ボタン
   - `Ctrl+V` でクリップボードから貼付

2. **モードを選ぶ**
   - `outline` … アウトライン抽出（黒の塗り）
   - `silhouette` … 影絵
   - `binary` … モノクロ 2 値
   - `edges` … 線画（Sobel）
   - `color` … カラー減色トレース
   - `centerline` … センターライン（暫定）

3. **パラメータを調整**
   - **前処理**: 明るさ / コントラスト / ガンマ / ぼかし / 2 値化しきい値（手動 or 大津法）
   - **トレース**: パス単純化 / スムージング / スペックル除去 / 減色数 / 線幅
   - **プリセット**: Logo / Sketch / Photo / Icon / Manga
   - 変更はリアルタイムでプレビューに反映されます。

4. **変換 → 保存**
   - 「変換」ボタン（または `Ctrl+Enter`）でトレース実行
   - 「SVG」/「SVGZ」ボタンでダウンロード（SVGZ は `CompressionStream` で gzip 圧縮）
   - 「コピー」で SVG コードをクリップボードへ
   - 結果ファイルサイズとノード数はヘッダ右側に表示されます。

5. **比較する**
   - SVG プレビュー側の `⇄` ボタンで Before/After スライダ比較が開きます。
   - スライダはドラッグ、または矢印キーで動かせます。

---

## キーボードショートカット

| キー | 動作 |
| --- | --- |
| `Ctrl + Enter` | 変換実行 |
| `Ctrl + S` | SVG ダウンロード |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo（モード・前処理・トレースパラメータ） |
| `Ctrl + V` | クリップボードから画像を貼付 |
| `+` / `-` / `0` | ズームイン / アウト / フィット（プレビュー） |
| プレビューをダブルクリック | フィット |
| 分割バーをダブルクリック | 左右 50:50 にリセット |

ヘッダーの `?` ボタンでヘルプダイアログも開けます。

---

## 技術スタック

| 領域 | 採用技術 |
| --- | --- |
| 言語 | HTML5 / CSS3 / JavaScript（ES2022 + ES Modules） |
| ビルド | **なし**（ブラウザがネイティブで読み込む） |
| 画像処理 | `Canvas2D` / `OffscreenCanvas`（前処理は自前実装） |
| トレース | 自前のラスター→ベクター変換（境界エッジ抽出 + Douglas-Peucker + Catmull-Rom 風ベジェ） |
| エッジ検出 | Sobel フィルタ |
| 減色 | Median Cut |
| SVG 最適化 | 小数点丸め・空白圧縮・コマンド前空白除去（自前ミニマル実装） |
| 圧縮 | `CompressionStream`（gzip → SVGZ） |
| PWA | Service Worker（手書き）+ Web App Manifest |
| 状態管理 | `EventTarget` ベースの軽量ストア（永続化＋Undo/Redo 内蔵） |
| 並列処理 | Web Worker（`type: 'module'`、Transferable で zero-copy） |
| i18n | JSON 辞書 + ロケール切替 |
| 開発サーバー | `python -m http.server` または任意の静的サーバー |

---

## プロジェクト構成

```
/
├─ index.html                 # エントリ
├─ manifest.webmanifest       # PWA マニフェスト
├─ sw.js                      # Service Worker
├─ assets/                    # アイコン・ファビコン
├─ styles/
│  ├─ base.css                # リセット・カラートークン・ダークモード
│  ├─ layout.css              # 三段レイアウト・分割プレビュー
│  └─ components.css          # 各 UI 部品
├─ js/
│  ├─ main.js                 # 起動・配線・Worker メッセージング
│  ├─ store.js                # 状態管理（EventTarget + Undo/Redo）
│  ├─ ui/
│  │  ├─ dropZone.js
│  │  ├─ preview.js           # 左右分割プレビュー + Before/After
│  │  ├─ viewport.js          # ズーム・パン
│  │  ├─ splitter.js          # 分割サイズ調整
│  │  ├─ controls.js          # スライダ・モード・プリセット・パレット
│  │  └─ toolbar.js
│  ├─ engine/                 # 純粋ロジック（Worker からも呼べる）
│  │  ├─ preprocess.js        # 明るさ/コントラスト/ガンマ/ぼかし/大津法
│  │  ├─ tracer.js            # 境界エッジ抽出 + 単純化 + 平滑化
│  │  ├─ edges.js             # Sobel
│  │  ├─ quantize.js          # Median Cut
│  │  ├─ trace.js             # モード別ディスパッチ
│  │  └─ optimizeSvg.js       # 最適化 / コピー / SVGZ
│  ├─ workers/
│  │  └─ trace.worker.js
│  └─ i18n/
│     ├─ index.js
│     ├─ ja.json
│     └─ en.json
└─ CLAUDE.md                  # 設計方針と進捗（フェーズ別）
```

---

## ブラウザ対応

- Chrome / Edge / Firefox / Safari 最新版での動作を想定しています。
- 必須 API: `OffscreenCanvas`, `CompressionStream`, `<dialog>`, ES Modules, Web Worker (module type)。
- `CompressionStream` 非対応のブラウザでは SVGZ ダウンロードが通常 SVG にフォールバックします。

---

## ロードマップ

`CLAUDE.md` にフェーズごとの進捗詳細があります。完了済み:

- Phase 1: 基盤セットアップ
- Phase 2: 画像入力・基本 UI（ズーム・パン・分割・Before/After）
- Phase 3: 前処理（明るさ/コントラスト/ガンマ/ぼかし/大津法）
- Phase 4: トレースエンジン（自前実装、Worker 化）
- Phase 5: パラメータ調整 UI とプリセット
- Phase 6: SVG 出力・最適化（コピー / SVGZ）

進行中・今後:

- Phase 7: バッチ処理 + ZIP 出力 / カラーパレット編集 / 背景除去 / センターライン抽出
- Phase 8: PWA オフライン動作の手動確認、その他細部の磨き込み

---

## ライセンス

このリポジトリのライセンスはまだ宣言されていません（プライベート利用前提）。
公開配布する場合は `LICENSE` ファイルを追加してください（MIT などが手堅いです）。

---

## 関連

- リポジトリ: [Xenoah/XNH_WEBAPP_SVG-Conv](https://github.com/Xenoah/XNH_WEBAPP_SVG-Conv)
- 設計メモ: [CLAUDE.md](./CLAUDE.md)
