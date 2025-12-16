# Refactor: "解析ツール" → "チェックアウト体験"

## 目的
現状の Playlist Shopper は **「解析はできる」** が、売りである **「解析 → 照合 → 購入」** が UI で最大化されていない。

**新しい主語**: Missing Tracks（買うべき曲）= 購入導線を固定し、解析は裏方に回す。

---

## UI 情報設計（決定事項）

### 1) Stepper（固定表示）
固定ナビゲーション：`Import → Match → Buy`

```
┌─────────────────────────────────────────────┐
│ Import ━━━ Match ━━━ Buy                    │
│  ✓       ✓       ◉                          │
└─────────────────────────────────────────────┘
```

- 各ステップの完了状態を視覚化
- 現在地を常に示す
- PC/モバイル両方で表示

### 2) 常時 SummaryBar
```
Total: 50  |  Owned: 20  |  Missing: 25  |  Unavailable: 5
█████████░░░░░░░░░ 50%
```

- 4つのカウント（数値）で即座に状況把握
- 進捗バー：`Missing / Total`
- 非常時ハイライト例：Missing > 0 で赤く、Click で Missing セクションへスクロール

### 3) 結果は 3分類で固定表示

```
┌─ Owned (you have)
│  ├─ Track 1 (ISRC matched)
│  ├─ Track 2 (Exact matched)
│  └─ Track 3 (Fuzzy matched)
│
├─ Missing (need to buy) ← **主役**
│  ├─ [Buy missing tracks] ← PRIMARY CTA
│  ├─ Track A (Beatport link)
│  ├─ Track B (Bandcamp link)
│  └─ Track C (iTunes link)
│
└─ Unavailable (can't match)
   ├─ Track X (Manual search links)
   └─ Track Y (Manual search links)
```

- **Owned**: 節約（買わなくていい証明）
- **Missing**: 購入対象（強調、リンク付）
- **Unavailable**: 手動対処（検索補助、フォールバック）

### 4) Missing が画面の中心
- Owned / Unavailable は畳める（expandable sections）or display:none if 0
- Missing セクションには **主 CTA** を配置：
  - `Buy missing tracks` ← 全Missing曲を購入先別にグループ化
- 各曲の購入リンク：Beatport/Bandcamp/iTunes を並列表示

### 5) 照合価値の可視化（信頼構築）
- Owned カウント → 「既に $n 曲持ってる」= 節約額を暗示
- owned_reason を表示：
  - 🟢 `ISRC match` = 確定
  - 🟢 `Exact match` = ほぼ確定
  - 🟡 `Album match` = 推定
  - 🟡 `Fuzzy match` = 参考値

---

## 実装フェーズ（優先順）

### Phase 0: コンポーネント化（準備）
- `Stepper.tsx` : `Import / Match / Buy` の状態管理
- `SummaryBar.tsx` : カウント + 進捗バー
- `TrackSection.tsx` : Owned / Missing / Unavailable セクション（再利用）
- `BuyModal.tsx` (optional) : 購入導線モーダル

### Phase 1: Page Layout 再構成（P0）
**ファイル**: `app/page.tsx`

現状の構造:
```
Import Form
├─ Playlist URLs textarea
├─ Rekordbox XML upload
├─ Checkbox "Only unowned"
└─ Button [Analyze]

Results
├─ Tabs (複数プレイリスト)
├─ Info & Controls (Info, Re-analyze, Share, Export)
├─ Search & Sort
└─ Table (全トラック混在)
```

新構造:
```
┌─ Stepper (Import / Match / Buy)
├─ SummaryBar (Total/Owned/Missing/Unavailable + Progress)
│
├─ Section: Owned
│  └─ Collapsible table (if count > 0)
│
├─ Section: Missing ← **主役**
│  ├─ Primary CTA: [Buy missing tracks]
│  ├─ Subtab: All | Beatport | Bandcamp | iTunes
│  └─ Table (Missing tracks only)
│
├─ Section: Unavailable (if count > 0)
│  ├─ Hint: "検索候補"
│  └─ Table + Manual search links
│
└─ Footer
   ├─ Re-analyze with XML
   ├─ Share
   ├─ Export CSV
   └─ History (Tabs removed → History sidebar or modal)
```

### Phase 2: Primary CTA - Buy Missing Tracks（P1）
**新規画面** or **モーダル**: `/results/[id]/buy` or modal in page

