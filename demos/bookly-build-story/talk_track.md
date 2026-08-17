# Bookly Build Story — Talk Track and Keyframe Review

## Visual system

- 16:9 Decagon-branded film with Near Black and white stages
- Indigo carries the main causal path; violet, cyan, and orange appear only at focus events
- FK Grotesk Neue where available, with Arial as the render-safe fallback
- Exact Decagon logo geometry; no recreated wordmark
- Product evidence and diagrams stay legible at 1920×1080

## Scene 1 — The legacy support problem

**Question:** What is broken about legacy decision-tree support?

### Keyframe 1A — Decision-tree friction (`S01.C01`)

**Narration:** Legacy decision-tree chat asks customers to think like the menu: choose a category, follow a branch, repeat the context, and start over when the issue does not fit.

**Frame:** Near Black stage. A customer request enters a rigid platinum decision tree labeled with generic categories such as `ORDERS`, `RETURNS`, and `ACCOUNT`. The request reaches an orange dead end labeled `ISSUE NOT LISTED`, while a small context card resets to blank. The customer—not the system—is visibly doing the routing work.

**Transition:** The customer backs out, the branches multiply, and fragments of repeated context accumulate around the tree before the structure breaks into disconnected panels.

### Keyframe 1B — Fragmented journey (`S01.C02`)

**Narration:** The friction gets worse when support and shopping live in separate surfaces—one interface explains, another acts, and the customer carries the journey between them.

**Frame:** Two separated panels: `SUPPORT — EXPLAIN HERE` and `STOREFRONT — ACT THERE`. A customer icon drags the same intent and context cards across the gap. A thin broken route emphasizes channel switching, repetition, and loss of momentum.

**Approval check:** Does this opening make the customer burden immediately recognizable without overstating the limitations of every legacy chatbot?

## Scene 2 — The unified Bookly opportunity

**Question:** What could a unified Bookly widget connect?

### Keyframe 2A — Unified concierge widget (`S02.C01`)

**Narration:** For Bookly, the opportunity is bigger than replacing a legacy chatbot. A unified concierge widget can connect discovery, purchase, account service, fulfillment, recovery, and human help in one customer journey.

**Frame:** The disconnected support and storefront panels from Scene 1 converge around one Bookly concierge widget. A single indigo route passes through `DISCOVER → PURCHASE → ACCOUNT → FULFILL → RECOVER → HUMAN HELP`. A persistent label reads `PROPOSED BOOKLY FUTURE STATE`, making clear that the full unified experience is the opportunity being pitched rather than a completed production deployment.

**Transition:** The customer-facing journey holds in the foreground while the frame pulls back to reveal the teams and operational context required behind it.

### Keyframe 2B — Shared customer and operating context (`S02.C02`)

**Narration:** One identity and one conversation carry context across Bookly, while support, commerce, and fulfillment teams work from shared order, inventory, policy, carrier, and case data.

**Frame:** The customer and widget remain fixed at center. Five server-owned context cards—`ORDER`, `INVENTORY`, `POLICY`, `CARRIER`, and `CASE`—feed three aligned Bookly team lanes: support, commerce, and fulfillment. The composition emphasizes coordinated access to context without implying that one new database has already replaced every Bookly system.

**Approval check:** Does this establish the unified-app opportunity early enough, and are these the right operational domains for Bookly?

## Scene 3 — Real retail proof

**Question:** Where is this support-to-commerce model already producing measurable results?

### Keyframe 3A — Real CSAT proof (`S03.C01`)

**Narration:** This opportunity is already showing up in retail. In a live proof of concept through peak season, 1-800-Flowers.com reached nearly ninety-three percent CSAT—double-digit points above its previous automation.

**Frame:** White executive evidence card headed `1-800-FLOWERS.COM · LIVE RETAIL DEPLOYMENT`. A large `~93% CSAT` anchors the frame, with a smaller line reading `DOUBLE-DIGIT POINT IMPROVEMENT VS. PREVIOUS AUTOMATION`. A compact proof rail shows `45-DAY LIVE POC → PEAK SEASON → EXPANDED DEPLOYMENT`. Use the company name as text; do not recreate or modify its logo. A readable source footer remains on screen.

