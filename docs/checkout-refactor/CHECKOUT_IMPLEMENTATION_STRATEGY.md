# Implementation Strategy: Checkout Experience Refactor

## Summary

Transform Playlist Shopper from a **generic analysis tool** to a **checkout-focused music buying assistant**.

**Current State**: User analyzes playlist → sees mixed results → manually finds owned/missing tracks
**Target State**: User imports playlist → clear 3-tier categorization → focused buying journey

---

## Key Design Decisions

### 1. Information Architecture Shift

| Aspect | Current | Target |
|--------|---------|--------|
| **Primary focus** | All tracks mixed | Missing tracks (to buy) |
| **Visual hierarchy** | Equal weight | Missing > Owned > Unavailable |
| **Navigation** | Tabs (multiple playlists) | Stepper (Import → Match → Buy) |
| **Main CTA** | Search, Sort, CSV | Buy missing tracks |
| **Trust signal** | owned_reason hidden | owned_reason visible ("ISRC ✓", "Fuzzy ≈") |

### 2. Layout Changes

**Before:**
```
┌─ Tabs (Spotify | Apple | Owned)
├─ Info (Tracks: 50, Owned: 20, Unowned: 30)
├─ Search & Sort
├─ Table (all tracks mixed)
└─ Buttons (Share, Re-analyze, Export)
```

**After:**
```
┌─ Stepper (Import ━━ Match ━━ Buy)
├─ SummaryBar (Total | Owned | Missing | Unavailable + progress)
│
├─ Owned Section (collapsible, if count > 0)
│  └─ Table (owned tracks)
│
├─ Missing Section (PRIMARY, always visible)
│  ├─ [Buy missing tracks] ← PRIMARY CTA
│  ├─ Store tabs (All | Beatport | Bandcamp | iTunes)
│  └─ Table (missing tracks only)
│
├─ Unavailable Section (if count > 0)
│  └─ Table + search links
│
└─ Footer (Re-analyze, Share, Export, History)
```

### 3. Component Decomposition

**Current Monolith**: `app/page.tsx` (~1777 lines)

**Target Architecture**:
```
app/
├─ page.tsx (500 lines - layout + state management)
├─ components/
│  ├─ Stepper.tsx (60 lines - Import/Match/Buy nav)
│  ├─ SummaryBar.tsx (80 lines - counts + progress)
│  ├─ TrackSection.tsx (150 lines - reusable owned/missing/unavailable)
│  ├─ BuyMissingButton.tsx (40 lines - primary CTA)
│  └─ BuyModal.tsx (200 lines - store grouping modal)
└─ hooks/
   └─ useTrackFilters.ts (100 lines - owned/missing/unavailable logic)
```

---

## Workflow Transformation

### Current User Journey
```
1. Import playlist URL
   ↓
2. See all tracks in table
   ↓
3. Manually scan for "owned: false"
   ↓
4. Click store links for each missing track
   ↓
5. (Optional) Export CSV, Share
```

### Target User Journey
```
1. Import playlist URL
   ↓
2. See SummaryBar: "Missing: 25 / 50"
   ↓
3. Focus on Missing section (red highlight)
   ↓
4. Click [Buy missing tracks]
   ↓
5. Modal: Select store tab (Beatport) → [Open all] → new tabs
   ↓
6. (Optional) Share, Re-analyze with XML
```

---

## Data Transformation

### Current displayedTracks
```typescript
const displayedTracks = currentResult.tracks
  .filter(t => categoryFilter !== 'toBuy' || t.owned === false)
  .filter(t => search filter)
  .sort(sortKey);
// Result: Mixed owned/missing/unavailable
```

### Target Approach
```typescript
const ownedTracks = currentResult.tracks.filter(t => t.owned === true);
const missingTracks = currentResult.tracks.filter(t => t.owned === false);
const unavailableTracks = currentResult.tracks.filter(t => t.owned === null);

// Each passed to <TrackSection /> separately
```

### owned_reason Display
```typescript
// Backend sends: owned_reason: "isrc" | "exact" | "album" | "fuzzy" | null

// Frontend renders:
const reasonBadges = {
  'isrc': { icon: '✓', color: 'emerald', label: 'ISRC match' },
  'exact': { icon: '✓', color: 'emerald', label: 'Exact match' },
  'album': { icon: '≈', color: 'amber', label: 'Album match' },
  'fuzzy': { icon: '≈', color: 'amber', label: 'Fuzzy match' },
};

// Display in table as badge in Owned section
```

---

## Implementation Phases

### Phase A: Component Creation (Day 1-2)
- `Stepper.tsx` - Step indicator with completion states
- `SummaryBar.tsx` - Count cards + progress bar
- `TrackSection.tsx` - Reusable section for owned/missing/unavailable
- `useTrackFilters.ts` - Hook to compute categorization

### Phase B: Layout Refactoring (Day 2-3)
- Remove tabs, search/sort (or move to footer)
- Reorganize result display:
  1. Stepper (sticky top)
  2. SummaryBar
  3. Owned section (collapsible)
  4. Missing section (highlighted)
  5. Unavailable section (collapsible)
  6. Footer (controls)

### Phase C: Primary CTA Implementation (Day 3-4)
- `BuyMissingButton.tsx` - Triggers modal/page
- `BuyModal.tsx` - Store-grouped interface
  - Tabs: All | Beatport | Bandcamp | iTunes
  - "Open all" button → new tabs for selected store
- Integrate with current track links

### Phase D: Mobile & Polish (Day 4-5)
- Stepper responsive (horizontal scroll)
- SummaryBar card layout
- TrackSection cards on mobile
- Sticky footer with primary CTA
- Share integration
- Testing

---

## State Management Strategy

