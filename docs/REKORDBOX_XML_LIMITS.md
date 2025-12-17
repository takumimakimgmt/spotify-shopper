# Rekordbox XML Upload Limits

## Current Design Decision

**Max Size: 50 MB (Maintained)**

### Rationale

- **Current Data Point**: 2,226 tracks = 2.39 MB  
  Extrapolation: ~50,000 tracks would be ~50 MB (likely largest personal library)
- **50 MB Limit Benefits**:
  - Safe margin for most users (up to ~50,000 tracks)
  - Avoids frontend memory bloat during XML parsing
  - Backend can process iteratively with streaming (iterparse)
  - Prevents accidental uploads of entire music library

### User-Facing Guidance

When file exceeds 50 MB, users see:
> "XML is too large ({size} MB). Please export smaller, playlist-level XML from Rekordbox and try again."

**Action**: Export playlists individually rather than entire library XML.

### Future Scaling

If demand arises for >50k track support:
1. **Option A**: Raise limit to 100 MB + implement streaming XML parse on backend
2. **Option B**: Support multi-file uploads (e.g., 5 playlists × 4MB each)
3. **Option C**: Add frontend UI for "chunked" processing

Current implementation supports Option A with no changes needed—just update `MAX_XML_BYTES` and backend will use iterparse.

## Implementation Locations

- **Frontend Constant**: `lib/constants.ts` → `MAX_XML_BYTES = 20 * 1024 * 1024`
- **Frontend Validation**: 
  - `app/components/AnalyzeForm.tsx` (file upload)
  - `app/components/SidePanels.tsx` (snapshot re-match)
- **Backend Constant**: `app.py` → `MAX_UPLOAD_SIZE = 20 * 1024 * 1024`

## Testing

- [x] Tested with 2.39 MB (2,226 tracks) → ✅ Works
- [ ] Test with 15 MB XML to verify near-limit behavior
- [ ] Test with 20.1 MB to verify rejection + clear error

