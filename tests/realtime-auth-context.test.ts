import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  BOOKLY_AGENT_INSTRUCTIONS_TEMPLATE,
  booklyAgentInstructions,
} from "../lib/agent-instructions";
import { realtimeSessionConfig } from "../lib/agent";
import {
  AUTHENTICATION_PRECONDITION_METADATA_KEY,
  AUTHENTICATION_PROMPT_MESSAGE,
  authenticationNarrationEvent,
  requiresCustomerAuthentication,
} from "../lib/realtime-auth-precondition";

describe("Realtime authentication context", () => {
  test("exchanges the userloggedin prompt variable for the current browser state", () => {
    assert.match(BOOKLY_AGENT_INSTRUCTIONS_TEMPLATE, /\{\{userloggedin\}\}/);
    assert.match(booklyAgentInstructions(false), /user_logged_in: false/);
    assert.match(booklyAgentInstructions(true), /user_logged_in: true/);
    assert.doesNotMatch(booklyAgentInstructions(false), /\{\{userloggedin\}\}/);
  });

  test("delegates signed-out account actions to the application precondition", () => {
    const instructions = realtimeSessionConfig({ userLoggedIn: false }).instructions;
    assert.match(instructions, /application-enforced precondition on every account tool/i);
    assert.match(instructions, /pauses that exact tool call before execution/i);
    assert.match(instructions, /resumes the same tool call automatically/i);
  });

  test("creates an isolated, tool-free audio response for the sign-in narration", () => {
    const event = authenticationNarrationEvent("auth-request-1", true);
    assert.equal(event.type, "response.create");
    assert.equal(event.response.conversation, "none");
    assert.deepEqual(event.response.input, []);
    assert.deepEqual(event.response.tools, []);
    assert.equal(event.response.tool_choice, "none");
    assert.deepEqual(event.response.output_modalities, ["audio"]);
    assert.equal(event.response.metadata[AUTHENTICATION_PRECONDITION_METADATA_KEY], "auth-request-1");
    assert.match(event.response.instructions, new RegExp(AUTHENTICATION_PROMPT_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("gates account tools but leaves public tools immediately available", () => {
    assert.equal(requiresCustomerAuthentication("lookup_order"), true);
    assert.equal(requiresCustomerAuthentication("begin_checkout"), true);
    assert.equal(requiresCustomerAuthentication("search_catalog"), false);
    assert.equal(requiresCustomerAuthentication("add_to_cart"), false);
  });

  test("lets an authenticated session proceed without sign-in guidance", () => {
    const instructions = realtimeSessionConfig({ userLoggedIn: true }).instructions;
    assert.match(instructions, /user_logged_in: true/);
    assert.match(instructions, /When user_logged_in is true, proceed with the requested account tool/i);
  });
});
