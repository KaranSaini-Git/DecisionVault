const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const openStoredDocument = async ({ decisionId, documentId }) => {
  const safeDecisionId = Number(decisionId);
  const safeDocumentId = Number(documentId);

  if (
    !Number.isInteger(safeDecisionId) ||
    safeDecisionId <= 0 ||
    !Number.isInteger(safeDocumentId) ||
    safeDocumentId <= 0
  ) {
    throw new Error("This document cannot be opened.");
  }

  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Authentication required.");
  }

  /*
   * Create the tab synchronously from the user's click.
   * This prevents Chrome from blocking the new tab.
   */
  const newWindow = window.open("", "_blank");

  if (!newWindow) {
    throw new Error(
      "Please allow pop-ups for DecisionVault to open documents.",
    );
  }

  try {
    newWindow.opener = null;

    newWindow.document.title = "Opening document...";

    newWindow.document.body.innerHTML = `
      <div
        style="
          min-height: 100vh;
          display: grid;
          place-items: center;
          margin: 0;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          color: #24342b;
          background: #ffffff;
        "
      >
        Opening document...
      </div>
    `;

    const response = await fetch(
      `${API_BASE_URL}/api/decisions/${safeDecisionId}/documents/${safeDocumentId}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      let message = "Unable to open the document.";

      try {
        const data = await response.json();
        message = data?.message || message;
      } catch {
        // Ignore non-JSON error responses.
      }

      throw new Error(message);
    }

    const blob = await response.blob();

    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error("The document file is empty.");
    }

    const objectUrl = URL.createObjectURL(blob);

    /*
     * Give Chrome the actual file.
     */
    newWindow.location.replace(objectUrl);

    /*
     * Keep it alive long enough for the new tab to finish loading.
     */
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60_000);
  } catch (error) {
    try {
      newWindow.close();
    } catch {
      // Ignore close failures.
    }

    throw error;
  }
};

export { openStoredDocument };
