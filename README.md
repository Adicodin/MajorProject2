# Ransomware Evolution Matrix

An empirical study of the evolution of Windows ransomware from 1989 to 2025, supported by a structured knowledge base, manual analysis reports for selected families, and an interactive web dashboard for exploring the dataset.

This repository accompanies the M.Tech major project *"An Empirical Study of the Evolution of Windows Ransomware"* submitted to the School of Cyber Security & Digital Forensics, National Forensic Sciences University, Gandhinagar.

---

## Overview

This project traces the behavioural evolution of 35 representative Windows ransomware families across four distinct eras, examining six dimensions: encryption strategy, file system behaviour, persistence, network and C2 activity, anti-analysis and defense evasion, and propagation and ransom mechanisms.

The study combines manual dynamic analysis of selected samples in a controlled FLARE-VM and REMnux environment with systematic review of public sandbox reports (Hybrid Analysis, ANY.RUN, Triage) and peer-reviewed literature, organising all findings into a structured, queryable knowledge base.

---

## Repository Contents

The Excel workbook is the empirical foundation of the study.  Present in the `ransomware-tracker` directory. It contains one sheet per behavioural dimension:
- **Overview** — family metadata (name, year, hash, references)
- **Encryption** — algorithms, key handling, cipher modes
- **File** — targeting scope, shadow copy deletion, mutexes
- **Network** — protocols, C2, exfiltration methods
- **Persistence** — registry keys, scheduled tasks, boot-level mechanisms
- **Anti-Analysis and Defense Evasion** — packing, obfuscation, BYOVD, sandbox evasion
- **Propagation and Ransom Mechanisms** — distribution vectors, extortion models, payment methods

Each row represents one family and supports filtering by year, era, or technique.

It also contains per-family manual analysis reports for the ten ransomware samples analysed. 

---

## Ransomware Evolution Matrix (Interactive Dashboard)

A web-based dashboard built to make the dataset explorable beyond the spreadsheet form. Powered by a FastAPI backend that parses the Excel knowledge base directly. Present in the `ransomware-tracker` directory.

### Features

- **Dashboard** — era-segmented interactive timeline with statistical overview cards
- **Database** — searchable, filterable, exportable view of all 35 families
- **Family Detail** — tabbed breakdowns across all six behavioural dimensions
- **Comparison Tool** — side-by-side technical comparison of up to three families with automatic difference highlighting
- **Raw Sheet Viewer** — direct access to the underlying dataset

### Running Locally

**Requirements:** Python 3.9+, pip, a modern browser.

```bash
# Terminal 1 — Backend
cd ransomware-tracker/backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd ransomware-tracker/frontend
python -m http.server 3000
```

Open `http://localhost:3000` in your browser.

The backend serves the API on port 8000 and the frontend consumes it from port 3000.

---
## Disclaimer

This repository is intended strictly for academic and defensive research purposes. **No live malware samples are included.** The manual analysis reports document behavioural observations and indicators of compromise, not redistributable binaries. Sample hashes referenced in the knowledge base are publicly documented in established threat intelligence sources.

---
