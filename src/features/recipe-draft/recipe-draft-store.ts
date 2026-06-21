import { RecipeLinkDraft } from '@/features/recipe-draft/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { secureStoreStorage } from '@/lib/storage/secure-store-storage'

type RecipeDraftState = {
  draft: RecipeLinkDraft | null
  setDraft: (draft: RecipeLinkDraft) => void
  updateDraft: (draft: Partial<RecipeLinkDraft>) => void
  clearDraft: () => void
}

export const useRecipeDraftStore = create<RecipeDraftState>()(
  persist(
    (set) => ({
      draft: null,
      setDraft: (draft) => set({ draft }),
      updateDraft: (draft) =>
        set((state) => ({
          draft: state.draft ? { ...state.draft, ...draft } : null,
        })),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: 'recipe-dost-link-draft',
      storage: createJSONStorage(() => secureStoreStorage),
    }
  )
)
