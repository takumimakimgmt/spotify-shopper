# UI Reference: Visual Mockups

## Desktop Layout - Results View

```
┌──────────────────────────────────────────────────────────────────┐
│ Import ━━━ Match ━━━ Buy                    [sticky, z-40]      │
│  1    ━━  2(✓) ━━  3                                             │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Total: 50  │  Owned: 20  │  Missing: 25  │  Unavailable: 5      │
│ ████████████████░░░░░░░░░░░ 50% To Buy                          │
└──────────────────────────────────────────────────────────────────┘

┌─ Owned (20) ▼ [collapsible, default: collapsed on mobile]        │
│ ┌────┬──────────────────┬────────┬──────────┬───────┬────────┬──┐
│ │ #  │ Title            │ Artist │ Album    │ ISRC  │ Stores │ ▼│
│ ├────┼──────────────────┼────────┼──────────┼───────┼────────┼──┤
│ │1   │Song 1 ✓ (ISRC)   │Artist A│Album 1   │ABC123 │◉BP ◉BC │★ │
│ │2   │Song 2 ✓ (Exact)  │Artist B│Album 2   │DEF456 │◉BP     │★ │
│ │3   │Song 3 ≈ (Album)  │Artist C│Album 3   │GHI789 │    ◉IT │★ │
│ └────┴──────────────────┴────────┴──────────┴───────┴────────┴──┘
└──────────────────────────────────────────────────────────────────┘

┌─ Missing (25) — [highlight: bg-red-500/10, always expanded]     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [Buy 25 Missing Tracks]  [Re-analyze with XML]  [Export CSV]│ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌────┬──────────────────┬────────┬──────────┬───────┬────────┬──┐
│ │ #  │ Title            │ Artist │ Album    │ ISRC  │ Stores │▼ │
│ ├────┼──────────────────┼────────┼──────────┼───────┼────────┼──┤
│ │4   │Song 4 (unfuzzy)  │Artist D│Album 4   │       │[BP][BC]│★ │
│ │5   │Song 5 (unfuzzy)  │Artist E│Album 5   │       │[BP][IT]│★ │
│ │... │...               │...     │...       │...    │...     │..│
│ │28  │Song 28           │Artist X│Album 28  │       │[IT]    │★ │
│ └────┴──────────────────┴────────┴──────────┴───────┴────────┴──┘
│
│ Stores: [All] [Beatport: 15] [Bandcamp: 8] [iTunes: 12]
│ [Open all Beatport tracks] - Opens links in new tabs
└──────────────────────────────────────────────────────────────────┘

┌─ Unavailable (5) ▼ [collapsible, if count > 0]                 │
│ ┌────┬──────────────────┬────────┬──────────┬───────┬────────┬──┐
│ │ #  │ Title            │ Artist │ Album    │ ISRC  │ Search │▼ │
│ ├────┼──────────────────┼────────┼──────────┼───────┼────────┼──┤
│ │29  │Rare Track A      │Artist Y│Album 29  │       │[Spot..│★ │
│ │30  │Obscure Track B   │Artist Z│Album 30  │       │[YT]   │★ │
│ └────┴──────────────────┴────────┴──────────┴───────┴────────┴──┘
│ (Manual search links provided: Spotify, YouTube, Discogs, etc.)
└──────────────────────────────────────────────────────────────────┘

┌─ Footer Controls                                                 │
│ [Share Link] [Re-analyze with XML] [Export CSV] [History]       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Desktop Layout - Buy Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ Buy Missing Tracks                                          [✕]  │
├─────────────────────────────────────────────────────────────────┤
│ Filters: [All (25)] [Beatport (15)] [Bandcamp (8)] [iTunes (12)]│
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Track             Artist         Album                 [Link]│ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Song 4            Artist D       Album 4            [Beatport]│ │
│ │ Song 5            Artist E       Album 5            [Beatport]│ │
│ │ ...               ...            ...                [...]    │ │
│ │ (showing all 25 in current tab)                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [ Open All 15 in New Tabs ]  [ Close ]                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mobile Layout - Results View (iPhone SE, 375px)

```
┌────────────────────────────────────────────┐
│ 1 ━ 2(✓) ━ 3  [Stepper, smaller]         │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ Total        Owned                         │
│   50           20                          │
│                                            │
│ Missing    Unavailable                    │
│   25            5                          │
│ ████████░░░░ 50%                          │
└────────────────────────────────────────────┘

┌─ Owned (20) ▼                             │
│ [collapsed on mobile]                     │
└────────────────────────────────────────────┘

