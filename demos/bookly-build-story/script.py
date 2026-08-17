from __future__ import annotations

import os
import sys
from pathlib import Path

from manim import *


ROOT = Path(__file__).resolve().parent
SKILL_ASSETS = Path.home() / ".codex" / "skills" / "demo-builder" / "assets"
os.environ.setdefault("DEMO_TIMELINE_PATH", str(ROOT / "timeline.json"))
os.environ.setdefault("STORYBOARD_SYNC_DIR", str(ROOT / "sync-events"))
sys.path.insert(0, str(SKILL_ASSETS))

from cue_timeline import CueClock  # noqa: E402
from decagon_manim_helpers import (  # noqa: E402
    BG,
    CYAN,
    CYAN_BRIGHT,
    FONT,
    GREY,
    INDIGO,
    INDIGO_DARK,
    INDIGO_SOFT,
    INK,
    INK_SOFT,
    MUTED,
    ORANGE,
    VIOLET,
    WHITE,
    assert_safe_area,
    brand_backdrop,
    brand_text,
    fit_to_box,
    label_card,
    orthogonal_connector,
    pill,
    process_rail,
    wrapped_text,
)


LOGO_REVERSED = Path.home() / ".codex" / "skills" / "decagon-branding" / "assets" / "logos" / "decagon-logo-reversed.svg"
PRODUCT_ASSETS = ROOT / "assets" / "product"


def stage(scene: Scene, number: str, kicker: str, title: str, subtitle: str | None = None) -> VGroup:
    brand_backdrop(scene, density=10, show_prism=True)
    index = pill(number, INDIGO, 14).scale(0.82)
    kick = brand_text(kicker.upper(), 15, INDIGO_SOFT, BOLD)
    heading = wrapped_text(title, 48, 34, WHITE, max_width=10.7, max_height=0.85, weight=BOLD)
    heading.set_color_by_gradient(WHITE, INDIGO_SOFT)
    text_parts: list[Mobject] = [kick, heading]
    if subtitle:
        text_parts.append(wrapped_text(subtitle, 76, 15, MUTED, max_width=10.6, max_height=0.48))
    copy = VGroup(*text_parts).arrange(DOWN, aligned_edge=LEFT, buff=0.08)
    header = VGroup(index, copy).arrange(RIGHT, buff=0.22, aligned_edge=UP)
    header.to_edge(UP, buff=0.30).to_edge(LEFT, buff=0.50)

    logo = SVGMobject(str(LOGO_REVERSED)).set_height(0.28)
    logo.to_edge(UP, buff=0.38).to_edge(RIGHT, buff=0.52)
    scene.add(header, logo)
    return VGroup(header, logo)


def outcome_ribbon(left: str, right: str) -> VGroup:
    left_box = RoundedRectangle(width=5.6, height=0.62, corner_radius=0.14, fill_color=INDIGO, fill_opacity=0.92, stroke_width=0)
    right_box = RoundedRectangle(width=5.6, height=0.62, corner_radius=0.14, fill_color=INK, fill_opacity=1, stroke_color=GREY, stroke_width=1.4)
    left_text = brand_text(left, 18, WHITE, BOLD).move_to(left_box)
    right_text = brand_text(right, 18, WHITE, BOLD).move_to(right_box)
    return VGroup(VGroup(left_box, left_text), VGroup(right_box, right_text)).arrange(RIGHT, buff=0.14)


def metric_card(name: str, metric: str, detail: str, accent: str = INDIGO, width: float = 5.4) -> VGroup:
    shell = RoundedRectangle(width=width, height=3.25, corner_radius=0.22, fill_color=WHITE, fill_opacity=1, stroke_color=accent, stroke_width=3)
    name_mob = brand_text(name.upper(), 16, INK_SOFT, BOLD)
    metric_mob = brand_text(metric, 50, accent, BOLD)
    fit_to_box(metric_mob, width - 0.55, 0.90)
    detail_mob = brand_text(detail, 16, INK_SOFT)
    fit_to_box(detail_mob, width - 0.55, 0.72)
    body = VGroup(name_mob, metric_mob, detail_mob).arrange(DOWN, buff=0.18)
    body.move_to(shell)
    return VGroup(shell, body)


