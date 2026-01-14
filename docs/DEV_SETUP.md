# Dev setup (spotify-shopper-web)

## Git hooks (UI/UX source allowlist)

This repo uses shareable hooks in `.githooks`.

Enable once:

```bash
git config core.hooksPath .githooks
```

This enforces:

- `scripts/check-uiux-sources.sh` checks staged diffs for UI/UX source URLs
- Only allowlisted sources from `_teacher_data/uiux/sources/README.md` are permitted

## Teacher data (local)

We keep `_teacher_data` outside the repo as a separate git repo:

```
  ~/dev/_teacher_data
```

Optionally link it locally (NOT committed):

```bash
ln -sfn ~/dev/_teacher_data ./_teacher_data
```
