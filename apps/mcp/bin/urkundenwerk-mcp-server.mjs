#!/usr/bin/env node
// Starts the Urkundenwerk MCP server over stdio. The workspace packages ship
// TypeScript sources, so tsx loads them. Diagnostics go to stderr only;
// stdout carries the MCP protocol.
import { register } from "tsx/esm/api";

register();
await import("../src/index.ts");