def product_frame(filename: str, width: float, label: str | None = None) -> VGroup:
    image = ImageMobject(str(PRODUCT_ASSETS / filename)).set_width(width)
    border = SurroundingRectangle(image, color=GREY, stroke_width=1.8, buff=0.04)
    group: list[Mobject] = [image, border]
    if label:
        badge = pill(label.upper(), INDIGO, 13).scale(0.86)
        badge.next_to(border, UP, buff=0.10).align_to(border, LEFT)
        group.append(badge)
    return Group(*group)


def small_footer(text: str) -> Text:
    footer = brand_text(text, 11, MUTED)
    fit_to_box(footer, 12.2, 0.24)
    footer.to_edge(DOWN, buff=0.48)
    return footer


def flow_arrow(start: Mobject, end: Mobject, color: str = INDIGO) -> Arrow:
    arrow = Arrow(start.get_right(), end.get_left(), buff=0.10, color=color, stroke_width=3, max_tip_length_to_length_ratio=0.12)
    arrow.set_z_index(1)
    return arrow


class Scene01Legacy(Scene):
    def construct(self) -> None:
        stage(self, "01", "Customer problem", "Legacy support makes customers do the routing")
        clock = CueClock(self, "scene01")

        request = label_card("I need help", "Natural customer intent", CYAN, 2.4, 1.0).move_to([-5.0, 0.45, 0])
        root = label_card("CHOOSE A CATEGORY", color=INDIGO, width=2.5, height=0.82).move_to([-2.0, 0.45, 0])
        categories = VGroup(
            label_card("ORDERS", color=GREY, width=1.65, height=0.68),
            label_card("RETURNS", color=GREY, width=1.65, height=0.68),
            label_card("ACCOUNT", color=GREY, width=1.65, height=0.68),
        ).arrange(DOWN, buff=0.32).move_to([1.0, 0.45, 0])
        dead_end = label_card("ISSUE NOT LISTED", "START OVER", ORANGE, 2.35, 1.08).move_to([4.25, 0.45, 0])
        links = VGroup(flow_arrow(request, root), *[flow_arrow(root, item, GREY) for item in categories], flow_arrow(categories[1], dead_end, ORANGE))
        burden = outcome_ribbon("CUSTOMER INTENT", "CUSTOMER DOES THE ROUTING").scale(0.84).move_to([0, -2.58, 0])
        tree = VGroup(request, root, categories, dead_end, links, burden)

        clock.play("S01.C01", "onset", "focus", FadeIn(request, shift=RIGHT * 0.25), FadeIn(root, shift=RIGHT * 0.25), Create(links[0]))
        clock.play("S01.C01", "focus", "land", LaggedStart(FadeIn(categories), Create(VGroup(*links[1:-1])), FadeIn(dead_end), Create(links[-1]), FadeIn(burden), lag_ratio=0.18))
        clock.finish_cue("S01.C01")

        support = label_card("SUPPORT", "Explain here", INDIGO, 4.4, 2.25).move_to([-3.2, 0.25, 0])
        storefront = label_card("STOREFRONT", "Act there", CYAN, 4.4, 2.25).move_to([3.2, 0.25, 0])
        context = pill("ORDER + INTENT + HISTORY", ORANGE, 15).move_to([-3.2, -1.70, 0])
        broken = DashedLine(support.get_right(), storefront.get_left(), color=ORANGE, stroke_width=3, dash_length=0.16)
        handoff = brand_text("CUSTOMER CARRIES THE JOURNEY", 20, ORANGE, BOLD).move_to([0, -2.70, 0])
        split = VGroup(support, storefront, context, broken, handoff)
        clock.play("S01.C02", "onset", "focus", FadeOut(tree, shift=UP * 0.15))
        clock.play("S01.C02", "focus", "land", LaggedStart(FadeIn(support), FadeIn(storefront), Create(broken), context.animate.move_to([3.2, -1.70, 0]), FadeIn(handoff), lag_ratio=0.18))
        clock.finish_cue("S01.C02")
        assert_safe_area({"scene01": split})
        clock.finish_scene()


