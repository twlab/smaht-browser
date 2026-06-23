export interface PortalRecord {
  donor: string;
  category: string;
  tissueId: string;
  tissueDetail: string;
  assay: string;
  site: string;
  library: string;
  dataType: string;
  sampleId: string;
  fileName: string;
  fileUrl: string;
  browserTrackType: string;
}

interface MetadataEntry {
  donor: string;
  category: string;
  tissueId: string;
  tissueDetail: string;
}

interface MetadataConfig {
  file: string;
  delimiter?: string;
  columns: {
    donor: number;
    category: number;
    tissueSummary: number;
  };
  tissuePattern?: string;
}

interface TrackSourceConfig {
  assay: string;
  file: string;
  folder: string;
  matchPattern: string;
  browserTrackType?: string;
  groups: {
    donor: number;
    tissueId: number;
    sampleId?: number;
    library?: number;
    dataType?: number;
    site?: number;
  };
  defaults?: {
    site?: string;
    dataType?: string;
  };
  siteMap?: Record<string, string>;
}

export interface PortalRuntimeConfig {
  baseUrl: string;
  siteLockdown?: {
    enabled?: boolean;
    title?: string;
    message?: string;
  };
  metadata: MetadataConfig;
  assays: TrackSourceConfig[];
  browser?: {
    genomeName?: string;
    viewRegion?: string;
    showGenomeNavigator?: boolean;
    showNavBar?: boolean;
    showToolBar?: boolean;
    darkMode?: boolean;
    tracks?: Array<{
      type: string;
      name?: string;
      url?: string;
      genome?: string;
      metadata?: Record<string, string>;
      options?: Record<string, unknown>;
    }>;
  };
}

export interface FilterOptions {
  donors: string[];
  categories: string[];
  tissueIds: string[];
  tissueDetails: string[];
  assays: string[];
  sites: string[];
  libraries: string[];
}

export interface PortalDataset {
  portalRecords: PortalRecord[];
  filterOptions: FilterOptions;
  config: PortalRuntimeConfig;
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

const sortValues = (values: Iterable<string>) =>
  [...values].sort((left, right) => collator.compare(left, right));

const defaultTissuePattern = '^([^-]+?)\\s*-\\s*(.+)$';

export const emptyFilterOptions: FilterOptions = {
  donors: [],
  categories: [],
  tissueIds: [],
  tissueDetails: [],
  assays: [],
  sites: [],
  libraries: [],
};

const parseMetadata = (content: string, config: MetadataConfig) => {
  const metadataMap = new Map<string, MetadataEntry>();
  const tissueMetadataMap = new Map<string, MetadataEntry>();
  const delimiter = config.delimiter ?? '\t';
  const tissuePattern = new RegExp(config.tissuePattern ?? defaultTissuePattern);

  const metadataRows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const columns = line.split(delimiter);
      const donor = columns[config.columns.donor]?.trim();
      const category = columns[config.columns.category]?.trim();
      const tissueSummary = columns[config.columns.tissueSummary]?.trim();

      if (!donor || !category || !tissueSummary) {
        return null;
      }

      const tissueMatch = tissueSummary.match(tissuePattern);
      const tissueId = tissueMatch?.[1]?.trim() ?? tissueSummary;
      const tissueDetail = tissueMatch?.[2]?.trim() ?? '';

      return {
        donor,
        category,
        tissueId,
        tissueDetail,
      } satisfies MetadataEntry;
    })
    .filter((row): row is MetadataEntry => row !== null);

  for (const row of metadataRows) {
    metadataMap.set(`${row.donor}::${row.tissueId}`, row);
    if (!tissueMetadataMap.has(row.tissueId)) {
      tissueMetadataMap.set(row.tissueId, row);
    }
  }

  return {
    metadataRows,
    metadataMap,
    tissueMetadataMap,
  };
};

const normalizeMappedValue = (value: string, map?: Record<string, string>) => {
  if (!value) {
    return '';
  }

  const normalized = value.toLowerCase();
  return map?.[normalized] ?? value;
};

