# Distribution Guide

## Creating Distribution Archives

Use `git archive` to create clean, reproducible distribution packages:

```bash
# Frontend (spotify-shopper-web)
cd spotify-shopper-web
git archive --format=tar.gz -o ../spotify-shopper-web.tgz HEAD

# Backend (spotify-shopper)
cd spotify-shopper
git archive --format=tar.gz -o ../spotify-shopper-backend.tgz HEAD
```

## Why `git archive`?

- **Clean**: Only tracked files, no build artifacts or `.git` history
- **Reproducible**: Same commit = same archive
- **Small**: Excludes `.next/`, `node_modules/`, `.venv/`, etc.
- **Safe**: Respects `.gitignore` patterns

## Extracting Archives

```bash
# Extract frontend
tar -xzf spotify-shopper-web.tgz -C spotify-shopper-web

# Extract backend
tar -xzf spotify-shopper-backend.tgz -C spotify-shopper
```

## Post-Extraction Setup

### Frontend
```bash
cd spotify-shopper-web
npm install
npm run build
```

### Backend
```bash
cd spotify-shopper
python3 -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Refer to `START_HERE.md` in each project for full setup instructions.