class Scene02Unified(Scene):
    def construct(self) -> None:
        stage(self, "02", "Bookly opportunity", "One concierge. One continuous journey.", "A proposed future state across support, commerce, and fulfillment")
        clock = CueClock(self, "scene02")

        future = pill("PROPOSED BOOKLY FUTURE STATE", VIOLET, 14).move_to([0, 2.05, 0])
        widget = label_card("BOOKLY CONCIERGE", "One identity · one conversation", INDIGO, 3.6, 1.28).move_to([0, 0.92, 0])
        journey = process_rail(["DISCOVER", "PURCHASE", "ACCOUNT", "FULFILL", "RECOVER", "HUMAN HELP"], [CYAN, INDIGO, VIOLET, CYAN, ORANGE, INDIGO], 1.58)
        journey.scale(0.82).move_to([0, -0.62, 0])
        promise = brand_text("THE CUSTOMER NEVER HAS TO RESTART", 22, WHITE, BOLD).move_to([0, -2.50, 0])
        front = VGroup(future, widget, journey, promise)
        clock.play("S02.C01", "onset", "focus", FadeIn(future), FadeIn(widget, shift=UP * 0.18))
        clock.play("S02.C01", "focus", "land", LaggedStart(FadeIn(journey), FadeIn(promise), lag_ratio=0.30))
        clock.finish_cue("S02.C01")

        identity = label_card("CUSTOMER", "Identity + conversation", INDIGO, 2.55, 1.05).move_to([-4.9, 0.15, 0])
        contexts = VGroup(*[pill(item, CYAN if i % 2 == 0 else VIOLET, 13) for i, item in enumerate(["ORDER", "INVENTORY", "POLICY", "CARRIER", "CASE"])]).arrange(DOWN, buff=0.18).move_to([-1.7, 0.0, 0])
        teams = VGroup(
            label_card("SUPPORT", "Resolve", INDIGO, 2.35, 0.88),
            label_card("COMMERCE", "Convert", VIOLET, 2.35, 0.88),
            label_card("FULFILLMENT", "Deliver", CYAN, 2.35, 0.88),
        ).arrange(DOWN, buff=0.30).move_to([3.8, 0.0, 0])
        team_links = VGroup(*[flow_arrow(contexts, team, INDIGO) for team in teams])
        shared = outcome_ribbon("ONE CUSTOMER CONTEXT", "THREE TEAMS · SHARED STATE").scale(0.83).move_to([0, -2.72, 0])
        back = VGroup(identity, contexts, teams, team_links, shared)
        clock.play("S02.C02", "onset", "focus", FadeOut(front, shift=UP * 0.15))
        clock.play("S02.C02", "focus", "land", LaggedStart(FadeIn(identity), FadeIn(contexts), FadeIn(teams), Create(team_links), FadeIn(shared), lag_ratio=0.14))
        clock.finish_cue("S02.C02")
        assert_safe_area({"scene02": back})
        clock.finish_scene()


class Scene03Proof(Scene):
    def construct(self) -> None:
        stage(self, "03", "Real retail proof", "Customer experience can become commercial value")
        clock = CueClock(self, "scene03")

        flowers = metric_card("1-800-Flowers.com · live retail deployment", "~93% CSAT", "Double-digit point improvement versus previous automation", INDIGO, 6.8).move_to([0, 0.15, 0])
        proof_rail = process_rail(["45-DAY POC", "PEAK SEASON", "EXPANDED"], [CYAN, INDIGO, VIOLET], 2.0).scale(0.86).move_to([0, -2.05, 0])
        source1 = small_footer("SOURCE · DECAGON CUSTOMER STORY · 1-800-FLOWERS.COM")
        first = VGroup(flowers, proof_rail, source1)
        clock.play("S03.C01", "onset", "focus", FadeIn(flowers, shift=UP * 0.18))
        clock.play("S03.C01", "focus", "land", FadeIn(proof_rail), FadeIn(source1))
        clock.finish_cue("S03.C01")

        flowers_target = flowers.copy().scale(0.74).move_to([-3.5, 0.35, 0])
        hunter = metric_card("Hunter Douglas · live retail deployment", "$1M+ REVENUE", "Fully AI-handled conversations", CYAN, 5.25).scale(0.78).move_to([3.25, 0.70, 0])
        aov = pill("85% HIGHER AOV", VIOLET, 20).move_to([3.25, -1.18, 0])
        transfer = outcome_ribbon("PROVEN RETAIL SIGNAL", "BOOKLY VALUE HYPOTHESIS").scale(0.82).move_to([0, -2.47, 0])
        source2 = small_footer("SOURCES · DECAGON CUSTOMER STORIES · 1-800-FLOWERS.COM + HUNTER DOUGLAS GROUP")
        second = VGroup(flowers_target, hunter, aov, transfer, source2)
        clock.play("S03.C02", "onset", "focus", FadeOut(proof_rail), FadeOut(source1), Transform(flowers, flowers_target))
        clock.play("S03.C02", "focus", "land", LaggedStart(FadeIn(hunter), FadeIn(aov), FadeIn(transfer), FadeIn(source2), lag_ratio=0.20))
        clock.finish_cue("S03.C02")
        assert_safe_area({"scene03": second})
        clock.finish_scene()


