import { BookOpen, FileJson } from "lucide-react";

export function EmptyCatalog() {
  return (
    <section className="empty-catalog" aria-labelledby="empty-catalog-title">
      <div className="empty-icon" aria-hidden="true"><FileJson size={22} /></div>
      <div>
        <h2 id="empty-catalog-title">No production categories are configured</h2>
        <p>Add a legitimately supplied category JSON file under <code>public/data/categories/</code>, reference it from <code>index.json</code>, and run the validation command. Development fixtures are intentionally excluded from this public catalog.</p>
        <a href="data/categories/README.md" className="inline-link"><BookOpen size={16} aria-hidden="true" /> Read the category-data guide</a>
      </div>
    </section>
  );
}
