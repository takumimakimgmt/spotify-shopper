# 🎯 Quick Reference Card

## Checkout Experience Refactor at a Glance

### The Big Picture
Transform from **mixed results** → to **3-tier checkout flow**

```
BEFORE:              AFTER:
50 mixed tracks  →   Stepper (Import→Match→Buy)
                     Summary (50 total)
Hard to find         Owned (20) - collapsible
what to buy          Missing (25) - PRIMARY - [Buy Button] ← FOCUS
                     Unavailable (5) - collapsible
```

---

## 6 New Components

```
1. Stepper        : Import ━━ Match ━━ Buy (3 steps, sticky)
2. SummaryBar     : 4 counts + progress bar
3. TrackSection   : Owned/Missing/Unavailable (collapsible/expandable)
4. BuyMissingBtn  : Red button, "Buy {N} Missing Tracks"
5. BuyModal       : Store tabs (All|Beatport|Bandcamp|iTunes)
6. useTrackFilters: Hook for categorization logic
```

---

## 5 Days of Work

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Stepper + SummaryBar | Foundation components |
| 2 | TrackSection + Layout | 3-tier display working |
| 3 | BuyModal + CTA | Core feature complete |
| 4 | Mobile + Polish | Responsive, finished |
| 5 | Testing + Fixes | Ready for production |

---

## Key Numbers

- **1777** lines in page.tsx (before)
- **600** lines in page.tsx (after) = **66% reduction**
- **6** new component files
- **0** breaking changes to API
- **0** changes to backend
- **4** categories (Owned/Missing/Unavailable/Total)
- **40-50** hours total effort
- **5** business days

---

## Color Coding

```
🟢 Owned     = emerald-500  (completed, saved)
🔴 Missing   = red-500      (action needed)
⚪ Unavail   = slate-500    (manual search)
⚪ Stepper   = emerald-500  (progress tracking)
```

---

## Owned Reason Badges

```
✓ ISRC    = 100% confirmed (server matched ISRC)
✓ Exact   = Very confident (title + artist matched)
≈ Album   = Likely correct (title + album matched)
≈ Fuzzy   = Best guess (similarity ≥92%)
? Unknown = No match found
```

---

## Mobile Breakpoints

```
<768px  : Cards, sticky footer CTA, collapsed sections
768px+  : Tables, normal layout, expanded sections
1024px+ : Wide layout, full features
```

---

## API Changes

```
Endpoint:    /api/playlist (unchanged)
Snapshot:    PlaylistSnapshotV1 (unchanged)
Response:    Still returns tracks with owned/owned_reason
Frontend:    Only processes differently (3-tier split)
Result:      Backend-agnostic refactor
```

---

## Git Strategy

```
Main branch:        main (production)
Feature branch:     refactor/checkout-experience
Daily commits:      feat(day1), feat(day2), etc.
PR strategy:        Option: 1 big PR or 3 phased PRs
Deploy:            After Day 5 (all features complete)
```

---

## Testing Checklist (Abbreviated)

```
[ ] Day 1: Stepper renders, SummaryBar calculates correctly
[ ] Day 2: 3 sections display, collapsible works
[ ] Day 3: Modal opens/closes, store tabs filter
[ ] Day 4: Mobile responsive, no horizontal scroll
[ ] Day 5: E2E test, Share works, CSV exports, no errors
```

---

## Documents Location

```
/Users/takumimaki/dev/.github/

📄 README_CHECKOUT_REFACTOR.md      ← START HERE (navigation)
📄 DELIVERY_SUMMARY.md              ← What you're getting
📄 PLAN_SUMMARY.md                  ← Executive overview
📄 REFACTOR_CHECKOUT_FLOW.md        ← Detailed spec (30 pages)
📄 CHECKOUT_IMPLEMENTATION_STRATEGY  ← Architecture decisions
📄 TACTICAL_IMPLEMENTATION.md        ← Day-by-day coding
📄 UI_REFERENCE_MOCKUPS.md          ← Visual layouts
📄 IMPLEMENTATION_CHECKLIST.md       ← Tracking checklist
```

---

## State Management (Simple)

