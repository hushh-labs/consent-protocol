/**
 * Footer Component
 * ================
 */

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>🤫</span>
            <span className="text-sm text-secondary">
              © 2024 Hushh Labs. Consent-first personal data.
            </span>
          </div>
          
          <div className="flex items-center gap-6">
            <Link href="/docs" className="text-sm text-secondary hover:text-white transition-colors">
              Documentation
            </Link>
            <a 
              href="https://github.com/hushh-labs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-secondary hover:text-white transition-colors"
            >
              GitHub
            </a>
            <a 
              href="https://hushh.ai" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-secondary hover:text-white transition-colors"
            >
              hushh.ai
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