class Scene04Experience(Scene):
    def construct(self) -> None:
        stage(self, "04", "Show the experience", "Conversation becomes visible action")
        clock = CueClock(self, "scene04")

        shot = product_frame("product-detail.png", 8.25, "Actual Bookly demo").move_to([-1.55, -0.20, 0])
        capabilities = VGroup(
            pill("TEXT + VOICE", INDIGO, 14),
            pill("LIVE TRANSCRIPT", CYAN, 14),
            pill("TURN DETECTION", VIOLET, 14),
            pill("NATURAL INTERRUPTION", ORANGE, 14),
        ).arrange(DOWN, buff=0.24, aligned_edge=LEFT).move_to([5.05, -0.05, 0])
        live = Group(shot, capabilities)
        clock.play("S04.C01", "onset", "focus", FadeIn(shot, shift=UP * 0.12))
        clock.play("S04.C01", "focus", "land", LaggedStart(*[FadeIn(item, shift=LEFT * 0.10) for item in capabilities], lag_ratio=0.18))
        clock.finish_cue("S04.C01")

        cart = product_frame("product-cart.png", 6.3, "Visible storefront action").move_to([-3.0, 0.10, 0])
        rail = process_rail(["DISCOVER", "CHOOSE", "BUY", "TRACK", "RESOLVE", "HANDOFF"], [CYAN, INDIGO, VIOLET, CYAN, ORANGE, INDIGO], 1.46).scale(0.57).move_to([3.15, -1.45, 0])
        fixed = label_card("ONE CONVERSATION", "Product state changes around it", INDIGO, 4.6, 1.15).move_to([3.15, 0.58, 0])
        visible = Group(cart, rail, fixed)
        clock.play("S04.C02", "onset", "focus", FadeOut(shot, shift=LEFT * 0.16), FadeOut(capabilities, shift=LEFT * 0.16))
        clock.play("S04.C02", "focus", "land", LaggedStart(FadeIn(cart), FadeIn(fixed), FadeIn(rail), lag_ratio=0.22))
        clock.finish_cue("S04.C02")
        assert_safe_area({"scene04": visible})
        clock.finish_scene()


