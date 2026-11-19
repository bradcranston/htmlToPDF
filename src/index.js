import { toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

const DEFAULT_RETURN_SCRIPT = "OnHtmlToPdfResult";

function getFileMakerBridge() {
  if (typeof window !== "undefined" && window.FileMaker) {
    return window.FileMaker;
  }

  return null;
}

function callFileMakerScript(scriptName, payload) {
  const bridge = getFileMakerBridge();
  if (!bridge || typeof bridge.PerformScript !== "function") {
    console.warn("FileMaker bridge is not available. Payload:", payload);
    return;
  }

  bridge.PerformScript(scriptName, JSON.stringify(payload));
}

function buildPayload(input, returnScriptName) {
  if (typeof input === "string") {
    return {
      html: input,
      returnScriptName,
    };
  }

  if (input && typeof input === "object") {
    return {
      html: input.html || "",
      returnScriptName: input.returnScriptName || returnScriptName,
      requestId: input.requestId,
      filename: input.filename,
      options: input.options,
    };
  }

  return {
    html: "",
    returnScriptName,
  };
}

function prepareRender(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Inject <style> elements from the parsed <head> into the live document
  // so class-based CSS rules are in the cascade when html-to-image calls
  // getComputedStyle on each element.
  const injectedStyles = Array.from(doc.head.querySelectorAll("style")).map((s) => {
    const el = document.createElement("style");
    el.textContent = s.textContent;
    document.head.appendChild(el);
    return el;
  });

  // Off-screen container sized to match a letter-width page.
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;left:-10000px;top:0;background:#fff;width:816px;";
  container.innerHTML = doc.body.innerHTML;
  document.body.appendChild(container);

  return {
    container,
    cleanup: () => {
      container.remove();
      injectedStyles.forEach((el) => el.remove());
    },
  };
}

// Render the full HTML in a same-origin iframe so the browser builds
// a proper document with <head>/<style> intact.  html2canvas then
function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function convertHtmlToPdfForFileMaker(input, returnScriptName = DEFAULT_RETURN_SCRIPT) {
  if (typeof input === "string") {
    try {
      input = JSON.parse(input);
    } catch {
      // Not JSON — treat as a raw HTML string
    }
  }

  const request = buildPayload(input, returnScriptName);
  const scriptName = request.returnScriptName || DEFAULT_RETURN_SCRIPT;

  if (!request.html || typeof request.html !== "string") {
    callFileMakerScript(scriptName, {
      ok: false,
      error: "Missing HTML string parameter.",
      requestId: request.requestId || null,
    });
    return;
  }

  const options = request.options || {};
  const { container, cleanup } = prepareRender(request.html);
  await waitForPaint();

  try {
    const margin = options.margin ?? 0;
    const pdf = new jsPDF({
      unit: "in",
      format: options.format || "letter",
      orientation: options.orientation || "portrait",
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;
    const pixelRatio = options.scale || 2;

    // Detect bill-format pages (div.p with page-break-after) vs flowing HTML.
    const pageEls = Array.from(container.querySelectorAll("div.p"));

    if (pageEls.length > 0) {
      // Each div.p is one logical page — capture individually.
      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await toCanvas(pageEls[i], { backgroundColor: "#ffffff", pixelRatio });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.98), "JPEG", margin, margin, contentW, contentH);
      }
    } else {
      // Flowing HTML: capture the whole container then slice across pages.
      const canvas = await toCanvas(container, { backgroundColor: "#ffffff", pixelRatio });
      const totalImgH = (canvas.height / canvas.width) * contentW;
      const numPages = Math.ceil(totalImgH / contentH);
      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      for (let i = 0; i < numPages; i++) {
        if (i > 0) pdf.addPage();
        // Offset image upward each page so the next slice is visible.
        pdf.addImage(imgData, "JPEG", margin, margin - i * contentH, contentW, totalImgH);
      }
    }

    const dataUri = pdf.output("datauristring");
    const base64 = dataUri.slice(dataUri.indexOf(",") + 1);

    callFileMakerScript(scriptName, {
      ok: true,
      requestId: request.requestId || null,
      filename: request.filename || "document.pdf",
      base64,
      mimeType: "application/pdf",
    });
  } catch (error) {
    callFileMakerScript(scriptName, {
      ok: false,
      requestId: request.requestId || null,
      error: error instanceof Error ? error.message : "Unknown PDF conversion error.",
    });
  } finally {
    cleanup();
  }
}

window.convertHtmlToPdfForFileMaker = convertHtmlToPdfForFileMaker;
window.convertHtmlToPdf = convertHtmlToPdfForFileMaker;

console.log("HTML to PDF widget ready: convertHtmlToPdfForFileMaker(htmlOrObject, returnScriptName?)");