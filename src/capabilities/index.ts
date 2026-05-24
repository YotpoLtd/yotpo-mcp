import type { Capability } from "./types.js";
import { helloWorld } from "./hello-world.js";
import { badges } from "./badges.js";

export const capabilities: readonly Capability[] = [helloWorld, badges];

export type { Capability } from "./types.js";
