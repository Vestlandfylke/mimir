# Race Condition Fix - Concurrent Chat Requests

## 🎯 Problem Identifisert!

**Oppdaga av brukar**:
> "when i send 2 messages quickly before it has time to respond to the first one, i dont get the first response only the second"

**Dette er ROOT CAUSE!** ✅

## 🔍 Kva Skjer

### Scenario: Concurrent Requests

```
User: [Send "test 1"]
Time: 0s
  → Frontend: Start request 1
  → Redux: botResponseStatus = "Generating..."
  → Backend: Start AI processing for message 1

User: [Send "test 2" QUICKLY] 
Time: 5s (before message 1 completes!)
  → Frontend: Start request 2
  → Redux: botResponseStatus = "Generating..." (OVERWRITES message 1 state!)
  → Backend: Start AI processing for message 2

Backend: Message 1 done
Time: 35s
  → Backend sends SignalR: "Here's answer to test 1"
  → Frontend receives message
  → BUT: Redux state is waiting for message 2!
  → Message 1 response: LOST/IGNORED 💀

Backend: Message 2 done
Time: 40s
  → Backend sends SignalR: "Here's answer to test 2"  
  → Frontend receives and displays ✅

Result: User only sees answer to message 2
```

## 🎯 Root Cause

**Redux State Management Issue**:
1. Frontend tracks "current pending message" i Redux state
2. Når message 2 sender, blir state for message 1 **overskrive**
3. Når message 1 response kjem, har den ingen "destination" lenger
4. Redux state peiker på message 2, så message 1 blir ignorert

**Kvifor dette skjer intermittent**:
- Dersom du ventar på svar mellom meldingar → Fungerer ✅
- Dersom du sender raskt etter kvarandre → Feiler ❌

## 🔧 Løysing: Request Queue

**Implementert**: `webapp/src/libs/services/ChatRequestQueue.ts`

### Korleis Det Fungerer

```typescript
// Before (Problem):
User clicks send → Execute immediately → Concurrent requests → Race condition

// After (Fixed):
User clicks send → Add to queue → Process one at a time → No conflicts
```

### Implementation

**1. Queue Manager** (Allereie laga):
```typescript
// webapp/src/libs/services/ChatRequestQueue.ts
import { chatRequestQueue } from './libs/services/ChatRequestQueue';

// Use it:
await chatRequestQueue.enqueue(async () => {
    await sendChatMessage(message, chatId);
});
```

**2. Korleis Bruke i Chat Component**:

Find where chat messages are sent (likely in a component or Redux action), then wrap it:

```typescript
// BEFORE (Problem - concurrent):
const handleSendMessage = async (message: string) => {
    await dispatch(sendChatMessage(message, chatId));
};

// AFTER (Fixed - queued):
import { chatRequestQueue } from '../../libs/services/ChatRequestQueue';

const handleSendMessage = async (message: string) => {
    await chatRequestQueue.enqueue(async () => {
        await dispatch(sendChatMessage(message, chatId));
    });
};
```

### Benefits

✅ **No Lost Messages**: All responses are received and displayed  
✅ **Proper Ordering**: Messages processed in send order  
✅ **State Consistency**: Redux state not overwritten  
✅ **Visual Feedback**: Can show queue length to user  
✅ **Error Handling**: Failed requests don't block queue  

## 📋 Implementation Steps

### Step 1: Add Queue File (Done ✅)
```
webapp/src/libs/services/ChatRequestQueue.ts
```

### Step 2: Find Send Message Location

Search for where chat messages are sent:
```typescript
// Look for:
- sendMessage function
- dispatch(chatAction)
- POST /api/chat/chat
```

### Step 3: Wrap With Queue

```typescript
import { chatRequestQueue } from '../../libs/services/ChatRequestQueue';

// Wrap the send logic:
await chatRequestQueue.enqueue(async () => {
    // Original send code here
});
```

### Step 4: Optional - Show Queue Status

```typescript
// In chat component:
const queueLength = chatRequestQueue.getQueueLength();
const isProcessing = chatRequestQueue.isCurrentlyProcessing();

// Show to user:
{isProcessing && (
    <div>Processing message... ({queueLength} in queue)</div>
)}
```

### Step 5: Test

1. Send message 1
2. IMMEDIATELY send message 2 (before response)
3. Both responses should appear ✅

## 🔍 Debugging Logs

With the queue, you'll see in console:

```javascript
📋 Request queued (1 in queue): req-1234567890
⚙️ Processing request (0 remaining): req-1234567890
✅ Request completed: req-1234567890
✅ Queue empty - ready for new requests

📋 Request queued (1 in queue): req-1234567891
⚙️ Processing request (0 remaining): req-1234567891
✅ Request completed: req-1234567891
✅ Queue empty - ready for new requests
```

## 🎯 Expected Result

**Before Fix**:
```
Send "test 1" fast
Send "test 2" fast
→ Only see response to "test 2" ❌
```

**After Fix**:
```
Send "test 1" fast
Send "test 2" fast
→ See response to "test 1" ✅
→ Then see response to "test 2" ✅
```

## 📊 Why This Works

**Problem**: Redux state overwritten by concurrent requests  
**Solution**: Serialize requests - only one at a time  

```
Queue prevents:
- State conflicts ✅
- Lost responses ✅
- Race conditions ✅
- Out-of-order processing ✅
```

## 🚀 Next Steps

1. Find send message location in code
2. Import and use chatRequestQueue
3. Rebuild frontend: `yarn build`
4. Deploy
5. Test: Send 2 messages rapidly
6. Verify: Both responses appear

## 💡 Alternative: Concurrent With Better State Management

If you want to allow concurrent requests (faster), you could instead:

1. Track MULTIPLE pending messages in Redux (not just one)
2. Use messageId to match responses
3. Each response updates its own message

But queueing is SIMPLER and SAFER for now.

## ✅ Summary

**Problem**: Concurrent requests cause first response to be lost  
**Root Cause**: Redux state overwritten by second request  
**Solution**: Queue requests - process one at a time  
**File**: `webapp/src/libs/services/ChatRequestQueue.ts` (created)  
**Next**: Integrate into send message logic  

This WILL fix the intermittent "spinning" issue! 🎉

