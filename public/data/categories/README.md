# Category catalog

Only legitimately supplied production category definitions should be referenced by `index.json`.
The application does not scrape or redistribute Clarivate/JCR membership. Copy
`category.template.json`, add the owner-supplied journals and ISSNs, rename it, and add its metadata to
`index.json`. Run `npm run validate:categories` before committing.
