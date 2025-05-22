export default {
  async fetch(request, env) {
    // Parse the URL
    const url = new URL(request.url);

    // Extract the arXiv identifier from the path
    const [, , arxivId] = url.pathname.split("/");

    // If no ID provided, show a simple instruction page
    if (!arxivId) {
      return new Response(
        `<html>
            <head><title>arXiv Markdown Converter</title></head>
            <body>
              <h1>arXiv Markdown Converter</h1>
              <p>Use this service by visiting: <code>http://arxivmd.org/format/PAPER_ID</code></p>
              <p>Example: <a href="http://arxivmd.org/html/2505.11821v1">http://arxivmd.org/html/2505.11821v1</a></p>
            </body>
          </html>`,
        { headers: { "Content-Type": "text/html" } },
      );
    }

    // Check if we have a cached version
    const cachedMarkdown = await env.ARXIV_KV.get(`arxiv:${arxivId}`);
    if (cachedMarkdown) {
      return new Response(cachedMarkdown, {
        headers: { "Content-Type": "text/markdown;charset=utf8" },
      });
    }

    // Construct the arXiv HTML URL
    const arxivHtmlUrl = `https://arxiv.org/html/${arxivId}`;

    try {
      // Try to fetch the markdown version using the reader.llmtext.com service
      const llmTextUrl = `https://reader.llmtext.com/md/arxiv.org/html/${arxivId}`;
      const llmTextResponse = await fetch(llmTextUrl);

      if (!llmTextResponse.ok) {
        throw new Error(
          `Failed to fetch from llmtext: ${llmTextResponse.status}`,
        );
      }

      const markdown = await llmTextResponse.text();

      // Cache the result (indefinitely - papers don't change once published)
      await env.ARXIV_KV.put(`arxiv:${arxivId}`, markdown);

      // Return the markdown
      return new Response(markdown, {
        headers: { "Content-Type": "text/markdown;charset=utf8" },
      });
    } catch (error) {
      console.error(`Error processing ${arxivId}:`, error);

      return new Response(
        `Failed to convert arXiv paper to markdown: ${error.message}\n\nOriginal paper: ${arxivHtmlUrl}`,
        { status: 500, headers: { "Content-Type": "text/plain;charset=utf8" } },
      );
    }
  },
};
