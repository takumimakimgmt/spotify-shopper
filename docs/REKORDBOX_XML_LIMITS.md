# XML upload limits

The hosted workflow accepts XML files up to **3 MiB** (shown as 3 MB in the UI). Vercel Functions limit the entire request body to 4.5 MB, including multipart fields. Reserving up to 1 MiB for the snapshot plus encoding overhead keeps both upload paths within that limit.

The browser, Next proxy, Render upload handler and XML parser enforce this limit. Existing environment values cannot raise the hard ceiling. Old saved XML larger than the limit must be replaced.

A reduced export only checks the library portion it contains. A missing match means absent from that export, not necessarily absent from your entire library. Export a relevant selection and verify its coverage.

Larger libraries need a separate authenticated upload design; never expose BACKEND_PROXY_TOKEN to the browser as a workaround.

Source: https://vercel.com/docs/functions/limitations