### Current State (keep as-is)
```typescript
const [multiResults, setMultiResults] = useState<Array<[string, ResultState]>>([]);
const [activeTab, setActiveTab] = useState<string | null>(null);
const [currentResult, setCurrentResult] = useState<ResultState | null>(null);
```

### New State (add)
```typescript
const [currentStep, setCurrentStep] = useState<'import' | 'match' | 'buy'>('import');

// Logic flow:
// 1. Form shown → currentStep = 'import'
// 2. handleAnalyze() successful → currentStep = 'match', show results
// 3. [Buy missing tracks] click → currentStep = 'buy', show BuyModal
// 4. Modal close → stay on match (don't reset)
```

### Derived State (computed, no extra state)
```typescript
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

---

## Critical Migration Points

### 1. Tabs → Stepper
- **Current**: `multiResults` is array, each URL is a tab
- **New**: Still keep multiResults (for Share), but visual nav is Stepper
- **Decision**: Hide tabs in new layout, or move to History panel?
  - **Option A** (Recommended): Show tabs in collapsible "History" drawer (bottom)
  - **Option B**: Remove tab switching, keep only active result (simpler)

### 2. Search/Sort → Section-local or Delete
- **Current**: Global search bar filters all tracks
- **New**: Options:
  - **Delete** (simplify): If Missing has <50 tracks, human-readable
  - **Keep local**: Add search only in Missing section
  - **Decision**: Delete for MVP, add back in Phase 2 if needed

### 3. "Only unowned" checkbox → Always-on for Missing
- **Current**: Explicit checkbox → `onlyUnowned` state
- **New**: Missing section is inherently unowned, checkbox removed
- **Impact**: CSV export changes behavior (see Phase C)

### 4. Buylist Button Position
- **Current**: Rightmost column in table
- **New**: How does it move with 3-tier layout?
  - **Option**: Keep in each row's rightmost cell (Bought/Skip dropdown)
  - **Note**: Already implemented, no change needed

---

## Acceptance Criteria (Final Checklist)

### Stepper
- [ ] 3 steps visible: Import → Match → Buy
- [ ] Current step highlighted (color)
- [ ] Completed steps show checkmark
- [ ] Sticky at top (PC: fixed, Mobile: scrolls with page or sticky)

### SummaryBar
- [ ] 4 count cards: Total | Owned | Missing | Unavailable
- [ ] Progress bar: (Missing / Total) × 100%
- [ ] Visible in first viewport
- [ ] Numbers update when result changes

### 3-Tier Display
- [ ] Owned section: show only if count > 0
  - [ ] Table or card list
  - [ ] Each row shows owned_reason badge (✓ ISRC, ✓ Exact, ≈ Album, ≈ Fuzzy)
  - [ ] Collapsible (default: collapsed if mobile, expanded if PC)
- [ ] Missing section: always visible
  - [ ] Shows red/urgent styling
  - [ ] Displays all unowned tracks
  - [ ] Each track shows store links
- [ ] Unavailable section: show only if count > 0
  - [ ] Show tracks with owned === null
  - [ ] Include search links for fallback

### Primary CTA
- [ ] "Buy missing tracks" button in Missing section
- [ ] Click opens modal or navigates to /results/[id]/buy
- [ ] Modal shows store tabs: All | Beatport | Bandcamp | iTunes
- [ ] Each tab grouped by store
- [ ] "Open all in new tabs" button
- [ ] UI shows progress (e.g., "Beatport: 8 tracks")

### Mobile Optimization
- [ ] Stepper responsive (no overflow)
- [ ] SummaryBar cards stack on narrow screens
- [ ] TrackSection uses cards (not table)
- [ ] Primary CTA sticky at bottom
- [ ] "Continue on desktop" hint for large libraries

### Share & Export
- [ ] Share button works with new layout (Share snapshot unchanged)
- [ ] Export CSV exports correct subset (all? missing? selected?)
- [ ] Re-analyze with XML works (applies Rekordbox and re-filters)

### End-to-End Flow
- [ ] Import → Match: Results appear in 3-tier layout
- [ ] Import + XML → Match: Results show owned_reason badges
- [ ] Match → Buy: Click CTA → Modal appears
- [ ] Buy → Share: Share link works, shows same 3-tier layout
- [ ] Share URL → Restore: Shared result displays cleanly

---

## Risk Mitigation

### Risk 1: Losing "tabs" UX (multiple playlists)
**Mitigation**: Add History drawer/sidebar showing previous analyses
- Collapsible panel: "Recent analyses"
- Quick switch between playlists
- Clear history option

### Risk 2: Complexity of 3-tier filtering
**Mitigation**: `useTrackFilters.ts` hook centralizes logic
- Single source of truth for owned/missing/unavailable
- Testable in isolation
- Easy to debug

### Risk 3: Mobile UX regression
**Mitigation**: Early mobile testing
- Ensure cards render properly
- Test sticky footer on iOS
- Verify modal doesn't overflow

### Risk 4: Performance (many tracks)
**Mitigation**: Keep useMemo for filters
- Avoid re-filtering on every render
- Virtualize table if needed (react-window) in Phase 2

---

## Success Metrics

After refactor, measure:
1. **Clarity**: Users identify "what to buy" in <3 seconds
2. **Conversion**: Click-through on "Buy missing tracks" increases
3. **Engagement**: Share link clicks increase (cleaner result display)
4. **Code quality**: page.tsx drops from 1777 → ~500 lines
5. **Performance**: No regression in load/render time

---

## Next Steps

1. **Create** `Stepper.tsx`, `SummaryBar.tsx`, `TrackSection.tsx`
2. **Refactor** `page.tsx` layout to use new components
3. **Implement** primary CTA + BuyModal
4. **Test** on desktop + mobile
5. **Deploy** and monitor metrics

