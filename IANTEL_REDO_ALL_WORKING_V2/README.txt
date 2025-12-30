IANTEL — Personal Intelligence Briefing (Gift Build)

Open locally:
1) Put this folder anywhere (Desktop is fine)
2) In Terminal:
   cd /path/to/IANTEL
   python3 -m http.server 8080
3) Open: http://localhost:8080

Hosting (GitHub Pages + auto updates):
1) Create a GitHub repo and upload the FULL contents of this folder (keep .github!)
2) Repo Settings → Pages → Deploy from branch: main / root
3) Actions tab → run "Update IANTEL Briefing" once
4) It will auto-update daily and commit data/briefing.json

Notes:
- Music requires one click (browser autoplay rules).
- The page does NOT scrape websites in the browser (CORS). GitHub Actions refreshes data server-side.
