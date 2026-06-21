import { useEffect, useMemo, useRef, useState } from 'react';
import encodeHumanMapUrl from '../assets/encode-human-map.svg?url';
import type { PortalRecord } from '../data/portalData';

interface AnatomyRegion {
  id: string;
  label: string;
  description: string;
  detailPrefixes: string[];
  bodyClasses?: string[];
}

interface AnatomySelectorProps {
  portalRecords: PortalRecord[];
  selectedRegionId: string | null;
  tissueDetailOptions: string[];
  onSelectRegion: (regionId: string | null, tissueDetails: string[]) => void;
}

const bodyRegions: AnatomyRegion[] = [
  {
    id: 'brain',
    label: 'Brain',
    description: 'Cerebellum, frontal lobe, temporal lobe, and hippocampus samples.',
    detailPrefixes: ['Brain'],
    bodyClasses: ['cls-6', 'cls-68', 'cls-69', 'cls-70'],
  },
  {
    id: 'buccal',
    label: 'Buccal swab',
    description: 'Clinically accessible oral swab samples.',
    detailPrefixes: ['Buccal Swab'],
    bodyClasses: ['cls-8'],
  },
  {
    id: 'esophagus',
    label: 'Esophagus',
    description: 'Upper digestive tract tissue.',
    detailPrefixes: ['Esophagus'],
    bodyClasses: ['cls-37', 'cls-38'],
  },
  {
    id: 'lung',
    label: 'Lung',
    description: 'Thoracic respiratory tissue.',
    detailPrefixes: ['Lung'],
    bodyClasses: ['cls-24', 'cls-25'],
  },
  {
    id: 'heart',
    label: 'Heart',
    description: 'Cardiac tissue samples.',
    detailPrefixes: ['Heart'],
    bodyClasses: ['cls-33', 'cls-44', 'cls-45'],
  },
  {
    id: 'liver',
    label: 'Liver',
    description: 'Liver tissue for epigenomic and transcriptomic profiling.',
    detailPrefixes: ['Liver'],
    bodyClasses: ['cls-31', 'cls-32'],
  },
  {
    id: 'aorta',
    label: 'Aorta',
    description: 'Arterial blood vessel region used as the aorta proxy on the ENCODE map.',
    detailPrefixes: ['Aorta'],
    bodyClasses: ['cls-11'],
  },
  {
    id: 'adrenal',
    label: 'Adrenal gland',
    description: 'Left and right adrenal gland samples.',
    detailPrefixes: ['Adrenal Gland'],
    bodyClasses: ['cls-34'],
  },
  {
    id: 'colon',
    label: 'Colon',
    description: 'Ascending and descending colon regions.',
    detailPrefixes: ['Colon'],
    bodyClasses: ['cls-29', 'cls-30', 'cls-lg-intestine'],
  },
  {
    id: 'skin',
    label: 'Skin',
    description: 'Skin from abdomen and calf.',
    detailPrefixes: ['Skin'],
    bodyClasses: ['cls-5', 'cls-limb-skin'],
  },
  {
    id: 'muscle',
    label: 'Muscle',
    description: 'Muscle tissue samples.',
    detailPrefixes: ['Muscle'],
    bodyClasses: ['cls-83', 'cls-84', 'cls-85', 'cls-88', 'cls-89', 'cls-90', 'cls-91'],
  },
  {
    id: 'gonad',
    label: 'Gonad',
    description: 'Testis and ovary samples where available.',
    detailPrefixes: ['Testis', 'Ovary'],
    bodyClasses: ['cls-testis', 'cls-ovary'],
  },
];

const extraRegions: AnatomyRegion[] = [
  {
    id: 'fibroblast',
    label: 'Fibroblast',
    description: 'Separate non-anatomical selector for fibroblast-derived samples.',
    detailPrefixes: ['Fibroblast'],
  },
  {
    id: 'blood',
    label: 'Whole blood',
    description: 'Separate non-anatomical selector for clinically accessible blood samples.',
    detailPrefixes: ['Whole Blood'],
  },
];

const allRegions = [...bodyRegions, ...extraRegions];

const matchesRegionDetail = (detail: string, prefixes: string[]) =>
  prefixes.some((prefix) => detail.startsWith(prefix));

