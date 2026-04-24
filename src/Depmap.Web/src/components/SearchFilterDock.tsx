import { useMemo } from "react";
import type { ProjectKind } from "../api/types";
import type { SearchSuggestion } from "../domain/graphModel";
import { DEFAULT_KINDS, KIND_CLASS, KIND_LABELS, KIND_NOTES } from "../domain/projectKinds";

interface SearchFilterDockProps {
  searchText: string;
  setSearchText(value: string): void;
  suggestions: SearchSuggestion[];
  onSuggestionSelect(id: string): void;
  filterOpen: boolean;
  setFilterOpen(update: (current: boolean) => boolean): void;
  kindFilters: Record<ProjectKind, boolean>;
  setKindFilters(update: (current: Record<ProjectKind, boolean>) => Record<ProjectKind, boolean>): void;
  showExternal: boolean;
  setShowExternal(value: boolean): void;
}

export function SearchFilterDock({
  searchText,
  setSearchText,
  suggestions,
  onSuggestionSelect,
  filterOpen,
  setFilterOpen,
  kindFilters,
  setKindFilters,
  showExternal,
  setShowExternal,
}: SearchFilterDockProps) {
  const visibleSuggestions = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];

    return suggestions
      .filter((item) => item.label.toLowerCase().includes(query) || String(item.sublabel || "").toLowerCase().includes(query))
      .slice(0, 8);
  }, [suggestions, searchText]);

  return (
    <div className="top-right-dock">
      <div className="dock-panel search-filter-panel">
        <div className="search-row">
          <input
            className="search-input"
            type="search"
            value={searchText}
            placeholder="Search projects and packages..."
            onChange={(event) => setSearchText(event.target.value)}
          />
          <button className={`ghost-button filter-toggle ${filterOpen ? "active" : ""}`} type="button" title="Open filters" onClick={() => setFilterOpen((current) => !current)}>
            Filter
          </button>
        </div>

        {visibleSuggestions.length > 0 ? (
          <div className="suggestions-list">
            {visibleSuggestions.map((item) => (
              <button key={`${item.type}:${item.id}`} className="suggestion-item" type="button" onClick={() => onSuggestionSelect(item.id)}>
                <span className="suggestion-main">{item.label}</span>
                <span className="suggestion-meta">{item.sublabel ? `${item.type} | ${item.sublabel}` : item.type}</span>
              </button>
            ))}
          </div>
        ) : null}

        {filterOpen ? (
          <div className="filters-panel">
            <div className="filter-list">
              {DEFAULT_KINDS.map((kind) => (
                <label key={kind} className="filter-item" title={KIND_NOTES[kind]}>
                  <input
                    type="checkbox"
                    checked={kindFilters[kind] !== false}
                    onChange={(event) => setKindFilters((current) => ({ ...current, [kind]: event.target.checked }))}
                  />
                  <span className={`shape-chip project-shape ${KIND_CLASS[kind]}`} />
                  <span className="filter-text">{KIND_LABELS[kind]}</span>
                </label>
              ))}
              <label className="filter-item" title="Show unresolved package leaves.">
                <input type="checkbox" checked={showExternal} onChange={(event) => setShowExternal(event.target.checked)} />
                <span className="shape-chip package-shape pkg-unknown" />
                <span className="filter-text">Show External / Unknown Packages</span>
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
