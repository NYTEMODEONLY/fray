#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function run(command, allowFailure = false) {
    try {
        return execSync(command, {
            cwd: process.cwd(),
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }).trim();
    } catch (error) {
        if (allowFailure) {
            return "";
        }

        const stderr = error.stderr?.toString?.() ?? "";
        if (stderr) {
            process.stderr.write(stderr);
        }
        throw error;
    }
}

function loadAllowlist(allowlistPath) {
    if (!existsSync(allowlistPath)) {
        throw new Error(`Allowlist file is missing: ${allowlistPath}`);
    }

    const content = readFileSync(allowlistPath, "utf8");
    return new Set(
        content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && !line.startsWith("#")),
    );
}

function parseWorkingTreePaths() {
    const unstaged = run("git diff --name-only", true)
        .split("\n")
        .filter(Boolean);
    const staged = run("git diff --name-only --cached", true)
        .split("\n")
        .filter(Boolean);
    const untracked = run("git ls-files --others --exclude-standard", true)
        .split("\n")
        .filter(Boolean);

    return [...new Set([...unstaged, ...staged, ...untracked])];
}

const upstreamRef = process.env.FRAY_UPSTREAM_REF ?? "upstream/develop";
const mergeBase = run(`git merge-base HEAD ${upstreamRef}`, true);

if (!mergeBase) {
    console.error(`[fray] Could not resolve upstream ref '${upstreamRef}'.`);
    console.error("[fray] Run 'git fetch upstream develop' or set FRAY_UPSTREAM_REF to a valid branch/ref.");
    process.exit(2);
}

const committedChanges = run(`git diff --name-only ${mergeBase}...HEAD`, true)
    .split("\n")
    .filter(Boolean);
const workingChanges = parseWorkingTreePaths();

const changedFiles = [...new Set([...committedChanges, ...workingChanges])].sort();

if (!changedFiles.length) {
    console.log(`[fray] No diffs detected versus ${upstreamRef}.`);
    process.exit(0);
}

const allowlistPath = path.resolve(process.cwd(), "fray", "touchpoints.allowlist");
const allowlist = loadAllowlist(allowlistPath);

const allowedPrefixes = [
    "fray/",
    "scripts/fray/",
    "apps/web/src/vector/fray/",
    "apps/web/src/vector/fray-overrides.css",
    "apps/web/config.json",
    "config.json",
    "apps/web/res/themes/element/img/logos/fray-logo.svg",
    "apps/web/res/themes/dark/css/_fray-overrides.pcss",
    "apps/web/res/themes/dark-custom/css/_fray-overrides.pcss",
    "docs/hacks.md",
];

// Patterns to ignore (build artifacts, generated files)
const ignoredPrefixes = [
    "webapp/",
    "node_modules/",
    ".cache/",
    "apps/web/webapp/",
];

const ignoredFiles = new Set([
    "src/modules.js",
    "apps/web/src/modules.js",
]);

function isIgnored(filePath) {
    if (ignoredFiles.has(filePath)) return true;
    return ignoredPrefixes.some((prefix) => filePath.startsWith(prefix));
}

function isAllowed(filePath) {
    if (isIgnored(filePath)) return true;
    if (allowlist.has(filePath)) return true;
    return allowedPrefixes.some((prefix) => filePath === prefix || filePath.startsWith(prefix));
}

const disallowed = changedFiles.filter((filePath) => !isAllowed(filePath));

if (disallowed.length) {
    console.error("[fray] Found customization files outside approved Fray touchpoints:");
    for (const filePath of disallowed) {
        console.error(`  - ${filePath}`);
    }
    console.error("\n[fray] Move new customizations under apps/web/src/vector/fray/ when possible,");
    console.error("[fray] or explicitly document and allowlist an unavoidable direct touchpoint.");
    process.exit(1);
}

console.log(`[fray] Touchpoint verification passed (${changedFiles.length} changed files).`);
