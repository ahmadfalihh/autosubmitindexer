import { XMLParser } from "fast-xml-parser";

export class SitemapParser {
    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
        });
    }

    async fetchAndParse(sitemapUrl) {
        try {
            // Use server-side proxy to avoid CORS
            const response = await fetch('/fetch-sitemap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: sitemapUrl })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Failed to fetch sitemap: ${response.statusText}`);
            }

            const { xmlData } = await response.json();
            return this.parseXML(xmlData);
        } catch (error) {
            console.error("Sitemap fetch error:", error);
            throw error;
        }
    }

    async parseXmlFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const xmlData = e.target.result;
                    resolve(this.parseXML(xmlData));
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = (e) => reject(new Error("Failed to read file"));
            reader.readAsText(file);
        });
    }

    parseXML(xmlData) {
        const result = this.parser.parse(xmlData);
        let urls = [];

        // Handle standard sitemap
        if (result.urlset && result.urlset.url) {
            const urlEntries = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];
            urls = urlEntries.map(entry => entry.loc);
        }
        // Handle sitemap index
        else if (result.sitemapindex && result.sitemapindex.sitemap) {
            // Recursive fetching not implemented in this simple version
            // but we warn the user
            console.warn("Sitemap index detected. Only listing sub-sitemaps.");
            const entries = Array.isArray(result.sitemapindex.sitemap) ? result.sitemapindex.sitemap : [result.sitemapindex.sitemap];
            urls = entries.map(entry => entry.loc);
        }

        // Deduplication
        const uniqueUrls = [...new Set(urls)];
        return uniqueUrls;
    }
}
