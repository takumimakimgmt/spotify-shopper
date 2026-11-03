# Foundation update — free hosting retained

## 1. Define what matching establishes

Automatic results apply only to the selected XML. The UI and CSV use Matches XML / Not in XML / Not confirmed; individual rows distinguish Needs review from Not checked. Absence from a partial export is never labelled proof of global non-ownership. Existing API owned fields remain compatible; additive library_match evidence carries status, reason and candidate title/artist. Match metadata includes selected_xml scope, library entry count, compared metadata SHA-256, matching time and rules version. Local full snapshots retain this evidence. Older snapshots can lack evidence and require an explicit recheck to populate it.

## 2. Process original XML locally

Original files up to 50 MiB are parsed in the browser, retaining every direct COLLECTION/TRACK entry and copying only Name, Artist, Album, ISRC. Paths, cues, playlists and original filenames are excluded from uploads. Prepared metadata is cached by File object to avoid reparsing the same library for every playlist/batch. Malformed, ambiguous, entity-bearing and excessively complex XML is rejected. Prepared XML still must fit 3 MiB; no entries are silently discarded. The server independently parses and validates every upload. Original XML remains local in IndexedDB until explicitly removed. See REKORDBOX_XML_LIMITS.md.

## 3. Recover interrupted processing without paid workers

The user's explicit choice is to retain free hosting. No server queue or always-on worker has been added. Each completed playlist is saved before being removed from a versioned pending-work record. After closing/reloading, Resume remaining playlists processes pending URLs only. Pending work can be discarded independently of completed results. An interrupted single playlist restarts from its beginning; it does not continue on the server while the page is closed. Saved no-XML batches resume without silently using a subsequently selected XML. XML batches use the currently selected/saved XML and clearly show the earlier filename. Each result keeps its own XML evidence. At most 50 unique URLs are admitted per batch. Unmount cancels outstanding browser requests; server-side cooperative deadlines still bound abandoned work.

## 4. Centralize persistence policy and protect unreadable data

Stable storage keys and history serialization, version migration, size budget and pending-work validation now have dedicated storage modules. Existing keys and v3 history remain compatible; no broad storage wipe or user-data migration is performed. XML blobs stay in IndexedDB; compact history and purchase candidates stay in localStorage, which remains subject to its browser quota. Corrupt/unreadable history blocks automatic overwrite until explicitly cleared. Cross-tab history changes pause saving/processing; purchase-queue changes require reloading saved items before edits. This is conflict detection, not a multi-tab transactional database. Complete atomic multi-tab editing remains future work.

## 5. Separate responsibilities incrementally

History parsing/serialization no longer lives inside the analyzer hook. XML preparation and match presentation are independent modules. Selectors depend on pure matching classification rather than importing the stateful analyzer. The purchase-candidate panel is separate from the page. Backend public transport models are separate from HTTP handlers. Disabled Apple retry branches have been removed from the Spotify-only flow. This is a bounded first refactoring pass; the remaining large API/state files have not been fully rewritten.

## Rollout and validation

Backend evidence fields should deploy first; frontend remains compatible with older responses. No new account, payment, environment variable or secret is needed. No real XML or analysis result is committed. This document does not mean the branches are already deployed. Tests cover scoped evidence, metadata privacy and size rejection, checkpoint-before-pending removal, reload/resume, corruption protection and cross-tab conflicts.

Local verification: 129 frontend tests, 61 backend tests and 5 subtests pass. Typecheck, lint and production build pass. With the supplied original XML, 2,302 library entries remain intact while transferred metadata shrinks from 2,668,069 to 154,249 bytes. The stored 20-track playlist produces identical row-level matching evidence against both files (11 matched, 9 not found). Fine Day Anthem has a second Original Mix candidate whose complete credits match; this corrects the earlier review-only description. The real XML and playlist output stay outside commits.
