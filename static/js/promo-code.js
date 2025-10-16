document.addEventListener("DOMContentLoaded", function () {
  // Get the current URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const promoCode = urlParams.get("promo");

  // If a promo code is present in the URL
  if (promoCode) {
    // Select all links on the page
    const links = document.getElementsByTagName("a");

    // Iterate through each link
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const href = link.getAttribute("href");

      if (href) {
        try {
          // Check if the link is to easycart.pl, *.easycart.pl, easy.tools or *.easy.tools
          if (href.includes("easycart.pl") || href.includes("easy.tools")) {
            // Create a URL object from the href
            const url = new URL(href);

            // Add or update the promo parameter
            url.searchParams.set("promo", promoCode);

            // Update the link's href with the new URL
            link.setAttribute("href", url.toString());
          }
          // Check if the link is internal to /szkolenia/
          else if (
            href.startsWith("/szkolenia/") ||
            href.includes("/szkolenia/")
          ) {
            // For relative URLs starting with /
            if (href.startsWith("/")) {
              // Parse the path and existing query string
              const baseUrl = window.location.origin;
              const url = new URL(href, baseUrl);

              // Add or update the promo parameter
              url.searchParams.set("promo", promoCode);

              // Update the link's href (use pathname + search to keep it relative)
              link.setAttribute("href", url.pathname + url.search + url.hash);
            }
            // For absolute URLs on same domain
            else if (href.includes(window.location.hostname)) {
              const url = new URL(href);
              url.searchParams.set("promo", promoCode);
              link.setAttribute("href", url.toString());
            }
          }
        } catch (e) {
          // Ignore invalid URLs (like anchors #, mailto:, etc.)
          console.debug("Skipping invalid URL:", href);
        }
      }
    }
  }
});
