import { useEffect, useRef, useState } from "react";
import "../styles/CustomScrollbar.css";

function CustomScrollbar({ scrollRef, pageKey }) {
  const [metrics, setMetrics] = useState({
    visible: false,
    thumbHeight: 0,
    thumbTop: 0,
    top: 0,
    height: 0,
  });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ y: 0, top: 0 });

  useEffect(() => {
    const element = scrollRef?.current;

    if (!element) {
      return undefined;
    }

    const update = () => {
      const viewportHeight = element.clientHeight;
      const contentHeight = element.scrollHeight;
      const maxScroll = Math.max(contentHeight - viewportHeight, 0);
      const rect = element.getBoundingClientRect();

      if (!viewportHeight || maxScroll <= 1) {
        setMetrics({
          visible: false,
          thumbHeight: 0,
          thumbTop: 0,
          top: rect.top,
          height: viewportHeight,
        });
        return;
      }

      const thumbHeight = Math.max(
        30,
        (viewportHeight / contentHeight) * viewportHeight,
      );
      const availableTrack = Math.max(viewportHeight - thumbHeight, 0);
      const thumbTop = (element.scrollTop / maxScroll) * availableTrack;

      setMetrics({
        visible: true,
        thumbHeight,
        thumbTop,
        top: rect.top,
        height: viewportHeight,
      });
    };

    update();

    element.addEventListener("scroll", update, { passive: true });

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("resize", update);

    return () => {
      element.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [scrollRef, pageKey]);

  const handleTrackPointerDown = (event) => {
    const element = scrollRef?.current;
    const track = event.currentTarget;

    if (!element || !metrics.visible) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const clickPosition = Math.min(
      Math.max(event.clientY - rect.top - metrics.thumbHeight / 2, 0),
      rect.height - metrics.thumbHeight,
    );
    const maxScroll = element.scrollHeight - element.clientHeight;
    const maxThumbTop = rect.height - metrics.thumbHeight;

    element.scrollTop = maxThumbTop
      ? (clickPosition / maxThumbTop) * maxScroll
      : 0;
  };

  const handleThumbPointerDown = (event) => {
    event.stopPropagation();

    draggingRef.current = true;
    dragStartRef.current = {
      y: event.clientY,
      top: metrics.thumbTop,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleThumbPointerMove = (event) => {
    if (!draggingRef.current) {
      return;
    }

    const element = scrollRef?.current;

    if (!element) {
      return;
    }

    const track = event.currentTarget.parentElement;
    const trackHeight = track.clientHeight;
    const maxThumbTop = Math.max(trackHeight - metrics.thumbHeight, 1);
    const nextTop = Math.min(
      Math.max(
        dragStartRef.current.top + (event.clientY - dragStartRef.current.y),
        0,
      ),
      maxThumbTop,
    );
    const maxScroll = element.scrollHeight - element.clientHeight;

    element.scrollTop = (nextTop / maxThumbTop) * maxScroll;
  };

  const stopDragging = () => {
    draggingRef.current = false;
  };

  return (
    <div
      className={`custom-scrollbar ${metrics.visible ? "is-visible" : ""}`}
      style={{
        top: `${metrics.top}px`,
        height: `${metrics.height}px`,
      }}
      aria-hidden="true"
      onPointerDown={handleTrackPointerDown}
    >
      {metrics.visible && (
        <div
          className="custom-scrollbar-thumb"
          style={{
            height: `${metrics.thumbHeight}px`,
            transform: `translateY(${metrics.thumbTop}px)`,
          }}
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
        />
      )}
    </div>
  );
}

export default CustomScrollbar;
