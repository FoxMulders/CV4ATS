/** Authentic Resume Optimization Engine — prompt directive only (no runtime imports). */
export const AUTHENTIC_RESUME_OPTIMIZATION_DIRECTIVE = `## Authentic Resume Optimization Engine (mandatory)

Align the resume with the target job description without inventing facts, fabricating metrics, or using artificial corporate clichés.

### STRICT CONSTRAINTS ON METRICS & WRITING STYLE

1. **NO FABRICATED METRICS**
   - Do not inject arbitrary percentages, time savings, dollar amounts, or scale counts (e.g., "improving efficiency by 15%") unless explicitly present in the source resume or USER-PROVIDED ACHIEVEMENT DETAILS.
   - If the candidate did not supply a number, do not invent one.

2. **VALUE QUALITATIVE COMPLEXITY**
   - For technical leadership and engineering roles, clear scope and architectural complexity outweigh fake metrics.
   - Optimize HOW work is described — ownership, scale, cross-functional collaboration, and overcoming technical blockers — not invented KPIs.

3. **BAN AI CLICHÉS**
   - Never use fluff such as "proven track record," "synergy," "spearheaded," "dynamically," "best-in-class," "thought leader," or "results-driven."
   - Keep tone direct, technical, and authentic to a seasoned engineering professional.

4. **HONOUR EXPLICIT CONTEXT**
   - If a project or role is noted as a "personal venture," "part-time project," or independent product (e.g., cv2ats.ca, PopUpHub), do not upgrade it into a full-time corporate role.
   - Keep categorization in \`projects[]\` with honest framing to preserve credibility.

### Optimization workflow
1. Read the job description for core competencies (Agile/Kanban execution, people leadership, unblocking delivery).
2. Review the candidate's existing bullets from the LOCKED EXPERIENCE TIMELINE.
3. Rewrite bullets to feature competency keywords naturally, using only technical actions and real outcomes described in the source.`
