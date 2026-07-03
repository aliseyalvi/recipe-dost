export type RecipeThumbnailSource = {
  thumbnail_url?: string | null
  latest_media_job?: {
    thumbnail_url: string | null
    source_metadata: {
      uploaded_thumbnail_url?: string
    }
  } | null
}

export function getRecipeCardThumbnail(item: RecipeThumbnailSource) {
  return (
    item.latest_media_job?.thumbnail_url ??
    item.latest_media_job?.source_metadata.uploaded_thumbnail_url ??
    item.thumbnail_url ??
    null
  )
}
