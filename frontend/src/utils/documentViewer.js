const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const getToken = () => {
  return localStorage.getItem("token");
};

const getErrorMessage = async (response) => {
  try {
    const data = await response.json();

    if (data?.message) {
      return data.message;
    }
  } catch {
    // Ignore non-JSON responses.
  }

  return "Unable to open the document.";
};

const openStoredDocument = async ({ decisionId, documentId }) => {
  if (!decisionId || !documentId) {
    throw new Error("This document cannot be opened.");
  }

  /*
   * IMPORTANT:
   * Open the tab immediately while this function is still inside
   * the user's click event. This prevents Chrome popup blocking.
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
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 40px;
          text-align: center;
        "
      >
        Opening document...
      </div>
    `;

    const token = getToken();

    if (!token) {
      throw new Error("Authentication required.");
    }

    const response = await fetch(
      `${API_BASE_URL}/api/decisions/${Number(
        decisionId,
      )}/documents/${Number(documentId)}/content`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    const blob = await response.blob();

    if (!blob || blob.size === 0) {
      throw new Error("The document file is empty.");
    }

    /*
     * Convert the downloaded Supabase file into a browser URL.
     */
    const objectUrl = URL.createObjectURL(blob);

    /*
     * Now replace the about:blank page with the real document.
     */
    newWindow.location.replace(objectUrl);

    /*
     * Keep the Blob URL alive long enough for the browser
     * to finish loading the document.
     */
    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
    }, 60 * 1000);
  } catch (error) {
    try {
      newWindow.close();
    } catch {
      // Ignore close errors.
    }

    throw error;
  }
};

export { openStoredDocument };