┌─ Missing (25) ▲ [always expanded]         │
│ ┌──────────────────────────────────────┐ │
│ │ [Buy 25 Missing]                     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Song 4                               │ │
│ │ Artist D / Album 4                   │ │
│ │ [Beatport] [Bandcamp] [iTunes]       │ │
│ │ ★ (Bought/Skip dropdown)             │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Song 5                               │ │
│ │ Artist E / Album 5                   │ │
│ │ [Beatport] [iTunes]                  │ │
│ │ ★ (Bought/Skip dropdown)             │ │
│ └──────────────────────────────────────┘ │
│ ... (more cards) ...                     │
└────────────────────────────────────────────┘

┌─ Unavailable (5) ▼                       │
│ [collapsed on mobile]                    │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ [Share] [Re-analyze] [Export]              │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ [Buy 25 Missing Tracks] [sticky footer]    │
└────────────────────────────────────────────┘
```

---

## Color & Styling Reference

### Status Colors
```
Owned (completed)       : emerald-500 (#10b981)
Missing (action needed) : red-500 (#ef4444)
Unavailable (fallback)  : slate-500 (#64748b)
Background              : slate-950 (#030712)
```

### Badge Styling

**Owned Reason Badges** (inline in table):
```
✓ ISRC     → text-emerald-500, inline
✓ Exact    → text-emerald-500, inline
≈ Album    → text-amber-400, inline
≈ Fuzzy    → text-amber-400, inline
```

**Example in table**:
```
│ Song 1 ✓(ISRC) │ Artist │ Album │
│ Song 2 ✓(Exact)│ ...    │ ...   │
│ Song 3 ≈(Fuzzy)│ ...    │ ...   │
```

### Button Styling

**Primary CTA** (Missing section):
```
Class: px-4 py-2.5 bg-red-600 hover:bg-red-700 
       text-white font-semibold rounded-lg transition
Text: "Buy {count} Missing Tracks"
```

**Secondary CTAs** (Share, Re-analyze, Export):
```
Class: px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600
       border border-slate-600 text-slate-200 text-xs
```

**Stepper Circle** (active):
```
Class: w-10 h-10 rounded-full flex items-center justify-center
       bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400
```

### Section Styling

**Missing Section** (highlighted):
```
Class: border-l-4 border-red-500 bg-red-500/5
```

**Owned Section** (collapsible):
```
Class: border-b border-slate-800 bg-slate-900/30
```

---

## Interaction Flows

### Import → Match Flow
```
User enters playlist URL + (optional) XML
         ↓
[Analyze] button
         ↓
Loading bar (0-100%)
         ↓
Stepper updates: 1 → 2(✓)
currentStep = 'match'
         ↓
Results appear:
- Stepper shows Match as current (2)
- SummaryBar shows totals
- 3 sections: Owned, Missing, Unavailable
```

### Match → Buy Flow
```
User clicks [Buy {N} Missing Tracks]
         ↓
BuyModal opens
         ↓
Stepper updates: 2 → 3(current)
currentStep = 'buy'
         ↓
User selects store tab (Beatport) or clicks links
         ↓
New tabs open for each track
         ↓
User closes modal
         ↓
Back to results (step still = 'buy')
```

### Share Flow
```
User clicks [Share]
         ↓
API POST /api/share with snapshot
         ↓
Share URL generated: /?share={id}
         ↓
URL copied to clipboard
         ↓
User shares link
         ↓
Recipient opens URL
         ↓
Page loads shared snapshot
         ↓
Results display in same 3-tier layout
```

---

## Responsive Breakpoints

| Breakpoint | Width  | Layout         | Stepper    | SummaryBar | Sections   |
|-----------|--------|----------------|-----------|-----------|-----------|
| Mobile    | <768px | Cards          | Icons only| 2×2 grid  | Collapsed |
| Tablet    | 768px+ | Table          | Full      | 1×4 grid  | Expanded  |
| Desktop   | 1024px+| Table (wide)   | Full      | 1×4 grid  | Expanded  |

**CSS Breakpoints**:
```
sm: 640px
md: 768px  ← Main desktop breakpoint
lg: 1024px
xl: 1280px
```

---

## Accessibility Notes

### Color Contrast
- Text on emerald-500: Use white or black (check contrast)
- Text on red-500: Use white or black (check contrast)
- All badges must meet WCAG AA (4.5:1 ratio for normal text)

### Keyboard Navigation
- Stepper: Not focusable (display only)
- Buttons: Tab-able, :focus-visible styles
- Modal: Trap focus inside modal, Escape to close

### Screen Readers
- Section headers: `<h2>` with count
- Badges: Use `aria-label` for owned_reason
- Modal: Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby="..."`

---

## Performance Targets

- FCP (First Contentful Paint): < 1.5s
- LCP (Largest Contentful Paint): < 2.5s
- CLS (Cumulative Layout Shift): < 0.1
- Lighthouse Performance: > 85

**Optimization**:
- useMemo for track filters (avoid re-filtering)
- Virtualize table if > 200 tracks (react-window)
- Lazy load modal content