```typescript
// Add one new state:
const [currentStep, setCurrentStep] = useState<'import'|'match'|'buy'>('import');

// Keep existing:
- multiResults (array of [URL, ResultState])
- activeTab (which playlist viewed)
- IndexedDB (Buylist state)
- localStorage (UI state)

// Computed (no state):
const ownedTracks = useMemo(() => 
  currentResult?.tracks.filter(t => t.owned === true) ?? []
);
const missingTracks = useMemo(() => 
  currentResult?.tracks.filter(t => t.owned === false) ?? []
);
const unavailableTracks = useMemo(() => 
  currentResult?.tracks.filter(t => t.owned === null) ?? []
);
```

---

## Flow (User's Perspective)

```
1. Enter playlist URL
   ↓
2. Click [Analyze]
   ↓
3. See Stepper step 2 (Match) ✓
4. See SummaryBar: "Missing: 25 / 50"
5. Focus on Missing section (red) ← DEFAULT ATTENTION
6. Click [Buy 25 Missing Tracks]
   ↓
7. Modal opens, shows Beatport tab by default
8. Click [Open all Beatport tracks]
   ↓
9. 15 new tabs open
10. User buys tracks
11. Closes modal
    ↓
12. (Optional) Click [Share] to share results
```

---

## What Doesn't Change

✅ Backend API  
✅ Rekordbox matching  
✅ IndexedDB schema  
✅ Share snapshot format  
✅ CSV export logic  
✅ Buylist (Bought/Skip buttons)  
✅ Re-analyze with XML  

---

## Common Mistakes to Avoid

❌ Don't change backend API  
❌ Don't break Share URL  
❌ Don't remove Buylist state  
❌ Don't use new CSS framework  
❌ Don't add heavy dependencies  
❌ Don't hardcode mobile breakpoints  

✅ Do use Tailwind classes  
✅ Do useMemo for performance  
✅ Do test on real mobile device  
✅ Do keep code DRY (TrackSection reuse)  

---

## Emergency Contacts (For Implementation)

**If stuck on**:

| Topic | Document |
|-------|----------|
| Component spec | REFACTOR_CHECKOUT_FLOW.md |
| Visual design | UI_REFERENCE_MOCKUPS.md |
| Code example | TACTICAL_IMPLEMENTATION.md |
| Why this approach | CHECKOUT_IMPLEMENTATION_STRATEGY.md |
| Daily task | IMPLEMENTATION_CHECKLIST.md |

---

## Success Indicators

You'll know it's working when:

✅ **Stepper shows** 3 steps at top  
✅ **SummaryBar shows** 4 accurate counts  
✅ **3 sections separate** Owned/Missing/Unavailable  
✅ **Missing is red** and highlighted  
✅ **Buy button opens** store-grouped modal  
✅ **Mobile** has no horizontal scroll  
✅ **Share link** works (copy + paste)  
✅ **All tests pass** with no errors  

---

## Performance Notes

- useMemo for filters (avoid re-computing owned/missing each render)
- No virtualization needed unless >200 tracks per section
- Tailwind CSS (already loaded)
- No new npm packages required
- Lighthouse target: >85

---

## Commit Messages

```
Day 1: feat: Add Stepper and SummaryBar components
Day 2: refactor: Implement 3-tier track categorization
Day 3: feat: Add Buy Missing Tracks modal
Day 4: refactor: Mobile optimization and responsive design
Day 5: test: End-to-end validation and bug fixes
```

---

## Final Checklist (Before Shipping)

- [ ] npm run build succeeds
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Lighthouse > 85
- [ ] Mobile test passed
- [ ] Share URL works
- [ ] Buylist state works
- [ ] CSV export works
- [ ] Code review approved
- [ ] Deploy to production

---

## Questions? 

See `README_CHECKOUT_REFACTOR.md` for FAQ and document navigation.

---

**Estimated Duration**: 40-50 hours (5 business days)  
**Difficulty**: Medium  
**Risk**: Low-Medium (well-mitigated)  
**Code Reduction**: -66% (page.tsx)  
**Backend Impact**: Zero  

**Status**: 🟢 Ready to build

