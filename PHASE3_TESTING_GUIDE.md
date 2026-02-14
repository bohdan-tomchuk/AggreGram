# Phase 3 Testing Guide

## Prerequisites

1. **Backend running** on port 3001
2. **Frontend running** on port 3000
3. **Database** (PostgreSQL) running
4. **User authenticated** with Telegram connection

## Test Scenarios

### Scenario 1: Search for Channels

**Steps:**
1. Navigate to a feed detail page: `/feeds/{feedId}`
2. Click "Add Source" button in the Source Channels section
3. Type "tech" in the search input
4. Wait for search results (300ms debounce)

**Expected Results:**
- Loading spinner appears during search
- Search results display public tech-related channels
- Each result shows:
  - Channel title
  - Username (@handle)
  - Description (if available)
  - Subscriber count (if available)
  - "+" icon to add

**API Call:**
```
GET /api/channels/search?q=tech
```

**Backend Flow:**
1. TdlibService.searchPublicChats() called
2. TDLib returns matching chat IDs
3. For each chat:
   - getChat() retrieves basic info
   - getSupergroupFullInfo() retrieves subscriber count
4. Channels mapped to SourceChannel format
5. Upserted to `source_channels` table
6. Returned to frontend

---

### Scenario 2: Add Source to Feed

**Steps:**
1. From search results modal, click on a channel
2. Wait for confirmation

**Expected Results:**
- Loading spinner appears on the clicked channel
- Toast notification: "Source added" with channel username
- Modal closes
- Source appears in the sources list
- Feed's sourceCount increments

**API Call:**
```
POST /api/feeds/{feedId}/sources
Body: { "channelUsername": "TechCrunch" }
```

**Backend Flow:**
1. FeedsService.addSource() called
2. Verify feed ownership (user must own the feed)
3. Find SourceChannel by username
4. Check for duplicate (unique constraint on feed_id + source_channel_id)
5. Create FeedSource record
6. Return updated feed with new sourceCount

**Database Changes:**
```sql
-- New record in feed_sources
INSERT INTO feed_sources (feed_id, source_channel_id, last_message_id, added_at)
VALUES ('{feedId}', '{sourceChannelId}', NULL, NOW());
```

---

### Scenario 3: View Feed Sources

**Steps:**
1. Navigate to feed detail page with existing sources
2. Observe the Source Channels section

**Expected Results:**
- List of all added sources displays
- Each source shows:
  - Channel title
  - Username (@handle)
  - Description (truncated to 2 lines)
  - Subscriber count (formatted: 1.2M, 500K, etc.)
  - "Added {time} ago" timestamp
  - Remove button (trash icon)

**API Call:**
```
GET /api/feeds/{feedId}/sources
```

**Backend Flow:**
1. FeedsService.getSources() called
2. Query feed_sources with JOIN on source_channels
3. Map to response format with full channel details
4. Order by added_at DESC

---

### Scenario 4: Remove Source from Feed

**Steps:**
1. From sources list, click the trash icon on any source
2. Confirm deletion in browser alert
3. Wait for operation to complete

**Expected Results:**
- Confirmation dialog appears
- Loading spinner on remove button
- Toast notification: "Source removed"
- Source disappears from list
- Feed's sourceCount decrements

**API Call:**
```
DELETE /api/feeds/{feedId}/sources/{sourceId}
```

**Backend Flow:**
1. FeedsService.removeSource() called
2. Verify feed ownership
3. Find FeedSource by ID and feedId
4. Delete record
5. Return success

**Database Changes:**
```sql
DELETE FROM feed_sources WHERE id = '{sourceId}' AND feed_id = '{feedId}';
```

---

### Scenario 5: Error Handling - Duplicate Source

**Steps:**
1. Add a source to a feed (e.g., @TechCrunch)
2. Try to add the same source again

**Expected Results:**
- Error toast: "This channel is already added to the feed"
- Modal remains open
- No duplicate record created

**Backend Response:**
```json
{
  "statusCode": 400,
  "message": "This channel is already added to the feed"
}
```

---

### Scenario 6: Error Handling - Channel Not Found

**Steps:**
1. Try to add a source that hasn't been searched for yet
   (This is prevented in the UI, but could be tested via API directly)