class Scene05Control(Scene):
    def construct(self) -> None:
        stage(self, "05", "Why control matters", "Plausible is not the same as verified")
        clock = CueClock(self, "scene05")

        intent = label_card("NATURAL INTENT", "“Where is my order?”", INDIGO, 3.0, 1.30).move_to([-4.55, 0.55, 0])
        gateway = label_card("TYPED TOOL", "Validate + constrain", VIOLET, 2.45, 1.25).move_to([0, 0.55, 0])
        truth = label_card("BOOKLY SOURCE OF TRUTH", "Authoritative state", CYAN, 3.25, 1.30).move_to([4.45, 0.55, 0])
        link1 = flow_arrow(intent, gateway, INDIGO)
        link2 = flow_arrow(gateway, truth, CYAN)
        facts = VGroup(*[pill(item, ORANGE if item == "ACTION" else GREY, 13) for item in ["PRICE", "ORDER STATUS", "ELIGIBILITY", "ACTION"]]).arrange(RIGHT, buff=0.25).move_to([0, -1.20, 0])
        warning = brand_text("A FLUENT ANSWER IS NOT ENOUGH", 23, ORANGE, BOLD).move_to([0, -2.45, 0])
        split = VGroup(intent, gateway, truth, link1, link2, facts, warning)
        clock.play("S05.C01", "onset", "focus", LaggedStart(FadeIn(intent), Create(link1), FadeIn(gateway), lag_ratio=0.22))
        clock.play("S05.C01", "focus", "land", LaggedStart(Create(link2), FadeIn(truth), FadeIn(facts), FadeIn(warning), lag_ratio=0.18))
        clock.finish_cue("S05.C01")

        model = label_card("MODEL", "Dialogue + tool choice", INDIGO, 2.05, 1.0)
        tools = label_card("29 TYPED TOOLS", "Validated contracts", VIOLET, 2.35, 1.0)
        data = label_card("LANCEDB + SQLITE", "Retrieval + state", CYAN, 2.35, 1.0)
        trace = label_card("VISIBLE TRACE", "Input · output · latency", ORANGE, 2.35, 1.0)
        architecture = VGroup(model, tools, data, trace).arrange(RIGHT, buff=0.55).move_to([0, 0.40, 0])
        connectors = VGroup(*[flow_arrow(a, b, INDIGO) for a, b in zip(architecture[:-1], architecture[1:])])
        controls = VGroup(*[pill(item, CYAN if i % 2 == 0 else VIOLET, 13) for i, item in enumerate(["VERIFIED IDENTITY", "TRANSACTIONS", "SERVER REVALIDATION", "AUDIT TRAIL"])]).arrange(RIGHT, buff=0.25).move_to([0, -1.25, 0])
        ribbon = outcome_ribbon("NATURAL FOR THE CUSTOMER", "CONTROLLED + AUDITABLE FOR BOOKLY").scale(0.88).move_to([0, -2.52, 0])
        control = VGroup(architecture, connectors, controls, ribbon)
        clock.play("S05.C02", "onset", "focus", FadeOut(split, shift=UP * 0.12), FadeIn(architecture))
        clock.play("S05.C02", "focus", "land", LaggedStart(Create(connectors), FadeIn(controls), FadeIn(ribbon), lag_ratio=0.24))
        clock.finish_cue("S05.C02")
        assert_safe_area({"scene05": control})
        clock.finish_scene()


class Scene06Trust(Scene):
    def construct(self) -> None:
        stage(self, "06", "Trust before consequence", "The system slows down exactly where it should")
        clock = CueClock(self, "scene06")

        auth = product_frame("refund-auth.png", 7.8, "Actual browser-owned sign-in").move_to([-1.85, -0.10, 0])
        boundary = VGroup(
            pill("CREDENTIALS STAY IN THE FORM", ORANGE, 14),
            pill("CHAT RECEIVES SESSION STATE", CYAN, 14),
            pill("MODEL NEVER SEES PASSWORD", VIOLET, 14),
        ).arrange(DOWN, buff=0.28, aligned_edge=LEFT).move_to([4.55, -0.05, 0])
        private = Group(auth, boundary)
        clock.play("S06.C01", "onset", "focus", FadeIn(auth, shift=UP * 0.12))
        clock.play("S06.C01", "focus", "land", LaggedStart(*[FadeIn(item, shift=LEFT * 0.10) for item in boundary], lag_ratio=0.20))
        clock.finish_cue("S06.C01")

        result = product_frame("refund-result.png", 5.8, "Verified refund eligibility").move_to([-3.25, 0.05, 0])
        rail = process_rail(["PREPARE", "CONFIRM", "REVALIDATE", "COMMIT"], [CYAN, ORANGE, VIOLET, INDIGO], 1.80).scale(0.82).move_to([2.75, 0.45, 0])
        token = pill("ONE-TIME TOKEN", ORANGE, 15).move_to([2.75, -0.65, 0])
        guarantee = label_card("NO SILENT CONSEQUENCES", "Customer approval before commit", INDIGO, 5.35, 1.08).move_to([2.75, -1.85, 0])
        guarded = Group(result, rail, token, guarantee)
        clock.play("S06.C02", "onset", "focus", FadeOut(private, shift=LEFT * 0.12), FadeIn(result))
        clock.play("S06.C02", "focus", "land", LaggedStart(FadeIn(rail), FadeIn(token), FadeIn(guarantee), lag_ratio=0.24))
        clock.finish_cue("S06.C02")
        assert_safe_area({"scene06": guarded})
        clock.finish_scene()


