# Recipe Dost Milestones

## M17B - Explicit Queue Processor Mode with Render Wake

- Status: Done after validation.
- Added `MEDIA_PROCESSOR_MODE=queue` for Render queue workers: media jobs remain `queued`, `/process-job` is not called, and the worker can be woken with a short GET `/wake` request.
- Queue mode records `queued_for_queue_worker` plus a wake success/failure event without storing the worker URL.
- Manual mode and worker webhook mode remain unchanged.

## A-M15C - Real Source Metadata Display

- Status: Done after validation.
- Media job polling now includes `source_metadata` and the app displays safe source title, description, platform, resolver, duration, size, and thumbnail metadata when available.
- Completed recipe result screens can show the same safe source metadata without querying private processing metadata or displaying CDN URLs.
- Mock recipe result labeling remains subtle and development-oriented.

## A-M15B - Public Source Metadata + Private Processing Metadata Schema

- Status: Done after migration applied.
- Added public app-visible `media_jobs.source_metadata` JSONB storage for safe source metadata.
- Added private backend-only `media_job_private_metadata` storage for resolver/CDN/raw processing metadata.
- CDN URLs remain backend-only and must not be stored in `media_jobs.source_metadata`.

## Current Worker Testing

- A-M14R1 local worker testing requires `MEDIA_PROCESSOR_MODE=manual` for `supabase/functions/create-media-job`.
- Cloud Run worker triggering remains available with `MEDIA_PROCESSOR_MODE=worker`, the default.
- During local and Render worker testing, Cloud Run is bypassed so app-created `media_jobs` can stay queued for manual/local processing instead of being picked up by the old worker.
