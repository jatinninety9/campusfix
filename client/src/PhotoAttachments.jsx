import { useEffect, useState } from "react";
import { ImagePlus, Eye, Trash2, X, RefreshCw } from "lucide-react";

export default function PhotoAttachments({ issue, user, api }) {
  const [photos, setPhotos] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(null);

  const path = `/issues/${issue.id}/attachments`;
  const canUpload = user.role === "admin"
    || issue.reporter_id === user.id
    || (user.role === "staff" && issue.assignee_id === user.id);

  async function reload() {
    setLoading(true);
    setError("");
    try {
      setPhotos(await api(path));
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    api(path)
      .then(data => { if (active) setPhotos(data); })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, api]);

  async function upload(event) {
    event.preventDefault();
    if (!file) return;

    setError("");
    setNotice("");
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose a photo that is 5 MiB or smaller.");
      return;
    }

    const form = event.currentTarget;
    const body = new FormData();
    body.append("photo", file);
    setBusy(true);

    try {
      const added = await api(path, { method: "POST", body });
      setPhotos(current => [...current, added]);
      setFile(null);
      form.reset();
      setNotice("Photo uploaded successfully.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function view(photo) {
    setBusy(true);
    setError("");
    try {
      const result = await api(`${path}/${photo.id}/url`);
      setPreview({ id: photo.id, name: photo.original_name, url: result.url });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo) {
    if (!window.confirm(`Remove "${photo.original_name}"?`)) return;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`${path}/${photo.id}`, { method: "DELETE" });
      setPhotos(current => current.filter(item => item.id !== photo.id));
      if (preview?.id === photo.id) setPreview(null);
      setNotice("Photo removed.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="photos-section" aria-label="Issue photos">
      <div className="section-heading">
        <div>
          <h3>Photos <span className="count-pill">{photos.length}/3</span></h3>
          <p className="muted small">A clearer picture helps the team respond.</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Refresh photos"
          disabled={busy || loading}
          onClick={reload}
        >
          <RefreshCw size={17} aria-hidden="true" />
        </button>
      </div>

      {loading && <p className="small muted" role="status">Loading photos...</p>}

      {!loading && photos.length === 0 && (
        <p className="photos-empty">No photos attached yet.</p>
      )}

      <ul className="photos-list">
        {photos.map(photo => (
          <li key={photo.id} className="photo-row">
            <ImagePlus size={19} aria-hidden="true" />
            <div className="photo-info">
              <strong>{photo.original_name}</strong>
              <span>{Math.ceil(photo.size_bytes / 1024)} KiB</span>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => view(photo)}
              aria-label={`View photo ${photo.original_name}`}
            >
              <Eye size={15} aria-hidden="true" /> View
            </button>
            {(user.role === "admin" || photo.uploaded_by === user.id) && (
              <button
                type="button"
                className="icon-button"
                disabled={busy}
                onClick={() => remove(photo)}
                aria-label={`Remove photo ${photo.original_name}`}
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {preview && (
        <figure className="photo-preview">
          <figcaption>
            <span>{preview.name}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Close photo preview"
              onClick={() => setPreview(null)}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </figcaption>
          <img
            src={preview.url}
            alt={`Issue evidence: ${preview.name}`}
            onError={() => {
              setPreview(null);
              setError("The photo could not load. Select View again for a fresh link.");
            }}
          />
        </figure>
      )}

      {canUpload && photos.length < 3 && (
        <form onSubmit={upload} className="photos-upload">
          <label className="field">
            <span>Attach a photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              disabled={busy || loading}
              aria-describedby={`photo-limits-${issue.id}`}
              onChange={event => setFile(event.target.files?.[0] || null)}
            />
          </label>
          <p id={`photo-limits-${issue.id}`} className="small muted">
            JPEG, PNG or WebP. Maximum 5 MiB each; 3 photos per issue.
          </p>
          <button
            type="submit"
            className="primary"
            disabled={busy || loading || !file}
          >
            <ImagePlus size={16} aria-hidden="true" />
            {busy ? "Please wait..." : "Upload photo"}
          </button>
        </form>
      )}

      {canUpload && photos.length >= 3 && (
        <p className="small muted">Photo limit reached. Remove a photo before adding another.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="success" role="status">{notice}</p>}
    </section>
  );
}
