import { useEffect } from "react";

/** CSR document title/description after client navigation (static GitHub Pages site). */
export function PageMeta(props: { title: string; description: string }) {
  useEffect(() => {
    document.title = props.title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", props.description);
  }, [props.title, props.description]);
  return null;
}
