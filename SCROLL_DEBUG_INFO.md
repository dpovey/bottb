# Scroll Debugging Information

## What We're Investigating

The page is scrolling to the "Past Events" section when it loads. We need to understand:
1. **What** is causing the scroll
2. **When** it happens (timing)
3. **Why** it happens (root cause)

## Browser Scroll Restoration

### What is Browser Scroll Restoration?

Browser scroll restoration is a feature that automatically restores the scroll position when you:
- Navigate back/forward using browser buttons
- Reload the page (in some cases)
- Return to a page from history

### How It Works

1. **Automatic Mode** (`history.scrollRestoration = "auto"` - default):
   - Browser saves scroll position when you leave a page
   - Browser restores scroll position when you return
   - Can cause issues with dynamic content (like Suspense boundaries)

2. **Manual Mode** (`history.scrollRestoration = "manual"`):
   - You control when scroll position is saved/restored
   - More predictable behavior
   - Requires you to manage scroll position yourself

### The Problem with Suspense Boundaries

When a Suspense boundary resolves:
1. New content is added to the DOM
2. Browser may try to restore scroll position
3. If content above the restored position was removed/changed, browser may scroll to maintain the "same" position
4. This can cause unexpected scrolling

## Next.js and Scroll Behavior

Next.js has its own scroll restoration behavior:
- On client-side navigation, it tries to restore scroll position
- On initial page load, it should start at top
- Suspense boundaries can interfere with this

## What the Debug Component Logs

The `ScrollDebug` component logs:

1. **scrollIntoView calls**:
   - Which element is being scrolled into view
   - What component/function called it
   - Stack trace to find the source

2. **scrollTo calls**:
   - What position it's scrolling to
   - Who called it
   - Stack trace

3. **Scroll events**:
   - When scroll position changes
   - How much it changed
   - Timing

4. **DOM changes**:
   - When Suspense boundaries resolve
   - What content is added
   - Scroll position at that moment

## How to Use the Debug Output

1. Open browser DevTools Console
2. Load the page
3. Look for messages prefixed with 🔍
4. Check the timing:
   - Does scroll happen immediately on load?
   - Does it happen when Suspense resolves?
   - Does it happen after a delay?

5. Check the stack traces:
   - What function is calling scrollIntoView?
   - Is it from a component?
   - Is it from Next.js internals?
   - Is it from browser scroll restoration?

## Common Causes

1. **Browser scroll restoration**:
   - Browser trying to restore previous scroll position
   - Solution: Set `history.scrollRestoration = "manual"`

2. **Component calling scrollIntoView**:
   - A component (like PhotoStrip) calling scrollIntoView on mount
   - Solution: Prevent scrollIntoView during initial load

3. **Focus management**:
   - An element getting focus and browser scrolling to it
   - Solution: Prevent autofocus during initial load

4. **Layout shifts**:
   - Content loading causing layout to shift
   - Browser trying to maintain scroll position
   - Solution: Prevent scroll during layout shifts

5. **Next.js router**:
   - Next.js trying to restore scroll position
   - Solution: Configure Next.js scroll behavior

## Next Steps

After reviewing the debug output:
1. Identify the exact cause
2. Fix the root cause (not just the symptom)
3. Remove the debug component
4. Test thoroughly

