import { FileText, ImageIcon, UploadCloud } from "lucide-react";
import type { TaskAttachment } from "../types/task";

export function AttachmentPreviewGrid({
  attachments,
  onAdd,
}: {
  attachments: TaskAttachment[];
  onAdd: (payload: { fileName: string; fileUrl: string; mimeType: string; size: number }) => Promise<void>;
}) {
  async function fakeUpload(file: File) {
    await onAdd({
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    });
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Attachments</h2>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10">
          <UploadCloud size={14} />
          Upload
          <input
            className="hidden"
            type="file"
            onChange={(event) => event.target.files?.[0] && fakeUpload(event.target.files[0])}
          />
        </label>
      </div>
      <div className="grid gap-2">
        {attachments.map((file) => {
          const isImage = file.mimeType.startsWith("image/");
          const Icon = isImage ? ImageIcon : FileText;

          return (
            <a
              key={file._id}
              href={file.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="grid gap-3 rounded-md border border-white/10 bg-black/25 p-3 text-sm text-slate-200 transition hover:border-cyan-300/40 sm:grid-cols-[auto_1fr]"
            >
              {isImage ? (
                <img src={file.fileUrl} alt="" className="h-14 w-14 rounded-md object-cover ring-1 ring-white/10" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-md bg-white/5 ring-1 ring-white/10">
                  <Icon size={20} className="text-cyan-300" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{file.fileName}</div>
                <div className="text-xs text-slate-500">
                  {file.uploadedByName} - {(file.size / 1024).toFixed(1)} KB
                </div>
                <div className="mt-1 text-xs text-slate-600">{new Date(file.createdAt).toLocaleString()}</div>
              </div>
            </a>
          );
        })}
        {attachments.length === 0 && <div className="text-sm text-slate-500">No attachments yet.</div>}
      </div>
    </section>
  );
}
