/** Shared by the server check and the client pre-upload check. */
// Vercel caps request bodies at 4.5 MB, so stay safely below that.
export const MAX_CV_BYTES = 4 * 1024 * 1024; // 4 MB
