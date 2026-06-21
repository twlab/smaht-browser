import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import AnatomySelector from './components/AnatomySelector';
import {
  emptyFilterOptions,
  loadPortalData,
  type FilterOptions,
  type PortalDataset,
  type PortalRecord,
} from './data/portalData';

type FilterKey =
  | 'donors'
  | 'categories'
  | 'tissueIds'
  | 'tissueDetails'
  | 'assays'
  | 'sites'
  | 'libraries';

type FiltersState = Record<FilterKey, string[]>;
type Theme = 'light' | 'dark';
type PageTab = 'selection' | 'browser';

interface BrowserTrack extends Record<string, unknown> {
  name?: string;
  type: string;
  url?: string;
  genome?: string;
  metadata?: Record<string, string>;
  options?: Record<string, unknown>;
}

const LARGE_FILTER_THRESHOLD = 10;
const BrowserWorkspace = lazy(() => import('./components/BrowserWorkspace'));

const emptyFilters: FiltersState = {
  donors: [],
  categories: [],
  tissueIds: [],
  tissueDetails: [],
  assays: [],
  sites: [],
  libraries: [],
};

const emptyFilterSearch: Record<FilterKey, string> = {
  donors: '',
  categories: '',
  tissueIds: '',
  tissueDetails: '',
  assays: '',
  sites: '',
  libraries: '',
};

const filterSectionDefinitions: Array<{
  key: FilterKey;
  label: string;
  description: string;
}> = [
  { key: 'donors', label: 'Donor', description: 'SMHT004, SMHT005, and other available donors' },
  { key: 'categories', label: 'Category', description: 'Ectoderm, Germ Cells, Endoderm, and more' },
  { key: 'tissueIds', label: 'Tissue ID', description: 'Compact tissue code such as 3E, 3G, or 3AH' },
  { key: 'tissueDetails', label: 'Tissue Detail', description: 'Expanded tissue description from metadata' },
  { key: 'assays', label: 'Assay', description: 'Available assay track groups from the runtime data configuration' },
  { key: 'sites', label: 'GCC', description: 'Generating center inferred from the file list' },
  { key: 'libraries', label: 'Library', description: 'RNA-seq library identifiers such as LIB087298-DIL01' },
];

const matchesFilter = (selectedValues: string[], value: string) =>
  selectedValues.length === 0 || selectedValues.includes(value);