```
┌─ Tabs: [All] | [Beatport] | [Bandcamp] | [iTunes]
├─ Missing tracks grouped by selected store
├─ Checkbox: [Select all]
└─ Button: [Open all in new tabs]
```

### Phase 3: Mobile Optimization（P2）
- Stepper: 横スクロール対応
- SummaryBar: 1行 or 2行カード
- 各セクション: Card UI（表）
- Primary CTA: Sticky footer
- "Continue on desktop" hint: 大量の曲を買う場合

---

## Code Changes（詳細）

### 1. `app/page.tsx` - Layout 再構成

#### Remove:
- 複数タブの表示（Tabs コンポーネント）
- "Only unowned" チェックボックス（Missing section で暗黙的）
- 独立した Search/Sort controls（各セクション内に移動 or 削除）

#### Add:
- Stepper コンポーネント
- SummaryBar コンポーネント
- TrackSection コンポーネント × 3 (Owned / Missing / Unavailable)

#### Refactor displayedTracks:
```typescript
// 現状
const displayedTracks = useMemo(() => {
  // search + sort filter
  return filtered;
}, [currentResult, onlyUnowned, searchQuery, sortKey]);

// 新規
const ownedTracks = useMemo(() => {
  return currentResult?.tracks.filter(t => t.owned === true) ?? [];
}, [currentResult]);

const missingTracks = useMemo(() => {
  return currentResult?.tracks.filter(t => t.owned === false) ?? [];
}, [currentResult]);

const unavailableTracks = useMemo(() => {
  return currentResult?.tracks.filter(t => t.owned === null || t.owned === undefined) ?? [];
}, [currentResult]);
```

#### Layout JSX:
```tsx
return (
  <main className="min-h-screen bg-slate-950 text-slate-50">
    <Stepper currentStep={/* Import|Match|Buy */} />
    
    {multiResults.length > 0 && currentResult && (
      <>
        <SummaryBar 
          total={currentResult.total}
          owned={ownedTracks.length}
          missing={missingTracks.length}
          unavailable={unavailableTracks.length}
        />
        
        {ownedTracks.length > 0 && (
          <TrackSection 
            title="Owned" 
            count={ownedTracks.length}
            tracks={ownedTracks}
            collapsible={true}
          />
        )}
        
        <TrackSection 
          title="Missing" 
          count={missingTracks.length}
          tracks={missingTracks}
          primaryCTA={<BuyMissingButton />}
          highlight={true}
        />
        
        {unavailableTracks.length > 0 && (
          <TrackSection 
            title="Unavailable" 
            count={unavailableTracks.length}
            tracks={unavailableTracks}
          />
        )}
        
        <Footer
          onShare={handleShare}
          onReanalyze={handleReanalyze}
          onExportCSV={handleExportCSV}
        />
      </>
    )}
  </main>
);
```

### 2. 新規コンポーネント

#### `app/components/Stepper.tsx`
```typescript
interface StepperProps {
  steps: Array<{ id: 'import' | 'match' | 'buy'; label: string }>;
  currentStep: 'import' | 'match' | 'buy';
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="sticky top-0 bg-slate-950 border-b border-slate-800 px-4 py-4 z-40">
      <div className="flex items-center justify-center gap-4">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className={`flex flex-col items-center gap-2 ${
              currentStep === step.id ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === step.id ? 'bg-emerald-500' : 'bg-slate-700'
              }`}>
                {/* Checkmark for completed, number for pending */}
              </div>
              <span className="text-xs font-medium">{step.label}</span>
            </div>
            
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-2 ${
                currentStep === step.id ? 'bg-slate-600' : 'bg-emerald-500'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
```

#### `app/components/SummaryBar.tsx`
```typescript
interface SummaryBarProps {
  total: number;
  owned: number;
  missing: number;
  unavailable: number;
}

export function SummaryBar({ total, owned, missing, unavailable }: SummaryBarProps) {
  const progress = total > 0 ? (missing / total) * 100 : 0;
  
  return (
    <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-4 space-y-3">
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-100">{total}</div>
          <div className="text-xs text-slate-400">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-400">{owned}</div>
          <div className="text-xs text-slate-400">Owned</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-400">{missing}</div>
          <div className="text-xs text-slate-400">Missing</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-400">{unavailable}</div>
          <div className="text-xs text-slate-400">Unavailable</div>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">To Buy</span>
          <span className="text-slate-300 font-semibold">{missing} / {total}</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

#### `app/components/TrackSection.tsx`
```typescript
interface TrackSectionProps {
  title: string;
  count: number;
  tracks: PlaylistRow[];
  primaryCTA?: React.ReactNode;
  collapsible?: boolean;
  highlight?: boolean;
}