class Scene07Journeys(Scene):
    def construct(self) -> None:
        stage(self, "07", "One conversation", "Six journeys without losing context")
        clock = CueClock(self, "scene07")

        center = label_card("BOOKLY CONVERSATION", "Persistent customer context", INDIGO, 3.25, 1.20).move_to([0, 0.10, 0])
        names = ["DISCOVERY", "SHOPPING", "ACCOUNT HELP", "DELIVERY", "RETURNS", "HUMAN HANDOFF"]
        positions = [(-4.4, 1.45), (0, 1.80), (4.4, 1.45), (4.4, -1.35), (0, -1.80), (-4.4, -1.35)]
        tiles = VGroup(*[label_card(name, color=[CYAN, INDIGO, VIOLET, CYAN, ORANGE, INDIGO][i], width=2.2, height=0.80).move_to([*positions[i], 0]) for i, name in enumerate(names)])
        spokes = VGroup(*[Line(center.get_center(), tile.get_center(), color=INK_SOFT, stroke_width=2).set_z_index(1) for tile in tiles])
        token = pill("IDENTITY + HISTORY", CYAN, 14).move_to([0, -2.82, 0])
        orbit = VGroup(center, tiles, spokes, token)
        clock.play("S07.C01", "onset", "focus", FadeIn(center), FadeIn(token))
        clock.play("S07.C01", "focus", "land", LaggedStart(Create(spokes), *[FadeIn(tile) for tile in tiles], lag_ratio=0.12))
        clock.finish_cue("S07.C01")

        rail = process_rail(names, [CYAN, INDIGO, VIOLET, CYAN, ORANGE, INDIGO], 1.65).scale(0.80).move_to([0, 0.75, 0])
        server = VGroup(*[pill(item, INDIGO if i % 2 == 0 else CYAN, 14) for i, item in enumerate(["OWNERSHIP", "POLICY", "STATE", "AUDIT"])]).arrange(RIGHT, buff=0.40).move_to([0, -1.00, 0])
        line = Line([-5.4, -2.12, 0], [5.4, -2.12, 0], color=INDIGO, stroke_width=7)
        continuity = brand_text("ONE UNINTERRUPTED CUSTOMER CONTEXT", 22, WHITE, BOLD).move_to([0, -2.64, 0])
        continuous = VGroup(rail, server, line, continuity)
        clock.play("S07.C02", "onset", "focus", FadeOut(orbit, shift=UP * 0.15))
        clock.play("S07.C02", "focus", "land", LaggedStart(FadeIn(rail), FadeIn(server), Create(line), FadeIn(continuity), lag_ratio=0.22))
        clock.finish_cue("S07.C02")
        assert_safe_area({"scene07": continuous})
        clock.finish_scene()