**API Call (manual test):**
```bash
curl -X POST http://localhost:3001/api/feeds/{feedId}/sources \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"channelUsername": "nonexistent_channel_12345"}'
```

**Expected Results:**
```json
{
  "statusCode": 404,
  "message": "Channel @nonexistent_channel_12345 not found. Please search for it first."
}
```

---

## Database Verification

### Check Source Channels Table
```sql
SELECT * FROM source_channels ORDER BY created_at DESC LIMIT 10;
```

**Expected:**
- Recent searches populate this table
- `last_metadata_sync` updated on each search
- Unique constraint on `telegram_channel_id`

### Check Feed Sources Table
```sql
SELECT
  fs.id,
  f.name as feed_name,
  sc.title as channel_title,
  sc.username,
  fs.added_at
FROM feed_sources fs
JOIN feeds f ON fs.feed_id = f.id
JOIN source_channels sc ON fs.source_channel_id = sc.id
ORDER BY fs.added_at DESC;
```

**Expected:**
- Junction records linking feeds to channels
- CASCADE delete (deleting feed removes feed_sources)
- Unique constraint prevents duplicates

---

## Edge Cases to Test

### 1. Channel Without Username
Some Telegram channels don't have public usernames.

**Test:**
- Search for such a channel
- Observe it in results
- Try to add it

**Expected:**
- Channel appears in search (if public)
- Adding fails gracefully with error message
- Or: Channel is filtered out from results (current implementation)

### 2. Search with Special Characters
**Test:**
```
Search queries: "tech news", "crypto 💎", "gaming!", "@TechCrunch"
```

**Expected:**
- All queries work (TDLib handles sanitization)
- @ symbol automatically stripped if present

### 3. Very Long Channel Descriptions
**Test:**
- Search for channels with lengthy descriptions
- Add to feed
- View in sources list

**Expected:**
- Descriptions truncated to 2 lines with `line-clamp-2`
- No layout breaking

### 4. Large Subscriber Counts
**Test:**
- Search for popular channels (1M+ subscribers)
- Observe formatting

**Expected:**
```
1,234,567 → 1.2M
567,890 → 567.9K
999 → 999
```

---

## Performance Checks

### Search Debouncing
**Test:**
- Type "t", "te", "tec", "tech" rapidly
- Observe network requests in DevTools

**Expected:**
- Only ONE request fires 300ms after last keystroke
- No request spam

### Source List Loading
**Test:**
- Navigate to feed with 10+ sources
- Measure initial load time

**Expected:**
- Single API call to fetch all sources
- Minimal re-renders
- Smooth scrolling if list is long

---

## Troubleshooting

### "No active Telegram session" Error
**Cause:** User's TDLib client not initialized
**Fix:** Ensure user completed Telegram connection wizard

### "Channel not found" on Add
**Cause:** Channel was not searched first
**Fix:** Search for channel before adding (UI prevents this)

### Duplicate Key Violation
**Cause:** Race condition or manual SQL insertion
**Fix:** Unique constraint handles this; backend returns 400

### Search Returns Empty Results
**Possible Causes:**
1. Query too short (< 2 chars) → Expected behavior
2. TDLib session expired → Re-authenticate
3. No matching public channels → Expected behavior

---

## Success Criteria

✅ **Search**
- Returns results within 1-2 seconds
- Displays accurate channel metadata
- Handles empty results gracefully

✅ **Add Source**
- Creates database record
- Updates feed's sourceCount
- Shows success notification
- Prevents duplicates

✅ **Remove Source**
- Deletes database record
- Updates UI immediately
- Shows confirmation dialog

✅ **UI/UX**
- No console errors
- Loading states visible
- Error messages helpful
- Mobile responsive
- Accessible (keyboard navigation, ARIA labels)

---

## Next Steps After Testing

Once Phase 3 is verified:
1. Proceed to Phase 4: BullMQ Setup & Telegram Channel Creation
2. Implement job queue for message aggregation
3. Enable actual message forwarding from sources to feed channels

Phase 3 provides the foundation—users can now curate their source lists. Phase 4 will bring those sources to life! 🚀