function AnatomySelector({
  portalRecords,
  selectedRegionId,
  tissueDetailOptions,
  onSelectRegion,
}: AnatomySelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch(encodeHumanMapUrl)
      .then((response) => response.text())
      .then((markup) => {
        if (!cancelled) {
          setSvgMarkup(markup);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const regionDetails = useMemo(
    () =>
      allRegions.reduce<Record<string, string[]>>((accumulator, region) => {
        accumulator[region.id] = tissueDetailOptions.filter((detail) =>
          matchesRegionDetail(detail, region.detailPrefixes),
        );
        return accumulator;
      }, {}),
    [tissueDetailOptions],
  );

  const regionCounts = useMemo(
    () =>
      allRegions.reduce<Record<string, number>>((accumulator, region) => {
        const detailSet = new Set(regionDetails[region.id] ?? []);
        accumulator[region.id] = portalRecords.filter((record) => detailSet.has(record.tissueDetail))
          .length;
        return accumulator;
      }, {}),
    [portalRecords, regionDetails],
  );

  const bodyClassToRegion = useMemo(() => {
    const map = new Map<string, string>();
    for (const region of bodyRegions) {
      for (const bodyClass of region.bodyClasses ?? []) {
        map.set(bodyClass, region.id);
      }
    }
    return map;
  }, []);

  const highlightedRegionId = hoveredRegionId ?? selectedRegionId;
  const highlightedRegion = allRegions.find((region) => region.id === highlightedRegionId) ?? null;
  const highlightedRegionDetails = highlightedRegion
    ? regionDetails[highlightedRegion.id] ?? []
    : [];

  useEffect(() => {
    const mapElement = mapRef.current;
    if (!mapElement) {
      return;
    }

    mapElement.querySelectorAll('.active').forEach((element) => {
      element.classList.remove('active');
    });

    const activeRegion = bodyRegions.find((region) => region.id === highlightedRegionId);
    if (!activeRegion) {
      return;
    }

    for (const bodyClass of activeRegion.bodyClasses ?? []) {
      mapElement.querySelectorAll(`.${bodyClass}`).forEach((element) => {
        element.classList.add('active');
      });
    }
  }, [highlightedRegionId]);

  const getRegionIdFromTarget = (target: EventTarget | null) => {
    let current = target instanceof Element ? target : null;

    while (current && current !== mapRef.current) {
      for (const className of Array.from(current.classList)) {
        const regionId = bodyClassToRegion.get(className);
        if (regionId) {
          return regionId;
        }
      }
      current = current.parentElement;
    }

    return null;
  };

  const toggleRegion = (regionId: string) => {
    const nextRegionId = selectedRegionId === regionId ? null : regionId;
    onSelectRegion(nextRegionId, nextRegionId ? regionDetails[regionId] ?? [] : []);
  };

  return (
    <section className="body-selector-card">
      <div className="body-selector-header">
        <div>
          <p className="eyebrow">Tissue selector</p>
          <h3>Select datasets by anatomy</h3>
          <p className="hero-copy">
            The human body map comes from ENCODE. Click an organ region to filter the table, and
            use the separate buttons for fibroblast and whole blood.
          </p>
        </div>
        {selectedRegionId ? (
          <button className="ghost-button" onClick={() => onSelectRegion(null, [])} type="button">
            Clear tissue selection
          </button>
        ) : null}
      </div>

      <div className="body-selector-layout">
        <div
          ref={mapRef}
          className="body-map-frame"
          onClick={(event) => {
            const regionId = getRegionIdFromTarget(event.target);
            if (regionId) {
              toggleRegion(regionId);
            }
          }}
          onMouseLeave={() => setHoveredRegionId(null)}
          onMouseMove={(event) => {
            setHoveredRegionId(getRegionIdFromTarget(event.target));
          }}
        >
          {svgMarkup ? (
            <>
              <div
                aria-label="ENCODE human body tissue selector"
                className="encode-body-map"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />
              <p className="body-map-footnote">Anatomy illustration adapted from ENCODE.</p>
            </>
          ) : (
            <div className="encode-body-map encode-body-map-loading">Loading anatomy map…</div>
          )}
        </div>

        <aside className="region-info-card">
          <div>
            <p className="eyebrow">Selection</p>
            <h3>{highlightedRegion?.label ?? 'Explore body regions'}</h3>
            <p className="hero-copy">
              {highlightedRegion?.description ??
                'Hover across the ENCODE anatomy map to preview tissue groups, then click a region to focus the dataset table.'}
            </p>
          </div>

          <div className="region-meta">
            <span>{highlightedRegionDetails.length} tissue labels</span>
            <span>
              {highlightedRegion ? regionCounts[highlightedRegion.id] ?? 0 : portalRecords.length} files
            </span>
          </div>

          <div className="region-pill-list">
            {(highlightedRegionDetails.length > 0
              ? highlightedRegionDetails
              : ['Brain, Frontal Lobe', 'Colon, Asc', 'Liver']).map((detail) => (
              <span className="region-pill" key={detail}>
                {detail}
              </span>
            ))}
          </div>

          <div className="extra-selector-block">
            <p className="eyebrow">Separate selectors</p>
            <div className="extra-selector-grid">
              {extraRegions.map((region) => {
                const isActive = selectedRegionId === region.id;
                return (
                  <button
                    key={region.id}
                    className={isActive ? 'extra-selector-button active' : 'extra-selector-button'}
                    onClick={() => toggleRegion(region.id)}
                    type="button"
                  >
                    <span>{region.label}</span>
                    <small>{regionCounts[region.id] ?? 0} files</small>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default AnatomySelector;
