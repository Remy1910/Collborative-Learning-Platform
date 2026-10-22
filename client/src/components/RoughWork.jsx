import { useState, useEffect, useCallback, useRef } from "react";
import { quizAPI } from "../utils/api";

export const MAX_ROUGH_WORK_PHOTOS = 5;
// Phone photos are often 3–8 MB; this keeps handwriting readable at a fraction of the size
const MAX_PHOTO_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;

// Shrinks a photo in the browser before upload. Falls back to the original file if the
// browser can't decode it (e.g. HEIC on desktop Chrome) — the server then validates it.
const compressPhoto = async (file) => {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
};

const formatTimeLeft = (deadline) => {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "time is up";
  const minutes = Math.ceil(ms / 60000);
  return `${minutes} minute${minutes !== 1 ? "s" : ""} left`;
};

// ── Thumbnails of the photos uploaded for one attempt ───────────────────────
export function RoughWorkGallery({ responseId, refreshKey = 0, onDelete, emptyText = "No rough work uploaded." }) {
  const [photos, setPhotos] = useState(null); // [{ _id, url }]
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const urls = [];
    (async () => {
      try {
        const data = await quizAPI.getRoughWork(responseId);
        if (active) setError("");
        const loaded = await Promise.all(data.photos.map(async (photo) => {
          const blob = await quizAPI.getRoughWorkPhoto(responseId, photo._id);
          const url = URL.createObjectURL(blob);
          urls.push(url);
          return { _id: photo._id, url };
        }));
        if (active) setPhotos(loaded);
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => {
      active = false;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [responseId, refreshKey]);

  if (error) return <div className="text-muted small">Couldn't load rough work: {error}</div>;
  if (!photos) return <div className="text-muted small">Loading rough work…</div>;
  if (photos.length === 0) return <div className="text-muted small">{emptyText}</div>;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
      {photos.map((photo, idx) => (
        <div key={photo._id} style={{ position: "relative" }}>
          <a href={photo.url} target="_blank" rel="noreferrer" title="Open full size">
            <img
              src={photo.url}
              alt={`Rough work page ${idx + 1}`}
              style={{ width: "120px", height: "120px", objectFit: "cover", borderRadius: "8px", border: "1px solid #e2e8f0", display: "block" }}
            />
          </a>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(photo._id)}
              title="Remove photo"
              style={{
                position: "absolute", top: "4px", right: "4px", width: "24px", height: "24px",
                borderRadius: "50%", border: "none", background: "rgba(15,23,42,.75)", color: "white",
                cursor: "pointer", lineHeight: "24px", padding: 0
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Student's upload step after submitting a quiz ───────────────────────────
export function RoughWorkUpload({ responseId, deadline, onDone }) {
  const [uploadedCount, setUploadedCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState([]); // [{ file, url }]
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  // Re-render every 30s so the countdown stays current
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const refreshCount = useCallback(async () => {
    try {
      const data = await quizAPI.getRoughWork(responseId);
      setUploadedCount(data.photos.length);
    } catch (err) {
      setError(err.message);
    }
  }, [responseId]);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  // Free preview URLs on unmount; removals and uploads free their own
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => () => selectedRef.current.forEach(s => URL.revokeObjectURL(s.url)), []);

  const remaining = MAX_ROUGH_WORK_PHOTOS - uploadedCount - selected.length;
  const expired = deadline && new Date(deadline).getTime() <= Date.now();

  const handlePick = (e) => {
    setError("");
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length > remaining) {
      setError(`You can add ${Math.max(0, remaining)} more photo${remaining !== 1 ? "s" : ""} (maximum ${MAX_ROUGH_WORK_PHOTOS}).`);
    }
    const accepted = files.slice(0, Math.max(0, remaining)).map(file => ({ file, url: URL.createObjectURL(file) }));
    setSelected(prev => [...prev, ...accepted]);
  };

  const removeSelected = (idx) => {
    URL.revokeObjectURL(selected[idx].url);
    setSelected(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      const compressed = await Promise.all(selected.map(s => compressPhoto(s.file)));
      compressed.forEach(file => formData.append("photos", file));
      const result = await quizAPI.uploadRoughWork(responseId, formData);
      selected.forEach(s => URL.revokeObjectURL(s.url));
      setSelected([]);
      setUploadedCount(result.roughWorkCount);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (photoId) => {
    setError("");
    try {
      const result = await quizAPI.deleteRoughWorkPhoto(responseId, photoId);
      setUploadedCount(result.roughWorkCount);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ textAlign: "left" }}>
      <h3 style={{ marginBottom: "0.25rem" }}>📷 Upload your rough work</h3>
      <p className="text-muted small" style={{ marginBottom: "1rem" }}>
        Your answers are submitted. Your instructor requires photos of the rough work you did on paper —
        take a clear photo of every page (up to {MAX_ROUGH_WORK_PHOTOS}).
        {deadline && <> <strong>{expired ? "The upload window has closed." : `Upload within ${formatTimeLeft(deadline)}.`}</strong></>}
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}

      {uploadedCount > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <div className="small" style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Uploaded ({uploadedCount})</div>
          <RoughWorkGallery responseId={responseId} refreshKey={refreshKey} onDelete={expired ? undefined : handleDelete} />
        </div>
      )}

      {selected.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <div className="small" style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Ready to upload ({selected.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {selected.map((s, idx) => (
              <div key={s.url} style={{ position: "relative" }}>
                <img src={s.url} alt={`Selected photo ${idx + 1}`}
                  style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px", border: "2px dashed #93c5fd" }} />
                <button type="button" onClick={() => removeSelected(idx)} title="Remove"
                  style={{ position: "absolute", top: "4px", right: "4px", width: "22px", height: "22px", borderRadius: "50%",
                    border: "none", background: "rgba(15,23,42,.75)", color: "white", cursor: "pointer", padding: 0 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!expired && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          {remaining > 0 && (
            <label className="btn-secondary" style={{ cursor: busy ? "not-allowed" : "pointer" }}>
              {selected.length || uploadedCount ? "Add more photos" : "Choose / take photos"}
              <input type="file" accept="image/*" multiple onChange={handlePick} disabled={busy} style={{ display: "none" }} />
            </label>
          )}
          {selected.length > 0 && (
            <button className="btn-primary" onClick={handleUpload} disabled={busy}>
              {busy ? "Uploading…" : `Upload ${selected.length} photo${selected.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}

      {(uploadedCount > 0 || expired) && selected.length === 0 && onDone && (
        <div style={{ marginTop: "1.25rem" }}>
          <button className="btn-primary" onClick={() => onDone(uploadedCount)}>
            {uploadedCount > 0 ? "Done — show my result" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
