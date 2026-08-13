import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const STATES = ["To do", "Doing", "Resolved", "Done"];

const emptyForm = {
  title: "",
  assignedTo: "",
  devResource: "",
  testResource: "",
  state: "To do",
  description: "",
  discussion: "",
  priority: "",
  plannedReleaseDate: "",
  severity: "",
  reproSteps: "",
  systemInfo: "",
  descriptionImages: [],
  discussionImages: [],
};

const TRACKED_FORM_FIELDS = [
  "title",
  "devResource",
  "testResource",
  "state",
  "description",
  "discussion",
  "priority",
  "plannedReleaseDate",
  "severity",
  "reproSteps",
  "systemInfo",
  "descriptionImages",
  "discussionImages",
];

function TaskManager({
  projectId,
  projectName,
  organizationId,
  canCreateTasks,
  onBack,
}) {
  const [taskType, setTaskType] = useState("story");
  const [showForm, setShowForm] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(null);
  const [discardAction, setDiscardAction] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const userNameById = useMemo(
    () =>
      users.reduce((map, user) => {
        map[user.id] = user.name || user.email;
        return map;
      }, {}),
    [users]
  );

  const currentUserLabel =
    auth.currentUser?.displayName || auth.currentUser?.email || "Unknown user";

  const getUserName = (userId) => userNameById[userId] || "";

  const getInitials = (name) => {
    if (!name) return "";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  };

  const isTestingState = (state) => state === "Resolved" || state === "Done";

  const getResourceForState = (item, state = item.state) => {
    const devResource = item.devResource || item.assignedTo || "";
    const testResource = item.testResource || "";
    return isTestingState(state) ? testResource || devResource : devResource;
  };

  const renderPerson = (userId, fallback = "No one selected") => {
    const name = getUserName(userId);

    if (!name) {
      return <span className="person-empty">{fallback}</span>;
    }

    return (
      <span className="person-chip" title={name}>
        <span className="person-avatar">{getInitials(name)}</span>
        <span>{name}</span>
      </span>
    );
  };

  const fetchTasks = async () => {
    const snap = await getDocs(
      query(collection(db, "tasks"), where("organizationId", "==", organizationId))
    );
    const projectTasks = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) => t.projectId === projectId)
      .sort((a, b) => (a.number || 0) - (b.number || 0));

    setTasks(
      projectTasks.map((task, index) => ({
        ...task,
        displayNumber: task.number || index + 1,
      }))
    );
  };

  const fetchUsers = async () => {
    const snap = await getDocs(
      query(collection(db, "users"), where("organizationId", "==", organizationId))
    );
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const refreshData = async () => {
    await Promise.all([fetchTasks(), fetchUsers()]);
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateDetailField = (field, value) => {
    setDetailForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const getTrackedFormSnapshot = (item) =>
    TRACKED_FORM_FIELDS.reduce((snapshot, field) => {
      snapshot[field] = item?.[field] || emptyForm[field];
      return snapshot;
    }, {});

  const hasFormChanges = (current, original = emptyForm) =>
    JSON.stringify(getTrackedFormSnapshot(current)) !==
    JSON.stringify(getTrackedFormSnapshot(original));

  const normalizeImages = (images) =>
    (Array.isArray(images) ? images.flat(Infinity) : [])
      .map((image) => {
        if (typeof image === "string") {
          return { name: "Attachment", src: image };
        }

        if (!image || typeof image !== "object") return null;

        const src = typeof image.src === "string" ? image.src : "";
        if (!src) return null;

        return {
          name: typeof image.name === "string" ? image.name : "Attachment",
          src,
        };
      })
      .filter(Boolean);

  const normalizeChangeHistory = (entries) =>
    (Array.isArray(entries) ? entries.flat(Infinity) : [])
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null;
        }

        return {
          field: typeof entry.field === "string" ? entry.field : "Work item",
          changedBy: typeof entry.changedBy === "string" ? entry.changedBy : "",
          changedById:
            typeof entry.changedById === "string" ? entry.changedById : "",
          changedAt:
            typeof entry.changedAt === "string"
              ? entry.changedAt
              : new Date().toISOString(),
        };
      })
      .filter(Boolean);

  const readImages = (files, callback) => {
    const imageFiles = Array.from(files || []).filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length === 0) return;

    Promise.all(
      imageFiles.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({ name: file.name, src: String(reader.result) });
            reader.readAsDataURL(file);
          })
      )
    ).then(callback);
  };

  const addImagesToForm = (field, files) => {
    readImages(files, (images) => {
      setForm((current) => ({
        ...current,
        [field]: normalizeImages([...(current[field] || []), ...images]),
      }));
    });
  };

  const addImagesToDetail = (field, files) => {
    readImages(files, (images) => {
      setDetailForm((current) => ({
        ...current,
        [field]: normalizeImages([...(current[field] || []), ...images]),
      }));
    });
  };

  const removeImageFromForm = (field, indexToRemove) => {
    setForm((current) => ({
      ...current,
      [field]: (current[field] || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const removeImageFromDetail = (field, indexToRemove) => {
    setDetailForm((current) => ({
      ...current,
      [field]: (current[field] || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const addTask = async () => {
    if (!canCreateTasks) return;
    setStatus(null);

    if (!form.title.trim()) {
      setStatus({ type: "error", message: "Title cannot be empty." });
      return;
    }

    const nextNumber =
      tasks.reduce(
        (highest, task) => Math.max(highest, task.number || task.displayNumber || 0),
        0
      ) + 1;

    await addDoc(collection(db, "tasks"), {
      ...form,
      descriptionImages: normalizeImages(form.descriptionImages),
      discussionImages: normalizeImages(form.discussionImages),
      assignedTo: getResourceForState(form, form.state),
      projectId,
      organizationId,
      title: form.title.trim(),
      type: taskType,
      number: nextNumber,
      changeHistory: [],
      createdBy: auth.currentUser?.uid || "",
      createdByEmail: auth.currentUser?.email || "",
      createdByName: currentUserLabel,
      createdAt: new Date().toISOString(),
    });
    resetForm();
    setShowForm(false);
    await fetchTasks();
  };

  const updateTaskState = async (item, state) => {
    await updateDoc(doc(db, "tasks", item.id), {
      state,
      assignedTo: getResourceForState(item, state),
      updatedAt: new Date().toISOString(),
    });
    await fetchTasks();
  };

  const openItemDetails = (item) => {
    setSelectedItem(item);
    setDetailForm({
      ...emptyForm,
      ...item,
      devResource: item.devResource || item.assignedTo || "",
      testResource: item.testResource || "",
      descriptionImages: normalizeImages(item.descriptionImages),
      discussionImages: normalizeImages(item.discussionImages),
      changeHistory: normalizeChangeHistory(item.changeHistory),
    });
    setShowForm(false);
    setStatus(null);
  };

  const requestDiscard = (action, hasChanges) => {
    if (hasChanges) {
      setDiscardAction(() => action);
      return;
    }

    action();
    setStatus(null);
  };

  const confirmDiscard = () => {
    discardAction?.();
    setDiscardAction(null);
    setStatus(null);
  };

  const cancelDiscard = () => {
    setDiscardAction(null);
  };

  const closeNewItemForm = () => {
    requestDiscard(() => {
      resetForm();
      setShowForm(false);
    }, hasFormChanges(form));
  };

  const closeItemDetails = () => {
    requestDiscard(() => {
      setSelectedItem(null);
      setDetailForm(null);
    }, hasFormChanges(detailForm, {
      ...emptyForm,
      ...selectedItem,
      devResource: selectedItem?.devResource || selectedItem?.assignedTo || "",
      descriptionImages: normalizeImages(selectedItem?.descriptionImages),
      discussionImages: normalizeImages(selectedItem?.discussionImages),
    }));
  };

  const saveItemDetails = async () => {
    if (!selectedItem || !detailForm) return;
    setStatus(null);

    try {
      const changeHistory = normalizeChangeHistory(selectedItem.changeHistory);
      const changedAt = new Date().toISOString();

      if (detailForm.description !== (selectedItem.description || "")) {
        changeHistory.push({
          field: "Description",
          changedBy: currentUserLabel,
          changedById: auth.currentUser?.uid || "",
          changedAt,
        });
      }

      if (detailForm.discussion !== (selectedItem.discussion || "")) {
        changeHistory.push({
          field: "Discussion",
          changedBy: currentUserLabel,
          changedById: auth.currentUser?.uid || "",
          changedAt,
        });
      }

      const payload = {
        assignedTo: getResourceForState(detailForm, detailForm.state),
        devResource: detailForm.devResource || detailForm.assignedTo || "",
        testResource: detailForm.testResource || "",
        state: detailForm.state || "To do",
        description: detailForm.description || "",
        discussion: detailForm.discussion || "",
        priority: detailForm.priority || "",
        plannedReleaseDate: detailForm.plannedReleaseDate || "",
        severity: detailForm.severity || "",
        reproSteps: detailForm.reproSteps || "",
        systemInfo: detailForm.systemInfo || "",
        descriptionImages: normalizeImages(detailForm.descriptionImages),
        discussionImages: normalizeImages(detailForm.discussionImages),
        changeHistory: normalizeChangeHistory(changeHistory),
        updatedAt: changedAt,
      };

      await updateDoc(doc(db, "tasks", selectedItem.id), payload);
      await fetchTasks();
      setSelectedItem(null);
      setDetailForm(null);
      setStatus({ type: "success", message: "Work item saved." });
    } catch (err) {
      setStatus({
        type: "error",
        message: err.message || "Work item save failed.",
      });
    }
  };

  useEffect(() => {
    refreshData();
  }, [projectId, organizationId]);

  const renderStatus = () =>
    status && (
      <div className={`inline-status ${status.type}`} role="status">
        <span className="status-mark" aria-hidden="true" />
        <span>{status.message}</span>
      </div>
    );

  const renderImageList = (images, onRemove) => {
    const safeImages = normalizeImages(images);

    return (
      safeImages.length > 0 && (
      <div className="attachment-grid">
        {safeImages.map((image, index) => (
          <div className="attachment-tile" key={`${image.name || "image"}-${index}`}>
            <img alt={image.name || "Attachment"} src={image.src} />
            <button
              className="attachment-download"
              type="button"
              onClick={() => setPreviewImage(image)}
            >
              View
            </button>
            <button
              className="attachment-remove"
              type="button"
              aria-label={`Remove ${image.name || "attachment"}`}
              onClick={() => onRemove(index)}
            >
              X
            </button>
          </div>
        ))}
      </div>
      )
    );
  };

  const renderImagePreviewDialog = () =>
    previewImage && (
      <div
        className="modal-backdrop"
        role="presentation"
        onClick={() => setPreviewImage(null)}
      >
        <div
          aria-label={previewImage.name || "Attachment preview"}
          aria-modal="true"
          className="image-preview-dialog"
          role="dialog"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="image-preview-bar">
            <b>{previewImage.name || "Attachment"}</b>
            <button
              className="attachment-remove image-preview-close"
              type="button"
              aria-label="Close image preview"
              onClick={() => setPreviewImage(null)}
            >
              X
            </button>
          </div>
          <img alt={previewImage.name || "Attachment preview"} src={previewImage.src} />
        </div>
      </div>
    );

  const renderResourceSelect = (value, onChange, label, fallbackLabel) => (
    <div className="resource-field">
      <span>{label}</span>
      <div className="resource-picker">
        <button className="resource-trigger" type="button">
          {renderPerson(value, fallbackLabel)}
          <span className="resource-caret" aria-hidden="true" />
        </button>
        <div className="resource-menu" role="listbox">
          <button
            className={!value ? "resource-option selected" : "resource-option"}
            type="button"
            onClick={() => onChange("")}
          >
            <span className="person-empty">{fallbackLabel}</span>
          </button>
          {users.map((user) => {
            const name = user.name || user.email;

            return (
              <button
                className={
                  value === user.id ? "resource-option selected" : "resource-option"
                }
                key={user.id}
                type="button"
                onClick={() => onChange(user.id)}
              >
                <span className="person-chip" title={name}>
                  <span className="person-avatar">{getInitials(name)}</span>
                  <span>{name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderDiscardDialog = () =>
    discardAction && (
      <div className="modal-backdrop" role="presentation">
        <div
          aria-labelledby="discard-title"
          aria-modal="true"
          className="confirm-dialog"
          role="dialog"
        >
          <h3 id="discard-title">Discard changes?</h3>
          <p>Changes on this screen will be removed.</p>
          <div className="confirm-actions">
            <button className="secondary-button" type="button" onClick={cancelDiscard}>
              Cancel
            </button>
            <button className="danger-button" type="button" onClick={confirmDiscard}>
              Discard
            </button>
          </div>
        </div>
      </div>
    );

  if (selectedItem && detailForm) {
    const isBug = detailForm.type === "bug";

    return (
      <div className="work-form">
        <div className="work-form-bar">
          <b>
            #{detailForm.number || detailForm.displayNumber || "-"} {detailForm.title}
          </b>
          <button
            className="back-button"
            type="button"
            aria-label="Back to Work Items"
            title="Back to Work Items"
            onClick={closeItemDetails}
          >
            <span className="back-icon" aria-hidden="true">&lt;</span>
            <span>Back</span>
          </button>
          <button type="button" onClick={saveItemDetails}>
            Save
          </button>
        </div>
        <div className={isBug ? "work-type-line bug" : "work-type-line story"}>
          {isBug ? "BUG" : "USER STORY"} created by{" "}
          {detailForm.createdByName || detailForm.createdByEmail || "Unknown user"}
        </div>
        {renderStatus()}
        <div className="work-meta">
          {renderPerson(
            getResourceForState(detailForm, detailForm.state),
            "No resource selected"
          )}
          <label>
            State
            <select
              value={detailForm.state || "To do"}
              onChange={(e) => updateDetailField("state", e.target.value)}
            >
              {STATES.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="work-form-grid compact">
          <section>
            <h3>Description</h3>
            <textarea
              placeholder="Click to add"
              value={detailForm.description || ""}
              onChange={(e) => updateDetailField("description", e.target.value)}
            />
            {renderImageList(detailForm.descriptionImages, (index) =>
              removeImageFromDetail("descriptionImages", index)
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addImagesToDetail("descriptionImages", e.target.files)}
            />
            <h3>Discussion</h3>
            <textarea
              placeholder="Add discussion"
              value={detailForm.discussion || ""}
              onChange={(e) => updateDetailField("discussion", e.target.value)}
            />
            {renderImageList(detailForm.discussionImages, (index) =>
              removeImageFromDetail("discussionImages", index)
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addImagesToDetail("discussionImages", e.target.files)}
            />
          </section>
          <section>
            <h3>Resources</h3>
            <div className="resource-stack">
              {renderResourceSelect(
                detailForm.devResource || detailForm.assignedTo || "",
                (value) => updateDetailField("devResource", value),
                "Dev Resource",
                "Select dev resource"
              )}
              {renderResourceSelect(
                detailForm.testResource || "",
                (value) => updateDetailField("testResource", value),
                "Test Resource",
                "Select test resource"
              )}
            </div>
            <h3>{isBug ? "Bug Details" : "Planning"}</h3>
            <input
              placeholder={isBug ? "Severity" : "Priority"}
              value={isBug ? detailForm.severity || "" : detailForm.priority || ""}
              onChange={(e) =>
                updateDetailField(isBug ? "severity" : "priority", e.target.value)
              }
            />
            {isBug && (
              <>
                <input
                  placeholder="Repro steps"
                  value={detailForm.reproSteps || ""}
                  onChange={(e) => updateDetailField("reproSteps", e.target.value)}
                />
                <input
                  placeholder="System info"
                  value={detailForm.systemInfo || ""}
                  onChange={(e) => updateDetailField("systemInfo", e.target.value)}
                />
              </>
            )}
            {!isBug && (
              <input
                type="date"
                value={detailForm.plannedReleaseDate || ""}
                onChange={(e) =>
                  updateDetailField("plannedReleaseDate", e.target.value)
                }
              />
            )}
          </section>
          <section>
            <h3>History</h3>
            <p>
              Created by{" "}
              {detailForm.createdByName || detailForm.createdByEmail || "Unknown user"}
            </p>
            {(detailForm.changeHistory || []).length === 0 && (
              <p>No description or discussion changes yet.</p>
            )}
            {(detailForm.changeHistory || []).map((entry, index) => (
              <div className="history-row" key={`${entry.changedAt}-${index}`}>
                <b>{entry.field}</b>
                <span>{entry.changedBy}</span>
                <span>{new Date(entry.changedAt).toLocaleString()}</span>
              </div>
            ))}
          </section>
        </div>
        {renderImagePreviewDialog()}
        {renderDiscardDialog()}
      </div>
    );
  }

  if (showForm) {
    const isBug = taskType === "bug";

    return (
      <div className="work-form">
        <div className="work-form-bar">
          <b>Work Items</b>
          <button
            className="back-button"
            type="button"
            aria-label="Back to Work Items"
            title="Back to Work Items"
            onClick={closeNewItemForm}
          >
            <span className="back-icon" aria-hidden="true">&lt;</span>
            <span>Back</span>
          </button>
        </div>
        <div className={isBug ? "work-type-line bug" : "work-type-line story"}>
          NEW {isBug ? "BUG" : "USER STORY"}
        </div>
        <input
          className="work-title-input"
          placeholder="Enter title"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
        />
        <div className="work-meta">
          {renderPerson(getResourceForState(form, form.state), "No resource selected")}
          <button type="button" onClick={addTask}>
            Save
          </button>
        </div>
        <div className="work-state-row">
          <label>
            State
            <select
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
            >
              {STATES.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
          <span>Area: {projectName}</span>
          <span>Iteration: {projectName}</span>
        </div>
        {renderStatus()}
        <div className="work-form-grid compact">
          <section>
            <h3>Description</h3>
            <textarea
              placeholder="Click to add"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
            />
            {renderImageList(form.descriptionImages, (index) =>
              removeImageFromForm("descriptionImages", index)
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addImagesToForm("descriptionImages", e.target.files)}
            />
            <h3>Discussion</h3>
            <textarea
              placeholder="Add discussion"
              value={form.discussion}
              onChange={(e) => updateField("discussion", e.target.value)}
            />
            {renderImageList(form.discussionImages, (index) =>
              removeImageFromForm("discussionImages", index)
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addImagesToForm("discussionImages", e.target.files)}
            />
          </section>
          <section>
            <h3>Resources</h3>
            <div className="resource-stack">
              {renderResourceSelect(
                form.devResource,
                (value) => updateField("devResource", value),
                "Dev Resource",
                "Select dev resource"
              )}
              {renderResourceSelect(
                form.testResource,
                (value) => updateField("testResource", value),
                "Test Resource",
                "Select test resource"
              )}
            </div>
            <h3>{isBug ? "Bug Details" : "Planning"}</h3>
            <input
              placeholder={isBug ? "Severity" : "Priority"}
              value={isBug ? form.severity : form.priority}
              onChange={(e) =>
                updateField(isBug ? "severity" : "priority", e.target.value)
              }
            />
            {isBug && (
              <>
                <input
                  placeholder="Repro steps"
                  value={form.reproSteps}
                  onChange={(e) => updateField("reproSteps", e.target.value)}
                />
                <input
                  placeholder="System info"
                  value={form.systemInfo}
                  onChange={(e) => updateField("systemInfo", e.target.value)}
                />
              </>
            )}
            {!isBug && (
              <input
                type="date"
                value={form.plannedReleaseDate}
                onChange={(e) => updateField("plannedReleaseDate", e.target.value)}
              />
            )}
          </section>
        </div>
        {renderImagePreviewDialog()}
        {renderDiscardDialog()}
      </div>
    );
  }

  return (
    <div className="work-items-page">
      <div className="work-header">
        <button
          className="back-button"
          type="button"
          aria-label="Back to Projects"
          title="Back to Projects"
          onClick={onBack}
        >
          <span className="back-icon" aria-hidden="true">&lt;</span>
          <span>Back</span>
        </button>
        <h1>{projectName}</h1>
      </div>
      <div className="work-toolbar">
        <h2>Work items</h2>
        <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
          <option value="story">Story</option>
          <option value="bug">Bug</option>
        </select>
        <button type="button" onClick={() => setShowForm(true)}>
          New Work Item
        </button>
      </div>
      {tasks.length === 0 && (
        <div className="empty-work">Your work, all in one place</div>
      )}
      {tasks.length > 0 && (
        <div className="work-table" role="table" aria-label="Work items">
          <div className="work-table-head" role="row">
            <span aria-hidden="true" />
            <span>ID</span>
            <span>Title</span>
            <span aria-hidden="true" />
            <span>State</span>
            <span>Area Path</span>
          </div>
          {tasks.map((item, index) => {
            const state = item.state || "To do";
            const activeResource = getResourceForState(item, state);

            return (
              <div className="work-row" key={item.id} role="row">
                <span
                  className={index === 0 ? "row-selector selected" : "row-selector"}
                />
                <span className="work-number">{item.number || item.displayNumber}</span>
                <button
                  className="work-title-button"
                  type="button"
                  onClick={() => openItemDetails(item)}
                >
                  <span
                    className={
                      item.type === "bug" ? "work-type-icon bug" : "work-type-icon story"
                    }
                    aria-hidden="true"
                  />
                  <span>{item.title}</span>
                  {activeResource && (
                    <span className="work-row-person">{renderPerson(activeResource)}</span>
                  )}
                </button>
                <button
                  className="row-menu-button"
                  type="button"
                  aria-label={`Open work item ${item.number || item.displayNumber}`}
                  onClick={() => openItemDetails(item)}
                >
                  ...
                </button>
                <div className="state-cell">
                  <span className="state-dot" aria-hidden="true" />
                  <span>{state}</span>
                </div>
                <span className="area-path">{projectName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TaskManager;
