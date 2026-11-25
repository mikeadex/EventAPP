# Design source

These are the approved pages exported from the design canvas:
https://claude.ai/artifact/NadB7P84hrigXCCc9eRXqW

- `pages/`: 24 pages (one per route, see `../docs/01-pages-and-routes.md`)
- `components/`: Header, Footer, EventCard, HostNav
- `ekklesia.css`: the stylesheet they use (tokens + layout classes + breakpoints)
- `sample-data.json`: sample events and hosts (pages fetch it in `componentDidMount`)
- `canvas.json`: canvas layout: page titles, groupings and which frames are mobile or light previews

These files are a **spec, not production code**. They run inside the design tool's runtime (`support.js`, not included), so open them as text. See "Reading a .dc.html design file" in `../CLAUDE.md`.

Asset paths have been rewritten to point at `../../assets/images/…` and `../ekklesia.css`.
