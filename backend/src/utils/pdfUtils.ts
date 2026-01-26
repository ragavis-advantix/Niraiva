
const pdfjs = require('pdfjs-dist/build/pdf');

/**
 * Robust PDF text extraction using pdfjs-dist directly
 */
async function extractTextFromPDF(buffer) {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
        data,
        useSystemFonts: true,
        disableFontFace: true,
        ignoreErrors: true // Key for robust parsing
    });

    const pdf = await loadingTask.promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n";
    }

    return fullText;
}

module.exports = { extractTextFromPDF };
