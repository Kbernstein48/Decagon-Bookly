# Bookly Build Story — Production Plan

## Production status

- Mode: full production authorized
- Format: narrated Manim demo
- Target: 1920×1080, 60 fps, 4:00
- Narration source: Kevin’s supplied `Recording (7).m4a`
- Edit policy: preserve the speaker’s natural delivery; remove only abandoned takes, false starts, and post-take room tone; no time stretching
- Review package: 18 cue frames, 54 event-boundary frames, and complete-video contact sheets

## Audience and purpose

- Primary audience: Bookly executive sponsors and leaders across customer experience, ecommerce, support, and fulfillment
- Secondary audience: Bookly product, engineering, security, and operations teams evaluating feasibility and rollout
- Purpose: deliver a solution-engineering pitch that starts with customer friction, demonstrates a unified conversational journey, and shows how Bookly could modernize support and fulfillment through one connected application

## Narrative thesis

Legacy support makes customers translate natural intent into menu branches, repeat context across disconnected surfaces, and carry the journey themselves. A unified Bookly concierge could connect support, commerce, and fulfillment in one continuous customer journey. The film uses a tell–show–tell structure: establish the opportunity and target outcomes, prove the mechanism through the working demo, then return to customer and business impact.

## Misconception to overturn

The customer problem is not simply that old chatbots sound robotic. Legacy decision trees force customers to understand the company’s categories, restart when a request does not fit, and jump between a support channel and the actual shopping experience.

## Aha moment

The customer no longer has to stitch the journey together. One natural conversation can preserve context, guide discovery, execute visible actions, and introduce deliberate trust gates only when identity or consequence requires them—giving Bookly one experience that can improve service while protecting and growing the customer relationship.

## Causal spine

1. Legacy decision trees make the customer do the routing work.
2. Bookly reframes the widget as one unified entry point across support, commerce, and fulfillment.
3. Two published Decagon retail deployments establish real customer-experience and commercial proof before the Bookly demo begins.
4. The pitch moves from tell to show with a working realtime text-and-voice concierge.
5. A precise control boundary keeps fluent conversation separate from authoritative Bookly data, while 29 typed tools make business actions deterministic and auditable.
6. Private and consequential actions introduce controlled trust gates.
7. One conversation carries context across six customer journeys.
8. The pitch returns to tell: less effort, faster resolution, and more customer confidence.
9. The close connects the demonstrated mechanism to Bookly impact and a measurable rollout path.

## Scene questions

| Scene | Question answered |
|---|---|
| 1 | What is broken about legacy decision-tree support? |
| 2 | What could a unified Bookly widget connect? |
| 3 | Where is this support-to-commerce model already producing measurable results? |
| 4 | What does the working experience look like? |
| 5 | Why is the separation between conversation and the system of record essential? |
| 6 | How are identity and consequential actions protected? |
| 7 | How does the customer retain continuity across the journey? |
| 8 | What changes for the customer after seeing the solution? |
| 9 | What is the measurable impact and rollout path for Bookly? |

## Confirmed facts used in the script

- The repository contains a Next.js Bookly storefront and embedded realtime support agent.
- The agent configuration exposes 29 typed tool schemas.
- The interface supports text, voice, semantic turn detection, live transcripts, and interruption.
- LanceDB holds prefiltered catalog and policy retrieval; SQLite holds commerce and support state.
- Private sign-in occurs in a browser-owned form outside the model conversation.
- Refunds, replacements, order changes, and shipping investigations use explicit confirmation patterns and server revalidation.
- The README presents six connected customer journeys.
- Decagon’s published 1-800-Flowers.com customer story reports that its live pilot closed with CSAT nearing 93%, double-digit points higher than its previous automation.
- Decagon’s published Hunter Douglas customer story reports more than $1 million in revenue from conversations handled fully by AI and 85% higher average order value among customers who interacted with the agent.

## External customer-proof sources

- 1-800-Flowers.com: `https://workos-pilot.decagon.ai/case-studies/1-800-flowers`
- Hunter Douglas Group: `https://decagon.ai/case-studies/hunter-douglas`

## Truth boundaries

- Do not call the demonstrated application production-ready.
- Do not imply production identity or payments: demo sign-in accepts any non-empty password, and payment/refund processing is simulated.
- Do not imply the production sideband Realtime control path is implemented; it is a stated next step.
- Treat “less effort,” “faster progress,” and “more confidence” as qualitative customer-value outcomes, not measured Bookly performance claims.
- Attribute the 1-800-Flowers.com and Hunter Douglas metrics to their respective published Decagon customer stories; do not combine them into one customer’s result.
- Treat those retail results as evidence that the support-to-commerce model can create value, not as a Bookly forecast, commitment, or guarantee.
- Keep a readable source footer on each customer-proof keyframe and do not recreate third-party logos without approved assets.

## Visual grammar

- Canvas: Decagon Near Black `#0A0A0B` with occasional white scenes for contrast
- Anchor: Decagon Indigo `#5754FF`
- Supporting accents: Violet `#D499FE`, Cyan `#40C6F2`, and Orange `#FF6F22`, used one at a time except for brief prismatic transitions
- Neutrals: Platinum `#303036`, `#4E4E56`, `#898994`, `#D4D4D8`, and white
- Type: Arial fallback because FK Grotesk Neue is not installed in the render environment
- Logo: exact bundled Decagon SVG, reversed on dark stages
- Motion: indigo route lines, card-to-system transforms, visible state handoffs, short prismatic sweeps, and clean settled frames
- Product evidence: stills extracted from the working Bookly repository’s recorded product flows

## Audio-locked timing

- Scenes: 9
- Narration cues: 18
- Compiled duration: 240.000 seconds (4:00.0)
- Cue timing: locked to the selected takes from the supplied narration at 60 fps
- Delivery style: confident, consultative solution-engineering pitch addressed directly to Bookly, with an explicit tell–show–tell rhythm and customer impact framing the product proof

## Narration edit decisions

- Removed the Scene 5 false start before the complete control-surface take.
- Removed two abandoned Scene 9 attempts and retained the final complete close.
- Removed post-take room tone.
- Preserved all selected words, cadence, and pauses without time stretching.
