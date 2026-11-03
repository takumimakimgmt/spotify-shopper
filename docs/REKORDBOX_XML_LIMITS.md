# Local XML preparation and transfer limits

The browser accepts an original XML up to **50 MiB**. It parses the full COLLECTION locally and copies every direct TRACK entry, retaining only Name, Artist, Album and ISRC. Local paths, cue points, track IDs and playlists are not sent. The original file remains in this browser's IndexedDB until Remove or a full reset.

The prepared metadata XML must fit **3 MiB**. The browser rejects an oversized prepared file rather than truncating the library. The proxy and backend keep their 3 MiB XML / 4,400,000-byte total body hard ceilings, leaving room for snapshot data and multipart overhead. This does not make every 50 MiB library transferable: metadata-heavy libraries can still exceed the transfer ceiling.

Malformed XML, DTD/entity declarations, multiple/missing collections, overlong metadata, excessive nesting and over 100,000 collection entries are rejected. Parsing currently runs in the browser's main thread; large files can briefly pause the interface. A worker-based streaming parser is a later performance improvement.

Matching results describe **only the selected export**. Not in XML is not a claim that the user does not own the recording. Results and CSV carry match reasons and the exact compared metadata fingerprint when available. Original filenames remain local display metadata, and the server receives a generic filename. The fingerprint identifies the received metadata XML, not the original file containing local paths and cues.

Source for hosted transfer constraints: https://vercel.com/docs/functions/limitations
