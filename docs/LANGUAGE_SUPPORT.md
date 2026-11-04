# Japanese and English interface

The language control stays above the input and results views. It changes application-owned labels, helper text, purchase links, matching explanations and common error/storage messages without remounting the analysis view. Recording titles, artist credits, XML candidate fields, playlist names, filenames, URLs, technical error details and CSV schema stay unchanged.

The selected language is saved under `playlist-shopper-language`. On first visit, the primary browser language chooses Japanese for `ja` and English otherwise. An explicit saved choice overrides that default. English is used for the initial server render to keep hydration stable, then the browser choice is restored. Manual changes and cross-tab changes cancel any pending initial restoration. Storage failure leaves the current-page selection working and shows a warning. The document language follows the active interface language. Settings/all resets include the preference; analysis-only resets preserve it.

Translations use a local Japanese catalogue keyed by the English source message. Unknown technical messages fall back to their original text. Placeholder substitution does not evaluate content. No translation API, new dependency, account, paid service or data upload is introduced. This does not add separate Japanese SEO routes or change the production domain.
