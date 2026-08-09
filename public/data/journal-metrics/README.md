# Journal Impact Factor privacy boundary

No JIF dataset belongs in this public directory. The application accepts an
owner-supplied JSON file through its local file picker and keeps the parsed data
only in browser memory. `npm run extract:jif` writes to ignored `data-private/`
storage and refuses to write beneath `public/data/`.