**Source:** [Decagon customer story: 1-800-Flowers.com](https://workos-pilot.decagon.ai/case-studies/1-800-flowers)

**Transition:** The CSAT evidence card shifts left while a second retail deployment card enters from the right, preserving the visual relationship between customer experience and commercial value.

### Keyframe 3B — Real revenue proof (`S03.C02`)

**Narration:** Hunter Douglas reports more than one million dollars in revenue from conversations handled entirely by AI, with average order value eighty-five percent higher among customers who engaged with the agent. For Bookly, that is the value hypothesis: improve service and help more customers complete the purchase.

**Frame:** A matched card headed `HUNTER DOUGLAS · LIVE RETAIL DEPLOYMENT` presents `$1M+ AI-HANDLED REVENUE` and `85% HIGHER AOV`. Beneath both customer cards, an indigo transfer line points to Bookly: `PROVEN RETAIL SIGNAL → BOOKLY VALUE HYPOTHESIS`. A source footer identifies the published customer story. The frame does not imply these results are guaranteed or directly transferable to Bookly.

**Source:** [Decagon customer story: Hunter Douglas Group](https://decagon.ai/case-studies/hunter-douglas)

**Approval check:** Do these two real retail deployments provide the right balance of customer-experience and commercial proof before the Bookly demo begins?

## Scene 4 — Show the working experience

**Question:** What does the working experience look like?

### Keyframe 4A — Realtime concierge (`S04.C01`)

**Narration:** Now let’s show how that future state starts to work. Today, we turned the value proposition into a working realtime concierge with text, voice, live transcripts, semantic turn detection, and natural interruption.

**Frame:** A short indigo title beat reads `SHOW THE EXPERIENCE`, then yields to a dark product stage. A cyan waveform becomes a live transcript inside the Bookly widget. Semantic turn status moves from `LISTENING` to `TURN COMPLETE`; a second customer waveform cleanly interrupts an in-progress response. The storefront remains visible behind the widget.

**Transition:** The transcript contracts into a customer request and becomes the starting point of a continuous journey rail.

### Keyframe 4B — Visible journeys (`S04.C02`)

**Narration:** One conversation can open an exact book, select a format, update the cart, begin checkout, investigate delivery, resolve a return, or reach a person.

**Frame:** Indigo journey rail: `DISCOVER → CHOOSE → BUY → TRACK → RESOLVE → HANDOFF`. Above each stage, the corresponding Bookly UI state appears. The conversation remains visually fixed while the surrounding product state changes.

**Approval check:** Should this rail feature the existing “A Glass Horizon” journey first, then fan into service use cases, or remain representative throughout?

## Scene 5 — Conversation with control

**Question:** Why is the separation between conversation and the system of record essential?

### Keyframe 5A — Control-surface split (`S05.C01`)

**Narration:** Conversation is the control surface, but it is never the system of record. That separation matters because a fluent answer is not enough: every price, order status, eligibility decision, and action must match Bookly's actual data.

**Frame:** White stage split by a precise vertical rule. Left: an indigo conversation bubble labeled `NATURAL INTENT`. Right: a Near Black system card labeled `BOOKLY SOURCE OF TRUTH`. Four facts—`PRICE`, `ORDER STATUS`, `ELIGIBILITY`, and `ACTION`—cannot cross directly from the conversation; they must pass through a narrow typed-tool gateway. A large but restrained line reads `PLAUSIBLE IS NOT THE SAME AS VERIFIED`.

**Transition:** The customer's request crosses the typed-tool gateway as intent. Bookly's systems return verified state and permitted actions; only then does the response travel back to the conversation. The visual makes the risk reduction causal rather than decorative.

### Keyframe 5B — Deterministic control (`S05.C02`)

**Narration:** The model handles dialogue and tool choice, while twenty-nine typed tools, verified identity, LanceDB retrieval, SQLite state, transactions, and visible traces own truth and consequences. Bookly gets both sides of the experience: natural for the customer, deterministic and auditable for the business.

**Frame:** Large `29` anchors a compact four-lane architecture: `MODEL`, `TYPED TOOL ROUTER`, `LANCEDB + SQLITE`, and `TRACE`. Representative tool clusters sit behind the router. A trace card expands to reveal status, latency, input, and output. The scene lands on a two-sided outcome ribbon: `NATURAL FOR THE CUSTOMER` on indigo and `CONTROLLED + AUDITABLE FOR BOOKLY` on Near Black.

**Approval check:** Does this make the business importance clear—protecting customer trust, preventing unsupported actions, and giving Bookly an auditable path to production—without becoming too technical?

## Scene 6 — Trust before consequence

**Question:** How are identity and consequential actions protected?

### Keyframe 6A — Private identity (`S06.C01`)

**Narration:** For private or consequential actions, the system slows down on purpose. Sign-in happens in a browser-owned form, outside the model conversation.

**Frame:** A chat lane sits on the left. A private sign-in form slides into a separate browser-owned lane on the right. Password dots remain entirely inside that lane. A clear boundary label reads `CREDENTIALS NEVER ENTER CHAT`.

**Transition:** Successful identity becomes a signed-session token that moves into the server lane; the form fades without sending credentials through the chat lane.

### Keyframe 6B — Guarded commit rail (`S06.C02`)

**Narration:** Refunds, replacements, order changes, and shipping investigations follow one pattern: prepare, confirm, revalidate, and commit with a one-time token.

**Frame:** Four fixed cards in one rail: `PREPARE → CONFIRM → REVALIDATE → COMMIT`. The one-time token is visible only between the server-owned steps. Orange appears only on the confirmation moment; indigo resumes for the validated commit.

**Approval check:** Should the example be a refund, a missing-package investigation, or remain abstract across all guarded actions?

## Scene 7 — One conversation, six journeys

**Question:** How does the customer retain continuity across the journey?

### Keyframe 7A — Six journeys (`S07.C01`)

**Narration:** A customer can move from discovery to shopping, account help, delivery recovery, returns and refunds, and human escalation without restarting or losing context.

**Frame:** Six clean tiles orbit a central `BOOKLY CONVERSATION` card. A persistent customer-context token remains attached as the active path moves between discovery, shopping, account help, delivery, returns, and handoff. The composition is spacious; no tile includes paragraph copy.

**Transition:** The six tiles unwrap into a left-to-right sequence, preserving their identity and relative order.

### Keyframe 7B — Continuity line (`S07.C02`)

**Narration:** The interface stays continuous while server controls preserve ownership, policy, state, and a durable audit trail.

**Frame:** One uninterrupted indigo route runs through all six journeys. Below it, four stable server rails—`OWNERSHIP`, `POLICY`, `STATE`, and `AUDIT`—remain fixed while the customer path advances.

**Approval check:** Does the six-journey framing tell the right breadth story, or should checkout become its own seventh tile?

## Scene 8 — What the customer experiences

**Question:** What changes for the customer after seeing the solution?

### Keyframe 8A — The burden moves off the customer (`S08.C01`)

**Narration:** What we just saw removes the burden from the customer. They can speak naturally, discover the right book, take action, and see Bookly respond without leaving the conversation.

**Frame:** The demo journey condenses into a simple customer-centered before and after. On the left, the customer carries menu choices, repeated context, and channel switching. On the right, those burdens move behind one Bookly widget while the customer follows a single indigo path from intent to visible action.

**Transition:** The completed path settles and resolves into three customer-impact pillars.

### Keyframe 8B — Customer impact (`S08.C02`)

**Narration:** The impact is less effort, faster resolution, and more confidence: context stays intact, actions are visible, and consequential steps remain under customer control.

**Frame:** Three large cards: `LESS EFFORT — no menu hunting`, `FASTER RESOLUTION — answer and action together`, and `MORE CONFIDENCE — visible changes and explicit approval`. Indigo anchors faster resolution; cyan supports effort reduction; orange appears only on the customer-approval moment.

**Approval check:** Are these the strongest customer outcomes to carry from the demo into the close?

## Scene 9 — The impact for Bookly

**Question:** What is the measurable impact and rollout path for Bookly?

### Keyframe 9A — Resolve, protect, and advance (`S09.C01`)

**Narration:** That is the impact of the solution: support stops being a disconnected destination and becomes part of a continuous customer and fulfillment journey—one that can resolve the issue, protect the sale, and advance the relationship.

**Frame:** A continuous Bookly lifecycle—`DISCOVER → BUY → FULFILL → SUPPORT → RETAIN`—wraps around the customer. Three outcome labels land on the path: `RESOLVE THE ISSUE`, `PROTECT THE SALE`, and `ADVANCE THE RELATIONSHIP`. The earlier disconnected support endpoint fades from view.

**Transition:** The lifecycle remains anchored while a four-step rollout and measurement rail builds beneath it.

### Keyframe 9B — Prove and expand the value (`S09.C02`)

**Narration:** Bookly can start with the journeys demonstrated here, connect production systems, then measure CSAT, resolution time, assisted conversion, and repeat purchase to prove and expand the value.

**Frame:** Four concise stages—`PROVE → CONNECT → MEASURE → EXPAND`—sit above four outcome measures: `CSAT`, `RESOLUTION TIME`, `ASSISTED CONVERSION`, and `REPEAT PURCHASE`. The final line reads `ONE CUSTOMER · ONE CONVERSATION · ONE BOOKLY EXPERIENCE`. Keep the Decagon logo separate in the upper-right clear-space zone; do not create an unapproved co-brand lockup.

**Approval check:** Does this close leave Bookly with both a clear customer promise and a credible path to proving the business impact?
