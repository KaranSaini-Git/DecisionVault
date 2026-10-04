import { useEffect, useState } from "react";

function WorkspacePageTransition({ pageKey, children }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);

    const frame = requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pageKey]);

  return (
    <div
      className={`workspace-page-transition${visible ? " is-visible" : ""}`}
      data-page={pageKey}
    >
      {children}
    </div>
  );
}

export default WorkspacePageTransition;
