import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ProjectKind } from "../api/types";
import type { SearchSuggestion } from "../domain/graphModel";
import { DEFAULT_KINDS, KIND_CLASS, KIND_LABELS, KIND_SHORT } from "../domain/projectKinds";

interface SearchFilterDockProps {
  searchText: string;
  setSearchText(value: string): void;
  suggestions: SearchSuggestion[];
  onSuggestionSelect(id: string): void;
  filterOpen: boolean;
  setFilterOpen(update: (current: boolean) => boolean): void;
  kindFilters: Record<ProjectKind, boolean>;
  setKindFilters(update: (current: Record<ProjectKind, boolean>) => Record<ProjectKind, boolean>): void;
  showPackages: boolean;
  setShowPackages(value: boolean): void;
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
  showPackages,
  setShowPackages,
}: SearchFilterDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (event: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setFilterOpen(() => false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen, setFilterOpen]);

  const grouped = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return null;
    const matching = suggestions.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        String(item.sublabel || "").toLowerCase().includes(query),
    );
    return {
      projects: matching.filter((s) => s.type === "project"),
      packages: matching.filter((s) => s.type === "package"),
    };
  }, [suggestions, searchText]);

  const hasResults = grouped && (grouped.projects.length > 0 || grouped.packages.length > 0);
  const flatResults = useMemo(
    () => grouped ? [...grouped.projects, ...grouped.packages] : [],
    [grouped],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [searchText]);

  const selectSuggestion = (id?: string) => {
    if (!id) return;
    onSuggestionSelect(id);
    setSearchText("");
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setSearchText("");
      setFilterOpen(() => false);
      return;
    }

    if (!flatResults.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % flatResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + flatResults.length) % flatResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectSuggestion(flatResults[activeIndex]?.id);
    }
  };

  const resultIndex = (id: string) => flatResults.findIndex((item) => item.id === id);

  return (
    <div className="search-dock" ref={dockRef}>
      <div className="dock-panel search-filter-panel">
        <div className="search-row">
          <input
            className="search-input"
            type="search"
            value={searchText}
            placeholder="Search projects and packages…"
            title="Search project names, package IDs, and package classifications"
            role="combobox"
            aria-expanded={Boolean(grouped)}
            aria-controls="search-suggestions"
            aria-activedescendant={flatResults[activeIndex] ? `suggestion-${flatResults[activeIndex].id}` : undefined}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button
            className={`ghost-button filter-toggle${filterOpen ? " active" : ""}`}
            type="button"
            aria-pressed={filterOpen}
            title="Filter by type"
            onClick={() => setFilterOpen((c) => !c)}
          >
            Filter
          </button>
        </div>

        {hasResults ? (
          <div className="suggestions-dropdown" id="search-suggestions" role="listbox">
            {grouped.projects.length > 0 && (
              <>
                <div className="suggestions-section-header">Projects</div>
                {grouped.projects.map((item) => {
                  const index = resultIndex(item.id);
                  return (
                  <button
                    key={item.id}
                    id={`suggestion-${item.id}`}
                    className={`suggestion-item${index === activeIndex ? " active" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectSuggestion(item.id)}
                  >
                    <span className="suggestion-main">{item.label}</span>
                    {item.kinds && item.kinds.length > 0 && (
                      <span className="suggestion-tags">
                        {item.kinds.map((kind) => (
                          <span key={kind} className={`suggestion-kind-tag ${KIND_CLASS[kind]}`} title={KIND_LABELS[kind]}>
                            {KIND_SHORT[kind]}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                );})}
              </>
            )}
            {grouped.packages.length > 0 && (
              <>
                <div className="suggestions-section-header">Packages</div>
                {grouped.packages.map((item) => {
                  const index = resultIndex(item.id);
                  return (
                  <button
                    key={item.id}
                    id={`suggestion-${item.id}`}
                    className={`suggestion-item${index === activeIndex ? " active" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectSuggestion(item.id)}
                  >
                    <span className="suggestion-main">{item.label}</span>
                    {item.sublabel && <span className="suggestion-meta">{item.sublabel}</span>}
                  </button>
                );})}
              </>
            )}
          </div>
        ) : grouped && !hasResults ? (
          <div className="suggestions-empty">No results</div>
        ) : null}

        {filterOpen && (
          <div className="filters-panel">
            <div className="filter-pills">
              {DEFAULT_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`kind-pill${kindFilters[kind] !== false ? " active" : ""}`}
                  aria-pressed={kindFilters[kind] !== false}
                  title={KIND_LABELS[kind]}
                  onClick={() => setKindFilters((c) => ({ ...c, [kind]: !c[kind] }))}
                >
                  <span className={`kind-pill-shape ${KIND_CLASS[kind]}`} title={KIND_LABELS[kind]} />
                  {KIND_SHORT[kind]}
                </button>
              ))}
              <button
                type="button"
                className={`kind-pill package-pill${showPackages ? " active" : ""}`}
                aria-pressed={showPackages}
                title="Show external and unresolved package nodes. Internal package IDs stay searchable through their producer project."
                onClick={() => setShowPackages(!showPackages)}
              >
                <span className="kind-pill-shape package-pill-shape" title="Package node" />
                External / unknown packages
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
