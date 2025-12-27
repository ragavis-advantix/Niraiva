import { extractPDFSmart } from "./pdfExtractor";
import { extractImage } from "./imageExtractor";
import { extractJSON } from "./jsonExtractor";
import { cleanText } from "../text/cleanText";
import { inferMime } from "../file/inferMime";


/**
 * Smart extractor - automatically chooses the right extraction method
 * based on file type
 */
export async function smartExtract(file: Express.Multer.File): Promise<string> {
    const mime = inferMime(file.originalname, file.mimetype);

    console.log(`📄 Extracting file: ${file.originalname} (${mime})`);

    if (mime === "application/pdf") {
        return cleanText(await extractPDFSmart(file.buffer));
    }

    if (mime.startsWith("image/")) {
        return cleanText(await extractImage(file.buffer));
    }

    if (mime === "application/json") {
        return cleanText(extractJSON(file.buffer));
    }

    return cleanText(file.buffer.toString("utf8"));
}
