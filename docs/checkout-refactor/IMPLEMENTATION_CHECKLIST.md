# Quick Reference: Checkout Flow Refactor Checklist

## 📄 Planning Documents (Complete)

- [x] `REFACTOR_CHECKOUT_FLOW.md` - Full specification
- [x] `CHECKOUT_IMPLEMENTATION_STRATEGY.md` - Architecture + decisions
- [x] `TACTICAL_IMPLEMENTATION.md` - Day-by-day tasks
- [x] `UI_REFERENCE_MOCKUPS.md` - Visual mockups + interactions
- [x] `PLAN_SUMMARY.md` - Executive overview

**Location**: All in `/Users/takumimaki/dev/.github/`

---

## 🛠️ Implementation Checklist

### Day 1: Stepper + SummaryBar + Integration

- [ ] Create `app/components/Stepper.tsx`
  - [ ] 3 steps: Import, Match, Buy
  - [ ] Current step highlighting (emerald)
  - [ ] Completed steps show ✓
  - [ ] Sticky top with z-40
  - [ ] Responsive mobile

- [ ] Create `app/components/SummaryBar.tsx`
  - [ ] 4 count cards: Total, Owned, Missing, Unavailable
  - [ ] Progress bar (Missing / Total)
  - [ ] Color coding: white, emerald, red, slate
  - [ ] Responsive grid

- [ ] Integrate into `page.tsx`
  - [ ] Import Stepper, SummaryBar components
  - [ ] Add `currentStep` state ('import' | 'match' | 'buy')
  - [ ] Render Stepper at top
  - [ ] Render SummaryBar below form
  - [ ] Update currentStep on analyze success

- [ ] Test
  - [ ] Stepper renders correctly
  - [ ] SummaryBar counts match currentResult
  - [ ] No console errors

- [ ] Commit: `feat: Add Stepper and SummaryBar components`

---

### Day 2: TrackSection + Layout Refactoring

- [ ] Create `app/hooks/useTrackFilters.ts`
  - [ ] useMemo: ownedTracks (owned === true)
  - [ ] useMemo: missingTracks (owned === false)
  - [ ] useMemo: unavailableTracks (owned === null)

- [ ] Create `app/components/TrackSection.tsx`
  - [ ] Props: title, count, tracks, primaryCTA, collapsible, highlight
  - [ ] Collapsible header with toggle
  - [ ] Desktop: table with existing columns
  - [ ] Mobile: card list
  - [ ] Apply highlight styling to Missing section

- [ ] Refactor `page.tsx` layout
  - [ ] Remove tabs UI
  - [ ] Remove "Only unowned" checkbox
  - [ ] Use useTrackFilters for categorization
  - [ ] Render 3 TrackSections:
    - [ ] Owned (collapsible, if count > 0)
    - [ ] Missing (highlighted, always visible)
    - [ ] Unavailable (collapsible, if count > 0)
  - [ ] Keep table/card rendering logic

- [ ] Test
  - [ ] 3 sections render correctly
  - [ ] Filters compute correctly
  - [ ] Collapsible toggles work
  - [ ] Missing section highlighted (red)
  - [ ] Mobile cards render properly

- [ ] Commit: `refactor: Implement 3-tier track categorization with TrackSection`

---

### Day 3: Primary CTA + Buy Modal

- [ ] Create `app/components/BuyMissingButton.tsx`
  - [ ] Props: count, onClick
  - [ ] Text: "Buy {count} Missing Tracks"
  - [ ] Red styling (bg-red-600)

- [ ] Create `app/components/BuyModal.tsx`
  - [ ] Modal overlay (fixed, centered)
  - [ ] Store tabs: All | Beatport | Bandcamp | iTunes
  - [ ] Tab content: table with filtered missing tracks
  - [ ] "Open all in new tabs" button for each store
  - [ ] Close button (X and Cancel)
  - [ ] Track count per store in tab labels

- [ ] Integrate into `page.tsx`
  - [ ] Add `showBuyModal` state
  - [ ] Render BuyMissingButton in Missing section
  - [ ] Pass onClick to open modal
  - [ ] Render BuyModal conditionally
  - [ ] Update currentStep to 'buy' when modal opens
  - [ ] Handle store link opening (window.open)

- [ ] Test
  - [ ] Modal opens/closes
  - [ ] Store tabs filter correctly
  - [ ] "Open all" button opens links in new tabs
  - [ ] Track counts accurate
  - [ ] Keyboard escape closes modal

- [ ] Commit: `feat: Add Buy Missing Tracks modal with store tabs`

---

### Day 4: Mobile Optimization + Polish

- [ ] TrackSection mobile cards
  - [ ] Remove table, show cards on md: breakpoint
  - [ ] Card layout: title, artist, album, links, buylist button
  - [ ] Proper spacing and readability

- [ ] Responsive Stepper
  - [ ] Mobile: smaller circles, no labels (or icons)
  - [ ] Tablet+: full labels

- [ ] Responsive SummaryBar
  - [ ] Mobile: 2×2 grid of cards
  - [ ] Tablet+: 1×4 grid

- [ ] Sticky footer CTA (mobile)
  - [ ] "Buy missing tracks" button fixed at bottom
  - [ ] Visible when scrolled down

- [ ] Buy Modal responsive
  - [ ] Full-screen on mobile
  - [ ] Scrollable content
  - [ ] Buttons at bottom

- [ ] Share integration
  - [ ] Move Share button to footer or Missing section
  - [ ] Test Share URL restoration
  - [ ] Verify 3-tier display with shared result

