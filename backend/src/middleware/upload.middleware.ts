import multer from "multer";
import {
  ETL_ALLOWED_EXTENSIONS,
  ETL_MAX_FILE_BYTES,
} from "../etl/etlImport.types.js";
import { HttpError } from "../utils/httpError.js";

const storage = multer.memoryStorage();

function isAllowedExtension(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return ETL_ALLOWED_EXTENSIONS.includes(ext as (typeof ETL_ALLOWED_EXTENSIONS)[number]);
}

export const etlUploadMiddleware = multer({
  storage,
  limits: { fileSize: ETL_MAX_FILE_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!isAllowedExtension(file.originalname)) {
      cb(
        HttpError.badRequest(
          `Unsupported file type. Allowed: ${ETL_ALLOWED_EXTENSIONS.join(", ")}`,
        ),
      );
      return;
    }
    cb(null, true);
  },
}).single("file");