export function TrackSection({
  title,
  count,
  tracks,
  primaryCTA,
  collapsible = false,
  highlight = false,
}: TrackSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(!collapsible);
  
  return (
    <section className={`border-b border-slate-800 ${highlight ? 'bg-slate-900/50' : ''}`}>
      <div className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-900/30 ${
        collapsible ? '' : 'pointer-events-none'
      }`}
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold">
          {title} ({count})
        </h3>
        {collapsible && (
          <svg className={`w-5 h-5 transition ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )}
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {primaryCTA && (
            <div className="flex gap-2">
              {primaryCTA}
            </div>
          )}
          
          <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/70">
            <table className="w-full text-xs table-fixed">
              {/* Same as current table, but tracks filtered */}
            </table>
          </div>
          
          <div className="md:hidden space-y-2">
            {tracks.map(t => (
              <div key={t.index} className="rounded-lg bg-slate-900/50 border border-slate-800 p-3">
                {/* Card UI */}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

### 3. 論理的な変更（page.tsx）

#### `currentStep` の導入
```typescript
// State
const [currentStep, setCurrentStep] = useState<'import' | 'match' | 'buy'>('import');

// Logic in handleAnalyze
if (newResults.length > 0) {
  setCurrentStep('match'); // After successful analysis
  setMultiResults(newResults);
}

// Logic in BuyMissingButton onClick
setCurrentStep('buy');
```

#### `owned_reason` を表示
```typescript
function getOwnedStatusBadge(ownedReason?: string) {
  const badges: Record<string, { icon: string; color: string }> = {
    'isrc': { icon: '🟢', color: 'text-emerald-400' },
    'exact': { icon: '🟢', color: 'text-emerald-400' },
    'album': { icon: '🟡', color: 'text-amber-400' },
    'fuzzy': { icon: '🟡', color: 'text-amber-400' },
  };
  
  return badges[ownedReason || 'unknown'] || { icon: '⚪️', color: 'text-slate-400' };
}
```

---

## Acceptance Criteria（DoD）

- [ ] Stepper が常時表示（Import → Match → Buy）
- [ ] SummaryBar が常にファーストビュー内に見える
- [ ] 結果が **Owned / Missing / Unavailable** に完全分離
- [ ] Missing セクションが画面の中心（Owned より上）
- [ ] Primary CTA: "Buy missing tracks" が Missing セクションに配置
- [ ] 各 Missing 曲に購入リンク（Beatport/Bandcamp/iTunes）
- [ ] Share link が結果ページに統合
- [ ] モバイルでも結果閲覧・共有が快適
- [ ] End-to-end: Import → Match (with/without XML) → Share → Buy
- [ ] Owned セクションが折りたたみ可能

---

## ファイル構成（新規）

```
app/
├─ page.tsx (大幅リファクタ)
├─ components/
│  ├─ Stepper.tsx (新規)
│  ├─ SummaryBar.tsx (新規)
│  ├─ TrackSection.tsx (新規)
│  ├─ BuyMissingButton.tsx (新規)
│  └─ BuyModal.tsx (新規、オプション)
└─ results/
   └─ [id]/
      └─ buy/
         └─ page.tsx (新規、オプション - 購入画面)
```

---

## タイムライン

- **Day 1**: Stepper + SummaryBar 実装
- **Day 2**: TrackSection + Layout 再構成
- **Day 3**: Primary CTA + Mobile optimization
- **Day 4**: テスト + Share/CSV 統合
- **Day 5**: Phase 2 検討（Buy Modal詳細化）

---

## 注記

1. **Tabs は廃止**：複数プレイリスト管理は History sidebar or modal に移動
2. **Search/Sort**: 各セクション内で局所的に（or 削除して Missing セクションのみ）
3. **Buylist state**: そのまま継続（IndexedDB 保存は変わらず）
4. **Share**: 新しい 3分類 layout でも機能（Snapshot は変わらず）
5. **Mobile**: Stepper は horizontal scroll or collapsible