const getVisibleRecords = (records: PortalRecord[], filters: FiltersState, search: string) => {
  const normalizedSearch = search.trim().toLowerCase();

  return records.filter((record) => {
    const matchesSelections =
      matchesFilter(filters.donors, record.donor) &&
      matchesFilter(filters.categories, record.category) &&
      matchesFilter(filters.tissueIds, record.tissueId) &&
      matchesFilter(filters.tissueDetails, record.tissueDetail) &&
      matchesFilter(filters.assays, record.assay) &&
      matchesFilter(filters.sites, record.site) &&
      matchesFilter(filters.libraries, record.library);

    if (!matchesSelections) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [
      record.fileName,
      record.fileUrl,
      record.donor,
      record.category,
      record.tissueId,
      record.tissueDetail,
      record.assay,
      record.site,
      record.library,
      record.sampleId,
      record.dataType,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  });
};

const downloadVisibleRecords = (records: PortalRecord[]) => {
  const header = [
    'donor',
    'category',
    'tissue_id',
    'tissue_detail',
    'assay',
    'gcc',
    'library',
    'data_type',
    'sample_id',
    'file_name',
    'file_url',
  ];

  const lines = [
    header.join('\t'),
    ...records.map((record) =>
      [
        record.donor,
        record.category,
        record.tissueId,
        record.tissueDetail,
        record.assay,
        record.site,
        record.library,
        record.dataType,
        record.sampleId,
        record.fileName,
        record.fileUrl,
      ].join('\t'),
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'smaht-data-portal-selection.tsv';
  link.click();
  URL.revokeObjectURL(url);
};

const buildBrowserTracks = (dataset: PortalDataset, records: PortalRecord[]): BrowserTrack[] => {
  const staticTracks = dataset.config.browser?.tracks ?? [];
  const dataTracks = records.map((record) => ({
    type: record.browserTrackType,
    name: `${record.donor} ${record.tissueId} ${record.assay}${record.dataType ? ` ${record.dataType}` : ''}`,
    url: record.fileUrl,
    metadata: {
      donor: record.donor,
      assay: record.assay,
      tissueId: record.tissueId,
      tissueDetail: record.tissueDetail,
      category: record.category,
      gcc: record.site,
      library: record.library || '',
    },
    options: {
      group: `${record.assay} • ${record.tissueDetail || record.tissueId}`,
      label: record.fileName,
    },
  }));

  return [...staticTracks, ...dataTracks];
};

function App() {
  const [dataset, setDataset] = useState<PortalDataset | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>(emptyFilters);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<Theme>('light');
  const [activeTab, setActiveTab] = useState<PageTab>('selection');
  const [selectedAnatomyRegionId, setSelectedAnatomyRegionId] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState<Record<FilterKey, string>>(emptyFilterSearch);
  const [browserTracks, setBrowserTracks] = useState<BrowserTrack[]>([]);
  const [browserTrackCount, setBrowserTrackCount] = useState(0);
  const [browserRefreshKey, setBrowserRefreshKey] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    loadPortalData()
      .then((loadedDataset) => {
        if (!cancelled) {
          setDataset(loadedDataset);
          setDataError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDataError(error instanceof Error ? error.message : 'Failed to load portal data.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions: FilterOptions = dataset?.filterOptions ?? emptyFilterOptions;
  const portalRecords = dataset?.portalRecords ?? [];
  const filterSections = useMemo(
    () =>
      filterSectionDefinitions.map((section) => ({
        ...section,
        options: filterOptions[section.key],
      })),
    [filterOptions],
  );

  const visibleRecords = useMemo(
    () => getVisibleRecords(portalRecords, filters, search),
    [portalRecords, filters, search],
  );

  const summary = useMemo(() => {
    const donors = new Set(visibleRecords.map((record) => record.donor));
    const tissues = new Set(visibleRecords.map((record) => `${record.donor}::${record.tissueId}`));
    const assays = new Set(visibleRecords.map((record) => record.assay));
    const libraries = new Set(visibleRecords.map((record) => record.library).filter(Boolean));

    return {
      fileCount: visibleRecords.length,
      donorCount: donors.size,
      tissueCount: tissues.size,
      assayCount: assays.size,
      libraryCount: libraries.size,
    };
  }, [visibleRecords]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).reduce((total, values) => total + values.length, 0),
    [filters],
  );

  const clearAnatomySelectionIfNeeded = (key: FilterKey) => {
    if (key === 'tissueIds' || key === 'tissueDetails') {
      setSelectedAnatomyRegionId(null);
    }
  };

  const toggleFilter = (key: FilterKey, option: string) => {
    clearAnatomySelectionIfNeeded(key);
    setFilters((current) => {
      const values = current[key];
      return {
        ...current,
        [key]: values.includes(option)
          ? values.filter((value) => value !== option)
          : [...values, option],
      };
    });
  };

  const selectAllFilters = (key: FilterKey, options: string[]) => {
    clearAnatomySelectionIfNeeded(key);
    setFilters((current) => ({
      ...current,
      [key]: [...new Set([...current[key], ...options])],
    }));
  };

  const clearSectionFilters = (key: FilterKey) => {
    clearAnatomySelectionIfNeeded(key);
    setFilters((current) => ({
      ...current,
      [key]: [],
    }));
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setSearch('');
    setSelectedAnatomyRegionId(null);
    setFilterSearch(emptyFilterSearch);
  };

  const handleAnatomySelection = (regionId: string | null, tissueDetails: string[]) => {
    setSelectedAnatomyRegionId(regionId);
    setFilters((current) => ({
      ...current,
      tissueIds: [],
      tissueDetails,
    }));
  };

  const updateBrowserVisualization = () => {
    if (!dataset || visibleRecords.length === 0) {
      return;
    }

    setBrowserTracks(buildBrowserTracks(dataset, visibleRecords));
    setBrowserTrackCount(visibleRecords.length);
    setBrowserRefreshKey((current) => current + 1);
    setActiveTab('browser');
  };

  const browserConfig = dataset?.config.browser;

  return (
    <div className="app-shell">
      <aside className="filter-panel">
        <div className="panel-header">
          <div className="logo-row">
            <img
              alt="SMAHT Network logo"
              className="smaht-logo"
              src={
                theme === 'light'
                  ? 'https://smaht.org/images/logo.png'
                  : 'https://smaht.org/images/logo-w.png'
              }
            />
            <button
              className="secondary-button theme-button"
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              type="button"
            >
              <span aria-hidden="true" className="theme-icon">
                {theme === 'light' ? '☀' : '☾'}
              </span>
            </button>
          </div>
          <p className="panel-copy">
            Browse SMaHT epigenomic datasets by donor, tissue, category, assay, GCC, and library.
          </p>
        </div>

        <div className="search-card">
          <label className="search-label" htmlFor="search">
            Search files
          </label>
          <input
            id="search"
            className="search-input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SMHT005, LIB087298-DIL01, 3E, WashU..."
          />
        </div>

        <div className="filter-toolbar">
          <span>{activeFilterCount} active filters</span>
          <div className="toolbar-actions">
            <button className="ghost-button" onClick={clearFilters} type="button">
              Clear all
            </button>
          </div>
        </div>

        <div className="filter-sections">
          {filterSections.map((section) => {
            const showFilterTools = section.options.length > LARGE_FILTER_THRESHOLD;
            const optionSearch = filterSearch[section.key].trim().toLowerCase();
            const visibleOptions = section.options.filter((option) =>
              option.toLowerCase().includes(optionSearch),
            );

            return (
              <section className="filter-card" key={section.key}>
                <div className="filter-card-header">
                  <h2>{section.label}</h2>
                  <p>{section.description}</p>
                </div>

                {showFilterTools ? (
                  <div className="filter-tools">
                    <input
                      aria-label={`Search ${section.label}`}
                      className="mini-search-input"
                      onChange={(event) =>
                        setFilterSearch((current) => ({
                          ...current,
                          [section.key]: event.target.value,
                        }))
                      }
                      placeholder={`Search ${section.label.toLowerCase()}`}
                      type="search"
                      value={filterSearch[section.key]}
                    />
                    <div className="filter-bulk-actions">
                      <button
                        className="bulk-action-button"
                        onClick={() => selectAllFilters(section.key, visibleOptions)}
                        type="button"
                      >
                        ✓ All
                      </button>
                      <button
                        className="bulk-action-button"
                        onClick={() => clearSectionFilters(section.key)}
                        type="button"
                      >
                        None
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="option-grid">
                  {visibleOptions.map((option) => {
                    const selected = filters[section.key].includes(option);
                    return (
                      <button
                        key={option}
                        className={selected ? 'filter-chip selected' : 'filter-chip'}
                        onClick={() => toggleFilter(section.key, option)}
                        type="button"
                      >
                        <span className="chip-check" aria-hidden="true">
                          {selected ? '✓' : ''}
                        </span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </aside>

      <main className="content-panel">
        <section className="hero-card">
          <div>
            <h2>The SMaHT Epigenomics Browser</h2>
            <p className="hero-copy">
              A web-based data portal and visualization platform for SMaHT-generated epigenomic
              datasets, designed to support browsing, filtering, and integrative exploration with
              the embedded WashU Epigenome Browser.
            </p>
          </div>
          <div className="hero-actions">
            <button
              className="secondary-button"
              onClick={updateBrowserVisualization}
              disabled={!dataset || visibleRecords.length === 0}
              type="button"
            >
              Update browser visualization
            </button>
            <button
              className="primary-button"
              onClick={() => downloadVisibleRecords(visibleRecords)}
              disabled={!dataset}
              type="button"
            >
              Download filtered TSV
            </button>
          </div>
        </section>

        <div className="tab-strip" role="tablist" aria-label="Portal views">
          <button
            className={activeTab === 'selection' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('selection')}
            role="tab"
            aria-selected={activeTab === 'selection'}
            type="button"
          >
            Data selection
          </button>
          <button
            className={activeTab === 'browser' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('browser')}
            role="tab"
            aria-selected={activeTab === 'browser'}
            type="button"
          >
            Browser
          </button>
        </div>

        {dataError ? (
          <section className="status-card">
            <strong>Data loading error</strong>
            <p>{dataError}</p>
          </section>
        ) : null}

        {!dataset && !dataError ? (
          <section className="status-card">
            <strong>Loading data configuration</strong>
            <p>Reading the portal config and external data files.</p>
          </section>
        ) : null}

        {activeTab === 'selection' ? (
          <>
            {dataset ? (
              <AnatomySelector
                portalRecords={portalRecords}
                selectedRegionId={selectedAnatomyRegionId}
                tissueDetailOptions={filterOptions.tissueDetails}
                onSelectRegion={handleAnatomySelection}
              />
            ) : null}

            <section className="poster-grid">
              <article className="poster-content-card">
                <p className="eyebrow">Overview</p>
                <p>
                  The NIH-supported Somatic Mosaicism across Human Tissues Network studies somatic
                  variation across development, aging, and disease, and has generated extensive
                  multi-omics and epigenomic datasets across human tissues.
                </p>
                <p>
                  This portal lets you build a filtered selection of hosted track URLs and then send
                  that selection directly into an embedded WashU Epigenome Browser session.
                </p>
              </article>

              <article className="poster-content-card">
                <p className="eyebrow">Hosted track URLs</p>
                <p>
                  Track file URLs are generated from the runtime config base URL and per-assay
                  folders in <code>public/data/portal-config.json</code>.
                </p>
                <p>
                  Each filtered row now represents a web-accessible track URL with donor, assay,
                  tissue, and library metadata attached.
                </p>
              </article>
            </section>

            <section className="summary-grid">
              <article className="summary-card">
                <span>Selected Files</span>
                <strong>{summary.fileCount}</strong>
              </article>
              <article className="summary-card">
                <span>Donors</span>
                <strong>{summary.donorCount}</strong>
              </article>
              <article className="summary-card">
                <span>Donor/Tissue Pairs</span>
                <strong>{summary.tissueCount}</strong>
              </article>
              <article className="summary-card">
                <span>Assays</span>
                <strong>{summary.assayCount}</strong>
              </article>
              <article className="summary-card">
                <span>Libraries</span>
                <strong>{summary.libraryCount}</strong>
              </article>
            </section>

            <section className="results-card">
              <div className="results-header">
                <div>
                  <h2>Selected files</h2>
                  <p>{visibleRecords.length} matching records</p>
                </div>
                <div className="results-actions">
                  <button
                    className="secondary-button"
                    onClick={updateBrowserVisualization}
                    disabled={!dataset || visibleRecords.length === 0}
                    type="button"
                  >
                    Load current selection in browser
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Donor</th>
                      <th>Category</th>
                      <th>Tissue ID</th>
                      <th>Tissue Detail</th>
                      <th>Assay</th>
                      <th>GCC</th>
                      <th>Library</th>
                      <th>Data Type</th>
                      <th>Sample ID</th>
                      <th>File Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((record) => (
                      <tr key={record.fileUrl}>
                        <td>{record.donor}</td>
                        <td>{record.category}</td>
                        <td>{record.tissueId}</td>
                        <td>{record.tissueDetail || '—'}</td>
                        <td>{record.assay}</td>
                        <td>{record.site}</td>
                        <td>{record.library || '—'}</td>
                        <td>{record.dataType || '—'}</td>
                        <td>{record.sampleId || '—'}</td>
                        <td className="file-cell">
                          {record.fileName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="browser-panel">
            <div className="browser-panel-header">
              <div>
                <h3>Embedded WashU Epigenome Browser</h3>
                <p className="hero-copy">
                  The browser uses the current applied selection only after you click{' '}
                  <strong>Update browser visualization</strong> on the selection tab.
                </p>
              </div>
              <div className="browser-selection-summary">
                <span>{browserTrackCount} selected data tracks</span>
                <button
                  className="ghost-button"
                  onClick={() => setActiveTab('selection')}
                  type="button"
                >
                  Back to data selection
                </button>
              </div>
            </div>

            {!dataset ? null : browserTracks.length === 0 ? (
              <div className="status-card">
                <strong>No browser selection loaded yet</strong>
                <p>Filter the data selection tab, then click Update browser visualization.</p>
              </div>
            ) : (
              <div className="browser-frame">
                <Suspense
                  fallback={
                    <div className="status-card browser-loading-card">
                      <strong>Loading embedded browser</strong>
                      <p>Preparing the WashU Epigenome Browser component.</p>
                    </div>
                  }
                >
                  <BrowserWorkspace
                    key={browserRefreshKey}
                    darkMode={theme === 'dark' || browserConfig?.darkMode === true}
                    genomeName={browserConfig?.genomeName ?? 'hg38'}
                    showGenomeNavigator={browserConfig?.showGenomeNavigator ?? true}
                    showNavBar={browserConfig?.showNavBar ?? true}
                    showToolBar={browserConfig?.showToolBar ?? true}
                    tracks={browserTracks}
                    viewRegion={browserConfig?.viewRegion ?? 'chr7:27053397-27373765'}
                  />
                </Suspense>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