class Scene08Impact(Scene):
    def construct(self) -> None:
        stage(self, "08", "Customer impact", "The burden moves off the customer")
        clock = CueClock(self, "scene08")

        before_customer = Circle(radius=0.58, fill_color=ORANGE, fill_opacity=0.18, stroke_color=ORANGE, stroke_width=3).move_to([-4.6, 0.55, 0])
        before_label = brand_text("CUSTOMER", 15, WHITE, BOLD).move_to(before_customer)
        burdens = VGroup(*[pill(item, ORANGE, 12) for item in ["MENU HUNTING", "REPEAT CONTEXT", "SWITCH CHANNELS"]]).arrange(DOWN, buff=0.24).move_to([-2.35, 0.55, 0])
        before = VGroup(before_customer, before_label, burdens)
        widget = label_card("ONE BOOKLY WIDGET", "Intent → visible action", INDIGO, 3.25, 1.28).move_to([3.55, 0.55, 0])
        natural = pill("SPEAK NATURALLY", CYAN, 14).move_to([0.55, 0.55, 0])
        path = VGroup(flow_arrow(burdens, natural, GREY), flow_arrow(natural, widget, INDIGO))
        shift_label = outcome_ribbon("BEFORE · CUSTOMER CARRIES THE WORK", "AFTER · BOOKLY CARRIES THE CONTEXT").scale(0.82).move_to([0, -2.38, 0])
        transformed = VGroup(before, natural, widget, path, shift_label)
        clock.play("S08.C01", "onset", "focus", LaggedStart(FadeIn(before_customer), FadeIn(before_label), FadeIn(burdens), lag_ratio=0.18))
        clock.play("S08.C01", "focus", "land", LaggedStart(Create(path[0]), FadeIn(natural), Create(path[1]), FadeIn(widget), FadeIn(shift_label), lag_ratio=0.18))
        clock.finish_cue("S08.C01")

        cards = VGroup(
            label_card("LESS EFFORT", "No menu hunting", CYAN, 3.35, 1.55),
            label_card("FASTER RESOLUTION", "Answer + action together", INDIGO, 3.35, 1.55),
            label_card("MORE CONFIDENCE", "Visible change + approval", ORANGE, 3.35, 1.55),
        ).arrange(RIGHT, buff=0.52).move_to([0, 0.30, 0])
        proof = outcome_ribbon("CONTEXT STAYS INTACT", "CUSTOMER STAYS IN CONTROL").scale(0.88).move_to([0, -1.75, 0])
        impact = VGroup(cards, proof)
        clock.play("S08.C02", "onset", "focus", FadeOut(transformed, shift=UP * 0.15))
        clock.play("S08.C02", "focus", "land", LaggedStart(*[FadeIn(card, shift=UP * 0.12) for card in cards], FadeIn(proof), lag_ratio=0.22))
        clock.finish_cue("S08.C02")
        assert_safe_area({"scene08": impact})
        clock.finish_scene()


class Scene09BooklyImpact(Scene):
    def construct(self) -> None:
        stage(self, "09", "Impact for Bookly", "Turn support into a continuous growth surface")
        clock = CueClock(self, "scene09")

        lifecycle = process_rail(["DISCOVER", "BUY", "FULFILL", "SUPPORT", "RETAIN"], [CYAN, INDIGO, VIOLET, ORANGE, INDIGO], 1.82).scale(1.0).move_to([0, 0.82, 0])
        outcomes = VGroup(
            pill("RESOLVE THE ISSUE", CYAN, 16),
            pill("PROTECT THE SALE", ORANGE, 16),
            pill("ADVANCE THE RELATIONSHIP", VIOLET, 16),
        ).arrange(RIGHT, buff=0.40).move_to([0, -1.10, 0])
        customer = label_card("CUSTOMER", "At the center of every journey", INDIGO, 3.55, 1.05).move_to([0, -2.30, 0])
        lifecycle_group = VGroup(lifecycle, outcomes, customer)
        clock.play("S09.C01", "onset", "focus", FadeIn(lifecycle, shift=UP * 0.12))
        clock.play("S09.C01", "focus", "land", LaggedStart(*[FadeIn(item) for item in outcomes], FadeIn(customer), lag_ratio=0.22))
        clock.finish_cue("S09.C01")

        rollout = process_rail(["PROVE", "CONNECT", "MEASURE", "EXPAND"], [CYAN, INDIGO, VIOLET, ORANGE], 2.10).scale(1.04).move_to([0, 1.05, 0])
        measures = VGroup(*[pill(item, INDIGO if i % 2 == 0 else CYAN, 15) for i, item in enumerate(["CSAT", "RESOLUTION TIME", "ASSISTED CONVERSION", "REPEAT PURCHASE"])]).arrange(RIGHT, buff=0.32).move_to([0, -0.65, 0])
        final_line = brand_text("ONE CUSTOMER · ONE CONVERSATION · ONE BOOKLY EXPERIENCE", 25, WHITE, BOLD)
        fit_to_box(final_line, 11.8, 0.60)
        final_line.move_to([0, -2.00, 0])
        close_logo = SVGMobject(str(LOGO_REVERSED)).set_height(0.48).move_to([0, -2.72, 0])
        close = VGroup(rollout, measures, final_line, close_logo)
        clock.play("S09.C02", "onset", "focus", FadeOut(lifecycle_group, shift=UP * 0.12))
        clock.play("S09.C02", "focus", "land", LaggedStart(FadeIn(rollout), FadeIn(measures), FadeIn(final_line), FadeIn(close_logo), lag_ratio=0.22))
        clock.finish_cue("S09.C02")
        assert_safe_area({"scene09": close})
        clock.finish_scene()
