# Resume Tailoring — Cursor-Native Prompt

Highlight your backend tailoring code and press **Cmd+K** (Mac) or **Ctrl+K** (Windows/Linux) to apply these instructions.

## Task

Refactor the resume tailoring API logic to optimize for token cost and ATS performance.

## Context

- **Platform:** [cv2ats.ca](https://cv2ats.ca) (Next.js/React)
- **Current Model:** `openai/gpt-4o-mini`

## Instructions for the AI

### System Prompt Optimization

Ensure the system message is defined as a constant at the top of the API route to prevent redundancy.

### Context Chunking

Modify the API call to only transmit the active job description and the specific resume section being edited. Do **not** send the full resume object.

### Output Constraint

Force the model to output only the JSON object or the raw string of the bullet points. Use the following system prompt logic:

```
You are an ATS expert. Rewrite the provided bullet point to align with these keywords: {keywords}.
Rules:
1. No copy-pasting from JD.
2. Use active, metric-driven language.
3. Output format: Plain text only, no conversational filler, max 2 sentences.
```

### Token Management

Implement logic to strip any leading/trailing whitespace or conversational markers (`"Sure, here is your..."`) from the API response before updating the UI state.

### ATS Compliance

Ensure the `Location: Edmonton, AB` context is naturally woven into the professional summary if applicable.
