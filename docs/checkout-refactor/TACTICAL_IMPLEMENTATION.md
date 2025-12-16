# Tactical Implementation Roadmap

## Day 1: Component Foundations + Stepper

### 1.1 Create `Stepper.tsx`
```bash
touch app/components/Stepper.tsx
```

**Requirements**:
- 3 steps: Import, Match, Buy
- Current step highlighted (emerald)
- Completed steps show ✓ icon
- Pending steps show number
- Sticky top with z-index
- Responsive (mobile: smaller icons, desktop: full labels)

**Sample JSX**:
```tsx
type Step = 'import' | 'match' | 'buy';
interface StepperProps {
  currentStep: Step;
}

export function Stepper({ currentStep }: StepperProps) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: 'import', label: 'Import' },
    { id: 'match', label: 'Match' },
    { id: 'buy', label: 'Buy' },
  ];
  
  const isComplete = (step: Step) => {
    const order = { import: 0, match: 1, buy: 2 };
    return order[step] < order[currentStep];
  };
  
  const isCurrent = (step: Step) => step === currentStep;
  
  return (
    <div className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  isComplete(step.id)
                    ? 'bg-emerald-500 text-white'
                    : isCurrent(step.id)
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {isComplete(step.id) ? '✓' : idx + 1}
                </div>
                <span className={`text-xs font-medium ${
                  isCurrent(step.id) ? 'text-emerald-400' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
              </div>
              
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-4 ${
                  isComplete(step.id) ? 'bg-emerald-500' : 'bg-slate-700'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 1.2 Create `SummaryBar.tsx`
```bash
touch app/components/SummaryBar.tsx
```

**Requirements**:
- 4 count cards: Total, Owned, Missing, Unavailable
- Progress bar showing (Missing / Total)
- Color coding: Total (white), Owned (emerald), Missing (red), Unavailable (slate)
- Responsive grid (1 row on desktop, 2 rows on mobile)

### 1.3 Update `page.tsx` - Integrate Stepper
- Import Stepper component
- Add `currentStep` state
- Render Stepper at top (before form)
- Logic: currentStep = 'import' initially, 'match' after handleAnalyze success

**Code sketch**:
```tsx
const [currentStep, setCurrentStep] = useState<'import' | 'match' | 'buy'>('import');

// In handleAnalyze success:
if (newResults.length > 0) {
  setMultiResults(newResults);
  setCurrentStep('match');
}

// In render:
return (
  <main className="min-h-screen bg-slate-950">
    <Stepper currentStep={currentStep} />
    {/* rest of page */}
  </main>
);
```

---

## Day 2: TrackSection Component + Layout Refactoring

### 2.1 Create `TrackSection.tsx`
```bash
touch app/components/TrackSection.tsx
```

**Requirements**:
- Props: title, count, tracks, primaryCTA (optional), collapsible (optional), highlight (optional)
- Show/hide toggle (if collapsible)
- Render table (desktop) or cards (mobile)
- Highlight styling (for Missing section)

**Key insight**: This component is reused 3x:
1. `<TrackSection title="Owned" tracks={ownedTracks} collapsible={true} />`
2. `<TrackSection title="Missing" tracks={missingTracks} primaryCTA={...} highlight={true} />`
3. `<TrackSection title="Unavailable" tracks={unavailableTracks} />`

### 2.2 Create `useTrackFilters.ts` hook
```bash
touch app/hooks/useTrackFilters.ts
```

**Purpose**: Centralize the 3-tier categorization logic

```typescript
export function useTrackFilters(currentResult: ResultState | null) {
  const ownedTracks = useMemo(() => {
    return currentResult?.tracks.filter(t => t.owned === true) ?? [];
  }, [currentResult]);
  
  const missingTracks = useMemo(() => {
    return currentResult?.tracks.filter(t => t.owned === false) ?? [];
  }, [currentResult]);
  
  const unavailableTracks = useMemo(() => {
    return currentResult?.tracks.filter(t => t.owned === null || t.owned === undefined) ?? [];
  }, [currentResult]);
  
  return { ownedTracks, missingTracks, unavailableTracks };
}
```

### 2.3 Refactor `page.tsx` - Remove tabs, reorganize layout
**Changes**:
- Remove `activeTab` state (or keep for internal management)
- Hide tab switching UI
- Remove "Only unowned" checkbox (now implicit)
- Remove global search/sort (or keep minimal)
- Use `useTrackFilters` to compute categorized tracks
- Reorganize JSX:
  1. Stepper
  2. (Form, only if no results)
  3. SummaryBar
  4. Owned TrackSection (collapsible)
  5. Missing TrackSection (highlighted, with primary CTA)
  6. Unavailable TrackSection (if count > 0)

---

## Day 3: Primary CTA + Buy Modal

### 3.1 Create `BuyMissingButton.tsx`
```bash
touch app/components/BuyMissingButton.tsx
```

**Simple button**:
```tsx
interface BuyMissingButtonProps {
  count: number;
  onClick: () => void;
}

export function BuyMissingButton({ count, onClick }: BuyMissingButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
    >
      Buy {count} Missing Tracks
    </button>
  );
}
```

### 3.2 Create `BuyModal.tsx`
```bash
touch app/components/BuyModal.tsx
```

**Requirements**:
- Modal overlay (dark background, centered)
- Store tabs: All | Beatport | Bandcamp | iTunes
- Each tab shows filtered missing tracks
- "Open all in new tabs" button
- "Close" button

**Store grouping logic**:
```typescript
const beatportTracks = missingTracks.filter(t => t.stores.beatport);
const bandcampTracks = missingTracks.filter(t => t.stores.bandcamp);
const itunesTracks = missingTracks.filter(t => t.stores.itunes);
```

**"Open all" handler**:
```typescript
const handleOpenAll = (storeName: 'beatport' | 'bandcamp' | 'itunes') => {
  const tracks = (
    storeName === 'beatport' ? beatportTracks :
    storeName === 'bandcamp' ? bandcampTracks :
    itunesTracks
  );
  
  tracks.forEach(t => {
    const url = t.stores[storeName];
    if (url) window.open(url, '_blank');
  });
};
```

### 3.3 Integrate into `page.tsx`
- Add `showBuyModal` state
- Pass to `BuyMissingButton`: `onClick={() => setShowBuyModal(true)}`
- Render `<BuyModal />` conditionally
- On modal close: set `currentStep` to 'buy' (or keep at 'match')

---

## Day 4: Mobile Optimization + Polish

### 4.1 TrackSection Mobile Cards
**Goal**: Cards instead of table on `md:` (768px) breakpoint

```tsx
{/* Desktop table */}
<div className="hidden md:block">
  <table>{/* ... */}</table>
</div>

{/* Mobile cards */}
<div className="md:hidden space-y-2">
  {tracks.map(t => (
    <div className="rounded-lg bg-slate-900/50 border border-slate-800 p-3">
      {/* Card content */}
    </div>
  ))}
</div>
```

### 4.2 Stepper Responsive
- Desktop: Full labels, large circles
- Mobile: Icons only, smaller circles, or collapsible?

### 4.3 SummaryBar Responsive
- Desktop: 4 columns
- Mobile: 2 rows × 2 columns (or stacked if very narrow)

### 4.4 Sticky Footer (Mobile)
- "Buy missing tracks" button sticky at bottom
- Accessible even when scrolled down

```tsx
<div className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 p-4 md:hidden">
  <BuyMissingButton count={missingTracks.length} onClick={...} />
</div>
```

### 4.5 Share Integration
- Move Share button to footer (or top of results section)
- Ensure snapshot works with 3-tier display (should be unchanged)
- Test Share link restoration

---

## Day 5: Testing + Fixes

### 5.1 Checklist
- [ ] Import form works
- [ ] Analyze button triggers Match step
- [ ] Results show in 3-tier layout (owned/missing/unavailable separated)
- [ ] Owned section collapsible
- [ ] Missing section highlighted
- [ ] SummaryBar counts correct
- [ ] owned_reason badges visible (ISRC ✓, Exact ✓, Album ≈, Fuzzy ≈)
- [ ] Primary CTA visible and clickable
- [ ] Buy modal shows store tabs
- [ ] Store links work (click → new tab)
- [ ] Share button works (link generated, copied)
- [ ] Re-analyze XML works (with new layout)
- [ ] Export CSV works
- [ ] Buylist state (Bought/Skip) still works
- [ ] Mobile responsive (cards, sticky footer, no overflow)
- [ ] No console errors

### 5.2 Performance
- Check lighthouse (should be ~90+ for performance)
- Verify no unnecessary re-renders (Profiler)

### 5.3 Fixes
- Fix any CSS alignment issues
- Adjust spacing/padding
- Fix mobile breakpoints

---

## Key Code Patterns

### Filter Function
```typescript
// Do NOT use loops; prefer filter + map
const ownedTracks = currentResult.tracks.filter(t => t.owned === true);
```

### Owned Reason Display
```typescript
function getOwnedStatusBadge(ownedReason?: string) {
  const badges: Record<string, { icon: string; label: string; color: string }> = {
    'isrc': { icon: '✓', label: 'ISRC', color: 'emerald' },
    'exact': { icon: '✓', label: 'Exact', color: 'emerald' },
    'album': { icon: '≈', label: 'Album', color: 'amber' },
    'fuzzy': { icon: '≈', label: 'Fuzzy', color: 'amber' },
  };
  
  const badge = badges[ownedReason || 'unknown'];
  return badge || { icon: '⚪️', label: 'Unknown', color: 'slate' };
}

// In table cell:
<span className={`text-${badge.color}-400`}>{badge.icon} {badge.label}</span>
```

### Responsive Rendering
```typescript
{/* Desktop */}
<div className="hidden md:block">
  {/* Table */}
</div>

{/* Mobile */}
<div className="md:hidden">
  {/* Cards */}
</div>
```

### Modal Pattern
```typescript
{showBuyModal && (
  <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div className="bg-slate-900 rounded-xl border border-slate-800 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
      {/* Modal content */}
      <button onClick={() => setShowBuyModal(false)} className="...">
        Close
      </button>
    </div>
  </div>
)}
```

---

## Git Commit Strategy

Each day should have 1-2 commits:

1. **Day 1**: `feat: Add Stepper and SummaryBar components`
2. **Day 2**: `refactor: TrackSection + 3-tier layout reorganization`
3. **Day 3**: `feat: Add Buy Missing Tracks modal`
4. **Day 4**: `refactor: Mobile optimization + responsive design`
5. **Day 5**: `test: End-to-end validation + bug fixes`

---

## Fallback Plan (If Stuck)

If component integration becomes complex:
1. Keep `page.tsx` as-is initially
2. Create components in isolation (`Stepper.tsx` in `/app/components-draft/`)
3. Test components independently
4. Gradually integrate one component at a time

---

## Success Indicators

- [ ] **Clarity**: Can a new user identify "what to buy" in <3 seconds?
- [ ] **Code**: page.tsx reduced from 1777 → ~600 lines
- [ ] **Performance**: No regressions in Lighthouse
- [ ] **Mobile**: No horizontal scrolling, sticky CTA visible
- [ ] **Share**: Link restoration works with new layout
- [ ] **Tests**: All acceptance criteria pass