- [ ] Polish
  - [ ] Adjust spacing/padding
  - [ ] Fix CSS alignment
  - [ ] Smooth transitions

- [ ] Test
  - [ ] Mobile (iPhone SE, 375px): no horizontal scroll
  - [ ] Tablet (iPad, 768px): tables render
  - [ ] Desktop (1024px): full layout
  - [ ] No console errors

- [ ] Commit: `refactor: Mobile optimization and responsive design`

---

### Day 5: Testing + Bug Fixes

- [ ] End-to-end flow
  - [ ] [ ] Import URL → Analyze → Match view displays
  - [ ] [ ] With XML: Analyze + XML → owned_reason badges show
  - [ ] [ ] Buy flow: Click CTA → Modal → Store tab → Open all
  - [ ] [ ] Share: Generate link → Copy → Share → View
  - [ ] [ ] Re-analyze: XML re-upload → Results update
  - [ ] [ ] Export CSV: Downloads correct subset

- [ ] Buylist state
  - [ ] [ ] Bought/Skip dropdown works
  - [ ] [ ] Undo toast appears
  - [ ] [ ] State persists (IndexedDB)

- [ ] owned_reason display
  - [ ] [ ] ISRC match: Shows ✓(ISRC) or ✓ ISRC badge
  - [ ] [ ] Exact match: Shows ✓(Exact) badge
  - [ ] [ ] Album match: Shows ≈(Album) badge
  - [ ] [ ] Fuzzy match: Shows ≈(Fuzzy) badge
  - [ ] [ ] Unknown: Shows ⚪ or ?(Unknown)

- [ ] Performance
  - [ ] [ ] Run Lighthouse (target: >85)
  - [ ] [ ] Check for console errors
  - [ ] [ ] Verify no unnecessary re-renders (Profiler)

- [ ] Bug fixes
  - [ ] [ ] Address any broken tests
  - [ ] [ ] Fix accessibility issues
  - [ ] [ ] Smooth out UX rough edges

- [ ] Final checklist
  - [ ] [ ] All acceptance criteria pass
  - [ ] [ ] Code is clean and commented
  - [ ] [ ] No console warnings
  - [ ] [ ] Mobile responsive confirmed

- [ ] Commit: `test: End-to-end validation and bug fixes`

---

## 🎯 Parallel Tasks (If Possible)

These can be started in parallel on Day 2:
- Design owned_reason badge styling (colors, icons)
- Prepare test data (playlists with owned/missing/unavailable mixes)
- Review mobile device testing setup

---

## 📝 File Structure (New/Modified)

### New Files
```
app/components/
├─ Stepper.tsx
├─ SummaryBar.tsx
├─ TrackSection.tsx
├─ BuyMissingButton.tsx
└─ BuyModal.tsx

app/hooks/
└─ useTrackFilters.ts
```

### Modified Files
```
app/page.tsx  (major refactor: -1177 lines, +500 new, net -677)
lib/types.ts  (unchanged, or add if needed)
```

---

## 🚀 Pre-Implementation Checklist

- [ ] All planning docs reviewed
- [ ] Team aligned on design
- [ ] Backend API unchanged (Snapshot format, endpoints)
- [ ] Test environment ready
- [ ] Mobile test devices available
- [ ] Git branch created: `refactor/checkout-experience`

---

## 🧪 Testing Checklist (Per Day)

### Day 1 End
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] Stepper renders
- [ ] SummaryBar renders

### Day 2 End
- [ ] `npm run build` succeeds
- [ ] 3 sections render correctly
- [ ] Filters work (owned/missing/unavailable)
- [ ] Collapsible toggles work

### Day 3 End
- [ ] `npm run build` succeeds
- [ ] Modal opens/closes
- [ ] Store tabs work
- [ ] "Open all" button works

### Day 4 End
- [ ] `npm run build` succeeds
- [ ] Mobile responsive confirmed
- [ ] No horizontal scroll on mobile
- [ ] Sticky footer visible

### Day 5 End
- [ ] All acceptance criteria ✓
- [ ] End-to-end test ✓
- [ ] Performance > 85 ✓
- [ ] No console errors ✓

---

## 📊 Progress Tracking

```
Day 1: [ ] Stepper [ ] SummaryBar [ ] Integration
Day 2: [ ] TrackSection [ ] Layout refactor [ ] Testing
Day 3: [ ] BuyModal [ ] CTA integration [ ] Testing
Day 4: [ ] Mobile responsive [ ] Polish [ ] Testing
Day 5: [ ] E2E validation [ ] Bug fixes [ ] Commit
```

---

## 💾 Deployment Checklist

Before deploying to production:

- [ ] All branches merged to main
- [ ] Code review completed
- [ ] Lighthouse score > 85
- [ ] Mobile tested on real devices
- [ ] Share URL tested end-to-end
- [ ] CSV export works
- [ ] Buylist state persists
- [ ] No console errors in production build
- [ ] Performance monitoring set up

---

## 📞 Questions During Implementation?

Refer to:
1. **"Why this approach?"** → `CHECKOUT_IMPLEMENTATION_STRATEGY.md`
2. **"How to build component X?"** → `TACTICAL_IMPLEMENTATION.md`
3. **"What should it look like?"** → `UI_REFERENCE_MOCKUPS.md`
4. **"What's the overall goal?"** → `PLAN_SUMMARY.md`

---

**Status**: 🟢 Ready to start implementation  
**Estimated Effort**: 40-50 hours (5 full days)  
**Difficulty**: Medium (component extraction + state refactoring)

