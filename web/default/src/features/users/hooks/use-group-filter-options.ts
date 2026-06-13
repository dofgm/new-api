import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getGroups } from '../api'

/**
 * CUSTOM: fetch available user groups and expose them as faceted-filter options.
 *
 * Upstream's users-table registers a `group` columnFilter but never renders a
 * toolbar control for it (incomplete stub). This hook supplies the options so
 * the table can show a real Group dropdown alongside Status/Role.
 *
 * Kept in a separate file to minimize the custom footprint inside the
 * upstream-owned users-table.tsx and reduce future merge-conflict surface.
 */
export function useGroupFilterOptions() {
  const { data: groupsResponse } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getGroups,
    staleTime: 5 * 60 * 1000,
  })

  return useMemo(() => {
    const groups = groupsResponse?.data
    if (!Array.isArray(groups)) return []
    return groups.map((g: string) => ({ label: g, value: g }))
  }, [groupsResponse])
}
