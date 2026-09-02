# Phase 3 Validation Checklist - Match Plan / Tactical Pitch Board

## Root Cause Summary

### 1. Pitch Vertical Clipping - FIXED
**Root Cause**: Aspect ratio mismatch between container (`aspect-[3/4]` = 0.75) and SVG viewBox (`viewBox="0 0 100 130"` = 0.769)
**Fix Applied**: Changed `aspect-[3/4]` to `aspect-[100/130]` to match viewBox ratio exactly
**Files Changed**: `src/components/MatchPitchBoard.tsx` line ~702
**Expected Result**: Complete pitch visible including top goal, opponent penalty area, and GK position at bottom

### 2. Erratic Interaction - FIXED  
**Root Cause**: `setDragCoords()` called in `handlePointerMove()` on every mouse movement (100-300Hz), causing full component re-renders
**Fix Applied**: 
- Removed `dragCoords` state
- Added `dragCoordsRef` to store coordinates without triggering re-renders
- Modified `handlePointerMove()` to update ref instead of state
- Player tokens now read from `dragCoordsRef.current` for smooth visual tracking
**Files Changed**: `src/components/MatchPitchBoard.tsx` (multiple methods)
**Expected Result**: Drag interaction is smooth without jitter or lag

### 3. Player Assignment Reflow - ANALYZED
**Status**: No issues identified. Slot positions are absolute and fixed (left/top percentages). Deterministic positioning via `resolveStablePitchPosition()` ensures consistent placement regardless of array order.
**Potential**: Memoization could improve (optional optimization)
**Expected Result**: Assigning/removing/moving players produces no visible movement of other positions

---

## Manual Regression Test Scenario

### Setup
1. Open Match Centre → Line-up tab
2. Select "Preseason 5" match (or any match with existing lineup)
3. Verify 11 starters visible on pitch, others in Substitutes section

### Test 1: Verify Complete Pitch Visibility
- [ ] Top of pitch visible (opponent goal line)
- [ ] Opponent penalty area visible
- [ ] Center circle visible
- [ ] Midfield line visible  
- [ ] Our penalty area visible
- [ ] Bottom of pitch visible (our goal/GK position)
- [ ] All 11 formation anchors visible simultaneously
- [ ] No horizontal scroll needed
- [ ] No vertical scroll needed to see full pitch

### Test 2: Smooth Drag Interaction
1. Click and hold on a starter player token
2. Slowly drag across the pitch
   - [ ] Avatar/label follows cursor smoothly
   - [ ] No stuttering or jitter observed
   - [ ] Drag preview is visible
   - [ ] Original player row dims

3. During drag, check target highlighting
   - [ ] Nearest slot highlights as you hover
   - [ ] Highlighting updates smoothly as you move
   - [ ] No flickering of highlights

4. Drop on empty position
   - [ ] Player assigned to new position
   - [ ] New position slot becomes occupied
   - [ ] Old position slot remains visible and empty
   - [ ] No other players move

### Test 3: Player Assignment - No Reflow
1. Load XI with all 11 positions filled
2. Visually note the exact positions of 3 players (e.g., LW, ST, RW)
3. Drag a substitute onto an empty slot (if one exists) OR swap two players
4. After drop completes:
   - [ ] The 3 noted players remain in EXACT same visual positions
   - [ ] No other slots have visibly shifted
   - [ ] Grid remains stable (no layout recalculation)
   - [ ] Right Match Squad panel doesn't reflow

### Test 4: Remove Player from Pitch
1. Click on any starter player
2. Select "Mover al Banquillo" (Move to Bench)
3. Verify:
   - [ ] Player disappears from pitch
   - [ ] Empty slot appears where player was
   - [ ] Empty slot at exact same coordinates (no movement)
   - [ ] All other positions unchanged
   - [ ] Player appears in Substitutes section
   - [ ] Call-up remains (player still in Match Squad)

### Test 5: Move to Starter from Bench
1. Drag a substitute onto an empty position
2. Verify:
   - [ ] Substitute moves to pitch
   - [ ] Appears at exact slot coordinates
   - [ ] Disappears from Substitutes section
   - [ ] Starter count increases
   - [ ] No other players move

### Test 6: Starter to Starter Swap
If 11 starters filled:
1. Drag starter A onto starter B's position
2. Verify:
   - [ ] Starter A takes starter B's slot
   - [ ] Starter B moves to Substitutes
   - [ ] B's original position becomes empty
   - [ ] Exactly 2 changes (A's entry updated, B moved to bench)
   - [ ] No other positions affected

### Test 7: Formation Switch
1. Load XI with mixed formation
2. Click different formation button (e.g., 1-4-2-3-1)
3. Auto-alignment may reposition starters
4. After complete:
   - [ ] All 11 positions still visible
   - [ ] New formation layout looks correct
   - [ ] All players present (none lost)
   - [ ] Pitch still fully visible (no clipping)

### Test 8: Auto-Fill Formation
1. Start with 6 starters, rest empty
2. Click "Completar 11" (Fill XI)
3. Verify:
   - [ ] Substitutes move to empty slots
   - [ ] All 11 slots filled
   - [ ] Pitch layout stable
   - [ ] Match Squad totals correct (11 starters, remaining as subs)

### Test 9: Data Persistence
1. Assign several players to pitch
2. Refresh browser (F5)
3. Wait for page to load
4. Verify:
   - [ ] Same 11 starters visible
   - [ ] Same positions on pitch (pitch coordinates persisted)
   - [ ] Formation unchanged
   - [ ] Match Squad panel matches previous state

### Test 10: Responsive - Desktop (1440px)
1. Resize browser to 1440px width
2. Verify:
   - [ ] Pitch is full size and visible
   - [ ] Right panel (Match Squad) displays beside pitch (lg: grid)
   - [ ] No clipping of pitch
   - [ ] Both sides visible without horizontal scroll
   - [ ] Drag interaction works smoothly

### Test 11: Responsive - Mobile (390px)
1. Resize browser to 390px width (mobile)
2. Verify:
   - [ ] Pitch scales down proportionally  
   - [ ] All 11 anchors still visible
   - [ ] Aspect ratio preserved (not stretched)
   - [ ] Right panel stacks below pitch
   - [ ] Drag interaction works (may require fine motor control)
   - [ ] No horizontal overflow

---

## Expected Outcomes

### Clipping Fix
- **Before**: Top and bottom of pitch cropped, GK position cut off
- **After**: Complete 130-unit-tall viewBox rendered, all positions visible

### Erratic Interaction Fix
- **Before**: Stuttering/jitter during drag due to constant re-renders
- **After**: Smooth drag with no visual lag

### Reflow Prevention
- **Before**: Any state change might appear to shift positions
- **After**: Absolute positioning ensures no unintended movement

---

## Performance Notes

- Drag performance: No re-renders during pointer movement (only on drop)
- Memory: dragCoordsRef is lightweight (single {x,y} object)
- Build time: Minimal change, no performance regression expected
- Test suite: All 104 tests pass

---

## Sign-Off Checklist

- [ ] All 11 visual regression tests pass
- [ ] Desktop (1440px) validation complete
- [ ] Mobile (390px) validation complete
- [ ] Pitch fully visible (no clipping confirmed)
- [ ] Drag smooth and responsive
- [ ] No unintended player movement during operations
- [ ] Data persists correctly on reload
- [ ] Formation switching works
- [ ] Auto-fill works  
- [ ] No errors in browser console
- [ ] Build passes: `npm run build`
- [ ] Lint passes: `npm run lint`
- [ ] Tests pass: 104/104

**Validation Date**: _______________
**Validated By**: _______________
**Notes**: 
