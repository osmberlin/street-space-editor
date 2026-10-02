import { mapillaryGraphGet } from './graphApi'

/**
 * Highlight imagery of listed users and organizations (iD Radnetz fork, feature 18).
 * Tiles only carry `creator_id` and `organization_id`. Usernames resolve to creator ids with
 * `images?creator_username=`; organization slugs by resolving each organization id seen in the
 * tiles with `/{id}?fields=slug`. Everything is cached for the lifetime of the resolver.
 */
export type HighlightSubject = {
  creatorId?: string | null
  organizationId?: string | null
}

export const createMapillaryHighlightResolver = (onResolved: () => void = () => {}) => {
  /** lower case username → creator id (`null`: not found) */
  const creatorIds = new Map<string, string | null>()
  /** organization id → lower case slug (`null`: not found) */
  const orgSlugs = new Map<string, string | null>()
  const pending = new Set<string>()

  const request = (key: string, run: () => Promise<void>) => {
    if (pending.has(key)) {
      return
    }
    pending.add(key)
    void run()
      .catch(() => {})
      .then(onResolved)
  }

  const lookupUser = (name: string) => {
    if (creatorIds.has(name)) {
      return
    }
    request(`u:${name}`, async () => {
      creatorIds.set(name, null)
      const json = await mapillaryGraphGet<{ data?: { creator?: { id?: string } }[] }>('images', {
        creator_username: name,
        limit: '1',
        fields: 'creator',
      })
      creatorIds.set(name, json.data?.[0]?.creator?.id ?? null)
    })
  }

  const lookupOrg = (id: string) => {
    if (orgSlugs.has(id)) {
      return
    }
    request(`o:${id}`, async () => {
      orgSlugs.set(id, null)
      const json = await mapillaryGraphGet<{ slug?: string }>(id, { fields: 'slug' })
      orgSlugs.set(id, json.slug ? json.slug.toLowerCase() : null)
    })
  }

  return {
    /**
     * Whether the subject belongs to a listed user or organization. Starts lookups for what is not
     * known yet and calls `onResolved` when they finish, so the caller can re-render.
     */
    isHighlighted: (subject: HighlightSubject, users: string[], orgs: string[]): boolean => {
      let hit = false
      if (subject.creatorId != null) {
        for (const user of users) {
          const name = user.toLowerCase()
          lookupUser(name)
          if (creatorIds.get(name) === String(subject.creatorId)) {
            hit = true
          }
        }
      }
      if (subject.organizationId != null && orgs.length > 0) {
        const orgId = String(subject.organizationId)
        lookupOrg(orgId)
        const slug = orgSlugs.get(orgId)
        if (slug && orgs.some((org) => org.toLowerCase() === slug)) {
          hit = true
        }
      }
      return hit
    },
    /** Creator ids of the usernames resolved so far (for map filters by `creatorId`). */
    creatorIdsOf: (users: string[]): string[] =>
      users.flatMap((user) => {
        const name = user.toLowerCase()
        lookupUser(name)
        return creatorIds.get(name) ?? []
      }),
  }
}