const buildRecord = (
  fileName: string,
  configBaseUrl: string,
  assayConfig: TrackSourceConfig,
  match: RegExpMatchArray,
  metadataMap: Map<string, MetadataEntry>,
  tissueMetadataMap: Map<string, MetadataEntry>,
): PortalRecord | null => {
  const donor = match[assayConfig.groups.donor]?.trim() ?? '';
  const tissueId = match[assayConfig.groups.tissueId]?.trim() ?? '';

  if (!donor || !tissueId) {
    return null;
  }

  const metadata = metadataMap.get(`${donor}::${tissueId}`) ?? tissueMetadataMap.get(tissueId);
  const sampleId = assayConfig.groups.sampleId ? match[assayConfig.groups.sampleId]?.trim() ?? '' : '';
  const library = assayConfig.groups.library ? match[assayConfig.groups.library]?.trim() ?? '' : '';
  const dataType = assayConfig.groups.dataType
    ? match[assayConfig.groups.dataType]?.trim() ?? assayConfig.defaults?.dataType ?? ''
    : assayConfig.defaults?.dataType ?? '';
  const rawSite = assayConfig.groups.site
    ? match[assayConfig.groups.site]?.trim() ?? assayConfig.defaults?.site ?? ''
    : assayConfig.defaults?.site ?? '';
  const site = normalizeMappedValue(rawSite, assayConfig.siteMap);
  const normalizedBaseUrl = configBaseUrl.endsWith('/') ? configBaseUrl.slice(0, -1) : configBaseUrl;
  const normalizedFolder = assayConfig.folder.replace(/^\/+|\/+$/g, '');
  const fileUrl = `${normalizedBaseUrl}/${normalizedFolder}/${encodeURIComponent(fileName)}`;

  return {
    donor,
    category: metadata?.category ?? 'Unknown',
    tissueId,
    tissueDetail: metadata?.tissueDetail ?? '',
    assay: assayConfig.assay,
    site,
    library,
    dataType,
    sampleId,
    fileName,
    fileUrl,
    browserTrackType: assayConfig.browserTrackType ?? 'bigwig',
  };
};

const parseTrackSource = (
  content: string,
  configBaseUrl: string,
  assayConfig: TrackSourceConfig,
  metadataMap: Map<string, MetadataEntry>,
  tissueMetadataMap: Map<string, MetadataEntry>,
) => {
  const matcher = new RegExp(assayConfig.matchPattern);
  let unmatchedLines = 0;

  const records = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((fileName) => {
      const match = fileName.match(matcher);
      if (!match) {
        unmatchedLines += 1;
        return null;
      }

      return buildRecord(fileName, configBaseUrl, assayConfig, match, metadataMap, tissueMetadataMap);
    })
    .filter((record): record is PortalRecord => record !== null);

  if (unmatchedLines > 0) {
    console.warn(
      `Skipped ${unmatchedLines} unmatched lines while parsing ${assayConfig.assay} from ${assayConfig.file}.`,
    );
  }

  return records;
};

const buildFilterOptions = (portalRecords: PortalRecord[], metadataRows: MetadataEntry[]): FilterOptions => {
  const donors = new Set<string>();
  const categories = new Set<string>(metadataRows.map((row) => row.category));
  const tissueIds = new Set<string>();
  const tissueDetails = new Set<string>();
  const assays = new Set<string>();
  const sites = new Set<string>();
  const libraries = new Set<string>();

  for (const record of portalRecords) {
    donors.add(record.donor);
    categories.add(record.category);
    tissueIds.add(record.tissueId);
    if (record.tissueDetail) {
      tissueDetails.add(record.tissueDetail);
    }
    assays.add(record.assay);
    if (record.site) {
      sites.add(record.site);
    }
    if (record.library) {
      libraries.add(record.library);
    }
  }

  return {
    donors: sortValues(donors),
    categories: sortValues(categories),
    tissueIds: sortValues(tissueIds),
    tissueDetails: sortValues(tissueDetails),
    assays: sortValues(assays),
    sites: sortValues(sites),
    libraries: sortValues(libraries),
  };
};

const fetchText = async (path: string) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
  }

  return response.text();
};

const resolveUrl = (path: string, base: string) => new URL(path, base).toString();

export const loadPortalData = async (
  configPath = `${import.meta.env.BASE_URL}data/portal-config.json`,
): Promise<PortalDataset> => {
  const configResponse = await fetch(configPath);
  if (!configResponse.ok) {
    throw new Error(`Failed to load ${configPath}: ${configResponse.status} ${configResponse.statusText}`);
  }

  const config = (await configResponse.json()) as PortalRuntimeConfig;
  if (config.siteLockdown?.enabled) {
    return {
      portalRecords: [],
      filterOptions: emptyFilterOptions,
      config,
    };
  }

  const resolvedConfigUrl = new URL(configPath, window.location.href).toString();
  const [metadataContent, ...assayContents] = await Promise.all([
    fetchText(resolveUrl(config.metadata.file, resolvedConfigUrl)),
    ...config.assays.map((assay) => fetchText(resolveUrl(assay.file, resolvedConfigUrl))),
  ]);

  const { metadataRows, metadataMap, tissueMetadataMap } = parseMetadata(metadataContent, config.metadata);

  const portalRecords = config.assays
    .flatMap((assay, index) =>
      parseTrackSource(assayContents[index], config.baseUrl, assay, metadataMap, tissueMetadataMap),
    )
    .sort((left, right) => {
      const donorCompare = collator.compare(left.donor, right.donor);
      if (donorCompare !== 0) {
        return donorCompare;
      }

      const tissueCompare = collator.compare(left.tissueId, right.tissueId);
      if (tissueCompare !== 0) {
        return tissueCompare;
      }

      return collator.compare(left.fileName, right.fileName);
    });

  return {
    portalRecords,
    filterOptions: buildFilterOptions(portalRecords, metadataRows),
    config,
  };
};
