import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ProjectKind, RepoNode } from "../api/types";
import type { SearchSuggestion } from "../domain/graphModel";
import { DEFAULT_KINDS, KIND_CLASS, KIND_LABELS, KIND_SHORT } from "../domain/projectKinds";

interface SearchFilterDockProps {
  searchText: string;
  setSearchText(value: string): void;
  suggestions: SearchSuggestion[];
  onSuggestionSelect(id: string): void;
  repos: RepoNode[];
  compactRepoFilter: boolean;
  filterOpen: boolean;
  setFilterOpen(update: (current: boolean) => boolean): void;
  kindFilters: Record<ProjectKind, boolean>;
  setKindFilters(update: (current: Record<ProjectKind, boolean>) => Record<ProjectKind, boolean>): void;
  repoFilters: Record<string, boolean>;
  setRepoFilters(update: (current: Record<string, boolean>) => Record<string, boolean>): void;
  showPackages: boolean;
  setShowPackages(value: boolean): void;
}

export function SearchFilterDock({
  searchText,
  setSearchText,
  suggestions,
  onSuggestionSelect,
  repos,
  compactRepoFilter,
  filterOpen,
  setFilterOpen,
  kindFilters,
  setKindFilters,
  repoFilters,
  setRepoFilters,
  showPackages,
  setShowPackages,
}: SearchFilterDockProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (event: MouseEvent) => {
      if ((event.target as Element | null)?.closest(".selection-popover")) return;
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
        String(item.sublabel || "").toLowerCase().includes(query) ||
        (item.aliases || []).some((alias) => alias.toLowerCase().includes(query)),
    );
    return {
      repos: matching.filter((s) => s.type === "repo"),
      projects: matching.filter((s) => s.type === "project"),
      packages: matching.filter((s) => s.type === "package"),
    };
  }, [suggestions, searchText]);
  const sortedRepos = useMemo(
    () => [...repos].sort((a, b) => a.name.localeCompare(b.name)),
    [repos],
  );

  const hasResults = grouped && (grouped.repos.length > 0 || grouped.projects.length > 0 || grouped.packages.length > 0);
  const flatResults = useMemo(
    () => grouped ? [...grouped.projects, ...grouped.repos, ...grouped.packages] : [],
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
        <div className="brand-lockup" aria-label="Dependency Radar">
          <span className="brand-mark">DR</span>
          <span className="brand-name">Dependency Radar</span>
        </div>
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
            className={`ghost-button filter-toggle has-tooltip${filterOpen ? " active" : ""}`}
            type="button"
            aria-pressed={filterOpen}
            data-tooltip="Filter project types, repositories, and external package visibility."
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
                    {item.sublabel && <span className="suggestion-meta">{item.sublabel}</span>}
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
            {grouped.repos.length > 0 && (
              <>
                <div className="suggestions-section-header">Repos</div>
                {grouped.repos.map((item) => {
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
                  </button>
                );})}
              </>
            )}
            {grouped.packages.length > 0 && (
              <>
                <div className="suggestions-section-header">External</div>
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
            <div className="filter-section-title">Project types</div>
            <div className="filter-pills">
              {DEFAULT_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`kind-pill${kindFilters[kind] !== false ? " active" : ""}`}
                  aria-pressed={kindFilters[kind] !== false}
                  title={`${KIND_LABELS[kind]} projects`}
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
                External
              </button>
            </div>
            {sortedRepos.length > 0 ? (
              <>
                <div className="filter-section-title">Repositories</div>
                <div className={`repo-filter-list${compactRepoFilter ? " compact" : ""}`}>
                  {sortedRepos.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      className={`repo-filter-item${repoFilters[repo.id] !== false ? " active" : ""}`}
                      aria-pressed={repoFilters[repo.id] !== false}
                      title={repo.displayPath || repo.path}
                      onClick={() => setRepoFilters((c) => ({ ...c, [repo.id]: c[repo.id] === false }))}
                    >
                      <span className="repo-filter-dot" />
                      {repo.name}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
