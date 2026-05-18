# Enterprise Task Workflow Module

Production-oriented React + Tailwind + Express + MongoDB task workflow slice.

## Workflow

Tasks move through:

`todo -> in_progress -> ready_for_review -> approved -> completed`

Employees can only update progress, add progress notes, upload attachments, add comments, and submit assigned tasks for review. Managers and admins can create, edit, reassign, review, complete, and delete tasks.

## Backend

Location: `backend/src`

- `models/Task.ts` - task schema, priorities, statuses, workflow transitions.
- `models/TaskActivity.ts` - activity timeline schema for progress, comments, attachments, status, assignment, deadline, and review decisions.
- `middleware/auth.ts` - JWT auth and role helpers for `employee`, `manager`, and `admin`.
- `controllers/task.controller.ts` - task CRUD, admin updates, progress rules, review/approval, completion, deletion cleanup.
- `controllers/task-comment.controller.ts` - accessible task comments with timeline logging.
- `controllers/task-attachment.controller.ts` - attachment metadata with preview URLs and timeline logging.
- `routes/task.routes.ts` - protected REST API surface.

Run:

```bash
cd enterprise-task-system/backend
npm install
npm run dev
```

Required environment:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/aslenix_tasks
JWT_SECRET=replace-me
CORS_ORIGIN=http://localhost:5173
PORT=4000
```

## Frontend

Location: `frontend/src`

- `components/EnterpriseTaskDetail.tsx` - complete task detail workspace.
- `components/TaskHeader.tsx` - task ID, assigned employee, created date, last updated.
- `components/TaskAdminEditor.tsx` - admin/manager editor and employee read-only task fields.
- `components/ProgressUpdatePanel.tsx` - progress slider, required update notes, submit for review.
- `components/ActivityTimeline.tsx` - enterprise activity feed.
- `components/AttachmentPreviewGrid.tsx` - file and image previews.
- `components/CommentsPanel.tsx` - employee/admin comments and review comments.
- `api/taskApi.ts` - REST client.

Set `VITE_TASK_API_BASE` if the API is not running on `http://localhost:4000/api`.
